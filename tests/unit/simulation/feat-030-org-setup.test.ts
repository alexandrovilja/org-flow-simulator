import { describe, it, expect } from 'vitest'
import {
  addPerson, addPersonSkill, addTeam, movePerson, removePerson, removePersonSkill, removeTeam, renameTeam,
} from '@/simulation/organizationSetup'
import type { OrgSetup } from '@/types/organization'
import { makeSetup, orgDef, orgT, person, team } from './feat028Fixtures'

// feat-030 (Úpravy týmů a lidí, mód Organization inkrement 3) — čisté úpravy organizace před během.
//
// Schválený kontrakt (spec features/feat-030-upravy-tymu-a-lidi.md, Pravidla chování a Technical Notes; analýza B6–B11):
//  - Funkce v `src/simulation/organizationSetup.ts` vrací novou organizaci a vstup nemění (jako addMandate):
//    • `renameTeam(setup, teamId, name)` — ořízne okolní mezery; prázdný název (i jen z mezer) nechá původní;
//      shodné názvy více týmů jsou povolené (R6),
//    • `addTeam(setup)` → `{ setup, teamId }` — na konec přidá tým „Team N“ bez lidí a bez mandátu; N = počet týmů
//      po přidání, při shodě s existujícím názvem se N zvyšuje; id = největší id týmu + 1,
//    • `removeTeam(setup, teamId)` — odebere tým i s lidmi,
//    • `addPerson(setup, teamId)` — na konec týmu přidá „Person N“ bez skillů; N = počet lidí v organizaci po přidání,
//      při shodě se N zvyšuje; id = největší id člověka v organizaci + 1,
//    • `removePerson(setup, personId)`,
//    • `movePerson(setup, personId, toTeamId)` — člověk se přesune na konec cílového týmu i se skilly; přesun do
//      vlastního týmu nic nezmění,
//    • `addPersonSkill(setup, personId, role)` — skill na konec, bez duplicit; `removePersonSkill(setup, personId, role)`.
//  AI na skillu (aiBySkill) přidá feat-035, proto se tu nepřesouvá.

/** Názvy týmů v pořadí panelu. */
const teamNames = (setup: OrgSetup) => setup.teams.map(t => t.name)

/** Jména lidí týmu v pořadí panelu. */
const peopleOf = (setup: OrgSetup, teamName: string) => team(setup, teamName).people.map(p => p.name)

/** Hluboká kopie organizace pro kontrolu, že se vstup nezměnil. */
const snapshot = (setup: OrgSetup) => JSON.parse(JSON.stringify(setup)) as unknown

describe('feat-030 B6–B7: přejmenování týmu', () => {
  it('B6: „  Mobile Apple “ → „Mobile Apple“ (okolní mezery se ořežou); vstup se nemění', () => {
    const setup = orgDef()
    const before = snapshot(setup)
    const next = renameTeam(setup, team(setup, 'Team Mobile').id, '  Mobile Apple ')
    expect(teamNames(next)).toEqual(['Team Billing', 'Mobile Apple', 'Team Web'])
    expect(snapshot(setup)).toEqual(before)
  })

  it('B7: prázdný název a název jen z mezer nechají původní', () => {
    const setup = orgDef()
    const id = team(setup, 'Team Web').id
    expect(teamNames(renameTeam(setup, id, ''))).toEqual(['Team Billing', 'Team Mobile', 'Team Web'])
    expect(teamNames(renameTeam(setup, id, '   '))).toEqual(['Team Billing', 'Team Mobile', 'Team Web'])
  })

  it('B7: shodný název s jiným týmem se uloží (R6)', () => {
    const setup = orgDef()
    const next = renameTeam(setup, team(setup, 'Team Web').id, 'Team Mobile')
    expect(teamNames(next)).toEqual(['Team Billing', 'Team Mobile', 'Team Mobile'])
  })

  it('mandáty a lidé přejmenovaného týmu zůstanou', () => {
    const setup = orgDef()
    const next = renameTeam(setup, team(setup, 'Team Mobile').id, 'Mobile Apple')
    expect(team(next, 'Mobile Apple').mandates).toEqual(['MOB'])
    expect(peopleOf(next, 'Mobile Apple')).toEqual(['Dani', 'Emil', 'Eli', 'Fae'])
  })
})

describe('feat-030 B8: přidání a odebrání týmu', () => {
  it('addTeam přidá na konec „Team 4“ bez lidí a bez mandátu s id 4; vstup se nemění', () => {
    const setup = orgDef()
    const before = snapshot(setup)
    const { setup: next, teamId } = addTeam(setup)
    expect(teamNames(next)).toEqual(['Team Billing', 'Team Mobile', 'Team Web', 'Team 4'])
    expect(teamId).toBe(4)
    expect(next.teams[3]).toEqual({ id: 4, name: 'Team 4', mandates: [], people: [] })
    expect(snapshot(setup)).toEqual(before)
  })

  it('N je počet týmů po přidání: po odebrání Team Web dostane nový tým název „Team 3“', () => {
    const setup = removeTeam(orgDef(), 3)
    expect(teamNames(addTeam(setup).setup)).toEqual(['Team Billing', 'Team Mobile', 'Team 3'])
  })

  it('když už tým „Team 4“ existuje, nový tým dostane „Team 5“', () => {
    const setup = orgDef()
    const renamed = renameTeam(setup, team(setup, 'Team Web').id, 'Team 4')
    const { setup: next, teamId } = addTeam(renamed)
    expect(teamNames(next)).toEqual(['Team Billing', 'Team Mobile', 'Team 4', 'Team 5'])
    expect(teamId).toBe(4)
  })

  it('id nového týmu je největší id + 1, i když týmy nejsou seřazené podle id', () => {
    const setup = orgDef()
    setup.teams = [setup.teams[2], setup.teams[0]]
    expect(addTeam(setup).teamId).toBe(4)
  })

  it('removeTeam odebere tým i s lidmi; ostatní týmy zůstanou; vstup se nemění', () => {
    const setup = orgDef()
    const before = snapshot(setup)
    const next = removeTeam(setup, team(setup, 'Team Web').id)
    expect(teamNames(next)).toEqual(['Team Billing', 'Team Mobile'])
    expect(next.teams.flatMap(t => t.people).map(p => p.name)).not.toContain('Hana')
    expect(peopleOf(next, 'Team Mobile')).toEqual(['Dani', 'Emil', 'Eli', 'Fae'])
    expect(snapshot(setup)).toEqual(before)
  })

  it('odebrat jde i poslední tým', () => {
    const setup = makeSetup([['Team Solo', ['BIL'], [['Ada', ['Product']]]]])
    expect(removeTeam(setup, 1).teams).toEqual([])
  })
})

describe('feat-030 B9: přidání a odebrání člověka', () => {
  it('addPerson přidá na konec Team Web „Person 13“ bez skillů s id 13; vstup se nemění', () => {
    const setup = orgDef()
    const before = snapshot(setup)
    const next = addPerson(setup, team(setup, 'Team Web').id)
    expect(peopleOf(next, 'Team Web')).toEqual(['Gus', 'Hugo', 'Hana', 'Ivo', 'Person 13'])
    expect(person(next, 'Person 13')).toEqual({ id: 13, name: 'Person 13', skills: [] })
    expect(snapshot(setup)).toEqual(before)
  })

  it('N je počet lidí v celé organizaci po přidání: ORG-T (9 lidí) → „Person 10“, potom „Person 11“', () => {
    const setup = orgT()
    const once = addPerson(setup, team(setup, 'Team Billing').id)
    const twice = addPerson(once, team(once, 'Team Mobile').id)
    expect(peopleOf(twice, 'Team Billing')).toEqual(['Ada', 'Ben', 'Chen', 'Person 10'])
    expect(peopleOf(twice, 'Team Mobile')).toEqual(['Dani', 'Eli', 'Fae', 'Person 11'])
  })

  it('při shodě jména se N zvyšuje: po odebrání Person 10 dostane další člověk „Person 12“', () => {
    let setup = orgT()
    setup = addPerson(setup, team(setup, 'Team Web').id)
    setup = addPerson(setup, team(setup, 'Team Web').id)
    setup = removePerson(setup, person(setup, 'Person 10').id)
    setup = addPerson(setup, team(setup, 'Team Web').id)
    expect(peopleOf(setup, 'Team Web')).toEqual(['Gus', 'Hana', 'Ivo', 'Person 11', 'Person 12'])
  })

  it('id nového člověka je největší id v organizaci + 1 (jedinečné napříč týmy)', () => {
    const setup = orgDef()
    const next = addPerson(setup, team(setup, 'Team Billing').id)
    const ids = next.teams.flatMap(t => t.people.map(p => p.id))
    expect(new Set(ids).size).toBe(ids.length)
    expect(person(next, 'Person 13').id).toBe(13)
  })

  it('removePerson odebere člověka z organizace; vstup se nemění', () => {
    const setup = orgDef()
    const before = snapshot(setup)
    const next = removePerson(setup, person(setup, 'Hana').id)
    expect(peopleOf(next, 'Team Web')).toEqual(['Gus', 'Hugo', 'Ivo'])
    expect(snapshot(setup)).toEqual(before)
  })
})

describe('feat-030 B10: skilly člověka', () => {
  it('addPersonSkill přidá skill na konec: Hana Frontend + Java → [Frontend, Java]; vstup se nemění', () => {
    const setup = orgDef()
    const before = snapshot(setup)
    const next = addPersonSkill(setup, person(setup, 'Hana').id, 'Java')
    expect(person(next, 'Hana').skills).toEqual(['Frontend', 'Java'])
    expect(snapshot(setup)).toEqual(before)
  })

  it('skill, který člověk už má, se nepřidá podruhé', () => {
    const setup = orgDef()
    expect(person(addPersonSkill(setup, person(setup, 'Hana').id, 'Frontend'), 'Hana').skills).toEqual(['Frontend'])
  })

  it('removePersonSkill skill odebere a ostatní nechá v pořadí; člověk může zůstat bez skillů', () => {
    let setup = orgDef()
    const hana = person(setup, 'Hana').id
    setup = addPersonSkill(addPersonSkill(setup, hana, 'Java'), hana, 'QA')
    expect(person(removePersonSkill(setup, hana, 'Java'), 'Hana').skills).toEqual(['Frontend', 'QA'])
    const chen = person(setup, 'Chen').id
    expect(person(removePersonSkill(setup, chen, 'QA'), 'Chen').skills).toEqual([])
  })
})

describe('feat-030 B11: přesun člověka do jiného týmu', () => {
  it('Eli je posledním členem Team Web i se skillem Frontend; Team Mobile má 2 lidi; vstup se nemění', () => {
    const setup = orgT()
    const before = snapshot(setup)
    const moved = movePerson(setup, person(setup, 'Eli').id, team(setup, 'Team Web').id)
    expect(peopleOf(moved, 'Team Web')).toEqual(['Gus', 'Hana', 'Ivo', 'Eli'])
    expect(peopleOf(moved, 'Team Mobile')).toEqual(['Dani', 'Fae'])
    expect(person(moved, 'Eli')).toEqual({ id: person(setup, 'Eli').id, name: 'Eli', skills: ['Frontend'] })
    expect(snapshot(setup)).toEqual(before)
  })

  it('přesun do vlastního týmu pořadí nezmění', () => {
    const setup = orgT()
    const same = movePerson(setup, person(setup, 'Eli').id, team(setup, 'Team Mobile').id)
    expect(peopleOf(same, 'Team Mobile')).toEqual(['Dani', 'Eli', 'Fae'])
  })

  it('mandáty týmů se přesunem nemění', () => {
    const setup = orgT()
    const moved = movePerson(setup, person(setup, 'Eli').id, team(setup, 'Team Web').id)
    expect(moved.teams.map(t => t.mandates)).toEqual([['BIL'], ['MOB'], ['WEB']])
  })
})
