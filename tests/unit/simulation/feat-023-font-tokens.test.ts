import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'

// feat-023 (Jednotné písmo: celá aplikace v JetBrains Mono) — hlídače zdrojů.
//
// Schválený kontrakt (spec features/feat-023-jednotne-pismo-textu.md):
//  - Příklad 1 (zdrojová část): v globals.css zůstává jediný token písma `--font-mono`; tokeny
//    `--font-display`, `--font-sans` a `--font-hand` neexistují a žádný soubor v src/ je nepoužívá;
//    layout.tsx nenačítá Archivo ani Kalam.
//  - Příklad 12 (zdrojová část): `font-variant-ligatures: none` platí pro všechny prvky (selektor `*`),
//    protože vstupy a tlačítka mají z prohlížeče vlastní `font` a dědičnost z `body` by je minula.
// Skutečné vypočtené písmo a ligatury v prohlížeči ověřuje E2E test feat-023-jednotne-pismo.spec.ts.

const ROOT = resolve(__dirname, '../../..')
const GLOBALS_CSS = readFileSync(join(ROOT, 'src/app/globals.css'), 'utf8')

/**
 * Projde všechny soubory .ts, .tsx a .css ve složce (rekurzivně).
 *
 * @param dir - Výchozí složka
 * @returns Absolutní cesty k souborům
 */
function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sourceFiles(path)
    return /\.(tsx?|css)$/.test(name) ? [path] : []
  })
}

/** Cesta relativní ke kořeni repa — čitelnější výpis v chybové hlášce. */
const rel = (path: string) => path.slice(ROOT.length + 1)

describe('feat-023 Příklad 1: jediný token písma', () => {
  it('globals.css deklaruje --font-mono a žádný jiný token písma', () => {
    expect(GLOBALS_CSS).toMatch(/--font-mono\s*:\s*var\(--font-jetbrains-mono\)/)
    const declared = [...GLOBALS_CSS.matchAll(/--(font-[\w-]+)\s*:/g)].map(m => m[1])
    expect(declared).toEqual(['font-mono'])
  })

  it('žádný soubor v src/ nepoužívá zrušené tokeny písma ani proměnné Archivo a Kalam', () => {
    const OLD = /var\(--font-(sans|display|hand|archivo|kalam)\)/
    const offenders = sourceFiles(join(ROOT, 'src')).filter(path => OLD.test(readFileSync(path, 'utf8')))
    expect(offenders.map(rel)).toEqual([])
  })

  it('layout.tsx nenačítá Archivo ani Kalam a JetBrains Mono má řez 800', () => {
    const layout = readFileSync(join(ROOT, 'src/app/layout.tsx'), 'utf8')
    expect(layout).not.toMatch(/\b(Archivo|Kalam)\b/)
    expect(layout).toMatch(/weight:\s*\[[^\]]*'800'/)
  })
})

describe('feat-023 Příklad 12: ligatury vypnuté pro všechny prvky', () => {
  it('globals.css vypíná ligatury selektorem *', () => {
    // Pravidlo `* { … }` (ne jen html/body): vstupy a tlačítka dědičnost minou
    const rule = GLOBALS_CSS.match(/(?:^|\})\s*\*\s*\{([^}]*)\}/m)?.[1] ?? ''
    expect(rule).toMatch(/font-variant-ligatures:\s*none/)
  })
})
