import { defineConfig } from 'vitest/config'
import path from 'path'

// Logs (Temporal worker warnings, expected activity failures, ...) are hidden for passing tests
// and still shown for failing ones. Set DEBUG_TESTS=1 (or run `pnpm test:debug`) to see everything.
const debug = Boolean(process.env.DEBUG_TESTS)

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    silent: debug ? false : 'passed-only',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
