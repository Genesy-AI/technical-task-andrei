import { DefaultLogger } from '@temporalio/worker'

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
