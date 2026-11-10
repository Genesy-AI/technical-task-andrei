import Papa from 'papaparse'

export interface CsvLead {
  firstName: string
  lastName: string
  email: string
  jobTitle?: string
  countryCode?: string
  companyName?: string
  phoneNumber?: string
  yearsAtCompany?: number
  linkedinUrl?: string
  isValid: boolean
  errors: string[]
  rowIndex: number
}

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

const MAX_YEARS_AT_COMPANY = 80

// Returns the number of years, or null if the value is not a whole number from 0 to 80.
export const parseYearsAtCompany = (value: string): number | null => {
  if (!/^\d+$/.test(value)) return null
  const years = Number(value)
  return years <= MAX_YEARS_AT_COMPANY ? years : null
}

// Returns an https linkedin.com profile/company URL, or null if the value is not one.
export const normalizeLinkedinUrl = (value: string): string | null => {
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`
  let url: URL
  try {
    url = new URL(withProtocol)
  } catch {
    return null
  }
  const isHttp = url.protocol === 'https:' || url.protocol === 'http:'
  const isLinkedinHost = url.hostname === 'linkedin.com' || url.hostname.endsWith('.linkedin.com')
  const isProfilePath = /^\/(in|company)\/[^/]+/.test(url.pathname)
  if (!isHttp || !isLinkedinHost || !isProfilePath) return null
  url.protocol = 'https:'
  return url.href
}

type CsvField =
  | 'firstName'
  | 'lastName'
  | 'email'
  | 'jobTitle'
  | 'countryCode'
  | 'companyName'
  | 'phoneNumber'
  | 'yearsAtCompany'
  | 'linkedinUrl'

// Keys are headers lowercased with non-letters removed ("LinkedIn Profile" -> "linkedinprofile").
const HEADER_ALIASES: Record<string, CsvField> = {
  firstname: 'firstName',
  lastname: 'lastName',
  email: 'email',
  jobtitle: 'jobTitle',
  countrycode: 'countryCode',
  companyname: 'companyName',
  phonenumber: 'phoneNumber',
  phone: 'phoneNumber',
  yearsatcompany: 'yearsAtCompany',
  yearsinrole: 'yearsAtCompany',
  linkedinurl: 'linkedinUrl',
  linkedin: 'linkedinUrl',
  linkedinprofile: 'linkedinUrl',
}

export const parseCsv = (content: string): CsvLead[] => {
  if (!content?.trim()) {
    throw new Error('CSV content cannot be empty')
  }

  const parseResult = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transform: (value) => value.trim(),
    transformHeader: (header) => header.trim().toLowerCase(),
    quoteChar: '"',
  })

  if (parseResult.errors.length > 0) {
    const criticalErrors = parseResult.errors.filter(
      (error) => error.type === 'Delimiter' || error.type === 'Quotes' || error.type === 'FieldMismatch'
    )
    if (criticalErrors.length > 0) {
      throw new Error(`CSV parsing failed: ${criticalErrors[0].message}`)
    }
  }

  if (!parseResult.data || parseResult.data.length === 0) {
    throw new Error('CSV file appears to be empty or contains no valid data')
  }

  const data: CsvLead[] = []

  parseResult.data.forEach((row, index) => {
    if (Object.values(row).every((value) => !value)) return

    const raw: Partial<Record<CsvField, string>> = {}

    Object.entries(row).forEach(([header, value]) => {
      const field = HEADER_ALIASES[header.toLowerCase().replace(/[^a-z]/g, '')]
      if (field) raw[field] = value?.trim() || ''
    })

    const errors: string[] = []
    if (!raw.firstName) {
      errors.push('First name is required')
    }
    if (!raw.lastName) {
      errors.push('Last name is required')
    }
    if (!raw.email) {
      errors.push('Email is required')
    } else if (!isValidEmail(raw.email)) {
      errors.push('Invalid email format')
    }

    let yearsAtCompany: number | undefined
    if (raw.yearsAtCompany) {
      const years = parseYearsAtCompany(raw.yearsAtCompany)
      if (years === null) errors.push('Invalid years at company. Use a whole number from 0 to 80')
      else yearsAtCompany = years
    }

    let linkedinUrl: string | undefined
    if (raw.linkedinUrl) {
      const url = normalizeLinkedinUrl(raw.linkedinUrl)
      if (url === null) errors.push('Invalid LinkedIn URL. Use a linkedin.com/in/ or /company/ link')
      else linkedinUrl = url
    }

    data.push({
      firstName: raw.firstName || '',
      lastName: raw.lastName || '',
      email: raw.email || '',
      jobTitle: raw.jobTitle || undefined,
      countryCode: raw.countryCode || undefined,
      companyName: raw.companyName || undefined,
      phoneNumber: raw.phoneNumber || undefined,
      yearsAtCompany,
      linkedinUrl,
      isValid: errors.length === 0,
      errors,
      rowIndex: index + 2,
    })
  })

  return data
}
