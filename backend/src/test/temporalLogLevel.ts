import type { LogLevel } from '@temporalio/common'

const LEVELS: readonly LogLevel[] = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR']

/**
 * Log level for the Temporal SDK in tests, read from TEMPORAL_LOG_LEVEL.
 * Defaults to ERROR: workflow tests fail activities on purpose, and INFO/WARN
 * logs (webpack bundle stats, worker state, "Activity failed") are just noise.
 */
export function temporalLogLevel(env: NodeJS.ProcessEnv = process.env): LogLevel {
  const raw = env.TEMPORAL_LOG_LEVEL?.trim().toUpperCase()
  if (!raw) return 'ERROR'
  if ((LEVELS as readonly string[]).includes(raw)) return raw as LogLevel
  throw new Error(`TEMPORAL_LOG_LEVEL must be one of ${LEVELS.join(', ')}, got "${env.TEMPORAL_LOG_LEVEL}"`)
}
