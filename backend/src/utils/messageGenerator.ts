import { TEMPLATE_FIELDS, TemplateFieldKey } from './templateFields'

export type Lead = { firstName: string } & Partial<Record<TemplateFieldKey, string | number | null>>

const TEMPLATE_FIELD_KEYS = new Set<string>(TEMPLATE_FIELDS.map((field) => field.key))

const isTemplateFieldKey = (name: string): name is TemplateFieldKey => TEMPLATE_FIELD_KEYS.has(name)

// Replaces every {field} in one pass. Values are inserted as plain text:
// no `$&`-style patterns and no expanding of `{...}` found inside a value.
export function generateMessageFromTemplate(template: string, lead: Lead): string {
  return template.replace(/\{(\w+)\}/g, (_match, fieldName: string) => {
    if (!isTemplateFieldKey(fieldName)) {
      throw new Error(`Unknown field in template: ${fieldName}`)
    }

    const fieldValue = lead[fieldName]

    if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
      throw new Error(`Missing required field: ${fieldName}`)
    }

    return String(fieldValue)
  })
}
