import { ApplicationFailure } from '@temporalio/activity'

export type PostJsonOptions = {
  url: string
  body: unknown
  headers?: Record<string, string>
  fetchFn?: typeof fetch
  signal?: AbortSignal
}

// 408 (timeout) and 429 (rate limited) are client codes but worth retrying.
const RETRYABLE_4XX = new Set([408, 429])
const MAX_ERROR_BODY = 200

/**
 * POST JSON to a provider and return the parsed JSON response.
 * Errors are Temporal ApplicationFailures so the activity retry policy can tell them apart:
 * - 4xx (bad input, bad auth): non-retryable, retrying won't help.
 * - 5xx, 408, 429, network errors, non-JSON body: retryable.
 */
export async function postJson({
  url,
  body,
  headers,
  fetchFn = fetch,
  signal,
}: PostJsonOptions): Promise<unknown> {
  let response: Response
  try {
    response = await fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw ApplicationFailure.retryable(message, 'ProviderNetworkError')
  }

  const text = await response.text()

  if (!response.ok) {
    const message = `HTTP ${response.status}: ${text.slice(0, MAX_ERROR_BODY)}`
    const isClientError =
      response.status >= 400 && response.status < 500 && !RETRYABLE_4XX.has(response.status)
    throw isClientError
      ? ApplicationFailure.nonRetryable(message, 'ProviderClientError')
      : ApplicationFailure.retryable(message, 'ProviderServerError')
  }

  try {
    return JSON.parse(text)
  } catch {
    throw ApplicationFailure.retryable(
      `Invalid JSON response: ${text.slice(0, MAX_ERROR_BODY)}`,
      'ProviderBadResponse'
    )
  }
}
