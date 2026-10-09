import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Simulator } from '@/components/Simulator'
import { markTutorialCompleted, markModeSeen, resetTutorial } from '@/lib/storage'

// feat-017: propojení přepínače křivky v Simulator.tsx (uložení doběhnutého běhu jako předchozího,
// zavření dialogu při Resetu). Tuto logiku nejde otestovat na úrovni hooku, protože předchozí běh a
// RAF smyčka žijí v Simulator.tsx. Simulaci pohání falešný čas (requestAnimationFrame + performance).

/** Falešné hodiny pro RAF smyčku Simulatoru. Rychlost 10× dohraje celý backlog (~25 s simulace) za ~2,5 s. */
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

/** Otevře Cash Flow, rozbalí „♻ Backlog“ a nastaví rychlost 10×. */
function openCashFlowSettings(): void {
  render(<Simulator />)
  click(/Cash Flow/)
  click('♻ Backlog')
  click('10×')
}

/** Krok falešného času při čekání na doběhnutí běhu. */
const WAIT_STEP_MS = 500
/** Horní mez čekání na doběhnutí (falešný čas) — o řád víc, než kolik výchozí běh na 10× potřebuje. */
const WAIT_LIMIT_MS = 60_000

/**
 * Posouvá falešný čas, dokud tlačítko nezobrazí „✓ Done“ (celý backlog zpracovaný). Test tak nezávisí
 * na tom, jak dlouho výchozí běh trvá (tým, seed, velikost backlogu), jen na tom, že doběhne.
 */
async function advanceUntilDone(): Promise<void> {
  for (let waited = 0; waited < WAIT_LIMIT_MS; waited += WAIT_STEP_MS) {
    if (screen.queryByRole('button', { name: /Done/ })) return
    await advance(WAIT_STEP_MS)
  }
  throw new Error(`Běh nedoběhl ani za ${WAIT_LIMIT_MS} ms falešného času`)
}

/** Spustí běh a nechá ho doběhnout do konce (tlačítko pak ukazuje „✓ Done“). */
async function runToEnd(): Promise<void> {
  click(/Start|Resume/)
  await advanceUntilDone()
}

describe('feat-017 Příklad 7: srovnání stejného backlogu napříč profily (Simulator)', () => {
  it('bez předchozího běhu se žádná delta „vs prev run“ nezobrazuje', async () => {
    openCashFlowSettings()
    await runToEnd()
    expect(screen.queryAllByText(/vs prev run/).length).toBe(0)
  })

  it('po doběhnutém běhu změna křivky uloží běh jako předchozí: další běh ukáže deltu a srovnání je time-matched', async () => {
    openCashFlowSettings()
    await runToEnd()
    click('S-curve') // doběhnutý běh → žádný dialog, změna proběhne hned
    expect(screen.queryByText('Change revenue curve?')).toBeNull()
    await runToEnd()
    expect(screen.getAllByText(/vs prev run/).length).toBeGreaterThan(0)
    // hint pod Total Revenue říká, ke kterému času se srovnání vztahuje
    expect(screen.getByText(/^@ \d\d:\d\d\.\d$/)).toBeTruthy()
  })

  it('změna přes dialog během běhu: když běh mezitím doběhne, „Change and reset“ ho uloží jako předchozí', async () => {
    openCashFlowSettings()
    click(/Start/)
    await advance(500) // běh už začal, ale nedoběhl
    click('S-curve')
    expect(screen.getByRole('dialog', { name: 'Change revenue curve?' })).toBeTruthy()

    await advanceUntilDone() // simulace za překryvem dál tiká a doběhne
    click('Change and reset')
    expect(screen.queryByRole('dialog')).toBeNull()

    await runToEnd()
    expect(screen.getAllByText(/vs prev run/).length).toBeGreaterThan(0)
  })
})

describe('feat-017: dialog změny křivky a tlačítko Reset (Simulator)', () => {
  it('Reset backlogu zavře otevřený dialog (ten by se ptal na zahozený běh)', async () => {
    openCashFlowSettings()
    click(/Start/)
    await advance(500)
    click('J-curve')
    expect(screen.getByRole('dialog')).toBeTruthy()

    click(/Reset backlog/)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('Cancel dialog zavře, profil i běh zůstanou (Start tlačítko dál ukazuje běžící běh)', async () => {
    openCashFlowSettings()
    click(/Start/)
    await advance(500)
    click('J-curve')
    click('Cancel')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: /Pause/ })).toBeTruthy()
  })
})
