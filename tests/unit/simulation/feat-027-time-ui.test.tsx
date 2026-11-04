import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act, within, waitFor } from '@testing-library/react'
import * as XLSX from 'xlsx'
import type { ComponentProps } from 'react'
import { Simulator } from '@/components/Simulator'
import { CashFlowPanel } from '@/components/CashFlowPanel'
import { SpeedControl } from '@/components/SpeedControl'
import { RevenueCurvePreview } from '@/components/RevenueCurvePreview'
import { WorkTimeValue } from '@/components/WorkTimeValue'
import { TUTORIAL_STEPS } from '@/lib/tutorialSteps'
import type { RevenueComparison } from '@/lib/revenueComparison'
import { markTutorialCompleted, markModeSeen, resetTutorial } from '@/lib/storage'
import { computeStats, makeInitialState, mulberry32 } from '@/simulation/engine'
import type { SimSettings, SimState } from '@/types/simulation'
import { WORK_TIME_PATTERN, parseWorkDays, simDays, workTimeValues } from './workTime'

// feat-027 (Čas simulace v pracovních dnech) — jak se čas a výnos ukazují v rozhraní.
//
// Schválený kontrakt (spec features/feat-027-cas-simulace-pracovni-dny.md, UI / Design a Příklady 4–16):
//  - Total Time (Compare, Advanced, Cash Flow): týdny a dny „2 weeks 4.3 days“ (komponenta `WorkTimeValue`);
//    před spuštěním v Compare „—“, v Advanced a Cash Flow „0.0 days“; po doběhnutí čítač zamrzne a dlaždice
//    ukáže „✓ Complete“. 1× = 1 pracovní den za reálnou sekundu.
//  - Doby trvání v prostých dnech: Avg Cycle Time (hodnota „9.1“ + jednotka „days“, v Compare „24.1 days“),
//    lead time v Done listu „12.4 days“, Total Wait v „man-days“ (nulová hodnota zůstává „—“).
//  - Tooltipy dlaždic mluví o dnech; tooltip Coordination overhead říká „man-days of work“.
//  - Tik výnosu = týden: badge „€400/week“ (karta v Backlogu, řádek v Done), náhled křivky
//    „Revenue per week after delivery · 0–16 weeks · plateau 2× Flat“, odpočet do dalšího výnosu v 5denní periodě.
//  - Cash Flow: hint „@ 32 weeks 4.9 days“ a detail dlaždice Revenue (time-matched) ve stejném zápisu.
//  - `CashFlowPanel.totalTimeDisplay` přijímá `ReactNode` (Simulator mu předá `WorkTimeValue`).
//  - XLS import: pod tlačítky Import XLS / Template je nápověda „Size = effort in working days (man-days)“,
//    vidět i po importu. Přepínač rychlosti má popisek „1× = 1 working day per second“.
//  - Tutoriál: žádný krok nemluví o sekundách simulačního času ani o „MM:SS“; výnos je „every 5 working days (1 week)“.
// Simulaci pohání falešný čas (requestAnimationFrame + performance), jako v ostatních integračních testech.

const SETTINGS: SimSettings = {
  minBacklog: 0,
  wipLimit: 6,
  sizeVar: 0.4,
  roleVar: 0.5,
  initialBacklog: 3,
  minSpecializations: 1,
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
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
const openTab = (name: RegExp) => fireEvent.click(screen.getByRole('tab', { name }))
const tile = (label: string) => screen.getByTestId(`stat-tile-${label}`)
const runButton = () => screen.getByRole('button', { name: '▶ Run' })

/** Rychlost 10× na liště (běh o desítky dní trvá pár sekund falešného času). */
const setSpeed10 = () => fireEvent.click(screen.getByRole('button', { name: '10×' }))

/** Nastaví slider „Backlog size“ (najde ho podle přístupného jména, viz feat-003). */
function setBacklogSize(size: number): void {
  fireEvent.change(screen.getByRole('slider', { name: 'Backlog size' }), { target: { value: String(size) } })
}

/** Malý backlog (20 featur), aby běh do konce v testu netrval dlouho. */
function useSmallBacklog(): void {
  click('Backlog')
  setBacklogSize(20)
  click(/Generate new backlog/)
}

/** Posouvá falešný čas, dokud tlačítko neukáže „✓ Done“ (celý backlog zpracovaný). */
async function advanceUntilDone(): Promise<void> {
  for (let waited = 0; waited < 60_000; waited += 500) {
    if (screen.queryByRole('button', { name: /Done/ })) return
    await advance(500)
  }
  throw new Error('Běh nedoběhl ani za 60 s falešného času')
}

/** Časový limit (reálný čas) testů, které posouvají falešný čas o desítky dní simulace. */
const SIM_RUN_TIMEOUT_MS = 20_000

// ───────────────────────────────────────────────────────────────────────────────
// Total Time ve třech módech (Příklady 4 a 5)
// ───────────────────────────────────────────────────────────────────────────────

describe('feat-027 Příklady 4 a 5: Total Time v týdnech a dnech', { timeout: SIM_RUN_TIMEOUT_MS }, () => {
  it.each([[/Advanced/], [/Cash Flow/]])('%s: před prvním spuštěním „0.0 days“', mode => {
    render(<Simulator />)
    openTab(mode)
    expect(workTimeValues()).toHaveLength(1)
    expect(workTimeValues()[0]).toHaveTextContent(/^0\.0 days$/)
    expect(within(tile('Total Time')).getByTestId('work-time-value')).toBeInTheDocument()
  })

  it('Compare: před spuštěním oba týmy ukazují „—“ (žádný čítač času)', () => {
    render(<Simulator />)
    expect(workTimeValues()).toHaveLength(0)
    expect(screen.getAllByText('Total Time')).toHaveLength(2)
  })

  it('Advanced: při 1× roste o jeden pracovní den za reálnou sekundu (po pěti sekundách zhruba jeden týden)', async () => {
    render(<Simulator />)
    openTab(/Advanced/)
    fireEvent.click(runButton())
    await advance(5000)
    const text = workTimeValues()[0].textContent!
    expect(text).toMatch(new RegExp(`^${WORK_TIME_PATTERN}$`))
    // První snímek smyčky se zahazuje, proto tolerance půl dne (stejně jako u rychlosti ve feat-021)
    expect(Math.abs(parseWorkDays(text) - 5)).toBeLessThanOrEqual(0.5)
  })

  it('Advanced: při 10× roste desetkrát rychleji než při 1×', async () => {
    render(<Simulator />)
    openTab(/Advanced/)
    setSpeed10()
    fireEvent.click(runButton())
    await advance(1000)
    // stejná tolerance jako u rychlosti ve feat-021: 0,15 × rychlost + 0,15
    expect(Math.abs(simDays() - 10)).toBeLessThanOrEqual(1.65)
  })

  it('Advanced: po doběhnutí čítač zamrzne v týdnech a dnech a dlaždice ukáže „✓ Complete“', async () => {
    render(<Simulator />)
    openTab(/Advanced/)
    useSmallBacklog()
    setSpeed10()
    fireEvent.click(runButton())
    await advanceUntilDone()

    const total = within(tile('Total Time'))
    expect(total.getByText('✓ Complete')).toBeInTheDocument()
    const frozen = workTimeValues()[0].textContent!
    expect(frozen).toMatch(new RegExp(`^${WORK_TIME_PATTERN}$`))
    // běh o 20 featurách trvá víc než týden, takže čas má týdny
    expect(frozen).toMatch(/^\d+ weeks? /)
    await advance(2000)
    expect(workTimeValues()[0]).toHaveTextContent(frozen)
  })

  it('Compare: za běhu ukazují oba týmy čas v týdnech a dnech', async () => {
    render(<Simulator />)
    setSpeed10()
    fireEvent.click(runButton())
    await advance(3000)
    const values = workTimeValues()
    expect(values).toHaveLength(2)
    for (const value of values) expect(value.textContent).toMatch(new RegExp(`^${WORK_TIME_PATTERN}$`))
    expect(parseWorkDays(values[0].textContent!)).toBeGreaterThan(0)
  })
})

// ───────────────────────────────────────────────────────────────────────────────
// Doby trvání v dnech (Příklady 6, 7, 8)
// ───────────────────────────────────────────────────────────────────────────────

describe('feat-027 Příklady 6–8: doby trvání ve dnech', { timeout: SIM_RUN_TIMEOUT_MS }, () => {
  it('Advanced: Avg Cycle Time „days“, Total Wait „man-days“, lead time v Done „N days“, nikde „s“', async () => {
    render(<Simulator />)
    openTab(/Advanced/)
    useSmallBacklog()
    // Ve výchozím nastavení nikdo nečeká (Total Wait je „—“). Skilly v pozdější fázi („+“ u Phase) čekají
    // na dřívější fáze, takže jednotky stojí a Total Wait je nenulový.
    click('Skills')
    const plus = screen.getAllByRole('button', { name: '+' })
    fireEvent.click(plus[plus.length - 1])
    fireEvent.click(plus[plus.length - 2])
    setSpeed10()
    fireEvent.click(runButton())
    await advanceUntilDone()

    const cycle = tile('Avg Cycle Time')
    expect(within(cycle).getByText('days')).toBeInTheDocument()
    expect(cycle).toHaveTextContent(/\d+\.\d\s?days/)
    expect(within(tile('Total Wait')).getByText('man-days')).toBeInTheDocument()
    expect(tile('Total Wait')).toHaveTextContent(/\d+\.\d\s?man-days/)

    const rows = screen.getAllByText(/^\d+\.\d days$/)
    expect(rows.length).toBeGreaterThan(0)
    expect(screen.queryAllByText(/^\d+\.\ds$/)).toHaveLength(0)
    expect(within(cycle).queryByText('s')).toBeNull()
  })

  it('Příklad 8: nulové čekání zůstává „—“ bez jednotky', () => {
    render(<Simulator />)
    openTab(/Advanced/)
    expect(tile('Total Wait')).toHaveTextContent('—')
    expect(within(tile('Total Wait')).queryByText('man-days')).toBeNull()
  })

  it('Advanced: tooltipy dlaždic mluví o dnech, Total Wait vysvětluje man-days přes jednotky', () => {
    render(<Simulator />)
    openTab(/Advanced/)
    expect(tile('Total Time').getAttribute('title')).toMatch(/working days?/i)
    expect(tile('Avg Cycle Time').getAttribute('title')).toMatch(/working days?/i)
    expect(tile('Total Wait').getAttribute('title')).toMatch(/man-days?/i)
    expect(tile('Total Wait').getAttribute('title')).toMatch(/units?/i)
  })

  it('Compare: Avg Cycle Time „N days“ a lead time v Done „N days“ za běhu, žádné „s“', async () => {
    render(<Simulator />)
    setSpeed10()
    fireEvent.click(runButton())
    await advance(4000)
    expect(screen.getAllByText(/^\d+\.\d days$/).length).toBeGreaterThan(0)
    expect(screen.queryAllByText(/^\d+\.\ds$/)).toHaveLength(0)
    // hodnota Avg Cycle Time týmu: číslo a „days“
    const [cycleLabel] = screen.getAllByText('Avg Cycle Time')
    // „24.1 days“ s mezerou v textu (kopírování, čtečky), jednotka je přesto kreslená malým písmem
    expect(cycleLabel.parentElement).toHaveTextContent(/\d+\.\d days/)
    expect(within(cycleLabel.parentElement!).getByText('days')).toBeInTheDocument()
  })

  it('Compare: dokud nic nedoběhlo, Avg Cycle Time zůstává „—“ bez jednotky', () => {
    render(<Simulator />)
    const [cycleLabel] = screen.getAllByText('Avg Cycle Time')
    expect(cycleLabel.parentElement).toHaveTextContent('—')
    expect(cycleLabel.parentElement).not.toHaveTextContent('days')
  })
})

// ───────────────────────────────────────────────────────────────────────────────
// Cash Flow: panel s výnosem (Příklady 6, 10, 11, 12)
// ───────────────────────────────────────────────────────────────────────────────

/** Čerstvý stav (simTime 0, neběží). */
const freshState = (): SimState => makeInitialState(mulberry32(42), SETTINGS)

/** Stav s hotovými featurami: každá je [základ výnosu €/týden, profil, den dokončení]. */
function stateWithDone(done: Array<['flat' | 'j-curve', number, number]>, simTime: number): SimState {
  const state = freshState()
  state.simTime = simTime
  for (const [profile, base, finishedAt] of done) {
    const feature = state.backlog.pop()!
    feature.status = 'done'
    feature.finishedAt = finishedAt
    feature.revenuePerTick = base
    feature.totalRevenue = 0
    feature.lastTickRevenue = null
    feature.lastRevenueTickAt = finishedAt
    feature.revenueProfile = profile
    feature.revenueTickCount = 0
    state.done.push(feature)
  }
  return state
}

const NO_COMPARISON: RevenueComparison = { value: 0, currentTotal: { revenue: 0, time: 0 } }

function renderPanel(state: SimState, extra: Partial<ComponentProps<typeof CashFlowPanel>> = {}) {
  const props: ComponentProps<typeof CashFlowPanel> = {
    state,
    stats: computeStats(state.leadTimes),
    totalTimeDisplay: <WorkTimeValue days={state.simTime} />,
    avgWip: 2,
    revenueComparison: NO_COMPARISON,
    ...extra,
  }
  return render(<CashFlowPanel {...props} />)
}

describe('feat-027: CashFlowPanel — čas a výnos za týden', () => {
  it('Total Time dostane hodnotu jako ReactNode (WorkTimeValue) a ukáže ji v týdnech a dnech', () => {
    renderPanel(stateWithDone([], 14.3))
    expect(within(tile('Total Time')).getByTestId('work-time-value')).toHaveTextContent(/^2 weeks 4\.3 days$/)
  })

  it('Příklad 11: řádky v Done ukazují „€400/week“ (Flat) a „€800/week“ (J-curve se základem €400), žádné „/tick“', () => {
    const state = stateWithDone([['flat', 400, 0], ['j-curve', 400, 0]], 1)
    const { container } = renderPanel(state)
    expect(screen.getByText(/€400\/week/)).toBeInTheDocument()
    expect(screen.getByText(/€800\/week/)).toBeInTheDocument()
    expect(container.textContent).not.toContain('/tick')
  })

  it('Příklad 10: odpočítávací proužek při 14.5 dne ukazuje 50 % (featura hotová ve dni 12, perioda 5 dní)', () => {
    const { container } = renderPanel(stateWithDone([['flat', 400, 12]], 14.5))
    const fill = container.querySelector<HTMLElement>('[class*="countdownFill"]')
    expect(fill).not.toBeNull()
    expect(fill!.style.width).toBe('50%')
  })

  it('Příklad 10: těsně před tikem (den 16.5) je proužek na 90 %', () => {
    const { container } = renderPanel(stateWithDone([['flat', 400, 12]], 16.5))
    expect(container.querySelector<HTMLElement>('[class*="countdownFill"]')!.style.width).toBe('90%')
  })

  it('Příklad 6: Avg Cycle Time má hodnotu „9.1“ a jednotku „days“; bez dokončených featur „—“ bez jednotky', () => {
    const state = stateWithDone([], 20)
    const withStats = computeStats([{ id: 1, ms: 9.1, finishedAt: 12, handoffs: 0 }])
    const { unmount } = renderPanel(state, { stats: withStats })
    const cycle = within(tile('Avg Cycle Time'))
    expect(cycle.getByText('days')).toBeInTheDocument()
    expect(tile('Avg Cycle Time')).toHaveTextContent('9.1')
    unmount()

    renderPanel(state)
    expect(tile('Avg Cycle Time')).toHaveTextContent('—')
    expect(within(tile('Avg Cycle Time')).queryByText('days')).toBeNull()
  })

  it('Příklad 12: hint a detail výnosu mají čas v týdnech a dnech', async () => {
    const comparison: RevenueComparison = {
      value: 1200,
      currentTotal: { revenue: 1200, time: 164.9 },
      comparison: {
        compareTime: 164.9,
        delta: 12,
        previous: { revenueAtCompare: 1071, totalRevenue: 1100, totalTime: 187.9 },
      },
    }
    renderPanel(stateWithDone([], 164.9), { revenueComparison: comparison })
    const revenue = tile('Revenue (time-matched)')
    expect(revenue).toHaveTextContent('@ 32 weeks 4.9 days')
    fireEvent.click(within(revenue).getByRole('button', { name: /details/i }))
    expect(revenue).toHaveTextContent('Total €1.2k in 32 weeks 4.9 days')
    expect(revenue).toHaveTextContent('Previous run @ 32 weeks 4.9 days: €1.1k')
    expect(revenue).toHaveTextContent('Previous total €1.1k in 37 weeks 2.9 days')
  })

  it('tooltip Coordination overhead počítá v man-days of work, ne v work-seconds', () => {
    renderPanel(stateWithDone([], 20), { showCoordination: true })
    const title = tile('Coordination overhead').getAttribute('title')!
    expect(title).toContain('man-days of work')
    expect(title).not.toContain('work-seconds')
  })
})

describe('feat-027 Příklad 11: Cash Flow v Simulatoru', { timeout: SIM_RUN_TIMEOUT_MS }, () => {
  it('karty v Backlogu ukazují „€N/week“, nikde „/tick“; po dodání ukazují stejně i řádky v Done', async () => {
    render(<Simulator />)
    openTab(/Cash Flow/)
    useSmallBacklog()
    expect(screen.getAllByText(/€[\d.]+k?\/week/).length).toBeGreaterThan(0)
    expect(document.body.textContent).not.toContain('/tick')

    setSpeed10()
    fireEvent.click(runButton())
    await advance(4000)
    expect(screen.getAllByText(/€[\d.]+k?\/week/).length).toBeGreaterThan(0)
    expect(document.body.textContent).not.toContain('/tick')
    expect(workTimeValues()[0].textContent).toMatch(new RegExp(`^${WORK_TIME_PATTERN}$`))
  })
})

describe('feat-027 Příklad 13: náhled křivky výnosu', () => {
  it.each([
    ['flat', 1],
    ['j-curve', 2],
    ['s-curve', 1],
  ] as const)('%s: popisek je „Revenue per week after delivery · 0–16 weeks · plateau N× Flat“', (profile, plateau) => {
    render(<RevenueCurvePreview profile={profile} />)
    expect(screen.getByText(`Revenue per week after delivery · 0–16 weeks · plateau ${plateau}× Flat`)).toBeInTheDocument()
    expect(screen.queryByText(/tick/)).toBeNull()
  })
})

// ───────────────────────────────────────────────────────────────────────────────
// XLS import: Size = man-days (Příklad 14)
// ───────────────────────────────────────────────────────────────────────────────

/** Nápověda ke sloupci Size pod tlačítky importu. */
const SIZE_HINT = 'Size = effort in working days (man-days)'

/**
 * Vytvoří .xlsx soubor z řádků. jsdom neimplementuje File.arrayBuffer(), které import volá, proto ho
 * doplníme na instanci (stejně jako ve feat-022).
 */
function makeXlsFile(rows: Record<string, unknown>[]): File {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Backlog')
  const data: ArrayBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  const file = new File([data], 'backlog.xlsx')
  Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.resolve(data) })
  return file
}

describe('feat-027 Příklad 14: nápověda ke sloupci Size', () => {
  it.each([[/Advanced/], [/Cash Flow/]])('%s: nápověda je v rozbaleném Backlogu pod tlačítky importu', mode => {
    render(<Simulator />)
    openTab(mode)
    click('Backlog')
    const hint = screen.getByText(SIZE_HINT)
    const importButton = screen.getByRole('button', { name: /Import XLS/ })
    const templateButton = screen.getByRole('button', { name: /Template/ })
    // nápověda následuje za oběma tlačítky
    expect(importButton.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(templateButton.compareDocumentPosition(hint) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('nápověda zůstane vidět po importu a je nad hláškou o jeho výsledku', async () => {
    vi.useRealTimers()
    render(<Simulator />)
    openTab(/Advanced/)
    click('Backlog')
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
    fireEvent.change(input, { target: { files: [makeXlsFile([])] } })
    const message = await waitFor(() => screen.getByText(/The file contains no data\./))
    const hint = screen.getByText(SIZE_HINT)
    expect(hint.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})

// ───────────────────────────────────────────────────────────────────────────────
// Rychlost a její popisek (Příklad 15)
// ───────────────────────────────────────────────────────────────────────────────

describe('feat-027 Příklad 15: popisek rychlosti', () => {
  const HINT = '1× = 1 working day per second'

  /** Vykreslí ovládání běhu s atrapami callbacků. */
  function renderControl(speed: 0.5 | 1 | 10 = 1) {
    return render(
      <SpeedControl speed={speed} paused hasStarted={false} finished={false} onSpeedChange={() => {}} onTogglePause={() => {}} onReset={() => {}} />,
    )
  }

  it('popisek se ukáže po najetí na přepínač 0.5× / 1× / 10×', () => {
    renderControl()
    expect(screen.queryByText(HINT)).toBeNull()
    fireEvent.mouseEnter(screen.getByRole('group', { name: '0.5× / 1× / 10×' }).parentElement!)
    expect(screen.getByText(HINT)).toBeInTheDocument()
  })

  it('popisek zmizí po odjetí kurzoru', () => {
    renderControl()
    const root = screen.getByRole('group', { name: '0.5× / 1× / 10×' }).parentElement!
    fireEvent.mouseEnter(root)
    fireEvent.mouseLeave(root)
    expect(screen.queryByText(HINT)).toBeNull()
  })

  it('review: popisek se ukáže i při zaostření klávesnicí a zmizí při opuštění přepínače', () => {
    renderControl()
    const segment = screen.getByRole('button', { name: '1×' })
    act(() => segment.focus())
    expect(screen.getByText(HINT)).toBeInTheDocument()
    act(() => segment.blur())
    expect(screen.queryByText(HINT)).toBeNull()
  })

  it('review: posun fokusu mezi segmenty přepínače popisek neskryje', () => {
    renderControl()
    act(() => screen.getByRole('button', { name: '0.5×' }).focus())
    act(() => screen.getByRole('button', { name: '1×' }).focus())
    expect(screen.getByText(HINT)).toBeInTheDocument()
  })

  it('review: zaostření kliknutím myší popisek nepřipne (zůstane jen při najetí kurzoru)', () => {
    renderControl()
    const segment = screen.getByRole('button', { name: '10×' })
    fireEvent.mouseDown(segment)
    act(() => segment.focus())
    expect(screen.queryByText(HINT)).toBeNull()
  })

  it('popisek je stejný při každé zvolené rychlosti (říká, co znamená 1×)', () => {
    renderControl(10)
    fireEvent.mouseEnter(screen.getByRole('group', { name: '0.5× / 1× / 10×' }).parentElement!)
    expect(screen.getByText(HINT)).toBeInTheDocument()
  })
})

// ───────────────────────────────────────────────────────────────────────────────
// Tutoriál (Příklad 16)
// ───────────────────────────────────────────────────────────────────────────────

describe('feat-027 Příklad 16: tutoriál bez sekund simulačního času', () => {
  const ALL_STEPS = Object.entries(TUTORIAL_STEPS).flatMap(([mode, steps]) => steps.map(step => ({ mode, step })))

  it('žádný krok nemluví o sekundách simulace („3 s“, „simulation time“, „simulated seconds“) ani o formátu MM:SS', () => {
    const forbidden = [/\b\d+\s?s\b/, /simulation (time|seconds?)/i, /simulated seconds?/i, /MM:SS/i, /\bticks?\b/i]
    for (const { mode, step } of ALL_STEPS) {
      for (const pattern of forbidden) {
        expect(step.description, `${mode}/${step.id}: ${pattern}`).not.toMatch(pattern)
      }
    }
  })

  it('Compare: krok Results vysvětluje Total Time jako pracovní týdny a dny a cycle time jako pracovní dny', () => {
    const results = TUTORIAL_STEPS.compare.find(s => s.id === 'compare-results')!.description
    expect(results).toContain('working weeks and days')
    expect(results).toContain('working days')
  })

  it('Cash Flow: výnos featury je „every 5 working days (1 week)“ a odměna se platí každý týden', () => {
    const value = TUTORIAL_STEPS.cashflow.find(s => s.id === 'cashflow-value')!.description
    expect(value).toContain('every 5 working days (1 week)')
    const earnings = TUTORIAL_STEPS.cashflow.find(s => s.id === 'cashflow-earnings')!.description
    expect(earnings).toContain('every week')
  })

  it('kroky s ovládáním říkají, co znamená 1× (jeden pracovní den za sekundu)', () => {
    for (const [mode, id] of [['compare', 'compare-controls'], ['experiment', 'experiment-controls'], ['cashflow', 'cashflow-controls']] as const) {
      const step = TUTORIAL_STEPS[mode].find(s => s.id === id)!
      expect(step.description, `${mode}/${id}`).toContain('1× is one working day per second')
    }
  })

  it('kroky s dlaždicemi a lead time featur mluví o pracovních dnech', () => {
    const done = TUTORIAL_STEPS.compare.find(s => s.id === 'compare-done')!.description
    expect(done).toContain('lead time in working days')
    const experimentDone = TUTORIAL_STEPS.experiment.find(s => s.id === 'experiment-done')!.description
    expect(experimentDone).toContain('in working days')
  })
})
