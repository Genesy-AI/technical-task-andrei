import { ApplicationFailure } from '@temporalio/activity'
import type { PhoneProviderPort } from '../domain/ports'
import type { LeadForEnrichment } from '../domain/types'
import { postJson } from './http'
import { FindPhoneOptions, ProviderConfig } from './shared'

type NimbusResponse = { phoneNmbr?: unknown; number?: unknown; countryCode?: unknown }

/** Nimbus Lookup: new provider. Needs email and job title (job title is required by the API). */
export class NimbusAdapter implements PhoneProviderPort {
  readonly name = 'NIMBUS' as const

  constructor(private readonly config: ProviderConfig) {}

  canHandle(lead: LeadForEnrichment): boolean {
    return lead.email.trim() !== '' && (lead.jobTitle ?? '').trim() !== ''
  }

  async findPhone(lead: LeadForEnrichment, options: FindPhoneOptions = {}): Promise<string | null> {
    const url = new URL(this.config.baseUrl)
    url.searchParams.set('api', this.config.apiKey)

    const body = (await postJson({
      url: url.toString(),
      body: { email: lead.email.trim(), jobTitle: (lead.jobTitle ?? '').trim() },
      fetchFn: this.config.fetchFn,
      signal: options.signal,
    })) as NimbusResponse

    // Real API returns `phoneNmbr`; the docs say `number`. Accept both.
    const digits = readDigits(body.phoneNmbr ?? body.number)
    if (digits === null) return null

    const countryCode = typeof body.countryCode === 'string' ? body.countryCode.trim().toUpperCase() : ''
    return countryCode ? `${countryCode} ${digits}` : digits
  }
}

function readDigits(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value)
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return value.trim()
  throw ApplicationFailure.nonRetryable(
    `Unexpected phone value: ${JSON.stringify(value)}`,
    'ProviderBadResponse'
  )
}
