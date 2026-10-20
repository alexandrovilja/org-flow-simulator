/**
 * Smoke testy — spouštějí se proti live Vercel URL po každém deploy.
 * Cílem není testovat každý detail, ale ověřit, že aplikace vůbec funguje:
 * načte se, simulace se spustí, zobrazí základní UI prvky.
 *
 * Výchozí mód po načtení je Compare (feat-009) — dva týmy vedle sebe, tlačítko Run v horní liště.
 *
 * Spuštění lokálně: BASE_URL=https://... npx playwright test
 * Spuštění proti localhost: npx playwright test (použije webServer z config)
 */

import { test, expect, type Page } from '@playwright/test'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'

/** Tlačítko Run / Pause v horní liště Compare (podle konce přístupného názvu, glyf ▶ / ❙❙ předchází). */
const runButton = (page: Page, label: 'Run' | 'Pause') =>
  page.getByRole('button', { name: new RegExp(`${label}$`) })

/**
 * Hodnota dlaždice Total Time prvního týmu v Compare.
 * Dlaždice v Compare nemá data-testid — hodnota je prvek hned za popiskem.
 */
const totalTimeValue = (page: Page) =>
  page.getByText('Total Time', { exact: true }).first().locator('xpath=following-sibling::div[1]')

test.describe('Smoke: základní funkčnost', () => {
  test.beforeEach(async ({ page }) => {
    // Tutorial overlay (feat-013) by jinak na první návštěvě (i prvním přepnutí do Advanced) blokovala kliknutí
    await page.addInitScript(() => {
      localStorage.setItem('tutorial-completed', 'true')
      localStorage.setItem('tutorial-seen-modes', JSON.stringify(['compare', 'experiment']))
    })
    await page.goto(BASE)
  })

  test('stránka se načte a obsahuje hlavní nadpis', async ({ page }) => {
    await expect(page).toHaveTitle(/Org Flow Simulator/i)
    // Nadpis simulátoru musí být viditelný
    await expect(page.getByText('Org Flow Simulator')).toBeVisible()
  })

  test('tlačítko Run je přítomno a klikatelné', async ({ page }) => {
    // Tlačítko Run musí existovat ve výchozím stavu
    const runBtn = runButton(page, 'Run')
    await expect(runBtn).toBeVisible()
    await expect(runBtn).toBeEnabled()
  })

  test('po kliknutí na Run se timer spustí', async ({ page }) => {
    await runButton(page, 'Run').click()

    // Před spuštěním ukazuje Total Time „—“, za běhu čas ve formátu mm:ss.d — hledáme hodnotu různou od 00:00.0
    const timerValue = totalTimeValue(page)
    await expect(timerValue).toHaveText(/^\d{2}:\d{2}\.\d$/)
    await expect(timerValue).not.toHaveText('00:00.0')
  })

  test('backlog zobrazuje items', async ({ page }) => {
    // Backlog musí obsahovat alespoň jednu feature před spuštěním.
    // Compare má dva týmy se stejným backlogem, F-001 je na stránce dvakrát.
    await expect(page.getByText(/F-001/).first()).toBeVisible()
  })

  test('panel Units v Advanced zobrazuje jednotky se specializacemi', async ({ page }) => {
    // Panel Units je jen v módu Advanced, Compare ukazuje pevné týmy (feat-009)
    await page.getByRole('tab', { name: 'Advanced' }).click()
    await expect(page.getByRole('heading', { name: /^Units/ })).toBeVisible()
    // Výchozí preset je Teams (feat-014) — jméno jednotky je v <input>, hledáme přes hodnotu inputu
    await expect(page.locator('input[value="Team A"]')).toBeVisible()
    // Chipy zobrazují plné názvy specializací (Client Acquisition, ne zkratku ACQ)
    await expect(page.getByText('Client Acquisition')).toBeVisible()
  })

  test('statistiky zobrazují Cycle Time tile', async ({ page }) => {
    // Metrika Lead Time byla nahrazena Cycle Time (feat-010) — dlaždice „Avg Cycle Time“ má každý tým
    await expect(page.getByText('Avg Cycle Time', { exact: true }).first()).toBeVisible()
  })

  test('po Run → Pause se simulace zastaví', async ({ page }) => {
    await runButton(page, 'Run').click()

    // Simulace musí opravdu běžet — stojící „—“ by jinak test splnil i bez spuštění
    const timerValue = totalTimeValue(page)
    await expect(timerValue).not.toHaveText('—')

    // Za běhu se tlačítko přepne na Pause, po kliknutí se vrátí na Run
    await runButton(page, 'Pause').click()
    await expect(runButton(page, 'Run')).toBeVisible()

    // Počkáme a ověříme, že timer stojí (hodnota se nemění)
    const before = await timerValue.textContent()
    await page.waitForTimeout(400)
    const after = await timerValue.textContent()
    expect(before).toBe(after)
  })
})
