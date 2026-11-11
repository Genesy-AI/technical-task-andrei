import { describe, it, expect } from 'vitest'
import { OrionAdapter } from './orionAdapter'
import { fetchCall, fetchReturning, fixtureResponse, makeResponse } from './testUtils'
import type { LeadForEnrichment } from '../domain/types'

const lead: LeadForEnrichment = {
  id: 1,
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@acme.com',
  jobTitle: 'CTO',
  countryCode: null,
}
const baseUrl = 'https://api.test/orionConnect'

function adapterWith(response: Response) {
  const fetchFn = fetchReturning(response)
  return { adapter: new OrionAdapter({ baseUrl, apiKey: 'secret', fetchFn }), fetchFn }
}

describe('OrionAdapter', () => {
  it('is named ORION', () => {
    expect(adapterWith(makeResponse(200, {})).adapter.name).toBe('ORION')
  })

  describe('canHandle', () => {
    const { adapter } = adapterWith(makeResponse(200, {}))

    it('is true for a company email', () => {
      expect(adapter.canHandle(lead)).toBe(true)
    })

    it('is false for a free mail email (no company website)', () => {
      expect(adapter.canHandle({ ...lead, email: 'ada@gmail.com' })).toBe(false)
    })
  })

  describe('findPhone', () => {
    it('POSTs full name and company website with the x-auth-me header', async () => {
      const { adapter, fetchFn } = adapterWith(fixtureResponse('orion', 'found'))

      await adapter.findPhone(lead)

      const call = fetchCall(fetchFn)
      expect(call.url).toBe(baseUrl)
      expect(call.method).toBe('POST')
      expect(call.headers.get('x-auth-me')).toBe('secret')
      expect(call.body).toEqual({ fullName: 'Ada Lovelace', companyWebsite: 'acme.com' })
    })

    it('passes the abort signal through', async () => {
      const { adapter, fetchFn } = adapterWith(fixtureResponse('orion', 'found'))
      const signal = new AbortController().signal

      await adapter.findPhone(lead, { signal })

      expect(fetchFn.mock.calls[0][1]?.signal).toBe(signal)
    })

    it('returns the phone when found', async () => {
      const { adapter } = adapterWith(fixtureResponse('orion', 'found'))

      await expect(adapter.findPhone(lead)).resolves.toEqual({ number: '8221471051' })
    })

    it('returns null when phone is null', async () => {
      const { adapter } = adapterWith(fixtureResponse('orion', 'notFound'))

      await expect(adapter.findPhone(lead)).resolves.toBeNull()
    })

    it('returns null when phone is an empty string', async () => {
      const { adapter } = adapterWith(makeResponse(200, { phone: '  ' }))

      await expect(adapter.findPhone(lead)).resolves.toBeNull()
    })

    it('throws a non-retryable failure when the response has an unexpected shape', async () => {
      const { adapter } = adapterWith(makeResponse(200, { phone: 12345 }))

      await expect(adapter.findPhone(lead)).rejects.toMatchObject({
        type: 'ProviderBadResponse',
        nonRetryable: true,
      })
    })

    it('throws a retryable failure on server error', async () => {
      const { adapter } = adapterWith(fixtureResponse('orion', 'serverError'))

      await expect(adapter.findPhone(lead)).rejects.toMatchObject({ nonRetryable: false })
    })

    it('throws a non-retryable failure on bad auth', async () => {
      const { adapter } = adapterWith(fixtureResponse('orion', 'unauthorized'))

      await expect(adapter.findPhone(lead)).rejects.toMatchObject({
        type: 'ProviderClientError',
        nonRetryable: true,
      })
    })
  })
})
