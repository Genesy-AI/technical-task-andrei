import { AxiosError } from 'axios'
import { LeadsVerifyEmailsOutput } from '../api/types/leads/verifyEmails'

const MAX_NAMES_SHOWN = 3

export type VerifyEmailsFeedback = {
  type: 'success' | 'warning' | 'error'
  message: string
}

const emails = (count: number) => (count === 1 ? `${count} email` : `${count} emails`)

function listNames(names: string[]): string {
  if (names.length <= MAX_NAMES_SHOWN) return names.join(', ')
  return `${names.slice(0, MAX_NAMES_SHOWN).join(', ')} and ${names.length - MAX_NAMES_SHOWN} more`
}

/** Shown while the request runs, so the user knows something is happening. */
export function getVerifyEmailsPendingMessage(count: number): string {
  return `Verifying ${emails(count)}…`
}

/** Matches the backend limit message, so the user sees the same text either way. */
export function getVerifyEmailsLimitMessage(max: number): string {
  return `You can verify at most ${max} emails at a time`
}

/** Turns the per-lead outcome of a verify request into a single toast. */
export function getVerifyEmailsFeedback(data: LeadsVerifyEmailsOutput): VerifyEmailsFeedback {
  const failed = data.errors ?? []
  const verified = `Verified ${emails(data.verifiedCount)}`

  if (failed.length === 0) return { type: 'success', message: verified }

  const couldNot = `Could not verify ${emails(failed.length)}: ${listNames(failed.map((e) => e.leadName))}`
  if (data.verifiedCount === 0) return { type: 'error', message: couldNot }
  return { type: 'warning', message: `${verified}. ${couldNot}` }
}

/** The request itself failed. A timeout is not a failure of the leads: the backend keeps working. */
export function getVerifyEmailsErrorFeedback(error: unknown): { timedOut: boolean; message: string } {
  const timedOut =
    error instanceof AxiosError &&
    (error.code === AxiosError.ECONNABORTED || error.code === AxiosError.ETIMEDOUT)

  // A 400 from the backend carries a message written for the user (bad ids, too many leads).
  const badRequestMessage =
    error instanceof AxiosError && error.response?.status === 400 ? error.response.data?.error : undefined
  if (!timedOut && typeof badRequestMessage === 'string' && badRequestMessage) {
    return { timedOut, message: badRequestMessage }
  }

  return timedOut
    ? {
        timedOut,
        message:
          'Email verification is taking longer than expected and is still running. Refresh in a minute to see the results.',
      }
    : { timedOut, message: 'Failed to verify emails. Please try again.' }
}
