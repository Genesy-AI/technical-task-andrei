import { describe, it, expect, vi } from 'vitest'
import { createLeadVerificationService, VERIFY_EMAIL_CONCURRENCY, VERIFY_ERROR_MESSAGES } from './service'
import type { LeadToVerify } from './ports'

type Fakes = {
  verify: (lead: LeadToVerify) => Promise<boolean>
  save?: (leadId: number, emailVerified: boolean) => Promise<void>
  logError?: (message: string, error: unknown) => void
  concurrency?: number
}

/** Builds the service from plain functions, so each test only fakes what it cares about. */
const serviceWith = ({ verify, save = async () => {}, logError = () => {}, concurrency }: Fakes) =>
  createLeadVerificationService({
    verifier: { verify },
    repository: { saveEmailVerified: save },
    logger: { error: logError },
    concurrency,
  })

const lead = (id: number, email = `lead${id}@example.com`): LeadToVerify => ({
  id,
  firstName: `First${id}`,
  lastName: `Last${id}`,
  email,
})

const flush = () => new Promise((r) => setImmediate(r))

// Mirrors Temporal: WorkflowFailedError → ActivityFailure → TimeoutFailure
const withCause = (message: string, cause: Error) => Object.assign(new Error(message), { cause })
const temporalTimeout = () =>
  withCause(
    'Workflow execution failed',
    withCause('Activity task failed', new Error('activity StartToClose timeout'))
  )

describe('createLeadVerificationService', () => {
  it('defaults to a parallelism of 5', () => {
    expect(VERIFY_EMAIL_CONCURRENCY).toBe(5)
  })

  it('logs to the console when no logger is given', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const service = createLeadVerificationService({
      verifier: { verify: async () => Promise.reject(new Error('boom')) },
      repository: { saveEmailVerified: async () => {} },
    })

    await service.verifyLeads([lead(1)])

    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('lead 1'), expect.any(Error))
    consoleError.mockRestore()
  })

  it('verifies leads in parallel, up to the concurrency limit', async () => {
    const leads = Array.from({ length: 8 }, (_, i) => lead(i + 1))
    const release: Array<() => void> = []
    let running = 0
    let maxRunning = 0

    const promise = serviceWith({
      concurrency: 3,
      verify: async () => {
        running += 1
        maxRunning = Math.max(maxRunning, running)
        await new Promise<void>((r) => release.push(r))
        running -= 1
        return true
      },
      save: async () => {},
    }).verifyLeads(leads)

    await flush()
    expect(running).toBe(3)

    while (release.length || running) {
      release.splice(0).forEach((r) => r())
      await flush()
    }

    const result = await promise
    expect(maxRunning).toBe(3)
    expect(result.verifiedCount).toBe(8)
  })

  it('does not let a slow lead hold up the others', async () => {
    const leads = [lead(1, 'slow@example.com'), lead(2), lead(3)]
    const finished: number[] = []
    let releaseSlow!: () => void

    const promise = serviceWith({
      concurrency: 2,
      verify: async (l) => {
        if (l.email === 'slow@example.com') await new Promise<void>((r) => (releaseSlow = r))
        return true
      },
      save: async (leadId) => {
        finished.push(leadId)
      },
    }).verifyLeads(leads)

    await flush()
    expect(finished).toEqual([2, 3])

    releaseSlow()
    await promise
    expect(finished).toEqual([2, 3, 1])
  })

  it('reports per-lead outcomes and keeps going when some leads fail', async () => {
    const leads = [lead(1), lead(2, 'jane.smith@example.com'), lead(3, 'john.doe@example.com')]
    const saved: Array<[number, boolean]> = []

    const result = await serviceWith({
      verify: async (l) => {
        if (l.email.startsWith('jane.smith')) throw temporalTimeout()
        return !l.email.startsWith('john.doe')
      },
      save: async (leadId, verified) => {
        saved.push([leadId, verified])
      },
      logError: () => {},
    }).verifyLeads(leads)

    expect(result).toEqual({
      success: true,
      verifiedCount: 2,
      results: [
        { leadId: 1, emailVerified: true },
        { leadId: 3, emailVerified: false },
      ],
      errors: [{ leadId: 2, leadName: 'First2 Last2', error: VERIFY_ERROR_MESSAGES.verifyFailed }],
    })
    expect(saved).toEqual([
      [1, true],
      [3, false],
    ])
  })

  it('records a lead as failed when saving its result fails', async () => {
    const result = await serviceWith({
      verify: async () => true,
      save: async () => {
        throw new Error('database is locked')
      },
      logError: () => {},
    }).verifyLeads([lead(1)])

    expect(result.verifiedCount).toBe(0)
    expect(result.results).toEqual([])
    expect(result.errors).toEqual([
      { leadId: 1, leadName: 'First1 Last1', error: VERIFY_ERROR_MESSAGES.saveFailed },
    ])
  })

  describe('error details stay on the server', () => {
    const internals = [
      'database is locked',
      'SQLITE_BUSY',
      'Invalid `prisma.lead.update()` invocation',
      'Workflow execution failed',
      'activity StartToClose timeout',
    ]

    async function run() {
      const logError = vi.fn()
      const result = await serviceWith({
        verify: async (l) => {
          if (l.id === 1) throw temporalTimeout()
          return true
        },
        save: async () => {
          throw new Error('Invalid `prisma.lead.update()` invocation: SQLITE_BUSY: database is locked')
        },
        logError,
      }).verifyLeads([lead(1, 'jane.smith@example.com'), lead(2)])
      return { result, logError }
    }

    it('never puts internal error messages in the response', async () => {
      const { result } = await run()
      const body = JSON.stringify(result)

      for (const internal of internals) expect(body).not.toContain(internal)
      expect(result.errors.map((e) => e.error)).toEqual([
        VERIFY_ERROR_MESSAGES.verifyFailed,
        VERIFY_ERROR_MESSAGES.saveFailed,
      ])
    })

    it('logs the original error with the lead id so it can be investigated', async () => {
      const { logError } = await run()

      expect(logError).toHaveBeenCalledTimes(2)
      expect(logError).toHaveBeenCalledWith(
        expect.stringContaining('lead 1'),
        expect.objectContaining({ message: 'Workflow execution failed' })
      )
      expect(logError).toHaveBeenCalledWith(
        expect.stringContaining('lead 2'),
        expect.objectContaining({ message: expect.stringContaining('database is locked') })
      )
    })
  })
})
