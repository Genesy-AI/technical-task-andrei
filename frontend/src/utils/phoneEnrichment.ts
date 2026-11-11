import { AxiosError } from 'axios'
import type { EnrichPhoneSkipReason, LeadsEnrichPhoneOutput } from '../api/types/leads/enrichPhone'
import type { LeadsGetManyOutput } from '../api/types/leads/getMany'

type LeadEnrichmentState = Pick<
  LeadsGetManyOutput[number],
  'phoneEnrichmentStatus' | 'phoneEnrichmentRequestedAt'
>

export const POLL_INTERVAL_MS = 2000

/** Same cap as the backend (MAX_LEADS_PER_REQUEST). */
export const MAX_LEADS_PER_ENRICH = 100

/**
 * The backend stops a run after 5 minutes (PHONE_WORKFLOW_TIMEOUT). A lead still PENDING or
 * RUNNING after that will not change by itself, so we show it as timed out and stop polling.
 */
export const PHONE_LOOKUP_STALE_AFTER_MS = 6 * 60_000

const isInProgress = (lead: LeadEnrichmentState) =>
  lead.phoneEnrichmentStatus === 'PENDING' || lead.phoneEnrichmentStatus === 'RUNNING'

/** In progress on paper, but its run is over: the user should start it again. */
export function isLookupStuck(lead: LeadEnrichmentState, now: number = Date.now()): boolean {
  if (!isInProgress(lead)) return false
  // No request time: an old row from before the timestamp existed, so it is long over.
  if (!lead.phoneEnrichmentRequestedAt) return true
  return now - Date.parse(lead.phoneEnrichmentRequestedAt) > PHONE_LOOKUP_STALE_AFTER_MS
}

/** Poll the leads list while any lead is really waiting for or running phone enrichment. */
export function leadsPollInterval(
  leads: LeadsGetManyOutput | undefined,
  now: number = Date.now()
): number | false {
  const busy = leads?.some((l) => isInProgress(l) && !isLookupStuck(l, now))
  return busy ? POLL_INTERVAL_MS : false
}

/** Toast text when the request fails. 400 and 429 carry a message written for the user. */
export function enrichPhoneErrorMessage(error: unknown): string {
  if (error instanceof AxiosError && (error.response?.status === 400 || error.response?.status === 429)) {
    const message = error.response.data?.error
    if (typeof message === 'string' && message) return message
  }
  return 'Failed to start phone enrichment. Please try again.'
}

export type Feedback = { kind: 'success' | 'info' | 'error'; message: string }

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

const SKIP_REASONS: Array<[EnrichPhoneSkipReason, (n: number) => string]> = [
  ['already_has_phone', (n) => plural(n, 'already has a phone', 'already have a phone')],
  ['already_running', () => 'already in progress'],
  ['cooldown', () => 'tried recently'],
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
