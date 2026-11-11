import { readFileSync } from 'fs'
import path from 'path'
import { vi } from 'vitest'

type FixtureCase = { status: number; body: unknown }

/** A real provider response recorded in step 0, as a fetch Response. */
export function fixtureResponse(provider: 'orion' | 'astra' | 'nimbus', caseName: string): Response {
  const file = path.join(__dirname, '__fixtures__', `${provider}.json`)
  const fixture = JSON.parse(readFileSync(file, 'utf8'))[caseName] as FixtureCase | undefined
  if (!fixture) throw new Error(`No fixture ${provider}.${caseName}`)
  return makeResponse(fixture.status, fixture.body)
}

export function makeResponse(status: number, body: unknown): Response {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  return new Response(text, { status })
}

/** fetch stub that always answers with the given response. */
export function fetchReturning(response: Response) {
  return vi.fn<typeof fetch>().mockResolvedValue(response)
}

/** The url, headers and parsed JSON body of the n-th fetch call. */
export function fetchCall(fetchMock: ReturnType<typeof fetchReturning>, n = 0) {
  const [url, init] = fetchMock.mock.calls[n]
  return {
    url: String(url),
    method: init?.method,
    headers: new Headers(init?.headers),
    body: init?.body ? JSON.parse(String(init.body)) : undefined,
  }
}
