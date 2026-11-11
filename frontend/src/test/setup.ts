import '@testing-library/jest-dom'

// jsdom has no ResizeObserver; Headless UI uses it to position floating panels.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub
