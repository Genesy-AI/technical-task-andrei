import { getCompanyDomain } from '../domain/emailDomain'
import type { PhoneProviderPort } from '../domain/ports'
import type { LeadForEnrichment } from '../domain/types'
import { postJson } from './http'
import { FindPhoneOptions, ProviderConfig, readPhoneString } from './shared'

/** Orion Connect: best data, slow, fails sometimes. Needs a company website. */
export class OrionAdapter implements PhoneProviderPort {
  readonly name = 'ORION' as const

  constructor(private readonly config: ProviderConfig) {}

  canHandle(lead: LeadForEnrichment): boolean {
    return getCompanyDomain(lead.email) !== null
  }

  async findPhone(lead: LeadForEnrichment, options: FindPhoneOptions = {}): Promise<string | null> {
    const body = (await postJson({
      url: this.config.baseUrl,
      headers: { 'x-auth-me': this.config.apiKey },
      body: {
        fullName: `${lead.firstName} ${lead.lastName}`.trim(),
        companyWebsite: getCompanyDomain(lead.email),
      },
      fetchFn: this.config.fetchFn,
      signal: options.signal,
    })) as { phone?: unknown }

    return readPhoneString(body.phone)
  }
}
