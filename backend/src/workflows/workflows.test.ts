import { afterAll, beforeAll, describe, it, expect } from 'vitest'
import { TestWorkflowEnvironment } from '@temporalio/testing'
import { Worker } from '@temporalio/worker'
import { ActivityFailure, WorkflowFailedError } from '@temporalio/client'
import { RetryState } from '@temporalio/common'
import { randomUUID } from 'crypto'
import path from 'path'
import { verifyEmailWorkflow } from './workflows'
import * as realActivities from './activities'

type Activities = Pick<typeof realActivities, 'verifyEmail'>

describe('verifyEmailWorkflow', () => {
  let env: TestWorkflowEnvironment

  beforeAll(async () => {
    env = await TestWorkflowEnvironment.createTimeSkipping()
  }, 120_000)

  afterAll(async () => {
    await env?.teardown()
  })

  async function runWorkflow(activities: Activities, email: string) {
    const taskQueue = `test-${randomUUID()}`
    const worker = await Worker.create({
      connection: env.nativeConnection,
      taskQueue,
      workflowsPath: path.join(__dirname, 'workflows.ts'),
      activities,
    })
    return worker.runUntil(
      env.client.workflow.execute(verifyEmailWorkflow, {
        taskQueue,
        workflowId: `verify-email-test-${randomUUID()}`,
        args: [email],
      })
    )
  }

  it('returns the activity result', async () => {
    await expect(runWorkflow({ verifyEmail: async () => true }, 'ok@example.com')).resolves.toBe(true)
    await expect(runWorkflow({ verifyEmail: async () => false }, 'no@example.com')).resolves.toBe(false)
  })

  it('gives up after 3 attempts instead of retrying forever', async () => {
    let attempts = 0
    const failing: Activities = {
      verifyEmail: async () => {
        attempts += 1
        throw new Error('provider unavailable')
      },
    }

    const error = await runWorkflow(failing, 'flaky@example.com').catch((e) => e)

    expect(error).toBeInstanceOf(WorkflowFailedError)
    expect(error.cause).toBeInstanceOf(ActivityFailure)
    expect((error.cause as ActivityFailure).retryState).toBe(RetryState.MAXIMUM_ATTEMPTS_REACHED)
    expect(attempts).toBe(3)
  }, 60_000)

  it('recovers when a later attempt succeeds', async () => {
    let attempts = 0
    const flaky: Activities = {
      verifyEmail: async () => {
        attempts += 1
        if (attempts < 3) throw new Error('transient')
        return true
      },
    }

    await expect(runWorkflow(flaky, 'flaky@example.com')).resolves.toBe(true)
    expect(attempts).toBe(3)
  }, 60_000)

  it('fails (does not hang) for a lead whose verification is too slow', async () => {
    const error = await runWorkflow(realActivities, 'jane.smith@example.com').catch((e) => e)

    expect(error).toBeInstanceOf(WorkflowFailedError)
    expect(error.cause).toBeInstanceOf(ActivityFailure)
    expect((error.cause as ActivityFailure).retryState).toBe(RetryState.MAXIMUM_ATTEMPTS_REACHED)
  }, 60_000)
})
