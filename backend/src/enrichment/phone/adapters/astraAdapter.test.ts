import { describe, it, expect } from 'vitest'
import { AstraAdapter } from './astraAdapter'
import { fetchCall, fetchReturning, fixtureResponse, makeResponse } from './testUtils'
import type { LeadForEnrichment } from '../domain/types'

const lead: LeadForEnrichment = {
  id: 1,
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  jobTitle: null,
}
const baseUrl = 'https://api.test/astraDialer'

function adapterWith(response: Response) {
  const fetchFn = fetchReturning(response)
  return { adapter: new AstraAdapter({ baseUrl, apiKey: 'secret', fetchFn }), fetchFn }
}

describe('AstraAdapter', () => {
  it('is named ASTRA', () => {
    expect(adapterWith(makeResponse(200, {})).adapter.name).toBe('ASTRA')
  })

  describe('canHandle', () => {
    const { adapter } = adapterWith(makeResponse(200, {}))

    it('is true for any lead with an email, free mail included', () => {
      expect(adapter.canHandle({ ...lead, email: 'john@gmail.com' })).toBe(true)
    })

    it('is false when email is blank', () => {
      expect(adapter.canHandle({ ...lead, email: '  ' })).toBe(false)
    })
  })

  describe('findPhone', () => {
    it('POSTs the email with the apiKey header', async () => {
      const { adapter, fetchFn } = adapterWith(fixtureResponse('astra', 'found'))

      await adapter.findPhone(lead)

      const call = fetchCall(fetchFn)
      expect(call.url).toBe(baseUrl)
      expect(call.method).toBe('POST')
      expect(call.headers.get('apiKey')).toBe('secret')
      expect(call.body).toEqual({ email: 'john.doe@example.com' })
    })

    it('passes the abort signal through', async () => {
      const { adapter, fetchFn } = adapterWith(fixtureResponse('astra', 'found'))
      const signal = new AbortController().signal

      await adapter.findPhone(lead, { signal })

      expect(fetchFn.mock.calls[0][1]?.signal).toBe(signal)
    })

    it('returns phoneNmbr when found', async () => {
      const { adapter } = adapterWith(fixtureResponse('astra', 'found'))

      await expect(adapter.findPhone(lead)).resolves.toBe('8391612328')
    })

    it('returns null when phoneNmbr is missing (real API answers {})', async () => {
      const { adapter } = adapterWith(fixtureResponse('astra', 'notFound'))

      await expect(adapter.findPhone(lead)).resolves.toBeNull()
    })

    it('returns null when phoneNmbr is null', async () => {
      const { adapter } = adapterWith(fixtureResponse('astra', 'notFoundNull'))

      await expect(adapter.findPhone(lead)).resolves.toBeNull()
    })

    it('throws a non-retryable failure when the response has an unexpected shape', async () => {
      const { adapter } = adapterWith(makeResponse(200, { phoneNmbr: { x: 1 } }))

      await expect(adapter.findPhone(lead)).rejects.toMatchObject({
        type: 'ProviderBadResponse',
        nonRetryable: true,
      })
    })

    it('throws a non-retryable failure on bad auth', async () => {
      const { adapter } = adapterWith(fixtureResponse('astra', 'unauthorized'))

      await expect(adapter.findPhone(lead)).rejects.toMatchObject({
        type: 'ProviderClientError',
        nonRetryable: true,
      })
    })
  })
})
