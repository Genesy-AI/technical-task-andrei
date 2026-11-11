import type { Client } from '@temporalio/client'
import type { Duration } from '@temporalio/common'
import { verifyEmailWorkflow } from '../../../workflows'
import type { EmailVerifier } from '../ports'

/** The part of the Temporal client this adapter uses. */
export type TemporalWorkflowStarter = Pick<Client, 'workflow'>

/**
 * Hard limit for one verify-email run. A healthy run takes at most ~33s (3 attempts of 10s
 * plus backoff), so 45s only stops runs that will never finish, for example when no worker
 * is polling the task queue. Without it, `execute` waits forever.
 */
export const VERIFY_EMAIL_WORKFLOW_TIMEOUT: Duration = '45 seconds'

/** One id per lead, so a second request for the same lead joins the run already in progress. */
export const verifyEmailWorkflowId = (leadId: number) => `verify-email-${leadId}`

export function createTemporalEmailVerifier({
  client,
  taskQueue,
  executionTimeout = VERIFY_EMAIL_WORKFLOW_TIMEOUT,
}: {
  client: TemporalWorkflowStarter
  taskQueue: string
  /** Override for tests only. */
  executionTimeout?: Duration
}): EmailVerifier {
  return {
    verify: (lead) =>
      client.workflow.execute(verifyEmailWorkflow, {
        taskQueue,
        workflowId: verifyEmailWorkflowId(lead.id),
        workflowIdConflictPolicy: 'USE_EXISTING',
        workflowExecutionTimeout: executionTimeout,
        args: [lead.email],
      }),
  }
}
