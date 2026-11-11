import { describe, it, expect } from 'vitest'
import { normalizePhone } from './normalizePhone'

describe('normalizePhone', () => {
  it("uses the lead's country to build E.164", () => {
    expect(normalizePhone({ number: '8391612328' }, 'US')).toBe('+18391612328')
    expect(normalizePhone({ number: '3476993647' }, 'IT')).toBe('+393476993647')
  })

  it("prefers the provider's country over the lead's", () => {
    expect(normalizePhone({ number: '8391612328', countryCode: 'US' }, 'DE')).toBe('+18391612328')
  })

  it("falls back to the lead's country when the provider's does not fit", () => {
    // 10 digits is not a possible Spanish number, but it is a possible US one.
    expect(normalizePhone({ number: '4088282927', countryCode: 'ES' }, 'US')).toBe('+14088282927')
  })

  it('maps UK to GB and handles national prefixes', () => {
    expect(normalizePhone({ number: '07700 900123' }, 'UK')).toBe('+447700900123')
  })

  it('keeps an international number that already has a +', () => {
    expect(normalizePhone({ number: '+34 612 34 56 78' }, null)).toBe('+34612345678')
  })

  it('keeps bare digits when no country makes it a possible number', () => {
    expect(normalizePhone({ number: '4088282927', countryCode: 'ES' }, null)).toBe('4088282927')
    expect(normalizePhone({ number: '(408) 828-2927' }, null)).toBe('4088282927')
    expect(normalizePhone({ number: '4088282927' }, 'ZZ')).toBe('4088282927')
  })

  it.each([
    ['HTML', '<img src=x onerror=alert(1)>'],
    ['letters', 'call me maybe'],
    ['a formula', '=HYPERLINK("http://evil")'],
    ['too short', '12345'],
    ['too long', '1234567890123456'],
    ['an impossible + number', '+1 234'],
    ['empty', '   '],
  ])('rejects %s', (_, number) => {
    expect(normalizePhone({ number }, 'US')).toBeNull()
  })
})
