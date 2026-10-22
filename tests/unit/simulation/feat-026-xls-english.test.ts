import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import * as XLSX from 'xlsx'
import { useCashFlowSimSetup } from '@/hooks/useCashFlowSimSetup'
import { parseRows, formatImportSummary, downloadTemplate } from '@/lib/xlsImport'
import type { SimSettings, SimState } from '@/types/simulation'

// feat-026 (Přejmenování „Specialization“ na „Skill“) — import z Excelu a šablona anglicky.
//
// Schválený kontrakt: features/feat-026-prejmenovani-specialization-na-skill.md, Příklady 9–15.
//  - Příklad 9: šablona `org-flow-template.xlsx`, list „Backlog“, sloupce Feature, Skill, Unit, Size
//    v tomto pořadí, ukázkové řádky jako dřív.
//  - Příklad 10: soubor s anglickými sloupci se naimportuje; souhrn „Imported 2 features, 4 tasks, 2 units.“
//  - Příklad 11: názvy sloupců se hledají bez ohledu na velikost písmen a mezery okolo.
//  - Příklad 12: starý soubor s českými sloupci (Specializace, Tym, Velikost) skončí chybou
//    „The file has no 'Skill' column. Check the header row.“ a stav se nezmění.
//  - Příklad 13: chybějící sloupec se v hlášce jmenuje anglicky.
//  - Příklad 14: „2 rows skipped (invalid Size).“ / „1 row skipped (invalid Size).“ a
//    „Too many units (max 50). The file contains more than 50 unique values in the Unit column.“
//  - Příklad 15: jednotné číslo „Imported 1 feature, 1 task, 1 unit.“

// Stažení souboru by v jsdom nic neudělalo — nahradíme XLSX.writeFile mockem a prohlédneme sešit
vi.mock('xlsx', async importOriginal => ({
  ...(await importOriginal<typeof import('xlsx')>()),
  writeFile: vi.fn(),
}))

/**
 * Jeden řádek souboru v novém (anglickém) formátu.
 *
 * @param feature - Název featury
 * @param skill - Skill potřebný pro task
 * @param unit - Jednotka, která task dělá
 * @param size - Pracnost tasku (může být i neplatná hodnota)
 * @returns Řádek jako objekt se sloupci Feature, Skill, Unit, Size
 */
const row = (feature: string, skill: string, unit: string, size: unknown) =>
  ({ Feature: feature, Skill: skill, Unit: unit, Size: size })

/** Řádky z Příkladu 10: dvě featury, čtyři tasky, dvě jednotky. */
const VALID_ROWS = [
  row('Login', 'FE', 'Squad A', 3),
  row('Login', 'BE', 'Squad B', 2),
  row('Search', 'FE', 'Squad A', 4),
  row('Search', 'QA', 'Squad B', 1),
]

/** Stejná data ve starém českém formátu (Příklad 12). */
const CZECH_ROWS = VALID_ROWS.map(r => ({ Feature: r.Feature, Specializace: r.Skill, Tym: r.Unit, Velikost: r.Size }))

/** Ukázkové řádky šablony — stejné hodnoty jako před feat-026, jen anglické sloupce (Příklad 9). */
const TEMPLATE_ROWS = [
  row('Login flow', 'FE', 'Squad A', 3),
  row('Login flow', 'BE', 'Squad A', 5),
  row('Login flow', 'QA', 'Squad B', 2),
  row('Dashboard', 'FE', 'Squad A', 4),
  row('Dashboard', 'BE', 'Squad B', 6),
  row('Payment gateway', 'BE', 'Squad A', 8),
  row('Payment gateway', 'QA', 'Squad B', 3),
]

const SETTINGS: SimSettings = {
  minBacklog: 0, wipLimit: 6, sizeVar: 0.4, roleVar: 0.5, initialBacklog: 5, minSpecializations: 1,
}

/**
 * Vytvoří .xlsx soubor z řádků. jsdom neimplementuje File.arrayBuffer(), které import volá,
 * proto ho doplníme na instanci (stejně jako ve feat-022).
 *
 * @param rows - Řádky listu „Backlog“
 * @returns Soubor připravený pro handleXlsImport
 */
function makeXlsFile(rows: Record<string, unknown>[]): File {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Backlog')
  const data: ArrayBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  const file = new File([data], 'backlog.xlsx')
  Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.resolve(data) })
  return file
}

/**
 * Zjednodušený otisk stavu simulace — názvy featur, jednotky se skilly a sada skillů.
 * Slouží k ověření, že se stav importem změnil (nebo nezměnil).
 *
 * @param state - Stav simulace
 * @param roleKeys - Klíče aktuální konfigurace skillů
 * @returns Otisk vhodný pro toEqual
 */
function snapshot(state: SimState, roleKeys: string[]) {
  return {
    backlog: state.backlog.map(f => f.name),
    team: state.team.map(m => ({ name: m.name, roles: m.roles })),
    skills: roleKeys,
  }
}

beforeEach(() => {
  vi.mocked(XLSX.writeFile).mockClear()
})

describe('feat-026 Příklad 9: šablona s anglickými sloupci', () => {
  /**
   * Stáhne šablonu a vrátí první list ze sešitu, který dostal mock XLSX.writeFile.
   *
   * @returns Sešit, název souboru a list „Backlog“
   */
  function downloadedTemplate() {
    downloadTemplate()
    expect(XLSX.writeFile).toHaveBeenCalledTimes(1)
    const [workbook, fileName] = vi.mocked(XLSX.writeFile).mock.calls[0]
    return { workbook, fileName, sheet: workbook.Sheets.Backlog }
  }

  it('soubor org-flow-template.xlsx s jediným listem „Backlog“', () => {
    const { workbook, fileName } = downloadedTemplate()
    expect(fileName).toBe('org-flow-template.xlsx')
    expect(workbook.SheetNames).toEqual(['Backlog'])
  })

  it('záhlaví je Feature, Skill, Unit, Size v tomto pořadí', () => {
    const { sheet } = downloadedTemplate()
    const [header] = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })
    expect(header).toEqual(['Feature', 'Skill', 'Unit', 'Size'])
  })

  it('ukázkové řádky jsou stejné jako dřív', () => {
    const { sheet } = downloadedTemplate()
    expect(XLSX.utils.sheet_to_json(sheet)).toEqual(TEMPLATE_ROWS)
  })

  it('šablona jde bez úprav naimportovat', () => {
    const { sheet } = downloadedTemplate()
    const result = parseRows(XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet))
    expect(formatImportSummary(result)).toBe('Imported 3 features, 7 tasks, 2 units.')
  })
})

describe('feat-026 Příklad 10: import souboru s anglickými sloupci', () => {
  it('featury, jednotky a skilly odpovídají souboru', () => {
    const result = parseRows(VALID_ROWS)
    expect(result.features.map(f => f.name)).toEqual(['Login', 'Search'])
    expect(result.team.map(m => ({ name: m.name, roles: m.roles }))).toEqual([
      { name: 'Squad A', roles: ['FE'] },
      { name: 'Squad B', roles: ['BE', 'QA'] },
    ])
    expect(Object.keys(result.roleConfig)).toEqual(['FE', 'BE', 'QA'])
    expect(result.warnings).toEqual([])
  })

  it('souhrn zní „Imported 2 features, 4 tasks, 2 units.“', () => {
    expect(formatImportSummary(parseRows(VALID_ROWS))).toBe('Imported 2 features, 4 tasks, 2 units.')
  })

  it('import v Cash Flow nahradí stav a ukáže souhrn', async () => {
    const { result } = renderHook(() => useCashFlowSimSetup(SETTINGS))
    act(() => { result.current.handleXlsImport(makeXlsFile(VALID_ROWS)) })
    await waitFor(() => expect(result.current.importMsg).not.toBeNull())
    expect(result.current.importMsg).toEqual({ ok: true, text: 'Imported 2 features, 4 tasks, 2 units.' })
    expect(snapshot(result.current.stateRef.current!, Object.keys(result.current.roleConfig))).toEqual({
      backlog: ['Login', 'Search'],
      team: [{ name: 'Squad A', roles: ['FE'] }, { name: 'Squad B', roles: ['BE', 'QA'] }],
      skills: ['FE', 'BE', 'QA'],
    })
  })
})

describe('feat-026 Příklad 11: názvy sloupců bez ohledu na velikost písmen', () => {
  it('záhlaví „ feature “, „SKILL“, „unit“, „Size “ dá stejný výsledek jako přesné názvy', () => {
    const messy = VALID_ROWS.map(r => ({ ' feature ': r.Feature, SKILL: r.Skill, unit: r.Unit, 'Size ': r.Size }))
    const expected = parseRows(VALID_ROWS)
    const actual = parseRows(messy)
    expect(actual.features.map(f => ({ name: f.name, tasks: f.tasks.map(t => [t.role, t.work]) })))
      .toEqual(expected.features.map(f => ({ name: f.name, tasks: f.tasks.map(t => [t.role, t.work]) })))
    expect(actual.team).toEqual(expected.team)
    expect(Object.keys(actual.roleConfig)).toEqual(Object.keys(expected.roleConfig))
  })
})

describe('feat-026 Příklad 12: starý soubor s českými sloupci', () => {
  it('parser ho odmítne hláškou o chybějícím sloupci „Skill“', () => {
    expect(() => parseRows(CZECH_ROWS)).toThrow("The file has no 'Skill' column. Check the header row.")
  })

  it('import v Cash Flow ukáže chybu a backlog, jednotky ani skilly se nezmění', async () => {
    const { result } = renderHook(() => useCashFlowSimSetup(SETTINGS))
    const before = snapshot(result.current.stateRef.current!, Object.keys(result.current.roleConfig))
    act(() => { result.current.handleXlsImport(makeXlsFile(CZECH_ROWS)) })
    await waitFor(() => expect(result.current.importMsg).not.toBeNull())
    expect(result.current.importMsg).toEqual({ ok: false, text: "The file has no 'Skill' column. Check the header row." })
    expect(snapshot(result.current.stateRef.current!, Object.keys(result.current.roleConfig))).toEqual(before)
  })
})

describe('feat-026 Příklad 13: chybějící sloupec', () => {
  it.each(['Feature', 'Skill', 'Unit', 'Size'])('bez sloupce %s hláška uvede jeho anglický název', column => {
    const rows = VALID_ROWS.map(r => {
      const copy: Record<string, unknown> = { ...r }
      delete copy[column]
      return copy
    })
    expect(() => parseRows(rows)).toThrow(`The file has no '${column}' column. Check the header row.`)
  })
})

describe('feat-026 Příklad 14: neplatná velikost a limit jednotek', () => {
  it.each([
    [2, '2 rows skipped (invalid Size).'],
    [1, '1 row skipped (invalid Size).'],
  ])('%i neplatné řádky: varování „%s“ za souhrnem', (skipped, message) => {
    // Každý neplatný řádek má jinou featuru: shodná trojice Feature + Skill + Unit se jinak tiše přeskočí jako duplicita
    const rows = [row('F1', 'BE', 'A', 5), ...Array.from({ length: skipped }, (_, i) => row(`Bad${i}`, 'FE', 'A', 'abc'))]
    const result = parseRows(rows)
    expect(result.warnings).toEqual([message])
    expect(formatImportSummary(result)).toBe(`Imported 1 feature, 1 task, 1 unit. ${message}`)
  })

  it('víc než 50 jednotek: „Too many units (max 50). …“', () => {
    const rows = Array.from({ length: 51 }, (_, i) => row(`F${i}`, 'FE', `T${i}`, 1))
    expect(() => parseRows(rows)).toThrow('Too many units (max 50). The file contains more than 50 unique values in the Unit column.')
  })
})

describe('feat-026 Příklad 15: jednotné číslo ve zprávě o importu', () => {
  it('jediný řádek: „Imported 1 feature, 1 task, 1 unit.“', () => {
    expect(formatImportSummary(parseRows([row('Login', 'FE', 'Squad A', 3)]))).toBe('Imported 1 feature, 1 task, 1 unit.')
  })
})
