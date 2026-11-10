import type { PrismaClient } from '@prisma/client'
import type { EnrichmentResultUpdate, LeadRepositoryPort } from '../domain/ports'
import type { LeadForEnrichment, ProviderName } from '../domain/types'

/**
 * Lead storage for phone enrichment, backed by Prisma.
 * Writes use updateMany so a lead deleted mid-workflow is a no-op instead of an error
 * (an error would make Temporal retry an update that can never succeed).
 */
export class PrismaLeadRepository implements LeadRepositoryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async getForEnrichment(leadId: number): Promise<LeadForEnrichment | null> {
    return this.prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, firstName: true, lastName: true, email: true, jobTitle: true },
    })
  }

  async markProgress(leadId: number, provider: ProviderName): Promise<void> {
    await this.prisma.lead.updateMany({
      where: { id: leadId },
      data: {
        phoneEnrichmentStatus: 'RUNNING',
        phoneEnrichmentProvider: provider,
        phoneEnrichmentError: null,
      },
    })
  }

  async saveResult(leadId: number, result: EnrichmentResultUpdate): Promise<void> {
    await this.prisma.lead.updateMany({
      where: { id: leadId },
      data: {
        phoneEnrichmentStatus: result.status,
        phoneEnrichmentProvider: null,
        phoneEnrichmentError: result.error ?? null,
        // Only touch the phone when we found one; never wipe an existing number.
        ...(result.status === 'FOUND' && { phoneNumber: result.phone, phoneSource: result.source }),
      },
    })
  }
}
