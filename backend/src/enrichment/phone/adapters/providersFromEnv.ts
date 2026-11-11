import type { PhoneProviderPort } from '../domain/ports'
import { AstraAdapter } from './astraAdapter'
import { NimbusAdapter } from './nimbusAdapter'
import { OrionAdapter } from './orionAdapter'

const REQUIRED_VARS = [
  'ORION_BASE_URL',
  'ORION_API_KEY',
  'ASTRA_BASE_URL',
  'ASTRA_API_KEY',
  'NIMBUS_BASE_URL',
  'NIMBUS_API_KEY',
] as const

/**
 * Builds the real provider adapters from env vars.
 * Throws at startup if anything is missing, so a bad config never reaches a workflow.
 */
export function createPhoneProvidersFromEnv(
  env: Record<string, string | undefined>,
  fetchFn?: typeof fetch
): PhoneProviderPort[] {
  const missing = REQUIRED_VARS.filter((name) => !env[name]?.trim())
  if (missing.length > 0) {
    throw new Error(`Missing phone provider env vars: ${missing.join(', ')}`)
  }
  const get = (name: (typeof REQUIRED_VARS)[number]) => env[name]!.trim()

  return [
    new OrionAdapter({ baseUrl: get('ORION_BASE_URL'), apiKey: get('ORION_API_KEY'), fetchFn }),
    new AstraAdapter({ baseUrl: get('ASTRA_BASE_URL'), apiKey: get('ASTRA_API_KEY'), fetchFn }),
    new NimbusAdapter({ baseUrl: get('NIMBUS_BASE_URL'), apiKey: get('NIMBUS_API_KEY'), fetchFn }),
  ]
}
