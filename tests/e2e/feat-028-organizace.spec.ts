/**
 * E2E testy feat-028 inkrement 1 (Mandáty a tok práce): to, co unit testy v jsdom neověří — skutečné načtení stránky,
 * obnovení bez uložení organizace, celý běh se srovnáním po změně mandátu, přepnutí módů a rozložení na projektoru
 * 1024 × 768.
 *
 * Schválený kontrakt (spec features/feat-028-tymy-slozene-z-lidi.md; analýza A1, A5, I1, I4, I6, J9):
 *  - Záložka „Organization“; panel organizace je region „Organization“ s řádky `data-testid="org-team-row"`.
 *  - Organizace se neukládá: po obnovení stránky je zpět výchozí organizace.
 *  - Od prvního Run jsou mandáty zamčené (i v pauze) do Resetu.
 *  - Po Resetu, změně mandátu a druhém doběhnutém běhu mají dlaždice Total Time, Avg Cycle Time a Avg WIP řádek
 *    „vs prev run“.
 *  - Přepnutí na jiný mód běh pozastaví; po návratu je stav zachovaný.
 *  - Při 1024 × 768 je mód použitelný bez vodorovného rolování stránky.
 *
 * Spuštění lokálně: npx playwright test tests/e2e/feat-028-organizace.spec.ts
 */

import { test, expect, type Page } from '@playwright/test'
import { BASE, skipTutorial, runButton, groupWith } from './helpers'

/** Doba čekání na doběhnutí výchozího backlogu (100 featur) při 10×. */
const RUN_TIMEOUT_MS = 90_000

/** Pořadí týmů výchozí organizace v panelu. */
const TEAM_INDEX = { 'Team Billing': 0, 'Team Mobile': 1, 'Team Web': 2 } as const

/** Otevře aplikaci v módu Organization. */
async function openOrganization(page: Page): Promise<void> {
  await page.goto(BASE)
  await page.getByRole('tab', { name: 'Organization' }).click()
}

/** Panel organizace. */
const org = (page: Page) => page.getByRole('region', { name: 'Organization' })

/** Řádek týmu výchozí organizace podle jeho pozice v panelu. */
function teamRow(page: Page, name: keyof typeof TEAM_INDEX) {
  return org(page).getByTestId('org-team-row').nth(TEAM_INDEX[name])
}

/** Přidá týmu mandát přes tlačítko + a nabídku. */
async function addMandate(page: Page, teamName: keyof typeof TEAM_INDEX, item: string): Promise<void> {
  await teamRow(page, teamName).getByRole('button', { name: 'Add mandate' }).click()
  await page.getByRole('menuitem', { name: item }).click()
}

/** Nastaví 10×, spustí běh a počká na „✓ Done“. */
async function runToDone(page: Page): Promise<void> {
  await groupWith(page, '10×').getByRole('button', { name: '10×', exact: true }).click()
  await runButton(page, 'Run').click()
  await expect(runButton(page, 'Done')).toBeVisible({ timeout: RUN_TIMEOUT_MS })
}

test.describe('feat-028: mód Organization (inkrement 1)', () => {
  test.beforeEach(async ({ page }) => {
    await skipTutorial(page)
  })

  test('A1: záložka Organization ukáže 3 týmy po 4 lidech, 100 featur a aktivní Run', async ({ page }) => {
    await openOrganization(page)
    await expect(page.getByRole('tab', { name: 'Organization' })).toHaveAttribute('aria-selected', 'true')
    await expect(org(page).getByTestId('org-team-row')).toHaveCount(3)
    await expect(org(page).getByText('3 teams · 12 people')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Backlog' }).getByTestId('org-backlog-item')).toHaveCount(100)
    await expect(runButton(page, 'Run')).toBeEnabled()
  })

  test('A5: po obnovení stránky je zpět výchozí organizace (nic se neukládá)', async ({ page }) => {
    await openOrganization(page)
    await addMandate(page, 'Team Mobile', 'WEB Web portal')
    await expect(teamRow(page, 'Team Mobile').getByRole('button', { name: /^Remove mandate / })).toHaveCount(2)

    await page.reload()
    await page.getByRole('tab', { name: 'Organization' }).click()
    await expect(teamRow(page, 'Team Mobile').getByRole('button', { name: /^Remove mandate / })).toHaveCount(1)
  })

  test('I1: po Run i v pauze jsou mandáty zamčené', async ({ page }) => {
    await openOrganization(page)
    await runButton(page, 'Run').click()
    await expect(org(page).getByText('Skills, AI and mandates are locked during the run')).toBeVisible()
    await expect(org(page).getByRole('button', { name: 'Add mandate' })).toHaveCount(0)
    await runButton(page, 'Pause').click()
    await expect(org(page).getByText('Skills, AI and mandates are locked during the run')).toBeVisible()
    await expect(org(page).getByRole('button', { name: /^Remove mandate / })).toHaveCount(0)
  })

  test('I4: po Resetu a změně mandátu má druhý doběhnutý běh u dlaždic „vs prev run“', async ({ page }) => {
    test.setTimeout(3 * RUN_TIMEOUT_MS)
    await openOrganization(page)
    await runToDone(page)
    await page.getByRole('button', { name: /Reset$/ }).click()
    await addMandate(page, 'Team Mobile', 'WEB Web portal')
    await runToDone(page)
    for (const label of ['Total Time', 'Avg Cycle Time', 'Avg WIP']) {
      await expect(page.getByTestId(`stat-tile-${label}`).getByText('vs prev run')).toBeVisible()
    }
  })

  test('I6: přepnutí na Cash Flow a zpět běh pozastaví a zachová stav běhu', async ({ page }) => {
    await openOrganization(page)
    await groupWith(page, '10×').getByRole('button', { name: '10×', exact: true }).click()
    await runButton(page, 'Run').click()
    await page.waitForTimeout(1500)
    await page.getByRole('tab', { name: 'Cash Flow' }).click()
    await page.getByRole('tab', { name: 'Organization' }).click()
    await expect(runButton(page, 'Run')).toBeVisible()
    const total = page.getByTestId('stat-tile-Total Time').getByTestId('work-time-value')
    const before = await total.textContent()
    expect(before).not.toBe('0.0 days')
    await page.waitForTimeout(1000)
    expect(await total.textContent()).toBe(before)
    await expect(org(page).getByText('Skills, AI and mandates are locked during the run')).toBeVisible()
  })

  test('J9: při 1024 × 768 je mód před během i za běhu bez vodorovného rolování stránky', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await openOrganization(page)
    const noHorizontalScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)
    expect(await noHorizontalScroll(), 'před během').toBe(true)
    await runButton(page, 'Run').click()
    await page.waitForTimeout(1000)
    expect(await noHorizontalScroll(), 'za běhu').toBe(true)
    await expect(org(page)).toBeVisible()
    await expect(page.getByRole('region', { name: 'In progress' })).toBeVisible()
  })
})
