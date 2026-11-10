import type { Client } from '@temporalio/client'
import { verifyEmailWorkflow } from '../../../workflows'
import type { EmailVerifier } from '../ports'

/** The part of the Temporal client this adapter uses. */
export type TemporalWorkflowStarter = Pick<Client, 'workflow'>

export function createTemporalEmailVerifier({
  client,
  taskQueue,
}: {
  client: TemporalWorkflowStarter
  taskQueue: string
}): EmailVerifier {
  return {
    verify: (lead) =>
      client.workflow.execute(verifyEmailWorkflow, {
        taskQueue,
        workflowId: `verify-email-${lead.id}-${Date.now()}`,
        args: [lead.email],
      }),
  }
}
