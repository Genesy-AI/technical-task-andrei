import { USER_MESSAGES } from './domain/messages'
import type { EnrichmentStartRepositoryPort, LeadStartInfo, PhoneWorkflowStarterPort } from './domain/ports'
import type { EnrichmentStatus } from './domain/types'

export type SkipReason = 'not_found' | 'already_has_phone' | 'already_running' | 'cooldown'

const MINUTE = 60_000

/**
 * How long a lead must wait before it can be looked up again. Each run can cost up to
 * 9 paid provider calls, so repeat clicks must not re-run leads we just tried.
 * - NO_DATA: providers answered with nothing; asking again soon gives the same answer.
 * - FAILED: providers or Temporal were down; short, so a retry after an outage still works.
 */
export const ENRICHMENT_COOLDOWN_MS: Partial<Record<EnrichmentStatus, number>> = {
  NO_DATA: 24 * 60 * MINUTE,
  FAILED: 5 * MINUTE,
}

function inCooldown(info: LeadStartInfo, now: Date): boolean {
  const cooldown = info.status ? ENRICHMENT_COOLDOWN_MS[info.status] : undefined
  if (!cooldown || !info.requestedAt) return false
  return now.getTime() - info.requestedAt.getTime() < cooldown
}

export type StartPhoneEnrichmentResult = {
  started: number[]
  skipped: { leadId: number; reason: SkipReason }[]
  /** Only ids: error details are logged server-side, never returned to the client. */
  errors: { leadId: number }[]
}

/**
 * Starts phone enrichment for the given leads without waiting for results.
 * Skips leads that are missing, already have a phone, were tried recently (cooldown),
 * or have a run that is still open
 * (the fixed workflow id dedupes in Temporal too; this check also keeps their status intact).
 * Leads marked PENDING/RUNNING whose run is gone are started again.
 */
export async function startPhoneEnrichment(
  leadIds: number[],
  deps: {
    leads: EnrichmentStartRepositoryPort
    workflows: PhoneWorkflowStarterPort
    log?: (message: string, meta: { leadId: number; error: unknown }) => void
    now?: () => Date
  }
): Promise<StartPhoneEnrichmentResult> {
  const log = deps.log ?? console.error
  const now = (deps.now ?? (() => new Date()))()
  const ids = [...new Set(leadIds)]
  const infoById = new Map((await deps.leads.getStartInfo(ids)).map((info) => [info.id, info]))
  const result: StartPhoneEnrichmentResult = { started: [], skipped: [], errors: [] }

  // The DB status can be stale if a run died without saving (terminated by hand, crashed).
  // Temporal knows whether the run is really open; if it is not, the lead may be started again.
  const runState = async (leadId: number): Promise<'running' | 'gone' | 'unknown'> => {
    try {
      return (await deps.workflows.isRunning(leadId)) ? 'running' : 'gone'
    } catch (error) {
      log('Failed to check phone enrichment run', { leadId, error })
      return 'unknown'
    }
  }

  const startOne = async (leadId: number): Promise<void> => {
    await deps.leads.markPending(leadId, now)
    try {
      await deps.workflows.start(leadId)
      result.started.push(leadId)
    } catch (error) {
      log('Failed to start phone enrichment', { leadId, error })
      // Don't leave the lead stuck in PENDING (the UI would poll forever).
      await deps.leads.saveResult(leadId, { status: 'FAILED', error: USER_MESSAGES.startFailed })
      result.errors.push({ leadId })
    }
  }

  for (const leadId of ids) {
    const info = infoById.get(leadId)
    if (!info) {
      result.skipped.push({ leadId, reason: 'not_found' })
    } else if (info.phoneNumber?.trim()) {
      result.skipped.push({ leadId, reason: 'already_has_phone' })
    } else if (inCooldown(info, now)) {
      result.skipped.push({ leadId, reason: 'cooldown' })
    } else if (info.status === 'PENDING' || info.status === 'RUNNING') {
      const state = await runState(leadId)
      if (state === 'running') result.skipped.push({ leadId, reason: 'already_running' })
      else if (state === 'unknown') result.errors.push({ leadId })
      else await startOne(leadId)
    } else {
      await startOne(leadId)
    }
  }

  return result
}
