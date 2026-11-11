// Turns one lead from POST /leads/bulk into data for prisma.lead.create.
// The frontend already validates and shows errors; this is the server-side
// guard so direct API calls can't store junk. Invalid optional values become
// null instead of failing the whole lead, and each one is reported as a warning.

const MAX_YEARS_AT_COMPANY = 80

// Digits with optional +, spaces and ( ) - . separators, then an optional extension
// ("x123" or "ext 123"). Matches what CRMs export, e.g. "(760)551-9973x6454", "001-464-312-8555".
const PHONE_PATTERN = /^\+?[\d\s().-]+?(?:\s*(?:x|ext\.?)\s*(\d{1,6}))?$/i
const MIN_PHONE_DIGITS = 7
const MAX_PHONE_DIGITS = 15 // E.164 limit, not counting the extension
const MAX_PHONE_LENGTH = 32

export interface ImportedLead {
  firstName: string
  lastName: string
  email: string
  [key: string]: unknown
}

export type ImportWarningField =
  | 'jobTitle'
  | 'countryCode'
  | 'companyName'
  | 'phoneNumber'
  | 'yearsAtCompany'
  | 'linkedinUrl'

/** An optional value that was given but not stored because it is not valid. */
export type ImportWarning = { field: ImportWarningField; message: string }

export const IMPORT_WARNING_MESSAGES = {
  notText: 'Must be text',
  phoneNumber: 'Not a valid phone number. Use digits with optional +, spaces, ( ) - . and an x extension',
  yearsAtCompany: `Must be a whole number from 0 to ${MAX_YEARS_AT_COMPANY}`,
  linkedinUrl: 'Must be a linkedin.com/in/ or /company/ link',
} as const

const isBlank = (value: unknown) =>
  value === undefined || value === null || (typeof value === 'string' && !value.trim())

const optionalText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null

/** Returns the phone as typed (trimmed), or null if it is not a phone number. */
export const parsePhoneNumber = (value: unknown): string | null => {
  const text = optionalText(value)
  if (!text || text.length > MAX_PHONE_LENGTH) return null

  const match = PHONE_PATTERN.exec(text)
  if (!match) return null

  const extension = match[1] ?? ''
  const mainDigits = text.replace(/\D/g, '').length - extension.length
  return mainDigits >= MIN_PHONE_DIGITS && mainDigits <= MAX_PHONE_DIGITS ? text : null
}

const parseYearsAtCompany = (value: unknown): number | null => {
  const years = typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value.trim()) : value
  return typeof years === 'number' && Number.isInteger(years) && years >= 0 && years <= MAX_YEARS_AT_COMPANY
    ? years
    : null
}

const normalizeLinkedinUrl = (value: unknown): string | null => {
  const text = optionalText(value)
  if (!text) return null
  const withProtocol = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`
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

/** Cleans one imported lead and lists the optional values that were dropped. */
export const parseImportedLead = (lead: ImportedLead) => {
  const warnings: ImportWarning[] = []

  // Runs the parser; warns when a value was given but could not be used.
  const field = <T>(
    name: ImportWarningField,
    parse: (value: unknown) => T | null,
    message: string
  ): T | null => {
    const value = lead[name]
    const parsed = parse(value)
    if (parsed === null && !isBlank(value)) warnings.push({ field: name, message })
    return parsed
  }

  const data = {
    firstName: lead.firstName.trim(),
    lastName: lead.lastName.trim(),
    email: lead.email.trim(),
    jobTitle: field('jobTitle', optionalText, IMPORT_WARNING_MESSAGES.notText),
    countryCode: field('countryCode', optionalText, IMPORT_WARNING_MESSAGES.notText),
    companyName: field('companyName', optionalText, IMPORT_WARNING_MESSAGES.notText),
    phoneNumber: field('phoneNumber', parsePhoneNumber, IMPORT_WARNING_MESSAGES.phoneNumber),
    yearsAtCompany: field('yearsAtCompany', parseYearsAtCompany, IMPORT_WARNING_MESSAGES.yearsAtCompany),
    linkedinUrl: field('linkedinUrl', normalizeLinkedinUrl, IMPORT_WARNING_MESSAGES.linkedinUrl),
  }

  return { data, warnings }
}
