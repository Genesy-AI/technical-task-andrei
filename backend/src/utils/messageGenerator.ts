import { TEMPLATE_FIELDS, TemplateFieldKey } from './templateFields'

export type Lead = { firstName: string } & Partial<Record<TemplateFieldKey, string | number | null>>

const TEMPLATE_FIELD_KEYS = new Set<string>(TEMPLATE_FIELDS.map((field) => field.key))

const isTemplateFieldKey = (name: string): name is TemplateFieldKey => TEMPLATE_FIELD_KEYS.has(name)

export function generateMessageFromTemplate(template: string, lead: Lead): string {
  let message = template

  const templateVariables = template.match(/\{(\w+)\}/g) || []

  for (const variable of templateVariables) {
    const fieldName = variable.slice(1, -1)

    if (!isTemplateFieldKey(fieldName)) {
      throw new Error(`Unknown field in template: ${fieldName}`)
    }

    const fieldValue = lead[fieldName]

    if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
      throw new Error(`Missing required field: ${fieldName}`)
    }

    message = message.replace(new RegExp(`\\{${fieldName}\\}`, 'g'), String(fieldValue))
  }

  return message
}
