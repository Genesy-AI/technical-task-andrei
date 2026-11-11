import { describe, it, expect, vi } from 'vitest'
import { ENRICHMENT_COOLDOWN_MS, startPhoneEnrichment } from './startPhoneEnrichment'
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
    isRunning: vi.fn(async () => true),
  }
  const log = vi.fn()
  return { leads, workflows, calls, log, deps: { leads, workflows, log } }
}

const fresh = (id: number): LeadStartInfo => ({ id, phoneNumber: null, status: null, requestedAt: null })

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
    const { deps, workflows } = setup([{ id: 1, phoneNumber: '+1 555', status: null, requestedAt: null }])

    const result = await startPhoneEnrichment([1], deps)

    expect(result.skipped).toEqual([{ leadId: 1, reason: 'already_has_phone' }])
    expect(workflows.start).not.toHaveBeenCalled()
  })

  it('treats a blank phone as no phone', async () => {
    const { deps } = setup([{ id: 1, phoneNumber: '  ', status: null, requestedAt: null }])

    const result = await startPhoneEnrichment([1], deps)

    expect(result.started).toEqual([1])
  })

  it.each(['PENDING', 'RUNNING'] as const)(
    'skips leads already %s (run still open in Temporal) without touching their status',
    async (status) => {
      const { deps, leads, workflows } = setup([{ id: 1, phoneNumber: null, status, requestedAt: null }])

      const result = await startPhoneEnrichment([1], deps)

      expect(result.skipped).toEqual([{ leadId: 1, reason: 'already_running' }])
      expect(leads.markPending).not.toHaveBeenCalled()
      expect(workflows.start).not.toHaveBeenCalled()
    }
  )

  it.each(['PENDING', 'RUNNING'] as const)(
    'restarts leads stuck in %s whose run is gone (terminated, crashed)',
    async (status) => {
      const { deps, workflows, calls } = setup([{ id: 1, phoneNumber: null, status, requestedAt: null }])
      vi.mocked(workflows.isRunning).mockResolvedValue(false)

      const result = await startPhoneEnrichment([1], deps)

      expect(workflows.isRunning).toHaveBeenCalledWith(1)
      expect(result).toEqual({ started: [1], skipped: [], errors: [] })
      expect(calls).toEqual(['pending 1', 'start 1'])
    }
  )

  it('does not ask Temporal about leads that are not marked as running', async () => {
    const { deps, workflows } = setup([fresh(1)])

    await startPhoneEnrichment([1], deps)

    expect(workflows.isRunning).not.toHaveBeenCalled()
  })

  it('reports an error and leaves the status alone when Temporal cannot be asked', async () => {
    const { deps, workflows, leads, log } = setup([
      { id: 1, phoneNumber: null, status: 'RUNNING', requestedAt: null },
    ])
    const internal = new Error('14 UNAVAILABLE')
    vi.mocked(workflows.isRunning).mockRejectedValue(internal)

    const result = await startPhoneEnrichment([1], deps)

    expect(result).toEqual({ started: [], skipped: [], errors: [{ leadId: 1 }] })
    expect(leads.markPending).not.toHaveBeenCalled()
    expect(leads.saveResult).not.toHaveBeenCalled()
    expect(log).toHaveBeenCalledWith('Failed to check phone enrichment run', { leadId: 1, error: internal })
  })

  describe('cooldown', () => {
    const now = new Date('2026-11-11T12:00:00Z')
    const ago = (ms: number) => new Date(now.getTime() - ms)

    it.each(['NO_DATA', 'FAILED'] as const)(
      'skips a lead that ended %s inside the cooldown',
      async (status) => {
        const { deps, workflows } = setup([
          { id: 1, phoneNumber: null, status, requestedAt: ago(ENRICHMENT_COOLDOWN_MS[status]! - 1000) },
        ])

        const result = await startPhoneEnrichment([1], { ...deps, now: () => now })

        expect(result.skipped).toEqual([{ leadId: 1, reason: 'cooldown' }])
        expect(workflows.start).not.toHaveBeenCalled()
      }
    )

    it.each(['NO_DATA', 'FAILED'] as const)(
      're-runs a lead that ended %s once the cooldown is over',
      async (status) => {
        const { deps } = setup([
          { id: 1, phoneNumber: null, status, requestedAt: ago(ENRICHMENT_COOLDOWN_MS[status]! + 1000) },
        ])

        const result = await startPhoneEnrichment([1], { ...deps, now: () => now })

        expect(result.started).toEqual([1])
      }
    )

    it('waits much longer after NO_DATA than after FAILED', () => {
      expect(ENRICHMENT_COOLDOWN_MS.NO_DATA!).toBeGreaterThan(ENRICHMENT_COOLDOWN_MS.FAILED!)
    })

    it('stores the request time when marking a lead PENDING', async () => {
      const { deps, leads } = setup([fresh(1)])

      await startPhoneEnrichment([1], { ...deps, now: () => now })

      expect(leads.markPending).toHaveBeenCalledWith(1, now)
    })
  })

  it.each(['NO_DATA', 'FAILED'] as const)('re-runs leads that finished with %s', async (status) => {
    const { deps } = setup([{ id: 1, phoneNumber: null, status, requestedAt: null }])

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
