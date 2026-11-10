// Pure types only. This file is imported by the Temporal workflow, so it must not
// import Node, Prisma or any I/O code.

export const PROVIDER_NAMES = ['ORION', 'ASTRA', 'NIMBUS'] as const
export type ProviderName = (typeof PROVIDER_NAMES)[number]

export type EnrichmentStatus = 'PENDING' | 'RUNNING' | 'FOUND' | 'NO_DATA' | 'FAILED'

/** The lead fields the providers may need. */
export type LeadForEnrichment = {
  id: number
  firstName: string
  lastName: string
  email: string
  jobTitle: string | null
}

/** What happened when we asked one provider. */
export type ProviderAttempt =
  | { provider: ProviderName; kind: 'found'; phone: string }
  | { provider: ProviderName; kind: 'none' }
  | { provider: ProviderName; kind: 'skipped' }
  | { provider: ProviderName; kind: 'error'; message: string }

/** Final result of a whole enrichment run. */
export type FinalOutcome =
  | { status: 'FOUND'; phone: string; source: ProviderName }
  | { status: 'NO_DATA' }
  | { status: 'FAILED'; error: string }
