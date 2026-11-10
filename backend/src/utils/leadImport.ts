// Turns one lead from POST /leads/bulk into data for prisma.lead.create.
// The frontend already validates and shows errors; this is the server-side
// guard so direct API calls can't store junk. Invalid optional values become
// null instead of failing the whole lead.

const MAX_YEARS_AT_COMPANY = 80

export interface ImportedLead {
  firstName: string
  lastName: string
  email: string
  [key: string]: unknown
}

const optionalText = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null

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

export const toLeadCreateData = (lead: ImportedLead) => ({
  firstName: lead.firstName.trim(),
  lastName: lead.lastName.trim(),
  email: lead.email.trim(),
  jobTitle: optionalText(lead.jobTitle),
  countryCode: optionalText(lead.countryCode),
  companyName: optionalText(lead.companyName),
  phoneNumber: optionalText(lead.phoneNumber),
  yearsAtCompany: parseYearsAtCompany(lead.yearsAtCompany),
  linkedinUrl: normalizeLinkedinUrl(lead.linkedinUrl),
})
