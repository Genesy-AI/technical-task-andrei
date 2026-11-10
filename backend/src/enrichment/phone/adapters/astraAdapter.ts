import type { PhoneProviderPort } from '../domain/ports'
import type { LeadForEnrichment } from '../domain/types'
import { postJson } from './http'
import { FindPhoneOptions, ProviderConfig, readPhoneString } from './shared'

/** Astra Dialer: fastest, worst data. Needs only the email. */
export class AstraAdapter implements PhoneProviderPort {
  readonly name = 'ASTRA' as const

  constructor(private readonly config: ProviderConfig) {}

  canHandle(lead: LeadForEnrichment): boolean {
    return lead.email.trim() !== ''
  }

  async findPhone(lead: LeadForEnrichment, options: FindPhoneOptions = {}): Promise<string | null> {
    const body = (await postJson({
      url: this.config.baseUrl,
      headers: { apiKey: this.config.apiKey },
      body: { email: lead.email.trim() },
      fetchFn: this.config.fetchFn,
      signal: options.signal,
    })) as { phoneNmbr?: unknown }

    return readPhoneString(body.phoneNmbr)
  }
}
