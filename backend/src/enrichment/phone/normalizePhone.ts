import { isSupportedCountry, parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js'
import type { ProviderPhone } from './domain/ports'

// Phone-like text only: digits, an optional leading +, and common separators.
const PHONE_CHARS = /^\+?[\d\s().-]+$/
// E.164 allows at most 15 digits; fewer than 7 is never a full number.
const MIN_DIGITS = 7
const MAX_DIGITS = 15

// Common non-ISO codes we see in lead data.
const COUNTRY_ALIASES: Record<string, string> = { UK: 'GB' }

function toCountry(code: string | null | undefined): CountryCode | null {
  const upper = code?.trim().toUpperCase()
  if (!upper) return null
  const iso = COUNTRY_ALIASES[upper] ?? upper
  return isSupportedCountry(iso) ? iso : null
}

/**
 * Cleans a provider phone before it is stored.
 * - Returns null for anything that is not a phone (letters, HTML, too short or too long).
 *   The caller treats that as "no data" and asks the next provider.
 * - Returns E.164 (`+34612345678`) when the number has a `+` prefix, or when the provider's
 *   country (first) or the lead's country makes it a possible number.
 * - Otherwise returns the bare digits: we do not guess a country.
 */
export function normalizePhone(phone: ProviderPhone, leadCountryCode: string | null): string | null {
  const text = phone.number.trim()
  if (!PHONE_CHARS.test(text)) return null

  const digits = text.replace(/\D/g, '')
  if (digits.length < MIN_DIGITS || digits.length > MAX_DIGITS) return null

  if (text.startsWith('+')) {
    const parsed = parsePhoneNumberFromString(`+${digits}`)
    return parsed?.isPossible() ? parsed.number : null
  }

  const countries = [toCountry(phone.countryCode), toCountry(leadCountryCode)].filter(
    (c): c is CountryCode => c !== null
  )
  for (const country of new Set(countries)) {
    const parsed = parsePhoneNumberFromString(digits, country)
    // The country code adds digits; E.164 still allows at most 15 in total.
    const fitsE164 = parsed !== undefined && parsed.number.length - 1 <= MAX_DIGITS
    if (parsed?.isPossible() && fitsE164) return parsed.number
  }
  return digits
}
