import type { PrismaClient } from '@prisma/client'
import { NativeConnection, Worker } from '@temporalio/worker'
import * as activities from './workflows/activities'
import { createPhoneActivities } from './enrichment/phone/activities'
import { createPhoneProvidersFromEnv } from './enrichment/phone/adapters/providersFromEnv'
import { PrismaLeadRepository } from './enrichment/phone/adapters/prismaLeadRepository'

export async function runTemporalWorker(prisma: PrismaClient) {
  // Built first so missing provider config fails at startup, not mid-workflow.
  const phoneActivities = createPhoneActivities({
    providers: createPhoneProvidersFromEnv(process.env),
    leadRepo: new PrismaLeadRepository(prisma),
  })

  const connection = await NativeConnection.connect({
    address: 'localhost:7233',
  })
  try {
    const worker = await Worker.create({
      connection,
      namespace: 'default',
      taskQueue: 'myQueue',
      workflowsPath: require.resolve('./workflows'),
      activities: { ...activities, ...phoneActivities },
    })

    await worker.run()
  } finally {
    await connection.close()
  }
}
