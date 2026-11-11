import { describe, it, expect } from 'vitest'
import { temporalLogLevel } from './temporalLogLevel'

describe('temporalLogLevel', () => {
  it('defaults to ERROR so expected test failures do not flood the output', () => {
    expect(temporalLogLevel({})).toBe('ERROR')
    expect(temporalLogLevel({ TEMPORAL_LOG_LEVEL: '' })).toBe('ERROR')
  })

  it('accepts any Temporal log level, case-insensitive', () => {
    expect(temporalLogLevel({ TEMPORAL_LOG_LEVEL: 'info' })).toBe('INFO')
    expect(temporalLogLevel({ TEMPORAL_LOG_LEVEL: 'DEBUG' })).toBe('DEBUG')
    expect(temporalLogLevel({ TEMPORAL_LOG_LEVEL: 'Warn' })).toBe('WARN')
  })

  it('rejects an unknown level instead of silently ignoring a typo', () => {
    expect(() => temporalLogLevel({ TEMPORAL_LOG_LEVEL: 'verbose' })).toThrow(
      /TEMPORAL_LOG_LEVEL.*TRACE, DEBUG, INFO, WARN, ERROR/
    )
  })
})
