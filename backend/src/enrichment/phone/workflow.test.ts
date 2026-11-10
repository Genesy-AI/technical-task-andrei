import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'crypto'
import path from 'path'
import { TestWorkflowEnvironment } from '@temporalio/testing'
import { installTemporalTestRuntime } from '../../test/temporalTestLogger'
import { Worker } from '@temporalio/worker'
import { ApplicationFailure, Context } from '@temporalio/activity'
import { WorkflowFailedError } from '@temporalio/client'
import type { PhoneActivities } from './activities'
import type { FinalOutcome, LeadForEnrichment, ProviderLookupResult, ProviderName } from './domain/types'
import { enrichPhoneWorkflow } from './workflow'

const lead: LeadForEnrichment = {
  id: 7,
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@acme.com',
  jobTitle: 'CTO',
}

type ProviderBehaviour = (attempt: number) => ProviderLookupResult | Error
const none: ProviderBehaviour = () => ({ kind: 'none' })
const skipped: ProviderBehaviour = () => ({ kind: 'skipped' })
const found =
  (phone: string): ProviderBehaviour =>
  () => ({ kind: 'found', phone })
const serverError: ProviderBehaviour = () => ApplicationFailure.retryable('HTTP 500', 'ProviderServerError')
const badAuth: ProviderBehaviour = () => ApplicationFailure.nonRetryable('HTTP 401', 'ProviderClientError')

let env: TestWorkflowEnvironment

beforeAll(async () => {
  installTemporalTestRuntime()
  env = await TestWorkflowEnvironment.createTimeSkipping()
}, 120_000)

afterAll(async () => {
  await env?.teardown()
})

/** Runs the workflow against mocked activities. Providers default to "none". */
async function run(
  behaviours: Partial<Record<ProviderName, ProviderBehaviour>>,
  leadInDb: LeadForEnrichment | null = lead
) {
  const calls: ProviderName[] = []
  const activities: PhoneActivities = {
    loadLead: vi.fn(async () => leadInDb),
    markProgress: vi.fn(async () => undefined),
    saveResult: vi.fn(async () => undefined),
    findPhoneWith: vi.fn(async (provider: ProviderName) => {
      calls.push(provider)
      const attempt = calls.filter((p) => p === provider).length
      const result = (behaviours[provider] ?? none)(attempt)
      if (result instanceof Error) throw result
      return result
    }),
  }

  const taskQueue = `test-${randomUUID()}`
  const worker = await Worker.create({
    connection: env.nativeConnection,
    taskQueue,
    workflowsPath: path.join(__dirname, 'workflow.ts'),
    activities,
  })

  const outcome: FinalOutcome = await worker.runUntil(
    env.client.workflow.execute(enrichPhoneWorkflow, { taskQueue, workflowId: randomUUID(), args: [7] })
  )
  return { outcome, calls, activities }
}

describe('enrichPhoneWorkflow', () => {
  it('stops at Orion when Orion finds a phone', async () => {
    const { outcome, calls, activities } = await run({ ORION: found('8221471051') })

    expect(outcome).toEqual({ status: 'FOUND', phone: '8221471051', source: 'ORION' })
    expect(calls).toEqual(['ORION'])
    expect(activities.saveResult).toHaveBeenCalledWith(7, outcome)
  })

  it('tries Astra when Orion has no phone', async () => {
    const { outcome, calls } = await run({ ORION: none, ASTRA: found('8391612328') })

    expect(outcome).toEqual({ status: 'FOUND', phone: '8391612328', source: 'ASTRA' })
    expect(calls).toEqual(['ORION', 'ASTRA'])
  })

  it('is NO_DATA when no provider has a phone', async () => {
    const { outcome, calls, activities } = await run({})

    expect(outcome).toEqual({ status: 'NO_DATA' })
    expect(calls).toEqual(['ORION', 'ASTRA', 'NIMBUS'])
    expect(activities.saveResult).toHaveBeenCalledWith(7, { status: 'NO_DATA' })
  })

  it('marks progress before each provider it tries', async () => {
    const { activities } = await run({ ASTRA: found('8391612328') })

    expect(vi.mocked(activities.markProgress).mock.calls).toEqual([
      [7, 'ORION'],
      [7, 'ASTRA'],
    ])
  })

  it('passes the loaded lead to providers', async () => {
    const { activities } = await run({ ORION: found('1') })

    expect(activities.findPhoneWith).toHaveBeenCalledWith('ORION', lead)
  })

  it('moves on to Astra when Orion is skipped (e.g. free mail)', async () => {
    const { outcome, calls } = await run({ ORION: skipped, ASTRA: found('8391612328') })

    expect(outcome).toEqual({ status: 'FOUND', phone: '8391612328', source: 'ASTRA' })
    expect(calls).toEqual(['ORION', 'ASTRA'])
  })

  it('retries a failing provider 3 times, then moves on', async () => {
    const { outcome, calls } = await run({ ORION: serverError, ASTRA: found('8391612328') })

    expect(outcome).toEqual({ status: 'FOUND', phone: '8391612328', source: 'ASTRA' })
    expect(calls).toEqual(['ORION', 'ORION', 'ORION', 'ASTRA'])
  })

  it('uses a later retry when an earlier attempt failed', async () => {
    const flaky: ProviderBehaviour = (attempt) =>
      attempt < 3 ? serverError(attempt) : { kind: 'found', phone: '1' }

    const { outcome, calls } = await run({ ORION: flaky })

    expect(outcome).toEqual({ status: 'FOUND', phone: '1', source: 'ORION' })
    expect(calls).toEqual(['ORION', 'ORION', 'ORION'])
  })

  it('does not retry non-retryable errors (e.g. bad auth)', async () => {
    const { calls } = await run({ ORION: badAuth })

    expect(calls).toEqual(['ORION', 'ASTRA', 'NIMBUS'])
  })

  it('is FAILED with every error when all providers fail', async () => {
    const { outcome, activities } = await run({ ORION: badAuth, ASTRA: badAuth, NIMBUS: badAuth })

    expect(outcome).toEqual({ status: 'FAILED', error: 'ORION: HTTP 401; ASTRA: HTTP 401; NIMBUS: HTTP 401' })
    expect(activities.saveResult).toHaveBeenCalledWith(7, outcome)
  })

  it('is NO_DATA (not FAILED) when one provider answered and the others failed', async () => {
    const { outcome } = await run({ ORION: badAuth, ASTRA: none, NIMBUS: badAuth })

    expect(outcome).toEqual({ status: 'NO_DATA' })
  })

  it('does nothing when the lead no longer exists', async () => {
    const { outcome, calls, activities } = await run({}, null)

    expect(outcome).toEqual({ status: 'FAILED', error: 'Lead 7 not found' })
    expect(calls).toEqual([])
    expect(activities.markProgress).not.toHaveBeenCalled()
    expect(activities.saveResult).not.toHaveBeenCalled()
  })

  describe('when the run dies instead of finishing', () => {
    /** Worker with base mocks that tests override; returns the activities to assert on. */
    async function workerWith(overrides: Partial<PhoneActivities>) {
      const activities: PhoneActivities = {
        loadLead: vi.fn(async () => lead),
        markProgress: vi.fn(async () => undefined),
        saveResult: vi.fn(async () => undefined),
        findPhoneWith: vi.fn(async () => ({ kind: 'none' }) as ProviderLookupResult),
        ...overrides,
      }
      const taskQueue = `test-${randomUUID()}`
      const worker = await Worker.create({
        connection: env.nativeConnection,
        taskQueue,
        workflowsPath: path.join(__dirname, 'workflow.ts'),
        activities,
      })
      return { activities, worker, taskQueue }
    }

    it('saves FAILED when a DB step keeps failing, so the lead is not stuck in RUNNING', async () => {
      const { activities, worker, taskQueue } = await workerWith({
        markProgress: vi.fn(async () => {
          throw ApplicationFailure.nonRetryable('database is locked', 'DbError')
        }),
      })

      const result = worker.runUntil(
        env.client.workflow.execute(enrichPhoneWorkflow, { taskQueue, workflowId: randomUUID(), args: [7] })
      )

      await expect(result).rejects.toBeInstanceOf(WorkflowFailedError)
      expect(activities.saveResult).toHaveBeenCalledWith(7, expect.objectContaining({ status: 'FAILED' }))
    })

    it('saves FAILED when the run is cancelled mid-provider', async () => {
      let providerStarted: () => void = () => undefined
      const started = new Promise<void>((resolve) => (providerStarted = resolve))
      const { activities, worker, taskQueue } = await workerWith({
        findPhoneWith: vi.fn(async () => {
          providerStarted()
          await Context.current().cancelled // hang until cancelled (worker shutdown)
          return { kind: 'none' } as ProviderLookupResult
        }),
      })

      const result = worker.runUntil(async () => {
        const handle = await env.client.workflow.start(enrichPhoneWorkflow, {
          taskQueue,
          workflowId: randomUUID(),
          args: [7],
        })
        await started
        await handle.cancel()
        await expect(handle.result()).rejects.toBeInstanceOf(WorkflowFailedError)
      })

      await result
      expect(activities.saveResult).toHaveBeenCalledWith(7, expect.objectContaining({ status: 'FAILED' }))
    })
  })
})
