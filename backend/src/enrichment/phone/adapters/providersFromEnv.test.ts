import { describe, it, expect } from 'vitest'
import { createPhoneProvidersFromEnv } from './providersFromEnv'
import { fetchCall, fetchReturning, makeResponse } from './testUtils'
import type { LeadForEnrichment } from '../domain/types'

const fullEnv = {
  ORION_BASE_URL: 'https://orion.test',
  ORION_API_KEY: 'orion-key',
  ASTRA_BASE_URL: 'https://astra.test',
  ASTRA_API_KEY: 'astra-key',
  NIMBUS_BASE_URL: 'https://nimbus.test',
  NIMBUS_API_KEY: 'nimbus-key',
}
const lead: LeadForEnrichment = {
  id: 1,
  firstName: 'Ada',
  lastName: 'L',
  email: 'ada@acme.com',
  jobTitle: 'CTO',
}

describe('createPhoneProvidersFromEnv', () => {
  it('builds one adapter per provider', () => {
    const providers = createPhoneProvidersFromEnv(fullEnv)

    expect(providers.map((p) => p.name).sort()).toEqual(['ASTRA', 'NIMBUS', 'ORION'])
  })

  it.each([
    ['ORION', 'https://orion.test/', 'x-auth-me', 'orion-key'],
    ['ASTRA', 'https://astra.test/', 'apiKey', 'astra-key'],
  ] as const)('wires %s to its base URL and key', async (name, url, header, key) => {
    const fetchFn = fetchReturning(makeResponse(200, {}))
    const provider = createPhoneProvidersFromEnv(fullEnv, fetchFn).find((p) => p.name === name)!

    await provider.findPhone(lead)

    const call = fetchCall(fetchFn)
    expect(new URL(call.url).toString()).toBe(url)
    expect(call.headers.get(header)).toBe(key)
  })

  it('wires NIMBUS to its base URL and key', async () => {
    const fetchFn = fetchReturning(makeResponse(200, {}))
    const provider = createPhoneProvidersFromEnv(fullEnv, fetchFn).find((p) => p.name === 'NIMBUS')!

    await provider.findPhone(lead)

    const url = new URL(fetchCall(fetchFn).url)
    expect(url.origin).toBe('https://nimbus.test')
    expect(url.searchParams.get('api')).toBe('nimbus-key')
  })

  it('throws listing every missing or blank variable', () => {
    const env = { ...fullEnv, ORION_API_KEY: undefined, NIMBUS_BASE_URL: '  ' }

    expect(() => createPhoneProvidersFromEnv(env)).toThrow(
      'Missing phone provider env vars: ORION_API_KEY, NIMBUS_BASE_URL'
    )
  })
})
