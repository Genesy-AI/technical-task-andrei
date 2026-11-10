import { describe, it, expect } from 'vitest'
import { POLL_INTERVAL_MS, enrichPhoneFeedback, leadsPollInterval } from './phoneEnrichment'
import type { LeadsGetManyOutput, PhoneEnrichmentStatus } from '../api/types/leads/getMany'

const withStatuses = (...statuses: (PhoneEnrichmentStatus | null)[]) =>
  statuses.map((phoneEnrichmentStatus, i) => ({ id: i + 1, phoneEnrichmentStatus })) as LeadsGetManyOutput

describe('leadsPollInterval', () => {
  it.each(['PENDING', 'RUNNING'] as const)('polls every 2s while a lead is %s', (status) => {
    expect(leadsPollInterval(withStatuses('FOUND', status, null))).toBe(POLL_INTERVAL_MS)
    expect(POLL_INTERVAL_MS).toBe(2000)
  })

  it('stops polling when every lead is finished or never enriched', () => {
    expect(leadsPollInterval(withStatuses('FOUND', 'NO_DATA', 'FAILED', null))).toBe(false)
  })

  it('does not poll before leads are loaded', () => {
    expect(leadsPollInterval(undefined)).toBe(false)
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
      ],
      errors: [],
    })

    expect(feedback).toEqual({
      kind: 'success',
      message:
        'Finding phone for 1 lead. Skipped 4: 2 already have a phone, 1 already in progress, 1 not found',
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
