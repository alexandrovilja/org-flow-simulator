import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FeatureCard } from '@/components/FeatureCard'
import { InProgressTeamPanel } from '@/components/InProgressTeamPanel'
import { isFeatureActive, sortInProgressForDisplay } from '@/lib/inProgressOrder'
import { ROLE_META, makeInitialState, mulberry32 } from '@/simulation/engine'
import type { Feature, SimSettings, SimState, Task, TaskStatus } from '@/types/simulation'

// feat-015 (Cash Flow mód), dodatek „In Progress: zvýraznění a řazení aktivních features“ (Příklad 8).
//
// Kontrakt (spec features/feat-015-cash-flow-mod.md, UI / Design + Příklad 8):
//  - Nový modul `src/lib/inProgressOrder.ts` (čisté funkce, bez Reactu):
//      `isFeatureActive(feature)` — true, když má feature alespoň jeden task ve stavu 'doing'.
//      `sortInProgressForDisplay(features)` — vrátí NOVÉ pole: aktivní features nahoře, uvnitř skupin
//      podle `priority` vzestupně, tiebreak `id` vzestupně. Vstupní pole ani objekty nemutuje.
//  - `FeatureCard` dostane volitelnou prop `active?: boolean` (výchozí false). Kořenový prvek karty nese
//    `data-active="true"` / `"false"`. Aktivní karta má výrazný rámeček přes `box-shadow` (rozměry karty
//    se nemění → `border` zůstává stejný jako u čekající karty); čekající karta `box-shadow` nemá.
//  - `InProgressTeamPanel` vykresluje karty v pořadí `sortInProgressForDisplay(state.inProgress)`
//    a každé předá `active = isFeatureActive(f)`. `state.inProgress` se nemění.
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

describe('sortInProgressForDisplay', () => {
  it('Příklad 8: aktivní nahoře, uvnitř skupin podle priority', () => {
    const f801 = feature(801, 1, ['todo'])
    const f850 = feature(850, 50, ['todo'])
    const f799 = feature(799, 3, ['doing'])
    const f812 = feature(812, 12, ['doing'])

    const sorted = sortInProgressForDisplay([f801, f850, f799, f812])

    expect(sorted.map(f => f.id)).toEqual([799, 812, 801, 850])
  })

  it('bez aktivních features řadí čistě podle priority', () => {
    const sorted = sortInProgressForDisplay([
      feature(3, 30, ['todo']), feature(1, 10, ['done']), feature(2, 20, ['todo']),
    ])
    expect(sorted.map(f => f.id)).toEqual([1, 2, 3])
  })

  it('při shodné prioritě rozhoduje id (deterministické pořadí)', () => {
    const sorted = sortInProgressForDisplay([
      feature(9, 5, ['todo']), feature(4, 5, ['todo']), feature(7, 5, ['todo']),
    ])
    expect(sorted.map(f => f.id)).toEqual([4, 7, 9])
  })

  it('nemutuje vstupní pole ani features', () => {
    const input = [feature(2, 2, ['todo']), feature(1, 1, ['doing'])]
    const before = input.map(f => f.id)

    const sorted = sortInProgressForDisplay(input)

    expect(sorted).not.toBe(input)
    expect(input.map(f => f.id)).toEqual(before)
  })

  it('prázdné pole vrací prázdné pole', () => {
    expect(sortInProgressForDisplay([])).toEqual([])
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

describe('InProgressTeamPanel — pořadí a zvýraznění', () => {
  /**
   * Vykreslí panel s danými rozpracovanými features a prázdným týmem (aby se názvy
   * features neopakovaly na kartách jednotek).
   *
   * @param inProgress - Features v `state.inProgress`
   * @returns Stav předaný panelu (pro kontrolu nemutace)
   */
  function renderPanel(inProgress: Feature[]): SimState {
    const state = makeInitialState(mulberry32(1), SETTINGS)
    state.team = []
    state.inProgress = inProgress
    render(
      <InProgressTeamPanel
        state={state} roleConfig={ROLE_META} maxWork={10} activePresetId="teams"
        handleAssignRole={vi.fn()} handleRemoveRole={vi.fn()} handleRenameMember={vi.fn()}
        handleSetAiMultiplier={vi.fn()} handleRemoveMember={vi.fn()} handleAddMember={vi.fn()}
      />,
    )
    return state
  }

  /** @returns Karty features v panelu In Progress v pořadí, v jakém jsou v DOM */
  function cards(): HTMLElement[] {
    return Array.from(document.querySelectorAll<HTMLElement>('[data-tutorial-target$="-in-progress"] [data-active]'))
  }

  it('Příklad 8: pořadí 799, 812, 801, 850 a zvýrazněné jsou jen aktivní', () => {
    renderPanel([
      feature(801, 1, ['todo']), feature(850, 50, ['todo']),
      feature(799, 3, ['doing']), feature(812, 12, ['doing']),
    ])

    const list = cards()

    expect(list.map(c => c.textContent?.match(/F-\d+/)?.[0])).toEqual(['F-799', 'F-812', 'F-801', 'F-850'])
    expect(list.map(c => c.getAttribute('data-active'))).toEqual(['true', 'true', 'false', 'false'])
  })

  it('bez aktivních features není nic zvýrazněné a pořadí je podle priority', () => {
    renderPanel([feature(2, 20, ['todo']), feature(1, 10, ['done', 'todo'])])

    const list = cards()

    expect(list.map(c => c.textContent?.match(/F-\d+/)?.[0])).toEqual(['F-1', 'F-2'])
    expect(list.every(c => c.getAttribute('data-active') === 'false')).toBe(true)
  })

  it('řazení je jen v zobrazení — state.inProgress zůstává v původním pořadí', () => {
    const state = renderPanel([feature(801, 1, ['todo']), feature(799, 3, ['doing'])])

    expect(state.inProgress.map(f => f.id)).toEqual([801, 799])
  })

  it('záhlaví ukazuje jen celkový počet (žádný počet aktivních)', () => {
    renderPanel([feature(801, 1, ['todo']), feature(799, 3, ['doing'])])

    expect(screen.queryByText(/active/i)).toBeNull()
  })
})
