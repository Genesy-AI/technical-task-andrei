import { describe, it, expect, vi } from 'vitest'
import { startPhoneEnrichment } from './startPhoneEnrichment'
import type { EnrichmentStartRepositoryPort, LeadStartInfo, PhoneWorkflowStarterPort } from './domain/ports'

function setup(leadsInDb: LeadStartInfo[]) {
  const calls: string[] = []
  const leads: EnrichmentStartRepositoryPort = {
    getStartInfo: vi.fn(async (ids: number[]) => leadsInDb.filter((l) => ids.includes(l.id))),
    markPending: vi.fn(async (id: number) => {
      calls.push(`pending ${id}`)
    }),
    saveResult: vi.fn(async () => undefined),
  }
  const workflows: PhoneWorkflowStarterPort = {
    start: vi.fn(async (id: number) => {
      calls.push(`start ${id}`)
    }),
  }
  const log = vi.fn()
  return { leads, workflows, calls, log, deps: { leads, workflows, log } }
}

const fresh = (id: number): LeadStartInfo => ({ id, phoneNumber: null, status: null })

describe('startPhoneEnrichment', () => {
  it('marks each lead PENDING and then starts its workflow', async () => {
    const { deps, calls } = setup([fresh(1), fresh(2)])

    const result = await startPhoneEnrichment([1, 2], deps)

    expect(result).toEqual({ started: [1, 2], skipped: [], errors: [] })
    expect(calls).toEqual(['pending 1', 'start 1', 'pending 2', 'start 2'])
  })

  it('ignores duplicate ids', async () => {
    const { deps, workflows } = setup([fresh(1)])

    const result = await startPhoneEnrichment([1, 1], deps)

    expect(result.started).toEqual([1])
    expect(workflows.start).toHaveBeenCalledTimes(1)
  })

  it('skips leads that do not exist', async () => {
    const { deps } = setup([fresh(1)])

    const result = await startPhoneEnrichment([1, 99], deps)

    expect(result).toEqual({ started: [1], skipped: [{ leadId: 99, reason: 'not_found' }], errors: [] })
  })

  it('skips leads that already have a phone', async () => {
    const { deps, workflows } = setup([{ id: 1, phoneNumber: '+1 555', status: null }])

    const result = await startPhoneEnrichment([1], deps)

    expect(result.skipped).toEqual([{ leadId: 1, reason: 'already_has_phone' }])
    expect(workflows.start).not.toHaveBeenCalled()
  })

  it('treats a blank phone as no phone', async () => {
    const { deps } = setup([{ id: 1, phoneNumber: '  ', status: null }])

    const result = await startPhoneEnrichment([1], deps)

    expect(result.started).toEqual([1])
  })

  it.each(['PENDING', 'RUNNING'] as const)(
    'skips leads already %s without touching their status',
    async (status) => {
      const { deps, leads, workflows } = setup([{ id: 1, phoneNumber: null, status }])

      const result = await startPhoneEnrichment([1], deps)

      expect(result.skipped).toEqual([{ leadId: 1, reason: 'already_running' }])
      expect(leads.markPending).not.toHaveBeenCalled()
      expect(workflows.start).not.toHaveBeenCalled()
    }
  )

  it.each(['NO_DATA', 'FAILED'] as const)('re-runs leads that finished with %s', async (status) => {
    const { deps } = setup([{ id: 1, phoneNumber: null, status }])

    const result = await startPhoneEnrichment([1], deps)

    expect(result.started).toEqual([1])
  })

  it('marks the lead FAILED and reports it when the workflow cannot be started', async () => {
    const { deps, workflows, leads } = setup([fresh(1), fresh(2)])
    vi.mocked(workflows.start).mockRejectedValueOnce(
      new Error('14 UNAVAILABLE: connect ECONNREFUSED 127.0.0.1:7233')
    )

    const result = await startPhoneEnrichment([1, 2], deps)

    expect(result).toEqual({ started: [2], skipped: [], errors: [{ leadId: 1 }] })
    expect(leads.saveResult).toHaveBeenCalledWith(1, {
      status: 'FAILED',
      error: 'Could not start phone lookup. Please try again.',
    })
  })

  it('keeps internal error details out of the result and the lead, and logs them server-side', async () => {
    const { deps, workflows, leads, log } = setup([fresh(1)])
    const internal = new Error('14 UNAVAILABLE: connect ECONNREFUSED 127.0.0.1:7233')
    vi.mocked(workflows.start).mockRejectedValueOnce(internal)

    const result = await startPhoneEnrichment([1], deps)

    expect(JSON.stringify(result)).not.toContain('UNAVAILABLE')
    expect(JSON.stringify(vi.mocked(leads.saveResult).mock.calls)).not.toContain('UNAVAILABLE')
    expect(log).toHaveBeenCalledWith('Failed to start phone enrichment', { leadId: 1, error: internal })
  })
})
