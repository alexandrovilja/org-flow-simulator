/**
 * Sdílené pomocné funkce pro E2E testy (feat-021, feat-022): adresa aplikace, přeskočení tutoriálu,
 * hledání ovládacích prvků v horní liště a kontrast barev. Playwright tenhle soubor nespouští jako test
 * (nekončí na .spec.ts), jen ho importují testy.
 */

import type { Page, Locator } from '@playwright/test'

/** Adresa testované aplikace; v CI se dá přepsat proměnnou BASE_URL (např. na produkci). */
export const BASE = process.env.BASE_URL ?? 'http://localhost:3000'

/**
 * Označí tutoriál jako dokončený a všechny módy jako viděné ještě před načtením stránky.
 * Tutorial overlay by jinak na první návštěvě (i při prvním přepnutí do Advanced nebo Cash Flow, feat-025)
 * blokoval kliknutí.
 *
 * @param page - Stránka Playwrightu
 */
export async function skipTutorial(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('tutorial-completed', 'true')
    localStorage.setItem('tutorial-seen-modes', JSON.stringify(['compare', 'experiment', 'cashflow']))
  })
}

/**
 * Tlačítko Run / Pause / Done v horní liště (ve všech třech módech stejné, feat-021 Příklad 14) — podle konce přístupného názvu,
 * protože popisku může předcházet glyf (▶, ❙❙, ✓).
 *
 * @param page - Stránka Playwrightu
 * @param label - Konec názvu tlačítka
 * @returns Locator tlačítka
 */
export function runButton(page: Page, label: 'Run' | 'Pause' | 'Done'): Locator {
  return page.getByRole('button', { name: new RegExp(`${label}$`) })
}

/**
 * Segmentový přepínač (role="group"), který obsahuje tlačítko s daným textem.
 *
 * @param page - Stránka Playwrightu
 * @param buttonName - Přesný text jednoho segmentu, např. „10×“ nebo „Single“
 * @returns Locator skupiny
 */
export function groupWith(page: Page, buttonName: string): Locator {
  return page.getByRole('group').filter({ has: page.getByRole('button', { name: buttonName, exact: true }) })
}

/** Písmo celé aplikace od feat-023: JetBrains Mono (next/font ho pojmenuje „JetBrains Mono“ nebo „JetBrains_Mono“). */
export const MONO = /JetBrains[ _]Mono/

/** Velikosti písma z typové škály design systému (project/tokens.json, skupina type). */
const TYPE_SCALE_PX = [10, 11, 12, 13, 15, 20, 28, 36, 56]

/**
 * Znaky podobné emoji (stejná definice jako hlídač ve feat-022-source-guards.test.ts) a glyfy,
 * které design system povoluje. Předávají se do prohlížeče jako text.
 */
const EMOJI_LIKE_SOURCE = '[\\p{Extended_Pictographic}\\p{Emoji_Presentation}\\u{FE0F}\\u{2600}-\\u{27BF}]'
const ALLOWED_GLYPHS = ['▶', '❙', '↺', '⇄', '✓', '×', '↑', '↓', '→', '▸', '▾', '▴', '⚡']

/**
 * Vypočtené typografické a tvarové vlastnosti prvku.
 *
 * @param el - Prvek, který se měří
 * @returns Písmo, velikost, řez, verzálky, barvu, rádius a styl obrysu (hodnoty z getComputedStyle)
 */
export const styleOf = (el: Locator) => el.evaluate(e => {
  const s = getComputedStyle(e)
  return {
    family: s.fontFamily, size: s.fontSize, weight: s.fontWeight, transform: s.textTransform,
    color: s.color, radius: s.borderTopLeftRadius, borderStyle: s.borderTopStyle,
  }
})

/**
 * Otevře všechny tři akordeony nastavení (Advanced / Cash Flow), pokud ještě otevřené nejsou.
 *
 * @param page - Stránka Playwrightu
 */
export async function openAccordions(page: Page): Promise<void> {
  for (const name of ['Backlog', 'Specializations', 'Team']) {
    const button = page.getByRole('button', { name, exact: true })
    if (await button.getAttribute('aria-expanded') !== 'true') await button.click()
  }
}

/**
 * Projde viditelné prvky s vlastním textem a vrátí ty, které porušují typografii aplikace:
 * první písmo jiné než JetBrains Mono, velikost mimo typovou škálu design systému nebo emoji v textu.
 * Vlastní text = přímý textový uzel prvku, aby se nepočítali rodiče s jiným písmem.
 *
 * @param page - Stránka Playwrightu
 * @returns Seznam porušení „tag „text“: důvod“
 */
export async function typographyViolations(page: Page): Promise<string[]> {
  return page.evaluate(({ familySource, scale, emojiSource, allowed }) => {
    const family = new RegExp(familySource)
    const emoji = new RegExp(emojiSource, 'gu')
    const out: string[] = []
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
      const ownText = Array.from(el.childNodes).filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent ?? '').join('').trim()
      if (!ownText) continue
      const rect = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      if (rect.width === 0 || rect.height === 0 || s.visibility === 'hidden' || s.display === 'none') continue
      const where = `${el.tagName.toLowerCase()} „${ownText.slice(0, 30)}“`
      const first = s.fontFamily.split(',')[0].trim()
      if (!family.test(first)) out.push(`${where}: písmo ${first}`)
      const size = parseFloat(s.fontSize)
      if (!scale.includes(size)) out.push(`${where}: velikost ${size}px`)
      const glyphs = (ownText.match(emoji) ?? []).filter(ch => !allowed.includes(ch))
      if (glyphs.length) out.push(`${where}: emoji ${glyphs.join(' ')}`)
    }
    return out
  }, { familySource: `^"?_*${MONO.source}`, scale: TYPE_SCALE_PX, emojiSource: EMOJI_LIKE_SOURCE, allowed: ALLOWED_GLYPHS })
}

/**
 * Kontrastní poměr dvou neprůhledných barev podle WCAG 2.x (1 = žádný kontrast, 21 = černá na bílé).
 * Počítá se v Node, ne v prohlížeči: stačí mu barvy, které vrátil getComputedStyle.
 *
 * @param a - Barva ve tvaru `rgb(r, g, b)`
 * @param b - Druhá barva ve stejném tvaru
 * @returns Poměr světlejší ku tmavší barvě, např. 4.5
 */
export function contrastRatio(a: string, b: string): number {
  const luminance = (color: string) => {
    const [r, g, bl, alpha = 1] = (color.match(/[\d.]+/g) ?? []).map(Number)
    // Poloprůhledná barva by se musela nejdřív složit s podkladem — tady by výsledek tiše lhal
    if (alpha < 1) throw new Error(`contrastRatio: barva ${color} není neprůhledná`)
    // sRGB → lineární světlo (vzorec WCAG), pak vážený součet podle citlivosti oka
    const linear = [r, g, bl].map(v => {
      const c = v / 255
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
    })
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
  }
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Rozložení horní lišty: kde končí viditelná značka, kde jsou záložky a kde začíná ovládání vpravo.
 * Značku tvoří prvky s šířkou nad 2 px — schovaný název (1 px pro čtečky obrazovky) se nepočítá.
 *
 * @returns Pravý okraj značky, rozsah záložek, levý okraj ovládání, šířka názvu a šířka stránky
 */
export async function topBarLayout(page: Page): Promise<{ brandRight: number; tabsLeft: number; tabsRight: number; controlsLeft: number; nameWidth: number; scrollWidth: number }> {
  return page.evaluate(() => {
    const header = document.querySelector('header')!
    const [brand, tabs, controls] = Array.from(header.children) as HTMLElement[]
    const visible = (els: Element[]) => els.map(e => e.getBoundingClientRect()).filter(r => r.width > 2 && r.height > 2)
    const brandBoxes = visible(Array.from(brand.querySelectorAll('*')))
    const controlBoxes = visible(Array.from(controls.children))
    const tabsBox = tabs.getBoundingClientRect()
    const name = Array.from(brand.querySelectorAll('span')).find(e => e.textContent === 'Org Flow Simulator')
    return {
      brandRight: Math.max(...brandBoxes.map(r => r.right)),
      tabsLeft: tabsBox.left,
      tabsRight: tabsBox.right,
      controlsLeft: Math.min(...controlBoxes.map(r => r.left)),
      nameWidth: name ? name.getBoundingClientRect().width : 0,
      scrollWidth: document.documentElement.scrollWidth,
    }
  })
}
