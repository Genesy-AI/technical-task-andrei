import { ApplicationFailure, Context, log } from '@temporalio/activity'
import { USER_MESSAGES } from './domain/messages'
import type { LeadRepositoryPort, PhoneProviderPort } from './domain/ports'
import type { FinalOutcome, LeadForEnrichment, ProviderLookupResult, ProviderName } from './domain/types'
import { normalizePhone } from './normalizePhone'

export type PhoneActivityDeps = { providers: PhoneProviderPort[]; leadRepo: LeadRepositoryPort }

/**
 * Builds the phone enrichment activities with their dependencies (ports) injected.
 * The worker passes real adapters; tests pass fakes.
 */
export function createPhoneActivities({ providers, leadRepo }: PhoneActivityDeps) {
  const providersByName = new Map(providers.map((p) => [p.name, p]))

  return {
    async loadLead(leadId: number): Promise<LeadForEnrichment | null> {
      return leadRepo.getForEnrichment(leadId)
    },

    async markProgress(leadId: number, provider: ProviderName): Promise<void> {
      await leadRepo.markProgress(leadId, provider)
    },

    /**
     * Asks one provider. Provider errors are rethrown as-is so the retry policy applies.
     * A value that is not a usable phone counts as no data, so the next provider is asked.
     */
    async findPhoneWith(provider: ProviderName, lead: LeadForEnrichment): Promise<ProviderLookupResult> {
      const adapter = providersByName.get(provider)
      if (!adapter) {
        throw ApplicationFailure.nonRetryable(
          `No adapter registered for provider ${provider}`,
          'UnknownProvider'
        )
      }
      if (!adapter.canHandle(lead)) return { kind: 'skipped' }

      // Aborted by Temporal on timeout or cancellation, so the HTTP call stops too.
      const signal = Context.current().cancellationSignal
      const raw = await adapter.findPhone(lead, { signal })
      if (!raw) return { kind: 'none' }

      const phone = normalizePhone(raw, lead.countryCode)
      if (!phone) {
        // Log the shape only: the raw value may be junk or personal data.
        log.warn('Provider returned an unusable phone', {
          leadId: lead.id,
          provider,
          length: raw.number.length,
        })
        return { kind: 'none' }
      }
      return { kind: 'found', phone }
    },

    async saveResult(leadId: number, outcome: FinalOutcome): Promise<void> {
      if (outcome.status !== 'FAILED') return leadRepo.saveResult(leadId, outcome)

      // Error details (provider errors, crash/cancel reason) stay internal; the lead gets a safe text.
      log.warn('Phone enrichment failed', { leadId, error: outcome.error })
      await leadRepo.saveResult(leadId, { status: 'FAILED', error: USER_MESSAGES.lookupFailed })
    },
  }
}

export type PhoneActivities = ReturnType<typeof createPhoneActivities>
