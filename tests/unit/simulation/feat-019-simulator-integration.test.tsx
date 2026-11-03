import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { Simulator } from '@/components/Simulator'
import { CashFlowPanel } from '@/components/CashFlowPanel'
import cardStyles from '@/components/MemberCard.module.css'
import { computeStats, makeInitialState, mulberry32 } from '@/simulation/engine'
import { markTutorialCompleted, markModeSeen, resetTutorial } from '@/lib/storage'
import type { SimSettings } from '@/types/simulation'

// feat-019 (AI multiplikátor výkonu, revize 2026-11-03: AI po skillech) — propojení tlačítek AI na chipech
// skillů se Simulatorem.
//
// Schválený kontrakt (spec features/feat-019-ai-multiplikator-vykonu.md):
//  - Tlačítko „AI speed-up for <skill>“ má každý chip skillu na kartě jednotky v Advanced (Experimentování)
//    i Cash Flow; režim Compare (Srovnání) ho nemá. V horním řádku karty tlačítko AI není.
//  - Každé kliknutí na tlačítko nastaví další hodnotu v pořadí 1× → 2× → 5× → 1× (bez menu voleb).
//  - Handler `handleSetAiMultiplier(memberId, role, value)` v Simulator.tsx (Advanced) a v useCashFlowSimSetup.ts
//    (Cash Flow) nastaví jednotce AI u daného skillu a překreslí UI. Každé kliknutí se počítá jako ruční úprava
//    týmu (preset přejde na „custom“, i když se kolečkem vrátí na 1×), takže další volba presetu ukáže
//    potvrzovací dialog.
//  - Odebrání skillu křížkem na chipu (v Advanced i Cash Flow) nastavení AI toho skillu zapomene (Příklad 9).
//  - Aplikace presetu vytvoří tým bez AI (Příklad 11). Reset a „Generate new backlog“ nastavení AI zachovají
//    (Příklad 10).
//  - Advanced a Cash Flow mají každý vlastní tým, nastavení AI se mezi nimi nepřenáší.
//  - Tooltip dlaždice Coordination overhead (Cash Flow) dostane na konec větu o skillech s AI.

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
  // Uložený preset z předchozího testu by změnil výchozí stav („custom“ → dialog hned napoprvé)
  localStorage.clear()
  resetTutorial()
  markTutorialCompleted()
  markModeSeen('compare')
  markModeSeen('experiment')
  markModeSeen('cashflow')
})

afterEach(() => {
  vi.useRealTimers()
})

/** Posune falešný čas o `ms` milisekund uvnitř act(), aby se React stihl překreslit. */
async function advance(ms: number): Promise<void> {
  await act(async () => { vi.advanceTimersByTime(ms) })
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))
// Záložky módů jsou od feat-021 role="tab" (dřív tlačítka)
const tab = (name: RegExp) => fireEvent.click(screen.getByRole('tab', { name }))
// Přístupný název tlačítka AI je „AI speed-up for <skill>“, se zapnutým AI „AI speed-up for <skill>: 5×“.
// Pořadí v poli: karty jednotek shora dolů, v kartě chipy zleva doprava.
const aiButtons = () => screen.queryAllByRole('button', { name: /^AI speed-up for / })

/**
 * Karta jednotky, do které patří dané tlačítko AI.
 *
 * @param button - Tlačítko AI na chipu
 * @returns Kořenový element karty (`MemberCard`)
 */
function cardOf(button: HTMLElement): HTMLElement {
  return button.closest<HTMLElement>(`.${cardStyles.card}`)!
}

/**
 * Výplň progress baru na kartě jednotky (null, když jednotka nepracuje).
 * Progress bar je 22 px vysoký pruh (MemberCard).
 *
 * @param card - Karta jednotky
 * @returns Element výplně progress baru, nebo null
 */
function progressFill(card: HTMLElement): HTMLElement | null {
  return card.querySelector<HTMLElement>('div[style*="height: 22px"] > div')
}

/**
 * Název skillu z přístupného názvu tlačítka AI („AI speed-up for Frontend“ i „… for Frontend: 5×“).
 *
 * @param button - Tlačítko AI
 * @returns Název skillu
 */
function skillOf(button: HTMLElement): string {
  return button.getAttribute('aria-label')!.replace(/^AI speed-up for /, '').replace(/: \d×$/, '')
}

/**
 * Nastaví AI u skillu na pozici `index` přes UI: kliká na tlačítko AI, dokud neukazuje požadovanou
 * hodnotu. Kolečko 1× → 2× → 5× → 1× má tři kroky, takže stačí nejvýš tři kliknutí.
 *
 * @param index  - Pořadí tlačítka AI mezi všemi chipy v Team panelu
 * @param target - Text tlačítka, na který se má dojít: „2×“, „5×“ nebo „AI“ (vypnuto)
 */
function setAi(index: number, target: '2×' | '5×' | 'AI'): void {
  for (let i = 0; i < 3 && aiButtons()[index].textContent !== target; i++) fireEvent.click(aiButtons()[index])
  expect(aiButtons()[index].textContent).toBe(target)
}

describe('feat-019: tlačítka AI jsou jen na chipech v Advanced a Cash Flow', () => {
  it('Advanced: každý chip skillu má tlačítko AI (výchozí stav „AI“) a v horním řádku karty žádné není', () => {
    render(<Simulator />)
    tab(/Advanced/)
    const chips = screen.getAllByTitle('Remove role').length
    expect(chips).toBeGreaterThan(0)
    expect(aiButtons()).toHaveLength(chips)
    for (const b of aiButtons()) expect(b.textContent).toBe('AI')
    for (const remove of screen.getAllByTitle('Remove unit')) {
      expect(within(remove.parentElement!).queryByRole('button', { name: /AI speed-up/ })).toBeNull()
    }
  })

  it('Cash Flow: každý chip skillu má tlačítko AI', () => {
    render(<Simulator />)
    tab(/Cash Flow/)
    const chips = screen.getAllByTitle('Remove role').length
    expect(chips).toBeGreaterThan(0)
    expect(aiButtons()).toHaveLength(chips)
  })

  it('Compare: žádné tlačítko AI', () => {
    // Compare je výchozí mód při prvním načtení (feat-009)
    render(<Simulator />)
    expect(screen.getAllByText(/Compare/).length).toBeGreaterThan(0)
    expect(aiButtons()).toHaveLength(0)
  })
})

describe('feat-019 Příklad 8: nastavení AI u skillu v Simulatoru', () => {
  it.each([[/Advanced/], [/Cash Flow/]])('mód %s: tři kliknutí přepnou jeden skill 2× → 5× → „AI“, ostatní chipy zůstanou „AI“, menu se neotevře', (mode) => {
    render(<Simulator />)
    tab(mode)
    for (const expected of ['2×', '5×', 'AI']) {
      fireEvent.click(aiButtons()[1])
      expect(aiButtons()[1].textContent).toBe(expected)
      expect(screen.queryByRole('group', { name: 'AI speed-up options' })).toBeNull()
      for (const [i, b] of aiButtons().entries()) if (i !== 1) expect(b.textContent).toBe('AI')
    }
  })

  it('AI nastavené u jednoho chipu nezmění jiný chip téže jednotky ani stejný skill u jiné jednotky', () => {
    render(<Simulator />)
    tab(/Advanced/)
    setAi(0, '5×')
    const first = aiButtons()[0]
    const skill = skillOf(first)
    expect(first.textContent).toBe('5×')
    for (const b of aiButtons().slice(1)) expect(b.textContent).toBe('AI')
    // Stejný skill u jiné jednotky (pokud ho má) zůstává bez AI — nastavení patří dvojici jednotka + skill
    const sameSkillElsewhere = aiButtons().filter(b => cardOf(b) !== cardOf(first) && skillOf(b) === skill)
    for (const b of sameSkillElsewhere) expect(b.textContent).toBe('AI')
  })

  it('Advanced a Cash Flow mají vlastní týmy: AI nastavené v Cash Flow se v Advanced neprojeví', () => {
    render(<Simulator />)
    tab(/Cash Flow/)
    setAi(0, '5×')
    expect(aiButtons()[0].textContent).toBe('5×')
    tab(/Advanced/)
    for (const b of aiButtons()) expect(b.textContent).toBe('AI')
    tab(/Cash Flow/)
    expect(aiButtons()[0].textContent).toBe('5×')
  })

  it('Příklad 6 v UI: změna AI u skillu, na kterém jednotka pracuje, nezahodí rozpracovanost úkolu', async () => {
    render(<Simulator />)
    tab(/Advanced/)
    click(/Run$/)
    await advance(300)
    // Karta jednotky, která právě pracuje (má progress bar), a skill jejího úkolu (název v řádku úkolu)
    const working = aiButtons().map(cardOf).find(c => progressFill(c) !== null)
    expect(working).toBeTruthy()
    const skill = working!.querySelector<HTMLElement>(`.${cardStyles.taskRole}`)!.textContent!
    const before = parseFloat(progressFill(working!)!.style.width)
    expect(before).toBeGreaterThan(0)
    // Kolečko na chipu pracovaného skillu: 1× → 2× → 5×
    const chipButton = () => within(working!).getByRole('button', { name: new RegExp(`^AI speed-up for ${skill}`) })
    fireEvent.click(chipButton())
    fireEvent.click(chipButton())
    expect(chipButton().textContent).toBe('5×')
    // Samotná změna nic nevynuluje — progress bar zůstane, kde byl (čas mezitím neběžel)
    expect(parseFloat(progressFill(working!)!.style.width)).toBeCloseTo(before, 5)
    // Značka u úkolu ukazuje, že tento úkol jede zrychleně (Příklad 14)
    expect(within(working!.querySelector<HTMLElement>(`.${cardStyles.taskLine}`)!).getByTitle('AI speed-up: 5×')).toBeTruthy()
  })
})

describe('feat-019 Příklad 9: odebrání skillu zapomene AI', () => {
  it.each([[/Advanced/], [/Cash Flow/]])('mód %s: po odebrání skillu křížkem a jeho opětovném přidání je AI 1×', (mode) => {
    render(<Simulator />)
    tab(mode)
    setAi(0, '5×')
    const card = cardOf(aiButtons()[0])
    const skill = skillOf(aiButtons()[0])
    const skillButton = () => within(card).queryByRole('button', { name: new RegExp(`^AI speed-up for ${skill}`) })

    // Křížek skillu na stejném chipu
    fireEvent.click(within(aiButtons()[0].parentElement!).getByTitle('Remove role'))
    expect(skillButton()).toBeNull()

    // Skill se vrátí přes „+“ a výběr v pickeru
    fireEvent.click(within(card).getByRole('button', { name: 'Add skill' }))
    fireEvent.click(within(card).getByRole('button', { name: skill }))
    expect(skillButton()).not.toBeNull()
    expect(skillButton()!.textContent).toBe('AI')
    expect(skillButton()!.getAttribute('aria-label')).toBe(`AI speed-up for ${skill}`)
  })
})

describe('feat-019 Příklad 10: Generate new backlog zachová nastavení AI', () => {
  it.each([[/Advanced/], [/Cash Flow/]])('mód %s: po „Generate new backlog“ má skill stále 5×', (mode) => {
    render(<Simulator />)
    tab(mode)
    setAi(0, '5×')
    click('Backlog')
    click(/Generate new backlog/)
    expect(aiButtons()[0].textContent).toBe('5×')
  })
})

describe('feat-019 Příklad 10: Reset zachová nastavení AI', () => {
  it('Advanced: po běhu a „Reset“ má skill stále 5×', async () => {
    render(<Simulator />)
    tab(/Advanced/)
    setAi(0, '5×')
    click(/Run$/)
    await advance(1000)
    click(/Reset$/)
    expect(aiButtons()[0].textContent).toBe('5×')
  })
})

describe('feat-019 Příklad 11: preset a AI', () => {
  it('Advanced: změna AI přepne preset na custom — volba presetu ukáže dialog a po potvrzení mají všechny skilly AI 1×', () => {
    render(<Simulator />)
    tab(/Advanced/)
    setAi(0, '5×')
    setAi(1, '2×')
    click('People')
    // Změna AI je ruční úprava týmu → preset je „custom“ → potvrzovací dialog
    expect(screen.getByText('Apply “People” preset?')).toBeTruthy()
    click('Apply preset')
    expect(aiButtons().length).toBeGreaterThan(0)
    for (const b of aiButtons()) expect(b.textContent).toBe('AI')
  })

  it('Advanced: celé kolečko zpět na „AI“ (1×) nechá preset custom — volba presetu ukáže dialog', () => {
    render(<Simulator />)
    tab(/Advanced/)
    setAi(0, '2×')
    setAi(0, 'AI')
    click('People')
    // Každé kliknutí je ruční úprava týmu, i když skill skončí zase na 1×
    expect(screen.getByText('Apply “People” preset?')).toBeTruthy()
  })

  it('Cash Flow: změna AI přepne preset na custom (volba presetu ukáže dialog)', () => {
    render(<Simulator />)
    tab(/Cash Flow/)
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

  it('tooltip na konci vysvětluje, že skilly s AI zpracují práci navíc rychleji', () => {
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
    expect(tooltip.endsWith('Skills using AI process this extra work faster, so the share can be higher than the time it actually took.')).toBe(true)
  })
})
