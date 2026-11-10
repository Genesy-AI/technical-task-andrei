// Pure data: imported by the workflow, so no Node / I/O imports here.
import type { ActivityOptions, RetryPolicy } from '@temporalio/workflow'
import type { ProviderName } from './domain/types'

/** Order we ask providers in. Best data first, fastest second, newest last. */
export const PROVIDER_ORDER: ProviderName[] = ['ORION', 'ASTRA', 'NIMBUS']

const PROVIDER_RETRY: RetryPolicy = {
  maximumAttempts: 3,
  initialInterval: '1 second',
  backoffCoefficient: 2,
  maximumInterval: '10 seconds',
}

/** Per-provider timeout, based on latency measured against the real APIs (step 0). */
export const PROVIDER_ACTIVITY_OPTIONS: Record<ProviderName, ActivityOptions> = {
  ORION: { startToCloseTimeout: '10 seconds', retry: PROVIDER_RETRY }, // ~4.2s, random 500s
  ASTRA: { startToCloseTimeout: '3 seconds', retry: PROVIDER_RETRY }, // 0.2-1.3s
  NIMBUS: { startToCloseTimeout: '5 seconds', retry: PROVIDER_RETRY }, // ~2.2s
}

/** loadLead / markProgress / saveResult: local DB, should be quick. */
export const DB_ACTIVITY_OPTIONS: ActivityOptions = {
  startToCloseTimeout: '5 seconds',
  retry: { maximumAttempts: 5, initialInterval: '1 second', backoffCoefficient: 2 },
}
