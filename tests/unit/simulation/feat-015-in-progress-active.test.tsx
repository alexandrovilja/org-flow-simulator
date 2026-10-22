import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FeatureCard } from '@/components/FeatureCard'
import { InProgressTeamPanel } from '@/components/InProgressTeamPanel'
import { isFeatureActive } from '@/lib/featureActivity'
import { ROLE_META, makeInitialState, mulberry32 } from '@/simulation/engine'
import type { Feature, SimSettings, SimState, Task, TaskStatus } from '@/types/simulation'

// feat-015 (Cash Flow mód), dodatek „In Progress: zvýraznění aktivních features“ (Příklad 8).
//
// Kontrakt (spec features/feat-015-cash-flow-mod.md, UI / Design + Příklad 8):
//  - Modul `src/lib/featureActivity.ts` (čistá funkce, bez Reactu; dřívější `inProgressOrder.ts`):
//      `isFeatureActive(feature)` — true, když má feature alespoň jeden task ve stavu 'doing'.
//    Řazení `sortInProgressForDisplay` se ODSTRAŇUJE (karty při změně aktivity nepřeskakují).
//  - `FeatureCard` má volitelnou prop `active?: boolean` (výchozí false). Kořenový prvek karty nese
//    `data-active="true"` / `"false"`. Aktivní karta má výrazný rámeček přes `box-shadow` (rozměry karty
//    se nemění → `border` zůstává stejný jako u čekající karty); čekající karta `box-shadow` nemá.
//  - `InProgressTeamPanel` vykresluje karty v pořadí `state.inProgress` (pořadí vstupu do rozpracování)
//    a každé předá `active = isFeatureActive(f)`. Pořadí se nemění, ani když se změní aktivita.
//  - Záhlaví panelu se nemění (žádný počet aktivních).

const SETTINGS: SimSettings = {
  minBacklog: 0, wipLimit: 6, sizeVar: 0.4, roleVar: 0.5, initialBacklog: 1, minSpecializations: 1,
}

/**
 * Vytvoří task v daném stavu.
 *
 * @param id     - ID tasku
 * @param status - Stav tasku
 * @returns Task role FE
 */
function task(id: number, status: TaskStatus): Task {
  return {
    id, role: 'FE', work: 4,
    progress: status === 'done' ? 4 : status === 'doing' ? 1 : 0,
    status, assignee: status === 'todo' ? null : 1,
  }
}

/**
 * Vytvoří rozpracovanou feature pro test — vezme platný základ z enginu a přepíše jen to, co test potřebuje.
 *
 * @param id       - ID feature (i číslo v názvu)
 * @param priority - Priorita (nižší = důležitější)
 * @param statuses - Stavy tasků feature
 * @returns Feature ve stavu in-progress
 */
function feature(id: number, priority: number, statuses: TaskStatus[]): Feature {
  const base = makeInitialState(mulberry32(1), SETTINGS).backlog[0]
  return {
    ...base,
    id, priority,
    name: `F-${id} Feature`,
    status: 'in-progress',
    tasks: statuses.map((s, i) => task(id * 10 + i, s)),
  }
}

describe('isFeatureActive', () => {
  it('je true, když aspoň jeden task je doing', () => {
    expect(isFeatureActive(feature(1, 1, ['done', 'doing', 'todo']))).toBe(true)
  })

  it('je false, když nic neběží (todo/done)', () => {
    expect(isFeatureActive(feature(1, 1, ['done', 'todo']))).toBe(false)
    expect(isFeatureActive(feature(2, 2, ['todo', 'todo']))).toBe(false)
  })

  it('je false pro feature bez tasků', () => {
    expect(isFeatureActive(feature(3, 3, []))).toBe(false)
  })
})

describe('FeatureCard — prop active', () => {
  /**
   * Vykreslí kartu a vrátí její kořenový prvek (nese data-active).
   *
   * @param active - Hodnota props `active`; undefined = prop se nepředá
   * @returns Kořenový prvek karty
   */
  function renderCard(active?: boolean): HTMLElement {
    render(<FeatureCard feature={feature(799, 3, ['doing'])} active={active} />)
    const root = screen.getByText('F-799 Feature').closest('[data-active]')
    if (!(root instanceof HTMLElement)) throw new Error('Karta nemá data-active')
    return root
  }

  it('active=true → data-active="true" a rámeček přes box-shadow', () => {
    const root = renderCard(true)
    expect(root.getAttribute('data-active')).toBe('true')
    expect(root.style.boxShadow).not.toBe('')
  })

  it('výchozí hodnota je neaktivní: data-active="false" a bez box-shadow', () => {
    const root = renderCard()
    expect(root.getAttribute('data-active')).toBe('false')
    expect(root.style.boxShadow).toBe('')
  })

  it('zvýraznění nemění rozměry — border je stejný u aktivní i čekající karty', () => {
    const active = renderCard(true)
    const activeBorder = active.style.border
    document.body.innerHTML = ''
    const idle = renderCard(false)
    expect(idle.style.border).toBe(activeBorder)
  })
})

describe('InProgressTeamPanel — zvýraznění bez změny pořadí', () => {
  /**
   * Vykreslí panel s danými rozpracovanými features a prázdným týmem (aby se názvy
   * features neopakovaly na kartách jednotek).
   *
   * @param inProgress - Features v `state.inProgress`
   * @returns Stav předaný panelu a funkce pro opětovné vykreslení se stejným (mutovaným) stavem
   */
  function renderPanel(inProgress: Feature[]): { state: SimState; rerenderPanel: () => void } {
    const state = makeInitialState(mulberry32(1), SETTINGS)
    state.team = []
    state.inProgress = inProgress
    /** @returns Panel se stabilními mock handlery */
    const panel = () => (
      <InProgressTeamPanel
        state={state} roleConfig={ROLE_META} maxWork={10} activePresetId="teams"
        handleAssignRole={vi.fn()} handleRemoveRole={vi.fn()} handleRenameMember={vi.fn()}
        handleSetAiMultiplier={vi.fn()} handleRemoveMember={vi.fn()} handleAddMember={vi.fn()}
      />
    )
    const { rerender } = render(panel())
    return { state, rerenderPanel: () => rerender(panel()) }
  }

  /** @returns Karty features v panelu In Progress v pořadí, v jakém jsou v DOM */
  function cards(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('[data-tutorial-target$="-in-progress"] [data-active]'))
  }

  /** @returns Čísla features (F-NNN) v pořadí karet */
  function order(): (string | undefined)[] {
    return cards().map(c => c.textContent?.match(/F-\d+/)?.[0])
  }

  it('Příklad 8: pořadí je pořadí state.inProgress, zvýrazněné jsou jen aktivní', () => {
    renderPanel([
      feature(801, 1, ['todo']), feature(850, 50, ['todo']),
      feature(799, 3, ['doing']), feature(812, 12, ['doing']),
    ])

    expect(order()).toEqual(['F-801', 'F-850', 'F-799', 'F-812'])
    expect(cards().map(c => c.getAttribute('data-active'))).toEqual(['false', 'false', 'true', 'true'])
  })

  it('Příklad 8: když feature přestane být aktivní, karta nepřeskočí — jen ztratí zvýraznění', () => {
    const { state, rerenderPanel } = renderPanel([
      feature(801, 1, ['todo']), feature(799, 3, ['doing']), feature(812, 12, ['doing']),
    ])
    expect(cards().map(c => c.getAttribute('data-active'))).toEqual(['false', 'true', 'true'])

    // Team A dokončí task na F-799 a další task téže featury nepřevezme
    state.inProgress[1].tasks[0].status = 'done'
    rerenderPanel()

    expect(order()).toEqual(['F-801', 'F-799', 'F-812'])
    expect(cards().map(c => c.getAttribute('data-active'))).toEqual(['false', 'false', 'true'])
  })

  it('když se feature stane aktivní, také nepřeskočí', () => {
    const { state, rerenderPanel } = renderPanel([feature(801, 1, ['todo']), feature(799, 3, ['todo'])])

    state.inProgress[1].tasks[0].status = 'doing'
    rerenderPanel()

    expect(order()).toEqual(['F-801', 'F-799'])
    expect(cards().map(c => c.getAttribute('data-active'))).toEqual(['false', 'true'])
  })

  it('bez aktivních features není nic zvýrazněné a pořadí zůstává stejné jako ve stavu', () => {
    renderPanel([feature(2, 20, ['todo']), feature(1, 10, ['done', 'todo'])])

    expect(order()).toEqual(['F-2', 'F-1'])
    expect(cards().every(c => c.getAttribute('data-active') === 'false')).toBe(true)
  })

  it('záhlaví ukazuje jen celkový počet (žádný počet aktivních)', () => {
    renderPanel([feature(801, 1, ['todo']), feature(799, 3, ['doing'])])

    expect(screen.queryByText(/active/i)).toBeNull()
  })
})
