import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { OrganizationView, type OrganizationViewProps } from '@/components/OrganizationView'
import tileStyles from '@/components/StatTile.module.css'
import { makeOrgFeature, makeOrgState, resetOrgState, snapshotOrgRun } from '@/simulation/organizationEngine'
import type { OrgFeature, OrgRunSnapshot, OrgSimState } from '@/types/organization'
import { feat, featureOf, grant, orgB, orgDef, orgT, runToEnd, runUntil, stateOf, team } from './feat028Fixtures'

// feat-029 (Proč práce čeká, mód Organization inkrement 2) — zobrazení waiting, žlutého idle a Idle Time.
//
// Schválený kontrakt (spec features/feat-029-proc-prace-ceka.md, UI / Design a Příklady 1–10; mockup
// docs/feat-028-ui-mockup.html v9; analýza B5, E1, E2, E5, H1–H4, H6, H7, F6–F9 a I3):
//  - `OrganizationView` má stejné props jako v inkrementu 1 (setup, onSetupChange, state, locked, previousRun).
//    Detail backlogu bere mandáty z `setup` (organizace, kterou panel upravuje).
//  - In progress: v hlavičce text „Click a feature to see its tasks“ a filtr — tlačítko „1 waiting“ (aria-pressed,
//    title „Show only features with waiting tasks“), jen když nějaká featura čeká; když už nic nečeká, filtr zmizí
//    a vypne se. Řádek `data-testid="org-feature-row"` (data-feature-id, data-highlighted="true" u zvýrazněné)
//    má tlačítko s názvem začínajícím „F-001“ (aria-expanded, title „Show or hide tasks“). Štítky oblastí
//    `data-testid="org-area-tag"` mají data-state = done | waiting | open. Rozbalená featura ukáže úkoly
//    `data-testid="org-task"` (data-status = done | doing | todo | waiting; u doing data-progress = % a první písmeno
//    jména člověka; title „Java · done“, „Java · Ben (Team Billing)“, „Frontend · waiting · 1 idle person with this
//    skill in Team Mobile“, „QA · to do“) a poznámku „Waiting · WEB“ (oblasti v pořadí featury). Sbalená featura
//    poznámku nemá.
//  - Organization za běhu: sloupec „Working on“; řádek týmu má šipku „Show or hide people“, pruh lidí
//    `data-testid="org-people-bar"` s textem „1/3“, atributy data-working / data-blocked / data-idle a title
//    „1 working, 2 idle (1 while work for their skills waits in another area)“; štítky featur jsou tlačítka „F-001“,
//    „F-002 ×2“ (title „F-001 Login flow · 2 from Team Web. Click to show the feature.“), za nimi „2 idle“ s data-tone
//    = blocked | idle. Klik na štítek vypne filtr a featuru rozbalí, zvýrazní a posune do viditelné části
//    (scrollIntoView). Karta člověka `data-testid="org-person"`: „F-001 · BIL · QA“ s progressbarem, nebo „Idle“
//    s data-tone = idle | blocked (u blocked title „Idle while work for their skills waits in Web portal“).
//    Hlavička „7 idle“ s data-tone. Po doběhnutí Working on „—“ a hlavička bez počtu idle.
//  - Reset (locked → false) vypne filtr, zruší zvýraznění a sbalí featury v In progress.
//  - Backlog: položka `data-testid="org-backlog-item"` má tlačítko (aria-expanded, title „Show or hide details“);
//    rozbalená ukáže „Priority 2 · 3 tasks · 8 days of work“, čipy „Product · 2 d“ a „Mandate: Team Billing“ nebo
//    „No team has a mandate for this area“ místo pruhu pracnosti.
//  - Metrics: dlaždice `data-testid="stat-tile-Idle Time"` — „2.5 days“, hint „person-days without a task“, tooltip
//    (title); před během „—“; delta „vs prev run“ jen po doběhnutí, nižší je lepší.

beforeEach(() => {
  // jsdom nemá scrollIntoView; skok na featuru (H3) ho volá
  Element.prototype.scrollIntoView = vi.fn()
})

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
/** Filtr čekajících featur v hlavičce In progress (nebo null). */
const waitingFilter = () => within(region('In progress')).queryByRole('button', { name: /^\d+ waiting$/ })

/** Řádek týmu v panelu organizace podle názvu. */
function teamRow(name: string): HTMLElement {
  const row = within(region('Organization')).getAllByTestId('org-team-row').find(r => within(r).queryByText(name))
  if (!row) throw new Error(`Řádek týmu ${name} není`)
  return row
}

/** Rozbalí lidi týmu (pokud ještě nejsou) a vrátí kartu člověka. */
function personCard(teamName: string, personName: string): HTMLElement {
  const toggle = within(teamRow(teamName)).getByRole('button', { name: 'Show or hide people' })
  if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle)
  const card = within(teamRow(teamName)).getAllByTestId('org-person').find(c => within(c).queryByText(personName))
  if (!card) throw new Error(`Karta ${personName} není`)
  return card
}

/** Řádek rozpracované featury. */
function featureRow(id: number): HTMLElement {
  const row = within(region('In progress')).getAllByTestId('org-feature-row').find(r => r.dataset.featureId === String(id))
  if (!row) throw new Error(`${label(id)} v In progress není`)
  return row
}

/** Tlačítko řádku featury, které ji rozbalí. */
const featureToggle = (id: number) => within(featureRow(id)).getByRole('button', { name: new RegExp(`^${label(id)}\\b`) })

/** Rozbalí řádek rozpracované featury (pokud ještě není) a vrátí jeho úkoly. */
function expandFeature(id: number): HTMLElement[] {
  if (featureToggle(id).getAttribute('aria-expanded') !== 'true') fireEvent.click(featureToggle(id))
  return within(featureRow(id)).getAllByTestId('org-task')
}

/** Štítky oblastí řádku featury jako `[text, stav]`. */
function areaTags(id: number): Array<[string, string | undefined]> {
  return within(featureRow(id)).getAllByTestId('org-area-tag').map(t => [t.textContent?.trim() ?? '', t.dataset.state])
}

/** Hodnota pruhu postupu v řádku featury. */
const progressOf = (id: number) => within(featureRow(id)).getAllByRole('progressbar')[0].getAttribute('aria-valuenow')

/** Id rozpracovaných featur, které In progress právě ukazuje. */
const shownFeatures = () => within(region('In progress')).getAllByTestId('org-feature-row').map(r => r.dataset.featureId)

/** Štítky featur ve sloupci Working on řádku týmu. */
const workChips = (teamName: string) =>
  within(teamRow(teamName)).queryAllByRole('button', { name: /^F-\d{3}/ }).map(b => b.textContent?.replace(/\s+/g, ' ').trim())

/** Data D2 (Umí, ale nesmí) v čase t. */
const d2At = (t: number) => runUntil(stateOf(orgT(),
  'F-1 (p1): BIL [Java 1] | WEB [Frontend 3]',
  'F-2 (p2): BIL [Java 1] | WEB [Frontend 3]'), t)

/** Data D6 (Fáze v rámci oblasti) v čase t. */
const d6At = (t: number) => runUntil(stateOf(orgT(), 'F-1 (p1): BIL [Product 2 · Java 3 · QA 2] | MOB [Frontend 3 · QA 1]'), t)

/** Data D7 (ORG-B, Reduce WIP) v čase t. */
const d7At = (t: number) => runUntil(stateOf(orgB(), 'F-1 (p1): BIL [QA 3]', 'F-2 (p3): BIL [Java 1 · QA 1]', 'F-3 (p2): BIL [QA 1]'), t)

describe('feat-029 E1: waiting a žlutý idle v In progress (spec Příklad 1)', () => {
  it('v 1.5: štítky oblastí, pruhy postupu, filtr „1 waiting“ a text v hlavičce', () => {
    renderView(d2At(1.5))
    expect(areaTags(1)).toEqual([['✓ BIL', 'done'], ['WEB', 'open']])
    expect(progressOf(1)).toBe('63')
    expect(areaTags(2)).toEqual([['BIL', 'open'], ['WEB', 'waiting']])
    expect(progressOf(2)).toBe('13')
    const filter = waitingFilter()
    expect(filter).toHaveTextContent('1 waiting')
    expect(filter).toHaveAttribute('aria-pressed', 'false')
    expect(filter).toHaveAttribute('title', 'Show only features with waiting tasks')
    expect(within(region('In progress')).getByText('Click a feature to see its tasks')).toBeInTheDocument()
  })

  it('sbalená F-2 poznámku nemá; po rozbalení: Java Ben 50 %, Frontend waiting s tooltipem a „Waiting · WEB“', () => {
    renderView(d2At(1.5))
    expect(featureToggle(2)).toHaveAttribute('aria-expanded', 'false')
    expect(featureToggle(2)).toHaveAttribute('title', 'Show or hide tasks')
    expect(within(featureRow(2)).queryByText('Waiting · WEB')).toBeNull()
    expect(within(featureRow(2)).queryAllByTestId('org-task')).toHaveLength(0)

    const [java, frontend] = expandFeature(2)
    expect(featureToggle(2)).toHaveAttribute('aria-expanded', 'true')
    expect(java).toHaveAttribute('data-status', 'doing')
    expect(java).toHaveAttribute('data-progress', '50')
    expect(java).toHaveTextContent('B')
    expect(java).toHaveAttribute('title', 'Java · Ben (Team Billing)')
    expect(frontend).toHaveAttribute('data-status', 'waiting')
    expect(frontend).toHaveAttribute('title', 'Frontend · waiting · 1 idle person with this skill in Team Mobile')
    expect(within(featureRow(2)).getByText('Waiting · WEB')).toBeInTheDocument()
  })

  it('rozbalená F-1: Java hotová („Java · done“), Frontend rozpracovaný Hanou; bez poznámky Waiting', () => {
    renderView(d2At(1.5))
    const [java, frontend] = expandFeature(1)
    expect(java).toHaveAttribute('data-status', 'done')
    expect(java).toHaveAttribute('title', 'Java · done')
    expect(frontend).toHaveAttribute('data-status', 'doing')
    expect(frontend).toHaveAttribute('title', 'Frontend · Hana (Team Web)')
    expect(within(featureRow(1)).queryByText(/^Waiting · /)).toBeNull()
  })

  it('v 4.0 nic nečeká: filtr zmizí', () => {
    renderView(d2At(4))
    expect(waitingFilter()).toBeNull()
  })
})

describe('feat-029 E1: waiting a žlutý idle v panelu organizace (spec Příklad 1)', () => {
  it('v 1.5: Eli žlutý „Idle“ s tooltipem; Ada, Chen, Dani, Fae, Gus a Ivo šedý', () => {
    renderView(d2At(1.5))
    const eli = within(personCard('Team Mobile', 'Eli')).getByText('Idle')
    expect(eli).toHaveAttribute('data-tone', 'blocked')
    expect(eli).toHaveAttribute('title', 'Idle while work for their skills waits in Web portal')
    for (const [teamName, name] of [['Team Billing', 'Ada'], ['Team Billing', 'Chen'], ['Team Mobile', 'Dani'],
      ['Team Mobile', 'Fae'], ['Team Web', 'Gus'], ['Team Web', 'Ivo']]) {
      expect(within(personCard(teamName, name)).getByText('Idle')).toHaveAttribute('data-tone', 'idle')
    }
  })

  it('v 1.5: Team Mobile 0/3 s pruhem 0 / 1 / 2 a „3 idle“ v barvě čekání; Team Billing a Team Web 1/3 se štítky', () => {
    renderView(d2At(1.5))
    const bar = within(teamRow('Team Mobile')).getByTestId('org-people-bar')
    expect(bar).toHaveTextContent('0/3')
    expect(bar).toHaveAttribute('data-working', '0')
    expect(bar).toHaveAttribute('data-blocked', '1')
    expect(bar).toHaveAttribute('data-idle', '2')
    expect(bar).toHaveAttribute('title', '0 working, 3 idle (1 while work for their skills waits in another area)')
    expect(within(teamRow('Team Mobile')).getByText('3 idle')).toHaveAttribute('data-tone', 'blocked')
    expect(workChips('Team Mobile')).toEqual([])

    expect(within(teamRow('Team Billing')).getByTestId('org-people-bar')).toHaveTextContent('1/3')
    expect(within(teamRow('Team Billing')).getByTestId('org-people-bar')).toHaveAttribute('title', '1 working, 2 idle')
    expect(workChips('Team Billing')).toEqual(['F-002'])
    expect(within(teamRow('Team Billing')).getByText('2 idle')).toHaveAttribute('data-tone', 'idle')
    expect(workChips('Team Web')).toEqual(['F-001'])
    expect(within(teamRow('Team Web')).getByText('2 idle')).toHaveAttribute('data-tone', 'idle')
  })

  it('v 1.5: hlavička organizace „7 idle“ v barvě čekání', () => {
    renderView(d2At(1.5))
    expect(within(region('Organization')).getByText('7 idle')).toHaveAttribute('data-tone', 'blocked')
  })

  it('v 4.0 má Eli šedý „Idle“', () => {
    renderView(d2At(4))
    expect(within(personCard('Team Mobile', 'Eli')).getByText('Idle')).toHaveAttribute('data-tone', 'idle')
  })
})

describe('feat-029 E2: úkol zamčený fází není waiting (spec Příklad 2)', () => {
  it('D6 v 1.0: Java a QA v BIL i QA v MOB jsou „to do“ bez filtru; Gus má šedý „Idle“', () => {
    renderView(d6At(1))
    const tasks = expandFeature(1)
    expect(tasks.map(t => t.dataset.status)).toEqual(['doing', 'todo', 'todo', 'doing', 'todo'])
    expect(tasks[1]).toHaveAttribute('title', 'Java · to do')
    expect(tasks[0]).toHaveTextContent('A')
    expect(waitingFilter()).toBeNull()
    expect(within(featureRow(1)).queryByText(/^Waiting · /)).toBeNull()
    expect(within(personCard('Team Web', 'Gus')).getByText('Idle')).toHaveAttribute('data-tone', 'idle')
  })
})

describe('feat-029 E5: žlutý idle i kvůli práci v backlogu (spec Příklad 4)', () => {
  it('D10 v 1.0: Hana žlutý „Idle“ (Mobile app); In progress jen F-1 bez filtru; Idle Time 1.0', () => {
    renderView(runUntil(stateOf(grant(orgT(), 'Team Mobile', 'WEB'), 'F-1 (p1): WEB [Frontend 2]', 'F-2 (p2): MOB [Frontend 2]'), 1))
    const hana = within(personCard('Team Web', 'Hana')).getByText('Idle')
    expect(hana).toHaveAttribute('data-tone', 'blocked')
    expect(hana).toHaveAttribute('title', 'Idle while work for their skills waits in Mobile app')
    expect(shownFeatures()).toEqual(['1'])
    expect(waitingFilter()).toBeNull()
    expect(tile('Idle Time')).toHaveTextContent('1.0')
  })
})

describe('feat-029 UI / Design: tooltip a poznámka s více lidmi a oblastmi', () => {
  it('QA ve F-2 čeká na Chena: „2 idle people with this skill in Team Mobile, Team Web“', () => {
    renderView(runUntil(stateOf(orgT(), 'F-1 (p1): BIL [QA 2]', 'F-2 (p2): BIL [QA 2] | MOB [Frontend 1]'), 0.5))
    const [qa] = expandFeature(2)
    expect(qa).toHaveAttribute('data-status', 'waiting')
    expect(qa).toHaveAttribute('title', 'QA · waiting · 2 idle people with this skill in Team Mobile, Team Web')
    expect(within(featureRow(2)).getByText('Waiting · BIL')).toBeInTheDocument()
  })

  it('poznámka vypíše čekající oblasti v pořadí featury; žlutý idle oblasti v pořadí oblastí', () => {
    renderView(runUntil(stateOf(orgT(),
      'F-1 (p1): BIL [QA 3] | MOB [QA 3]',
      'F-2 (p2): MOB [QA 1] | BIL [QA 1] | WEB [Product 2 · QA 1]'), 0.5))
    expandFeature(2)
    expect(areaTags(2)).toEqual([['MOB', 'waiting'], ['BIL', 'waiting'], ['WEB', 'open']])
    expect(within(featureRow(2)).getByText('Waiting · MOB, BIL')).toBeInTheDocument()
    expect(within(personCard('Team Web', 'Ivo')).getByText('Idle'))
      .toHaveAttribute('title', 'Idle while work for their skills waits in Billing, Mobile app')
  })
})

describe('feat-029 H1, H2, H4: řádek týmu a lidé za běhu (spec Příklad 6)', () => {
  it('H1: D7 v 0.5 — Team Billing: BIL, 2/3, štítky F-001 a F-002 v pořadí čísla, šedé „1 idle“; sloupec Working on', () => {
    renderView(d7At(0.5))
    const row = teamRow('Team Billing')
    expect(within(row).getByText('BIL')).toBeInTheDocument()
    expect(within(row).getByTestId('org-people-bar')).toHaveTextContent('2/3')
    expect(workChips('Team Billing')).toEqual(['F-001', 'F-002'])
    expect(within(row).getByText('1 idle')).toHaveAttribute('data-tone', 'idle')
    expect(within(region('Organization')).getByText('Working on')).toBeInTheDocument()
    // Za běhu nejde nic měnit: žádná tlačítka mandátů
    expect(within(row).queryByRole('button', { name: /mandate/i })).toBeNull()
  })

  it('H1: po doběhnutí ukazuje Working on „—“ a hlavička nemá počet idle lidí', () => {
    renderView(runToEnd(d7At(0)), { locked: true })
    expect(within(teamRow('Team Billing')).getByText('—')).toBeInTheDocument()
    expect(workChips('Team Billing')).toEqual([])
    expect(within(region('Organization')).queryByText(/^\d+ idle$/)).toBeNull()
  })

  it('H2: D14 v 1.0 — Gus a Hana na F-1 dají v Team Web štítek „F-001 ×2“ s tooltipem', () => {
    const s = runUntil(stateOf(orgT(), 'F-1 (p1): WEB [Java 2 · Frontend 2]'), 1)
    renderView(s)
    const chip = within(teamRow('Team Web')).getByRole('button', { name: 'F-001 ×2' })
    expect(chip).toHaveAttribute('title', `${featureOf(s, 1).name} · 2 from Team Web. Click to show the feature.`)
  })

  it('H4: D7 v 1.0 — Chen „F-001 · BIL · QA“ s pruhem 33 %; Ada a Ben šedý „Idle“', () => {
    renderView(d7At(1))
    const chen = personCard('Team Billing', 'Chen')
    expect(within(chen).getByText('F-001 · BIL · QA')).toBeInTheDocument()
    expect(within(chen).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '33')
    for (const name of ['Ada', 'Ben']) {
      expect(within(personCard('Team Billing', name)).getByText('Idle')).toHaveAttribute('data-tone', 'idle')
    }
  })
})

describe('feat-029 H6: filtr čekajících featur (spec Příklad 7)', () => {
  it('„1 waiting“ ukáže jen F-2, další klik obě', () => {
    renderView(d2At(1.5))
    fireEvent.click(waitingFilter()!)
    expect(waitingFilter()).toHaveAttribute('aria-pressed', 'true')
    expect(shownFeatures()).toEqual(['2'])
    fireEvent.click(waitingFilter()!)
    expect(waitingFilter()).toHaveAttribute('aria-pressed', 'false')
    expect(shownFeatures()).toEqual(['1', '2'])
  })

  it('když už nic nečeká, filtr zmizí a vypne se: v 3.5 In progress ukazuje F-2', () => {
    const s = d2At(1.5)
    const { rerender, props } = renderView(s)
    fireEvent.click(waitingFilter()!)
    expect(shownFeatures()).toEqual(['2'])
    // Stejný objekt stavu jako v aplikaci: engine ho mění na místě
    runUntil(s, 3.5)
    rerender(<OrganizationView {...props} state={s} />)
    expect(waitingFilter()).toBeNull()
    expect(shownFeatures()).toEqual(['2'])
  })
})

describe('feat-029 H3: skok na featuru (spec Příklad 8)', () => {
  it('klik na „F-001“ v Team Web vypne filtr a F-1 rozbalí, zvýrazní a posune do viditelné části', () => {
    renderView(d2At(1.5))
    fireEvent.click(waitingFilter()!)
    expect(shownFeatures()).toEqual(['2'])
    fireEvent.click(within(teamRow('Team Web')).getByRole('button', { name: 'F-001' }))
    expect(waitingFilter()).toHaveAttribute('aria-pressed', 'false')
    expect(featureRow(1)).toHaveAttribute('data-highlighted', 'true')
    expect(featureToggle(1)).toHaveAttribute('aria-expanded', 'true')
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })

  it('další skok zvýrazní jen novou featuru; předchozí zůstane rozbalená', () => {
    renderView(d2At(1.5))
    fireEvent.click(within(teamRow('Team Web')).getByRole('button', { name: 'F-001' }))
    fireEvent.click(within(teamRow('Team Billing')).getByRole('button', { name: 'F-002' }))
    expect(featureRow(2)).toHaveAttribute('data-highlighted', 'true')
    expect(featureToggle(2)).toHaveAttribute('aria-expanded', 'true')
    expect(featureRow(1)).not.toHaveAttribute('data-highlighted', 'true')
    expect(featureToggle(1)).toHaveAttribute('aria-expanded', 'true')
  })

  it('po Resetu a novém běhu je filtr vypnutý a žádná featura není rozbalená ani zvýrazněná', () => {
    const s = d2At(1.5)
    const { rerender, props } = renderView(s)
    fireEvent.click(waitingFilter()!)
    fireEvent.click(within(teamRow('Team Web')).getByRole('button', { name: 'F-001' }))
    fireEvent.click(waitingFilter()!)
    expect(waitingFilter()).toHaveAttribute('aria-pressed', 'true')
    // Reset jako v aplikaci: stejný objekt stavu, panel se odemkne; pak nový běh do 1.5
    resetOrgState(s)
    rerender(<OrganizationView {...props} state={s} locked={false} />)
    runUntil(s, 1.5)
    rerender(<OrganizationView {...props} state={s} locked />)
    expect(waitingFilter()).toHaveAttribute('aria-pressed', 'false')
    expect(shownFeatures()).toEqual(['1', '2'])
    for (const id of [1, 2]) {
      expect(featureToggle(id)).toHaveAttribute('aria-expanded', 'false')
      expect(featureRow(id)).not.toHaveAttribute('data-highlighted', 'true')
    }
  })
})

describe('feat-029 H7 a B5: detail položky backlogu (spec Příklad 9)', () => {
  /** Rozbalí položku backlogu podle čísla featury a vrátí ji. */
  function expandBacklogItem(id: number): HTMLElement {
    const item = within(region('Backlog')).getAllByTestId('org-backlog-item').find(i => i.textContent?.includes(label(id)))
    if (!item) throw new Error(`${label(id)} v backlogu není`)
    const toggle = within(item).getByRole('button', { name: new RegExp(`^${label(id)}\\b`) })
    expect(toggle).toHaveAttribute('title', 'Show or hide details')
    if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    return item
  }

  it('H7: priorita, počet úkolů a práce, úkoly po oblastech a týmy s mandátem místo pruhu pracnosti', () => {
    renderView(makeOrgState(orgDef(), [feat('F-2 (p2): BIL [Product 2 · Java 3] | WEB [QA 3]')]))
    const item = expandBacklogItem(2)
    expect(within(item).getByText('Priority 2 · 3 tasks · 8 days of work')).toBeInTheDocument()
    for (const chip of ['Product · 2 d', 'Java · 3 d', 'QA · 3 d', 'Mandate: Team Billing', 'Mandate: Team Web']) {
      expect(within(item).getByText(chip)).toBeInTheDocument()
    }
    // Pruh pracnosti (title „8 days of work“) rozbalená položka nemá
    expect(within(item).queryByTitle('8 days of work')).toBeNull()
  })

  it('H7: po odebrání mandátu WEB před během ukáže WEB „No team has a mandate for this area“', () => {
    const state = makeOrgState(orgDef(), [feat('F-2 (p2): BIL [Product 2 · Java 3] | WEB [QA 3]')])
    const { rerender, props } = renderView(state)
    const item = expandBacklogItem(2)
    const setup = structuredClone(state.setup)
    team(setup, 'Team Web').mandates = []
    rerender(<OrganizationView {...props} setup={setup} />)
    expect(within(item).getByText('No team has a mandate for this area')).toBeInTheDocument()
    expect(within(item).queryByText('Mandate: Team Web')).toBeNull()
    expect(within(item).getByText('Mandate: Team Billing')).toBeInTheDocument()
  })

  it('B5: oblast s více týmy ukazuje „Mandate: Team Mobile, Team Web“; jednotné číslo „1 task“ a „1 day of work“', () => {
    renderView(makeOrgState(grant(orgDef(), 'Team Mobile', 'WEB'), [feat('F-1 (p1): WEB [QA 3]'), feat('F-3 (p3): MOB [Java 1]')]))
    const first = expandBacklogItem(1)
    expect(within(first).getByText('Mandate: Team Mobile, Team Web')).toBeInTheDocument()
    expect(within(first).getByText('Priority 1 · 1 task · 3 days of work')).toBeInTheDocument()
    const third = expandBacklogItem(3)
    expect(within(third).getByText('Priority 3 · 1 task · 1 day of work')).toBeInTheDocument()
    // Rozbalených může být víc najednou
    expect(within(first).getByText('Mandate: Team Mobile, Team Web')).toBeInTheDocument()
  })

  it('položku backlogu jde rozbalit i za běhu', () => {
    renderView(d2At(0.5))
    const item = expandBacklogItem(2)
    expect(within(item).getByText('Priority 2 · 2 tasks · 4 days of work')).toBeInTheDocument()
  })
})

describe('feat-029: dlaždice Idle Time', () => {
  it('před během „—“, hint „person-days without a task“ a tooltip', () => {
    renderView(d7At(0))
    expect(tile('Idle Time')).toHaveTextContent('—')
    expect(within(tile('Idle Time')).getByText('person-days without a task')).toBeInTheDocument()
    expect(tile('Idle Time')).toHaveAttribute('title',
      'Person-days that people spent without a task while work for their skills was still open in the organization.')
  })

  it('E1: D2 v 1.5 ukazuje „2.5 days“, v 4.0 „4.0 days“', () => {
    const { unmount } = renderView(d2At(1.5))
    expect(tile('Idle Time')).toHaveTextContent('2.5')
    expect(tile('Idle Time')).toHaveTextContent('days')
    unmount()
    renderView(d2At(4))
    expect(tile('Idle Time')).toHaveTextContent('4.0')
  })

  it('od prvního Run číslo i při nule: D7 v 0.5 „0.0 days“', () => {
    renderView(d7At(0.5))
    expect(tile('Idle Time')).toHaveTextContent('0.0')
    expect(tile('Idle Time')).not.toHaveTextContent('—')
  })
})

describe('feat-029 F6–F9: srovnání Idle Time s předchozím během (spec Příklad 10)', () => {
  /** Doběhnutý běh: Total 9.0, Avg cycle 6.9, Avg WIP 4.6, Idle Time 3.0. */
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
    s.idleByPerson = { 1: 3 }
    s.startedAt = 0
    s.finished = true
    return s
  }

  /** Předchozí běh: Total 12.0, Avg cycle 8.7, Avg WIP 4.3, Idle Time 17.0. */
  const previous: OrgRunSnapshot = { totalTime: 12, avgCycleTime: 8.7, avgWip: 4.3, idleTime: 17 }

  /** Řádek delty pod hodnotou dlaždice. */
  const deltaOf = (name: string) => within(tile(name)).getByText('vs prev run').parentElement!

  it('F6: po doběhnutí Idle Time „3.0 days“ a „↓ 82% vs prev run“ zeleně', () => {
    renderView(finishedRun(), { previousRun: previous })
    expect(tile('Idle Time')).toHaveTextContent('3.0')
    expect(deltaOf('Idle Time')).toHaveTextContent('↓ 82%')
    expect(deltaOf('Idle Time')).toHaveClass(tileStyles.deltaGood)
  })

  it('F6: vyšší Idle Time než minule je červeně', () => {
    renderView(finishedRun(), { previousRun: { ...previous, idleTime: 2 } })
    expect(deltaOf('Idle Time')).toHaveTextContent('↑ 50%')
    expect(deltaOf('Idle Time')).toHaveClass(tileStyles.deltaBad)
  })

  it('předchozí běh s Idle Time 0: delta u Idle Time není', () => {
    renderView(finishedRun(), { previousRun: { ...previous, idleTime: 0 } })
    expect(within(tile('Idle Time')).queryByText('vs prev run')).toBeNull()
  })

  it('F8: bez předchozího běhu nemá Idle Time „vs prev run“', () => {
    renderView(finishedRun(), { previousRun: null })
    expect(within(tile('Idle Time')).queryByText('vs prev run')).toBeNull()
  })

  it('F9: za běhu Idle Time deltu nemá, Avg Cycle Time a Avg WIP ano', () => {
    renderView(d7At(3.5), { previousRun: previous })
    expect(within(tile('Idle Time')).queryByText('vs prev run')).toBeNull()
    expect(within(tile('Avg Cycle Time')).getByText('vs prev run')).toBeInTheDocument()
    expect(within(tile('Avg WIP')).getByText('vs prev run')).toBeInTheDocument()
  })

  it('D2 → Reset → Team Mobile s WEB: za běhu bez delty, po doběhnutí „1.0 days“ a „↓ 75%“ zeleně', () => {
    const s = runToEnd(d2At(0))
    const { rerender, props } = renderView(s, { locked: true })
    expect(tile('Idle Time')).toHaveTextContent('4.0')
    expect(within(tile('Idle Time')).queryByText('vs prev run')).toBeNull()

    const prev = snapshotOrgRun(s)
    resetOrgState(s)
    s.setup = grant(structuredClone(s.setup), 'Team Mobile', 'WEB')
    rerender(<OrganizationView {...props} setup={s.setup} state={s} locked={false} previousRun={prev} />)
    expect(tile('Idle Time')).toHaveTextContent('—')

    runUntil(s, 1)
    rerender(<OrganizationView {...props} setup={s.setup} state={s} locked previousRun={prev} />)
    expect(within(tile('Idle Time')).queryByText('vs prev run')).toBeNull()

    runToEnd(s)
    rerender(<OrganizationView {...props} setup={s.setup} state={s} locked previousRun={prev} />)
    expect(tile('Idle Time')).toHaveTextContent('1.0')
    expect(deltaOf('Idle Time')).toHaveTextContent('↓ 75%')
    expect(deltaOf('Idle Time')).toHaveClass(tileStyles.deltaGood)
  })
})
