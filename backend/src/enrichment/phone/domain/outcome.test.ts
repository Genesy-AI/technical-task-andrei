import { describe, it, expect } from 'vitest'
import { decideFinalStatus } from './outcome'

describe('decideFinalStatus', () => {
  it('is FOUND with phone and source when a provider found a phone', () => {
    expect(
      decideFinalStatus([
        { provider: 'ORION', kind: 'none' },
        { provider: 'ASTRA', kind: 'found', phone: '8391612328' },
      ])
    ).toEqual({ status: 'FOUND', phone: '8391612328', source: 'ASTRA' })
  })

  it('is FOUND even if earlier providers errored', () => {
    expect(
      decideFinalStatus([
        { provider: 'ORION', kind: 'error', message: 'HTTP 500' },
        { provider: 'ASTRA', kind: 'found', phone: '8391612328' },
      ])
    ).toEqual({ status: 'FOUND', phone: '8391612328', source: 'ASTRA' })
  })

  it('is NO_DATA when every provider answered without a phone', () => {
    expect(
      decideFinalStatus([
        { provider: 'ORION', kind: 'none' },
        { provider: 'ASTRA', kind: 'none' },
        { provider: 'NIMBUS', kind: 'none' },
      ])
    ).toEqual({ status: 'NO_DATA' })
  })

  it('is NO_DATA when at least one provider answered and the others errored or were skipped', () => {
    expect(
      decideFinalStatus([
        { provider: 'ORION', kind: 'skipped' },
        { provider: 'ASTRA', kind: 'none' },
        { provider: 'NIMBUS', kind: 'error', message: 'HTTP 500' },
      ])
    ).toEqual({ status: 'NO_DATA' })
  })

  it('is NO_DATA when every provider was skipped', () => {
    expect(
      decideFinalStatus([
        { provider: 'ORION', kind: 'skipped' },
        { provider: 'NIMBUS', kind: 'skipped' },
      ])
    ).toEqual({ status: 'NO_DATA' })
  })

  it('is NO_DATA when there were no attempts', () => {
    expect(decideFinalStatus([])).toEqual({ status: 'NO_DATA' })
  })

  it('is FAILED with all error messages when every attempted provider errored', () => {
    expect(
      decideFinalStatus([
        { provider: 'ORION', kind: 'error', message: 'HTTP 500' },
        { provider: 'ASTRA', kind: 'skipped' },
        { provider: 'NIMBUS', kind: 'error', message: 'timeout' },
      ])
    ).toEqual({ status: 'FAILED', error: 'ORION: HTTP 500; NIMBUS: timeout' })
  })
})
