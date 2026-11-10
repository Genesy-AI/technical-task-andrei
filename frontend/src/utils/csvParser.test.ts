import { describe, it, expect } from 'vitest'
import { parseCsv, isValidEmail, parseYearsAtCompany, normalizeLinkedinUrl } from './csvParser'

describe('isValidEmail', () => {
  it('should return true for valid email addresses', () => {
    expect(isValidEmail('test@example.com')).toBe(true)
    expect(isValidEmail('user.name@domain.co.uk')).toBe(true)
    expect(isValidEmail('first.last+tag@example.org')).toBe(true)
    expect(isValidEmail('123@456.com')).toBe(true)
  })

  it('should return false for invalid email addresses', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('invalid')).toBe(false)
    expect(isValidEmail('test@')).toBe(false)
    expect(isValidEmail('@example.com')).toBe(false)
    expect(isValidEmail('test.example.com')).toBe(false)
    expect(isValidEmail('test@.com')).toBe(false)
    expect(isValidEmail('test@example')).toBe(false)
  })
})

describe('parseCsv', () => {
  it('should throw error for empty content', () => {
    expect(() => parseCsv('')).toThrow('CSV content cannot be empty')
    expect(() => parseCsv('   ')).toThrow('CSV content cannot be empty')
  })

  it('should throw error for CSV with only headers', () => {
    const csv = 'firstName,lastName,email'
    expect(() => parseCsv(csv)).toThrow('CSV file appears to be empty or contains no valid data')
  })

  it('should throw error for malformed CSV content', () => {
    const malformedCsv = `firstName,lastName,email
"John,Doe,john@example.com,extra"field`
    expect(() => parseCsv(malformedCsv)).toThrow('CSV parsing failed')
  })

  it('should throw error for CSV with mismatched field count', () => {
    const mismatchedCsv = `firstName,lastName,email
John,Doe,john@example.com,ExtraField,AnotherExtra
Jane,Smith`
    expect(() => parseCsv(mismatchedCsv)).toThrow('CSV parsing failed')
  })

  it('should throw error for CSV with critical delimiter issues', () => {
    const noDelimiterCsv = `firstName lastName email
John Doe john@example.com`
    expect(() => parseCsv(noDelimiterCsv)).toThrow()
  })

  it('should parse valid CSV with all required fields', () => {
    const csv = `firstName,lastName,email,jobTitle,countryCode,companyName
John,Doe,john.doe@example.com,Developer,US,Tech Corp`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      jobTitle: 'Developer',
      countryCode: 'US',
      companyName: 'Tech Corp',
      isValid: true,
      errors: [],
      rowIndex: 2,
    })
  })

  it('should handle missing required fields and mark as invalid', () => {
    const csv = `firstName,lastName,email
,Smith,john@example.com
John,,john@example.com
John,Smith,`

    const result = parseCsv(csv)

    expect(result).toHaveLength(3)

    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toContain('First name is required')

    expect(result[1].isValid).toBe(false)
    expect(result[1].errors).toContain('Last name is required')

    expect(result[2].isValid).toBe(false)
    expect(result[2].errors).toContain('Email is required')
  })

  it('should validate email format', () => {
    const csv = `firstName,lastName,email
John,Doe,invalid-email
Jane,Smith,jane@example.com`

    const result = parseCsv(csv)

    expect(result).toHaveLength(2)
    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toContain('Invalid email format')
    expect(result[1].isValid).toBe(true)
  })

  it('should handle CSV with quoted values', () => {
    const csv = `firstName,lastName,email,jobTitle
"John","Doe","john.doe@example.com","Software Engineer"`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john.doe@example.com')
    expect(result[0].jobTitle).toBe('Software Engineer')
  })

  it('should skip empty rows', () => {
    const csv = `firstName,lastName,email
John,Doe,john@example.com
,,
Jane,Smith,jane@example.com`

    const result = parseCsv(csv)

    expect(result).toHaveLength(2)
    expect(result[0].firstName).toBe('John')
    expect(result[1].firstName).toBe('Jane')
  })

  it('should handle case-insensitive headers', () => {
    const csv = `FIRSTNAME,LASTNAME,EMAIL,JOBTITLE,COUNTRYCODE,COMPANYNAME
John,Doe,john@example.com,Developer,US,Tech Corp`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john@example.com')
    expect(result[0].jobTitle).toBe('Developer')
  })

  it('should handle missing optional fields', () => {
    const csv = `firstName,lastName,email,jobTitle,countryCode
John,Doe,john@example.com,,`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].jobTitle).toBeUndefined()
    expect(result[0].countryCode).toBeUndefined()
    expect(result[0].isValid).toBe(true)
  })

  it('should preserve row index correctly', () => {
    const csv = `firstName,lastName,email
John,Doe,john@example.com
Jane,Smith,jane@example.com
Bob,Johnson,bob@example.com`

    const result = parseCsv(csv)

    expect(result).toHaveLength(3)
    expect(result[0].rowIndex).toBe(2)
    expect(result[1].rowIndex).toBe(3)
    expect(result[2].rowIndex).toBe(4)
  })

  it('should handle multiple validation errors per lead', () => {
    const csv = `firstName,lastName,email
 , ,invalid-email`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toHaveLength(3)
    expect(result[0].errors).toContain('First name is required')
    expect(result[0].errors).toContain('Last name is required')
    expect(result[0].errors).toContain('Invalid email format')
  })

  it('should handle extra columns not in header mapping', () => {
    const csv = `firstName,lastName,email,unknownColumn
John,Doe,john@example.com,someValue`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john@example.com')
    expect(result[0].isValid).toBe(true)
  })

  it('should handle mixed valid and invalid leads', () => {
    const csv = `firstName,lastName,email
John,Doe,john@example.com
,Smith,invalid-email
Jane,Johnson,jane@example.com`

    const result = parseCsv(csv)

    expect(result).toHaveLength(3)
    expect(result[0].isValid).toBe(true)
    expect(result[1].isValid).toBe(false)
    expect(result[1].errors).toContain('First name is required')
    expect(result[1].errors).toContain('Invalid email format')
    expect(result[2].isValid).toBe(true)
  })

  it('should handle whitespace in fields', () => {
    const csv = `firstName,lastName,email
 John , Doe , john@example.com `

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john@example.com')
    expect(result[0].isValid).toBe(true)
  })
})

describe('parseYearsAtCompany', () => {
  it('should parse whole numbers from 0 to 80', () => {
    expect(parseYearsAtCompany('0')).toBe(0)
    expect(parseYearsAtCompany('5')).toBe(5)
    expect(parseYearsAtCompany('80')).toBe(80)
  })

  it('should return null for anything else', () => {
    expect(parseYearsAtCompany('abc')).toBeNull()
    expect(parseYearsAtCompany('-1')).toBeNull()
    expect(parseYearsAtCompany('2.5')).toBeNull()
    expect(parseYearsAtCompany('81')).toBeNull()
    expect(parseYearsAtCompany('5 years')).toBeNull()
  })
})

describe('normalizeLinkedinUrl', () => {
  it('should accept profile and company URLs', () => {
    expect(normalizeLinkedinUrl('https://www.linkedin.com/in/johndoe')).toBe(
      'https://www.linkedin.com/in/johndoe'
    )
    expect(normalizeLinkedinUrl('https://linkedin.com/company/acme')).toBe(
      'https://linkedin.com/company/acme'
    )
  })

  it('should add https when the protocol is missing', () => {
    expect(normalizeLinkedinUrl('linkedin.com/in/johndoe')).toBe('https://linkedin.com/in/johndoe')
    expect(normalizeLinkedinUrl('www.linkedin.com/in/johndoe')).toBe('https://www.linkedin.com/in/johndoe')
  })

  it('should upgrade http to https', () => {
    expect(normalizeLinkedinUrl('http://linkedin.com/in/johndoe')).toBe('https://linkedin.com/in/johndoe')
  })

  it('should return null for non-LinkedIn or non-profile URLs', () => {
    expect(normalizeLinkedinUrl('https://evil.com/in/johndoe')).toBeNull()
    expect(normalizeLinkedinUrl('https://linkedin.com.evil.com/in/johndoe')).toBeNull()
    expect(normalizeLinkedinUrl('https://linkedin.com/feed')).toBeNull()
    expect(normalizeLinkedinUrl('https://linkedin.com/in/')).toBeNull()
    expect(normalizeLinkedinUrl('javascript:alert(1)')).toBeNull()
    expect(normalizeLinkedinUrl('not a url')).toBeNull()
  })
})

describe('parseCsv - new lead fields', () => {
  const header = 'firstName,lastName,email'

  it('should parse phoneNumber, yearsAtCompany and linkedinUrl', () => {
    const csv = `${header},phoneNumber,yearsAtCompany,linkedinUrl
John,Doe,john@example.com,(760)551-9973x6454,3,linkedin.com/in/johndoe`

    const [lead] = parseCsv(csv)

    expect(lead.isValid).toBe(true)
    expect(lead.phoneNumber).toBe('(760)551-9973x6454')
    expect(lead.yearsAtCompany).toBe(3)
    expect(lead.linkedinUrl).toBe('https://linkedin.com/in/johndoe')
  })

  it('should map alias headers to the canonical fields', () => {
    const csv = `${header},phone,yearsInRole,LinkedIn Profile
John,Doe,john@example.com,555-0100,7,https://linkedin.com/in/johndoe`

    const [lead] = parseCsv(csv)

    expect(lead.phoneNumber).toBe('555-0100')
    expect(lead.yearsAtCompany).toBe(7)
    expect(lead.linkedinUrl).toBe('https://linkedin.com/in/johndoe')
  })

  it('should accept linkedin_url and years_at_company style headers', () => {
    const csv = `${header},linkedin_url,years_at_company
John,Doe,john@example.com,linkedin.com/in/johndoe,0`

    const [lead] = parseCsv(csv)

    expect(lead.linkedinUrl).toBe('https://linkedin.com/in/johndoe')
    expect(lead.yearsAtCompany).toBe(0)
  })

  it('should parse the header used by the sample CSVs in docs/', () => {
    const csv = `firstName,lastName,email,jobTitle,countryCode,companyName,yearsInRole,phoneNumber
Chad,Smith,hancockjames@gmail.com,Child psychotherapist,TV,Global Tech Solutions,2,+1-280-754-0462x2154`

    const [lead] = parseCsv(csv)

    expect(lead.isValid).toBe(true)
    expect(lead.yearsAtCompany).toBe(2)
    expect(lead.phoneNumber).toBe('+1-280-754-0462x2154')
  })

  it('should mark the row invalid when years is not a whole number from 0 to 80', () => {
    for (const years of ['abc', '-1', '2.5', '200']) {
      const [lead] = parseCsv(`${header},yearsAtCompany\nJohn,Doe,john@example.com,${years}`)
      expect(lead.isValid).toBe(false)
      expect(lead.errors).toContain('Invalid years at company. Use a whole number from 0 to 80')
    }
  })

  it('should mark the row invalid when the LinkedIn URL is not a linkedin.com profile', () => {
    const [lead] = parseCsv(`${header},linkedinUrl\nJohn,Doe,john@example.com,https://evil.com/in/john`)

    expect(lead.isValid).toBe(false)
    expect(lead.errors).toContain('Invalid LinkedIn URL. Use a linkedin.com/in/ or /company/ link')
  })

  it('should leave the new fields undefined when cells are empty', () => {
    const [lead] = parseCsv(`${header},phoneNumber,yearsAtCompany,linkedinUrl\nJohn,Doe,john@example.com,,,`)

    expect(lead.isValid).toBe(true)
    expect(lead.phoneNumber).toBeUndefined()
    expect(lead.yearsAtCompany).toBeUndefined()
    expect(lead.linkedinUrl).toBeUndefined()
  })
})
