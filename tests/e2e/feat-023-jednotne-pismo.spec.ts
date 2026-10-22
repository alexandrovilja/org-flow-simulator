/**
 * E2E testy pro feat-023 (Jednotné písmo: celá aplikace v JetBrains Mono).
 * Ověřují v reálném prohlížeči to, co jsdom neumí: vypočtené písmo, velikost a řez, načtená písma,
 * šířky na projektoru 1024 px a vejití tutoriálu do okna.
 *
 * Schválený kontrakt: features/feat-023-jednotne-pismo-textu.md (příklady 1–11).
 *
 * Spuštění lokálně: npx playwright test tests/e2e/feat-023-jednotne-pismo.spec.ts
 */

import { test, expect, type Page } from '@playwright/test'
import * as XLSX from 'xlsx'
import { BASE, MONO, groupWith, runButton, skipTutorial, styleOf, openAccordions, typographyViolations, topBarLayout } from './helpers'

/** Jednoduchý popis textového prvku: vlastní text, písmo, velikost, řez a třída (kvůli rozlišení částí UI). */
interface TextStyle { text: string; family: string; size: string; weight: string; cls: string }

/**
 * Najde viditelné prvky, jejichž vlastní text odpovídá vzorku, a vrátí jejich písmo, velikost a řez.
 * Vlastní text = přímý textový uzel prvku (rodiče s jiným písmem se nepočítají); u `<input>` se čte hodnota.
 *
 * @param page - Stránka Playwrightu
 * @param pattern - Vzorek textu (celý vlastní text prvku)
 * @param scope - CSS selektor kořene hledání (výchozí celé tělo stránky)
 * @returns Seznam nalezených prvků se stylem
 */
async function textStyles(page: Page, pattern: RegExp, scope = 'body'): Promise<TextStyle[]> {
  return page.evaluate(({ source, flags, root }) => {
    const re = new RegExp(source, flags)
    const out: TextStyle[] = []
    for (const el of Array.from(document.querySelector(root)!.querySelectorAll<HTMLElement>('*'))) {
      const own = el instanceof HTMLInputElement && ['text', ''].includes(el.type)
        ? el.value
        : Array.from(el.childNodes).filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent ?? '').join('').trim()
      if (!own || !re.test(own)) continue
      const r = el.getBoundingClientRect()
      const s = getComputedStyle(el)
      if (r.width === 0 || r.height === 0 || s.visibility === 'hidden' || s.display === 'none') continue
      out.push({ text: own, family: s.fontFamily, size: s.fontSize, weight: s.fontWeight, cls: typeof el.className === 'string' ? el.className : '' })
    }
    return out
  }, { source: pattern.source, flags: pattern.flags, root: scope })
}

/** Očekávané písmo: JetBrains Mono v dané velikosti a řezu. */
const expectMono = (items: TextStyle[], size: string, weight: string, label: string) => {
  expect(items.length, `${label}: nic nenalezeno`).toBeGreaterThan(0)
  for (const i of items) {
    expect(i.family, `${label}: ${i.text}`).toMatch(MONO)
    expect(i.size, `${label}: ${i.text}`).toBe(size)
    expect(i.weight, `${label}: ${i.text}`).toBe(weight)
  }
}

/**
 * Otevře aplikaci a počká, až se vykreslí. Simulátor je jen klientský (bez SSR), takže po načtení
 * stránky je chvíli prázdný a měření textů by nic nenašlo.
 *
 * @param page - Stránka Playwrightu
 */
async function openApp(page: Page): Promise<void> {
  await page.goto(BASE)
  await page.getByRole('tablist').waitFor()
}

/** Rozběhne simulaci na 10× a po chvíli ji pozastaví, aby byly vidět karty, jednotky a Done. */
async function runBriefly(page: Page): Promise<void> {
  await groupWith(page, '10×').getByRole('button', { name: '10×', exact: true }).click()
  await runButton(page, 'Run').click()
  await page.waitForTimeout(3000)
  await runButton(page, 'Pause').click()
}

/** Vyvolá potvrzovací dialog v Advanced: přidá jednotku (tým je pak upravený) a zvolí preset People. */
async function openPresetDialog(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^\+ Add (unit|member|team)$/ }).click()
  await page.getByRole('button', { name: 'People', exact: true }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

/** Malý .xlsx soubor pro import (dvě featury, čtyři tasky) — formát podle feat-012. */
function xlsxBuffer(): Buffer {
  const rows = [
    { Feature: 'Login', Skill: 'FE', Unit: 'Squad A', Size: 3 },
    { Feature: 'Login', Skill: 'BE', Unit: 'Squad B', Size: 2 },
    { Feature: 'Search', Skill: 'FE', Unit: 'Squad A', Size: 4 },
    { Feature: 'Search', Skill: 'QA', Unit: 'Squad B', Size: 1 },
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Backlog')
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
}

test.describe('feat-023: jednotné písmo — celá aplikace v JetBrains Mono', () => {
  test.beforeEach(async ({ page }) => {
    await skipTutorial(page)
  })

  for (const url of ['/', '/neexistuje']) {
    test(`Příklad 1: písmo aplikace je JetBrains Mono a Archivo ani Kalam se nenačítá (${url})`, async ({ page }) => {
      const googleRequests: string[] = []
      page.on('request', req => { if (req.url().includes('fonts.googleapis.com') || req.url().includes('fonts.gstatic.com')) googleRequests.push(req.url()) })
      await page.goto(`${BASE}${url}`)
      await page.waitForLoadState('networkidle')

      const info = await page.evaluate(() => {
        // Token --font-mono: dosadíme ho do pomocného prvku a přečteme vypočtené písmo
        const resolve = (css: string) => {
          const probe = document.createElement('div')
          probe.style.fontFamily = css
          document.body.appendChild(probe)
          const family = getComputedStyle(probe).fontFamily
          probe.remove()
          return family
        }
        const faces = Array.from(document.fonts)
        return {
          body: getComputedStyle(document.body).fontFamily,
          mono: resolve('var(--font-mono)'),
          // Zrušené tokeny nesmějí být deklarované (getPropertyValue vrací u neexistující proměnné prázdný řetězec)
          oldTokens: ['--font-display', '--font-sans', '--font-hand'].map(t => getComputedStyle(document.documentElement).getPropertyValue(t).trim()),
          families: [...new Set(faces.map(f => f.family))],
          monoWeights: faces.filter(f => /JetBrains[ _]Mono/.test(f.family)).map(f => f.weight),
        }
      })
      expect(info.body).toMatch(MONO)
      expect(info.mono.split(',')[0]).toMatch(MONO)
      expect(info.oldTokens, 'zrušené tokeny písma').toEqual(['', '', ''])
      expect(info.families.filter(f => /Archivo|Kalam/.test(f)), 'načtená písma').toEqual([])
      // Řez 800 (titulky, tlačítka): buď samostatný soubor, nebo rozsah variabilního písma („100 800“)
      const covers800 = info.monoWeights.some(w => {
        const [from, to] = w.split(' ').map(Number)
        return to ? from <= 800 && 800 <= to : from === 800
      })
      expect(covers800, `řezy JetBrains Mono: ${info.monoWeights.join(', ')}`).toBe(true)
      expect(googleRequests).toEqual([])
    })
  }

  test('Příklad 2: názvy features jsou JetBrains Mono 11 px (500 na kartách a v Done, 400 na řádku práce)', async ({ page }) => {
    await openApp(page)
    const names = /^F-\d{3} /
    const check = (items: TextStyle[], label: string) => {
      expect(items.length, `${label}: nic nenalezeno`).toBeGreaterThan(0)
      for (const i of items) {
        expect(i.family, `${label}: ${i.text}`).toMatch(MONO)
        expect(i.size, `${label}: ${i.text}`).toBe('11px')
        // Řádek práce na kartě jednotky je jemnější (400), karty a řádky Done mají 500
        const expected = /FeatureCard-module__|DoneRow-module__/.test(i.cls) ? '500' : '400'
        expect(i.weight, `${label}: ${i.text}`).toBe(expected)
      }
    }
    check(await textStyles(page, names), 'Compare')

    await page.getByRole('tab', { name: 'Advanced' }).click()
    await runBriefly(page)
    check(await textStyles(page, names), 'Advanced')

    await page.getByRole('tab', { name: 'Cash Flow' }).click()
    check(await textStyles(page, names), 'Cash Flow')
  })

  test('Příklad 3: jména jednotek a členů jsou JetBrains Mono 11 px, řez 600; jméno jde přepsat', async ({ page }) => {
    await openApp(page)
    expectMono(await textStyles(page, /^(Ada|Ben|Chen|Dani|Eli|Fae)$/), '11px', '600', 'Compare: členové')

    await page.getByRole('tab', { name: 'Advanced' }).click()
    expectMono(await textStyles(page, /^Team [A-F]$/), '11px', '600', 'Advanced: jednotky')

    const first = page.locator('input[type="text"]').first()
    await first.fill('Zed')
    await first.press('Enter')
    await expect(first).toHaveValue('Zed')
    await expect(first).not.toBeFocused()
  })

  test('Příklad 4: specializace a chipy rolí jsou JetBrains Mono 11 px', async ({ page }) => {
    await openApp(page)
    await page.getByRole('tab', { name: 'Advanced' }).click()
    await openAccordions(page)

    const specNames = /^(Design|Client Acquisition|Payments|Platform|CRM|Integration Testing)$/
    const inputs = (await textStyles(page, specNames, '[class*="RoleSettings-module__"]')).filter(i => /__input/.test(i.cls))
    expectMono(inputs, '11px', '500', 'názvy specializací')
    expect(inputs.length).toBe(6)

    const placeholder = await styleOf(page.getByPlaceholder('Name…'))
    expect(placeholder.family).toMatch(MONO)
    expect(placeholder.size).toBe('11px')
    const step = await styleOf(page.locator('[class*="RoleSettings-module__"][class*="__stepButton"]').first())
    expect(step.family).toMatch(MONO)
    expect(step.size).toBe('11px')
    for (const text of [/^Phase:$/, /^Req\.:$/]) {
      for (const i of await textStyles(page, text)) {
        expect(i.family, String(text)).toMatch(MONO)
        expect(i.size, String(text)).toBe('11px')
      }
    }
    const help = page.getByText(/1 = first, 2 = second/)
    expect((await styleOf(help)).family).toMatch(MONO)
    expect((await styleOf(help)).size).toBe('11px')

    // Chipy rolí: 11/600, bílý text
    const chip = await styleOf(page.locator('[class*="RoleChip-module__"][class*="__chip"]').first())
    expect(chip.family).toMatch(MONO)
    expect(chip.size).toBe('11px')
    expect(chip.weight).toBe('600')
    expect(chip.color).toBe('rgb(255, 255, 255)')

    // Výběr role na kartě jednotky po kliknutí na „+“
    await page.getByRole('button', { name: 'Add skill' }).first().click()
    const pick = await styleOf(page.locator('[class*="MemberCard-module__"][class*="__pickRole"]').first())
    expect(pick.family).toMatch(MONO)
    expect(pick.size).toBe('11px')
  })

  test('Příklad 5: prázdné stavy, poznámky a popisky jsou JetBrains Mono 11 px', async ({ page }) => {
    await openApp(page)
    expectMono(await textStyles(page, /^(Nothing in flight|None yet)\.?$/), '11px', '400', 'Compare: prázdné stavy')

    await page.getByRole('tab', { name: 'Advanced' }).click()
    expectMono(await textStyles(page, /^Nothing in flight\.$/), '11px', '400', 'Advanced: In progress')
    expectMono(await textStyles(page, /^No completed features yet\.$/), '11px', '400', 'Advanced: Done')
    expectMono(await textStyles(page, /^(auto-scaled|Click \+ to add a skill|\d+ features? sampled)$/), '11px', '400', 'Advanced: poznámky')

    await openAccordions(page)
    expectMono(await textStyles(page, /^(Backlog size|Item size variability)$/), '11px', '500', 'popisky sliderů')
  })

  test('Příklad 5: poznámky u dlaždic metrik v Cash Flow a zprávy po importu jsou mono 11 px', async ({ page }) => {
    await openApp(page)
    await page.getByRole('tab', { name: 'Cash Flow' }).click()
    await groupWith(page, '10×').getByRole('button', { name: '10×', exact: true }).click()
    await runButton(page, 'Run').click()
    await expect(page.getByText('live total')).toBeVisible({ timeout: 30_000 })
    expectMono(await textStyles(page, /^live total$/), '11px', '400', 'hint dlaždice')
    expectMono(await textStyles(page, /^Details/), '11px', '400', 'Details')

    // Zpráva po importu XLS (v Advanced; soubor se nahrává do skrytého výběru souboru)
    await page.getByRole('tab', { name: 'Advanced' }).click()
    await page.getByRole('button', { name: 'Backlog', exact: true }).click()
    await page.locator('input[type="file"]').setInputFiles({ name: 'backlog.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: xlsxBuffer() })
    await expect(page.getByText(/^✓ Imported 2 features/)).toBeVisible()
    expectMono(await textStyles(page, /^✓ Imported/), '11px', '400', 'zpráva po importu')
  })

  test('Příklad 5: stránka 404 — „Page not found“ je JetBrains Mono 11 px', async ({ page }) => {
    await page.goto(`${BASE}/neexistuje`)
    expectMono(await textStyles(page, /^Page not found$/), '11px', '400', '404')
  })

  test('Příklad 6: wordmark, záložky, tlačítka a titulky týmů jsou JetBrains Mono 800 verzálkami', async ({ page }) => {
    await page.goto(BASE) // 1280 px: wordmark je vidět celý (pod 1260 px se schovává)
    const heading = (loc: ReturnType<Page['locator']>, size: string, label: string) => styleOf(loc).then(s => {
      expect(s.family, label).toMatch(MONO)
      expect(s.size, label).toBe(size)
      expect(s.weight, label).toBe('800')
      expect(s.transform, label).toBe('uppercase')
    })
    await heading(page.getByText('Org Flow Simulator', { exact: true }), '15px', 'wordmark')
    for (const tab of ['Compare', 'Advanced', 'Cash Flow']) await heading(page.getByRole('tab', { name: tab }), '13px', `záložka ${tab}`)
    await heading(runButton(page, 'Run'), '13px', 'Run')
    await heading(page.getByRole('button', { name: /Reset$/ }), '13px', 'Reset')
    for (const title of await page.getByRole('heading', { name: /team$/i }).all()) await heading(title, '20px', 'titulek týmu')

    await page.getByRole('tab', { name: 'Advanced' }).click()
    await page.getByRole('button', { name: 'Backlog', exact: true }).click() // „Import XLS“ je v akordeonu Backlog
    await heading(page.getByRole('button', { name: /Import XLS$/ }), '13px', 'Import XLS')
    await page.getByRole('button', { name: 'Skills', exact: true }).click()
    await heading(page.getByRole('button', { name: 'Add', exact: true }), '13px', 'Add')
  })

  test('Příklad 7: text tutoriálu, dialogu a nápověd je v JetBrains Mono', async ({ page }) => {
    await openApp(page)
    // Tutoriál (Compare): popis kroku
    await page.getByRole('button', { name: 'Restart tutorial' }).click()
    const card = page.getByTestId('tutorial-overlay')
    await expect(card).toBeVisible()
    for (const i of await textStyles(page, /./, '[data-testid="tutorial-overlay"]')) {
      expect(i.family, `tutoriál: ${i.text.slice(0, 30)}`).toMatch(MONO)
    }
    await page.getByRole('button', { name: 'Skip tutorial' }).click()

    // Potvrzovací dialog a plovoucí nápověda přepínače v Advanced
    await page.getByRole('tab', { name: 'Advanced' }).click()
    await openPresetDialog(page)
    for (const i of await textStyles(page, /./, '[role="dialog"]')) {
      expect(i.family, `dialog: ${i.text.slice(0, 30)}`).toMatch(MONO)
    }
    await page.getByRole('button', { name: 'Cancel' }).click()

    await page.getByRole('button', { name: 'Team', exact: true }).click()
    await page.getByRole('button', { name: 'Min units', exact: true }).hover()
    const hint = page.getByText(/^WIP: units/)
    await expect(hint).toBeVisible()
    expect((await styleOf(hint)).family).toMatch(MONO)
  })

  test('Příklad 6 a 7: po doběhnutí je titulek výsledku mono 800 (36 px), věta mono a poznámka kouče mono 700 (15 px)', async ({ page }) => {
    test.setTimeout(240_000) // celý běh Compare (2 × 100 features) i na 10× trvá desítky sekund
    await openApp(page)
    await groupWith(page, '10×').getByRole('button', { name: '10×', exact: true }).click()
    await runButton(page, 'Run').click()
    await expect(runButton(page, 'Done')).toBeVisible({ timeout: 220_000 })

    const frame = page.getByRole('status').filter({ hasText: 'Result · avg cycle time' })
    const title = await styleOf(frame.getByRole('heading'))
    expect(title.family).toMatch(MONO)
    expect(title.size).toBe('36px')
    expect(title.weight).toBe('800')
    expect(title.transform).toBe('uppercase')
    const badge = await styleOf(frame.locator('> span').first())
    expect(badge.family).toMatch(MONO)
    expect(badge.weight).toBe('800')

    const reason = await styleOf(frame.getByText(/^(Broader skills|Deep specialisation)/))
    expect(reason.family).toMatch(MONO)
    const note = await styleOf(frame.getByText('same backlog!'))
    expect(note.family).toMatch(MONO)
    expect(note.size).toBe('15px')
    expect(note.weight).toBe('700')
  })

  for (const scheme of ['light', 'dark'] as const) {
    test(`Příklad 8: žádné Archivo ani Kalam, velikosti ze škály a bez emoji — všechny módy, tutoriál i dialog (${scheme} téma)`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme })
      await openApp(page)
      await expect(page.locator('html')).toHaveAttribute('data-theme', scheme)

      await runButton(page, 'Run').click()
      await page.waitForTimeout(1500)
      expect(await typographyViolations(page), 'Compare').toEqual([])

      await page.getByRole('button', { name: 'Restart tutorial' }).click()
      await expect(page.getByTestId('tutorial-overlay')).toBeVisible()
      expect(await typographyViolations(page), 'Compare: tutoriál').toEqual([])
      await page.getByRole('button', { name: 'Skip tutorial' }).click()

      await page.getByRole('tab', { name: 'Advanced' }).click()
      await openAccordions(page)
      await runButton(page, 'Run').click()
      await page.waitForTimeout(1500)
      expect(await typographyViolations(page), 'Advanced').toEqual([])
      await openPresetDialog(page)
      expect(await typographyViolations(page), 'Advanced: dialog').toEqual([])
      await page.getByRole('button', { name: 'Cancel' }).click()

      await page.getByRole('tab', { name: 'Cash Flow' }).click()
      await openAccordions(page)
      await runButton(page, 'Run').click()
      await page.waitForTimeout(1500)
      expect(await typographyViolations(page), 'Cash Flow').toEqual([])
    })
  }

  for (const mode of ['Advanced', 'Cash Flow']) {
    test(`Příklad 9: dlouhé názvy nepřetékají na projektoru 1024 px a při 1280 px jsou jednotky ve třech sloupcích (${mode})`, async ({ page }) => {
      const cards = page.locator('[class*="MemberCard-module__"][class*="__card"]')
      const columns = () => cards.evaluateAll(els => new Set(els.map(e => Math.round(e.getBoundingClientRect().left))).size)

      await page.setViewportSize({ width: 1024, height: 768 })
      await openApp(page)
      await page.getByRole('tab', { name: mode }).click()
      await expect(cards).toHaveCount(6)
      // Dlouhé jméno jednotky a běžící simulace, ať jsou v kartách i názvy features
      const longName = 'Very long team name for the projector'
      await page.locator('input[type="text"]').first().fill(longName)
      await page.locator('input[type="text"]').first().press('Enter')
      await runBriefly(page)

      expect(await columns(), 'dva sloupce karet jednotek pod 1260 px').toBe(2)
      const report = await cards.evaluateAll(els => {
        const problems: string[] = []
        for (const card of els) {
          const k = card.getBoundingClientRect()
          const inspect = card.querySelectorAll<HTMLElement>('input[type="text"], [class*="RoleChip-module__"][class*="__chip"], [class*="__taskName"], [class*="__workName"]')
          for (const el of Array.from(inspect)) {
            const r = el.getBoundingClientRect()
            const label = el instanceof HTMLInputElement ? el.value : (el.textContent ?? '').trim()
            if (r.width && r.right > k.right + 0.5) problems.push(`„${label}“ přesahuje kartu o ${Math.round(r.right - k.right)} px`)
            // Zkrácený text: výpustka a plný název v atributu title; nezkrácený text title nemá
            const truncated = el.scrollWidth > el.clientWidth + 1
            if (r.width && truncated) {
              if (getComputedStyle(el).textOverflow !== 'ellipsis') problems.push(`„${label}“ je oříznutý bez výpustky`)
              if (!(el.getAttribute('title') ?? '').includes(label.replace(/×$/, '').trim())) problems.push(`„${label}“ nemá plný název v title`)
            } else if (r.width && el.hasAttribute('title') && !el.matches('button')) {
              problems.push(`„${label}“ není zkrácený, ale má title`)
            }
          }
        }
        return problems
      })
      expect(report).toEqual([])
      expect(await page.locator('input[type="text"]').first().getAttribute('title')).toBe(longName)
      // Vstup se jménem jednotky má přístupný název, takže ho čtečka nepřečte jen jako hodnotu
      await expect(page.getByRole('textbox', { name: 'Unit name' })).toHaveCount(6)
      expect(await page.evaluate(() => document.documentElement.scrollWidth), 'bez vodorovného rolování').toBeLessThanOrEqual(1024)

      // Specializace v nastavení: dlouhé názvy mají výpustku a title
      await openAccordions(page)
      const specs = await page.locator('[class*="RoleSettings-module__"][class*="__input"]').evaluateAll(els =>
        els.filter(el => el.scrollWidth > el.clientWidth + 1 && !(el.getAttribute('title') ?? '')).map(el => (el as HTMLInputElement).value))
      expect(specs, 'oříznuté specializace bez title').toEqual([])

      await page.setViewportSize({ width: 1280, height: 800 })
      await page.waitForTimeout(300)
      expect(await columns(), 'tři sloupce karet jednotek při 1280 px').toBe(3)
    })
  }

  test('Příklad 9: počet sloupců karet jednotek se řídí šířkou prostředního sloupce', async ({ page }) => {
    const cards = page.locator('[class*="MemberCard-module__"][class*="__card"]')
    const columns = () => cards.evaluateAll(els => new Set(els.map(e => Math.round(e.getBoundingClientRect().left))).size)
    await page.setViewportSize({ width: 1280, height: 800 })
    await openApp(page)
    await page.getByRole('tab', { name: 'Advanced' }).click()
    await expect(cards).toHaveCount(6)
    // [šířka okna, očekávaný počet sloupců]: prostřední sloupec je šířka okna − 600 px (nastavení 320 + metriky 280)
    for (const [width, expected] of [[900, 1], [1024, 2], [1100, 2], [1180, 3], [1280, 3]] as const) {
      await page.setViewportSize({ width, height: 800 })
      await page.waitForTimeout(250)
      expect(await columns(), `šířka okna ${width} px`).toBe(expected)
    }
  })

  test('Příklad 9: v Compare nepřetékají jména členů, chipy a názvy práce ani při 1024 px', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await openApp(page)
    await runBriefly(page)
    const problems = await page.evaluate(() => {
      const out: string[] = []
      const members = Array.from(document.querySelectorAll<HTMLElement>('[class*="ComparePanel-module__"]')).filter(e => e.className.split(' ').some(c => /__member$/.test(c)))
      for (const card of members) {
        const k = card.getBoundingClientRect()
        const inspect = card.querySelectorAll<HTMLElement>('[class*="__memberName"], [class*="RoleChip-module__"][class*="__chip"], [class*="__workName"]')
        for (const el of Array.from(inspect)) {
          const r = el.getBoundingClientRect()
          const label = (el.textContent ?? '').trim()
          if (r.width && r.right > k.right + 0.5) out.push(`„${label}“ přesahuje kartu o ${Math.round(r.right - k.right)} px`)
          const truncated = el.scrollWidth > el.clientWidth + 1
          if (r.width && truncated && !(el.getAttribute('title') ?? '').includes(label)) out.push(`„${label}“ je zkrácený bez title`)
          if (r.width && !truncated && el.hasAttribute('title')) out.push(`„${label}“ není zkrácený, ale má title`)
        }
      }
      return out
    })
    expect(problems).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1024)
  })

  test('Příklad 12: ligatury jsou vypnuté a text s „->“, „!=“, „<=“ se vypíše tak, jak byl napsán', async ({ page }) => {
    await openApp(page)
    await page.getByRole('tab', { name: 'Advanced' }).click()
    const name = 'A -> B != C <= D'
    const input = page.getByRole('textbox', { name: 'Unit name' }).first()
    await input.fill(name)
    await input.press('Enter')
    await expect(input).toHaveValue(name)

    const ligatures = await page.evaluate(() => {
      const pick = (el: Element | null) => (el ? getComputedStyle(el).fontVariantLigatures : 'chybí')
      return {
        body: pick(document.body),
        input: pick(document.querySelector('input[type="text"]')),
        button: pick(document.querySelector('button')),
      }
    })
    expect(ligatures).toEqual({ body: 'none', input: 'none', button: 'none' })
  })

  for (const width of [1024, 1280]) {
    test(`Příklad 10: horní lišta a titulky týmů se vejdou (${width} px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 768 })
      await openApp(page)
      for (const mode of ['Compare', 'Advanced', 'Cash Flow']) {
        await page.getByRole('tab', { name: mode }).click()
        const bar = await topBarLayout(page)
        const where = `${width} px, ${mode}`
        expect(bar.brandRight, `značka končí před záložkami (${where})`).toBeLessThanOrEqual(bar.tabsLeft)
        expect(bar.tabsRight, `záložky končí před ovládáním (${where})`).toBeLessThanOrEqual(bar.controlsLeft)
        expect(bar.scrollWidth, `bez vodorovného rolování (${where})`).toBeLessThanOrEqual(width)
      }
      await page.getByRole('tab', { name: 'Compare' }).click()
      for (const title of await page.getByRole('heading', { name: /team$/i }).all()) {
        const { height, lineHeight } = await title.evaluate(e => ({ height: e.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(e).lineHeight) }))
        expect(height, `titulek týmu se zalomí nejvýš na dva řádky (${width} px)`).toBeLessThanOrEqual(lineHeight * 2 + 1)
      }
    })
  }

  test('Příklad 10: rám výsledku se na projektoru 1024 px vejde', async ({ page }) => {
    test.setTimeout(240_000)
    await page.setViewportSize({ width: 1024, height: 768 })
    await openApp(page)
    await groupWith(page, '10×').getByRole('button', { name: '10×', exact: true }).click()
    await runButton(page, 'Run').click()
    await expect(runButton(page, 'Done')).toBeVisible({ timeout: 220_000 })

    const box = await page.getByRole('status').filter({ hasText: 'Result · avg cycle time' }).boundingBox()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(1024)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1024)
  })

  // Od feat-025 má prohlídku i Cash Flow (a „?“ v ovládání)
  for (const mode of ['Compare', 'Advanced', 'Cash Flow']) {
    test(`Příklad 11: tutoriál ${mode} se na 1024 × 768 vejde do okna na každém kroku`, async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 768 })
      await openApp(page)
      await page.getByRole('tab', { name: mode }).click()
      await page.getByRole('button', { name: 'Restart tutorial' }).click()
      const overlay = page.getByTestId('tutorial-overlay')
      await expect(overlay).toBeVisible()

      for (let step = 1; step <= 30; step++) {
        await page.waitForTimeout(300) // karta se po změně kroku znovu změří a umístí
        const card = overlay.locator('[class*="__card"]')
        const box = (await card.boundingBox())!
        const where = `${mode}, krok ${step}`
        expect(box.x, `${where}: vlevo`).toBeGreaterThanOrEqual(0)
        expect(box.y, `${where}: nahoře`).toBeGreaterThanOrEqual(0)
        expect(box.x + box.width, `${where}: vpravo`).toBeLessThanOrEqual(1024)
        expect(box.y + box.height, `${where}: dole`).toBeLessThanOrEqual(768)
        const clipped = await card.locator('p').evaluate(p => p.scrollHeight > p.clientHeight + 1)
        expect(clipped, `${where}: text je oříznutý`).toBe(false)

        const next = overlay.getByRole('button', { name: 'Next →' })
        if (!(await next.isVisible())) break
        await next.click()
      }
      await expect(overlay.getByRole('button', { name: 'Finish' })).toBeVisible()
    })
  }
})
