import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { Simulator } from '@/components/Simulator'
import { markTutorialCompleted, markModeSeen, resetTutorial } from '@/lib/storage'

// feat-018: napojení dlaždice „Revenue (time-matched)“ v Simulator.tsx — druhý běh se srovnává s prvním
// ve společném čase, za běhu je vidět „live total“, Reset sbalí detail. Předchozí běh a RAF smyčka žijí
// v Simulator.tsx, proto test pohání Simulator falešným časem (stejný vzor jako feat-017-simulator-integration).

const TILE_ID = 'stat-tile-Revenue (time-matched)'

/** Falešné hodiny pro RAF smyčku Simulatoru. Rychlost 10× dohraje backlog o 20 featurách (~25 s simulace) za ~2,5 s. */
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

/** Posune falešný čas o `ms` milisekund uvnitř act(), aby se React stihl překreslit. */
async function advance(ms: number): Promise<void> {
  await act(async () => { vi.advanceTimersByTime(ms) })
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))

// Velikost backlogu pro tyto testy. Výchozích 100 featur (feat-015) by běh do konce v testu
// protáhlo zhruba na 3 s a testy se dvěma běhy by nestihly výchozí 5s limit Vitestu.
const TEST_BACKLOG_SIZE = 20

/** Nastaví slider „Backlog size“ (najde ho podle přístupného jména, viz feat-003). */
function setBacklogSize(size: number): void {
  fireEvent.change(screen.getByRole('slider', { name: 'Backlog size' }), { target: { value: String(size) } })
}

/**
 * Otevře Cash Flow, rozbalí „♻ Backlog“ (kvůli přepínači křivky), vygeneruje backlog
 * o TEST_BACKLOG_SIZE featurách a nastaví rychlost 10×.
 */
function openCashFlowSettings(): void {
  render(<Simulator />)
  click(/Cash Flow/)
  click('♻ Backlog')
  setBacklogSize(TEST_BACKLOG_SIZE)
  click(/Generate new backlog/)
  click('10×')
}

/** Krok falešného času při čekání na doběhnutí běhu. */
const WAIT_STEP_MS = 500
/** Horní mez čekání na doběhnutí (falešný čas) — o řád víc, než kolik běh s TEST_BACKLOG_SIZE featurami na 10× potřebuje. */
const WAIT_LIMIT_MS = 60_000
/** Časový limit (reálný čas) testů, které nechávají doběhnout celý běh. Lokálně trvají 1–2 s, ale CI
 *  runner je 3–4× pomalejší a výchozích 5 s Vitestu nestačí (PR #14: timeouty 5,1–5,6 s). */
const SIM_RUN_TIMEOUT_MS = 20_000

/** Posouvá falešný čas, dokud tlačítko nezobrazí „✓ Done“ (celý backlog zpracovaný). */
async function advanceUntilDone(): Promise<void> {
  for (let waited = 0; waited < WAIT_LIMIT_MS; waited += WAIT_STEP_MS) {
    if (screen.queryByRole('button', { name: /Done/ })) return
    await advance(WAIT_STEP_MS)
  }
  throw new Error(`Běh nedoběhl ani za ${WAIT_LIMIT_MS} ms falešného času`)
}

/** Spustí běh a nechá ho doběhnout do konce. */
async function runToEnd(): Promise<void> {
  click(/Start|Resume/)
  await advanceUntilDone()
}

/** Dlaždice výnosu (znovu se dohledává, protože se může přemountovat). */
const revenueTile = () => screen.getByTestId(TILE_ID)
const detailsButton = () => within(revenueTile()).getByRole('button', { name: /details/i })

describe('feat-018: dlaždice „Revenue (time-matched)“ v Simulatoru', { timeout: SIM_RUN_TIMEOUT_MS }, () => {
  it('první běh bez předchozího: za běhu „live total“, po doběhnutí bez hintu a bez delty', async () => {
    openCashFlowSettings()
    click(/Start/)
    await advance(500)
    expect(revenueTile()).toHaveTextContent('live total')

    await advanceUntilDone()
    expect(revenueTile()).not.toHaveTextContent('live total')
    expect(revenueTile()).not.toHaveTextContent('vs prev run')
    expect(revenueTile()).not.toHaveTextContent('@')
  })

  it('druhý běh po doběhnutí ukáže delta badge, hint „@ čas“ a v detailu celkový výnos i předchozí běh', async () => {
    openCashFlowSettings()
    await runToEnd()
    click('S-curve') // doběhnutý běh → uloží se jako předchozí a simulace se vrátí na začátek

    click(/Start/)
    await advance(500)
    // předchozí běh už existuje, ale za běhu se ještě nesrovnává
    expect(revenueTile()).toHaveTextContent('live total')
    expect(revenueTile()).not.toHaveTextContent('vs prev run')

    await advanceUntilDone()
    expect(revenueTile()).toHaveTextContent('vs prev run')
    expect(revenueTile()).toHaveTextContent(/@ \d\d:\d\d\.\d/)
    expect(revenueTile()).not.toHaveTextContent('live total')

    fireEvent.click(detailsButton())
    expect(revenueTile()).toHaveTextContent(/Total €[\d.]+k? in \d\d:\d\d\.\d/)
    expect(revenueTile()).toHaveTextContent(/Previous run @ \d\d:\d\d\.\d: €[\d.]+k?/)
    expect(revenueTile()).toHaveTextContent(/Previous total €[\d.]+k? in \d\d:\d\d\.\d/)
  })

  it('Reset backlogu sbalí rozbalený detail', async () => {
    openCashFlowSettings()
    await runToEnd()
    fireEvent.click(detailsButton())
    expect(detailsButton()).toHaveAttribute('aria-expanded', 'true')

    click(/Reset backlog/)
    expect(detailsButton()).toHaveAttribute('aria-expanded', 'false')
  })

  it('start běhu rozbalený detail nesbalí', async () => {
    openCashFlowSettings()
    fireEvent.click(detailsButton())
    expect(detailsButton()).toHaveAttribute('aria-expanded', 'true')

    click(/Start/)
    await advance(500)
    expect(detailsButton()).toHaveAttribute('aria-expanded', 'true')
  })
})
