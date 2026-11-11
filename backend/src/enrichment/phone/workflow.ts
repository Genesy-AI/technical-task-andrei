import { ActivityFailure, CancellationScope, isCancellation, proxyActivities } from '@temporalio/workflow'
// Type-only import: activity code never runs inside the workflow sandbox.
import type { PhoneActivities } from './activities'
import { DB_ACTIVITY_OPTIONS, PROVIDER_ACTIVITY_OPTIONS, PROVIDER_ORDER } from './config'
import { decideFinalStatus } from './domain/outcome'
import type { FinalOutcome, ProviderAttempt } from './domain/types'

const db = proxyActivities<PhoneActivities>(DB_ACTIVITY_OPTIONS)

/**
 * Finds a lead's phone by asking providers in order and stopping at the first hit.
 * Started with workflowId `enrich-phone-{leadId}`, so there is only one run per lead at a time.
 *
 * If the run fails or is cancelled, the lead is saved as FAILED so it does not stay RUNNING.
 * (A terminate cannot run any code; the API covers that by asking Temporal before re-runs.)
 */
export async function enrichPhoneWorkflow(leadId: number): Promise<FinalOutcome> {
  try {
    return await findPhone(leadId)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    // Must run even when the workflow is being cancelled.
    await CancellationScope.nonCancellable(() =>
      db.saveResult(leadId, { status: 'FAILED', error: `Run ended early: ${reason}` })
    ).catch(() => undefined) // keep the original error below
    throw error
  }
}

async function findPhone(leadId: number): Promise<FinalOutcome> {
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
      // Cancelled: stop. Otherwise retries are used up (or non-retryable): note it, try the next provider.
      if (!(error instanceof ActivityFailure) || isCancellation(error)) throw error
      attempts.push({ provider, kind: 'error', message: error.cause?.message ?? error.message })
    }
  }

  const outcome = decideFinalStatus(attempts)
  await db.saveResult(leadId, outcome)
  return outcome
}
