import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'
import { TEMPLATE_FIELDS } from './templateFields'

describe('TEMPLATE_FIELDS', () => {
  it('only uses keys that exist as columns on the lead model', () => {
    const leadColumns = Object.values(Prisma.LeadScalarFieldEnum) as string[]
    for (const field of TEMPLATE_FIELDS) {
      expect(leadColumns).toContain(field.key)
    }
  })

  it('has unique keys', () => {
    const keys = TEMPLATE_FIELDS.map((field) => field.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('gives every field a label and a group', () => {
    for (const field of TEMPLATE_FIELDS) {
      expect(field.label.trim()).not.toBe('')
      expect(['person', 'company', 'contact']).toContain(field.group)
    }
  })

  it('includes the new lead fields', () => {
    const keys = TEMPLATE_FIELDS.map((field) => field.key)
    expect(keys).toEqual(expect.arrayContaining(['phoneNumber', 'yearsAtCompany', 'linkedinUrl']))
  })
})
