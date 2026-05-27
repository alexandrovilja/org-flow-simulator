import '@testing-library/jest-dom'

// Provide a working localStorage implementation for the jsdom test environment.
// Vitest's jsdom does not configure a URL by default, which causes the native
// Storage methods (setItem, getItem, removeItem) to throw. This in-memory mock
// replaces localStorage for all unit tests without affecting other globals.
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string): string | null => store[key] ?? null,
    setItem: (key: string, value: string): void => { store[key] = String(value) },
    removeItem: (key: string): void => { delete store[key] },
    clear: (): void => { store = {} },
    get length(): number { return Object.keys(store).length },
    key: (i: number): string | null => Object.keys(store)[i] ?? null,
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
})
