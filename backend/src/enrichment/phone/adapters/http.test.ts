import { describe, it, expect, vi } from 'vitest'
import { ApplicationFailure } from '@temporalio/activity'
import { postJson } from './http'
import { fetchCall, fetchReturning, makeResponse } from './testUtils'

async function failureOf(promise: Promise<unknown>): Promise<ApplicationFailure> {
  const error = await promise.then(
    () => {
      throw new Error('expected postJson to throw')
    },
    (e) => e
  )
  expect(error).toBeInstanceOf(ApplicationFailure)
  return error as ApplicationFailure
}

describe('postJson', () => {
  it('POSTs a JSON body with content-type and extra headers', async () => {
    const fetchFn = fetchReturning(makeResponse(200, {}))

    await postJson({ url: 'https://x.test/a', body: { a: 1 }, headers: { apiKey: 'k' }, fetchFn })

    const call = fetchCall(fetchFn)
    expect(call.url).toBe('https://x.test/a')
    expect(call.method).toBe('POST')
    expect(call.headers.get('content-type')).toBe('application/json')
    expect(call.headers.get('apiKey')).toBe('k')
    expect(call.body).toEqual({ a: 1 })
  })

  it('passes the abort signal to fetch', async () => {
    const fetchFn = fetchReturning(makeResponse(200, {}))
    const signal = new AbortController().signal

    await postJson({ url: 'https://x.test', body: {}, fetchFn, signal })

    expect(fetchFn.mock.calls[0][1]?.signal).toBe(signal)
  })

  it('returns the parsed JSON body on 2xx', async () => {
    const fetchFn = fetchReturning(makeResponse(200, { phone: '123' }))

    await expect(postJson({ url: 'https://x.test', body: {}, fetchFn })).resolves.toEqual({ phone: '123' })
  })

  it.each([400, 401, 403, 404, 422])('throws a non-retryable failure on HTTP %i', async (status) => {
    const fetchFn = fetchReturning(makeResponse(status, 'Unauthorized'))

    const failure = await failureOf(postJson({ url: 'https://x.test', body: {}, fetchFn }))

    expect(failure.nonRetryable).toBe(true)
    expect(failure.type).toBe('ProviderClientError')
    expect(failure.message).toBe(`HTTP ${status}: Unauthorized`)
  })

  it.each([408, 429, 500, 502, 503])('throws a retryable failure on HTTP %i', async (status) => {
    const fetchFn = fetchReturning(makeResponse(status, { message: 'Internal server error' }))

    const failure = await failureOf(postJson({ url: 'https://x.test', body: {}, fetchFn }))

    expect(failure.nonRetryable).toBe(false)
    expect(failure.type).toBe('ProviderServerError')
    expect(failure.message).toBe(`HTTP ${status}: {"message":"Internal server error"}`)
  })

  it('cuts long error bodies', async () => {
    const fetchFn = fetchReturning(makeResponse(500, 'x'.repeat(500)))

    const failure = await failureOf(postJson({ url: 'https://x.test', body: {}, fetchFn }))

    expect(failure.message.length).toBeLessThanOrEqual(220)
  })

  it('throws a retryable failure when the network call fails', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'))

    const failure = await failureOf(postJson({ url: 'https://x.test', body: {}, fetchFn }))

    expect(failure.nonRetryable).toBe(false)
    expect(failure.type).toBe('ProviderNetworkError')
    expect(failure.message).toBe('fetch failed')
  })

  it('throws a retryable failure when a 2xx body is not JSON', async () => {
    const fetchFn = fetchReturning(makeResponse(200, '<html>oops</html>'))

    const failure = await failureOf(postJson({ url: 'https://x.test', body: {}, fetchFn }))

    expect(failure.nonRetryable).toBe(false)
    expect(failure.type).toBe('ProviderBadResponse')
  })
})
