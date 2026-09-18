/**
 * E2E testy pro Cash Flow mód (feat-015) — Fáze 3 (UI Design) checkpoint.
 * Ověřují uživatelský flow nad mock daty z src/components/CashFlowPanel.tsx.
 * Na rozdíl od tests/unit/simulation/feat-015-cash-flow-mod.test.ts (engine logika,
 * zatím neimplementována) tyto testy mohou projít hned — UI z Fáze 3 už existuje.
 *
 * Spuštění lokálně: npx playwright test tests/e2e/feat-015-cash-flow-mod.spec.ts
 */

import { test, expect } from '@playwright/test'

const BASE = process.env.BASE_URL ?? 'http://localhost:3000'

test.describe('Cash Flow mód (feat-015)', () => {
  test.beforeEach(async ({ page }) => {
    // Tutorial overlay by jinak na první návštěvě blokovala kliknutí na tab.
    await page.addInitScript(() => localStorage.setItem('tutorial-completed', 'true'))
    await page.goto(BASE)
    await page.getByRole('button', { name: /Cash Flow/i }).click()
  })

  test('přepnutí na Cash Flow tab zobrazí Backlog, In Progress, Metrics a Done panely', async ({ page }) => {
    await expect(page.getByText('Backlog', { exact: true })).toBeVisible()
    await expect(page.getByText('In Progress', { exact: true })).toBeVisible()
    await expect(page.getByText('Metrics', { exact: true })).toBeVisible()
    await expect(page.getByText('Done', { exact: true })).toBeVisible()
  })

  test('karty v backlogu zobrazují revenue badge ve formátu €X/tick', async ({ page }) => {
    await expect(page.getByText(/€\d+\/tick/).first()).toBeVisible()
  })

  test('panel metrik obsahuje dlaždici Total Revenue', async ({ page }) => {
    // StatTile label obsahuje i "?" tooltip ikonu ve stejném elementu — exact match by selhal.
    await expect(page.getByText(/Total Revenue/)).toBeVisible()
  })

  test('po kliknutí na Start se Total Time změní z 00:00.0', async ({ page }) => {
    const startBtn = page.getByRole('button', { name: /▶ Start/i })
    await expect(startBtn).toBeVisible()
    await startBtn.click()

    await page.waitForTimeout(600)
    // Cíleno na Total Time StatTile přes data-testid — .mono selektor by mimoděk
    // trefil header SpeedControl tlačítka (0.5×/1×/…), která jsou v DOM dřív a nikdy
    // nemění text, takže by test procházel i při rozbitém tikání.
    const timerValue = page.getByTestId('stat-tile-Total Time').locator('.mono')
    await expect(timerValue).not.toHaveText('00:00.0')
  })
})
