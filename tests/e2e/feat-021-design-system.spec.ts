/**
 * E2E testy pro feat-021 (Převod na design system Org Flow).
 * Ověřují v reálném prohlížeči to, co jsdom neumí: vypočtené barvy, velikosti písma, načtená písma
 * a téma přes znovunačtení stránky.
 *
 * Schválený kontrakt: features/feat-021-prevod-design-system-org-flow.md (příklady 3, 5, 6, 7, 8, 10, 11).
 *
 * Spuštění lokálně: npx playwright test tests/e2e/feat-021-design-system.spec.ts
 */

import { test, expect, type Page, type Locator } from '@playwright/test'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'

/** Barvy tokenů jako je vrací getComputedStyle (rgb). Hodnoty z design systému Org Flow. */
const RGB = {
  action: 'rgb(43, 89, 255)',        // #2b59ff
  accent: 'rgb(122, 59, 240)',       // #7a3bf0
  done: 'rgb(9, 127, 67)',           // #097f43
  ink: 'rgb(18, 18, 18)',            // #121212
  inkOnBar: 'rgb(222, 222, 222)',   // #dedede — aktivní segment na antracitové liště
  white: 'rgb(255, 255, 255)',
  roleRose: 'rgb(191, 64, 110)',     // #bf406e
  roleBlue: 'rgb(16, 117, 172)',     // #1075ac
  roleBrick: 'rgb(161, 74, 28)',     // #a14a1c
  roleGreen: 'rgb(9, 127, 67)',      // #097f43
  roleOchre: 'rgb(141, 103, 43)',    // #8d672b
  roleTeal: 'rgb(11, 122, 117)',     // #0b7a75
}

/** Vypočtená barva pozadí prvku. */
const bg = (el: Locator) => el.evaluate(e => getComputedStyle(e).backgroundColor)

/** Tlačítko Run / Pause / Done v horní liště (podle konce přístupného názvu, glyf může předcházet). */
const runButton = (page: Page, label: 'Run' | 'Pause' | 'Done' | 'Start') =>
  page.getByRole('button', { name: new RegExp(`${label}$`) })

/** Segmentový přepínač, který obsahuje tlačítko s daným textem. */
const groupWith = (page: Page, buttonName: string) =>
  page.getByRole('group').filter({ has: page.getByRole('button', { name: buttonName, exact: true }) })

/**
 * Najde viditelné prvky s vlastním textem menším než 10 px.
 * Vlastní text = přímý textový uzel prvku, aby se nepočítali rodiče s jiným písmem.
 *
 * @returns Seznam „tag: text (velikost)“ pro každý příliš malý prvek
 */
async function tooSmallText(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = []
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
      const ownText = Array.from(el.childNodes).filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent ?? '').join('').trim()
      if (!ownText) continue
      const rect = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      if (rect.width === 0 || rect.height === 0 || style.visibility === 'hidden' || style.display === 'none') continue
      const size = parseFloat(style.fontSize)
      if (size < 10) out.push(`${el.tagName.toLowerCase()}: ${ownText.slice(0, 30)} (${size}px)`)
    }
    return out
  })
}

/**
 * Barvy role čipů na kartách jednotek: pro každý prvek, jehož vlastní text je název role a má
 * neprůhledné pozadí, vrátí pozadí a barvu textu.
 *
 * @param labels - Názvy rolí
 * @returns Mapa název → { bg, color } (první nalezený čip)
 */
async function chipColors(page: Page, labels: string[]): Promise<Record<string, { bg: string; color: string }>> {
  return page.evaluate((names) => {
    const out: Record<string, { bg: string; color: string }> = {}
    for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
      const ownText = Array.from(el.childNodes).filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent ?? '').join('').trim()
      if (!names.includes(ownText) || out[ownText]) continue
      const style = getComputedStyle(el)
      if (style.backgroundColor === 'rgba(0, 0, 0, 0)') continue
      out[ownText] = { bg: style.backgroundColor, color: style.color }
    }
    return out
  }, labels)
}

/**
 * Rozložení horní lišty: kde končí viditelná značka, kde jsou záložky a kde začíná ovládání vpravo.
 * Značku tvoří prvky s šířkou nad 2 px — schovaný název (1 px pro čtečky obrazovky) se nepočítá.
 *
 * @returns Pravý okraj značky, rozsah záložek, levý okraj ovládání, šířka názvu a šířka stránky
 */
async function topBarLayout(page: Page): Promise<{ brandRight: number; tabsLeft: number; tabsRight: number; controlsLeft: number; nameWidth: number; scrollWidth: number }> {
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

test.describe('feat-021: design system Org Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Tutorial overlay by jinak na první návštěvě (i prvním přepnutí do Advanced) blokovala kliknutí
    await page.addInitScript(() => {
      localStorage.setItem('tutorial-completed', 'true')
      localStorage.setItem('tutorial-seen-modes', JSON.stringify(['compare', 'experiment']))
    })
  })

  test('Příklad 3: Run pulzuje v action, za běhu je Pause v accent, po doběhnutí ✓ Done v done', async ({ page }) => {
    test.setTimeout(240_000) // celý běh Compare (2 × 100 features) i na 10× trvá desítky sekund
    await page.goto(BASE)
    const run = runButton(page, 'Run')
    await expect(run).toBeVisible()
    expect(await bg(run)).toBe(RGB.action)
    expect(await run.evaluate(e => getComputedStyle(e).animationName)).not.toBe('none')

    await groupWith(page, '10×').getByRole('button', { name: '10×', exact: true }).click()
    await run.click()
    const pause = runButton(page, 'Pause')
    await expect(pause).toBeVisible()
    // Výplň se mění 0,15s přechodem (stejné tlačítko, jiná varianta) — počkáme na cílovou barvu
    await expect.poll(() => bg(pause)).toBe(RGB.accent)

    const done = runButton(page, 'Done')
    await expect(done).toBeVisible({ timeout: 220_000 })
    await expect(done).toBeDisabled()
    await expect.poll(() => bg(done)).toBe(RGB.done)
  })

  test('Příklad 5: téma se řídí systémem, přepínač ho změní a volba přežije znovunačtení', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto(BASE)
    const html = page.locator('html')
    await expect(html).toHaveAttribute('data-theme', 'dark')

    await page.getByRole('button', { name: 'Switch to light theme' }).click()
    await expect(html).toHaveAttribute('data-theme', 'light')

    await page.reload()
    await expect(html).toHaveAttribute('data-theme', 'light')
    await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible()
  })

  test('Příklad 6: po spuštění simulace nemá žádný viditelný text méně než 10 px', async ({ page }) => {
    await page.goto(BASE)
    await runButton(page, 'Run').click()
    await page.waitForTimeout(1500)
    expect(await tooSmallText(page), 'Compare').toEqual([])

    await page.getByRole('tab', { name: 'Advanced' }).click()
    await runButton(page, 'Start').click()
    await page.waitForTimeout(1500)
    expect(await tooSmallText(page), 'Advanced').toEqual([])

    await page.getByRole('tab', { name: 'Cash Flow' }).click()
    await runButton(page, 'Start').click()
    await page.waitForTimeout(1500)
    expect(await tooSmallText(page), 'Cash Flow').toEqual([])
  })

  test('Příklad 7: v presetu People mají role čipy barvy slotů a bílý text', async ({ page }) => {
    await page.goto(BASE)
    await page.getByRole('tab', { name: 'Advanced' }).click()
    await page.getByRole('button', { name: 'People', exact: true }).click()
    // Potvrzení presetu se ukáže jen tehdy, když by se zahodily ruční úpravy týmu
    const confirm = page.getByRole('button', { name: 'Apply preset' })
    if (await confirm.isVisible()) await confirm.click()

    const colors = await chipColors(page, ['Design', 'Frontend', 'Backend', 'Testing', 'DevOps', 'Data'])
    expect(colors.Design?.bg).toBe(RGB.roleRose)
    expect(colors.Frontend?.bg).toBe(RGB.roleBlue)
    expect(colors.Backend?.bg).toBe(RGB.roleBrick)
    expect(colors.Testing?.bg).toBe(RGB.roleGreen)
    expect(colors.DevOps?.bg).toBe(RGB.roleOchre)
    expect(colors.Data?.bg).toBe(RGB.roleTeal)
    for (const c of Object.values(colors)) expect(c.color).toBe(RGB.white)
  })

  test('Příklad 8: aktivní segment má v panelu výplň ink, na liště ink-on-bar', async ({ page }) => {
    await page.goto(BASE)
    const typeGroup = groupWith(page, 'Single').first()
    expect(await bg(typeGroup.getByRole('button', { name: 'Single', exact: true }))).toBe(RGB.ink)
    // Rychlost stojí na antracitové liště — ink by tam splynul s podkladem, proto ink-on-bar
    const speedGroup = groupWith(page, '10×')
    expect(await bg(speedGroup.getByRole('button', { name: '1×', exact: true }))).toBe(RGB.inkOnBar)

    await page.getByRole('tab', { name: 'Advanced' }).click()
    const advancedSpeed = groupWith(page, '2×')
    expect(await bg(advancedSpeed.getByRole('button', { name: '1×', exact: true }))).toBe(RGB.inkOnBar)
  })

  test('Příklad 11: horní lišta se na projektoru 1024 px nepřekrývá, při 1280 px má celý název', async ({ page }) => {
    for (const width of [1024, 1280]) {
      await page.setViewportSize({ width, height: 768 })
      await page.goto(BASE)
      for (const mode of ['Compare', 'Advanced', 'Cash Flow']) {
        await page.getByRole('tab', { name: mode }).click()
        const bar = await topBarLayout(page)
        const where = `${width} px, ${mode}`
        expect(bar.brandRight, `značka končí před záložkami (${where})`).toBeLessThanOrEqual(bar.tabsLeft)
        expect(bar.tabsRight, `záložky končí před ovládáním (${where})`).toBeLessThanOrEqual(bar.controlsLeft)
        expect(bar.scrollWidth, `bez vodorovného rolování (${where})`).toBeLessThanOrEqual(width)
        if (width === 1280) expect(bar.nameWidth, `celý název je vidět (${where})`).toBeGreaterThan(100)
      }
    }
  })

  test('Příklad 10: písma Archivo a JetBrains Mono jsou přibalená, nic se nestahuje z Google Fonts', async ({ page }) => {
    const googleRequests: string[] = []
    page.on('request', req => { if (req.url().includes('fonts.googleapis.com') || req.url().includes('fonts.gstatic.com')) googleRequests.push(req.url()) })
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')

    const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily)
    expect(bodyFont).toMatch(/Archivo/)
    // Čísla a ID features jsou v mono písmu; next/font pojmenuje rodinu „JetBrains_Mono“ nebo „JetBrains Mono“
    const monoFont = await page.getByText(/^F-001/).first().evaluate(e => getComputedStyle(e).fontFamily)
    expect(monoFont).toMatch(/JetBrains[ _]Mono/)
    expect(await page.evaluate(() => document.fonts.check('16px Archivo') || Array.from(document.fonts).some(f => /Archivo/.test(f.family)))).toBe(true)
    expect(googleRequests).toEqual([])
  })
})
