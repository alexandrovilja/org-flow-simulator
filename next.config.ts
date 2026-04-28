import type { NextConfig } from 'next'

// In the Claude Code sandbox, Node.js is started with --localstorage-file pointing
// to an invalid path. This creates a broken global localStorage object where
// getItem/setItem are not functions. Patch it before Next.js initializes.
if (
  typeof globalThis.localStorage !== 'undefined' &&
  typeof (globalThis.localStorage as Storage).getItem !== 'function'
) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
      clear: () => undefined,
      length: 0,
      key: () => null,
    },
    writable: true,
    configurable: true,
  })
}

const nextConfig: NextConfig = {}

export default nextConfig
