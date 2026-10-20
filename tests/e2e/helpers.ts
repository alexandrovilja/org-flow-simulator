/**
 * Sdílené pomocné funkce pro E2E testy (feat-021, feat-022): adresa aplikace, přeskočení tutoriálu
 * a hledání ovládacích prvků v horní liště. Playwright tenhle soubor nespouští jako test
 * (nekončí na .spec.ts), jen ho importují testy.
 */

import type { Page, Locator } from '@playwright/test'

/** Adresa testované aplikace; v CI se dá přepsat proměnnou BASE_URL (např. na produkci). */
export const BASE = process.env.BASE_URL ?? 'http://localhost:3000'

/**
 * Označí tutoriál jako dokončený a všechny módy jako viděné ještě před načtením stránky.
 * Tutorial overlay by jinak na první návštěvě (i při prvním přepnutí do Advanced) blokoval kliknutí.
 *
 * @param page - Stránka Playwrightu
 */
export async function skipTutorial(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('tutorial-completed', 'true')
    localStorage.setItem('tutorial-seen-modes', JSON.stringify(['compare', 'experiment']))
  })
}

/**
 * Tlačítko Run / Start / Pause / Done v horní liště — podle konce přístupného názvu,
 * protože popisku může předcházet glyf (▶, ❙❙, ✓).
 *
 * @param page - Stránka Playwrightu
 * @param label - Konec názvu tlačítka
 * @returns Locator tlačítka
 */
export function runButton(page: Page, label: 'Run' | 'Start' | 'Pause' | 'Done'): Locator {
  return page.getByRole('button', { name: new RegExp(`${label}$`) })
}

/**
 * Segmentový přepínač (role="group"), který obsahuje tlačítko s daným textem.
 *
 * @param page - Stránka Playwrightu
 * @param buttonName - Přesný text jednoho segmentu, např. „10×“ nebo „Single“
 * @returns Locator skupiny
 */
export function groupWith(page: Page, buttonName: string): Locator {
  return page.getByRole('group').filter({ has: page.getByRole('button', { name: buttonName, exact: true }) })
}
