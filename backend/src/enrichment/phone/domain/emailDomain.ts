// Free / personal mail domains. Their domain says nothing about the lead's company.
const FREE_MAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
  'mail.com',
])

/**
 * Company website guessed from an email address, e.g. `ada@acme.com` -> `acme.com`.
 * Returns null for free mail providers and invalid emails.
 */
export function getCompanyDomain(email: string): string | null {
  const parts = email.trim().toLowerCase().split('@')
  if (parts.length !== 2) return null

  const [local, domain] = parts
  if (!local || !domain.includes('.')) return null
  if (FREE_MAIL_DOMAINS.has(domain)) return null

  return domain
}
