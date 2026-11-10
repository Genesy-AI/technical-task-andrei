import type { EnrichPhoneSkipReason, LeadsEnrichPhoneOutput } from '../api/types/leads/enrichPhone'
import type { LeadsGetManyOutput } from '../api/types/leads/getMany'

export const POLL_INTERVAL_MS = 2000

/** Same cap as the backend (MAX_LEADS_PER_REQUEST). */
export const MAX_LEADS_PER_ENRICH = 100

/** Poll the leads list while any lead is waiting for or running phone enrichment. */
export function leadsPollInterval(leads: LeadsGetManyOutput | undefined): number | false {
  const busy = leads?.some(
    (l) => l.phoneEnrichmentStatus === 'PENDING' || l.phoneEnrichmentStatus === 'RUNNING'
  )
  return busy ? POLL_INTERVAL_MS : false
}

export type Feedback = { kind: 'success' | 'info' | 'error'; message: string }

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

const SKIP_REASONS: Array<[EnrichPhoneSkipReason, (n: number) => string]> = [
  ['already_has_phone', (n) => plural(n, 'already has a phone', 'already have a phone')],
  ['already_running', () => 'already in progress'],
  ['not_found', () => 'not found'],
]

function skippedText(skipped: LeadsEnrichPhoneOutput['skipped']): string {
  const parts = SKIP_REASONS.map(([reason, text]) => {
    const n = skipped.filter((s) => s.reason === reason).length
    return n > 0 ? `${n} ${text(n)}` : null
  }).filter(Boolean)
  return `Skipped ${skipped.length}: ${parts.join(', ')}`
}

/** Toast text for the enrich-phone response. */
export function enrichPhoneFeedback({ started, skipped, errors }: LeadsEnrichPhoneOutput): Feedback {
  const details = [
    skipped.length > 0 ? skippedText(skipped) : null,
    errors.length > 0 && started.length > 0 ? `Could not start ${errors.length}` : null,
  ].filter(Boolean)
  const withDetails = (head: string) => [head, ...details].join('. ')

  if (started.length > 0) {
    const n = started.length
    return {
      kind: 'success',
      message: withDetails(`Finding ${plural(n, 'phone', 'phones')} for ${n} ${plural(n, 'lead', 'leads')}`),
    }
  }
  if (errors.length > 0) {
    const n = errors.length
    return {
      kind: 'error',
      message: withDetails(`Could not start phone enrichment for ${n} ${plural(n, 'lead', 'leads')}`),
    }
  }
  return { kind: 'info', message: withDetails('Nothing to enrich') }
}
