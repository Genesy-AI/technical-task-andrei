import { describe, it, expect } from 'vitest'
import { MAX_LEADS_PER_REQUEST, parseEnrichPhoneRequest } from './parseEnrichPhoneRequest'

const INVALID = { ok: false, error: 'leadIds must be a non-empty array of lead ids' }

describe('parseEnrichPhoneRequest', () => {
  it('accepts positive integer ids, as numbers or digit strings', () => {
    expect(parseEnrichPhoneRequest({ leadIds: [1, '2', 3] })).toEqual({ ok: true, leadIds: [1, 2, 3] })
  })

  it('removes duplicate ids', () => {
    expect(parseEnrichPhoneRequest({ leadIds: [1, 1, '1', 2] })).toEqual({ ok: true, leadIds: [1, 2] })
  })

  it.each([
    ['missing body', undefined],
    ['no leadIds', {}],
    ['not an array', { leadIds: '1' }],
    ['empty array', { leadIds: [] }],
    ['zero', { leadIds: [0] }],
    ['negative', { leadIds: [-1] }],
    ['float', { leadIds: [1.5] }],
    ['null', { leadIds: [null] }],
    ['boolean', { leadIds: [true] }],
    ['empty string', { leadIds: [''] }],
    ['non-digit string', { leadIds: ['1 OR 1=1'] }],
    ['leading zero string', { leadIds: ['01'] }],
  ])('rejects %s', (_label, body) => {
    expect(parseEnrichPhoneRequest(body)).toEqual(INVALID)
  })

  it.each([
    ['1e308', 1e308],
    ['above the DB integer range', 2147483648],
    ['digit string above the DB integer range', '99999999999999999999'],
  ])('rejects ids that cannot exist: %s', (_label, id) => {
    expect(parseEnrichPhoneRequest({ leadIds: [id] })).toEqual(INVALID)
  })

  it('accepts the largest DB integer id', () => {
    expect(parseEnrichPhoneRequest({ leadIds: [2147483647] })).toEqual({ ok: true, leadIds: [2147483647] })
  })

  it(`accepts up to ${MAX_LEADS_PER_REQUEST} leads`, () => {
    const ids = Array.from({ length: MAX_LEADS_PER_REQUEST }, (_, i) => i + 1)
    expect(parseEnrichPhoneRequest({ leadIds: ids })).toEqual({ ok: true, leadIds: ids })
  })

  it(`rejects more than ${MAX_LEADS_PER_REQUEST} leads`, () => {
    const ids = Array.from({ length: MAX_LEADS_PER_REQUEST + 1 }, (_, i) => i + 1)
    expect(parseEnrichPhoneRequest({ leadIds: ids })).toEqual({
      ok: false,
      error: `You can enrich at most ${MAX_LEADS_PER_REQUEST} leads at a time`,
    })
  })

  it('counts unique ids against the limit', () => {
    const ids = [...Array.from({ length: MAX_LEADS_PER_REQUEST }, (_, i) => i + 1), 1, 2]
    expect(parseEnrichPhoneRequest({ leadIds: ids }).ok).toBe(true)
  })
})
