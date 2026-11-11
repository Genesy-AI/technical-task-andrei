import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { WorkflowClient } from '@temporalio/client'
import { TestWorkflowEnvironment } from '@temporalio/testing'
import { installTemporalTestRuntime } from '../../../test/temporalTestLogger'
import {
  PHONE_WORKFLOW_TIMEOUT,
  TemporalPhoneWorkflowStarter,
  phoneWorkflowId,
} from './temporalWorkflowStarter'
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
      { start } as unknown as Pick<WorkflowClient, 'start' | 'getHandle'>,
      'myQueue'
    )

    await starter.start(42)

    expect(start).toHaveBeenCalledWith(enrichPhoneWorkflow, {
      workflowId: 'enrich-phone-42',
      taskQueue: 'myQueue',
      args: [42],
      workflowIdConflictPolicy: 'USE_EXISTING', // running -> attach, don't start a second one
      workflowIdReusePolicy: 'ALLOW_DUPLICATE', // finished -> may run again
      workflowExecutionTimeout: PHONE_WORKFLOW_TIMEOUT, // never open forever
    })
  })

  describe('against a real Temporal server (no worker, so runs stay open)', () => {
    let env: TestWorkflowEnvironment

    beforeAll(async () => {
      installTemporalTestRuntime()
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

    it('closes a run that no worker picks up once the execution timeout passes', async () => {
      const starter = new TemporalPhoneWorkflowStarter(env.client.workflow, 'no-worker', '2 seconds')
      await starter.start(3001)

      await env.sleep('3 seconds')

      await expect(starter.isRunning(3001)).resolves.toBe(false)
      const { status } = await env.client.workflow.getHandle(phoneWorkflowId(3001)).describe()
      expect(status.name).toBe('TIMED_OUT')
    })

    describe('isRunning', () => {
      it('is true while the run is open', async () => {
        const starter = new TemporalPhoneWorkflowStarter(env.client.workflow, 'no-worker')
        await starter.start(2001)

        await expect(starter.isRunning(2001)).resolves.toBe(true)
      })

      it('is false after the run was terminated (e.g. stopped by hand)', async () => {
        const starter = new TemporalPhoneWorkflowStarter(env.client.workflow, 'no-worker')
        await starter.start(2002)
        await env.client.workflow.getHandle(phoneWorkflowId(2002)).terminate('test')

        await expect(starter.isRunning(2002)).resolves.toBe(false)
      })

      it('is false when there was never a run for the lead', async () => {
        const starter = new TemporalPhoneWorkflowStarter(env.client.workflow, 'no-worker')

        await expect(starter.isRunning(2003)).resolves.toBe(false)
      })
    })
  })
})
