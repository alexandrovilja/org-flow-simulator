import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'

// feat-021 (Převod na design system Org Flow) — tokeny v globals.css.
//
// Schválený kontrakt (spec features/feat-021-prevod-design-system-org-flow.md):
//  - Příklad 1: globals.css nese tokeny design systému pod jejich názvy (paleta Antracit a elektrická
//    modř) a staré názvy (--bg, --panel, --warn, --rework-ink…) už nejsou deklarované ani použité.
//  - Příklad 2: každý textový pár z design systému má v obou tématech kontrast aspoň 4,5:1,
//    obrysy ovládacích prvků a prstenec fokusu aspoň 3:1 (WCAG 2).
//
// Hodnoty tokenů se čtou přímo z textu globals.css — žádný prohlížeč ani knihovna není potřeba.

const ROOT = resolve(__dirname, '../../..')
const GLOBALS_CSS = readFileSync(join(ROOT, 'src/app/globals.css'), 'utf8')

/** Mapa „název tokenu bez -- → hodnota“ pro jedno téma. */
type TokenMap = Record<string, string>

/**
 * Rozebere globals.css na tokeny světlého a tmavého tématu.
 * Světlé téma = všechny bloky, jejichž selektor obsahuje `:root` (a ne tmavé téma);
 * tmavé téma = bloky `[data-theme="dark"]`, které přepisují světlé hodnoty.
 *
 * @param css - Text stylesheetu
 * @returns Tokeny pro světlé a tmavé téma (tmavé už sloučené se světlými)
 */
function parseThemes(css: string): { light: TokenMap; dark: TokenMap } {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const light: TokenMap = {}
  const darkOnly: TokenMap = {}
  // Nejvnitřnější bloky `selektor { deklarace }` — vnořené @keyframes kroky selektor :root nemají
  for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim()
    const target = selector.includes('[data-theme="dark"]') ? darkOnly : selector.includes(':root') ? light : null
    if (!target) continue
    for (const d of m[2].matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) target[d[1]] = d[2].trim()
  }
  return { light, dark: { ...light, ...darkOnly } }
}

const { light, dark } = parseThemes(GLOBALS_CSS)

/**
 * Vrátí hex hodnotu tokenu; aliasy `var(--jiny-token)` dohledá rekurzivně.
 *
 * @param map - Tokeny tématu
 * @param name - Název tokenu bez --
 * @returns Hex barva (#rrggbb nebo #rrggbbaa)
 */
function hex(map: TokenMap, name: string): string {
  let value = map[name]
  for (let i = 0; i < 16 && value?.startsWith('var('); i++) value = map[value.slice(6, -1).trim()]
  if (!value || !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(value)) throw new Error(`Token --${name} nemá hex hodnotu: ${value}`)
  return value
}

/** Relativní jas barvy podle WCAG 2 (sRGB → lineární složky). */
function luminance(color: string): number {
  const channel = (i: number) => {
    const c = parseInt(color.slice(1 + i * 2, 3 + i * 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2)
}

/** Kontrastní poměr dvou barev podle WCAG 2 (1 až 21). */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/** Textové páry [text, podklad] z popisů tokenů v design systému — musí držet 4,5:1. */
const TEXT_PAIRS: [string, string][] = [
  ['ink', 'surface-page'], ['ink', 'surface-panel'], ['ink', 'surface-raised'], ['ink', 'surface-highlight'],
  ['ink-2', 'surface-page'], ['ink-2', 'surface-panel'], ['ink-2', 'surface-raised'],
  ['ink-3', 'surface-page'], ['ink-3', 'surface-panel'], ['ink-3', 'surface-subtle'], ['ink-3', 'surface-paper'],
  ['ink-3', 'accent-soft'], ['ink-3', 'done-soft'], ['ink-3', 'wait-soft'],
  ['ink-on-bar', 'surface-bar'], ['highlight', 'surface-bar'],
  ['highlight-ink', 'surface-panel'], ['highlight-ink', 'surface-paper'],
  ['on-action', 'action'], ['on-accent', 'accent'], ['accent', 'surface-panel'], ['accent', 'accent-soft'],
  ['on-done', 'done'], ['done', 'surface-panel'], ['done', 'done-soft'],
  ['wait', 'surface-panel'], ['wait', 'wait-soft'],
  ['rework', 'surface-panel'], ['rework', 'rework-soft'],
]

/** Páry ovládacích prvků [obrys / prstenec, podklad] — WCAG 1.4.11 požaduje 3:1. */
const UI_PAIRS: [string, string][] = [
  ['line-control', 'surface-page'], ['line-control', 'surface-panel'],
  ['focus', 'surface-page'], ['focus', 'surface-panel'],
  ['focus-on-bar', 'surface-bar'], ['action', 'surface-bar'],
]

/** Výplně role čipů — bílý text (ink-inverse) na nich musí držet 4,5:1. */
const ROLE_TOKENS = ['role-rose', 'role-blue', 'role-brick', 'role-green', 'role-ochre', 'role-teal', 'role-violet', 'role-slate']

/**
 * Projde všechny soubory .ts, .tsx a .css ve složce (rekurzivně).
 *
 * @param dir - Výchozí složka
 * @returns Cesty k souborům
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(tsx?|css)$/.test(name) ? [path] : []
  })
}

describe('feat-021 Příklad 1: tokeny design systému v globals.css', () => {
  it('světlé téma má hlavní barvy palety Antracit a elektrická modř', () => {
    expect(hex(light, 'surface-bar')).toBe('#121212')
    expect(hex(light, 'action')).toBe('#2b59ff')
    expect(hex(light, 'accent')).toBe('#7a3bf0')
    expect(hex(light, 'highlight')).toBe('#ffe14d')
  })

  it('deklaruje plochy, text, linky a stavové tokeny design systému', () => {
    const required = [
      'surface-page', 'surface-panel', 'surface-subtle', 'surface-raised', 'surface-paper', 'surface-highlight', 'surface-bar',
      'ink', 'ink-2', 'ink-3', 'ink-4', 'ink-on-bar', 'ink-inverse',
      'line', 'line-2', 'line-control', 'line-ink', 'line-on-bar', 'track',
      'action', 'action-hover', 'on-action', 'accent', 'accent-soft', 'on-accent', 'highlight', 'highlight-ink', 'focus', 'focus-on-bar',
      'done', 'done-soft', 'on-done', 'wait', 'wait-soft', 'rework', 'rework-soft', 'rework-line',
      ...ROLE_TOKENS,
    ]
    const missing = required.filter(name => !(name in light))
    expect(missing).toEqual([])
  })

  it('staré názvy tokenů už nejsou deklarované', () => {
    for (const old of ['bg', 'panel', 'warn', 'rework-ink', 'rework-bg', 'radius', 'shadow']) {
      expect(light[old], `--${old} je stále deklarovaný`).toBeUndefined()
    }
  })

  it('žádný soubor v src/ nepoužívá staré názvy tokenů', () => {
    const OLD_USE = /var\(--(bg|panel|warn|rework-ink|rework-bg|radius|shadow)\)/
    const offenders = sourceFiles(join(ROOT, 'src')).filter(path => OLD_USE.test(readFileSync(path, 'utf8')))
    expect(offenders.map(p => p.slice(ROOT.length + 1))).toEqual([])
  })
})

describe('feat-021 Příklad 2: kontrast textu v obou tématech', () => {
  it('tmavé téma je deklarované pod [data-theme="dark"] a mění plochy i text', () => {
    expect(hex(dark, 'surface-page')).not.toBe(hex(light, 'surface-page'))
    expect(hex(dark, 'ink')).not.toBe(hex(light, 'ink'))
  })

  for (const [themeName, map] of [['světlé', light], ['tmavé', dark]] as const) {
    it(`${themeName} téma: každý textový pár má aspoň 4,5:1`, () => {
      const failing = TEXT_PAIRS
        .map(([fg, bg]) => ({ pair: `${fg} na ${bg}`, ratio: contrast(hex(map, fg), hex(map, bg)) }))
        .filter(r => r.ratio < 4.5)
      expect(failing).toEqual([])
    })

    it(`${themeName} téma: obrysy ovládacích prvků a fokus mají aspoň 3:1`, () => {
      const failing = UI_PAIRS
        .map(([fg, bg]) => ({ pair: `${fg} na ${bg}`, ratio: contrast(hex(map, fg), hex(map, bg)) }))
        .filter(r => r.ratio < 3)
      expect(failing).toEqual([])
    })

    it(`${themeName} téma: bílý text na každé výplni role má aspoň 4,5:1`, () => {
      const failing = ROLE_TOKENS
        .map(role => ({ role, ratio: contrast(hex(map, 'ink-inverse'), hex(map, role)) }))
        .filter(r => r.ratio < 4.5)
      expect(failing).toEqual([])
    })
  }
})
