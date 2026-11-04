/**
 * E2E testy feat-027 (Čas simulace v pracovních dnech): to, co jsdom neumí — skutečné rozměry dlaždic
 * a automatické zkrácení „37 weeks 2.9 days“ na „37w 2.9d“, když se plná slova nevejdou.
 *
 * Schválený kontrakt (spec features/feat-027-cas-simulace-pracovni-dny.md, Příklad 18 a UI / Design):
 *  - Hodnota Total Time je prvek `data-testid="work-time-value"` s plným `aria-label`.
 *  - Plná slova se píšou vždy; zkratka `w` / `d` jen když se nevejdou do dlaždice (měření v prohlížeči).
 *    Compare při šířce okna 1024 px zkracuje od 10 týdnů, při 1440 px a v pravém sloupci Advanced a
 *    Cash Flow se plná slova vejdou. Po zvětšení okna se vrátí plná slova.
 *  - Hodnota se nikdy nezalamuje ani nepřetéká z dlaždice.
 *  - Přepínač rychlosti má popisek „1× = 1 working day per second“, nápověda importu říká „Size = effort in
 *    working days (man-days)“, badge výnosu je „€X/week“ a náhled křivky mluví o týdnech.
 *
 * Spuštění lokálně: npx playwright test tests/e2e/feat-027-cas-pracovni-dny.spec.ts
 */

import { test, expect } from '@playwright/test'
import { BASE, skipTutorial, runButton, groupWith } from './helpers'

/** Doba čekání na dosažení desítek týdnů simulace při 10× (10 pracovních dnů za reálnou sekundu). */
const LONG_RUN_MS = 40_000

test.describe('feat-027: čas v pracovních dnech', () => {
  test.beforeEach(async ({ page }) => {
    await skipTutorial(page)
  })

  test('Příklad 18: Compare při 1024 px zkrátí dlouhý čas na „w“ a „d“, po zvětšení okna se vrátí plná slova', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.goto(BASE)
    await groupWith(page, '10×').getByRole('button', { name: '10×', exact: true }).click()
    await runButton(page, 'Run').click()

    const timeA = page.getByTestId('work-time-value').first()
    // 10 týdnů = 50 dní: od té doby se „10 weeks 0.0 days“ do dlaždice při 1024 px nevejde
    await expect(timeA).toHaveText(/^(1\d|[2-9]\d)w \d\.\dd$/, { timeout: LONG_RUN_MS })
    await expect(timeA).toHaveAttribute('aria-label', /^\d+ weeks \d\.\d days$/)
    expect(await timeA.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'zkrácený zápis se vejde').toBe(true)

    await page.setViewportSize({ width: 1440, height: 900 })
    await expect(timeA).toHaveText(/^\d+ weeks \d\.\d days$/)
    expect(await timeA.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'plná slova se vejdou').toBe(true)
  })

  test('Advanced: v pravém sloupci zůstanou plná slova i při 1280 px a delším běhu', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto(BASE)
    await page.getByRole('tab', { name: 'Advanced' }).click()
    await groupWith(page, '10×').getByRole('button', { name: '10×', exact: true }).click()
    await runButton(page, 'Run').click()

    const total = page.getByTestId('stat-tile-Total Time').getByTestId('work-time-value')
    await expect(total).toHaveText(/^(1\d|[2-9]\d) weeks \d\.\d days$/, { timeout: LONG_RUN_MS })
    expect(await total.evaluate(el => el.scrollWidth <= el.clientWidth + 1), 'plná slova se vejdou').toBe(true)
  })

  test('Příklad 15: popisek rychlosti říká, že 1× je jeden pracovní den za sekundu', async ({ page }) => {
    await page.goto(BASE)
    await groupWith(page, '10×').hover()
    await expect(page.getByText('1× = 1 working day per second')).toBeVisible()
  })

  test('Příklad 14: pod tlačítky importu v Advanced je nápověda ke sloupci Size', async ({ page }) => {
    await page.goto(BASE)
    await page.getByRole('tab', { name: 'Advanced' }).click()
    await page.getByRole('button', { name: 'Backlog', exact: true }).click()
    await expect(page.getByText('Size = effort in working days (man-days)')).toBeVisible()
  })

  test('Příklady 11 a 13: Cash Flow ukazuje výnos za týden a náhled křivky v týdnech', async ({ page }) => {
    await page.goto(BASE)
    await page.getByRole('tab', { name: 'Cash Flow' }).click()
    await expect(page.getByText(/€\d+\/week/).first()).toBeVisible()
    await expect(page.getByText(/\/tick/)).toHaveCount(0)

    await page.getByRole('button', { name: 'Backlog', exact: true }).click()
    await groupWith(page, 'J-curve').getByRole('button', { name: 'J-curve', exact: true }).click()
    await expect(page.getByText('Revenue per week after delivery · 0–16 weeks · plateau 2× Flat')).toBeVisible()
  })
})
