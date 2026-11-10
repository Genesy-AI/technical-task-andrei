import type { WorkflowClient } from '@temporalio/client'
import type { PhoneWorkflowStarterPort } from '../domain/ports'
import { enrichPhoneWorkflow } from '../workflow'

/** One fixed workflow id per lead: this is what makes enrichment idempotent. */
export const phoneWorkflowId = (leadId: number): string => `enrich-phone-${leadId}`

export class TemporalPhoneWorkflowStarter implements PhoneWorkflowStarterPort {
  constructor(
    private readonly workflows: Pick<WorkflowClient, 'start'>,
    private readonly taskQueue: string
  ) {}

  async start(leadId: number): Promise<void> {
    await this.workflows.start(enrichPhoneWorkflow, {
      workflowId: phoneWorkflowId(leadId),
      taskQueue: this.taskQueue,
      args: [leadId],
      // Already running for this lead -> return the existing run instead of starting another.
      workflowIdConflictPolicy: 'USE_EXISTING',
      // Previous run finished (NO_DATA / FAILED) -> allow enriching again.
      workflowIdReusePolicy: 'ALLOW_DUPLICATE',
    })
  }
}
