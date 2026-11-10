import { describe, it, expect } from 'vitest'
import { NimbusAdapter } from './nimbusAdapter'
import { fetchCall, fetchReturning, fixtureResponse, makeResponse } from './testUtils'
import type { LeadForEnrichment } from '../domain/types'

const lead: LeadForEnrichment = {
  id: 1,
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  jobTitle: 'CTO',
}
const baseUrl = 'https://api.test/numbusLookup'

function adapterWith(response: Response) {
  const fetchFn = fetchReturning(response)
  return { adapter: new NimbusAdapter({ baseUrl, apiKey: 'se cret&1', fetchFn }), fetchFn }
}

describe('NimbusAdapter', () => {
  it('is named NIMBUS', () => {
    expect(adapterWith(makeResponse(200, {})).adapter.name).toBe('NIMBUS')
  })

  describe('canHandle', () => {
    const { adapter } = adapterWith(makeResponse(200, {}))

    it('is true when the lead has email and job title', () => {
      expect(adapter.canHandle(lead)).toBe(true)
    })

    it.each([null, '', '  '])('is false when job title is %j (the API requires it)', (jobTitle) => {
      expect(adapter.canHandle({ ...lead, jobTitle })).toBe(false)
    })

    it('is false when email is blank', () => {
      expect(adapter.canHandle({ ...lead, email: '' })).toBe(false)
    })
  })

  describe('findPhone', () => {
    it('POSTs email and job title with the api key as a query parameter', async () => {
      const { adapter, fetchFn } = adapterWith(fixtureResponse('nimbus', 'found'))

      await adapter.findPhone(lead)

      const call = fetchCall(fetchFn)
      const url = new URL(call.url)
      expect(`${url.origin}${url.pathname}`).toBe(baseUrl)
      expect(url.searchParams.get('api')).toBe('se cret&1')
      expect(call.method).toBe('POST')
      expect(call.body).toEqual({ email: 'john.doe@example.com', jobTitle: 'CTO' })
    })

    it('passes the abort signal through', async () => {
      const { adapter, fetchFn } = adapterWith(fixtureResponse('nimbus', 'found'))
      const signal = new AbortController().signal

      await adapter.findPhone(lead, { signal })

      expect(fetchFn.mock.calls[0][1]?.signal).toBe(signal)
    })

    it('returns "<countryCode> <number>" from the real API shape (phoneNmbr)', async () => {
      const { adapter } = adapterWith(fixtureResponse('nimbus', 'found'))

      await expect(adapter.findPhone(lead)).resolves.toBe('ES 4088282927')
    })

    it('also reads the documented "number" field', async () => {
      const { adapter } = adapterWith(makeResponse(200, { number: 612345678, countryCode: 'es' }))

      await expect(adapter.findPhone(lead)).resolves.toBe('ES 612345678')
    })

    it('accepts the number as a digit string', async () => {
      const { adapter } = adapterWith(makeResponse(200, { phoneNmbr: '612345678', countryCode: 'ES' }))

      await expect(adapter.findPhone(lead)).resolves.toBe('ES 612345678')
    })

    it('returns just the digits when countryCode is missing', async () => {
      const { adapter } = adapterWith(makeResponse(200, { phoneNmbr: 612345678 }))

      await expect(adapter.findPhone(lead)).resolves.toBe('612345678')
    })

    it.each([{}, { phoneNmbr: null, countryCode: 'ES' }, { phoneNmbr: '', countryCode: 'ES' }])(
      'returns null when there is no number: %j',
      async (body) => {
        const { adapter } = adapterWith(makeResponse(200, body))

        await expect(adapter.findPhone(lead)).resolves.toBeNull()
      }
    )

    it.each([{ phoneNmbr: 12.5 }, { phoneNmbr: -1 }, { phoneNmbr: 'abc' }, { phoneNmbr: true }])(
      'throws a non-retryable failure for an invalid number: %j',
      async (body) => {
        const { adapter } = adapterWith(makeResponse(200, body))

        await expect(adapter.findPhone(lead)).rejects.toMatchObject({
          type: 'ProviderBadResponse',
          nonRetryable: true,
        })
      }
    )

    it('throws a retryable failure on server error', async () => {
      const { adapter } = adapterWith(fixtureResponse('nimbus', 'serverError'))

      await expect(adapter.findPhone(lead)).rejects.toMatchObject({ nonRetryable: false })
    })

    it('throws a non-retryable failure when job title is missing (400)', async () => {
      const { adapter } = adapterWith(fixtureResponse('nimbus', 'missingJobTitle'))

      await expect(adapter.findPhone(lead)).rejects.toMatchObject({
        type: 'ProviderClientError',
        nonRetryable: true,
      })
    })
  })
})
