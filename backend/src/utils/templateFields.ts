// Single source of truth for the lead fields usable in message templates.
// The generator uses it to resolve {placeholders}; the frontend fetches it
// from GET /template-fields to build the "Insert field" picker.
// To expose a new field: add the DB column, then add one entry here.

export type TemplateFieldGroup = 'person' | 'company' | 'contact'

export interface TemplateField {
  key: string
  label: string
  group: TemplateFieldGroup
}

export const TEMPLATE_FIELDS = [
  { key: 'firstName', label: 'First name', group: 'person' },
  { key: 'lastName', label: 'Last name', group: 'person' },
  { key: 'jobTitle', label: 'Job title', group: 'person' },
  { key: 'companyName', label: 'Company', group: 'company' },
  { key: 'yearsAtCompany', label: 'Years at company', group: 'company' },
  { key: 'email', label: 'Email', group: 'contact' },
  { key: 'phoneNumber', label: 'Phone number', group: 'contact' },
  { key: 'linkedinUrl', label: 'LinkedIn URL', group: 'contact' },
  { key: 'countryCode', label: 'Country', group: 'contact' },
] as const satisfies readonly TemplateField[]

export type TemplateFieldKey = (typeof TEMPLATE_FIELDS)[number]['key']
