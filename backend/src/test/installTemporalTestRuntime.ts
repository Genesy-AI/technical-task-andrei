import { DefaultLogger, Runtime } from '@temporalio/worker'
import { temporalLogLevel } from './temporalLogLevel'

/**
 * Call once per test file, before creating a TestWorkflowEnvironment or Worker.
 * Set TEMPORAL_LOG_LEVEL=INFO (or run `pnpm test:verbose`) to see the SDK logs.
 */
export function installTemporalTestRuntime() {
  const level = temporalLogLevel()
  Runtime.install({
    logger: new DefaultLogger(level),
    telemetryOptions: { logging: { filter: { core: level, other: level } } },
  })
}
