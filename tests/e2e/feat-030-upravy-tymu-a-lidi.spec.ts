/**
 * E2E testy feat-030 (Úpravy týmů a lidí, mód Organization inkrement 3): to, co unit testy v jsdom neověří —
 * skutečné psaní do pole názvu po „+ Add team“ (fokus s označeným textem), celý běh s upravenou organizací
 * v prohlížeči, rozložení rozbalených upravitelných týmů na projektoru 1024 × 768 a obnovení stránky bez uložení úprav.
 *
 * Schválený kontrakt (spec features/feat-030-upravy-tymu-a-lidi.md, UI / Design a Pravidla chování; analýza B6, B8,
 * B9, B10, B11, J9 a R13):
 *  - Panel organizace (region „Organization“) má před během tlačítka „Expand all“ a „+ Add team“, řádky
 *    `data-testid="org-team-row"` s polem „Team name“ a v rozbaleném týmu karty `data-testid="org-person"`
 *    s tlačítky „Add skill“ a „Person actions“ a tlačítko „+ Add person“.
 *  - „+ Add team“ dá fokus do názvu nového týmu s označeným textem, takže psaní ho rovnou přepíše.
 *  - Upravená organizace bez varování doběhne; za běhu ukazuje řádky týmů s novými názvy.
 *  - Organizace se neukládá: po obnovení stránky je zpět výchozí (R13).
 *
 * Spuštění lokálně: npx playwright test tests/e2e/feat-030-upravy-tymu-a-lidi.spec.ts
 */

import { test, expect, type Page } from '@playwright/test'
import { BASE, skipTutorial, runButton, groupWith } from './helpers'

/** Doba čekání na doběhnutí výchozího backlogu (100 featur) při 10×. */
const RUN_TIMEOUT_MS = 90_000

/** Otevře aplikaci v módu Organization. */
async function openOrganization(page: Page): Promise<void> {
  await page.goto(BASE)
  await page.getByRole('tab', { name: 'Organization' }).click()
}

/** Panel organizace. */
const org = (page: Page) => page.getByRole('region', { name: 'Organization' })

/** Řádek týmu podle pozice v panelu. */
const teamRow = (page: Page, index: number) => org(page).getByTestId('org-team-row').nth(index)

/** Pole názvu týmu v řádku podle pozice. */
const nameInput = (page: Page, index: number) => teamRow(page, index).getByRole('textbox', { name: 'Team name' })

/** Karta člověka v řádku týmu podle jména. */
const personCard = (page: Page, index: number, name: string) =>
  teamRow(page, index).getByTestId('org-person').filter({ hasText: name })

/** Je stránka bez vodorovného rolování? */
const noHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)

test.describe('feat-030: úpravy týmů a lidí (mód Organization, inkrement 3)', () => {
  test.beforeEach(async ({ page }) => {
    await skipTutorial(page)
  })

  test('postavení organizace při 1024 × 768: přejmenování, nový tým s člověkem a skillem, přesun a celý běh', async ({ page }) => {
    test.setTimeout(2 * RUN_TIMEOUT_MS)
    await page.setViewportSize({ width: 1024, height: 768 })
    await openOrganization(page)
    await org(page).getByRole('button', { name: 'Expand all' }).click()

    // B6: přejmenování Team Web
    await nameInput(page, 2).fill('Portal')
    await nameInput(page, 2).press('Enter')
    await expect(nameInput(page, 2)).toHaveValue('Portal')

    // B8: nový tým — fokus s označeným textem, psaní název přepíše
    await org(page).getByRole('button', { name: '+ Add team' }).click()
    await expect(nameInput(page, 3)).toBeFocused()
    await page.keyboard.type('Platform')
    await page.keyboard.press('Enter')
    await expect(nameInput(page, 3)).toHaveValue('Platform')
    await teamRow(page, 3).getByRole('button', { name: 'Add mandate' }).click()
    await page.getByRole('menuitem', { name: 'WEB Web portal' }).click()

    // B9 a B10: nový člověk se skillem Frontend
    await teamRow(page, 3).getByRole('button', { name: '+ Add person' }).click()
    await personCard(page, 3, 'Person 13').getByRole('button', { name: 'Add skill' }).click()
    await page.getByRole('menuitem', { name: 'Frontend' }).click()
    await expect(personCard(page, 3, 'Person 13').getByRole('button', { name: 'Remove skill Frontend' })).toBeVisible()

    // B11: Hana z Portal do Team Billing (Frontend ve WEB teď umí Person 13 z Platform)
    await personCard(page, 2, 'Hana').getByRole('button', { name: 'Person actions' }).click()
    await page.getByRole('menuitem', { name: 'Move to Team Billing' }).click()
    await expect(personCard(page, 0, 'Hana')).toBeVisible()

    await expect(org(page).getByText('4 teams · 13 people')).toBeVisible()
    await expect(org(page).getByRole('alert')).toHaveCount(0)
    expect(await noHorizontalScroll(page), 'před během s rozbalenými týmy').toBe(true)

    await groupWith(page, '10×').getByRole('button', { name: '10×', exact: true }).click()
    await runButton(page, 'Run').click()
    await expect(org(page).getByText('Platform')).toBeVisible()
    await expect(org(page).getByText('Portal')).toBeVisible()
    expect(await noHorizontalScroll(page), 'za běhu').toBe(true)
    await expect(runButton(page, 'Done')).toBeVisible({ timeout: RUN_TIMEOUT_MS })
  })

  test('R13: po obnovení stránky jsou úpravy pryč a organizace je zpět výchozí', async ({ page }) => {
    await openOrganization(page)
    await nameInput(page, 2).fill('Portal')
    await nameInput(page, 2).press('Enter')
    await org(page).getByRole('button', { name: '+ Add team' }).click()
    await expect(org(page).getByText('4 teams · 12 people')).toBeVisible()

    await page.reload()
    await page.getByRole('tab', { name: 'Organization' }).click()
    await expect(org(page).getByTestId('org-team-row')).toHaveCount(3)
    await expect(nameInput(page, 2)).toHaveValue('Team Web')
    await expect(org(page).getByText('3 teams · 12 people')).toBeVisible()
  })
})
