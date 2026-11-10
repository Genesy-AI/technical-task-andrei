export type LeadsTemplateFieldsInput = undefined

export type TemplateFieldGroup = 'person' | 'company' | 'contact'

export type TemplateField = {
  key: string
  label: string
  group: TemplateFieldGroup
}

export type LeadsTemplateFieldsOutput = TemplateField[]
