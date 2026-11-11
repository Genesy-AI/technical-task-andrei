import { ApplicationFailure } from '@temporalio/activity'

/** What every provider adapter needs to be built. */
export type ProviderConfig = { baseUrl: string; apiKey: string; fetchFn?: typeof fetch }

export type FindPhoneOptions = { signal?: AbortSignal }

/**
 * Reads a phone field from a provider response.
 * null / undefined / blank -> null (no data). Any other non-string -> non-retryable failure
 * (the provider changed its contract; retrying won't fix it).
 */
export function readPhoneString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') {
    throw ApplicationFailure.nonRetryable(
      `Unexpected phone value: ${JSON.stringify(value)}`,
      'ProviderBadResponse'
    )
  }
  return value.trim() || null
}
