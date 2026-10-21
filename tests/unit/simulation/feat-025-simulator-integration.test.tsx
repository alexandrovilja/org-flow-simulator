import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { Simulator } from '@/components/Simulator'
import { WinnerBanner } from '@/components/WinnerBanner'
import { TUTORIAL_STEPS } from '@/lib/tutorialSteps'
import { hasSeenMode, isTutorialCompleted, markModeSeen, markTutorialCompleted, resetTutorial } from '@/lib/storage'
import { COMPARE_SETTINGS } from '@/simulation/compareMode'
import { computeStats, makeInitialState, mulberry32 } from '@/simulation/engine'
import type { SimState, SimStats } from '@/types/simulation'
import type { TutorialMode } from '@/types/tutorial'
import { controlNames } from './topBarControls'

// feat-025 (Revize tutoriálu) — tutoriál v aplikaci.
//
// Schválený kontrakt: features/feat-025-revize-tutorialu.md, Příklady 1, 5 (cíle v DOM), 8–14 a 16.
//  - Příklad 1: první návštěva otevře úvodní kartu „WELCOME · 1 / 14“.
//  - Příklady 8–10: Cash Flow má prohlídku — spustí se při prvním přepnutí (jen když `cashflow` ještě
//    není mezi viděnými módy) a přes „?“ v ovládání Cash Flow; ovládání má pořadí jako Compare.
//  - Příklad 11: „?“ v Compare začíná úvodní kartou.
//  - Příklad 12: krok o rozbalovací sekci sekci nerozbalí ani nesbalí.
//  - Příklad 13: Skip i Finish u Cash Flow uloží `tutorial-completed` a mód `cashflow` jako viděný.
//  - Příklad 14: první přepnutí do Advanced spustí prohlídku a krok 1 zvýrazní záložku Advanced.
//  - Příklad 5: každý cíl kroku existuje v DOM příslušného módu právě jednou a je to správný prvek.
//  - Příklad 16: popisek rámečku výsledku je „Result · avg cycle time“.

beforeEach(() => {
  // Smyčku simulace i měření cíle tutoriálu pohání requestAnimationFrame — falešný čas je drží na místě
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
  localStorage.clear()
  resetTutorial()
})

afterEach(() => {
  vi.useRealTimers()
})

/** Nechá proběhnout měření cíle tutoriálu (requestAnimationFrame) a překreslení. */
async function flushMeasure(): Promise<void> {
  await act(async () => { vi.advanceTimersByTime(20) })
}

/** Označí tutoriál jako dokončený a dané módy jako viděné (jako vracející se uživatel). */
function seen(...modes: TutorialMode[]): void {
  markTutorialCompleted()
  for (const mode of modes) markModeSeen(mode)
}

/** Přepne na záložku módu v horní liště. */
const openMode = (name: 'Compare' | 'Advanced' | 'Cash Flow') => fireEvent.click(screen.getByRole('tab', { name }))

const overlay = () => screen.queryByTestId('tutorial-overlay')
const clickButton = (name: string) => fireEvent.click(screen.getByRole('button', { name }))

/** Klikne n-krát na „Next →“ v kartě tutoriálu. */
function clickNext(times: number): void {
  for (let i = 0; i < times; i++) clickButton('Next →')
}

/** Jediný prvek s daným cílem tutoriálu (test selže, když jich je víc nebo žádný). */
function target(id: string): HTMLElement {
  const found = document.querySelectorAll<HTMLElement>(`[data-tutorial-target="${id}"]`)
  expect(found, `cíl „${id}“`).toHaveLength(1)
  return found[0]
}

/** Tlačítko rozbalovací sekce uvnitř cíle (cíl je tlačítko samo, nebo ho obsahuje). */
function accordionButton(id: string): HTMLButtonElement {
  const el = target(id)
  const button = el.matches('button[aria-expanded]') ? el : el.querySelector('button[aria-expanded]')
  expect(button, `tlačítko sekce v cíli „${id}“`).not.toBeNull()
  return button as HTMLButtonElement
}

describe('feat-025 Příklad 1: první návštěva otevře úvodní kartu', () => {
  it('bez příznaků se ukáže „WELCOME · 1 / 14“ s nadpisem a bez „← Back“', () => {
    render(<Simulator />)
    expect(screen.getByText('WELCOME · 1 / 14')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Welcome to Org Flow Simulator' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '← Back' })).toBeNull()
  })
})

describe('feat-025 Příklad 11: „?“ v Compare začíná úvodní kartou', () => {
  it('po dokončení prohlídky „?“ otevře „WELCOME · 1 / 14“', () => {
    seen('compare', 'experiment', 'cashflow')
    render(<Simulator />)
    expect(overlay()).toBeNull()
    clickButton('Restart tutorial')
    expect(screen.getByText('WELCOME · 1 / 14')).toBeInTheDocument()
  })
})

describe('feat-025 Příklady 8–10: prohlídka Cash Flow', () => {
  it('Příklad 8: první přepnutí do Cash Flow spustí prohlídku a krok 1 zvýrazní záložku', async () => {
    seen('compare', 'experiment')
    render(<Simulator />)
    openMode('Cash Flow')
    expect(screen.getByText('INTRO · 1 / 8')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Flow meets money' })).toBeInTheDocument()
    await flushMeasure()
    // Cíl se našel — místo celoplošného ztmavení je rámeček kolem záložky
    expect(screen.getByTestId('tutorial-ring')).toBeInTheDocument()
  })

  it('Příklad 9: když už Cash Flow uživatel viděl, prohlídka se nespustí', () => {
    seen('compare', 'experiment', 'cashflow')
    render(<Simulator />)
    openMode('Cash Flow')
    expect(overlay()).toBeNull()
  })

  it('Příklad 9: po přeskočení se při dalším přepnutí do Cash Flow prohlídka nespustí', () => {
    seen('compare', 'experiment')
    render(<Simulator />)
    openMode('Cash Flow')
    clickButton('Skip tutorial')
    openMode('Compare')
    openMode('Cash Flow')
    expect(overlay()).toBeNull()
  })

  it('Příklad 8: přeskočení Advanced a přepnutí do Cash Flow najednou začne Cash Flow od kroku 1', () => {
    // Regrese z implementace: bez klíče podle módu React znovu použil kartu Advanced i s jejím krokem
    seen('compare')
    render(<Simulator />)
    openMode('Advanced')
    clickNext(3)
    expect(screen.getByText('ORGANIZATION · 4 / 15')).toBeInTheDocument()
    // Obě kliknutí v jednom act() = jedno překreslení, jako když jdou rychle po sobě
    act(() => {
      screen.getByRole('button', { name: 'Skip tutorial' }).click()
      screen.getByRole('tab', { name: 'Cash Flow' }).click()
    })
    expect(screen.getByText('INTRO · 1 / 8')).toBeInTheDocument()
  })

  it('Příklad 10: ovládání Cash Flow je „?“, Reset, rychlost a Run', () => {
    seen('compare', 'experiment', 'cashflow')
    render(<Simulator />)
    openMode('Cash Flow')
    expect(controlNames()).toEqual(['Restart tutorial', '↺ Reset', '0.5×', '1×', '10×', '▶ Run'])
  })

  it('Příklad 10: „?“ v Cash Flow spustí prohlídku Cash Flow od kroku 1', () => {
    seen('compare', 'experiment', 'cashflow')
    render(<Simulator />)
    openMode('Cash Flow')
    clickButton('Restart tutorial')
    expect(screen.getByText('INTRO · 1 / 8')).toBeInTheDocument()
  })
})

describe('feat-025 Příklad 13: přeskočení a dokončení prohlídky Cash Flow', () => {
  it('Skip tutorial zavře prohlídku a uloží Cash Flow jako viděný', () => {
    seen('compare', 'experiment')
    render(<Simulator />)
    openMode('Cash Flow')
    clickButton('Skip tutorial')
    expect(overlay()).toBeNull()
    expect(isTutorialCompleted()).toBe(true)
    expect(hasSeenMode('cashflow')).toBe(true)
  })

  it('Finish na posledním kroku zavře prohlídku a uloží Cash Flow jako viděný', () => {
    seen('compare', 'experiment')
    render(<Simulator />)
    openMode('Cash Flow')
    clickNext(7)
    expect(screen.getByText('CONTROLS · 8 / 8')).toBeInTheDocument()
    clickButton('Finish')
    expect(overlay()).toBeNull()
    expect(hasSeenMode('cashflow')).toBe(true)
  })
})

describe('feat-025 Příklad 14: první přepnutí do Advanced zvýrazní záložku', () => {
  it('prohlídka Advanced začne „INTRO · 1 / 15“ s rámečkem kolem záložky', async () => {
    seen('compare')
    render(<Simulator />)
    openMode('Advanced')
    expect(screen.getByText('INTRO · 1 / 15')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Your organization' })).toBeInTheDocument()
    await flushMeasure()
    expect(screen.getByTestId('tutorial-ring')).toBeInTheDocument()
  })
})

describe('feat-025 Příklad 12: rozbalovací sekce zůstává, jak byla', () => {
  it('sbalená sekce Team zůstane na kroku „Work rules“ sbalená', () => {
    seen('compare')
    render(<Simulator />)
    openMode('Advanced')
    clickNext(8)
    expect(screen.getByText('BACKLOG & RULES · 9 / 15')).toBeInTheDocument()
    expect(accordionButton('experiment-team-accordion')).toHaveAttribute('aria-expanded', 'false')
  })

  it('rozbalená sekce Team zůstane na kroku „Work rules“ rozbalená', () => {
    seen('compare', 'experiment', 'cashflow')
    render(<Simulator />)
    openMode('Advanced')
    fireEvent.click(accordionButton('experiment-team-accordion'))
    expect(accordionButton('experiment-team-accordion')).toHaveAttribute('aria-expanded', 'true')
    clickButton('Restart tutorial')
    clickNext(8)
    expect(screen.getByText('BACKLOG & RULES · 9 / 15')).toBeInTheDocument()
    expect(accordionButton('experiment-team-accordion')).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('feat-025 Příklad 5: každý cíl kroku existuje v DOM svého módu', () => {
  it.each([
    ['compare', 'Compare'],
    ['experiment', 'Advanced'],
    ['cashflow', 'Cash Flow'],
  ] as const)('%s: všechny cíle kroků jsou v DOM právě jednou', (mode, tab) => {
    seen('compare', 'experiment', 'cashflow')
    render(<Simulator />)
    openMode(tab)
    for (const step of TUTORIAL_STEPS[mode]) {
      if (step.targetId) target(step.targetId)
      if (step.parentTargetId) target(step.parentTargetId)
    }
  })

  it('Compare: první karta To Do týmu A a tři sloupce kanbanu týmu A', () => {
    seen('compare', 'experiment', 'cashflow')
    render(<Simulator />)
    expect(target('compare-team-a-first-feature')).toHaveTextContent('F-001')
    const todo = target('compare-team-a-todo')
    expect(todo).toHaveTextContent(/To Do/i)
    expect(todo).toContainElement(target('compare-team-a-first-feature'))
    expect(target('compare-team-a-in-progress')).toHaveTextContent(/In Progress/i)
    expect(target('compare-team-a-done')).toHaveTextContent(/Done/i)
    // Všechny tři sloupce jsou uvnitř panelu týmu A
    const panel = target('compare-team-a-panel')
    for (const id of ['compare-team-a-todo', 'compare-team-a-in-progress', 'compare-team-a-done']) {
      expect(panel).toContainElement(target(id))
    }
  })

  it('Advanced: první jednotka, její tlačítko AI a přepínač výchozí sestavy', () => {
    seen('compare', 'experiment', 'cashflow')
    render(<Simulator />)
    openMode('Advanced')
    const unit = target('experiment-first-unit')
    const ai = target('experiment-first-unit-ai')
    expect(target('experiment-team-composition')).toContainElement(unit)
    expect(unit).toContainElement(ai)
    expect(ai.tagName).toBe('BUTTON')
    expect(ai.getAttribute('aria-label')).toMatch(/^AI speed-up/)
    const preset = target('experiment-unit-preset')
    expect(within(preset).getByRole('button', { name: 'Teams' })).toBeInTheDocument()
    expect(within(preset).getByRole('button', { name: 'People' })).toBeInTheDocument()
  })

  it.each([
    ['Advanced', 'experiment'],
    ['Cash Flow', 'cashflow'],
  ] as const)('%s: cíle rozbalovacích sekcí jsou jejich hlavičky', (tab, prefix) => {
    seen('compare', 'experiment', 'cashflow')
    render(<Simulator />)
    openMode(tab)
    expect(accordionButton(`${prefix}-backlog-accordion`)).toHaveAccessibleName('Backlog')
    expect(accordionButton(`${prefix}-specializations-accordion`)).toHaveAccessibleName('Specializations')
    expect(accordionButton(`${prefix}-team-accordion`)).toHaveAccessibleName('Team')
  })

  it('Cash Flow: dlaždice výnosu, Done a ovládání včetně „?“', () => {
    seen('compare', 'experiment', 'cashflow')
    render(<Simulator />)
    openMode('Cash Flow')
    expect(target('cashflow-revenue')).toHaveTextContent('Revenue (time-matched)')
    expect(target('cashflow-done')).toHaveTextContent(/Done/i)
    const controls = target('cashflow-controls')
    expect(within(controls).getByRole('button', { name: 'Restart tutorial' })).toBeInTheDocument()
    expect(within(controls).getByRole('button', { name: '▶ Run' })).toBe(target('cashflow-run-button'))
  })
})

/** Doběhnutý stav simulace Compare (pro rám výsledku). */
function finishedState(): SimState {
  const state = makeInitialState(mulberry32(1), COMPARE_SETTINGS)
  state.finished = true
  return state
}

/** Statistiky s daným počtem hotových features a průměrem. */
function statsWith(count: number, avg: number): SimStats {
  return { ...computeStats([]), count, avg }
}

describe('feat-025 Příklad 16: popisek rámečku výsledku', () => {
  it('nad titulkem je „Result · avg cycle time“', () => {
    render(<WinnerBanner stateA={finishedState()} statsA={statsWith(100, 31.6)} stateB={finishedState()} statsB={statsWith(100, 18.3)} />)
    expect(screen.getByText('Result · avg cycle time')).toBeInTheDocument()
    expect(screen.queryByText(/avg lead time/)).toBeNull()
  })
})

describe('feat-025 review: „?“ za běhu simulaci pozastaví', () => {
  /** Simulační čas z prvního čítače „MM:SS.d“ na obrazovce (v Compare Total Time týmu A). */
  function simSeconds(): number {
    const [minutes, rest] = screen.getAllByText(/^\d\d:\d\d\.\d$/)[0].textContent!.split(':')
    return Number(minutes) * 60 + Number(rest)
  }

  it.each(['Compare', 'Advanced', 'Cash Flow'] as const)('%s: běh se zastaví a prohlídka začne', async tab => {
    seen('compare', 'experiment', 'cashflow')
    render(<Simulator />)
    openMode(tab)
    clickButton('▶ Run')
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(screen.getByRole('button', { name: '❙❙ Pause' })).toBeInTheDocument()
    clickButton('Restart tutorial')
    expect(overlay()).not.toBeNull()
    expect(screen.getByRole('button', { name: '▶ Run' })).toBeInTheDocument()
    // Čas simulace dál neběží, takže se cíle pod zvýrazněním nehýbou
    const before = simSeconds()
    await act(async () => { vi.advanceTimersByTime(2000) })
    expect(simSeconds()).toBe(before)
  })
})
