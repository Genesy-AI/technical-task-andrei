import type { FinalOutcome, ProviderAttempt } from './types'

/**
 * Turns the list of provider attempts into the final result:
 * - FOUND: a provider returned a phone.
 * - FAILED: every provider we actually called errored (none gave an answer).
 * - NO_DATA: anything else (answered without a phone, skipped, or nothing to try).
 */
export function decideFinalStatus(attempts: ProviderAttempt[]): FinalOutcome {
  const found = attempts.find((a) => a.kind === 'found')
  if (found) return { status: 'FOUND', phone: found.phone, source: found.provider }

  const called = attempts.filter((a) => a.kind !== 'skipped')
  const errors = called.filter((a) => a.kind === 'error')
  if (called.length > 0 && errors.length === called.length) {
    return { status: 'FAILED', error: errors.map((e) => `${e.provider}: ${e.message}`).join('; ') }
  }

  return { status: 'NO_DATA' }
}
