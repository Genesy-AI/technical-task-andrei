import { describe, it, expect } from 'vitest'
import { DB_ACTIVITY_OPTIONS, PROVIDER_ACTIVITY_OPTIONS, PROVIDER_ORDER } from './config'

describe('phone enrichment config', () => {
  it('calls providers in the agreed order: best data first, new provider last', () => {
    expect(PROVIDER_ORDER).toEqual(['ORION', 'ASTRA', 'NIMBUS'])
  })

  it.each([
    ['ORION', '10 seconds'], // slow (~4s) and flaky
    ['ASTRA', '3 seconds'], // fast (<1.5s)
    ['NIMBUS', '5 seconds'], // ~2s
  ] as const)('gives %s a short timeout of %s', (provider, timeout) => {
    expect(PROVIDER_ACTIVITY_OPTIONS[provider].startToCloseTimeout).toBe(timeout)
  })

  it.each(['ORION', 'ASTRA', 'NIMBUS'] as const)(
    'retries %s 3 times with exponential backoff',
    (provider) => {
      expect(PROVIDER_ACTIVITY_OPTIONS[provider].retry).toEqual({
        maximumAttempts: 3,
        initialInterval: '1 second',
        backoffCoefficient: 2,
        maximumInterval: '10 seconds',
      })
    }
  )

  it('gives DB activities a short timeout and a few retries', () => {
    expect(DB_ACTIVITY_OPTIONS).toMatchObject({
      startToCloseTimeout: '5 seconds',
      retry: { maximumAttempts: 5 },
    })
  })
})
