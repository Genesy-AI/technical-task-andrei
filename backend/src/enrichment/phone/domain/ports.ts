import type { EnrichmentStatus, LeadForEnrichment, ProviderName } from './types'

/** One phone data provider. Each provider gets its own adapter. */
export interface PhoneProviderPort {
  readonly name: ProviderName
  /** False when the lead lacks the input this provider needs. The provider is then skipped. */
  canHandle(lead: LeadForEnrichment): boolean
  /** Phone number, or null when the provider has no data. Throws on transport/API errors. */
  findPhone(lead: LeadForEnrichment, options?: { signal?: AbortSignal }): Promise<string | null>
}

export type EnrichmentResultUpdate = {
  status: Exclude<EnrichmentStatus, 'PENDING' | 'RUNNING'>
  phone?: string
  source?: ProviderName
  error?: string
}

/** Storage for leads, as needed by phone enrichment. */
export interface LeadRepositoryPort {
  getForEnrichment(leadId: number): Promise<LeadForEnrichment | null>
  markProgress(leadId: number, provider: ProviderName): Promise<void>
  saveResult(leadId: number, result: EnrichmentResultUpdate): Promise<void>
}
