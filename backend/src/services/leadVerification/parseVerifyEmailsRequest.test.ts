import { describe, it, expect } from 'vitest'
import { MAX_LEADS_PER_REQUEST, parseVerifyEmailsRequest } from './parseVerifyEmailsRequest'

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1)

describe('parseVerifyEmailsRequest', () => {
  it('accepts positive integer ids and numeric strings', () => {
    expect(parseVerifyEmailsRequest({ leadIds: [1, '2', 3] })).toEqual({ ok: true, leadIds: [1, 2, 3] })
  })

  it('removes duplicate ids', () => {
    expect(parseVerifyEmailsRequest({ leadIds: [5, 5, '5', 6] })).toEqual({ ok: true, leadIds: [5, 6] })
  })

  it.each([
    ['missing body', undefined],
    ['missing leadIds', {}],
    ['not an array', { leadIds: 5 }],
    ['empty array', { leadIds: [] }],
  ])('rejects %s', (_, body) => {
    expect(parseVerifyEmailsRequest(body)).toEqual({ ok: false, error: expect.any(String) })
  })

  it.each([['abc'], [0], [-1], [1.5], [null], [{}], ['01'], [2_147_483_648], [Number.NaN]])(
    'rejects the whole request when one id is %s',
    (bad) => {
      expect(parseVerifyEmailsRequest({ leadIds: [1, bad] }).ok).toBe(false)
    }
  )

  it(`allows up to ${MAX_LEADS_PER_REQUEST} unique ids`, () => {
    const result = parseVerifyEmailsRequest({ leadIds: range(MAX_LEADS_PER_REQUEST) })
    expect(result.ok && result.leadIds).toHaveLength(MAX_LEADS_PER_REQUEST)
  })

  it(`rejects more than ${MAX_LEADS_PER_REQUEST} unique ids with a clear message`, () => {
    expect(parseVerifyEmailsRequest({ leadIds: range(MAX_LEADS_PER_REQUEST + 1) })).toEqual({
      ok: false,
      error: `You can verify at most ${MAX_LEADS_PER_REQUEST} emails at a time`,
    })
  })

  it('counts the cap after removing duplicates', () => {
    const ids = [...range(MAX_LEADS_PER_REQUEST), ...range(MAX_LEADS_PER_REQUEST)]
    expect(parseVerifyEmailsRequest({ leadIds: ids }).ok).toBe(true)
  })
})
