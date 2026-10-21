import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Simulator } from '@/components/Simulator'
import { markTutorialCompleted, markModeSeen, resetTutorial } from '@/lib/storage'

// feat-015 revize 2026-10-13 (Příklad 2 a 3): Cash Flow startuje se 100 featurami v backlogu, stejně
// jako Advanced. Výchozí nastavení Cash Flow žije v Simulator.tsx, proto test renderuje celý Simulator
// a čte to, co vidí uživatel: počet v hlavičce panelu Backlog a hodnotu slideru „Backlog size“.

/** Výchozí velikost backlogu Cash Flow podle feat-015, Příklad 2. */
const EXPECTED_BACKLOG_SIZE = 100

// Tutorial by při prvním renderu překryl UI — označíme ho jako viděný, stejně jako ostatní testy Simulatoru.
beforeEach(() => {
  resetTutorial()
  markTutorialCompleted()
  markModeSeen('compare')
  markModeSeen('experiment')
  markModeSeen('cashflow')
})

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
// Záložky módů jsou od feat-021 role="tab" (dřív tlačítka)
const tab = (name: RegExp) => fireEvent.click(screen.getByRole('tab', { name }))

/**
 * Přečte číslo vedle nadpisu „Backlog“ v hlavičce panelu (PanelHeader vykresluje počet jako
 * sourozence nadpisu). Hlavička je na obrazovce jen jednou — ostatní módy nejsou namountované.
 */
function backlogHeaderCount(): number {
  const heading = screen.getByRole('heading', { name: 'Backlog' })
  return Number(heading.nextElementSibling?.textContent)
}

describe('feat-015 Příklad 2 a 3: výchozí backlog Cash Flow má 100 featur', () => {
  it('po přepnutí do Cash Flow ukazuje panel Backlog 100 featur', () => {
    render(<Simulator />)
    tab(/Cash Flow/)
    expect(backlogHeaderCount()).toBe(EXPECTED_BACKLOG_SIZE)
  })

  it('slider „Backlog size“ v Cash Flow ukazuje výchozí hodnotu „100 items“', () => {
    render(<Simulator />)
    tab(/Cash Flow/)
    click('Backlog')
    expect(screen.getByText(`${EXPECTED_BACKLOG_SIZE} items`)).toBeTruthy()
  })

  it('„Generate new backlog“ ve výchozím nastavení znovu vygeneruje 100 featur', () => {
    render(<Simulator />)
    tab(/Cash Flow/)
    click('Backlog')
    click(/Generate new backlog/)
    expect(backlogHeaderCount()).toBe(EXPECTED_BACKLOG_SIZE)
  })
})
