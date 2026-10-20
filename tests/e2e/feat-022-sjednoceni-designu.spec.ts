/**
 * E2E testy pro feat-022 (Sjednocení designu v celém nástroji).
 * Ověřují v reálném prohlížeči to, co jsdom neumí: vypočtené písmo, velikosti, barvy a tvar prvků.
 *
 * Schválený kontrakt: features/feat-022-sjednoceni-designu.md (příklady 1, 2, 6, 7, 8, 9, 10, 13, 14).
 *
 * Spuštění lokálně: npx playwright test tests/e2e/feat-022-sjednoceni-designu.spec.ts
 */

import { test, expect, type Page, type Locator } from '@playwright/test'
import { BASE, groupWith, runButton, skipTutorial } from './helpers'

/** Rodiny písem design systému; next/font je pojmenuje „Archivo“ nebo „JetBrains_Mono“ apod. */
const DS_FAMILY = /^"?_*(Archivo|JetBrains[ _]Mono|Kalam)/
const MONO = /JetBrains[ _]Mono/

/** Velikosti písma z typové škály design systému (project/tokens.json, skupina type). */
const TYPE_SCALE_PX = [10, 11, 12, 13, 15, 20, 28, 36, 56]

/**
 * Znaky podobné emoji (stejná definice jako hlídač ve feat-022-source-guards.test.ts) a glyfy,
 * které design system povoluje. Předávají se do prohlížeče jako text.
 */
const EMOJI_LIKE_SOURCE = '[\\p{Extended_Pictographic}\\p{Emoji_Presentation}\\u{FE0F}\\u{2600}-\\u{27BF}]'
const ALLOWED_GLYPHS = ['▶', '❙', '↺', '⇄', '✓', '×', '↑', '↓', '→', '▸', '▾', '▴', '⚡']

/** Vypočtené typografické a tvarové vlastnosti prvku. */
const styleOf = (el: Locator) => el.evaluate(e => {
  const s = getComputedStyle(e)
  return {
    family: s.fontFamily, size: s.fontSize, weight: s.fontWeight, transform: s.textTransform,
    color: s.color, radius: s.borderTopLeftRadius, borderStyle: s.borderTopStyle,
  }
})

/**
 * Hodnota tokenu tak, jak ji vrátí getComputedStyle (rgb): na chvíli vloží prvek s barvou z tokenu.
 *
 * @param token - Název tokenu bez -- (např. „ink-3“)
 * @param prop - Vlastnost, do které se token dosadí
 * @returns Vypočtená barva
 */
function tokenColor(page: Page, token: string, prop: 'color' | 'backgroundColor' = 'color'): Promise<string> {
  return page.evaluate(([name, p]) => {
    const probe = document.createElement('div')
    probe.style[p as 'color'] = `var(--${name})`
    document.body.appendChild(probe)
    const value = getComputedStyle(probe)[p as 'color']
    probe.remove()
    return value
  }, [token, prop])
}

/** Tlačítko pro přidání jednotky — popisek podle presetu. */
const addUnitButton = (page: Page) => page.getByRole('button', { name: /^\+ Add (unit|member|team)$/ })

/** Otevře všechny tři akordeony nastavení (Advanced / Cash Flow), pokud ještě otevřené nejsou. */
async function openAccordions(page: Page): Promise<void> {
  for (const name of ['Backlog', 'Specializations', 'Team']) {
    const button = page.getByRole('button', { name, exact: true })
    if (await button.getAttribute('aria-expanded') !== 'true') await button.click()
  }
}

/** Počet hotových features z hlavičky „Done“ (počet je sourozenec nadpisu). */
const doneCount = (page: Page) =>
  page.getByRole('heading', { name: 'Done', exact: true }).evaluate(h => Number(h.nextElementSibling?.textContent ?? 0))

/**
 * Písma všech prvků s vlastním textem v seznamu Done (pravý panel pod nadpisem „Done“).
 *
 * @returns Seznam „text → rodina písma“
 */
async function doneListFonts(page: Page): Promise<{ text: string; family: string }[]> {
  return page.getByRole('heading', { name: 'Done', exact: true }).evaluate(h => {
    const aside = h.closest('aside')!
    const out: { text: string; family: string }[] = []
    for (const el of Array.from(aside.querySelectorAll<HTMLElement>('*'))) {
      // Jen prvky za nadpisem Done — dlaždice metrik nad ním mají vlastní test
      if (!(h.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) || h.contains(el)) continue
      if (el === h.nextElementSibling) continue
      const ownText = Array.from(el.childNodes).filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent ?? '').join('').trim()
      if (ownText) out.push({ text: ownText, family: getComputedStyle(el).fontFamily })
    }
    return out
  })
}

/**
 * Projde viditelné prvky s vlastním textem a vrátí ty, které porušují typografii design systému:
 * písmo mimo Archivo / JetBrains Mono / Kalam, velikost mimo typovou škálu nebo emoji v textu.
 *
 * @returns Seznam porušení „tag „text“: důvod“
 */
async function typographyViolations(page: Page): Promise<string[]> {
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
  }, { familySource: DS_FAMILY.source, scale: TYPE_SCALE_PX, emojiSource: EMOJI_LIKE_SOURCE, allowed: ALLOWED_GLYPHS })
}

test.describe('feat-022: sjednocení designu v celém nástroji', () => {
  test.beforeEach(async ({ page }) => {
    await skipTutorial(page)
  })

  test('Příklad 1: Units a Metrics mají styl eyebrow (JetBrains Mono 11 px, verzálky), poznámky Archivo 12 px', async ({ page }) => {
    await page.goto(BASE)
    for (const mode of ['Advanced', 'Cash Flow']) {
      await page.getByRole('tab', { name: mode }).click()
      for (const name of ['Units', 'Metrics', 'Backlog', 'Done']) {
        const s = await styleOf(page.getByRole('heading', { name, exact: true }))
        expect(s.family, `${mode}: ${name}`).toMatch(MONO)
        expect(s.size, `${mode}: ${name}`).toBe('11px')
        expect(s.transform, `${mode}: ${name}`).toBe('uppercase')
      }
      for (const hint of [/^Click \+ to add a specialty$/, /^\d+ features? sampled$/]) {
        const s = await styleOf(page.getByText(hint))
        expect(s.family, `${mode}: ${hint}`).toMatch(/Archivo/)
        expect(s.size, `${mode}: ${hint}`).toBe('12px')
      }
    }
  })

  test('Příklad 2: hlavičky akordeonů jsou ve stylu eyebrow (JetBrains Mono 11 px, verzálky)', async ({ page }) => {
    await page.goto(BASE)
    for (const mode of ['Advanced', 'Cash Flow']) {
      await page.getByRole('tab', { name: mode }).click()
      for (const name of ['Backlog', 'Specializations', 'Team']) {
        const s = await styleOf(page.getByRole('button', { name, exact: true }))
        expect(s.family, `${mode}: ${name}`).toMatch(MONO)
        expect(s.size, `${mode}: ${name}`).toBe('11px')
        expect(s.transform, `${mode}: ${name}`).toBe('uppercase')
      }
    }
  })

  test('Příklad 6: Advanced — počet tasků a lead time v seznamu Done jsou v mono', async ({ page }) => {
    await page.goto(BASE)
    await page.getByRole('tab', { name: 'Advanced' }).click()
    await groupWith(page, '2×').getByRole('button', { name: '10×', exact: true }).click()
    await runButton(page, 'Start').click()
    await expect.poll(() => doneCount(page), { timeout: 30_000 }).toBeGreaterThanOrEqual(2)
    await runButton(page, 'Pause').click()

    const fonts = await doneListFonts(page)
    expect(fonts.some(f => /^\d+ tasks?$/.test(f.text)), 'řádek s počtem tasků').toBe(true)
    expect(fonts.some(f => /^\d+\.\d+s$/.test(f.text)), 'řádek s lead time').toBe(true)
    expect(fonts.filter(f => !MONO.test(f.family))).toEqual([])
  })

  test('Příklad 6: Cash Flow — výnosy v Done a rozpad coordination overhead jsou v mono', async ({ page }) => {
    await page.goto(BASE)
    await page.getByRole('tab', { name: 'Cash Flow' }).click()
    // Coordination overhead jde zapnout jen před startem — po startu je zamčený do Resetu
    await page.getByRole('button', { name: 'Team', exact: true }).click()
    await groupWith(page, 'Off').getByRole('button', { name: 'On', exact: true }).click()
    await groupWith(page, '2×').getByRole('button', { name: '10×', exact: true }).click()
    await runButton(page, 'Start').click()
    await expect.poll(() => doneCount(page), { timeout: 30_000 }).toBeGreaterThanOrEqual(2)
    await runButton(page, 'Pause').click()

    const fonts = await doneListFonts(page)
    expect(fonts.some(f => /^€[\d.,]+k?\/tick$/.test(f.text)), 'výnos za tick').toBe(true)
    expect(fonts.filter(f => !MONO.test(f.family))).toEqual([])

    const breakdown = page.getByText(/handoff [\d.,]+ %/)
    await expect(breakdown).toBeVisible()
    const breakdownFonts = await breakdown.evaluate(root => [root, ...Array.from(root.querySelectorAll<HTMLElement>('*'))]
      .filter(el => Array.from(el.childNodes).some(n => n.nodeType === Node.TEXT_NODE && n.textContent?.trim()))
      .map(el => getComputedStyle(el).fontFamily))
    expect(breakdownFonts.length).toBeGreaterThan(0)
    for (const family of breakdownFonts) expect(family).toMatch(MONO)
  })

  test('Příklad 7: „+ Add …“ je hranaté tlačítko design systému s čárkovaným obrysem', async ({ page }) => {
    await page.goto(BASE)
    for (const mode of ['Advanced', 'Cash Flow']) {
      await page.getByRole('tab', { name: mode }).click()
      const button = addUnitButton(page)
      const s = await styleOf(button)
      expect(s.radius, mode).toBe('0px')
      expect(s.family, mode).toMatch(/Archivo/)
      expect(s.weight, mode).toBe('800')
      expect(s.transform, mode).toBe('uppercase')
      expect(s.borderStyle, mode).toBe('dashed')
      // Barva se mění 0,15s přechodem (po kliknutí v předchozím módu je myš ještě nad tlačítkem) — počkáme na cílovou
      await expect.poll(async () => (await styleOf(button)).color, { message: mode }).toBe(await tokenColor(page, 'ink-3'))
      // Přes celou šířku sekce s kartami jednotek
      const [own, parent] = await button.evaluate(e => [e.getBoundingClientRect().width, e.parentElement!.getBoundingClientRect().width])
      expect(own, mode).toBeGreaterThan(parent * 0.9)

      const before = await page.getByTitle('Remove unit').count()
      await button.click()
      await expect(page.getByTitle('Remove unit')).toHaveCount(before + 1)
    }
  })

  test('Příklad 8: názvy týmů v Compare mají styl heading (Archivo 800, 20 px, verzálky)', async ({ page }) => {
    await page.goto(BASE)
    const titles = page.getByRole('heading', { name: /team$/i })
    await expect(titles).toHaveCount(2)
    for (const title of await titles.all()) {
      const s = await styleOf(title)
      expect(s.family).toMatch(/Archivo/)
      expect(s.size).toBe('20px')
      expect(s.weight).toBe('800')
      expect(s.transform).toBe('uppercase')
    }
  })

  test('Příklad 8: písmeno vítěze v rámu výsledku má 20 px', async ({ page }) => {
    test.setTimeout(240_000) // celý běh Compare (2 × 100 features) i na 10× trvá desítky sekund
    await page.goto(BASE)
    await groupWith(page, '10×').getByRole('button', { name: '10×', exact: true }).click()
    await runButton(page, 'Run').click()
    await expect(runButton(page, 'Done')).toBeVisible({ timeout: 220_000 })

    const frame = page.getByRole('status').filter({ hasText: 'Result · avg lead time' })
    const badge = frame.locator('> span').first()
    await expect(badge).toHaveText(/^[AB]$/)
    const s = await styleOf(badge)
    expect(s.family).toMatch(/Archivo/)
    expect(s.size).toBe('20px')
    expect(s.weight).toBe('800')
  })

  test('Příklad 9: všechny viditelné texty mají písmo a velikost z design systému a žádné emoji', async ({ page }) => {
    await page.goto(BASE)
    await runButton(page, 'Run').click()
    await page.waitForTimeout(1500)
    expect(await typographyViolations(page), 'Compare').toEqual([])

    for (const mode of ['Advanced', 'Cash Flow']) {
      await page.getByRole('tab', { name: mode }).click()
      await openAccordions(page)
      await runButton(page, 'Start').click()
      await page.waitForTimeout(1500)
      expect(await typographyViolations(page), mode).toEqual([])
    }
  })

  for (const motion of ['no-preference', 'reduce'] as const) {
    test(`Příklad 13: přírůstek „+€X“ po ticku výnosu zmizí a nezůstane vidět (${motion})`, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: motion })
      await page.goto(BASE)
      await page.getByRole('tab', { name: 'Cash Flow' }).click()
      await groupWith(page, '2×').getByRole('button', { name: '10×', exact: true }).click()
      await runButton(page, 'Start').click()
      await expect(page.getByText(/^\+€[\d.,]+k?$/).first()).toBeVisible({ timeout: 30_000 })

      // Čteme keyframes animace přírůstku: poslední krok musí být průhledný; při omezeném pohybu
      // se přírůstek navíc neposouvá (žádný transform v žádném kroku)
      const frames = await page.evaluate(() => {
        const delta = Array.from(document.querySelectorAll<HTMLElement>('span')).find(e => /^\+€[\d.,]+k?$/.test(e.textContent ?? ''))!
        const name = getComputedStyle(delta).animationName
        for (const sheet of Array.from(document.styleSheets)) {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSKeyframesRule && rule.name === name) {
              const steps = Array.from(rule.cssRules) as CSSKeyframeRule[]
              return { name, lastOpacity: steps[steps.length - 1].style.opacity, hasTransform: steps.some(st => st.style.transform !== '') }
            }
          }
        }
        return { name, lastOpacity: null, hasTransform: false }
      })
      expect(frames.name, 'animace přírůstku běží').not.toBe('none')
      expect(frames.lastOpacity, 'poslední krok animace').toBe('0')
      if (motion === 'reduce') expect(frames.hasTransform, 'bez posunu při omezeném pohybu').toBe(false)
    })
  }

  test('Příklad 14: nápověda přepínače je široká nejvýš 260 px a zalamuje se', async ({ page }) => {
    await page.goto(BASE)
    await page.getByRole('tab', { name: 'Advanced' }).click()
    await page.getByRole('button', { name: 'Team', exact: true }).click()
    await page.getByRole('button', { name: 'Min units', exact: true }).hover()

    const hint = page.getByText(/^WIP: units finish in-progress features/)
    await expect(hint).toBeVisible()
    const box = await hint.boundingBox()
    expect(box!.width).toBeLessThanOrEqual(260)
    const s = await hint.evaluate(e => ({ whiteSpace: getComputedStyle(e).whiteSpace, lineHeight: parseFloat(getComputedStyle(e).lineHeight), inline: e.getAttribute('style') }))
    expect(s.whiteSpace).toBe('normal')
    expect(box!.height, 'dlouhý text se zalomil na víc řádků').toBeGreaterThan(s.lineHeight * 1.5)
    expect(s.inline, 'bez inline stylu').toBeNull()
  })

  for (const scheme of ['light', 'dark'] as const) {
    test(`Příklad 10: stránka 404 bere písma a barvy z tokenů (${scheme} téma)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme })
      await page.goto(`${BASE}/neexistuje`)
      await expect(page.locator('html')).toHaveAttribute('data-theme', scheme)

      const title = page.getByRole('heading', { name: '404' })
      const s = await styleOf(title)
      expect(s.family).toMatch(/Archivo/)
      expect(s.size).toBe('56px')
      expect(s.weight).toBe('800')
      expect(s.color).toBe(await tokenColor(page, 'ink'))

      expect(await page.locator('body').evaluate(b => getComputedStyle(b).fontFamily)).toMatch(/Archivo/)
      expect(await page.locator('body').evaluate(b => getComputedStyle(b).backgroundColor))
        .toBe(await tokenColor(page, 'surface-page', 'backgroundColor'))

      const link = page.getByRole('link', { name: /Back to simulator/ })
      expect((await styleOf(link)).color).toBe(await tokenColor(page, 'accent'))
      expect(await typographyViolations(page)).toEqual([])
    })
  }
})
