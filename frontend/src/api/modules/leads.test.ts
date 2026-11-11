import { afterEach, describe, expect, it, vi } from 'vitest'
import { axiosInstance } from '../../utils/axios'
import { leadsApi, VERIFY_EMAILS_TIMEOUT_MS } from './leads'

describe('leadsApi.verifyEmails', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('gives up after 60 seconds instead of waiting forever', async () => {
    const request = vi.spyOn(axiosInstance, 'request').mockResolvedValue({ data: { success: true } })

    await leadsApi.verifyEmails({ leadIds: [1, 2] })

    expect(VERIFY_EMAILS_TIMEOUT_MS).toBe(60_000)
    expect(request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'post',
        url: '/leads/verify-emails',
        data: { leadIds: [1, 2] },
        timeout: VERIFY_EMAILS_TIMEOUT_MS,
      })
    )
  })

  it('leaves other endpoints on the default (no) timeout', async () => {
    const request = vi.spyOn(axiosInstance, 'request').mockResolvedValue({ data: {} })

    await leadsApi.deleteMany({ ids: [1] })

    expect(request.mock.calls[0][0]).not.toHaveProperty('timeout')
  })
})
