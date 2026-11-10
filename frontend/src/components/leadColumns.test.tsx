import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { LEAD_COLUMNS, Lead } from './leadColumns'

const baseLead: Lead = {
  id: 1,
  createdAt: '2026-01-15T10:00:00.000Z',
  updatedAt: '2026-01-15T10:00:00.000Z',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  jobTitle: 'Engineer',
  countryCode: 'US',
  companyName: 'Acme',
  message: 'Hello John',
  emailVerified: true,
  phoneNumber: '+1 555 0100',
  yearsAtCompany: 4,
  linkedinUrl: 'https://linkedin.com/in/johndoe',
}

const renderRow = (lead: Lead) => {
  render(
    <table>
      <tbody>
        <tr>
          {LEAD_COLUMNS.map((column) => (
            <td key={column.key} data-testid={column.key}>
              {column.render(lead)}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  )
  return (key: string) => screen.getByTestId(key)
}

describe('LEAD_COLUMNS', () => {
  it('has the expected headers in order', () => {
    expect(LEAD_COLUMNS.map((column) => column.header)).toEqual([
      'Name',
      'Email',
      'Phone',
      'LinkedIn',
      'Job Title',
      'Company',
      'Years at Company',
      'Country',
      'Message',
      'Created',
    ])
  })

  it('has unique keys', () => {
    const keys = LEAD_COLUMNS.map((column) => column.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  describe('existing cells', () => {
    it('renders name, email with verified mark, job, company, country and message', () => {
      const cell = renderRow(baseLead)
      expect(cell('name')).toHaveTextContent('John Doe')
      expect(cell('email')).toHaveTextContent('john@example.com ✅')
      expect(cell('jobTitle')).toHaveTextContent('Engineer')
      expect(cell('companyName')).toHaveTextContent('Acme')
      expect(cell('countryCode')).toHaveTextContent('US')
      expect(cell('message')).toHaveTextContent('Hello John')
    })

    it('renders "-" for empty values and ❓ for unknown email status', () => {
      const cell = renderRow({
        ...baseLead,
        lastName: null,
        email: null,
        emailVerified: null,
        jobTitle: null,
        companyName: null,
        countryCode: null,
        message: null,
      })
      expect(cell('name')).toHaveTextContent('John')
      expect(cell('email')).toHaveTextContent('- ❓')
      expect(cell('jobTitle')).toHaveTextContent('-')
      expect(cell('companyName')).toHaveTextContent('-')
      expect(cell('countryCode')).toHaveTextContent('-')
      expect(cell('message')).toHaveTextContent('-')
    })
  })

  describe('new cells', () => {
    it('renders phone and years', () => {
      const cell = renderRow(baseLead)
      expect(cell('phoneNumber')).toHaveTextContent('+1 555 0100')
      expect(cell('yearsAtCompany')).toHaveTextContent('4')
    })

    it('renders 0 years as 0, not as empty', () => {
      const cell = renderRow({ ...baseLead, yearsAtCompany: 0 })
      expect(cell('yearsAtCompany')).toHaveTextContent(/^0$/)
    })

    it('renders "-" when phone, years or LinkedIn are empty', () => {
      const cell = renderRow({ ...baseLead, phoneNumber: null, yearsAtCompany: null, linkedinUrl: null })
      expect(cell('phoneNumber')).toHaveTextContent('-')
      expect(cell('yearsAtCompany')).toHaveTextContent('-')
      expect(cell('linkedinUrl')).toHaveTextContent('-')
      expect(within(cell('linkedinUrl')).queryByRole('link')).toBeNull()
    })

    it('renders LinkedIn as a safe link that opens in a new tab', () => {
      const cell = renderRow(baseLead)
      const link = within(cell('linkedinUrl')).getByRole('link', { name: /profile/i })
      expect(link).toHaveAttribute('href', 'https://linkedin.com/in/johndoe')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link.getAttribute('rel')).toContain('noopener')
      expect(link.getAttribute('rel')).toContain('noreferrer')
      expect(link).toHaveAttribute('title', 'https://linkedin.com/in/johndoe')
    })
  })
})
