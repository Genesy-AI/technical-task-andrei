/**
 * What the lead verification service needs from the outside world. The service only
 * depends on these interfaces; the real implementations live in `./adapters`.
 */

export type LeadToVerify = {
  id: number
  firstName: string
  lastName: string
  email: string
}

/** Decides whether a lead's email is valid. Throws if no answer could be obtained. */
export interface EmailVerifier {
  verify(lead: LeadToVerify): Promise<boolean>
}

/** Stores the outcome of a verification. */
export interface LeadVerificationRepository {
  saveEmailVerified(leadId: number, emailVerified: boolean): Promise<void>
}

/** Where internal error details go. They are never sent to the client. */
export interface Logger {
  error(message: string, error: unknown): void
}
