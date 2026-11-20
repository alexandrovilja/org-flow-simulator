import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { OrganizationView, type OrganizationViewProps } from '@/components/OrganizationView'
import { makeOrgState } from '@/simulation/organizationEngine'
import type { OrgSetup, OrgSimState } from '@/types/organization'
import { feat, makeSetup, orgB, orgDef, orgT, runToEnd, runUntil, stateOf, team } from './feat028Fixtures'

// feat-030 (Úpravy týmů a lidí, mód Organization inkrement 3) — úpravy týmů a lidí v panelu organizace.
//
// Schválený kontrakt (spec features/feat-030-upravy-tymu-a-lidi.md, UI / Design a Příklady 1–5, 7, 9–12; mockup
// docs/feat-028-ui-mockup.html v9; analýza B6–B11, B22, C9, D13, E6, J4 a I1):
//  - `OrganizationView` má stejné props jako v inkrementech 1 a 2. Úpravy posílá přes `onSetupChange` s novou
//    organizací; panel i varování se řídí propem `setup`.
//  - Před během:
//    • poznámka „Click + to add a mandate or a skill“; v hlavičce tlačítko „Expand all“ / „Collapse all“,
//    • řádek týmu `data-testid="org-team-row"`: pole `textbox` „Team name“ (Enter nebo opuštění uloží, okolní mezery
//      se ořežou, prázdný název se neuloží, Esc vrátí uložený název), počet „4 people“, tlačítko „Remove Team Web“,
//    • odebrání týmu s lidmi: potvrzení „Remove Team Web? 4 people will be removed.“ („1 person will be removed.“)
//      s tlačítky „Remove“ a „Cancel“; fokus na Cancel, Esc = Cancel. Tým bez lidí se odebere hned,
//    • „+ Add team“ přidá na konec rozbalený „Team 4“ a fokus s označeným textem dá do jeho názvu,
//    • karta člověka `data-testid="org-person"`: jméno, „Person actions“ (menu „Move to Team Billing“, …,
//      „Remove person“), čipy skillů s tlačítkem „Remove skill Java“, tlačítko „Add skill“ (menu chybějících skillů
//      v pořadí editoru, nebo text „Has every skill“); pod kartami „+ Add person“ (přidá „Person N“ bez skillů),
//    • nabídky (role menu): fokus na první položku, šipky dokola, Esc zavře a vrátí fokus na tlačítko; v panelu je
//      otevřená nejvýš jedna nabídka nebo jedno potvrzení,
//    • varování kontroly se mění hned s každou úpravou.
//  - Za běhu (locked): název týmu je text; nejsou pole názvu, „Remove <tým>“, „+ Add team“, „+ Add person“,
//    „Person actions“, „Add skill“ ani „Remove skill …“. „Expand all“ funguje i za běhu. Tým bez lidí ukazuje „0/0“
//    a ve Working on „—“; člověk bez skillů má šedé „Idle“.
//  - Dlouhé názvy (název týmu v poli i za běhu, „Move to …“, oblasti v nabídce mandátů) mají `title` s plným
//    názvem, jen když jsou zkrácené (`scrollWidth > clientWidth`, jako feat-023).

const LONG_TEAM = 'Customer Experience and Onboarding Squad'
const LONG_AREA = 'Customer Experience Operations Platforms'

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * Plocha módu před během, která úpravy organizace opravdu použije (jako Simulator): drží organizaci ve stavu
 * a předá ji zpět do `OrganizationView`.
 */
function EditableView({ initial }: { initial: OrgSimState }) {
  const [setup, setSetup] = useState<OrgSetup>(initial.setup)
  return <OrganizationView setup={setup} onSetupChange={setSetup} state={initial} locked={false} previousRun={null} />
}

/** Vykreslí upravitelnou plochu módu nad stavem před během. */
const renderEditable = (state: OrgSimState) => render(<EditableView initial={state} />)

/** Vykreslí plochu módu nad daným stavem (bez úprav); bez `locked` se bere, zda běh začal. */
function renderView(state: OrgSimState, overrides: Partial<OrganizationViewProps> = {}) {
  const props: OrganizationViewProps = {
    setup: state.setup, onSetupChange: vi.fn(), state, locked: state.simTime > 0, previousRun: null, ...overrides,
  }
  return { ...render(<OrganizationView {...props} />), props }
}

const region = (name: string) => screen.getByRole('region', { name })
const org = () => region('Organization')
const rows = () => within(org()).getAllByTestId('org-team-row')

/**
 * Řádek týmu podle názvu: před během podle hodnoty pole „Team name“, za běhu podle textu. Pole má přednost, aby
 * se řádek nenašel podle položky „Move to Team Web“ v nabídce otevřené v jiném týmu.
 */
function teamRow(name: string): HTMLElement {
  const row = rows().find(r => within(r).queryAllByDisplayValue(name).length > 0)
    ?? rows().find(r => within(r).queryAllByText(name).length > 0)
  if (!row) throw new Error(`Řádek týmu ${name} není`)
  return row
}

/** Pole názvu týmu v řádku. */
const nameInput = (row: HTMLElement) => within(row).getByRole('textbox', { name: 'Team name' })

/** Názvy týmů v pořadí panelu podle polí „Team name“ (před během). */
const teamNames = () => rows().map(r => {
  const input = within(r).queryByRole('textbox', { name: 'Team name' })
  return input instanceof HTMLInputElement ? input.value : '?'
})

/** Šipka pro rozbalení lidí týmu. */
const chevron = (teamName: string) => within(teamRow(teamName)).getByRole('button', { name: 'Show or hide people' })

/** Rozbalí lidi týmu (pokud ještě nejsou) a vrátí jejich karty. */
function people(teamName: string): HTMLElement[] {
  if (chevron(teamName).getAttribute('aria-expanded') !== 'true') fireEvent.click(chevron(teamName))
  return within(teamRow(teamName)).queryAllByTestId('org-person')
}

/** Karta člověka (tým se rozbalí, když ještě není). */
function personCard(teamName: string, personName: string): HTMLElement {
  const card = people(teamName).find(c => within(c).queryAllByText(personName).length > 0)
  if (!card) throw new Error(`Karta ${personName} v ${teamName} není`)
  return card
}

/** Jména lidí na kartách týmu v pořadí panelu. */
const peopleNames = (teamName: string) =>
  people(teamName).map(c => ['Ada', 'Ben', 'Cyril', 'Chen', 'Dani', 'Emil', 'Eli', 'Fae', 'Gus', 'Hugo', 'Hana', 'Ivo', 'Petr', 'Person 13']
    .find(n => within(c).queryAllByText(n).length > 0) ?? '?')

/** Názvy tlačítek odebrání skillů na kartě (pořadí čipů). */
const skillButtons = (card: HTMLElement) =>
  within(card).queryAllByRole('button', { name: /^Remove skill / }).map(b => b.getAttribute('aria-label'))

/** Texty položek otevřené nabídky. */
const menuItems = () => within(screen.getByRole('menu')).getAllByRole('menuitem').map(i => i.textContent?.replace(/\s+/g, ' ').trim())

/** Text varování v panelu organizace (prázdné pole = žádné varování). */
function warnings(): string[] {
  const alert = within(org()).queryByRole('alert')
  return alert ? within(alert).getAllByRole('listitem').map(li => li.textContent ?? '') : []
}

/** Otevře nabídku akcí člověka. */
const openPersonActions = (teamName: string, personName: string) =>
  fireEvent.click(within(personCard(teamName, personName)).getByRole('button', { name: 'Person actions' }))

/** Otevře nabídku přidání skillu člověku. */
const openAddSkill = (teamName: string, personName: string) =>
  fireEvent.click(within(personCard(teamName, personName)).getByRole('button', { name: 'Add skill' }))

/** Přidá člověku skill přes nabídku. */
function addSkill(teamName: string, personName: string, skill: string): void {
  openAddSkill(teamName, personName)
  fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: skill }))
}

/** ORG-DEF s malým backlogem, který používá všechny tři oblasti. */
const defState = (setup: OrgSetup = orgDef()) => makeOrgState(setup, [
  feat('F-1 (p1): BIL [Java 2 · QA 1] | WEB [QA 1]'),
  feat('F-2 (p2): MOB [Frontend 1]'),
])

describe('feat-030: hlavička panelu před během', () => {
  it('poznámka „Click + to add a mandate or a skill“ a tlačítko „Expand all“', () => {
    renderEditable(defState())
    expect(within(org()).getByText('Click + to add a mandate or a skill')).toBeInTheDocument()
    expect(within(org()).getByRole('button', { name: 'Expand all' })).toBeInTheDocument()
  })
})

describe('feat-030 B6–B7: přejmenování týmu', () => {
  it('B6: „  Mobile Apple “ + Enter → „Mobile Apple“; detail backlogu ukazuje „Mandate: Mobile Apple“', () => {
    renderEditable(defState())
    const input = nameInput(teamRow('Team Mobile'))
    fireEvent.change(input, { target: { value: '  Mobile Apple ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(teamNames()).toEqual(['Team Billing', 'Mobile Apple', 'Team Web'])
    const item = within(region('Backlog')).getAllByTestId('org-backlog-item').find(i => within(i).queryByText('MOB'))
    if (!item) throw new Error('Položka s MOB v backlogu není')
    fireEvent.click(within(item).getByRole('button', { name: /^F-002/ }))
    expect(within(item).getByText('Mandate: Mobile Apple')).toBeInTheDocument()
  })

  it('B7: opuštění pole název uloží; prázdný název se neuloží; shodný název se uloží', () => {
    renderEditable(defState())
    const web = nameInput(teamRow('Team Web'))
    fireEvent.change(web, { target: { value: '   ' } })
    fireEvent.blur(web)
    expect(teamNames()).toEqual(['Team Billing', 'Team Mobile', 'Team Web'])
    const again = nameInput(rows()[2])
    fireEvent.change(again, { target: { value: 'Team Mobile' } })
    fireEvent.blur(again)
    expect(teamNames()).toEqual(['Team Billing', 'Team Mobile', 'Team Mobile'])
  })

  it('Esc zruší rozepsanou změnu a vrátí uložený název (ani následné opuštění pole ji neuloží)', () => {
    renderEditable(defState())
    const input = nameInput(teamRow('Team Web'))
    fireEvent.change(input, { target: { value: 'Portal' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(nameInput(rows()[2])).toHaveValue('Team Web')
    fireEvent.blur(nameInput(rows()[2]))
    expect(teamNames()).toEqual(['Team Billing', 'Team Mobile', 'Team Web'])
  })
})

describe('feat-030 B8 a C7: přidání a odebrání týmu', () => {
  it('„+ Add team“ přidá rozbalený „Team 4“ s „0 people“ a „No mandate“; fokus je v jeho názvu s označeným textem', () => {
    renderEditable(defState())
    fireEvent.click(within(org()).getByRole('button', { name: '+ Add team' }))
    expect(teamNames()).toEqual(['Team Billing', 'Team Mobile', 'Team Web', 'Team 4'])
    const row = teamRow('Team 4')
    expect(within(row).getByText('0 people')).toBeInTheDocument()
    expect(within(row).getByText('No mandate')).toBeInTheDocument()
    expect(chevron('Team 4')).toHaveAttribute('aria-expanded', 'true')
    const input = nameInput(row)
    expect(document.activeElement).toBe(input)
    expect(input).toBeInstanceOf(HTMLInputElement)
    if (input instanceof HTMLInputElement) {
      expect([input.selectionStart, input.selectionEnd]).toEqual([0, 'Team 4'.length])
    }
    expect(within(org()).getByText('4 teams · 12 people')).toBeInTheDocument()
    // C7: prázdný tým bez mandátu varování nevyvolá
    expect(warnings()).toEqual([])
  })

  it('tým bez lidí se odebere hned, bez potvrzení', () => {
    renderEditable(defState())
    fireEvent.click(within(org()).getByRole('button', { name: '+ Add team' }))
    fireEvent.click(within(teamRow('Team 4')).getByRole('button', { name: 'Remove Team 4' }))
    expect(teamNames()).toEqual(['Team Billing', 'Team Mobile', 'Team Web'])
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull()
  })

  it('tým s lidmi: potvrzení s fokusem na Cancel; Cancel tým nechá', () => {
    renderEditable(defState())
    fireEvent.click(within(teamRow('Team Web')).getByRole('button', { name: 'Remove Team Web' }))
    expect(screen.getByText('Remove Team Web? 4 people will be removed.')).toBeInTheDocument()
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    expect(document.activeElement).toBe(cancel)
    fireEvent.click(cancel)
    expect(screen.queryByText('Remove Team Web? 4 people will be removed.')).toBeNull()
    expect(teamNames()).toEqual(['Team Billing', 'Team Mobile', 'Team Web'])
  })

  it('Esc v potvrzení znamená Cancel', () => {
    renderEditable(defState())
    fireEvent.click(within(teamRow('Team Web')).getByRole('button', { name: 'Remove Team Web' }))
    fireEvent.keyDown(screen.getByRole('button', { name: 'Cancel' }), { key: 'Escape' })
    expect(screen.queryByText('Remove Team Web? 4 people will be removed.')).toBeNull()
    expect(teamNames()).toHaveLength(3)
  })

  it('Remove odebere Team Web i s lidmi → „2 teams · 8 people“, „No team has a mandate for WEB“', () => {
    renderEditable(defState())
    fireEvent.click(within(teamRow('Team Web')).getByRole('button', { name: 'Remove Team Web' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(teamNames()).toEqual(['Team Billing', 'Team Mobile'])
    expect(within(org()).getByText('2 teams · 8 people')).toBeInTheDocument()
    expect(warnings()).toEqual(['No team has a mandate for WEB'])
  })

  it('tým s jedním člověkem: „Remove Team Solo? 1 person will be removed.“', () => {
    renderEditable(makeOrgState(makeSetup([['Team Solo', ['BIL'], [['Ada', ['Java']]]]]), [feat('F-1: BIL [Java 1]')]))
    fireEvent.click(within(teamRow('Team Solo')).getByRole('button', { name: 'Remove Team Solo' }))
    expect(screen.getByText('Remove Team Solo? 1 person will be removed.')).toBeInTheDocument()
  })

  it('odebrat jde i poslední tým: „0 teams · 0 people“, varování a „+ Add team“; bez „Expand all“', () => {
    renderEditable(makeOrgState(orgB(), [feat('F-1: BIL [Java 1]')]))
    fireEvent.click(within(teamRow('Team Billing')).getByRole('button', { name: 'Remove Team Billing' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(within(org()).queryAllByTestId('org-team-row')).toHaveLength(0)
    expect(within(org()).getByText('0 teams · 0 people')).toBeInTheDocument()
    expect(warnings()).toEqual(['No team has a mandate for BIL'])
    expect(within(org()).getByRole('button', { name: '+ Add team' })).toBeInTheDocument()
    expect(within(org()).queryByRole('button', { name: /^(Expand|Collapse) all$/ })).toBeNull()
  })
})

describe('feat-030 B9: přidání a odebrání člověka', () => {
  it('„+ Add person“ přidá na konec Team Web „Person 13“ bez skillů (jen „Add skill“); „Remove person“ ho odebere', () => {
    renderEditable(defState())
    people('Team Web')
    fireEvent.click(within(teamRow('Team Web')).getByRole('button', { name: '+ Add person' }))
    expect(peopleNames('Team Web')).toEqual(['Gus', 'Hugo', 'Hana', 'Ivo', 'Person 13'])
    expect(within(teamRow('Team Web')).getByText('5 people')).toBeInTheDocument()
    const added = personCard('Team Web', 'Person 13')
    expect(skillButtons(added)).toEqual([])
    expect(within(added).getByRole('button', { name: 'Add skill' })).toBeInTheDocument()

    openPersonActions('Team Web', 'Person 13')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove person' }))
    expect(peopleNames('Team Web')).toEqual(['Gus', 'Hugo', 'Hana', 'Ivo'])
    expect(within(teamRow('Team Web')).getByText('4 people')).toBeInTheDocument()
  })
})

describe('feat-030 B10 a C9: skilly člověka', () => {
  it('B10: nabídka u Hany má Product, Java, QA; Java se přidá na konec a nabídka se zavře', () => {
    renderEditable(defState())
    openAddSkill('Team Web', 'Hana')
    expect(menuItems()).toEqual(['Product', 'Java', 'QA'])
    fireEvent.click(screen.getByRole('menuitem', { name: 'Java' }))
    expect(screen.queryByRole('menu')).toBeNull()
    expect(skillButtons(personCard('Team Web', 'Hana'))).toEqual(['Remove skill Frontend', 'Remove skill Java'])
  })

  it('B10: se všemi skilly ukáže nabídka jen „Has every skill“; × u Java odebere jen Javu', () => {
    renderEditable(defState())
    addSkill('Team Web', 'Hana', 'Java')
    addSkill('Team Web', 'Hana', 'Product')
    addSkill('Team Web', 'Hana', 'QA')
    openAddSkill('Team Web', 'Hana')
    expect(screen.getByText('Has every skill')).toBeInTheDocument()
    expect(screen.queryAllByRole('menuitem')).toHaveLength(0)
    fireEvent.click(within(personCard('Team Web', 'Hana')).getByRole('button', { name: 'Remove skill Java' }))
    expect(skillButtons(personCard('Team Web', 'Hana'))).toEqual(['Remove skill Frontend', 'Remove skill Product', 'Remove skill QA'])
  })

  it('C9: odebrání QA Chenovi hned ukáže „No one with QA can work in BIL“', () => {
    renderEditable(defState())
    expect(warnings()).toEqual([])
    fireEvent.click(within(personCard('Team Billing', 'Chen')).getByRole('button', { name: 'Remove skill QA' }))
    expect(warnings()).toEqual(['No one with QA can work in BIL'])
  })
})

describe('feat-030 B11: přesun člověka', () => {
  it('nabídka u Eli má „Move to Team Billing“, „Move to Team Web“ a „Remove person“', () => {
    renderEditable(defState())
    openPersonActions('Team Mobile', 'Eli')
    expect(menuItems()).toEqual(['Move to Team Billing', 'Move to Team Web', 'Remove person'])
  })

  it('Eli je po přesunu posledním člověkem Team Web s čipem Frontend; počty 3 a 5; varování pro MOB', () => {
    renderEditable(defState())
    people('Team Web')
    openPersonActions('Team Mobile', 'Eli')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move to Team Web' }))
    expect(peopleNames('Team Web')).toEqual(['Gus', 'Hugo', 'Hana', 'Ivo', 'Eli'])
    expect(skillButtons(personCard('Team Web', 'Eli'))).toEqual(['Remove skill Frontend'])
    expect(within(teamRow('Team Mobile')).getByText('3 people')).toBeInTheDocument()
    expect(within(teamRow('Team Web')).getByText('5 people')).toBeInTheDocument()
    expect(warnings()).toEqual(['No one with Frontend can work in MOB'])
  })

  it('s jediným týmem má nabídka jen „Remove person“', () => {
    renderEditable(makeOrgState(orgB(), [feat('F-1: BIL [Java 1]')]))
    openPersonActions('Team Billing', 'Ben')
    expect(menuItems()).toEqual(['Remove person'])
  })
})

describe('feat-030: nabídky a potvrzení', () => {
  it('nabídka akcí člověka: fokus na první položce, šipky dokola, Esc zavře a vrátí fokus na „Person actions“', () => {
    renderEditable(defState())
    openPersonActions('Team Mobile', 'Eli')
    const item = (name: string) => screen.getByRole('menuitem', { name })
    expect(document.activeElement).toBe(item('Move to Team Billing'))
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(item('Move to Team Web'))
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'ArrowUp' })
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(item('Remove person'))
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(within(personCard('Team Mobile', 'Eli')).getByRole('button', { name: 'Person actions' }))
  })

  it('nabídka skillů: Esc zavře a vrátí fokus na „Add skill“', () => {
    renderEditable(defState())
    openAddSkill('Team Web', 'Hana')
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Product' }))
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
    expect(document.activeElement).toBe(within(personCard('Team Web', 'Hana')).getByRole('button', { name: 'Add skill' }))
  })

  it('otevřená je nejvýš jedna nabídka nebo jedno potvrzení: další předchozí zavře', () => {
    renderEditable(defState())
    openAddSkill('Team Web', 'Hana')
    openPersonActions('Team Web', 'Ivo')
    expect(screen.getAllByRole('menu')).toHaveLength(1)
    expect(menuItems()).toContain('Remove person')

    fireEvent.click(within(teamRow('Team Billing')).getByRole('button', { name: 'Remove Team Billing' }))
    expect(screen.queryByRole('menu')).toBeNull()
    expect(screen.getByText('Remove Team Billing? 4 people will be removed.')).toBeInTheDocument()

    fireEvent.click(within(teamRow('Team Mobile')).getByRole('button', { name: 'Add mandate' }))
    expect(screen.queryByText('Remove Team Billing? 4 people will be removed.')).toBeNull()
    expect(screen.getAllByRole('menu')).toHaveLength(1)
    expect(menuItems()).toEqual(['BIL Billing', 'WEB Web portal'])
  })
})

describe('feat-030 B22: sbalení a rozbalení týmů', () => {
  it('„Expand all“ rozbalí všechny týmy a změní se na „Collapse all“; šipka přepíná jen svůj tým', () => {
    renderEditable(defState())
    for (const name of ['Team Billing', 'Team Mobile', 'Team Web']) expect(chevron(name)).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(within(org()).getByRole('button', { name: 'Expand all' }))
    for (const name of ['Team Billing', 'Team Mobile', 'Team Web']) expect(chevron(name)).toHaveAttribute('aria-expanded', 'true')
    expect(within(org()).getByRole('button', { name: 'Collapse all' })).toBeInTheDocument()

    fireEvent.click(chevron('Team Mobile'))
    expect(chevron('Team Mobile')).toHaveAttribute('aria-expanded', 'false')
    expect(chevron('Team Web')).toHaveAttribute('aria-expanded', 'true')
    expect(within(org()).getByRole('button', { name: 'Expand all' })).toBeInTheDocument()

    fireEvent.click(within(org()).getByRole('button', { name: 'Expand all' }))
    fireEvent.click(within(org()).getByRole('button', { name: 'Collapse all' }))
    for (const name of ['Team Billing', 'Team Mobile', 'Team Web']) expect(chevron(name)).toHaveAttribute('aria-expanded', 'false')
  })

  it('za běhu „Expand all“ rozbalí všechny týmy (pohled nepatří k zamčení)', () => {
    renderView(runUntil(defState(), 0.5))
    fireEvent.click(within(org()).getByRole('button', { name: 'Expand all' }))
    for (const name of ['Team Billing', 'Team Mobile', 'Team Web']) expect(chevron(name)).toHaveAttribute('aria-expanded', 'true')
    expect(within(org()).getAllByTestId('org-person')).toHaveLength(12)
  })
})

describe('feat-030 I1: za běhu nejde organizace upravovat', () => {
  it('za běhu i po doběhnutí: názvy jsou text a chybí všechny ovládací prvky úprav', () => {
    for (const state of [runUntil(defState(), 0.5), runToEnd(defState())]) {
      const { unmount } = renderView(state)
      fireEvent.click(within(org()).getByRole('button', { name: 'Expand all' }))
      const panel = org()
      expect(within(panel).queryAllByRole('textbox', { name: 'Team name' })).toHaveLength(0)
      expect(within(panel).getByText('Team Mobile')).toBeInTheDocument()
      for (const name of ['+ Add team', '+ Add person', 'Person actions', 'Add skill']) {
        expect(within(panel).queryAllByRole('button', { name })).toHaveLength(0)
      }
      expect(within(panel).queryAllByRole('button', { name: /^Remove (Team|skill) / })).toHaveLength(0)
      unmount()
    }
  })
})

describe('feat-030 E6 a D13: tým bez lidí a člověk bez skillů', () => {
  it('E6: prázdný Team 4 s mandátem BIL ukazuje za běhu „0/0“ a ve Working on „—“', () => {
    const setup = orgDef()
    setup.teams.push({ id: 4, name: 'Team 4', mandates: ['BIL'], people: [] })
    renderView(runUntil(makeOrgState(setup, [feat('F-1 (p1): BIL [Java 2]')]), 0.5))
    expect(within(teamRow('Team 4')).getByTestId('org-people-bar')).toHaveTextContent('0/0')
    expect(within(teamRow('Team 4')).getByText('—')).toBeInTheDocument()
    expect(within(teamRow('Team Billing')).getByTestId('org-people-bar')).toHaveTextContent('1/4')
    expect(within(teamRow('Team Billing')).getByRole('button', { name: 'F-001' })).toBeInTheDocument()
  })

  it('D13: Petr bez skillů má před během jen „Add skill“, za běhu šedé „Idle“ bez čipů', () => {
    const setup = orgT()
    team(setup, 'Team Web').people.push({ id: 99, name: 'Petr', skills: [] })
    const { unmount } = renderEditable(stateOf(setup, 'F-1 (p1): WEB [Frontend 3]'))
    const before = personCard('Team Web', 'Petr')
    expect(skillButtons(before)).toEqual([])
    expect(within(before).getByRole('button', { name: 'Add skill' })).toBeInTheDocument()
    unmount()

    renderView(runUntil(stateOf(setup, 'F-1 (p1): WEB [Frontend 3]'), 1))
    const during = personCard('Team Web', 'Petr')
    expect(within(during).getByText('Idle')).toHaveAttribute('data-tone', 'idle')
    expect(within(during).queryByText(/^(Product|Java|Frontend|QA)$/)).toBeNull()
  })
})

describe('feat-030 J4: dlouhé názvy', () => {
  beforeEach(() => {
    // jsdom nepočítá rozložení: text s „Customer Experience“ je širší než prvek, ostatní se vejde (vzor feat-023)
    vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(function (this: Element) {
      const text = this instanceof HTMLInputElement ? this.value : this.textContent ?? ''
      return text.includes('Customer Experience') ? 300 : 50
    })
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(100)
  })

  /** ORG-T s dlouhým názvem Team Web a dlouhým názvem oblasti BIL. */
  function longState(): OrgSimState {
    const setup = orgT()
    team(setup, 'Team Web').name = LONG_TEAM
    setup.areas[0].name = LONG_AREA
    return stateOf(setup, 'F-1 (p1): WEB [Frontend 3]')
  }

  it('před během má pole dlouhého názvu title s plným názvem, krátký název title nemá', () => {
    renderEditable(longState())
    const inputs = within(org()).getAllByRole('textbox', { name: 'Team name' })
    expect(inputs[2]).toHaveAttribute('title', LONG_TEAM)
    expect(inputs[0]).not.toHaveAttribute('title')
  })

  it('nabídka mandátů ukáže dlouhý název oblasti s title', () => {
    renderEditable(longState())
    fireEvent.click(within(rows()[2]).getByRole('button', { name: 'Add mandate' }))
    const item = within(screen.getByRole('menu')).getByRole('menuitem', { name: new RegExp(LONG_AREA) })
    expect(item.querySelector(`[title="${LONG_AREA}"]`) ?? item).toHaveAttribute('title', LONG_AREA)
  })

  it('položka „Move to …“ s dlouhým názvem týmu má title, krátká ne', () => {
    renderEditable(longState())
    openPersonActions('Team Mobile', 'Eli')
    const long = screen.getByRole('menuitem', { name: `Move to ${LONG_TEAM}` })
    expect(long.querySelector(`[title="${LONG_TEAM}"]`) ?? long).toHaveAttribute('title', LONG_TEAM)
    const short = screen.getByRole('menuitem', { name: 'Move to Team Billing' })
    expect(short.querySelector('[title]')).toBeNull()
    expect(short).not.toHaveAttribute('title')
  })

  it('za běhu má zkrácený název týmu title s plným názvem, krátký ne', () => {
    renderView(runUntil(longState(), 0.5))
    expect(within(org()).getByText(LONG_TEAM)).toHaveAttribute('title', LONG_TEAM)
    expect(within(org()).getByText('Team Billing')).not.toHaveAttribute('title')
  })
})

// Opravy z code review (fáze 6, 2026-11-20): sbalení týmu zavře jeho nabídku, fokus po odebrání a přesunu zůstane
// v panelu, „Add skill“ bez chybějících skillů neohlašuje menu.
describe('feat-030 review: nabídky po sbalení, fokus a ohlášení menu', () => {
  it('sbalení týmu zavře nabídku skillu jeho člověka; po rozbalení se sama neotevře', () => {
    renderEditable(defState())
    openAddSkill('Team Web', 'Hana')
    expect(screen.getByRole('menu')).toBeInTheDocument()
    fireEvent.click(chevron('Team Web'))
    fireEvent.click(chevron('Team Web'))
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('Collapse all zavře nabídku akcí člověka', () => {
    renderEditable(defState())
    fireEvent.click(within(org()).getByRole('button', { name: 'Expand all' }))
    openPersonActions('Team Mobile', 'Eli')
    fireEvent.click(within(org()).getByRole('button', { name: 'Collapse all' }))
    fireEvent.click(within(org()).getByRole('button', { name: 'Expand all' }))
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('sbalení jiného týmu nabídku nechá otevřenou', () => {
    renderEditable(defState())
    people('Team Billing')
    openAddSkill('Team Web', 'Hana')
    fireEvent.click(chevron('Team Billing'))
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('po odebrání týmu je fokus v názvu dalšího týmu, u posledního v názvu předchozího (bez označení textu)', () => {
    renderEditable(defState())
    fireEvent.click(within(teamRow('Team Mobile')).getByRole('button', { name: 'Remove Team Mobile' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    const web = nameInput(teamRow('Team Web'))
    expect(document.activeElement).toBe(web)
    if (web instanceof HTMLInputElement) expect(web.selectionStart).toBe(web.selectionEnd)

    fireEvent.click(within(teamRow('Team Web')).getByRole('button', { name: 'Remove Team Web' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(document.activeElement).toBe(nameInput(teamRow('Team Billing')))
  })

  it('po odebrání posledního týmu je fokus na „+ Add team“', () => {
    renderEditable(makeOrgState(orgB(), [feat('F-1: BIL [Java 1]')]))
    fireEvent.click(within(teamRow('Team Billing')).getByRole('button', { name: 'Remove Team Billing' }))
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(document.activeElement).toBe(within(org()).getByRole('button', { name: '+ Add team' }))
  })

  it('po odebrání i po přesunu člověka je fokus na „+ Add person“ jeho původního týmu', () => {
    renderEditable(defState())
    openPersonActions('Team Web', 'Ivo')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Remove person' }))
    expect(document.activeElement).toBe(within(teamRow('Team Web')).getByRole('button', { name: '+ Add person' }))

    openPersonActions('Team Mobile', 'Eli')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move to Team Web' }))
    expect(document.activeElement).toBe(within(teamRow('Team Mobile')).getByRole('button', { name: '+ Add person' }))
  })

  it('„Add skill“ u člověka se všemi skilly neohlašuje menu a text „Has every skill“ je stavová zpráva', () => {
    renderEditable(defState())
    const before = within(personCard('Team Web', 'Hana')).getByRole('button', { name: 'Add skill' })
    expect(before).toHaveAttribute('aria-haspopup', 'menu')
    addSkill('Team Web', 'Hana', 'Java')
    addSkill('Team Web', 'Hana', 'Product')
    addSkill('Team Web', 'Hana', 'QA')
    const button = within(personCard('Team Web', 'Hana')).getByRole('button', { name: 'Add skill' })
    expect(button).not.toHaveAttribute('aria-haspopup')
    expect(button).not.toHaveAttribute('aria-expanded')
    fireEvent.click(button)
    expect(screen.getByRole('status')).toHaveTextContent('Has every skill')
  })
})
