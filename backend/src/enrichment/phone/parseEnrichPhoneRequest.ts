/** Caps cost and load per request: each lead can mean up to 9 paid provider calls. */
export const MAX_LEADS_PER_REQUEST = 100

// lead.id is a Prisma Int (32-bit signed); larger ids cannot exist and would make Prisma throw.
const MAX_LEAD_ID = 2_147_483_647

export type ParsedEnrichPhoneRequest = { ok: true; leadIds: number[] } | { ok: false; error: string }

const INVALID = 'leadIds must be a non-empty array of lead ids'

function toLeadId(value: unknown): number | null {
  const id =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && /^[1-9]\d*$/.test(value)
        ? Number(value)
        : NaN
  return Number.isInteger(id) && id > 0 && id <= MAX_LEAD_ID ? id : null
}

/** Validates the POST /leads/enrich-phone body. Returns unique ids or a user-facing error. */
export function parseEnrichPhoneRequest(body: unknown): ParsedEnrichPhoneRequest {
  const leadIds = (body as { leadIds?: unknown } | undefined)?.leadIds
  if (!Array.isArray(leadIds) || leadIds.length === 0) return { ok: false, error: INVALID }

  const ids = leadIds.map(toLeadId)
  if (ids.some((id) => id === null)) return { ok: false, error: INVALID }

  const unique = [...new Set(ids as number[])]
  if (unique.length > MAX_LEADS_PER_REQUEST) {
    return { ok: false, error: `You can enrich at most ${MAX_LEADS_PER_REQUEST} leads at a time` }
  }
  return { ok: true, leadIds: unique }
}
