import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor, render, screen, fireEvent } from '@testing-library/react'
import * as XLSX from 'xlsx'
import { Simulator } from '@/components/Simulator'
import { useCashFlowSimSetup } from '@/hooks/useCashFlowSimSetup'
import { parseRows, formatImportSummary, downloadTemplate } from '@/lib/xlsImport'
import { markTutorialCompleted, markModeSeen, resetTutorial } from '@/lib/storage'
import type { SimSettings } from '@/types/simulation'

// feat-022 (Sjednocení designu v celém nástroji) — Příklad 12 a Příklad 5 (název souboru šablony).
//
// Schválený kontrakt (spec features/feat-022-sjednoceni-designu.md):
//  - Příklad 12: zprávy po importu XLS i chyby importu jsou anglicky. Úspěch „Imported 8 features,
//    18 tasks, 2 team members.“ (jednotné číslo u 1), varování „2 rows skipped (invalid Velikost).“,
//    chyby „The file contains no data.“ apod., obecné selhání „Could not read the file.“ /
//    „Could not load the file.“. Názvy sloupců souboru (Feature, Specializace, Tym, Velikost) zůstávají.
//  - Příklad 5: šablona se stahuje jako `org-flow-template.xlsx`.
// Zprávu skládá exportovaná `formatImportSummary(result)`, kterou sdílí Advanced i Cash Flow.

// Stažení souboru by v jsdom nic neudělalo — nahradíme XLSX.writeFile mockem a ověříme název souboru
vi.mock('xlsx', async importOriginal => ({
  ...(await importOriginal<typeof import('xlsx')>()),
  writeFile: vi.fn(),
}))

const row = (feature: string, role: string, tym: string, velikost: unknown) =>
  ({ Feature: feature, Specializace: role, Tym: tym, Velikost: velikost })

/** Dvě featury, čtyři tasky, dva členové týmu. */
const VALID_ROWS = [
  row('Login', 'FE', 'Squad A', 3),
  row('Login', 'BE', 'Squad B', 2),
  row('Search', 'FE', 'Squad A', 4),
  row('Search', 'QA', 'Squad B', 1),
]

/**
 * Vytvoří .xlsx soubor z řádků. jsdom neimplementuje File.arrayBuffer(), které import volá,
 * proto ho doplníme na instanci (stejně jako ve feat-017).
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

const SETTINGS: SimSettings = {
  minBacklog: 0, wipLimit: 6, sizeVar: 0.4, roleVar: 0.5, initialBacklog: 5, minSpecializations: 1,
}

beforeEach(() => {
  localStorage.clear()
  resetTutorial()
  markTutorialCompleted()
  markModeSeen('compare')
  markModeSeen('experiment')
  vi.mocked(XLSX.writeFile).mockClear()
})

describe('feat-022 Příklad 12: chyby a varování importu anglicky', () => {
  it('prázdný soubor: „The file contains no data.“', () => {
    expect(() => parseRows([])).toThrow('The file contains no data.')
  })

  it.each(['Feature', 'Specializace', 'Tym', 'Velikost'])('chybí sloupec %s: nabídne přeložené pokyny a ponechá název sloupce', column => {
    const rows = VALID_ROWS.map(r => {
      const copy: Record<string, unknown> = { ...r }
      delete copy[column]
      return copy
    })
    expect(() => parseRows(rows)).toThrow(`The file has no '${column}' column. Check the header row.`)
  })

  it('víc než 200 features: „Backlog too large (max 200 features). …“', () => {
    const rows = Array.from({ length: 201 }, (_, i) => row(`F${i}`, 'FE', 'A', 1))
    expect(() => parseRows(rows)).toThrow('Backlog too large (max 200 features). The file contains more than 200 unique features.')
  })

  it('víc než 50 členů týmu: „Too many team members (max 50). …“', () => {
    const rows = Array.from({ length: 51 }, (_, i) => row(`F${i}`, 'FE', `T${i}`, 1))
    expect(() => parseRows(rows)).toThrow('Too many team members (max 50). The file contains more than 50 unique values in the Tym column.')
  })

  it('žádný řádek s platnou velikostí: „The file contains no valid data.“', () => {
    expect(() => parseRows([row('F1', 'FE', 'A', 'abc')])).toThrow('The file contains no valid data.')
  })

  it.each([
    [2, '2 rows skipped (invalid Velikost).'],
    [1, '1 row skipped (invalid Velikost).'],
  ])('přeskočené řádky (%s): varování „%s“', (skipped, message) => {
    // Každý neplatný řádek má jinou feature: shodná trojice Feature + Specializace + Tym se jinak přeskakuje tiše jako duplicita
    const rows = [row('F1', 'BE', 'A', 5), ...Array.from({ length: skipped }, (_, i) => row(`Bad${i}`, 'FE', 'A', 'abc'))]
    expect(parseRows(rows).warnings).toEqual([message])
  })
})

describe('feat-022 Příklad 12: formatImportSummary', () => {
  it('množné číslo: „Imported 2 features, 4 tasks, 2 team members.“', () => {
    expect(formatImportSummary(parseRows(VALID_ROWS))).toBe('Imported 2 features, 4 tasks, 2 team members.')
  })

  it('jednotné číslo: „Imported 1 feature, 1 task, 1 team member.“', () => {
    expect(formatImportSummary(parseRows([row('Login', 'FE', 'Squad A', 3)]))).toBe('Imported 1 feature, 1 task, 1 team member.')
  })

  it('varování se připojí za zprávu o úspěchu', () => {
    const result = parseRows([row('F1', 'BE', 'A', 5), row('F1', 'FE', 'A', 'abc')])
    expect(formatImportSummary(result)).toBe('Imported 1 feature, 1 task, 1 team member. 1 row skipped (invalid Velikost).')
  })
})

describe('feat-022 Příklad 12: zprávy v Cash Flow (hook)', () => {
  it('úspěšný import ukáže anglickou zprávu', async () => {
    const { result } = renderHook(() => useCashFlowSimSetup(SETTINGS))
    act(() => { result.current.handleXlsImport(makeXlsFile(VALID_ROWS)) })
    await waitFor(() => expect(result.current.importMsg).not.toBeNull())
    expect(result.current.importMsg).toEqual({ ok: true, text: 'Imported 2 features, 4 tasks, 2 team members.' })
  })

  it('soubor bez dat ukáže anglickou chybu z parseru', async () => {
    const { result } = renderHook(() => useCashFlowSimSetup(SETTINGS))
    act(() => { result.current.handleXlsImport(makeXlsFile([])) })
    await waitFor(() => expect(result.current.importMsg).not.toBeNull())
    expect(result.current.importMsg).toEqual({ ok: false, text: 'The file contains no data.' })
  })

  it('soubor, který nejde přečíst, ukáže „Could not read the file.“', async () => {
    const { result } = renderHook(() => useCashFlowSimSetup(SETTINGS))
    const file = new File(['x'], 'broken.xlsx')
    Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.reject(new Error('boom')) })
    act(() => { result.current.handleXlsImport(file) })
    await waitFor(() => expect(result.current.importMsg).not.toBeNull())
    expect(result.current.importMsg).toEqual({ ok: false, text: 'Could not read the file.' })
  })
})

describe('feat-022 Příklad 12: zprávy v Advanced (Simulator)', () => {
  /** Otevře Advanced, rozbalí akordeon Backlog a nahraje soubor do skrytého výběru souboru. */
  async function importInAdvanced(file: File): Promise<void> {
    const { container } = render(<Simulator />)
    fireEvent.click(screen.getByRole('tab', { name: 'Advanced' }))
    fireEvent.click(screen.getByRole('button', { name: 'Backlog' }))
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')!
    fireEvent.change(input, { target: { files: [file] } })
  }

  it('úspěšný import ukáže „✓ Imported 2 features, 4 tasks, 2 team members.“', async () => {
    await importInAdvanced(makeXlsFile(VALID_ROWS))
    expect(await screen.findByText('✓ Imported 2 features, 4 tasks, 2 team members.')).toBeInTheDocument()
  })

  it('soubor bez dat ukáže „× The file contains no data.“', async () => {
    await importInAdvanced(makeXlsFile([]))
    expect(await screen.findByText('× The file contains no data.')).toBeInTheDocument()
  })

  it('soubor, který nejde přečíst, ukáže „× Could not read the file.“', async () => {
    const file = new File(['x'], 'broken.xlsx')
    Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.reject(new Error('boom')) })
    await importInAdvanced(file)
    expect(await screen.findByText('× Could not read the file.')).toBeInTheDocument()
  })
})

describe('feat-022 Příklad 5: název souboru šablony', () => {
  it('šablona se stáhne jako org-flow-template.xlsx', () => {
    downloadTemplate()
    expect(XLSX.writeFile).toHaveBeenCalledTimes(1)
    expect(vi.mocked(XLSX.writeFile).mock.calls[0][1]).toBe('org-flow-template.xlsx')
  })
})
