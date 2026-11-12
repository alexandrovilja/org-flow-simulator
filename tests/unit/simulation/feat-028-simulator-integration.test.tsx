import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { Simulator } from '@/components/Simulator'
import { markTutorialCompleted, markModeSeen, resetTutorial } from '@/lib/storage'

// feat-028 inkrement 1 (Mandáty a tok práce) — mód Organization v aplikaci: záložka, mandáty před během,
// kontrola před během, Run, zamčení, Reset se srovnáním a zpětná vazba.
//
// Schválený kontrakt (spec features/feat-028-tymy-slozene-z-lidi.md, UI / Design; analýza A1, B1–B4, C2, I1, I3, I7):
//  - Záložka „Organization“ (role tab) za Cash Flow; mód má stejné ovládání běhu jako ostatní (? / ↺ Reset / rychlost /
//    ▶ Run). Run je neaktivní s tooltipem „Fix the warnings in the Organization panel first“, dokud panel varuje.
//  - Mód otevře výchozí organizaci (ORG-DEF) a backlog 100 featur; organizace se nemění Resetem.
//  - Panel organizace před během: řádek týmu `data-testid="org-team-row"` s počtem „4 people“, tlačítky
//    „Remove mandate BIL“, „Add mandate“ (role menu, položky „BIL Billing“) a červeným „No mandate“; varování
//    `role="alert"` s „Run is disabled“.
//  - Reset vrátí backlog, vyprázdní Done a z doběhnutého běhu udělá předchozí (delty „vs prev run“ u Total Time,
//    Avg Cycle Time a Avg WIP po dalším doběhnutí).
//  - Otevření dialogu zpětné vazby pozastaví běh a dialog dostane název módu „Organization“ (feat-024).

const TEST_KEY = 'test-access-key'

/** Časový limit (reálný čas) testů, které nechávají simulaci doběhnout. */
const SIM_RUN_TIMEOUT_MS = 60_000

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
  localStorage.clear()
  resetTutorial()
  markTutorialCompleted()
  markModeSeen('compare')
  markModeSeen('experiment')
  markModeSeen('cashflow')
  vi.stubEnv('NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY', TEST_KEY)
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

/** Posune falešný čas o `ms` milisekund uvnitř act(). */
async function advance(ms: number): Promise<void> {
  await act(async () => { vi.advanceTimersByTime(ms) })
}

/** Vykreslí aplikaci a přepne na mód Organization. */
function openOrganization(): void {
  render(<Simulator />)
  fireEvent.click(screen.getByRole('tab', { name: 'Organization' }))
}

const region = (name: string) => screen.getByRole('region', { name })
const org = () => region('Organization')
const tile = (name: string) => screen.getByTestId(`stat-tile-${name}`)
/** Tlačítko běhu v liště podle konce názvu (glyf ▶ / ❙❙ / ✓ před ním). */
const runButton = (name: 'Run' | 'Pause' | 'Done' = 'Run') => screen.getByRole('button', { name: new RegExp(`${name}$`) })

/** Řádek týmu podle názvu. */
function teamRow(name: string): HTMLElement {
  const row = within(org()).getAllByTestId('org-team-row').find(r => within(r).queryByText(name))
  if (!row) throw new Error(`Řádek týmu ${name} není`)
  return row
}

/** Názvy týmů v pořadí panelu. */
const teamNames = () => within(org()).getAllByTestId('org-team-row').map(r =>
  ['Team Billing', 'Team Mobile', 'Team Web'].find(n => within(r).queryByText(n)) ?? '?')

/** Názvy tlačítek odebrání mandátu v řádku týmu (pořadí štítků). */
const mandateButtons = (teamName: string) =>
  within(teamRow(teamName)).queryAllByRole('button', { name: /^Remove mandate / }).map(b => b.getAttribute('aria-label'))

/** Přidá týmu mandát přes tlačítko + a nabídku. */
function addMandate(teamName: string, item: string): void {
  fireEvent.click(within(teamRow(teamName)).getByRole('button', { name: 'Add mandate' }))
  fireEvent.click(screen.getByRole('menuitem', { name: item }))
}

/** Text varování v panelu organizace (prázdné pole = žádné varování). */
function warnings(): string[] {
  const alert = within(org()).queryByRole('alert')
  return alert ? within(alert).getAllByRole('listitem').map(li => li.textContent ?? '') : []
}

/** Položky backlogu. */
const backlogItems = () => within(region('Backlog')).queryAllByTestId('org-backlog-item')

/** Nechá běh doběhnout při 10× (každý krok 1 s = 10 pracovních dní). */
async function runToDone(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: '10×' }))
  fireEvent.click(runButton('Run'))
  for (let i = 0; i < 200 && !screen.queryByRole('button', { name: /Done$/ }); i++) await advance(1000)
  expect(runButton('Done')).toBeInTheDocument()
}

describe('feat-028 A1: otevření módu', () => {
  it('záložka je aktivní; 3 týmy po 4 lidech s mandáty BIL, MOB, WEB', () => {
    openOrganization()
    expect(screen.getByRole('tab', { name: 'Organization' })).toHaveAttribute('aria-selected', 'true')
    expect(teamNames()).toEqual(['Team Billing', 'Team Mobile', 'Team Web'])
    for (const name of ['Team Billing', 'Team Mobile', 'Team Web']) {
      expect(within(teamRow(name)).getByText('4 people')).toBeInTheDocument()
    }
    expect(['Team Billing', 'Team Mobile', 'Team Web'].map(mandateButtons)).toEqual([
      ['Remove mandate BIL'], ['Remove mandate MOB'], ['Remove mandate WEB'],
    ])
    expect(within(org()).getByText('3 teams · 12 people')).toBeInTheDocument()
  })

  it('backlog má 100 featur; metriky na začátku; Run je aktivní a bez varování', () => {
    openOrganization()
    expect(backlogItems()).toHaveLength(100)
    expect(tile('Total Time')).toHaveTextContent('0.0 days')
    expect(screen.getByText('No completed features yet.')).toBeInTheDocument()
    expect(warnings()).toEqual([])
    expect(runButton()).toBeEnabled()
  })
})

describe('feat-028 B1–B4 a C2: mandáty', () => {
  it('B1: + v Team Mobile nabídne BIL a WEB v pořadí oblastí; po výběru WEB má tým štítky MOB a WEB', () => {
    openOrganization()
    fireEvent.click(within(teamRow('Team Mobile')).getByRole('button', { name: 'Add mandate' }))
    const menu = screen.getByRole('menu')
    expect(within(menu).getAllByRole('menuitem').map(i => i.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['BIL Billing', 'WEB Web portal'])
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'WEB Web portal' }))
    expect(mandateButtons('Team Mobile')).toEqual(['Remove mandate MOB', 'Remove mandate WEB'])
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('B2: mandáty jsou v pořadí oblastí (Team Web + BIL → BIL, WEB); štítek má title s názvem oblasti', () => {
    openOrganization()
    addMandate('Team Web', 'BIL Billing')
    expect(mandateButtons('Team Web')).toEqual(['Remove mandate BIL', 'Remove mandate WEB'])
    expect(within(teamRow('Team Web')).getByTitle('Billing')).toHaveTextContent('BIL')
  })

  it('B3: se všemi oblastmi tlačítko + v řádku není', () => {
    openOrganization()
    addMandate('Team Web', 'BIL Billing')
    addMandate('Team Web', 'MOB Mobile app')
    expect(within(teamRow('Team Web')).queryByRole('button', { name: 'Add mandate' })).toBeNull()
  })

  it('B4: odebrání posledního mandátu → „No mandate“, varování hned a neaktivní Run s tooltipem', () => {
    openOrganization()
    fireEvent.click(within(teamRow('Team Web')).getByRole('button', { name: 'Remove mandate WEB' }))
    expect(within(teamRow('Team Web')).getByText('No mandate')).toBeInTheDocument()
    expect(warnings()).toEqual(['No team has a mandate for WEB'])
    expect(within(org()).getByRole('alert')).toHaveTextContent('Run is disabled')
    expect(runButton()).toBeDisabled()
    expect(runButton()).toHaveAttribute('title', 'Fix the warnings in the Organization panel first')
  })

  it('C2: mandát WEB pro Team Mobile varování zruší a Run je zase aktivní', () => {
    openOrganization()
    fireEvent.click(within(teamRow('Team Web')).getByRole('button', { name: 'Remove mandate WEB' }))
    addMandate('Team Mobile', 'WEB Web portal')
    expect(warnings()).toEqual([])
    expect(runButton()).toBeEnabled()
  })
})

describe('feat-028 I1: zamčení po spuštění', () => {
  it('po Run i v pauze nejde měnit mandáty a hlavička ukazuje zámek', async () => {
    openOrganization()
    fireEvent.click(runButton())
    await advance(500)
    expect(within(org()).getByText('Skills, AI and mandates are locked during the run')).toBeInTheDocument()
    expect(within(org()).queryByRole('button', { name: 'Add mandate' })).toBeNull()
    fireEvent.click(runButton('Pause'))
    expect(within(org()).getByText('Skills, AI and mandates are locked during the run')).toBeInTheDocument()
    expect(within(org()).queryByRole('button', { name: /^Remove mandate/ })).toBeNull()
  })
})

describe('feat-028 I3: Reset a srovnání s předchozím během', () => {
  it('Reset nechá organizaci, vrátí backlog a z doběhnutého běhu udělá předchozí', async () => {
    openOrganization()
    addMandate('Team Mobile', 'WEB Web portal')
    const backlogBefore = backlogItems().map(i => i.textContent)
    await runToDone()
    expect(within(org()).getByText('Reset to change the organization')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Reset$/ }))
    expect(teamNames()).toEqual(['Team Billing', 'Team Mobile', 'Team Web'])
    expect(mandateButtons('Team Mobile')).toEqual(['Remove mandate MOB', 'Remove mandate WEB'])
    expect(backlogItems().map(i => i.textContent)).toEqual(backlogBefore)
    expect(screen.getByText('No completed features yet.')).toBeInTheDocument()
    expect(tile('Total Time')).toHaveTextContent('0.0 days')
    expect(screen.queryByText('vs prev run')).toBeNull()

    await runToDone()
    for (const name of ['Total Time', 'Avg Cycle Time', 'Avg WIP']) {
      expect(within(tile(name)).getByText('vs prev run')).toBeInTheDocument()
    }
  }, SIM_RUN_TIMEOUT_MS)
})

describe('feat-028 I7: zpětná vazba pozastaví běh', () => {
  it('otevření dialogu zastaví běh (▶ Run) a čas stojí; dialog dostane název módu „Organization“', async () => {
    openOrganization()
    fireEvent.click(runButton())
    await advance(1000)
    expect(runButton('Pause')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Send feedback' }))
    expect(screen.queryByRole('button', { name: /Pause$/ })).toBeNull()
    const stopped = tile('Total Time').textContent
    await advance(2000)
    expect(tile('Total Time').textContent).toBe(stopped)

    const dialog = screen.getByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: '1 – Not useful' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Send' }))
    await within(dialog).findByRole('heading', { name: 'Thanks for your feedback.' })
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(init.body as string).Mode).toBe('Organization')
  })
})
