import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WinnerBanner } from '@/components/WinnerBanner'
import { COMPARE_SETTINGS } from '@/simulation/compareMode'
import { computeStats, makeInitialState, mulberry32 } from '@/simulation/engine'
import type { SimState, SimStats } from '@/types/simulation'

// feat-021 (Převod na design system Org Flow) — rám výsledku v Compare.
//
// Schválený kontrakt (spec features/feat-021-prevod-design-system-org-flow.md):
//  - Příklad 9: rám výsledku má písmeno vítězného týmu, nadpis „Team B was N% faster“ a větu proč,
//    bez emoji a bez barvy podle týmu.
// (Testy byly původně součástí feat-021-simulator-ui.test.tsx; oddělené beze změny, aby šly do PR 4.)

/**
 * Doběhnutý stav simulace se zadaným průměrným lead time (pro rám výsledku).
 *
 * @param seed - Seed generátoru, aby oba týmy měly stejný backlog
 * @returns Stav s příznakem finished
 */
function finishedState(seed: number): SimState {
  const state = makeInitialState(mulberry32(seed), COMPARE_SETTINGS)
  state.finished = true
  return state
}

/** Statistiky s daným počtem hotových features a průměrem. */
function statsWith(count: number, avg: number): SimStats {
  return { ...computeStats([]), count, avg }
}

describe('feat-021 Příklad 9: rám výsledku', () => {
  it('rychlejší Team B: písmeno, nadpis s procentem a věta proč', () => {
    render(<WinnerBanner stateA={finishedState(1)} statsA={statsWith(100, 31.6)} stateB={finishedState(1)} statsB={statsWith(100, 18.3)} />)
    expect(screen.getByText('B', { exact: true })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Team B was 42% faster' })).toBeInTheDocument()
    expect(screen.getByText(/Broader skills meant less waiting between stages\./)).toBeInTheDocument()
  })

  it('rychlejší Team A: nadpis a věta pro specialisty', () => {
    render(<WinnerBanner stateA={finishedState(1)} statsA={statsWith(100, 20)} stateB={finishedState(1)} statsB={statsWith(100, 25)} />)
    expect(screen.getByText('A', { exact: true })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Team A was 25% faster' })).toBeInTheDocument()
    expect(screen.getByText(/Deep specialisation meant each person stayed fully loaded\./)).toBeInTheDocument()
  })

  it('rám nemá emoji ani barvu podle týmu', () => {
    const { container } = render(
      <WinnerBanner stateA={finishedState(1)} statsA={statsWith(100, 31.6)} stateB={finishedState(1)} statsB={statsWith(100, 18.3)} />,
    )
    expect(container.textContent).not.toMatch(/\p{Extended_Pictographic}/u)
    // Dnešní banner barví podle týmu přes inline oklch(… hue) — rám výsledku bere barvy jen z tokenů
    expect(container.innerHTML).not.toMatch(/oklch\(/)
  })

  it('dokud oba běhy nedoběhnou, nic nevykreslí', () => {
    const running = finishedState(1)
    running.finished = false
    const { container } = render(
      <WinnerBanner stateA={running} statsA={statsWith(10, 31.6)} stateB={finishedState(1)} statsB={statsWith(100, 18.3)} />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
