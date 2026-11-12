/**
 * E2E testy feat-029 (Proč práce čeká, mód Organization inkrement 2): to, co unit testy v jsdom neověří — skutečný
 * posun seznamu In progress po skoku na featuru a rozložení pohledu za běhu na projektoru 1024 × 768.
 *
 * Schválený kontrakt (spec features/feat-029-proc-prace-ceka.md, UI / Design a Příklad 8; analýza H3, J9):
 *  - Za běhu má panel organizace sloupec „Working on“ se štítky featur (tlačítka „F-001“, „F-002 ×2“) a řádky týmů
 *    s šipkou „Show or hide people“.
 *  - Klik na štítek featury featuru v In progress rozbalí, zvýrazní (`data-highlighted="true"`) a posune do viditelné
 *    části seznamu.
 *  - Při 1024 × 768 je pohled za běhu s rozbaleným týmem a rozbalenou featurou bez vodorovného rolování stránky.
 *  Srovnání Idle Time po druhém běhu ověřuje rozšířený test I4 v feat-028-organizace.spec.ts.
 *
 * Spuštění lokálně: npx playwright test tests/e2e/feat-029-proc-prace-ceka.spec.ts
 */

import { test, expect, type Page } from '@playwright/test'
import { BASE, skipTutorial, runButton } from './helpers'

/** Otevře aplikaci v módu Organization, spustí běh při 1× a po chvíli ho pozastaví (lidé jsou rozpracovaní). */
async function openPausedRun(page: Page): Promise<void> {
  await page.goto(BASE)
  await page.getByRole('tab', { name: 'Organization' }).click()
  await runButton(page, 'Run').click()
  await page.waitForTimeout(1500)
  await runButton(page, 'Pause').click()
  await expect(runButton(page, 'Run')).toBeVisible()
}

/** Panel organizace. */
const org = (page: Page) => page.getByRole('region', { name: 'Organization' })

/** Seznam In progress. */
const inProgress = (page: Page) => page.getByRole('region', { name: 'In progress' })

test.describe('feat-029: proč práce čeká (mód Organization, inkrement 2)', () => {
  test.beforeEach(async ({ page }) => {
    await skipTutorial(page)
  })

  test('H3: klik na štítek featury v panelu organizace ji v In progress rozbalí, zvýrazní a ukáže', async ({ page }) => {
    await openPausedRun(page)
    await expect(org(page).getByText('Working on')).toBeVisible()
    // Poslední štítek bývá u featury níž v seznamu, takže je co posouvat
    const chips = org(page).getByRole('button', { name: /^F-\d{3}/ })
    await expect(chips.first()).toBeVisible()
    const chip = chips.last()
    const code = ((await chip.textContent()) ?? '').match(/F-\d{3}/)?.[0]
    expect(code).toBeTruthy()
    await chip.click()

    const row = inProgress(page).locator('[data-testid="org-feature-row"][data-highlighted="true"]')
    await expect(row).toHaveCount(1)
    await expect(row).toBeInViewport()
    await expect(row.getByRole('button', { name: new RegExp(`^${code}\\b`) })).toHaveAttribute('aria-expanded', 'true')
    await expect(row.getByTestId('org-task').first()).toBeVisible()
  })

  test('J9: pohled za běhu s rozbaleným týmem a featurou je při 1024 × 768 bez vodorovného rolování', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await openPausedRun(page)
    await org(page).getByTestId('org-team-row').first().getByRole('button', { name: 'Show or hide people' }).click()
    await expect(org(page).getByTestId('org-person').first()).toBeVisible()
    await inProgress(page).getByTestId('org-feature-row').first().getByRole('button', { name: /^F-\d{3}/ }).click()
    await expect(inProgress(page).getByTestId('org-task').first()).toBeVisible()
    await expect(page.getByTestId('stat-tile-Idle Time')).toBeVisible()
    const noHorizontalScroll = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)
    expect(noHorizontalScroll).toBe(true)
  })
})
