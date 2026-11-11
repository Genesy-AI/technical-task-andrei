import { describe, it, expect, vi } from 'vitest'
import { verifyEmailWorkflow } from '../../../workflows'
import {
  createTemporalEmailVerifier,
  VERIFY_EMAIL_WORKFLOW_TIMEOUT,
  type TemporalWorkflowStarter,
} from './temporalEmailVerifier'
import { createPrismaLeadVerificationRepository, type LeadUpdater } from './prismaLeadVerificationRepository'

const jane = { id: 7, firstName: 'Jane', lastName: 'Smith', email: 'jane.smith@example.com' }

describe('createTemporalEmailVerifier', () => {
  const clientWith = (execute: ReturnType<typeof vi.fn>) =>
    ({ workflow: { execute } }) as unknown as TemporalWorkflowStarter

  it('runs the verify-email workflow for the lead on the given task queue', async () => {
    const execute = vi.fn().mockResolvedValue(true)
    const verifier = createTemporalEmailVerifier({ client: clientWith(execute), taskQueue: 'test-queue' })

    await expect(verifier.verify(jane)).resolves.toBe(true)

    expect(execute).toHaveBeenCalledWith(verifyEmailWorkflow, {
      taskQueue: 'test-queue',
      workflowId: 'verify-email-7',
      workflowIdConflictPolicy: 'USE_EXISTING',
      workflowExecutionTimeout: VERIFY_EMAIL_WORKFLOW_TIMEOUT,
      args: ['jane.smith@example.com'],
    })
  })

  it('passes workflow failures on to the caller', async () => {
    const failure = new Error('Workflow execution failed')
    const verifier = createTemporalEmailVerifier({
      client: clientWith(vi.fn().mockRejectedValue(failure)),
      taskQueue: 'test-queue',
    })

    await expect(verifier.verify(jane)).rejects.toBe(failure)
  })
})

describe('createPrismaLeadVerificationRepository', () => {
  it('stores the verification outcome on the lead', async () => {
    const update = vi.fn().mockResolvedValue({})
    const repository = createPrismaLeadVerificationRepository({ lead: { update } } as unknown as LeadUpdater)

    await repository.saveEmailVerified(7, false)

    expect(update).toHaveBeenCalledWith({ where: { id: 7 }, data: { emailVerified: false } })
  })

  it('passes database failures on to the caller', async () => {
    const failure = new Error('database is locked')
    const repository = createPrismaLeadVerificationRepository({
      lead: { update: vi.fn().mockRejectedValue(failure) },
    } as unknown as LeadUpdater)

    await expect(repository.saveEmailVerified(7, true)).rejects.toBe(failure)
  })
})
