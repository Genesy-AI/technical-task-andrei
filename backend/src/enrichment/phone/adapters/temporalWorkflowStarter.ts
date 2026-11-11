import { WorkflowNotFoundError, type WorkflowClient, type WorkflowStartOptions } from '@temporalio/client'

type Duration = NonNullable<WorkflowStartOptions['workflowExecutionTimeout']>
import type { PhoneWorkflowStarterPort } from '../domain/ports'
import { enrichPhoneWorkflow } from '../workflow'

/** One fixed workflow id per lead: this is what makes enrichment idempotent. */
export const phoneWorkflowId = (leadId: number): string => `enrich-phone-${leadId}`

/**
 * Hard limit for one run. A healthy run takes at most ~70s (all 3 providers using all
 * retries), so this only stops runs that will never finish, for example when no worker
 * polls the queue. The lead then stays PENDING/RUNNING in the DB: the UI shows it as timed
 * out after PHONE_LOOKUP_STALE_AFTER_MS, and the next request starts it again.
 */
export const PHONE_WORKFLOW_TIMEOUT: Duration = '5 minutes'

export class TemporalPhoneWorkflowStarter implements PhoneWorkflowStarterPort {
  constructor(
    private readonly workflows: Pick<WorkflowClient, 'start' | 'getHandle'>,
    private readonly taskQueue: string,
    /** Override for tests only. */
    private readonly executionTimeout: Duration = PHONE_WORKFLOW_TIMEOUT
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
      workflowExecutionTimeout: this.executionTimeout,
    })
  }

  async isRunning(leadId: number): Promise<boolean> {
    try {
      const { status } = await this.workflows.getHandle(phoneWorkflowId(leadId)).describe()
      return status.name === 'RUNNING'
    } catch (error) {
      if (error instanceof WorkflowNotFoundError) return false
      throw error
    }
  }
}
