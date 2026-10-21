import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { Simulator } from '@/components/Simulator'
import { SpeedControl } from '@/components/SpeedControl'
import { TUTORIAL_STEPS } from '@/lib/tutorialSteps'
import { markTutorialCompleted, markModeSeen, resetTutorial } from '@/lib/storage'

// feat-021, změna 2026-10-20: ovládání běhu v horní liště je ve všech třech módech stejné jako v Compare.
//
// Schválený kontrakt (spec features/feat-021-prevod-design-system-org-flow.md, Příklady 14–17):
//  - Příklad 14: vpravo za přepínačem tématu je v pořadí „?“ (jen Compare a Advanced), „↺ Reset“,
//    rychlost 0.5× / 1× / 10× (výchozí 1×) a „▶ Run“, který před prvním spuštěním pulzuje. Žádný mód
//    nemá „Start“, „Resume“, „Reset backlog“ ani rychlost „2×“. Reset má v Advanced a Cash Flow tooltip
//    „Restore the initial backlog and clear in-progress / done“, v Compare žádný.
//  - Příklad 15: Advanced a Cash Flow: Run → Pause → Run (po pauze už nepulzuje, čas od pauzy neběží,
//    další kliknutí pokračuje od stejného bodu); po doběhnutí „✓ Done“, vypnuté.
//  - Příklad 16: Reset po doběhnutí vrátí pulzující „▶ Run“.
//  - Příklad 17: oblast tutoriálu `experiment-controls` obsahuje celé ovládání včetně „?“ a texty
//    kroků tutoriálu Advanced popisují nové ovládání.
//  - Komponenta `SpeedControl` je společná pro všechny tři módy: „?“ vykreslí jen s `onRestartTutorial`,
//    tooltip Resetu nese `resetTitle`.
//  Barvy tlačítek a pulz v prohlížeči ověřuje E2E test (jsdom nepočítá styly z CSS modulů).

beforeEach(() => {
  // Rychlost běhu pohání requestAnimationFrame v Simulator.tsx — falešný čas dává deterministický průběh
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
  localStorage.clear()
  resetTutorial()
  markTutorialCompleted()
  markModeSeen('compare')
  markModeSeen('experiment')
})

afterEach(() => {
  vi.useRealTimers()
})

/** Ovládací prvky běhu v pořadí zleva doprava (bez „?“, ten má jen Compare a Advanced). */
const RUN_CONTROLS = ['↺ Reset', '0.5×', '1×', '10×', '▶ Run']

/** Tooltip tlačítka Reset v Advanced a Cash Flow (v Compare Reset tooltip nemá). */
const RESET_TOOLTIP = 'Restore the initial backlog and clear in-progress / done'

/** Časový limit (reálný čas) testů, které posouvají falešný čas o desítky sekund simulace. */
const SIM_RUN_TIMEOUT_MS = 20_000

/** Názvy tří módů tak, jak je mají záložky v liště. */
type ModeName = 'Compare' | 'Advanced' | 'Cash Flow'
const MODE_NAMES: ModeName[] = ['Compare', 'Advanced', 'Cash Flow']

/** Posune falešný čas o `ms` milisekund uvnitř act(), aby se React stihl překreslit. */
async function advance(ms: number): Promise<void> {
  await act(async () => { vi.advanceTimersByTime(ms) })
}

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }))

/** Přepne na záložku módu (Compare je výchozí, ale kliknutí na jeho záložku je neškodné). */
const openMode = (mode: ModeName) => fireEvent.click(screen.getByRole('tab', { name: mode }))

/**
 * Přístupný název tlačítka: `aria-label` (např. u „?“), jinak viditelný text.
 *
 * @param el - Tlačítko
 * @returns Název, jak ho uvidí čtečka obrazovky
 */
function nameOf(el: Element): string {
  return el.getAttribute('aria-label') ?? el.textContent?.trim() ?? ''
}

/**
 * Názvy všech tlačítek v daném kořeni v pořadí, v jakém jsou v DOM.
 *
 * @param root - Element nebo kontejner, ve kterém se tlačítka hledají
 * @returns Seznam názvů zleva doprava
 */
function namesIn(root: ParentNode): string[] {
  return Array.from(root.querySelectorAll('button')).map(nameOf)
}

/** Pravá část horní lišty: zpětná vazba, přepínač tématu a ovládání běhu (třetí potomek `<header>`, viz TopBar). */
const barControls = () => document.querySelector('header')!.lastElementChild as HTMLElement

/**
 * Ovládání běhu v liště bez ikony zpětné vazby (feat-024) a přepínače tématu — oboje je ve všech
 * módech stejné a nepatří k ovládání běhu.
 */
const controlNames = () => namesIn(barControls()).filter(n => n !== 'Send feedback' && !/theme$/.test(n))

/** Tlačítko běhu „▶ Run“ (název se shoduje přesně, takže „✓ Done“ ani „❙❙ Pause“ nesedí). */
const runButton = () => screen.getByRole('button', { name: '▶ Run' })

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
 * Simulační čas z prvního čítače „MM:SS.d“ na obrazovce (v Compare Total Time týmu A, jinde Total Time).
 *
 * @returns Čas v sekundách
 */
function simSeconds(): number {
  const [minutes, rest] = screen.getAllByText(/^\d\d:\d\d\.\d$/)[0].textContent!.split(':')
  return Number(minutes) * 60 + Number(rest)
}

// ── SpeedControl jako samostatná komponenta ──────────────────────────────────

/** Props komponenty `SpeedControl`; odvozené z ní, aby se test nerozešel s jejím skutečným rozhraním. */
type SpeedControlProps = ComponentProps<typeof SpeedControl>

/**
 * Vykreslí `SpeedControl` s rozumnými výchozími props (před prvním spuštěním, rychlost 1×).
 *
 * @param overrides - Props, které mají přebít výchozí
 * @returns Použité props (s atrapami callbacků) a kontejner s vykresleným ovládáním
 */
function renderControl(overrides: Partial<SpeedControlProps> = {}): { props: SpeedControlProps; container: HTMLElement } {
  const props: SpeedControlProps = {
    speed: 1,
    paused: true,
    hasStarted: false,
    finished: false,
    onSpeedChange: vi.fn(),
    onTogglePause: vi.fn(),
    onReset: vi.fn(),
    ...overrides,
  }
  const { container } = render(<SpeedControl {...props} />)
  return { props, container }
}

describe('feat-021 Příklad 14: SpeedControl — pořadí a obsah', () => {
  it('s onRestartTutorial: „?“, Reset, tři rychlosti a Run v tomto pořadí', () => {
    const { container } = renderControl({ onRestartTutorial: vi.fn() })
    expect(namesIn(container)).toEqual(['Restart tutorial', ...RUN_CONTROLS])
  })

  it('bez onRestartTutorial není „?“ (Cash Flow tutoriál nemá), ostatní prvky jsou ve stejném pořadí', () => {
    const { container } = renderControl()
    expect(namesIn(container)).toEqual(RUN_CONTROLS)
  })

  it.each([
    [0.5, '0.5×'],
    [1, '1×'],
    [10, '10×'],
  ] as const)('rychlost %s: nabízí jen 0.5× / 1× / 10× a stisknutá je volba „%s“', (speed, label) => {
    renderControl({ speed })
    const buttons = within(screen.getByRole('group')).getAllByRole('button')
    expect(buttons.map(b => b.textContent)).toEqual(['0.5×', '1×', '10×'])
    expect(buttons.filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.textContent)).toEqual([label])
  })

  it.each([
    ['0.5×', 0.5],
    ['10×', 10],
  ] as const)('kliknutí na „%s“ zavolá onSpeedChange(%s)', (label, expected) => {
    const { props } = renderControl()
    fireEvent.click(screen.getByRole('button', { name: label }))
    expect(props.onSpeedChange).toHaveBeenCalledExactlyOnceWith(expected)
  })
})

describe('feat-021 Příklad 14 a 15: SpeedControl — tlačítko běhu', () => {
  it.each([
    ['před prvním spuštěním', { paused: true, hasStarted: false }, '▶ Run', true],
    ['po pauze (bez „Resume“)', { paused: true, hasStarted: true }, '▶ Run', false],
    ['za běhu', { paused: false, hasStarted: true }, '❙❙ Pause', false],
  ] as const)('%s: tlačítko je „%s“ a pulz je %s', (_situace, state, label, pulses) => {
    renderControl(state)
    const button = screen.getByRole('button', { name: label })
    expect(button).toBeEnabled()
    // Pulz řídí CSS třída `pulse` z Button.module.css (animaci v prohlížeči ověřuje E2E)
    expect(/pulse/.test(button.className)).toBe(pulses)
    expect(screen.queryAllByRole('button', { name: /Start|Resume|Reset backlog/ })).toHaveLength(0)
  })

  it('po doběhnutí backlogu je „✓ Done“ vypnuté a bez pulzu', () => {
    renderControl({ finished: true, paused: true, hasStarted: true })
    const done = screen.getByRole('button', { name: '✓ Done' })
    expect(done).toBeDisabled()
    expect(/pulse/.test(done.className)).toBe(false)
    expect(screen.queryByRole('button', { name: '▶ Run' })).toBeNull()
  })

  it('kliknutí na tlačítko běhu zavolá onTogglePause, na Reset onReset, na „?“ onRestartTutorial', () => {
    const onRestartTutorial = vi.fn()
    const { props } = renderControl({ onRestartTutorial })
    fireEvent.click(screen.getByRole('button', { name: '▶ Run' }))
    expect(props.onTogglePause).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: '↺ Reset' }))
    expect(props.onReset).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: 'Restart tutorial' }))
    expect(onRestartTutorial).toHaveBeenCalledOnce()
  })

  it('resetTitle se stane tooltipem Resetu; bez něj Reset tooltip nemá', () => {
    const { unmount } = render(<SpeedControl speed={1} paused hasStarted={false} finished={false} onSpeedChange={vi.fn()} onTogglePause={vi.fn()} onReset={vi.fn()} resetTitle="Moje nápověda" />)
    expect(screen.getByRole('button', { name: '↺ Reset' })).toHaveAttribute('title', 'Moje nápověda')
    unmount()
    renderControl()
    expect(screen.getByRole('button', { name: '↺ Reset' })).not.toHaveAttribute('title')
  })

  it.each([
    ['Run (před spuštěním)', { paused: true, hasStarted: false }, '▶ Run'],
    ['Pause (za běhu)', { paused: false, hasStarted: true }, '❙❙ Pause'],
    ['Done (po doběhnutí)', { finished: true, paused: true, hasStarted: true }, '✓ Done'],
  ] as const)('runButtonTarget označí tlačítko běhu cílem tutoriálu i ve stavu %s', (_stav, state, label) => {
    const { container } = renderControl({ ...state, runButtonTarget: 'moje-run' })
    const targets = container.querySelectorAll('[data-tutorial-target="moje-run"]')
    // Cíl je právě jeden a je to tlačítko běhu, ne „?“, Reset ani rychlost
    expect(targets).toHaveLength(1)
    expect(targets[0]).toBe(screen.getByRole('button', { name: label }))
  })
})

// ── Příklad 14: stejné ovládání ve všech módech (Simulator) ──────────────────

describe('feat-021 Příklad 14: stejné ovládání běhu ve všech třech módech (Simulator)', () => {
  it.each([
    ['Compare', ['Restart tutorial', ...RUN_CONTROLS]],
    ['Advanced', ['Restart tutorial', ...RUN_CONTROLS]],
    ['Cash Flow', RUN_CONTROLS],
  ] as const)('%s: ovládání v liště je v pořadí %j', (mode, expected) => {
    render(<Simulator />)
    openMode(mode)
    expect(controlNames()).toEqual(expected)
  })

  it.each(MODE_NAMES)('%s: rychlosti jsou jen 0.5× / 1× / 10× a vybraná je 1×', mode => {
    render(<Simulator />)
    openMode(mode)
    const buttons = within(within(barControls()).getByRole('group')).getAllByRole('button')
    expect(buttons.map(b => b.textContent)).toEqual(['0.5×', '1×', '10×'])
    expect(buttons.filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.textContent)).toEqual(['1×'])
    expect(screen.queryByRole('button', { name: '2×' })).toBeNull()
  })

  it.each(MODE_NAMES)('%s: není tlačítko Start, Resume ani Reset backlog a Run před prvním spuštěním pulzuje', mode => {
    render(<Simulator />)
    openMode(mode)
    expect(screen.queryAllByRole('button', { name: /Start|Resume|Reset backlog/ })).toHaveLength(0)
    expect(/pulse/.test(runButton().className)).toBe(true)
  })

  it.each([
    ['Compare', null],
    ['Advanced', RESET_TOOLTIP],
    ['Cash Flow', RESET_TOOLTIP],
  ] as const)('%s: tooltip tlačítka Reset je %j', (mode, tooltip) => {
    render(<Simulator />)
    openMode(mode)
    const reset = screen.getByRole('button', { name: '↺ Reset' })
    if (tooltip === null) expect(reset).not.toHaveAttribute('title')
    else expect(reset).toHaveAttribute('title', tooltip)
  })

  it('každý mód si drží vlastní rychlost', () => {
    render(<Simulator />)
    const speedOf = () => within(within(barControls()).getByRole('group')).getByRole('button', { pressed: true }).textContent
    openMode('Advanced')
    fireEvent.click(within(barControls()).getByRole('button', { name: '10×' }))
    expect(speedOf()).toBe('10×')
    openMode('Cash Flow')
    expect(speedOf()).toBe('1×')
    fireEvent.click(within(barControls()).getByRole('button', { name: '0.5×' }))
    openMode('Advanced')
    expect(speedOf()).toBe('10×')
    openMode('Cash Flow')
    expect(speedOf()).toBe('0.5×')
  })

  it('Compare: Reset po spuštění vrátí týmy na Single / Double, vynuluje čas a vrátí pulzující Run', async () => {
    render(<Simulator />)
    const [teamA, teamB] = groupsWith('Single')
    fireEvent.click(within(teamA).getByRole('button', { name: 'Multi' }))
    expect(within(teamA).getByRole('button', { name: 'Multi' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(runButton())
    await advance(500)
    expect(simSeconds()).toBeGreaterThan(0)

    fireEvent.click(screen.getByRole('button', { name: '↺ Reset' }))
    expect(within(teamA).getByRole('button', { name: 'Single' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(teamB).getByRole('button', { name: 'Double' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryAllByText(/^\d\d:\d\d\.\d$/)).toHaveLength(0)
    expect(/pulse/.test(runButton().className)).toBe(true)
  })
})

describe('feat-021 Příklad 14: rychlost z lišty řídí tempo simulace ve všech módech', { timeout: SIM_RUN_TIMEOUT_MS }, () => {
  it.each(MODE_NAMES)('%s: 0.5×, 1× i 10× posunou simulační čas o tolik sekund, kolik je rychlost, za 1 s reálného času', async mode => {
    for (const [label, speed] of [['0.5×', 0.5], ['1×', 1], ['10×', 10]] as const) {
      const { unmount } = render(<Simulator />)
      openMode(mode)
      fireEvent.click(within(barControls()).getByRole('button', { name: label }))
      fireEvent.click(runButton())
      await advance(1000)
      // Krok simulace je 1/60 s a první snímek se zahodí (1× ujede 0,9 s místo 1 s), proto tolerance
      // úměrná rychlosti. Pevná tolerance ±0,5 s by pro 0.5× propustila i výsledek rychlosti 1×.
      expect(Math.abs(simSeconds() - speed), `${mode} ${label}`).toBeLessThanOrEqual(0.15 * speed + 0.15)
      unmount()
    }
  })

  it.each(MODE_NAMES)('%s: přepnutí na 10× za běhu platí hned', async mode => {
    render(<Simulator />)
    openMode(mode)
    fireEvent.click(runButton())
    await advance(1000)
    const before = simSeconds()
    fireEvent.click(within(barControls()).getByRole('button', { name: '10×' }))
    await advance(1000)
    // Další sekunda reálného času = ~10 s simulace
    expect(Math.abs(simSeconds() - before - 10), mode).toBeLessThanOrEqual(0.5)
  })
})

// ── Příklad 15: stavy tlačítka běhu v Advanced a Cash Flow ───────────────────

describe('feat-021 Příklad 15: stavy tlačítka běhu v Advanced a Cash Flow', () => {
  it.each(['Advanced', 'Cash Flow'] as const)('%s: Run → Pause → Run (bez pulzu); za pauzy čas neběží, další Run pokračuje', async mode => {
    render(<Simulator />)
    openMode(mode)
    expect(/pulse/.test(runButton().className)).toBe(true)

    fireEvent.click(runButton())
    expect(screen.queryByRole('button', { name: '▶ Run' })).toBeNull()
    await advance(1000)
    const runningFor = simSeconds()
    expect(runningFor).toBeGreaterThan(0.5)

    click('❙❙ Pause')
    // Po pauze se tlačítko jmenuje zase Run (ne „Resume“), ale už nepulzuje
    expect(screen.queryByRole('button', { name: /Resume/ })).toBeNull()
    expect(/pulse/.test(runButton().className)).toBe(false)
    await advance(2000)
    expect(simSeconds()).toBe(runningFor)

    fireEvent.click(runButton())
    await advance(1000)
    expect(simSeconds()).toBeGreaterThan(runningFor + 0.5)
  })
})

// ── Příklad 15 a 16: doběhnutí a Reset ───────────────────────────────────────

/** Velikost backlogu pro tyto testy; výchozích 100 features by běh protáhlo na zbytečně dlouho. */
const TEST_BACKLOG_SIZE = 20

/** Krok falešného času při čekání na doběhnutí běhu. */
const WAIT_STEP_MS = 500
/** Horní mez čekání na doběhnutí (falešný čas) — o řád víc, než kolik běh na 10× potřebuje. */
const WAIT_LIMIT_MS = 60_000

/** Posouvá falešný čas, dokud tlačítko neukáže „✓ Done“; test tak nezávisí na délce běhu, jen na tom, že doběhne. */
async function advanceUntilDone(): Promise<void> {
  for (let waited = 0; waited < WAIT_LIMIT_MS; waited += WAIT_STEP_MS) {
    if (screen.queryByRole('button', { name: /Done/ })) return
    await advance(WAIT_STEP_MS)
  }
  throw new Error(`Běh nedoběhl ani za ${WAIT_LIMIT_MS} ms falešného času`)
}

describe('feat-021 Příklady 15 a 16: doběhnutí a Reset v Advanced a Cash Flow', { timeout: SIM_RUN_TIMEOUT_MS }, () => {
  it.each(['Advanced', 'Cash Flow'] as const)('%s: po doběhnutí je „✓ Done“ vypnuté, Reset vrátí pulzující „▶ Run“ a čas na nulu', async mode => {
    render(<Simulator />)
    openMode(mode)
    click('Backlog')
    fireEvent.change(screen.getByRole('slider', { name: 'Backlog size' }), { target: { value: String(TEST_BACKLOG_SIZE) } })
    click(/Generate new backlog/)
    fireEvent.click(within(barControls()).getByRole('button', { name: '10×' }))
    fireEvent.click(runButton())
    await advanceUntilDone()

    const done = screen.getByRole('button', { name: '✓ Done' })
    expect(done).toBeDisabled()
    expect(/pulse/.test(done.className)).toBe(false)
    expect(screen.queryByRole('button', { name: /Pause/ })).toBeNull()
    expect(simSeconds()).toBeGreaterThan(0)

    click('↺ Reset')
    expect(screen.queryByRole('button', { name: /Done/ })).toBeNull()
    expect(runButton()).toBeEnabled()
    expect(/pulse/.test(runButton().className)).toBe(true)
    expect(simSeconds()).toBe(0)

    // Po Resetu jde simulaci znovu spustit
    fireEvent.click(runButton())
    expect(screen.getByRole('button', { name: '❙❙ Pause' })).toBeInTheDocument()
  })
})

// ── Příklad 17: tutoriál ─────────────────────────────────────────────────────

describe('feat-021 Příklad 17: tutoriál popisuje a zvýrazňuje nové ovládání', () => {
  it.each([
    ['Compare', 'compare-controls', 'compare-run-button'],
    ['Advanced', 'experiment-controls', 'experiment-run-button'],
  ] as const)('%s: oblast „%s“ obsahuje „?“, Reset, rychlost i Run a cíl „%s“ je tlačítko Run', (mode, controlsTarget, runTarget) => {
    render(<Simulator />)
    openMode(mode)
    const area = document.querySelector<HTMLElement>(`[data-tutorial-target="${controlsTarget}"]`)!
    expect(area).not.toBeNull()
    expect(namesIn(area)).toEqual(['Restart tutorial', ...RUN_CONTROLS])
    expect(document.querySelector(`[data-tutorial-target="${runTarget}"]`)).toBe(within(area).getByRole('button', { name: '▶ Run' }))
  })

  it('Cash Flow: tlačítko Run je cílem „cashflow-run-button“', () => {
    render(<Simulator />)
    openMode('Cash Flow')
    expect(document.querySelector('[data-tutorial-target="cashflow-run-button"]')).toBe(runButton())
  })

  it('texty kroků o ovládání v obou tutoriálech uvádějí rychlosti 0.5×, 1×, 10× a tlačítko Run', () => {
    const description = (mode: 'compare' | 'experiment', id: string) => TUTORIAL_STEPS[mode].find(s => s.id === id)?.description
    expect(description('compare', 'compare-controls')).toBe('Set the simulation speed (0.5×, 1×, or 10×) or reset the run to start over.')
    expect(description('experiment', 'experiment-controls')).toBe(
      'Simulation controls: choose speed (0.5×, 1×, or 10×) or reset the run to restore the original backlog and start fresh.',
    )
    expect(description('experiment', 'experiment-run')).toBe(
      'Click ▶ Run to start the simulation. Adjust the team, reset, and re-run as many times as you like.',
    )
  })
})
