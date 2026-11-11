import { describe, it, expect } from 'vitest'
import { IMPORT_WARNING_MESSAGES, parseImportedLead, parsePhoneNumber, type ImportedLead } from './leadImport'

const toLeadCreateData = (lead: ImportedLead) => parseImportedLead(lead).data

const base = { firstName: ' John ', lastName: ' Doe ', email: ' john@example.com ' }

describe('parseImportedLead data', () => {
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

describe('parsePhoneNumber', () => {
  // Real values from the sample CSVs in docs/.
  it.each([
    '(760)551-9973x6454',
    '+1-627-991-1712x7922',
    '001-464-312-8555',
    '063.430.8860x4762',
    '1601140330',
    '990-054-7491x78196',
    '+34 612 34 56 78',
    '555-0100 ext. 12',
  ])('keeps %s as typed', (phone) => {
    expect(parsePhoneNumber(` ${phone} `)).toBe(phone)
  })

  it.each([
    ['HTML', '<img src=x onerror=alert(1)>'],
    ['a formula', '=HYPERLINK("http://evil")'],
    ['letters', 'call me'],
    ['too few digits', '555-01'],
    ['too many digits', '1234567890123456'],
    ['too long', '1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7'],
    ['a 20,000 character value', '1'.repeat(20_000)],
    ['two pluses', '++1 555 0100'],
    ['a non-string', 5550100],
  ])('rejects %s', (_, value) => {
    expect(parsePhoneNumber(value)).toBeNull()
  })
})

describe('parseImportedLead', () => {
  it('has no warnings for a clean lead or blank optional values', () => {
    expect(parseImportedLead(base).warnings).toEqual([])
    expect(
      parseImportedLead({
        ...base,
        phoneNumber: '  ',
        yearsAtCompany: '',
        linkedinUrl: null,
        jobTitle: undefined,
      }).warnings
    ).toEqual([])
  })

  it('warns for every optional value it had to drop', () => {
    const { data, warnings } = parseImportedLead({
      ...base,
      jobTitle: 123,
      phoneNumber: '<b>call</b>',
      yearsAtCompany: -3,
      linkedinUrl: 'javascript:alert(1)',
      companyName: 'Acme',
    })

    expect(data).toMatchObject({
      jobTitle: null,
      phoneNumber: null,
      yearsAtCompany: null,
      linkedinUrl: null,
      companyName: 'Acme',
    })
    expect(warnings).toEqual([
      { field: 'jobTitle', message: IMPORT_WARNING_MESSAGES.notText },
      { field: 'phoneNumber', message: IMPORT_WARNING_MESSAGES.phoneNumber },
      { field: 'yearsAtCompany', message: IMPORT_WARNING_MESSAGES.yearsAtCompany },
      { field: 'linkedinUrl', message: IMPORT_WARNING_MESSAGES.linkedinUrl },
    ])
  })
})
