/**
 * E2E testy pro feat-026 (Přejmenování „Specialization“ na „Skill“ a anglický import z Excelu).
 * Ověřují v reálném prohlížeči to, co jsdom neumí: skutečné stažení šablony ↓ Template a nahrání
 * souboru přes výběr souboru. Texty a pravidla do detailu hlídají unit testy feat-026.
 *
 * Schválený kontrakt: features/feat-026-prejmenovani-specialization-na-skill.md (Příklady 1, 2, 6, 9, 10, 12).
 *
 * Spuštění lokálně: npx playwright test tests/e2e/feat-026-skill-naming.spec.ts
 */

import { readFile } from 'node:fs/promises'
import { test, expect, type Page } from '@playwright/test'
import * as XLSX from 'xlsx'
import { BASE, skipTutorial } from './helpers'

/** MIME typ .xlsx pro nahrání souboru do skrytého výběru souboru. */
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** Řádky z Příkladu 10: dvě featury, čtyři tasky, dvě jednotky. */
const ENGLISH_ROWS = [
  { Feature: 'Login', Skill: 'FE', Unit: 'Squad A', Size: 3 },
  { Feature: 'Login', Skill: 'BE', Unit: 'Squad B', Size: 2 },
  { Feature: 'Search', Skill: 'FE', Unit: 'Squad A', Size: 4 },
  { Feature: 'Search', Skill: 'QA', Unit: 'Squad B', Size: 1 },
]

/** Stejná data ve starém českém formátu (Příklad 12). */
const CZECH_ROWS = ENGLISH_ROWS.map(r => ({ Feature: r.Feature, Specializace: r.Skill, Tym: r.Unit, Velikost: r.Size }))

/**
 * Sestaví .xlsx soubor z řádků (list „Backlog“).
 *
 * @param rows - Řádky souboru; klíče jsou názvy sloupců
 * @returns Obsah souboru pro setInputFiles
 */
function xlsxBuffer(rows: Record<string, unknown>[]): Buffer {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Backlog')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}

/**
 * Otevře aplikaci bez tutoriálu, přepne do Advanced a rozbalí sekci Backlog (je v ní import a šablona).
 *
 * @param page - Stránka Playwrightu
 */
async function openAdvancedBacklog(page: Page): Promise<void> {
  await skipTutorial(page)
  await page.goto(BASE)
  await page.getByRole('tab', { name: 'Advanced' }).click()
  await page.getByRole('button', { name: 'Backlog', exact: true }).click()
}

for (const mode of ['Advanced', 'Cash Flow'] as const) {
  test(`Příklady 1, 2 a 6: ${mode} má sekci „Skills“ a nápovědu „Click + to add a skill“`, async ({ page }) => {
    await skipTutorial(page)
    await page.goto(BASE)
    await page.getByRole('tab', { name: mode }).click()
    await expect(page.getByRole('button', { name: 'Skills', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Specializations', exact: true })).toHaveCount(0)
    await expect(page.getByText('Click + to add a skill', { exact: true })).toBeVisible()
  })
}

test('Příklad 9: ↓ Template stáhne šablonu se sloupci Feature, Skill, Unit, Size', async ({ page }) => {
  await openAdvancedBacklog(page)
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: '↓ Template' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('org-flow-template.xlsx')

  const workbook = XLSX.read(await readFile(await download.path()))
  expect(workbook.SheetNames).toEqual(['Backlog'])
  const [header] = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets.Backlog, { header: 1 })
  expect(header).toEqual(['Feature', 'Skill', 'Unit', 'Size'])
})

test('Příklad 10: import souboru s anglickými sloupci ukáže souhrn s „units“', async ({ page }) => {
  await openAdvancedBacklog(page)
  await page.locator('input[type="file"]').setInputFiles({ name: 'backlog.xlsx', mimeType: XLSX_MIME, buffer: xlsxBuffer(ENGLISH_ROWS) })
  await expect(page.getByText('✓ Imported 2 features, 4 tasks, 2 units.', { exact: true })).toBeVisible()
})

test('Příklad 12: starý soubor s českými sloupci skončí chybou o sloupci „Skill“', async ({ page }) => {
  await openAdvancedBacklog(page)
  await page.locator('input[type="file"]').setInputFiles({ name: 'stary.xlsx', mimeType: XLSX_MIME, buffer: xlsxBuffer(CZECH_ROWS) })
  await expect(page.getByText("× The file has no 'Skill' column. Check the header row.", { exact: true })).toBeVisible()
})
