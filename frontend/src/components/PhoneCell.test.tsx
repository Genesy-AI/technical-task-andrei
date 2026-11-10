import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PhoneCell } from './PhoneCell'
import type { Lead } from './leadColumns'

const lead = (overrides: Partial<Lead> = {}): Lead => ({
  id: 1,
  createdAt: '2026-01-15T10:00:00.000Z',
  updatedAt: '2026-01-15T10:00:00.000Z',
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@acme.com',
  jobTitle: 'CTO',
  countryCode: 'ES',
  companyName: 'Acme',
  message: null,
  emailVerified: null,
  phoneNumber: null,
  yearsAtCompany: null,
  linkedinUrl: null,
  phoneSource: null,
  phoneEnrichmentStatus: null,
  phoneEnrichmentProvider: null,
  phoneEnrichmentError: null,
  ...overrides,
})

describe('PhoneCell', () => {
  it('shows "-" when there is no phone and no enrichment', () => {
    const { container } = render(<PhoneCell lead={lead()} />)
    expect(container).toHaveTextContent(/^-$/)
  })

  it('shows the phone number', () => {
    render(<PhoneCell lead={lead({ phoneNumber: '+1 555 0100' })} />)
    expect(screen.getByText('+1 555 0100')).toBeInTheDocument()
  })

  it('shows which provider found the phone', () => {
    render(
      <PhoneCell
        lead={lead({ phoneNumber: 'ES 4088282927', phoneSource: 'NIMBUS', phoneEnrichmentStatus: 'FOUND' })}
      />
    )
    expect(screen.getByText('ES 4088282927')).toBeInTheDocument()
    expect(screen.getByText('Nimbus')).toHaveAttribute('title', 'Found by Nimbus')
  })

  it('shows no source tag for phones that were not enriched (e.g. CSV import)', () => {
    render(<PhoneCell lead={lead({ phoneNumber: '+1 555 0100' })} />)
    expect(screen.queryByTitle(/found by/i)).not.toBeInTheDocument()
  })

  it('shows a busy state while waiting to start', () => {
    render(<PhoneCell lead={lead({ phoneEnrichmentStatus: 'PENDING' })} />)
    expect(screen.getByRole('status')).toHaveTextContent('Pending…')
  })

  it.each([
    ['ORION', 'Checking Orion…'],
    ['ASTRA', 'Checking Astra…'],
    ['NIMBUS', 'Checking Nimbus…'],
  ] as const)('shows the provider being checked (%s)', (provider, text) => {
    render(<PhoneCell lead={lead({ phoneEnrichmentStatus: 'RUNNING', phoneEnrichmentProvider: provider })} />)
    expect(screen.getByRole('status')).toHaveTextContent(text)
  })

  it('shows "Searching…" when running without a provider yet', () => {
    render(<PhoneCell lead={lead({ phoneEnrichmentStatus: 'RUNNING' })} />)
    expect(screen.getByRole('status')).toHaveTextContent('Searching…')
  })

  it('shows "No data found" when no provider had a phone', () => {
    render(<PhoneCell lead={lead({ phoneEnrichmentStatus: 'NO_DATA' })} />)
    expect(screen.getByText('No data found')).toBeInTheDocument()
  })

  it('shows "Failed" with the message from the server as a tooltip', () => {
    const message = 'Phone lookup failed. Please try again later.'
    render(<PhoneCell lead={lead({ phoneEnrichmentStatus: 'FAILED', phoneEnrichmentError: message })} />)
    expect(screen.getByText('Failed')).toHaveAttribute('title', message)
  })

  it('shows a generic tooltip when a failure has no error text', () => {
    render(<PhoneCell lead={lead({ phoneEnrichmentStatus: 'FAILED' })} />)
    expect(screen.getByText('Failed')).toHaveAttribute('title', 'Phone enrichment failed')
  })
})
