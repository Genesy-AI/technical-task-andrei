import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { copyFileSync, mkdtempSync, rmSync } from 'fs'
import os from 'os'
import path from 'path'
import { PrismaLeadRepository } from './prismaLeadRepository'

// Real SQLite: a throwaway copy of the migrated dev DB, emptied before each test.
const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'lead-repo-test-'))
const dbFile = path.join(tmpDir, 'test.db')
copyFileSync(path.join(__dirname, '../../../../prisma/dev.db'), dbFile)
const prisma = new PrismaClient({ datasources: { db: { url: `file:${dbFile}` } } })
const repo = new PrismaLeadRepository(prisma)

function createLead(data: Partial<Parameters<typeof prisma.lead.create>[0]['data']> = {}) {
  return prisma.lead.create({
    data: { firstName: 'Ada', lastName: 'Lovelace', email: 'ada@acme.com', jobTitle: 'CTO', ...data },
  })
}

beforeAll(async () => {
  await prisma.$connect()
})

beforeEach(async () => {
  await prisma.lead.deleteMany()
})

afterAll(async () => {
  await prisma.$disconnect()
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('PrismaLeadRepository', () => {
  describe('getForEnrichment', () => {
    it('returns only the fields providers need', async () => {
      const lead = await createLead()

      await expect(repo.getForEnrichment(lead.id)).resolves.toEqual({
        id: lead.id,
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@acme.com',
        jobTitle: 'CTO',
      })
    })

    it('returns null when the lead does not exist', async () => {
      await expect(repo.getForEnrichment(999_999)).resolves.toBeNull()
    })
  })

  describe('markProgress', () => {
    it('sets status RUNNING and the provider being tried, and clears old errors', async () => {
      const lead = await createLead({ phoneEnrichmentStatus: 'PENDING', phoneEnrichmentError: 'old' })

      await repo.markProgress(lead.id, 'ASTRA')

      const row = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })
      expect(row.phoneEnrichmentStatus).toBe('RUNNING')
      expect(row.phoneEnrichmentProvider).toBe('ASTRA')
      expect(row.phoneEnrichmentError).toBeNull()
    })

    it('does nothing (no throw) when the lead was deleted meanwhile', async () => {
      await expect(repo.markProgress(999_999, 'ORION')).resolves.toBeUndefined()
    })
  })

  describe('saveResult', () => {
    it('on FOUND stores phone, source and status, and clears the current provider', async () => {
      const lead = await createLead({ phoneEnrichmentStatus: 'RUNNING', phoneEnrichmentProvider: 'NIMBUS' })

      await repo.saveResult(lead.id, { status: 'FOUND', phone: 'ES 4088282927', source: 'NIMBUS' })

      const row = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })
      expect(row).toMatchObject({
        phoneNumber: 'ES 4088282927',
        phoneSource: 'NIMBUS',
        phoneEnrichmentStatus: 'FOUND',
        phoneEnrichmentProvider: null,
        phoneEnrichmentError: null,
      })
    })

    it('on NO_DATA keeps any existing phone and clears the current provider', async () => {
      const lead = await createLead({
        phoneNumber: '+1 555',
        phoneSource: null,
        phoneEnrichmentProvider: 'NIMBUS',
      })

      await repo.saveResult(lead.id, { status: 'NO_DATA' })

      const row = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })
      expect(row).toMatchObject({
        phoneNumber: '+1 555',
        phoneEnrichmentStatus: 'NO_DATA',
        phoneEnrichmentProvider: null,
        phoneEnrichmentError: null,
      })
    })

    it('on FAILED stores the error', async () => {
      const lead = await createLead({ phoneEnrichmentProvider: 'NIMBUS' })

      await repo.saveResult(lead.id, { status: 'FAILED', error: 'ORION: HTTP 500; ASTRA: timeout' })

      const row = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })
      expect(row).toMatchObject({
        phoneNumber: null,
        phoneEnrichmentStatus: 'FAILED',
        phoneEnrichmentProvider: null,
        phoneEnrichmentError: 'ORION: HTTP 500; ASTRA: timeout',
      })
    })

    it('does nothing (no throw) when the lead was deleted meanwhile', async () => {
      await expect(repo.saveResult(999_999, { status: 'NO_DATA' })).resolves.toBeUndefined()
    })
  })

  describe('getStartInfo', () => {
    it('returns id, phone and status for the leads that exist', async () => {
      const a = await createLead({ phoneNumber: '+1 555', phoneEnrichmentStatus: 'FOUND' })
      const b = await createLead({ email: 'b@acme.com' })

      const info = await repo.getStartInfo([a.id, b.id, 999_999])

      expect(info.sort((x, y) => x.id - y.id)).toEqual([
        { id: a.id, phoneNumber: '+1 555', status: 'FOUND' },
        { id: b.id, phoneNumber: null, status: null },
      ])
    })
  })

  describe('markPending', () => {
    it('sets status PENDING and clears provider and error, keeping the phone', async () => {
      const lead = await createLead({
        phoneNumber: '+1 555',
        phoneEnrichmentStatus: 'FAILED',
        phoneEnrichmentProvider: 'ASTRA',
        phoneEnrichmentError: 'ORION: HTTP 500',
      })

      await repo.markPending(lead.id)

      const row = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })
      expect(row).toMatchObject({
        phoneNumber: '+1 555',
        phoneEnrichmentStatus: 'PENDING',
        phoneEnrichmentProvider: null,
        phoneEnrichmentError: null,
      })
    })
  })
})
