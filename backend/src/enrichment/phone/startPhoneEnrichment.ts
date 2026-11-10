import type { EnrichmentStartRepositoryPort, PhoneWorkflowStarterPort } from './domain/ports'

export type SkipReason = 'not_found' | 'already_has_phone' | 'already_running'

export type StartPhoneEnrichmentResult = {
  started: number[]
  skipped: { leadId: number; reason: SkipReason }[]
  errors: { leadId: number; error: string }[]
}

/**
 * Starts phone enrichment for the given leads without waiting for results.
 * Skips leads that are missing, already have a phone, or are already being enriched
 * (the fixed workflow id dedupes in Temporal too; this check also keeps their status intact).
 */
export async function startPhoneEnrichment(
  leadIds: number[],
  deps: { leads: EnrichmentStartRepositoryPort; workflows: PhoneWorkflowStarterPort }
): Promise<StartPhoneEnrichmentResult> {
  const ids = [...new Set(leadIds)]
  const infoById = new Map((await deps.leads.getStartInfo(ids)).map((info) => [info.id, info]))
  const result: StartPhoneEnrichmentResult = { started: [], skipped: [], errors: [] }

  for (const leadId of ids) {
    const info = infoById.get(leadId)
    if (!info) {
      result.skipped.push({ leadId, reason: 'not_found' })
    } else if (info.phoneNumber?.trim()) {
      result.skipped.push({ leadId, reason: 'already_has_phone' })
    } else if (info.status === 'PENDING' || info.status === 'RUNNING') {
      result.skipped.push({ leadId, reason: 'already_running' })
    } else {
      await deps.leads.markPending(leadId)
      try {
        await deps.workflows.start(leadId)
        result.started.push(leadId)
      } catch (error) {
        // Don't leave the lead stuck in PENDING (the UI would poll forever).
        const message = error instanceof Error ? error.message : String(error)
        await deps.leads.saveResult(leadId, {
          status: 'FAILED',
          error: `Could not start enrichment: ${message}`,
        })
        result.errors.push({ leadId, error: message })
      }
    }
  }

  return result
}
