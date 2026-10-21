import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { Simulator } from '@/components/Simulator'
import { markTutorialCompleted, markModeSeen, resetTutorial } from '@/lib/storage'

// feat-021 (Převod na design system Org Flow) — horní lišta, tlačítko Run, přepínače.
//
// Schválený kontrakt (spec features/feat-021-prevod-design-system-org-flow.md):
//  - Příklad 3: tlačítko Run v Compare mění popisek Run → Pause (barvy a „✓ Done“ po doběhnutí
//    ověřuje E2E test, protože jsdom nepočítá styly a celý běh Compare je na jednotkový test dlouhý).
//  - Příklad 4: záložky módů jsou role="tab" s texty „Compare“, „Advanced“, „Cash Flow“ bez emoji;
//    aktivní má aria-selected="true".
//  - Příklad 8: volba typu týmu i rychlosti je stejná komponenta SegmentedControl — role="group"
//    a tlačítka s aria-pressed, právě jedno stisknuté (výplň aktivního segmentu ověřuje E2E).
//  - Příklad 9 (rám výsledku) je v feat-021-winner-banner.test.tsx.

beforeEach(() => {
  localStorage.clear()
  resetTutorial()
  markTutorialCompleted()
  markModeSeen('compare')
  markModeSeen('experiment')
  markModeSeen('cashflow')
})

const tab = (name: string) => screen.getByRole('tab', { name })

/**
 * Najde segmentový přepínač (role="group"), který obsahuje tlačítko s daným textem.
 *
 * @param buttonName - Text jednoho segmentu, např. „10×“ nebo „Single“
 * @returns Všechny skupiny, které takové tlačítko obsahují
 */
function groupsWith(buttonName: string): HTMLElement[] {
  return screen.getAllByRole('group').filter(g => within(g).queryByRole('button', { name: buttonName }))
}

/**
 * Ověří kontrakt segmentového přepínače: všechna tlačítka mají aria-pressed a stisknuté je
 * právě jedno — to s textem `pressed`.
 *
 * @param group - Element s role="group"
 * @param pressed - Text segmentu, který má být stisknutý
 */
function expectSegmented(group: HTMLElement, pressed: string): void {
  const buttons = within(group).getAllByRole('button')
  expect(buttons.length).toBeGreaterThan(1)
  for (const b of buttons) expect(b).toHaveAttribute('aria-pressed')
  expect(buttons.filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.textContent)).toEqual([pressed])
}

describe('feat-021 Příklad 4: záložky módů bez emoji', () => {
  it('lišta má tři záložky s čistými texty a Compare je aktivní', () => {
    render(<Simulator />)
    expect(screen.getByRole('tablist')).toBeInTheDocument()
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual(['Compare', 'Advanced', 'Cash Flow'])
    expect(tab('Compare')).toHaveAttribute('aria-selected', 'true')
    expect(tab('Advanced')).toHaveAttribute('aria-selected', 'false')
  })

  it('kliknutí na záložku ji označí jako aktivní', () => {
    render(<Simulator />)
    fireEvent.click(tab('Advanced'))
    expect(tab('Advanced')).toHaveAttribute('aria-selected', 'true')
    expect(tab('Compare')).toHaveAttribute('aria-selected', 'false')
    fireEvent.click(tab('Cash Flow'))
    expect(tab('Cash Flow')).toHaveAttribute('aria-selected', 'true')
  })
})

describe('feat-021 Příklad 3: tlačítko Run v Compare', () => {
  it('před spuštěním je „Run“, po kliknutí „Pause“, po dalším kliknutí znovu „Run“', () => {
    render(<Simulator />)
    expect(screen.getByRole('button', { name: /Run$/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Pause$/ })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Run$/ }))
    expect(screen.getByRole('button', { name: /Pause$/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Run$/ })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /Pause$/ }))
    expect(screen.getByRole('button', { name: /Run$/ })).toBeInTheDocument()
  })
})

describe('feat-021 Příklad 8: jednotný segmentový přepínač', () => {
  it('Compare: volba typu týmu je SegmentedControl u obou týmů (A Single, B Double)', () => {
    render(<Simulator />)
    const [teamA, teamB] = groupsWith('Single')
    expectSegmented(teamA, 'Single')
    expectSegmented(teamB, 'Double')
  })

  it('Compare: rychlost je SegmentedControl se stisknutým „1×“', () => {
    render(<Simulator />)
    const [speed] = groupsWith('10×')
    expectSegmented(speed, '1×')
    fireEvent.click(within(speed).getByRole('button', { name: '10×' }))
    expectSegmented(groupsWith('10×')[0], '10×')
  })

  it('Advanced: rychlost je SegmentedControl se stisknutým „1×“', () => {
    render(<Simulator />)
    fireEvent.click(tab('Advanced'))
    const [speed] = groupsWith('10×')
    expectSegmented(speed, '1×')
    fireEvent.click(within(speed).getByRole('button', { name: '10×' }))
    expectSegmented(groupsWith('10×')[0], '10×')
  })
})
