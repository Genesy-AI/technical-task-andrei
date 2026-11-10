import { describe, it, expect } from 'vitest'
import { toLeadCreateData } from './leadImport'

const base = { firstName: ' John ', lastName: ' Doe ', email: ' john@example.com ' }

describe('toLeadCreateData', () => {
  it('should trim required fields and null out missing optional ones', () => {
    expect(toLeadCreateData(base)).toEqual({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      jobTitle: null,
      countryCode: null,
      companyName: null,
      phoneNumber: null,
      yearsAtCompany: null,
      linkedinUrl: null,
    })
  })

  it('should keep and trim existing optional fields', () => {
    const data = toLeadCreateData({ ...base, jobTitle: ' Dev ', countryCode: ' US ', companyName: ' Acme ' })
    expect(data).toMatchObject({ jobTitle: 'Dev', countryCode: 'US', companyName: 'Acme' })
  })

  it('should keep the phone number as typed, only trimmed', () => {
    expect(toLeadCreateData({ ...base, phoneNumber: ' (760)551-9973x6454 ' }).phoneNumber).toBe(
      '(760)551-9973x6454'
    )
  })

  it('should accept years as a number or a numeric string', () => {
    expect(toLeadCreateData({ ...base, yearsAtCompany: 3 }).yearsAtCompany).toBe(3)
    expect(toLeadCreateData({ ...base, yearsAtCompany: '12' }).yearsAtCompany).toBe(12)
    expect(toLeadCreateData({ ...base, yearsAtCompany: 0 }).yearsAtCompany).toBe(0)
  })

  it('should set years to null when it is not a whole number from 0 to 80', () => {
    for (const years of ['abc', -1, 2.5, 81, '5 years', true, {}]) {
      expect(toLeadCreateData({ ...base, yearsAtCompany: years }).yearsAtCompany).toBeNull()
    }
  })

  it('should keep valid LinkedIn URLs as https', () => {
    expect(toLeadCreateData({ ...base, linkedinUrl: 'linkedin.com/in/john' }).linkedinUrl).toBe(
      'https://linkedin.com/in/john'
    )
  })

  it('should set LinkedIn to null when it is not a linkedin.com profile or company URL', () => {
    for (const url of ['https://evil.com/in/john', 'javascript:alert(1)', 'https://linkedin.com/feed', 42]) {
      expect(toLeadCreateData({ ...base, linkedinUrl: url }).linkedinUrl).toBeNull()
    }
  })

  it('should ignore non-string values for text fields', () => {
    expect(toLeadCreateData({ ...base, phoneNumber: 123, jobTitle: {} })).toMatchObject({
      phoneNumber: null,
      jobTitle: null,
    })
  })
})
