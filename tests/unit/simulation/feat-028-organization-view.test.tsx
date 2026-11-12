import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { OrganizationView, type OrganizationViewProps } from '@/components/OrganizationView'
import tileStyles from '@/components/StatTile.module.css'
import { makeOrgFeature, makeOrgState } from '@/simulation/organizationEngine'
import type { OrgFeature, OrgRunSnapshot, OrgSetup, OrgSimState } from '@/types/organization'
import { feat, orgB, orgDef, orgT, runToEnd, runUntil, stateOf, team } from './feat028Fixtures'

// feat-028 inkrement 1 (Mandáty a tok práce) — zobrazení módu Organization nad daným stavem běhu.
//
// Schválený kontrakt (spec, UI / Design; mockup docs/feat-028-ui-mockup.html v9; analýza B1, B3, B4, C1, F1, F2,
// F6–F9, H1 (část), H5, H8, I1, I2):
//  - `OrganizationView` (`src/components/OrganizationView.tsx`) je celá plocha módu (tři sloupce). Props: setup,
//    onSetupChange(next), state, locked, previousRun. `locked` = běh začal (i pauza a po doběhnutí) → panel organizace
//    je jen ke čtení. Úpravy organizace jdou přes `onSetupChange` s novým objektem (vstup se nemění).
//  - Sekce jsou regiony (aria-label): „Backlog“, „In progress“, „Organization“. Dlaždice `data-testid="stat-tile-<název>"`:
//    Total Time, Avg Cycle Time, Avg WIP.
//  - Featura se v UI označuje jako v ostatních módech „F-001“ (data v analýze píšou zkráceně F-1).
//  - Organization: hlavička „3 teams · 12 people“; řádek týmu `data-testid="org-team-row"`.
//    • Před během: počet „4 people“, štítky mandátů s tlačítkem „Remove mandate BIL“ (title štítku = název oblasti),
//      tlačítko „Add mandate“ s nabídkou (role menu, položky „BIL Billing“) zbývajících oblastí v pořadí oblastí,
//      červené „No mandate“; „Show or hide people“ ukáže karty lidí `data-testid="org-person"` jen ke čtení
//      (jméno a skilly, žádná tlačítka). Varování `role="alert"` s „Run is disabled“ a položkami seznamu.
//    • Za běhu: štítky mandátů bez tlačítek a pruh lidí `data-testid="org-people-bar"` s textem „2/3“ (pracuje / celkem);
//      hlavička „Skills, AI and mandates are locked during the run“, po doběhnutí „Reset to change the organization“.
//  - In progress: řádek `data-testid="org-feature-row"` (data-feature-id), štítky oblastí `data-testid="org-area-tag"`
//    (data-state = done | open, hotová „✓ BIL“), progressbar (aria-valuenow = % hotové práce, zaokrouhleno),
//    prázdné stavy „Nothing in flight.“ / „All features are done.“
//  - Backlog: položky `data-testid="org-backlog-item"` v pořadí priority.
//  - Done: řádky `data-testid="org-done-row"`, nejnovější nahoře, s cycle time „3.0 d“; prázdný „No completed features yet.“
//  - Srovnání s předchozím během ve formátu Cash Flow (StatTile: „↓ 21% vs prev run“, třídy deltaGood / deltaBad /
//    deltaFlat); delta Total Time jen po doběhnutí.

/** Vykreslí plochu módu nad daným stavem. Bez `locked` se bere, zda běh začal (čas > 0). */
function renderView(state: OrgSimState, overrides: Partial<OrganizationViewProps> = {}) {
  const props: OrganizationViewProps = {
    setup: state.setup,
    onSetupChange: vi.fn(),
    state,
    locked: state.simTime > 0,
    previousRun: null,
    ...overrides,
  }
  return { ...render(<OrganizationView {...props} />), props }
}

const region = (name: string) => screen.getByRole('region', { name })
const tile = (name: string) => screen.getByTestId(`stat-tile-${name}`)
/** Označení featury v UI jako v ostatních módech: F-001. */
const label = (id: number) => `F-${String(id).padStart(3, '0')}`

/** Řádek týmu v panelu organizace podle názvu. */
function teamRow(name: string): HTMLElement {
  const row = within(region('Organization')).getAllByTestId('org-team-row').find(r => within(r).queryByText(name))
  if (!row) throw new Error(`Řádek týmu ${name} není`)
  return row
}

/** Řádek rozpracované featury. */
function featureRow(id: number): HTMLElement {
  const row = within(region('In progress')).getAllByTestId('org-feature-row').find(r => r.dataset.featureId === String(id))
  if (!row) throw new Error(`${label(id)} v In progress není`)
  return row
}

/** Štítky oblastí řádku featury jako `[text, stav]`. */
function areaTags(id: number): Array<[string, string | undefined]> {
  return within(featureRow(id)).getAllByTestId('org-area-tag').map(t => [t.textContent?.trim() ?? '', t.dataset.state])
}

/** Názvy tlačítek odebrání mandátu v řádku týmu (pořadí štítků). */
const mandateButtons = (teamName: string) =>
  within(teamRow(teamName)).queryAllByRole('button', { name: /^Remove mandate / }).map(b => b.getAttribute('aria-label'))

/** Organizace, kterou dostal poslední `onSetupChange`. */
const lastSetup = (props: OrganizationViewProps) => {
  const calls = (props.onSetupChange as ReturnType<typeof vi.fn>).mock.calls
  return calls[calls.length - 1][0] as OrgSetup
}

/** D7 (ORG-B, Reduce WIP) v čase t. */
const d7At = (t: number) => runUntil(stateOf(orgB(), 'F-1 (p1): BIL [QA 3]', 'F-2 (p3): BIL [Java 1 · QA 1]', 'F-3 (p2): BIL [QA 1]'), t)

/** Výchozí organizace s malým backlogem před během. */
const setupState = (setup: OrgSetup = orgDef()) => makeOrgState(setup, [feat('F-1 (p1): BIL [Java 2] | WEB [QA 1]'), feat('F-2 (p2): MOB [Frontend 1]')])

describe('feat-028 A1 a B1–B4: panel organizace před během', () => {
  it('hlavička, týmy se 4 lidmi a štítky mandátů s názvem oblasti v title', () => {
    renderView(setupState())
    expect(within(region('Organization')).getByText('3 teams · 12 people')).toBeInTheDocument()
    for (const name of ['Team Billing', 'Team Mobile', 'Team Web']) {
      expect(within(teamRow(name)).getByText('4 people')).toBeInTheDocument()
    }
    expect(mandateButtons('Team Mobile')).toEqual(['Remove mandate MOB'])
    expect(within(teamRow('Team Mobile')).getByTitle('Mobile app')).toHaveTextContent('MOB')
  })

  it('B1: + nabídne zbývající oblasti v pořadí oblastí; výběr pošle novou organizaci s mandáty v pořadí oblastí', () => {
    const state = setupState()
    const { props } = renderView(state)
    fireEvent.click(within(teamRow('Team Mobile')).getByRole('button', { name: 'Add mandate' }))
    const menu = screen.getByRole('menu')
    expect(within(menu).getAllByRole('menuitem').map(i => i.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['BIL Billing', 'WEB Web portal'])
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'BIL Billing' }))
    expect(team(lastSetup(props), 'Team Mobile').mandates).toEqual(['BIL', 'MOB'])
    // Vstup se nemění — úprava jde přes nový objekt
    expect(team(state.setup, 'Team Mobile').mandates).toEqual(['MOB'])
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('B3: tým se všemi oblastmi nemá tlačítko +', () => {
    const setup = orgDef()
    team(setup, 'Team Web').mandates = ['BIL', 'MOB', 'WEB']
    renderView(setupState(setup))
    expect(within(teamRow('Team Web')).queryByRole('button', { name: 'Add mandate' })).toBeNull()
    expect(mandateButtons('Team Web')).toEqual(['Remove mandate BIL', 'Remove mandate MOB', 'Remove mandate WEB'])
  })

  it('B4: × u mandátu pošle organizaci bez něj', () => {
    const { props } = renderView(setupState())
    fireEvent.click(within(teamRow('Team Web')).getByRole('button', { name: 'Remove mandate WEB' }))
    expect(team(lastSetup(props), 'Team Web').mandates).toEqual([])
  })

  it('rozbalený tým ukáže lidi jen ke čtení: jména a skilly bez tlačítek', () => {
    renderView(setupState())
    fireEvent.click(within(teamRow('Team Web')).getByRole('button', { name: 'Show or hide people' }))
    const cards = within(teamRow('Team Web')).getAllByTestId('org-person')
    expect(cards.map(c => within(c).getByText(/^(Gus|Hugo|Hana|Ivo)$/).textContent)).toEqual(['Gus', 'Hugo', 'Hana', 'Ivo'])
    expect(within(cards[2]).getByText('Frontend')).toBeInTheDocument()
    for (const c of cards) expect(within(c).queryAllByRole('button')).toHaveLength(0)
  })
})

describe('feat-028 C1: varování v panelu organizace', () => {
  it('„No team has a mandate for WEB“ v boxu „Run is disabled“ a tým bez mandátu ukazuje „No mandate“', () => {
    const setup = orgT()
    team(setup, 'Team Web').mandates = []
    renderView(makeOrgState(setup, [feat('F-1 (p1): WEB [Frontend 3]')]))
    const alert = within(region('Organization')).getByRole('alert')
    expect(within(alert).getByText('Run is disabled')).toBeInTheDocument()
    expect(within(alert).getAllByRole('listitem').map(li => li.textContent)).toEqual(['No team has a mandate for WEB'])
    expect(within(teamRow('Team Web')).getByText('No mandate')).toBeInTheDocument()
  })

  it('bez problémů není v panelu žádné varování', () => {
    renderView(setupState())
    expect(within(region('Organization')).queryByRole('alert')).toBeNull()
  })
})

describe('feat-028 H1 (část): panel organizace za běhu', () => {
  it('D7 v 0.5 — Team Billing: mandát BIL bez tlačítek, pruh 2/3', () => {
    renderView(d7At(0.5))
    const row = teamRow('Team Billing')
    expect(within(row).getByText('BIL')).toBeInTheDocument()
    expect(within(row).getByTestId('org-people-bar')).toHaveTextContent('2/3')
    expect(within(row).queryByRole('button', { name: /mandate/i })).toBeNull()
  })
})

describe('feat-028 H5: řádek rozpracované featury', () => {
  const d6 = () => stateOf(orgT(), 'F-1 (p1): BIL [Product 2 · Java 3 · QA 2] | MOB [Frontend 3 · QA 1]')

  it('v 2.5 ukazuje štítky BIL a MOB a postup 45 %; v 4.0 je MOB zelený „✓ MOB“', () => {
    const { unmount } = renderView(runUntil(d6(), 2.5))
    expect(within(featureRow(1)).getByText(new RegExp(`^${label(1)}`))).toBeInTheDocument()
    expect(areaTags(1)).toEqual([['BIL', 'open'], ['MOB', 'open']])
    expect(within(featureRow(1)).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '45')
    unmount()
    renderView(runUntil(d6(), 4))
    expect(areaTags(1)).toEqual([['BIL', 'open'], ['✓ MOB', 'done']])
  })

  it('bez rozpracovaných featur „Nothing in flight.“, po doběhnutí „All features are done.“', () => {
    const { unmount } = renderView(stateOf(orgT(), 'F-1 (p1): WEB [Frontend 3]'))
    expect(within(region('In progress')).getByText('Nothing in flight.')).toBeInTheDocument()
    unmount()
    renderView(runToEnd(stateOf(orgT(), 'F-1 (p1): WEB [Frontend 3]')))
    expect(within(region('In progress')).getByText('All features are done.')).toBeInTheDocument()
  })
})

describe('feat-028 H8 a F1: pořadí backlogu a Done', () => {
  it('položky backlogu jsou v pořadí priority', () => {
    const backlog = [3, 1, 5, 2, 4].map(p => makeOrgFeature({ id: p * 10, priority: p, areas: [{ area: 'BIL', tasks: [{ role: 'Java', work: 1 }] }] }))
    renderView(makeOrgState(orgDef(), backlog))
    const items = within(region('Backlog')).getAllByTestId('org-backlog-item')
    expect(items.map(i => i.textContent?.match(/F-\d{3}/)?.[0])).toEqual(['F-010', 'F-020', 'F-030', 'F-040', 'F-050'])
  })

  it('F1: Done má nejnověji dokončenou featuru nahoře a ukazuje cycle time', () => {
    renderView(runToEnd(d7At(0)))
    const rows = screen.getAllByTestId('org-done-row')
    expect(rows.map(r => r.textContent?.match(/F-\d{3}/)?.[0])).toEqual(['F-003', 'F-002', 'F-001'])
    expect(rows[0]).toHaveTextContent('1.0 d')
    expect(rows[1]).toHaveTextContent('4.0 d')
    expect(rows[2]).toHaveTextContent('3.0 d')
  })
})

describe('feat-028 F2: Metrics', () => {
  it('před během: Total Time „0.0 days“, Avg Cycle Time „—“, Done „No completed features yet.“', () => {
    renderView(d7At(0))
    expect(tile('Total Time')).toHaveTextContent('0.0 days')
    expect(tile('Avg Cycle Time')).toHaveTextContent('—')
    expect(screen.getByText('No completed features yet.')).toBeInTheDocument()
  })

  it('D7 po doběhnutí — Total Time „1 week 0.0 days“ s „✓ Complete“, Avg Cycle Time „2.7“ a Avg WIP „1.6“', () => {
    renderView(runToEnd(d7At(0)))
    expect(tile('Total Time')).toHaveTextContent('1 week 0.0 days')
    expect(within(tile('Total Time')).getByText('✓ Complete')).toBeInTheDocument()
    expect(tile('Avg Cycle Time')).toHaveTextContent('2.7')
    expect(tile('Avg WIP')).toHaveTextContent('1.6')
  })
})

describe('feat-028 F6–F9: srovnání s předchozím během', () => {
  /** Doběhnutý běh: Total 9.0, Avg cycle 6.9 ((3.0 + 9.0 + 8.7) / 3), Avg WIP 4.6. */
  function finishedRun(): OrgSimState {
    const done = (id: number, startedAt: number, finishedAt: number): OrgFeature => {
      const f = makeOrgFeature({ id, priority: id, areas: [{ area: 'BIL', tasks: [{ role: 'Java', work: 1 }] }] })
      f.tasks.forEach(t => { t.status = 'done'; t.progress = t.work })
      return { ...f, status: 'done', startedAt, finishedAt }
    }
    const s = makeOrgState(orgB(), [])
    s.done = [done(1, 0, 3), done(2, 0, 9), done(3, 0.3, 9)]
    s.simTime = 9
    s.wipIntegral = 4.6 * 9
    s.startedAt = 0
    s.finished = true
    return s
  }

  /** Předchozí běh: Total 12.0, Avg cycle 8.7, Avg WIP 4.3 (Idle Time 17.0 přidal snapshot ve feat-029). */
  const previous: OrgRunSnapshot = { totalTime: 12, avgCycleTime: 8.7, avgWip: 4.3, idleTime: 17 }

  /** Řádek delty pod hodnotou dlaždice. */
  const deltaOf = (name: string) => within(tile(name)).getByText('vs prev run').parentElement!

  it('F6: delty ve formátu Cash Flow s barvou podle toho, zda je změna dobrá', () => {
    renderView(finishedRun(), { previousRun: previous })
    expect(tile('Total Time')).toHaveTextContent('1 week 4.0 days')
    expect(deltaOf('Total Time')).toHaveTextContent('↓ 25%')
    expect(deltaOf('Total Time')).toHaveClass(tileStyles.deltaGood)
    expect(tile('Avg Cycle Time')).toHaveTextContent('6.9')
    expect(deltaOf('Avg Cycle Time')).toHaveTextContent('↓ 21%')
    expect(deltaOf('Avg Cycle Time')).toHaveClass(tileStyles.deltaGood)
    expect(tile('Avg WIP')).toHaveTextContent('4.6')
    expect(deltaOf('Avg WIP')).toHaveTextContent('↑ 7.0%')
    expect(deltaOf('Avg WIP')).toHaveClass(tileStyles.deltaBad)
  })

  it('F7: stejný Avg WIP → „→ 0.0% vs prev run“ šedě', () => {
    renderView(finishedRun(), { previousRun: { ...previous, avgWip: 4.6 } })
    expect(deltaOf('Avg WIP')).toHaveTextContent('→ 0.0%')
    expect(deltaOf('Avg WIP')).toHaveClass(tileStyles.deltaFlat)
  })

  it('F8: bez předchozího běhu nemá žádná dlaždice „vs prev run“', () => {
    renderView(finishedRun(), { previousRun: null })
    expect(screen.queryByText('vs prev run')).toBeNull()
  })

  it('F9: za běhu ukazují delty Avg Cycle Time a Avg WIP, Total Time až po doběhnutí', () => {
    renderView(d7At(3.5), { previousRun: previous })
    expect(within(tile('Avg Cycle Time')).getByText('vs prev run')).toBeInTheDocument()
    expect(within(tile('Avg WIP')).getByText('vs prev run')).toBeInTheDocument()
    expect(within(tile('Total Time')).queryByText('vs prev run')).toBeNull()
  })
})

describe('feat-028 I1–I2: zamčení za běhu', () => {
  it('I1: za běhu hlavička „Skills, AI and mandates are locked during the run“ a žádná tlačítka mandátů', () => {
    renderView(d7At(1), { locked: true })
    const org = region('Organization')
    expect(within(org).getByText('Skills, AI and mandates are locked during the run')).toBeInTheDocument()
    expect(within(org).queryByRole('button', { name: 'Add mandate' })).toBeNull()
    expect(within(org).queryByRole('button', { name: /^Remove mandate/ })).toBeNull()
  })

  it('I2: po doběhnutí zůstává vše zamčené a hlavička ukazuje „Reset to change the organization“', () => {
    renderView(runToEnd(d7At(0)), { locked: true })
    expect(within(region('Organization')).getByText('Reset to change the organization')).toBeInTheDocument()
    expect(within(region('Organization')).queryByRole('button', { name: 'Add mandate' })).toBeNull()
  })
})
