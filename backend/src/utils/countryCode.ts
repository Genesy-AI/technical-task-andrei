const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })

// Returns an uppercased ISO 3166-1 alpha-2 code, or null if the value isn't a known region.
// Intl echoes back unknown 2-letter codes (e.g. "XX") instead of resolving them to a name.
export const normalizeCountryCode = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const code = value.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(code) && regionNames.of(code) !== code ? code : null
}
