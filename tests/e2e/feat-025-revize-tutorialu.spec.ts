/**
 * E2E testy pro feat-025 (Revize tutoriálu).
 * Ověřují v reálném prohlížeči to, co jsdom neumí: umístění úvodní karty uprostřed okna, její šířku,
 * otevření odkazu v nové záložce, ostré rohy rámečku zvýraznění a rámeček kolem záložky Cash Flow.
 *
 * Schválený kontrakt: features/feat-025-revize-tutorialu.md (Příklady 1, 2, 8, 15, 17, 18, 19)
 * a schválená maketa docs/feat-025-ui-mockup.html.
 * Vejití karty do okna 1024 × 768 na každém kroku všech tří prohlídek hlídá feat-023 (Příklad 11).
 *
 * Odkazy na úvodní kartě vedou na cizí weby — testy je zachytí a nikam nechodí.
 *
 * Spuštění lokálně: npx playwright test tests/e2e/feat-025-revize-tutorialu.spec.ts
 */

import { test, expect, type Page } from '@playwright/test'
import { BASE, typographyViolations } from './helpers'

/** Velikost okna projektoru, na kterou je tutoriál navržený. */
const VIEWPORT = { width: 1024, height: 768 }

/** Karta tutoriálu (třída `card` z TutorialOverlay.module.css, stejně jako ve feat-023). */
const card = (page: Page) => page.getByTestId('tutorial-overlay').locator('[class*="__card"]')

/** Otevře aplikaci jako nový uživatel (prázdné localStorage) — spustí se úvodní karta. */
async function openFirstVisit(page: Page): Promise<void> {
  await page.setViewportSize(VIEWPORT)
  await page.goto(BASE)
  await expect(page.getByText('WELCOME · 1 / 14')).toBeVisible()
}

test.describe('feat-025: revize tutoriálu', () => {
  test('Příklad 1 a 15: úvodní karta je uprostřed okna, široká 560 px a celá vidět', async ({ page }) => {
    await openFirstVisit(page)
    await expect(page.getByRole('heading', { name: 'Welcome to Org Flow Simulator' })).toBeVisible()
    const box = (await card(page).boundingBox())!
    expect(Math.abs(box.width - 560)).toBeLessThanOrEqual(1)
    // Střed karty je ve středu okna (s tolerancí na zaokrouhlení)
    expect(Math.abs(box.x + box.width / 2 - VIEWPORT.width / 2)).toBeLessThanOrEqual(1.5)
    expect(Math.abs(box.y + box.height / 2 - VIEWPORT.height / 2)).toBeLessThanOrEqual(1.5)
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height).toBeLessThanOrEqual(VIEWPORT.height)
    // Úvodní karta drží typografii aplikace (písmo, typová škála, žádné emoji)
    expect(await typographyViolations(page)).toEqual([])
  })

  test('Příklad 2: odkaz se otevře v nové záložce a prohlídka zůstane na kroku 1', async ({ page, context }) => {
    // Cizí web nenačítáme — odpovíme prázdnou stránkou
    await context.route('https://www.orgtopologies.com/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>ok</p>' }))
    await openFirstVisit(page)
    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      page.getByRole('link', { name: 'Org Topologies' }).click(),
    ])
    expect(popup.url()).toMatch(/^https:\/\/www\.orgtopologies\.com\/?$/)
    await popup.close()
    await expect(page.getByText('WELCOME · 1 / 14')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Welcome to Org Flow Simulator' })).toBeVisible()
  })

  test('Příklad 18 a 19: patička o autorovi má linku nahoře a odkaz na LinkedIn v nové záložce', async ({ page, context }) => {
    // Cizí web nenačítáme — odpovíme prázdnou stránkou
    await context.route('https://www.linkedin.com/**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<p>ok</p>' }))
    await openFirstVisit(page)
    const footer = card(page).locator('footer')
    await expect(footer).toBeVisible()
    await expect(footer).toHaveText("Made by Ilja Alexandrov. I'd be glad to connect with you on LinkedIn.")
    // Patičku od odrážek odděluje tenká linka (1 px nahoře)
    const border = await footer.evaluate(el => {
      const s = getComputedStyle(el)
      return { width: s.borderTopWidth, style: s.borderTopStyle }
    })
    expect(border).toEqual({ width: '1px', style: 'solid' })
    // Patička je celá uvnitř karty (karta se s ní pořád vejde do okna, Příklad 15)
    const cardBox = (await card(page).boundingBox())!
    const footerBox = (await footer.boundingBox())!
    expect(footerBox.y + footerBox.height).toBeLessThanOrEqual(cardBox.y + cardBox.height)
    expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(VIEWPORT.height)

    const [popup] = await Promise.all([
      context.waitForEvent('page'),
      footer.getByRole('link', { name: 'LinkedIn' }).click(),
    ])
    expect(popup.url()).toBe('https://www.linkedin.com/in/ilja-alexandrov')
    await popup.close()
    await expect(page.getByText('WELCOME · 1 / 14')).toBeVisible()
  })

  test('Příklad 17: rámeček zvýraznění má ostré rohy, karta zůstává zaoblená', async ({ page }) => {
    await openFirstVisit(page)
    await page.getByRole('button', { name: 'Next →' }).click()
    await expect(page.getByText('TOP BAR · 2 / 14')).toBeVisible()
    const ring = page.getByTestId('tutorial-ring')
    await expect(ring).toBeVisible()
    const radii = await ring.evaluate(el => {
      const s = getComputedStyle(el)
      return [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius]
    })
    expect(radii).toEqual(['0px', '0px', '0px', '0px'])
    expect(await card(page).evaluate(el => getComputedStyle(el).borderTopLeftRadius)).toBe('12px')
  })

  test('Příklad 8: první přepnutí do Cash Flow spustí prohlídku s rámečkem kolem záložky', async ({ page }) => {
    // Vracející se uživatel: Compare a Advanced už viděl, Cash Flow ještě ne
    await page.addInitScript(() => {
      localStorage.setItem('tutorial-completed', 'true')
      localStorage.setItem('tutorial-seen-modes', JSON.stringify(['compare', 'experiment']))
    })
    await page.setViewportSize(VIEWPORT)
    await page.goto(BASE)
    const tab = page.getByRole('tab', { name: 'Cash Flow' })
    await tab.click()
    await expect(page.getByText('INTRO · 1 / 8')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Flow meets money' })).toBeVisible()
    const ring = (await page.getByTestId('tutorial-ring').boundingBox())!
    const tabBox = (await tab.boundingBox())!
    // Rámeček obepíná záložku ze všech stran
    expect(ring.x).toBeLessThanOrEqual(tabBox.x)
    expect(ring.y).toBeLessThanOrEqual(tabBox.y)
    expect(ring.x + ring.width).toBeGreaterThanOrEqual(tabBox.x + tabBox.width)
    expect(ring.y + ring.height).toBeGreaterThanOrEqual(tabBox.y + tabBox.height)
  })
})
