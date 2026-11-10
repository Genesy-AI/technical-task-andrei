import { describe, it, expect, vi } from 'vitest'
import { ApplicationFailure } from '@temporalio/activity'
import { MockActivityEnvironment } from '@temporalio/testing'
import { temporalTestLogger } from '../../test/temporalTestLogger'
import { createPhoneActivities } from './activities'
import type { LeadRepositoryPort, PhoneProviderPort } from './domain/ports'
import type { LeadForEnrichment, ProviderName } from './domain/types'

const lead: LeadForEnrichment = {
  id: 7,
  firstName: 'Ada',
  lastName: 'Lovelace',
  email: 'ada@acme.com',
  jobTitle: 'CTO',
}

function fakeProvider(name: ProviderName, overrides: Partial<PhoneProviderPort> = {}): PhoneProviderPort {
  return {
    name,
    canHandle: vi.fn().mockReturnValue(true),
    findPhone: vi.fn().mockResolvedValue(null),
    ...overrides,
  }
}

function fakeRepo(): LeadRepositoryPort {
  return {
    getForEnrichment: vi.fn().mockResolvedValue(lead),
    markProgress: vi.fn().mockResolvedValue(undefined),
    saveResult: vi.fn().mockResolvedValue(undefined),
  }
}

function setup(providers: PhoneProviderPort[] = [fakeProvider('ORION')]) {
  const leadRepo = fakeRepo()
  const activities = createPhoneActivities({ providers, leadRepo })
  const env = new MockActivityEnvironment(undefined, { logger: temporalTestLogger() })
  // Typed wrapper: env.run widens literal args ('ORION' -> string), which breaks tsc.
  const run = <F extends (...args: any[]) => Promise<any>>(fn: F, ...args: Parameters<F>) =>
    env.run(fn, ...args) as ReturnType<F>
  return { activities, leadRepo, env, run }
}

describe('phone activities', () => {
  describe('loadLead', () => {
    it('returns the lead from the repository', async () => {
      const { activities, leadRepo, run } = setup()

      await expect(run(activities.loadLead, 7)).resolves.toEqual(lead)
      expect(leadRepo.getForEnrichment).toHaveBeenCalledWith(7)
    })

    it('returns null when the lead is gone', async () => {
      const { activities, leadRepo, run } = setup()
      vi.mocked(leadRepo.getForEnrichment).mockResolvedValue(null)

      await expect(run(activities.loadLead, 7)).resolves.toBeNull()
    })
  })

  describe('markProgress', () => {
    it('marks the lead as running with the given provider', async () => {
      const { activities, leadRepo, run } = setup()

      await run(activities.markProgress, 7, 'ASTRA')

      expect(leadRepo.markProgress).toHaveBeenCalledWith(7, 'ASTRA')
    })
  })

  describe('findPhoneWith', () => {
    it('returns found with the phone', async () => {
      const orion = fakeProvider('ORION', { findPhone: vi.fn().mockResolvedValue('8221471051') })
      const { activities, run } = setup([orion])

      await expect(run(activities.findPhoneWith, 'ORION', lead)).resolves.toEqual({
        kind: 'found',
        phone: '8221471051',
      })
    })

    it('returns none when the provider has no phone', async () => {
      const { activities, run } = setup([fakeProvider('ORION')])

      await expect(run(activities.findPhoneWith, 'ORION', lead)).resolves.toEqual({ kind: 'none' })
    })

    it('returns skipped without calling the provider when it cannot handle the lead', async () => {
      const orion = fakeProvider('ORION', { canHandle: vi.fn().mockReturnValue(false) })
      const { activities, run } = setup([orion])

      await expect(run(activities.findPhoneWith, 'ORION', lead)).resolves.toEqual({ kind: 'skipped' })
      expect(orion.findPhone).not.toHaveBeenCalled()
    })

    it('uses the provider with the given name', async () => {
      const orion = fakeProvider('ORION')
      const astra = fakeProvider('ASTRA', { findPhone: vi.fn().mockResolvedValue('8391612328') })
      const { activities, run } = setup([orion, astra])

      await expect(run(activities.findPhoneWith, 'ASTRA', lead)).resolves.toEqual({
        kind: 'found',
        phone: '8391612328',
      })
      expect(orion.findPhone).not.toHaveBeenCalled()
    })

    it('passes the activity cancellation signal to the provider', async () => {
      const orion = fakeProvider('ORION')
      const { activities, env, run } = setup([orion])

      await run(activities.findPhoneWith, 'ORION', lead)

      const options = vi.mocked(orion.findPhone).mock.calls[0][1]
      expect(options?.signal).toBe(env.context.cancellationSignal)
    })

    it('rethrows provider errors unchanged so Temporal applies the retry policy', async () => {
      const failure = ApplicationFailure.nonRetryable('HTTP 401: Unauthorized', 'ProviderClientError')
      const orion = fakeProvider('ORION', { findPhone: vi.fn().mockRejectedValue(failure) })
      const { activities, run } = setup([orion])

      await expect(run(activities.findPhoneWith, 'ORION', lead)).rejects.toBe(failure)
    })

    it('throws a non-retryable failure for an unknown provider', async () => {
      const { activities, run } = setup([fakeProvider('ORION')])

      await expect(run(activities.findPhoneWith, 'NIMBUS', lead)).rejects.toMatchObject({
        type: 'UnknownProvider',
        nonRetryable: true,
      })
    })
  })

  describe('saveResult', () => {
    it('saves FOUND with phone and source', async () => {
      const { activities, leadRepo, run } = setup()

      await run(activities.saveResult, 7, { status: 'FOUND', phone: 'ES 4088282927', source: 'NIMBUS' })

      expect(leadRepo.saveResult).toHaveBeenCalledWith(7, {
        status: 'FOUND',
        phone: 'ES 4088282927',
        source: 'NIMBUS',
      })
    })

    it('saves NO_DATA', async () => {
      const { activities, leadRepo, run } = setup()

      await run(activities.saveResult, 7, { status: 'NO_DATA' })

      expect(leadRepo.saveResult).toHaveBeenCalledWith(7, { status: 'NO_DATA' })
    })

    it('saves FAILED with a user-safe message, never the internal error details', async () => {
      const { activities, leadRepo, run } = setup()

      await run(activities.saveResult, 7, { status: 'FAILED', error: 'ORION: HTTP 401: Unauthorized' })

      expect(leadRepo.saveResult).toHaveBeenCalledWith(7, {
        status: 'FAILED',
        error: 'Phone lookup failed. Please try again later.',
      })
    })
  })
})
