import { describe, it, expect } from 'vitest'
import { getCompanyDomain } from './emailDomain'

describe('getCompanyDomain', () => {
  it('returns the domain of a company email', () => {
    expect(getCompanyDomain('ada@acme.com')).toBe('acme.com')
  })

  it('lowercases and trims the domain', () => {
    expect(getCompanyDomain('  Ada@ACME.Com ')).toBe('acme.com')
  })

  it('keeps subdomains', () => {
    expect(getCompanyDomain('ada@eu.acme.co.uk')).toBe('eu.acme.co.uk')
  })

  it.each(['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'])(
    'returns null for free mail provider %s',
    (domain) => {
      expect(getCompanyDomain(`someone@${domain}`)).toBeNull()
    }
  )

  it.each(['', 'no-at-sign', 'ada@', '@acme.com', 'ada@localhost', 'a@b@acme.com'])(
    'returns null for invalid email %j',
    (email) => {
      expect(getCompanyDomain(email)).toBeNull()
    }
  )
})
