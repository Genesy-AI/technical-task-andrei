import type { PrismaClient } from '@prisma/client'
import type { LeadVerificationRepository } from '../ports'

/** The part of the Prisma client this adapter uses. */
export type LeadUpdater = Pick<PrismaClient, 'lead'>

export function createPrismaLeadVerificationRepository(prisma: LeadUpdater): LeadVerificationRepository {
  return {
    async saveEmailVerified(leadId, emailVerified) {
      await prisma.lead.update({ where: { id: leadId }, data: { emailVerified } })
    },
  }
}
