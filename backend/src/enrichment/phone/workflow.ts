import { ActivityFailure, proxyActivities } from '@temporalio/workflow'
// Type-only import: activity code never runs inside the workflow sandbox.
import type { PhoneActivities } from './activities'
import { DB_ACTIVITY_OPTIONS, PROVIDER_ACTIVITY_OPTIONS, PROVIDER_ORDER } from './config'
import { decideFinalStatus } from './domain/outcome'
import type { FinalOutcome, ProviderAttempt } from './domain/types'

const db = proxyActivities<PhoneActivities>(DB_ACTIVITY_OPTIONS)

/**
 * Finds a lead's phone by asking providers in order and stopping at the first hit.
 * Started with workflowId `enrich-phone-{leadId}`, so there is only one run per lead at a time.
 */
export async function enrichPhoneWorkflow(leadId: number): Promise<FinalOutcome> {
  const lead = await db.loadLead(leadId)
  if (!lead) return { status: 'FAILED', error: `Lead ${leadId} not found` }

  const attempts: ProviderAttempt[] = []

  for (const provider of PROVIDER_ORDER) {
    // One proxy per provider so each gets its own timeout and retry policy.
    const { findPhoneWith } = proxyActivities<PhoneActivities>(PROVIDER_ACTIVITY_OPTIONS[provider])

    await db.markProgress(leadId, provider)
    try {
      const result = await findPhoneWith(provider, lead)
      attempts.push({ provider, ...result })
      if (result.kind === 'found') break
    } catch (error) {
      // Retries are used up (or the error was non-retryable): note it and try the next provider.
      if (!(error instanceof ActivityFailure)) throw error
      attempts.push({ provider, kind: 'error', message: error.cause?.message ?? error.message })
    }
  }

  const outcome = decideFinalStatus(attempts)
  await db.saveResult(leadId, outcome)
  return outcome
}
