/**
 * E2E testy pro feat-024 (Zpětná vazba od uživatelů).
 * Ověřují v reálném prohlížeči to, co jsdom neumí: rozložení lišty a dialogu na projektoru 1024 × 768,
 * typografii dialogu, skutečný požadavek na Web3Forms a ztrátu konceptu po obnovení stránky.
 *
 * Schválený kontrakt: features/feat-024-zpetna-vazba-uzivatelu.md (příklady 1, 3, 9, 11, 12, 13).
 * Krok tutoriálu (příklad 14) na 1024 × 768 pokrývá test „tutoriál se vejde do okna“ ve feat-023.
 *
 * Každý test zachytí požadavky na api.web3forms.com — skutečný e-mail se nikdy neodešle.
 *
 * Spuštění lokálně: npx playwright test tests/e2e/feat-024-zpetna-vazba.spec.ts
 */

import { test, expect, type Page, type Request } from '@playwright/test'
import { BASE, runButton, skipTutorial, topBarLayout, typographyViolations } from './helpers'

/** Adresa služby, přes kterou zpětná vazba odchází. */
const WEB3FORMS = 'https://api.web3forms.com/**'

/** Názvy tří módů tak, jak je mají záložky v liště. */
const MODES = ['Compare', 'Advanced', 'Cash Flow'] as const

/** Otevřený dialog zpětné vazby. */
const dialog = (page: Page) => page.getByRole('dialog')

/** Otevře dialog kliknutím na ikonu bubliny v liště. */
const openFeedback = (page: Page) => page.getByRole('button', { name: 'Send feedback' }).click()

/**
 * Zachytí požadavky na Web3Forms a odpoví na ně podle `reply`.
 *
 * @param page - Stránka Playwrightu
 * @param reply - `success` = služba přijme, `reject` = odmítne, `offline` = spojení selže
 * @returns Seznam zachycených požadavků (plní se průběžně)
 */
async function interceptWeb3Forms(page: Page, reply: 'success' | 'reject' | 'offline'): Promise<Request[]> {
  const requests: Request[] = []
  await page.route(WEB3FORMS, async route => {
    requests.push(route.request())
    if (reply === 'offline') return route.abort('internetdisconnected')
    return route.fulfill({ status: 200, contentType: 'application/json', json: { success: reply === 'success' } })
  })
  return requests
}

test.describe('feat-024: zpětná vazba od uživatelů', () => {
  test.beforeEach(async ({ page }) => {
    await skipTutorial(page)
  })

  test('Příklad 1: na projektoru 1024 px je ikona vidět ve všech módech a lišta se nepřekrývá', async ({ page }) => {
    await interceptWeb3Forms(page, 'success')
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.goto(BASE)
    for (const mode of MODES) {
      await page.getByRole('tab', { name: mode }).click()
      const icon = page.getByRole('button', { name: 'Send feedback' })
      await expect(icon, mode).toBeVisible()
      const bar = await topBarLayout(page)
      expect(bar.tabsRight, `záložky končí před ovládáním (${mode})`).toBeLessThanOrEqual(bar.controlsLeft)
      expect(bar.scrollWidth, `bez vodorovného rolování (${mode})`).toBeLessThanOrEqual(1024)
      // Ikona a přepínač tématu stojí na stejném řádku, ikona vlevo
      const iconBox = (await icon.boundingBox())!
      const themeBox = (await page.getByRole('button', { name: /^Switch to (dark|light) theme$/ }).boundingBox())!
      expect(iconBox.x + iconBox.width, mode).toBeLessThanOrEqual(themeBox.x)
      expect(Math.abs(iconBox.y - themeBox.y), mode).toBeLessThan(1)
    }
  })

  test('Příklad 13: dialog se na 1024 × 768 vejde do okna bez posouvání a drží typografii aplikace', async ({ page }) => {
    await interceptWeb3Forms(page, 'success')
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.goto(BASE)
    await openFeedback(page)
    const box = (await dialog(page).boundingBox())!
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height).toBeLessThanOrEqual(768)
    expect(await dialog(page).evaluate(d => d.scrollHeight <= d.clientHeight + 1), 'obsah dialogu se neposouvá').toBe(true)
    expect(await typographyViolations(page)).toEqual([])
  })

  test('Příklad 3: otevření dialogu zastaví běžící simulaci', async ({ page }) => {
    await interceptWeb3Forms(page, 'success')
    await page.goto(BASE)
    await page.getByRole('tab', { name: 'Advanced' }).click()
    await runButton(page, 'Run').click()
    await expect(runButton(page, 'Pause')).toBeVisible()

    await openFeedback(page)
    await expect(runButton(page, 'Run')).toBeAttached()
    await expect(runButton(page, 'Pause')).toHaveCount(0)

    await dialog(page).getByRole('button', { name: 'Cancel' }).click()
    await expect(runButton(page, 'Run')).toBeVisible()
  })

  test('Příklad 9: odeslání pošle na Web3Forms jen vyplněné údaje, mód a datum a ukáže poděkování', async ({ page }) => {
    const requests = await interceptWeb3Forms(page, 'success')
    await page.goto(BASE)
    await openFeedback(page)
    await dialog(page).getByRole('button', { name: 'Agile coach' }).click()
    await dialog(page).getByRole('button', { name: '4 – Very useful' }).click()
    await expect(dialog(page).getByText('Very useful', { exact: true })).toBeVisible()
    await dialog(page).getByRole('textbox', { name: "What's missing or what would you improve?" }).fill('Save a team setup.')
    await dialog(page).getByRole('button', { name: 'Send' }).click()

    await expect(dialog(page).getByRole('heading', { name: 'Thanks for your feedback.' })).toBeVisible()
    expect(requests).toHaveLength(1)
    const body = requests[0].postDataJSON() as Record<string, unknown>
    expect(requests[0].method()).toBe('POST')
    expect(body).toMatchObject({
      Role: 'Agile coach',
      Usefulness: '4 – Very useful',
      'What helped': '—',
      "What's missing": 'Save a team setup.',
      'Open to a call': 'no',
      Mode: 'Compare',
      botcheck: false,
    })
    expect(body.Date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(body).not.toHaveProperty('email')

    await dialog(page).getByRole('button', { name: 'Close' }).click()
    await expect(dialog(page)).toHaveCount(0)
  })

  test('Příklad 11: bez připojení zůstane dialog vyplněný a ukáže chybu', async ({ page }) => {
    await interceptWeb3Forms(page, 'offline')
    await page.goto(BASE)
    await openFeedback(page)
    await dialog(page).getByRole('button', { name: '3 – Moderately useful' }).click()
    await dialog(page).getByRole('textbox', { name: 'What helped you most?' }).fill('Compare mode')
    await dialog(page).getByRole('button', { name: 'Send' }).click()

    await expect(dialog(page).getByText("Couldn't send your feedback. Check your connection and try again.")).toBeVisible()
    await expect(dialog(page).getByRole('textbox', { name: 'What helped you most?' })).toHaveValue('Compare mode')
    await expect(dialog(page).getByRole('button', { name: 'Send' })).toBeEnabled()
  })

  test('Příklad 12: rozepsaný text přežije zavření dialogu, ale ne obnovení stránky', async ({ page }) => {
    const requests = await interceptWeb3Forms(page, 'success')
    await page.goto(BASE)
    await openFeedback(page)
    await dialog(page).getByRole('button', { name: '3 – Moderately useful' }).click()
    await dialog(page).getByRole('textbox', { name: "What's missing or what would you improve?" }).fill('More scenarios')
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toHaveCount(0)

    await openFeedback(page)
    await expect(dialog(page).getByRole('textbox', { name: "What's missing or what would you improve?" })).toHaveValue('More scenarios')
    await expect(dialog(page).getByRole('button', { name: '3 – Moderately useful' })).toHaveAttribute('aria-pressed', 'true')

    await page.reload()
    await openFeedback(page)
    await expect(dialog(page).getByRole('textbox', { name: "What's missing or what would you improve?" })).toHaveValue('')
    await expect(dialog(page).getByRole('button', { name: '3 – Moderately useful' })).toHaveAttribute('aria-pressed', 'false')
    expect(requests).toHaveLength(0)
  })

  test('Příklad 13: Tab drží fokus v dialogu a Esc vrátí fokus na ikonu', async ({ page }) => {
    await interceptWeb3Forms(page, 'success')
    await page.goto(BASE)
    const icon = page.getByRole('button', { name: 'Send feedback' })
    await icon.focus()
    await page.keyboard.press('Enter')
    await expect(dialog(page)).toBeVisible()

    // Projde dvakrát víc prvků, než dialog má — fokus nesmí nikdy opustit dialog
    for (let i = 0; i < 30; i++) {
      await page.keyboard.press('Tab')
      expect(await dialog(page).evaluate(d => d.contains(document.activeElement)), `Tab č. ${i + 1}`).toBe(true)
    }

    await page.keyboard.press('Escape')
    await expect(dialog(page)).toHaveCount(0)
    await expect(icon).toBeFocused()
  })
})
