import { describe, expect, it } from 'vitest'
import { AxiosError } from 'axios'
import {
  getVerifyEmailsErrorFeedback,
  getVerifyEmailsFeedback,
  getVerifyEmailsLimitMessage,
  getVerifyEmailsPendingMessage,
} from './verifyEmailsFeedback'
import { LeadsVerifyEmailsOutput } from '../api/types/leads/verifyEmails'

const output = (
  results: LeadsVerifyEmailsOutput['results'],
  failedNames: string[] = []
): LeadsVerifyEmailsOutput => ({
  success: true,
  verifiedCount: results.length,
  results,
  errors: failedNames.map((leadName, i) => ({
    leadId: 100 + i,
    leadName,
    error: 'activity StartToClose timeout',
  })),
})

describe('getVerifyEmailsFeedback', () => {
  it('reports success when every lead was verified', () => {
    expect(getVerifyEmailsFeedback(output([{ leadId: 1, emailVerified: true }]))).toEqual({
      type: 'success',
      message: 'Verified 1 email',
    })
    expect(
      getVerifyEmailsFeedback(
        output([
          { leadId: 1, emailVerified: true },
          { leadId: 2, emailVerified: false },
        ])
      )
    ).toEqual({ type: 'success', message: 'Verified 2 emails' })
  })

  it('reports a partial outcome with the names of the leads that failed', () => {
    expect(getVerifyEmailsFeedback(output([{ leadId: 1, emailVerified: true }], ['Jane Smith']))).toEqual({
      type: 'warning',
      message: 'Verified 1 email. Could not verify 1 email: Jane Smith',
    })
  })

  it('reports an error when no lead could be verified', () => {
    expect(getVerifyEmailsFeedback(output([], ['Jane Smith', 'Tom Hill']))).toEqual({
      type: 'error',
      message: 'Could not verify 2 emails: Jane Smith, Tom Hill',
    })
  })

  it('caps the list of failed names', () => {
    const names = ['A One', 'B Two', 'C Three', 'D Four', 'E Five']
    expect(getVerifyEmailsFeedback(output([], names)).message).toBe(
      'Could not verify 5 emails: A One, B Two, C Three and 2 more'
    )
  })
})

describe('getVerifyEmailsErrorFeedback', () => {
  it('explains a request timeout and flags it so the list can be refreshed', () => {
    const timeout = new AxiosError('timeout of 60000ms exceeded', AxiosError.ECONNABORTED)
    expect(getVerifyEmailsErrorFeedback(timeout)).toEqual({
      timedOut: true,
      message:
        'Email verification is taking longer than expected and is still running. Refresh in a minute to see the results.',
    })

    const etimedout = new AxiosError('timeout', AxiosError.ETIMEDOUT)
    expect(getVerifyEmailsErrorFeedback(etimedout).timedOut).toBe(true)
  })

  it('falls back to a generic message for other errors', () => {
    expect(getVerifyEmailsErrorFeedback(new AxiosError('Network Error', AxiosError.ERR_NETWORK))).toEqual({
      timedOut: false,
      message: 'Failed to verify emails. Please try again.',
    })
    expect(getVerifyEmailsErrorFeedback(new Error('boom')).timedOut).toBe(false)
  })

  it('shows the backend message for a 400 response', () => {
    const badRequest = new AxiosError(
      'Request failed with status code 400',
      AxiosError.ERR_BAD_REQUEST,
      undefined,
      undefined,
      {
        status: 400,
        statusText: 'Bad Request',
        data: { error: 'You can verify at most 100 emails at a time' },
        headers: {},
        config: {} as never,
      }
    )
    expect(getVerifyEmailsErrorFeedback(badRequest)).toEqual({
      timedOut: false,
      message: 'You can verify at most 100 emails at a time',
    })
  })

  it('does not show server text for other error statuses', () => {
    const serverError = new AxiosError(
      'Request failed with status code 500',
      AxiosError.ERR_BAD_RESPONSE,
      undefined,
      undefined,
      {
        status: 500,
        statusText: 'Internal Server Error',
        data: { error: 'internal detail' },
        headers: {},
        config: {} as never,
      }
    )
    expect(getVerifyEmailsErrorFeedback(serverError).message).toBe(
      'Failed to verify emails. Please try again.'
    )
  })
})

describe('pending and limit messages', () => {
  it('says how many emails are being verified', () => {
    expect(getVerifyEmailsPendingMessage(1)).toBe('Verifying 1 email…')
    expect(getVerifyEmailsPendingMessage(12)).toBe('Verifying 12 emails…')
  })

  it('states the limit', () => {
    expect(getVerifyEmailsLimitMessage(100)).toBe('You can verify at most 100 emails at a time')
  })
})
