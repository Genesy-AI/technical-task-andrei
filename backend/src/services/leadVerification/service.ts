import { mapWithConcurrency } from '../../utils/mapWithConcurrency'
import type { EmailVerifier, LeadToVerify, LeadVerificationRepository, Logger } from './ports'

/** How many leads one request verifies at the same time. */
export const VERIFY_EMAIL_CONCURRENCY = 5

/**
 * The only error texts that leave the server. Internal details (Temporal failures,
 * database errors, stack traces) go to the logger, never to the response.
 */
export const VERIFY_ERROR_MESSAGES = {
  verifyFailed: 'Email verification could not be completed',
  saveFailed: 'Email verification result could not be saved',
} as const

export type LeadVerificationServiceDeps = {
  verifier: EmailVerifier
  repository: LeadVerificationRepository
  logger?: Logger
  concurrency?: number
}

export type VerifyLeadsResult = {
  success: true
  verifiedCount: number
  results: Array<{ leadId: number; emailVerified: boolean }>
  errors: Array<{ leadId: number; leadName: string; error: string }>
}

export type LeadVerificationService = {
  verifyLeads(leads: readonly LeadToVerify[]): Promise<VerifyLeadsResult>
}

type Outcome =
  | { ok: true; leadId: number; emailVerified: boolean }
  | { ok: false; leadId: number; leadName: string; error: string }

export function createLeadVerificationService({
  verifier,
  repository,
  logger = console,
  concurrency = VERIFY_EMAIL_CONCURRENCY,
}: LeadVerificationServiceDeps): LeadVerificationService {
  async function verifyLead(lead: LeadToVerify): Promise<Outcome> {
    const fail = (stage: keyof typeof VERIFY_ERROR_MESSAGES, error: unknown): Outcome => {
      logger.error(`[verify-emails] ${stage} for lead ${lead.id}`, error)
      return {
        ok: false,
        leadId: lead.id,
        leadName: `${lead.firstName} ${lead.lastName}`.trim(),
        error: VERIFY_ERROR_MESSAGES[stage],
      }
    }

    let emailVerified: boolean
    try {
      emailVerified = Boolean(await verifier.verify(lead))
    } catch (error) {
      return fail('verifyFailed', error)
    }

    try {
      await repository.saveEmailVerified(lead.id, emailVerified)
    } catch (error) {
      return fail('saveFailed', error)
    }

    return { ok: true, leadId: lead.id, emailVerified }
  }

  return {
    async verifyLeads(leads) {
      const outcomes = await mapWithConcurrency(leads, concurrency, verifyLead)

      const results: VerifyLeadsResult['results'] = []
      const errors: VerifyLeadsResult['errors'] = []
      for (const outcome of outcomes) {
        if (outcome.ok) results.push({ leadId: outcome.leadId, emailVerified: outcome.emailVerified })
        else errors.push({ leadId: outcome.leadId, leadName: outcome.leadName, error: outcome.error })
      }

      return { success: true, verifiedCount: results.length, results, errors }
    },
  }
}
