import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

/**
 * Bridge between the legacy eslint-config-next (CommonJS) and ESLint 9's
 * flat config system. FlatCompat translates the old "extends" syntax into
 * the flat config array format so we can keep using next/core-web-vitals
 * without rewriting every rule manually.
 */
const compat = new FlatCompat({ baseDirectory: __dirname })

const eslintConfig = [
  // Ignore generated build output and dependency directories — they contain
  // minified/compiled code that doesn't need to follow our lint rules.
  { ignores: ['.next/**', 'node_modules/**'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // This rule targets the Pages Router pattern (_document.js).
      // In the App Router, loading fonts in layout.tsx IS the correct approach.
      // Disabling to avoid false positives on App Router projects.
      '@next/next/no-page-custom-font': 'off',
    },
  },
]

export default eslintConfig
