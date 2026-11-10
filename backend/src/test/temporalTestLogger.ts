import { DefaultLogger, Runtime } from '@temporalio/worker'

/**
 * Temporal's DefaultLogger writes straight to process.stderr, which Vitest cannot hide.
 * This one goes through console.warn, so the `silent` setting in vitest.config.ts applies:
 * hidden for passing tests, shown for failing ones, always shown with DEBUG_TESTS=1.
 */
export function temporalTestLogger(): DefaultLogger {
  return new DefaultLogger('WARN', ({ level, message, meta }) => {
    console.warn(`[temporal ${level}] ${message}`, ...(meta === undefined ? [] : [meta]))
  })
}

/**
 * Installs the Temporal runtime for tests (once per test file).
 * `forward` sends logs from the native core (e.g. "Activity not found on completion") through
 * the test logger too; without it they go straight to stdout and ignore the quiet mode.
 */
export function installTemporalTestRuntime(): void {
  Runtime.install({
    logger: temporalTestLogger(),
    telemetryOptions: { logging: { filter: { core: 'WARN', other: 'ERROR' }, forward: {} } },
  })
}
