import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { CashFlowPanel } from '@/components/CashFlowPanel'
import { ComparePanel } from '@/components/ComparePanel'
import { Simulator } from '@/components/Simulator'
import { computeStats, makeInitialState, mulberry32, tick } from '@/simulation/engine'
import { markTutorialCompleted, markModeSeen, resetTutorial } from '@/lib/storage'
import type { SimSettings, SimState } from '@/types/simulation'

// feat-001 Příklad 6 (revize 2026-10-13): hlavička panelu Done ukazuje počet VŠECH hotových features
// (`doneCount(state)`), ne jen 40 zobrazených karet — v Compare, Advanced i Cash Flow.

const SETTINGS: SimSettings = {
  minBacklog: 0,
  wipLimit: 6,
  sizeVar: 0.4,
  roleVar: 0.5,
  initialBacklog: 100,
  minSpecializations: 1,
}

/** Kolik karet engine drží v `state.done` pro zobrazení (viz `tick()` v engine.ts). */
const DONE_DISPLAY_CAP = 40

/**
 * Nechá backlog o 100 features doběhnout přímo v enginu (bez Reactu), aby panely dostaly
 * stav, ve kterém je 40 karet v `done` a zbytek v `doneOverflow`.
 *
 * @returns Doběhnutý stav simulace
 */
function finishedStateWith100(): SimState {
  const rng = mulberry32(7)
  const state = makeInitialState(rng, SETTINGS)
  // Pojistka proti nekonečné smyčce: 20 000 kroků × 0,25 s simulace je o řád víc, než je potřeba
  for (let step = 0; step < 20_000 && !state.finished; step++) {
    tick(state, 0.25, SETTINGS, rng)
  }
  return state
}

/**
 * Ověří, že hlavička sloupce/panelu „Done“ ukazuje dané číslo. Číslo hledáme v obalu
 * nadpisu, kde PanelHeader i KanbanColumn vykreslují název a počet vedle sebe.
 *
 * @param expected - Očekávaný počet hotových features
 */
function expectDoneHeaderCount(expected: number): void {
  const header = screen.getByText('Done', { exact: true }).parentElement!
  expect(within(header).getByText(String(expected))).toBeTruthy()
}

describe('feat-001 Příklad 6: hlavička Done v panelech', () => {
  it('Cash Flow: hlavička Done ukazuje 100, i když se zobrazuje jen 40 karet', () => {
    const state = finishedStateWith100()
    expect(state.done.length).toBe(DONE_DISPLAY_CAP) // předpoklad testu: část karet je v doneOverflow
    render(
      <CashFlowPanel
        state={state}
        stats={computeStats(state.leadTimes)}
        totalTimeDisplay="00:00.0"
        avgWip={null}
        revenueComparison={{ value: 0, currentTotal: { revenue: 0, time: state.simTime } }}
      />,
    )
    expectDoneHeaderCount(100)
  })

  it('Compare: sloupec Done ukazuje 100, i když se zobrazuje jen 40 karet', () => {
    const state = finishedStateWith100()
    const stats = computeStats(state.leadTimes)
    render(
      <ComparePanel
        teamType="single"
        onChangeType={() => {}}
        state={state}
        stats={stats}
        opponentStats={stats}
        opponentState={state}
        opponentLabel="multi"
      />,
    )
    expectDoneHeaderCount(100)
  })
})

/** Časový limit (reálný čas) testu, který nechává doběhnout celý běh. Lokálně trvá kolem 2 s, ale CI
 *  runner je 3–4× pomalejší a výchozích 5 s Vitestu nestačí (PR #14: timeout 5,5 s). */
const SIM_RUN_TIMEOUT_MS = 20_000

describe('feat-001 Příklad 6: hlavička Done v Advanced módu (Simulator)', { timeout: SIM_RUN_TIMEOUT_MS }, () => {
  // Advanced vykresluje panel Done přímo v Simulator.tsx, proto test pohání celý Simulator
  // falešným časem — stejný vzor jako integrační testy feat-017 a feat-018.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
    resetTutorial()
    markTutorialCompleted()
    markModeSeen('compare')
    markModeSeen('experiment')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // 50 features stačí na překročení limitu 40 karet a běh je o polovinu kratší než se 100.
  const ADVANCED_BACKLOG_SIZE = 50

  const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
  // Záložky módů jsou od feat-021 role="tab" (dřív tlačítka)
  const tab = (name: RegExp) => fireEvent.click(screen.getByRole('tab', { name }))

  it('po doběhnutí backlogu o 50 features ukazuje hlavička Done 50', async () => {
    render(<Simulator />)
    tab(/Advanced/)
    click('Backlog')
    fireEvent.change(screen.getByRole('slider', { name: 'Backlog size' }), { target: { value: String(ADVANCED_BACKLOG_SIZE) } })
    click(/Generate new backlog/)
    click('10×')
    click(/Start/)

    // Posouvá falešný čas po 500 ms, dokud tlačítko neukáže „✓ Done“ (nejvýš 60 s falešného času)
    for (let waited = 0; waited < 60_000 && !screen.queryByRole('button', { name: /Done/ }); waited += 500) {
      await act(async () => { vi.advanceTimersByTime(500) })
    }
    expect(screen.getByRole('button', { name: /Done/ })).toBeTruthy()

    expectDoneHeaderCount(ADVANCED_BACKLOG_SIZE)
  })
})
