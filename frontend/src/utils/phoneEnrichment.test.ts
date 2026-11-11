import { describe, it, expect } from 'vitest'
import { AxiosError, type AxiosResponse } from 'axios'
import {
  PHONE_LOOKUP_STALE_AFTER_MS,
  POLL_INTERVAL_MS,
  enrichPhoneErrorMessage,
  enrichPhoneFeedback,
  isLookupStuck,
  leadsPollInterval,
} from './phoneEnrichment'
import type { LeadsGetManyOutput, PhoneEnrichmentStatus } from '../api/types/leads/getMany'

const NOW = Date.parse('2026-11-11T12:00:00Z')
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString()

const withStatuses = (...statuses: (PhoneEnrichmentStatus | null)[]) =>
  statuses.map((phoneEnrichmentStatus, i) => ({
    id: i + 1,
    phoneEnrichmentStatus,
    phoneEnrichmentRequestedAt: minutesAgo(1),
  })) as LeadsGetManyOutput

describe('leadsPollInterval', () => {
  it.each(['PENDING', 'RUNNING'] as const)('polls every 2s while a lead is %s', (status) => {
    expect(leadsPollInterval(withStatuses('FOUND', status, null), NOW)).toBe(POLL_INTERVAL_MS)
    expect(POLL_INTERVAL_MS).toBe(2000)
  })

  it('stops polling when every lead is finished or never enriched', () => {
    expect(leadsPollInterval(withStatuses('FOUND', 'NO_DATA', 'FAILED', null))).toBe(false)
  })

  it('does not poll before leads are loaded', () => {
    expect(leadsPollInterval(undefined)).toBe(false)
  })

  it('stops polling when the only busy lead is stuck', () => {
    const leads = [{ id: 1, phoneEnrichmentStatus: 'RUNNING', phoneEnrichmentRequestedAt: minutesAgo(10) }]
    expect(leadsPollInterval(leads as LeadsGetManyOutput, NOW)).toBe(false)
  })
})

describe('isLookupStuck', () => {
  const lead = (
    phoneEnrichmentStatus: PhoneEnrichmentStatus | null,
    phoneEnrichmentRequestedAt: string | null
  ) => ({
    phoneEnrichmentStatus,
    phoneEnrichmentRequestedAt,
  })

  it.each(['PENDING', 'RUNNING'] as const)('is false for a %s lead inside the time limit', (status) => {
    expect(isLookupStuck(lead(status, minutesAgo(5)), NOW)).toBe(false)
  })

  it.each(['PENDING', 'RUNNING'] as const)('is true for a %s lead past the time limit', (status) => {
    expect(
      isLookupStuck(lead(status, new Date(NOW - PHONE_LOOKUP_STALE_AFTER_MS - 1).toISOString()), NOW)
    ).toBe(true)
  })

  it('is true for an in-progress lead with no request time (old row)', () => {
    expect(isLookupStuck(lead('RUNNING', null), NOW)).toBe(true)
  })

  it.each(['FOUND', 'NO_DATA', 'FAILED', null] as const)('is false for a %s lead, however old', (status) => {
    expect(isLookupStuck(lead(status, minutesAgo(60)), NOW)).toBe(false)
  })
})

describe('enrichPhoneErrorMessage', () => {
  const httpError = (status: number, data: unknown) =>
    new AxiosError('Request failed', 'ERR', undefined, undefined, { status, data } as AxiosResponse)

  it.each([400, 429])('shows the server message for %s', (status) => {
    expect(enrichPhoneErrorMessage(httpError(status, { error: 'Too many phone lookups.' }))).toBe(
      'Too many phone lookups.'
    )
  })

  it('does not show server text for other statuses', () => {
    expect(enrichPhoneErrorMessage(httpError(500, { error: 'internal detail' }))).toBe(
      'Failed to start phone enrichment. Please try again.'
    )
    expect(enrichPhoneErrorMessage(new Error('boom'))).toBe(
      'Failed to start phone enrichment. Please try again.'
    )
  })
})

describe('enrichPhoneFeedback', () => {
  it('confirms how many leads started', () => {
    expect(enrichPhoneFeedback({ started: [1, 2], skipped: [], errors: [] })).toEqual({
      kind: 'success',
      message: 'Finding phones for 2 leads',
    })
  })

  it('uses singular for one lead', () => {
    expect(enrichPhoneFeedback({ started: [1], skipped: [], errors: [] }).message).toBe(
      'Finding phone for 1 lead'
    )
  })

  it('explains skipped leads, grouped by reason', () => {
    const feedback = enrichPhoneFeedback({
      started: [1],
      skipped: [
        { leadId: 2, reason: 'already_has_phone' },
        { leadId: 3, reason: 'already_has_phone' },
        { leadId: 4, reason: 'already_running' },
        { leadId: 5, reason: 'not_found' },
        { leadId: 6, reason: 'cooldown' },
      ],
      errors: [],
    })

    expect(feedback).toEqual({
      kind: 'success',
      message:
        'Finding phone for 1 lead. Skipped 5: 2 already have a phone, 1 already in progress, 1 tried recently, 1 not found',
    })
  })

  it('is info (not success) when nothing could be started', () => {
    expect(
      enrichPhoneFeedback({ started: [], skipped: [{ leadId: 2, reason: 'already_has_phone' }], errors: [] })
    ).toEqual({ kind: 'info', message: 'Nothing to enrich. Skipped 1: 1 already has a phone' })
  })

  it('mentions leads that failed to start', () => {
    expect(
      enrichPhoneFeedback({
        started: [1],
        skipped: [],
        errors: [{ leadId: 2 }],
      })
    ).toEqual({ kind: 'success', message: 'Finding phone for 1 lead. Could not start 1' })
  })

  it('is an error when every lead failed to start', () => {
    expect(
      enrichPhoneFeedback({
        started: [],
        skipped: [],
        errors: [{ leadId: 2 }],
      })
    ).toEqual({ kind: 'error', message: 'Could not start phone enrichment for 1 lead' })
  })
})
