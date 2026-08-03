import '@testing-library/react'

// jsdom ships neither of these, and both sit on hot paths in the app:
// crypto.randomUUID mints task ids, matchMedia backs the system theme.
if (!globalThis.crypto?.randomUUID) {
  let counter = 0
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      ...globalThis.crypto,
      randomUUID: () =>
        `test-uuid-${++counter}` as `${string}-${string}-${string}-${string}-${string}`,
    },
    configurable: true,
  })
}

if (!globalThis.matchMedia) {
  globalThis.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof globalThis.matchMedia
}
