import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { Simulator } from '@/components/Simulator'
import { BacklogSettingsPanel } from '@/components/BacklogSettingsPanel'
import { MemberCard } from '@/components/MemberCard'
import buttonStyles from '@/components/Button.module.css'
import { downloadTemplate } from '@/lib/xlsImport'
import { markTutorialCompleted, markModeSeen, resetTutorial } from '@/lib/storage'
import { mulberry32, makeInitialState, ROLE_META } from '@/simulation/engine'
import type { Member, SimSettings } from '@/types/simulation'

// feat-022 (Sjednocení designu v celém nástroji) — části obrazovky mimo komponenty design systému.
//
// Schválený kontrakt (spec features/feat-022-sjednoceni-designu.md):
//  - Příklad 1: nadpisy „Units“ a „Metrics“ jsou hlavičky panelu jako „Backlog“, „In Progress“ a „Done“
//    (stejná třída nadpisu); počet jednotek je sourozenec nadpisu se stejnou třídou jako počet u Backlogu;
//    poznámky „Click + to add a specialty“ a „N features sampled“ mají stejnou třídu jako „auto-scaled“.
//  - Příklad 2: hlavičky akordeonů mají přístupné názvy „Backlog“, „Specializations“, „Team“ bez emoji;
//    šipka ▸ / ▾ je skrytá před čtečkami (aria-hidden) a řídí se stavem; aria-expanded odpovídá stavu.
//  - Příklad 3: „Generate new backlog“ a „Takes effect after Reset“ bez emoji; smazání specializace
//    ukazuje „×“ s přístupným názvem „Delete <role>“; zpráva o importu začíná „✓“ nebo „×“;
//    zavírací tlačítko výběru role na kartě jednotky je „×“.
//  - Příklad 5: tlačítko „↓ Template“ (žádné „Šablona“) stáhne šablonu přes downloadTemplate.
//  - Příklad 7: „+ Add unit / member / team“ je komponenta Button (třída tlačítka design systému)
//    a kliknutí přidá jednotku.
// Vypočtené písmo a velikosti (jsdom je nepočítá) ověřuje E2E test feat-022-sjednoceni-designu.spec.ts.
// Třídy CSS modulů jsou ve Vitestu stabilní názvy, takže „stejná třída“ = „stejný styl“.

// Stažení šablony by v jsdom vytvářelo soubor — nahradíme ho mockem a ověříme jen volání
vi.mock('@/lib/xlsImport', async importOriginal => ({
  ...(await importOriginal<typeof import('@/lib/xlsImport')>()),
  downloadTemplate: vi.fn(),
}))

beforeEach(() => {
  localStorage.clear()
  resetTutorial()
  markTutorialCompleted()
  markModeSeen('compare')
  markModeSeen('experiment')
  vi.mocked(downloadTemplate).mockClear()
})

const tab = (name: string) => fireEvent.click(screen.getByRole('tab', { name }))
const heading = (name: string) => screen.getByRole('heading', { name })

/** Tlačítko pro přidání jednotky — popisek podle presetu (unit / member / team). */
const addUnitButton = () => screen.getByRole('button', { name: /^\+ Add (unit|member|team)$/ })

const SETTINGS: SimSettings = {
  minBacklog: 0,
  wipLimit: 6,
  sizeVar: 0.4,
  roleVar: 0.5,
  initialBacklog: 5,
  minSpecializations: 1,
}

/**
 * Vykreslí panel nastavení samostatně, se všemi povinnými props jako mock (stejně jako testy feat-017).
 *
 * @param extra - Props, které test přepisuje
 * @returns Výsledek renderu
 */
function renderPanel(extra: Partial<ComponentProps<typeof BacklogSettingsPanel>> = {}) {
  const state = makeInitialState(mulberry32(42), SETTINGS)
  const props: ComponentProps<typeof BacklogSettingsPanel> = {
    state, settings: SETTINGS, setSettings: vi.fn(), roleConfig: ROLE_META,
    activePresetId: 'teams', confirmingPreset: null, setConfirmingPreset: vi.fn(),
    showBacklogControls: true, setShowBacklogControls: vi.fn(),
    showRoleSettings: false, setShowRoleSettings: vi.fn(),
    showTeamSettings: false, setShowTeamSettings: vi.fn(),
    importMsg: null, fileInputRef: { current: null },
    wipMode: 'reduce-wip', setWipMode: vi.fn(), maxWork: 3,
    handleXlsImport: vi.fn(), handleRegenerate: vi.fn(), handlePresetClick: vi.fn(), handleConfirmPreset: vi.fn(),
    handleRoleChange: vi.fn(), handleAddRole: vi.fn(), handleDeleteRole: vi.fn(),
    ...extra,
  }
  return render(<BacklogSettingsPanel {...props} />)
}

describe.each(['Advanced', 'Cash Flow'])('feat-022 Příklad 1: nadpisy Units a Metrics jako ostatní panely (%s)', mode => {
  beforeEach(() => {
    render(<Simulator />)
    tab(mode)
  })

  it('„Units“ a „Metrics“ mají stejnou třídu nadpisu jako „Backlog“, „In Progress“ a „Done“', () => {
    const panelTitle = heading('Done').className
    expect(heading('Backlog').className).toBe(panelTitle)
    expect(heading('In Progress').className).toBe(panelTitle)
    expect(heading('Units').className).toBe(panelTitle)
    expect(heading('Metrics').className).toBe(panelTitle)
  })

  it('počet jednotek stojí vedle nadpisu „Units“ ve stejném stylu jako počet u Backlogu', () => {
    const unitsCount = heading('Units').nextElementSibling
    const backlogCount = heading('Backlog').nextElementSibling
    expect(unitsCount?.className).toBe(backlogCount?.className)
    expect(unitsCount?.textContent).toBe(String(screen.getAllByTitle('Remove unit').length))
  })

  it('poznámky „Click + to add a specialty“ a „N features sampled“ mají styl poznámky jako „auto-scaled“', () => {
    const hintClass = screen.getByText('auto-scaled').className
    expect(screen.getByText('Click + to add a specialty').className).toBe(hintClass)
    expect(screen.getByText(/^\d+ features? sampled$/).className).toBe(hintClass)
  })
})

describe('feat-022 Příklad 2: akordeony nastavení bez emoji', () => {
  it('hlavičky mají názvy „Backlog“, „Specializations“, „Team“ a skrytou šipku ▸ / ▾ podle stavu', () => {
    render(<Simulator />)
    tab('Advanced')
    for (const name of ['Backlog', 'Specializations', 'Team']) {
      const button = screen.getByRole('button', { name })
      const caret = () => button.querySelector('[aria-hidden="true"]')
      expect(button).toHaveAttribute('aria-expanded', 'false')
      expect(caret()?.textContent).toBe('▸')

      fireEvent.click(button)
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-expanded', 'true')
      expect(caret()?.textContent).toBe('▾')

      fireEvent.click(button)
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-expanded', 'false')
      expect(caret()?.textContent).toBe('▸')
    }
  })

  it('otevřený akordeon „Backlog“ ukáže svůj obsah', () => {
    render(<Simulator />)
    tab('Advanced')
    expect(screen.queryByText('Backlog size')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Backlog' }))
    expect(screen.getByText('Backlog size')).toBeInTheDocument()
  })
})

describe('feat-022 Příklad 3: ovládání bez emoji', () => {
  it('tlačítko „Generate new backlog“ nemá ikonu', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: 'Generate new backlog' })).toHaveTextContent(/^Generate new backlog$/)
  })

  it('zamčený coordination overhead ukáže poznámku „Takes effect after Reset“ bez zámku', () => {
    renderPanel({ showTeamSettings: true, setCoordinationOverhead: vi.fn(), coordinationOverhead: true, coordinationOverheadLocked: true })
    expect(screen.getByText('Takes effect after Reset')).toBeInTheDocument()
  })

  it('smazání specializace je „×“ s přístupným názvem „Delete <role>“', () => {
    renderPanel({ showRoleSettings: true })
    const del = screen.getByRole('button', { name: `Delete ${ROLE_META.DSGN.label}` })
    expect(del.textContent).toBe('×')
  })

  it.each([
    [false, '×'],
    [true, '✓'],
  ])('zpráva o importu (ok = %s) začíná „%s“', (ok, glyph) => {
    renderPanel({ importMsg: { ok, text: 'Imported 12 items' } })
    expect(screen.getByText(`${glyph} Imported 12 items`)).toBeInTheDocument()
  })

  it('zavírací tlačítko výběru role na kartě jednotky je „×“', () => {
    const member: Member = { id: 1, name: 'Ada', roles: ['DSGN'], currentTask: null, idleSec: 0 }
    render(
      <MemberCard member={member} currentFeature={null} currentTask={null} roleConfig={ROLE_META}
        onAddRole={vi.fn()} onRemoveRole={vi.fn()} onRename={vi.fn()} onRemove={vi.fn()} onSetAiMultiplier={vi.fn()} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Add specialization' }))
    expect(screen.getByRole('button', { name: 'Close' }).textContent).toBe('×')
  })
})

describe('feat-022 Příklad 5: šablona importu anglicky', () => {
  it('vedle „↑ Import XLS“ je „↓ Template“ a žádné „Šablona“', () => {
    renderPanel()
    expect(screen.getByRole('button', { name: '↑ Import XLS' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '↓ Template' })).toBeInTheDocument()
    expect(screen.queryByText(/Šablona/)).toBeNull()
  })

  it('kliknutí na „↓ Template“ stáhne šablonu', () => {
    renderPanel()
    fireEvent.click(screen.getByRole('button', { name: '↓ Template' }))
    expect(downloadTemplate).toHaveBeenCalledTimes(1)
  })
})

describe.each(['Advanced', 'Cash Flow'])('feat-022 Příklad 7: tlačítko přidání jednotky (%s)', mode => {
  it('je tlačítko design systému a kliknutí přidá jednotku', () => {
    render(<Simulator />)
    tab(mode)
    expect(addUnitButton().classList).toContain(buttonStyles.button)

    const before = screen.getAllByTitle('Remove unit').length
    fireEvent.click(addUnitButton())
    expect(screen.getAllByTitle('Remove unit').length).toBe(before + 1)
  })
})
