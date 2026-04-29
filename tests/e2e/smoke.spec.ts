/**
 * Smoke testy — spouštějí se proti live Vercel URL po každém deploy.
 * Cílem není testovat každý detail, ale ověřit, že aplikace vůbec funguje:
 * načte se, simulace se spustí, zobrazí základní UI prvky.
 *
 * Spuštění lokálně: BASE_URL=https://... npx playwright test
 * Spuštění proti localhost: npx playwright test (použije webServer z config)
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'

test.describe('Smoke: základní funkčnost', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE)
  })

  test('stránka se načte a obsahuje hlavní nadpis', async ({ page }) => {
    await expect(page).toHaveTitle(/Org Flow Simulator/i)
    // Nadpis simulátoru musí být viditelný
    await expect(page.getByText('Org Flow Simulator')).toBeVisible()
  })

  test('tlačítko Play je přítomno a klikatelné', async ({ page }) => {
    // Tlačítko play/pause musí existovat ve výchozím stavu
    const playBtn = page.getByRole('button', { name: /▶|play|start/i }).first()
    await expect(playBtn).toBeVisible()
    await expect(playBtn).toBeEnabled()
  })

  test('po kliknutí na Play se timer spustí', async ({ page }) => {
    // Klikneme na Play
    const playBtn = page.getByRole('button', { name: /▶|play|start/i }).first()
    await playBtn.click()

    // Počkáme chvíli a ověříme, že se timer změnil z 00:00.0
    await page.waitForTimeout(600)
    // Timer tile zobrazuje čas — hledáme hodnotu různou od 00:00.0
    const timerValue = page.locator('.mono').first()
    await expect(timerValue).not.toHaveText('00:00.0')
  })

  test('backlog zobrazuje items', async ({ page }) => {
    // Backlog musí obsahovat alespoň jednu feature před spuštěním
    await expect(page.getByText(/F-001/)).toBeVisible()
  })

  test('panel Units zobrazuje členy s rolemi', async ({ page }) => {
    // Panel se nyní jmenuje "Units" (bylo "Team")
    await expect(page.getByText(/Units/i).first()).toBeVisible()
    // Jméno Ada je teď v <input> — hledáme přes hodnotu inputu
    await expect(page.locator('input[value="Ada"]')).toBeVisible()
    // Chipy zobrazují plné názvy specializací
    await expect(page.getByText(/Frontend|Backend|Design|QA|DevOps|Data/).first()).toBeVisible()
  })

  test('statistiky zobrazují Lead Time tile', async ({ page }) => {
    // StatTile s labelem "Avg Lead Time" musí být přítomný
    await expect(page.getByText(/lead time/i).first()).toBeVisible()
  })

  test('po Play → Pause se simulace zastaví', async ({ page }) => {
    const playBtn = page.getByRole('button', { name: /▶|play|start/i }).first()
    await playBtn.click()
    await page.waitForTimeout(300)

    // Klikneme znovu — tlačítko se přepne na Pause
    const pauseBtn = page.getByRole('button', { name: /⏸|pause/i }).first()
    await pauseBtn.click()

    // Počkáme a ověříme, že timer stojí (hodnota se nemění)
    const timerValue = page.locator('.mono').first()
    const before = await timerValue.textContent()
    await page.waitForTimeout(400)
    const after = await timerValue.textContent()
    expect(before).toBe(after)
  })
})
