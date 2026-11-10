import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { WorkflowClient } from '@temporalio/client'
import { TestWorkflowEnvironment } from '@temporalio/testing'
import { temporalTestLogger } from '../../../test/temporalTestLogger'
import { Runtime } from '@temporalio/worker'
import { TemporalPhoneWorkflowStarter, phoneWorkflowId } from './temporalWorkflowStarter'
import { enrichPhoneWorkflow } from '../workflow'

describe('phoneWorkflowId', () => {
  it('is one fixed id per lead', () => {
    expect(phoneWorkflowId(42)).toBe('enrich-phone-42')
  })
})

describe('TemporalPhoneWorkflowStarter', () => {
  it('starts enrichPhoneWorkflow with a per-lead id and dedupe policies', async () => {
    const start = vi.fn().mockResolvedValue({})
    const starter = new TemporalPhoneWorkflowStarter(
      { start } as unknown as Pick<WorkflowClient, 'start'>,
      'myQueue'
    )

    await starter.start(42)

    expect(start).toHaveBeenCalledWith(enrichPhoneWorkflow, {
      workflowId: 'enrich-phone-42',
      taskQueue: 'myQueue',
      args: [42],
      workflowIdConflictPolicy: 'USE_EXISTING', // running -> attach, don't start a second one
      workflowIdReusePolicy: 'ALLOW_DUPLICATE', // finished -> may run again
    })
  })

  describe('against a real Temporal server (no worker, so runs stay open)', () => {
    let env: TestWorkflowEnvironment

    beforeAll(async () => {
      Runtime.install({ logger: temporalTestLogger() })
      env = await TestWorkflowEnvironment.createTimeSkipping()
    }, 120_000)

    afterAll(async () => {
      await env?.teardown()
    })

    it('does not start a second run while one is open for the same lead', async () => {
      const starter = new TemporalPhoneWorkflowStarter(env.client.workflow, 'no-worker')

      await starter.start(1001)
      const first = await env.client.workflow.getHandle(phoneWorkflowId(1001)).describe()
      await starter.start(1001)
      const second = await env.client.workflow.getHandle(phoneWorkflowId(1001)).describe()

      expect(second.runId).toBe(first.runId)
    })

    it('starts a new run once the previous one is closed', async () => {
      const starter = new TemporalPhoneWorkflowStarter(env.client.workflow, 'no-worker')

      await starter.start(1002)
      const handle = env.client.workflow.getHandle(phoneWorkflowId(1002))
      const first = await handle.describe()
      await handle.terminate('test: close the run')
      await starter.start(1002)
      const second = await env.client.workflow.getHandle(phoneWorkflowId(1002)).describe()

      expect(second.runId).not.toBe(first.runId)
      expect(second.status.name).toBe('RUNNING')
    })
  })
})
