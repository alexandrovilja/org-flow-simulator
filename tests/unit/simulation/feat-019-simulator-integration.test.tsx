import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { Simulator } from '@/components/Simulator'
import { CashFlowPanel } from '@/components/CashFlowPanel'
import { computeStats, makeInitialState, mulberry32 } from '@/simulation/engine'
import { markTutorialCompleted, markModeSeen, resetTutorial } from '@/lib/storage'
import type { SimSettings } from '@/types/simulation'

// feat-019 (AI multiplikátor výkonu) — propojení tlačítka AI se Simulatorem.
//
// Schválený kontrakt (spec features/feat-019-ai-multiplikator-vykonu.md):
//  - Tlačítko „AI speed-up“ má každá karta jednotky v Advanced (Experimentování) i Cash Flow;
//    režim Compare (Srovnání) ho nemá.
//  - Handler `handleSetAiMultiplier` v Simulator.tsx (Advanced) a v useCashFlowSimSetup.ts (Cash Flow)
//    nastaví jednotce `aiMultiplier` a překreslí UI. Změna se počítá jako ruční úprava týmu
//    (preset přejde na „custom“), takže další volba presetu ukáže potvrzovací dialog.
//  - Aplikace presetu vytvoří tým s AI 1× (Příklad 7). Reset backlogu nastavení AI zachová (Příklad 6).
//  - Advanced a Cash Flow mají každý vlastní tým, nastavení AI se mezi nimi nepřenáší.
//  - Tooltip dlaždice Coordination overhead (Cash Flow) dostane na konec větu o jednotkách s AI.

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
  // Uložený preset z předchozího testu by změnil výchozí stav („custom“ → dialog hned napoprvé)
  localStorage.clear()
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
// Přístupný název tlačítka AI je „AI speed-up“, se zapnutým AI „AI speed-up: 5×“
const aiButtons = () => screen.queryAllByRole('button', { name: /^AI speed-up/ })

/**
 * Výplň progress baru na kartě jednotky, které patří tlačítko AI (null, když jednotka nepracuje).
 * Karta je rodič horního řádku s tlačítkem AI; progress bar je 22 px vysoký pruh (MemberCard).
 *
 * @param aiButton - Tlačítko AI na kartě
 * @returns Element výplně progress baru, nebo null
 */
function progressFill(aiButton: HTMLElement): HTMLElement | null {
  const card = aiButton.parentElement!.parentElement!
  return card.querySelector<HTMLElement>('div[style*="height: 22px"] > div')
}

/**
 * Nastaví AI multiplikátor jednotce na pozici `index` přes UI (tlačítko AI → volba).
 *
 * @param index - Pořadí karty jednotky v Team panelu
 * @param label - Text volby: „2×“, „5×“ nebo „off“
 */
function setAi(index: number, label: '2×' | '5×' | 'off'): void {
  fireEvent.click(aiButtons()[index])
  const group = screen.getByRole('group', { name: 'AI speed-up options' })
  fireEvent.click(Array.from(group.querySelectorAll('button')).find(b => b.textContent === label)!)
}

describe('feat-019: tlačítko AI je jen v Advanced a Cash Flow', () => {
  it('Advanced: každá karta jednotky má tlačítko AI (výchozí stav „AI“)', () => {
    render(<Simulator />)
    click(/Advanced/)
    const units = screen.getAllByTitle('Remove unit').length
    expect(units).toBeGreaterThan(0)
    expect(aiButtons()).toHaveLength(units)
    for (const b of aiButtons()) expect(b.textContent).toBe('AI')
  })

  it('Cash Flow: každá karta jednotky má tlačítko AI', () => {
    render(<Simulator />)
    click(/Cash Flow/)
    const units = screen.getAllByTitle('Remove unit').length
    expect(units).toBeGreaterThan(0)
    expect(aiButtons()).toHaveLength(units)
  })

  it('Compare: žádné tlačítko AI', () => {
    // Compare je výchozí mód při prvním načtení (feat-009)
    render(<Simulator />)
    expect(screen.getAllByText(/Compare/).length).toBeGreaterThan(0)
    expect(aiButtons()).toHaveLength(0)
  })
})

describe('feat-019 Příklad 5: nastavení AI v Simulatoru', () => {
  it('Advanced: volba 5× změní tlačítko jednotky na „5×“, ostatní jednotky zůstanou „AI“', () => {
    render(<Simulator />)
    click(/Advanced/)
    setAi(0, '5×')
    expect(aiButtons()[0].textContent).toBe('5×')
    for (const b of aiButtons().slice(1)) expect(b.textContent).toBe('AI')
  })

  it('Advanced: „off“ vrátí jednotku na „AI“', () => {
    render(<Simulator />)
    click(/Advanced/)
    setAi(1, '2×')
    expect(aiButtons()[1].textContent).toBe('2×')
    setAi(1, 'off')
    expect(aiButtons()[1].textContent).toBe('AI')
  })

  it('Advanced a Cash Flow mají vlastní týmy: AI nastavené v Cash Flow se v Advanced neprojeví', () => {
    render(<Simulator />)
    click(/Cash Flow/)
    setAi(0, '5×')
    expect(aiButtons()[0].textContent).toBe('5×')
    click(/Advanced/)
    for (const b of aiButtons()) expect(b.textContent).toBe('AI')
    click(/Cash Flow/)
    expect(aiButtons()[0].textContent).toBe('5×')
  })

  it('Příklad 4 v UI: změna AI za běhu nezahodí rozpracovanost úkolu jednotky', async () => {
    render(<Simulator />)
    click(/Advanced/)
    click(/Start/)
    await advance(300)
    // Jednotka, která právě pracuje (má na kartě progress bar)
    const idx = aiButtons().findIndex(b => progressFill(b) !== null)
    expect(idx).toBeGreaterThanOrEqual(0)
    const before = parseFloat(progressFill(aiButtons()[idx])!.style.width)
    expect(before).toBeGreaterThan(0)
    setAi(idx, '5×')
    expect(aiButtons()[idx].textContent).toBe('5×')
    // Samotná změna nic nevynuluje — progress bar zůstane, kde byl (čas mezitím neběžel)
    expect(parseFloat(progressFill(aiButtons()[idx])!.style.width)).toBeCloseTo(before, 5)
  })
})

describe('feat-019 Příklad 6: Generate new backlog zachová nastavení AI', () => {
  it.each([[/Advanced/], [/Cash Flow/]])('mód %s: po „Generate new backlog“ má jednotka stále 5×', (mode) => {
    render(<Simulator />)
    click(mode)
    setAi(0, '5×')
    click('♻ Backlog')
    click(/Generate new backlog/)
    expect(aiButtons()[0].textContent).toBe('5×')
  })
})

describe('feat-019 Příklad 6: Reset zachová nastavení AI', () => {
  it('Advanced: po běhu a „Reset backlog“ má jednotka stále 5×', async () => {
    render(<Simulator />)
    click(/Advanced/)
    setAi(0, '5×')
    click(/Start/)
    await advance(1000)
    click(/Reset backlog/)
    expect(aiButtons()[0].textContent).toBe('5×')
  })
})

describe('feat-019 Příklad 7: preset a AI', () => {
  it('Advanced: změna AI přepne preset na custom — volba presetu ukáže dialog a po potvrzení mají všichni AI 1×', () => {
    render(<Simulator />)
    click(/Advanced/)
    setAi(0, '5×')
    setAi(1, '2×')
    click('People')
    // Změna AI je ruční úprava týmu → preset je „custom“ → potvrzovací dialog
    expect(screen.getByText('Apply “People” preset?')).toBeTruthy()
    click('Apply preset')
    expect(aiButtons().length).toBeGreaterThan(0)
    for (const b of aiButtons()) expect(b.textContent).toBe('AI')
  })

  it('Cash Flow: změna AI přepne preset na custom (volba presetu ukáže dialog)', () => {
    render(<Simulator />)
    click(/Cash Flow/)
    setAi(0, '5×')
    click('People')
    expect(screen.getByText('Apply “People” preset?')).toBeTruthy()
    click('Apply preset')
    for (const b of aiButtons()) expect(b.textContent).toBe('AI')
  })
})

describe('feat-019: tooltip dlaždice Coordination overhead (rozhodnutí A)', () => {
  const SETTINGS: SimSettings = {
    minBacklog: 0, wipLimit: 6, sizeVar: 0.4, roleVar: 0.5, initialBacklog: 5, minSpecializations: 1,
  }

  it('tooltip na konci vysvětluje, že jednotky s AI zpracují práci navíc rychleji', () => {
    const state = makeInitialState(mulberry32(42), SETTINGS)
    render(
      <CashFlowPanel
        state={state}
        stats={computeStats([])}
        totalTimeDisplay="00:00.0"
        avgWip={null}
        revenueComparison={{ value: 0, currentTotal: { revenue: 0, time: 0 } }}
        showCoordination
      />,
    )
    const tile = screen.getByTestId('stat-tile-Coordination overhead')
    const tooltip = tile.getAttribute('title') ?? ''
    // Stávající text zůstává, nová věta je na konci
    expect(tooltip).toContain('It is counted in work-seconds across all units')
    expect(tooltip.endsWith('Units using AI process this extra work faster, so the share can be higher than the time it actually took.')).toBe(true)
  })
})
