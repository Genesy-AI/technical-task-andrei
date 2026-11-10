import { describe, it, expect } from 'vitest'
import { normalizeCountryCode } from './countryCode'

describe('normalizeCountryCode', () => {
  it('should return valid ISO alpha-2 codes uppercased and trimmed', () => {
    expect(normalizeCountryCode('ES')).toBe('ES')
    expect(normalizeCountryCode(' us ')).toBe('US')
  })

  it('should return null for invalid codes', () => {
    expect(normalizeCountryCode('XXX')).toBeNull()
    expect(normalizeCountryCode('12')).toBeNull()
    expect(normalizeCountryCode('XX')).toBeNull()
  })

  it('should return null for empty or non-string values', () => {
    expect(normalizeCountryCode('')).toBeNull()
    expect(normalizeCountryCode(undefined)).toBeNull()
    expect(normalizeCountryCode(42)).toBeNull()
  })
})
