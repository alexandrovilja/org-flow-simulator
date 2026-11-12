import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { join, resolve } from 'path'

// feat-028 inkrement 1 (Mandáty a tok práce) — barvy nových komponent jen z tokenů (J10).
//
// Schválený kontrakt (analýza J10): CSS moduly nových komponent módu Organization (soubory `Org*.module.css` a
// `Organization*.module.css`) nepoužívají natvrdo zapsané barvy — jen tokeny z `globals.css` (var(--…)), takže fungují
// ve světlém i tmavém tématu; kontrast tokenů hlídají existující testy feat-021.

const dir = resolve(__dirname, '../../../src/components')
const files = readdirSync(dir).filter(n => /^(Org|Organization).*\.module\.css$/.test(n))
// Natvrdo zapsaná barva: hex, rgb()/rgba(), hsl()/hsla(), oklch(), oklab(), lab(), lch()
const LITERAL_COLOR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/

describe('feat-028 J10: barvy nových komponent jen z tokenů', () => {
  it('mód má vlastní CSS moduly (jinak by hlídač nic nehlídal)', () => {
    expect(files).toContain('OrganizationView.module.css')
  })

  it('žádný z nich nemá natvrdo zapsanou barvu', () => {
    const offenders = files.flatMap(name => {
      const css = readFileSync(join(dir, name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
      return css.split('\n').filter(line => LITERAL_COLOR.test(line)).map(line => `${name}: ${line.trim()}`)
    })
    expect(offenders).toEqual([])
  })
})
