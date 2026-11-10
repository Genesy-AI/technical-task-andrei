import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { LeadsList } from './LeadsList'
import { api } from '../api'
import type { Lead } from './leadColumns'

vi.mock('../api', () => ({
  api: {
    leads: {
      getMany: vi.fn(),
      enrichPhone: vi.fn(),
      deleteMany: vi.fn(),
      verifyEmails: vi.fn(),
      templateFields: vi.fn().mockResolvedValue([]),
    },
  },
}))

vi.mock('react-hot-toast', () => {
  const toastFn = Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() })
  return { default: toastFn }
})

const lead = (id: number, overrides: Partial<Lead> = {}): Lead => ({
  id,
  createdAt: '2026-01-15T10:00:00.000Z',
  updatedAt: '2026-01-15T10:00:00.000Z',
  firstName: `Lead${id}`,
  lastName: 'Test',
  email: `lead${id}@acme.com`,
  jobTitle: null,
  countryCode: null,
  companyName: null,
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

async function renderAndSelect(leadIds: number[]) {
  const user = userEvent.setup()
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <LeadsList />
    </QueryClientProvider>
  )
  for (const id of leadIds) {
    const row = (await screen.findByText(`lead${id}@acme.com`, { exact: false })).closest('tr')!
    await user.click(within(row).getByRole('checkbox'))
  }
  await user.click(screen.getByRole('button', { name: /enrich/i }))
  return { user }
}

describe('LeadsList – Enrich Phone', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.leads.getMany).mockResolvedValue([lead(1), lead(2), lead(3)])
  })

  it('starts phone enrichment for the selected leads and confirms with a toast', async () => {
    vi.mocked(api.leads.enrichPhone).mockResolvedValue({ started: [1, 3], skipped: [], errors: [] })
    const { user } = await renderAndSelect([1, 3])

    await user.click(screen.getByRole('button', { name: /enrich phone/i }))

    await waitFor(() => expect(api.leads.enrichPhone).toHaveBeenCalledWith({ leadIds: [1, 3] }))
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Finding phones for 2 leads'))
    expect(screen.queryByRole('button', { name: /enrich phone/i })).not.toBeInTheDocument()
  })

  it('refreshes the leads list so the new status shows right away', async () => {
    vi.mocked(api.leads.enrichPhone).mockResolvedValue({ started: [1], skipped: [], errors: [] })
    const { user } = await renderAndSelect([1])
    expect(api.leads.getMany).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: /enrich phone/i }))

    await waitFor(() => expect(api.leads.getMany).toHaveBeenCalledTimes(2))
  })

  it('shows an info toast when every lead was skipped', async () => {
    vi.mocked(api.leads.enrichPhone).mockResolvedValue({
      started: [],
      skipped: [{ leadId: 1, reason: 'already_has_phone' }],
      errors: [],
    })
    const { user } = await renderAndSelect([1])

    await user.click(screen.getByRole('button', { name: /enrich phone/i }))

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith('Nothing to enrich. Skipped 1: 1 already has a phone', {
        icon: 'ℹ️',
      })
    )
  })

  it('shows an error toast when the request fails', async () => {
    vi.mocked(api.leads.enrichPhone).mockRejectedValue(new Error('Network Error'))
    const { user } = await renderAndSelect([2])

    await user.click(screen.getByRole('button', { name: /enrich phone/i }))

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Failed to start phone enrichment. Please try again.')
    )
  })

  it('explains the limit instead of calling the API when more than 100 leads are selected', async () => {
    vi.mocked(api.leads.getMany).mockResolvedValue(Array.from({ length: 101 }, (_, i) => lead(i + 1)))
    const user = userEvent.setup()
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={queryClient}>
        <LeadsList />
      </QueryClientProvider>
    )
    await screen.findByText('lead101@acme.com', { exact: false })
    await user.click(screen.getAllByRole('checkbox')[0]) // select all
    await user.click(screen.getByRole('button', { name: /enrich/i }))

    await user.click(screen.getByRole('button', { name: /enrich phone/i }))

    expect(toast.error).toHaveBeenCalledWith('You can enrich at most 100 leads at a time. 101 are selected.')
    expect(api.leads.enrichPhone).not.toHaveBeenCalled()
  })
})
