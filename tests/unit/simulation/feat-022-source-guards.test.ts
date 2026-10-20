import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'

// feat-022 (Sjednocení designu v celém nástroji) — hlídače zdrojového kódu.
//
// Schválený kontrakt (spec features/feat-022-sjednoceni-designu.md):
//  - Příklad 4: texty v .tsx ve src/components a src/app (mimo komentáře) neobsahují emoji; povolené
//    jsou jen typografické glyfy design systému (▶ ❙ ↺ ⇄ ✓ × ↑ ↓ → ▸ ▾ ▴ a ⚡ v AI odznaku).
//  - Příklad 10 (zdrojová část): stránka 404 nemá natvrdo zapsané barvy ani systémové písmo — bere je
//    z tokenů. Vypočtené barvy a písmo v obou tématech ověřuje E2E test.
//  - Příklad 11: žádný soubor .tsx nenastavuje písmo, mezery, rádiusy ani mřížku v objektu stylu —
//    ať je to literál `style={{…}}`, proměnná typu CssVariables, nebo objekt vybraný podmínkou;
//    inline zůstávají jen vypočítané hodnoty (šířky barů, pozice tutoriálu, --hue, --role…).
//
// Testy čtou zdrojové soubory jako text — stejně jako hlídač starých názvů tokenů ve feat-021.

const ROOT = resolve(__dirname, '../../..')

/**
 * Projde všechny soubory .tsx ve složce (rekurzivně).
 *
 * @param dir - Výchozí složka
 * @returns Absolutní cesty k souborům
 */
function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return tsxFiles(path)
    return name.endsWith('.tsx') ? [path] : []
  })
}

/** Cesta relativní ke kořeni repa — čitelnější výpis v chybové hlášce. */
const rel = (path: string) => path.slice(ROOT.length + 1)

/**
 * Odstraní z kódu komentáře: blokové `/* … *\/` (i JSX `{/* … *\/}`) a řádkové `// …`.
 * Řádkový komentář se pozná podle mezery nebo začátku řádku před `//`, takže `https://…`
 * v řetězci zůstane.
 *
 * @param code - Zdrojový kód
 * @returns Kód bez komentářů
 */
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1')
}

/** Typografické glyfy, které design system v UI povoluje (README design systému, Obsah a tón). */
const ALLOWED_GLYPHS = new Set(['▶', '❙', '↺', '⇄', '✓', '×', '↑', '↓', '→', '▸', '▾', '▴', '⚡'])

/**
 * Znaky, které se počítají jako emoji nebo obrázkový symbol: piktogramy Unicode, znaky s výchozí
 * emoji podobou, výběr emoji podoby (U+FE0F) a bloky Miscellaneous Symbols a Dingbats (☾ ⚙ ✗ ✕ …).
 */
const EMOJI_LIKE = /[\p{Extended_Pictographic}\p{Emoji_Presentation}\u{FE0F}\u{2600}-\u{27BF}]/gu

/**
 * Najde v textu znaky podobné emoji, které nejsou mezi povolenými glyfy.
 *
 * @param text - Prohledávaný text
 * @returns Nalezené zakázané znaky (každý jednou)
 */
function forbiddenGlyphs(text: string): string[] {
  const found = (text.match(EMOJI_LIKE) ?? []).filter(ch => !ALLOWED_GLYPHS.has(ch))
  return [...new Set(found)]
}

/** Vlastnosti, které do inline stylu nepatří: písmo, mezery, rádiusy a mřížka jsou v CSS modulech. */
const FORBIDDEN_STYLE_KEYS = /\b(fontSize|fontFamily|fontWeight|letterSpacing|lineHeight|textTransform|padding\w*|margin\w*|gap|rowGap|columnGap|borderRadius|gridTemplateColumns)\s*:/g

/**
 * Najde v kódu zakázané klíče stylu. Hledá je v celém souboru, ne jen v literálu `style={{…}}`:
 * objekt stylu se do `style` často dostane přes proměnnou nebo podmínku
 * (`const s: CssVariables | undefined = x ? { … } : undefined`) a literál by ho minul.
 * V komponentách (.tsx) klíče jako `fontSize` nebo `padding` jinde než ve stylu nevznikají.
 *
 * @param code - Zdrojový kód bez komentářů
 * @returns Nalezené klíče v pořadí výskytu
 */
function forbiddenStyleKeys(code: string): string[] {
  return [...code.matchAll(FORBIDDEN_STYLE_KEYS)].map(m => m[1])
}

const UI_FILES = [...tsxFiles(join(ROOT, 'src/components')), ...tsxFiles(join(ROOT, 'src/app'))]
const ALL_TSX = tsxFiles(join(ROOT, 'src'))

describe('feat-022 Příklad 4: žádné emoji ve zdrojích UI', () => {
  it('hlídač pozná emoji z dnešního nastavení a pustí povolené glyfy', () => {
    // Kontrola samotného hlídače, aby prázdný výsledek níž nebyl jen díky chybnému regexu
    expect(forbiddenGlyphs('♻ Backlog ⚙ Specializations 👥 Team 🔒 🗑 ✗ ✕ ☾')).toEqual(['♻', '⚙', '👥', '🔒', '🗑', '✗', '✕', '☾'])
    expect(forbiddenGlyphs('▶ Run ❙❙ Pause ↺ Reset ⇄ 3 ✓ Done × ↑ ↓ → ▸ ▾ ▴ ⚡ 5× €299 · ≥ 2 roles')).toEqual([])
  })

  it('texty v src/components a src/app (mimo komentáře) neobsahují emoji', () => {
    const offenders = UI_FILES
      .map(path => ({ file: rel(path), glyphs: forbiddenGlyphs(stripComments(readFileSync(path, 'utf8'))) }))
      .filter(o => o.glyphs.length > 0)
    expect(offenders).toEqual([])
  })
})

describe('feat-022 Příklad 10: stránka 404 bere barvy a písmo z tokenů', () => {
  it('src/app/not-found.tsx nemá natvrdo zapsané barvy ani systémové písmo', () => {
    const code = stripComments(readFileSync(join(ROOT, 'src/app/not-found.tsx'), 'utf8'))
    expect(code).not.toMatch(/#[0-9a-f]{3,8}\b/i)
    expect(code).not.toMatch(/\b(oklch|rgba?|hsla?)\(/)
    expect(code).not.toMatch(/system-ui|sans-serif/)
  })
})

describe('feat-022 Příklad 11: inline styly jen pro vypočítané hodnoty', () => {
  it('hlídač najde zakázané klíče v literálu, v typované proměnné, v ternárním výrazu i v proměnné předané do style', () => {
    const sample = [
      `<div style={{ display: 'flex', gap: 8, fontSize: 11 }} />`,
      `const s: CssVariables = { width: '10%', borderRadius: 4, '--hue': 3 }`,
      `const t: CssVariables | undefined = cf ? { '--hue': 1, padding: 2 } : undefined`,
      `const u = { ...base, marginTop: 4 }; return <div style={u} />`,
      `<div style={{ width: \`\${pct}%\`, top: pos.top, '--role': color }} />`,
    ].join('\n')
    expect(forbiddenStyleKeys(sample)).toEqual(['gap', 'fontSize', 'borderRadius', 'padding', 'marginTop'])
  })

  it('žádný soubor src/**/*.tsx nenastavuje písmo, mezery, rádiusy ani mřížku v objektu stylu', () => {
    const offenders = ALL_TSX.flatMap(path =>
      forbiddenStyleKeys(stripComments(readFileSync(path, 'utf8'))).map(key => `${rel(path)}: ${key}`))
    expect([...new Set(offenders)]).toEqual([])
  })
})
