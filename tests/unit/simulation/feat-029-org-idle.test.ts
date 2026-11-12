import { describe, it, expect } from 'vitest'
import { mulberry32 } from '@/simulation/engine'
import {
  DEFAULT_ORG_BACKLOG_SETTINGS,
  generateOrgBacklog,
  makeOrgState,
  orgMetrics,
  orgPersonStatus,
  orgTaskStatus,
  resetOrgState,
  snapshotOrgRun,
  tickOrg,
} from '@/simulation/organizationEngine'
import type { OrgSetup, OrgSimState } from '@/types/organization'
import { featureOf, grant, makeSetup, orgT, person, runToEnd, runUntil, stateOf, taskOf, team } from './feat028Fixtures'

// feat-029 (Proč práce čeká, mód Organization inkrement 2) — engine: Idle Time, waiting a žlutý idle.
//
// Schválený kontrakt (spec features/feat-029-proc-prace-ceka.md, „Pravidla chování“; testovací analýza
// docs/feat-028-test-analysis.md, R1, R2, scénáře E1–E5, J1 a části D2, D3, D5, D10, D11 a I3 o Idle Time):
//  - `state.idleByPerson[personId]`: idle čas člověka v pracovních dnech. Roste, když člověk nepracuje na žádném úkolu
//    a kdekoli v backlogu nebo v rozpracovaných featurách existuje nepřidělený úkol s některým z jeho skillů, bez ohledu
//    na fázi a mandát (R1). Chybějící klíč znamená 0.
//  - `orgMetrics(state).idleTime`: součet idle času všech lidí (person-days).
//  - `orgTaskStatus(state, feature, task)`: 'done' | 'doing' | 'todo' | 'waiting'. Waiting = nepřidělený úkol rozpracované
//    featury s odemčenou fází, pro který existuje idle člověk se skillem úkolu, jehož tým nemá mandát na oblast (R2).
//  - `orgPersonStatus(state, personId)`: { kind: 'working', featureId, taskId } | { kind: 'idle' } |
//    { kind: 'blocked', areas }. Blocked = žlutý idle: existuje nepřidělený úkol s jeho skillem a odemčenou fází
//    v oblasti mimo mandát jeho týmu, v backlogu i v rozpracovaných featurách; `areas` jsou kódy těch oblastí
//    v pořadí oblastí (R2).
//  - `resetOrgState(state)` vynuluje idle čas; `snapshotOrgRun(state).idleTime` nese Idle Time doběhnutého běhu.
//
// Časy se porovnávají s tolerancí ±0.05 dne (toBeCloseTo(x, 1)), krok simulace je 0.01 dne.

/** Id člověka podle jména. */
const pid = (setup: OrgSetup, name: string) => person(setup, name).id

/** Idle čas člověka podle jména (chybějící klíč = 0). */
const idleOf = (s: OrgSimState, name: string) => s.idleByPerson[pid(s.setup, name)] ?? 0

/** Všechny úkoly rozpracovaných featur, které jsou právě waiting, jako „F-2 WEB Frontend“. */
const waitingTasks = (s: OrgSimState) =>
  s.inProgress.flatMap(f => f.tasks.filter(t => orgTaskStatus(s, f, t) === 'waiting').map(t => `F-${f.id} ${t.area} ${t.role}`))

/** ORG-T, kde Team Mobile má mandáty MOB a WEB. */
const orgTMobileWeb = () => grant(orgT(), 'Team Mobile', 'WEB')

/** Data D2 (Umí, ale nesmí). */
const D2 = ['F-1 (p1): BIL [Java 1] | WEB [Frontend 3]', 'F-2 (p2): BIL [Java 1] | WEB [Frontend 3]']

/** Data D6 (Fáze v rámci oblasti). */
const D6 = 'F-1 (p1): BIL [Product 2 · Java 3 · QA 2] | MOB [Frontend 3 · QA 1]'

describe('feat-029 R1: Idle Time v datech inkrementu 1 (spec Příklad 5)', () => {
  it('D2: Idle Time 4.0 — Eli 3.0, Gus 1.0, ostatní 0', () => {
    const s = runToEnd(stateOf(orgT(), ...D2))
    expect(orgMetrics(s).idleTime).toBeCloseTo(4, 1)
    expect(idleOf(s, 'Eli')).toBeCloseTo(3, 1)
    expect(idleOf(s, 'Gus')).toBeCloseTo(1, 1)
    for (const name of ['Ada', 'Ben', 'Chen', 'Dani', 'Fae', 'Hana', 'Ivo']) expect(idleOf(s, name)).toBeCloseTo(0, 1)
  })

  it('D3 (Team Mobile má i WEB): Idle Time 1.0 — jen Gus', () => {
    const s = runToEnd(stateOf(orgTMobileWeb(), ...D2))
    expect(orgMetrics(s).idleTime).toBeCloseTo(1, 1)
    expect(idleOf(s, 'Gus')).toBeCloseTo(1, 1)
  })

  it('D5: Idle Time 2.0 — Ben (Java čeká v backlogu, Team Billing nemá mandát na WEB)', () => {
    const s = runToEnd(stateOf(orgT(), 'F-1 (p1): WEB [Product 2]', 'F-2 (p2): WEB [Java 2]'))
    expect(orgMetrics(s).idleTime).toBeCloseTo(2, 1)
    expect(idleOf(s, 'Ben')).toBeCloseTo(2, 1)
  })

  it('D10 (Team Mobile má i WEB): Idle Time 2.0 — Hana', () => {
    const s = runToEnd(stateOf(orgTMobileWeb(), 'F-1 (p1): WEB [Frontend 2]', 'F-2 (p2): MOB [Frontend 2]'))
    expect(orgMetrics(s).idleTime).toBeCloseTo(2, 1)
    expect(idleOf(s, 'Hana')).toBeCloseTo(2, 1)
  })

  it('D11 (Hugo Frontend za Hanou): Idle Time 0.0', () => {
    const setup = orgT()
    team(setup, 'Team Web').people.splice(2, 0, { id: 99, name: 'Hugo', skills: ['Frontend'] })
    const s = runToEnd(stateOf(setup, 'F-1 (p1): WEB [Frontend 2]'))
    expect(orgMetrics(s).idleTime).toBeCloseTo(0, 1)
  })
})

describe('feat-029 E3–E4: výpočet Idle Time (spec Příklad 3)', () => {
  it('E3: D6 do konce — 18.0 person-days: Ben 2, Gus 2, Chen 5, Fae 4, Ivo 5, ostatní 0', () => {
    const s = runToEnd(stateOf(orgT(), D6))
    expect(orgMetrics(s).idleTime).toBeCloseTo(18, 1)
    const expected: Record<string, number> = { Ben: 2, Gus: 2, Chen: 5, Fae: 4, Ivo: 5, Ada: 0, Dani: 0, Eli: 0, Hana: 0 }
    for (const [name, idle] of Object.entries(expected)) expect(idleOf(s, name)).toBeCloseTo(idle, 1)
  })

  it('E4: D1 — Eli je celou dobu bez úkolu, ale jeho idle čas je 0.0 (Frontend od začátku dělá Hana)', () => {
    const s = runToEnd(stateOf(orgT(), 'F-1 (p1): WEB [Frontend 3]'))
    expect(idleOf(s, 'Eli')).toBeCloseTo(0, 1)
    expect(orgMetrics(s).idleTime).toBeCloseTo(0, 1)
  })

  it('před během je Idle Time 0', () => {
    expect(orgMetrics(stateOf(orgT(), D6)).idleTime).toBe(0)
  })
})

describe('feat-029 E1: waiting a žlutý idle (spec Příklad 1)', () => {
  it('v čase 1.5 je Frontend ve F-2 waiting, Java ve F-2 rozpracovaná, Java ve F-1 hotová, Frontend ve F-1 rozpracovaný', () => {
    const s = runUntil(stateOf(orgT(), ...D2), 1.5)
    const f1 = featureOf(s, 1)
    const f2 = featureOf(s, 2)
    expect(orgTaskStatus(s, f2, taskOf(s, 2, 'WEB', 'Frontend'))).toBe('waiting')
    expect(orgTaskStatus(s, f2, taskOf(s, 2, 'BIL', 'Java'))).toBe('doing')
    expect(orgTaskStatus(s, f1, taskOf(s, 1, 'BIL', 'Java'))).toBe('done')
    expect(orgTaskStatus(s, f1, taskOf(s, 1, 'WEB', 'Frontend'))).toBe('doing')
    expect(waitingTasks(s)).toEqual(['F-2 WEB Frontend'])
  })

  it('v čase 1.5 má Eli žlutý idle kvůli WEB; Ada, Chen, Dani, Fae, Gus a Ivo obyčejný idle; Ben a Hana pracují', () => {
    const s = runUntil(stateOf(orgT(), ...D2), 1.5)
    expect(orgPersonStatus(s, pid(s.setup, 'Eli'))).toEqual({ kind: 'blocked', areas: ['WEB'] })
    for (const name of ['Ada', 'Chen', 'Dani', 'Fae', 'Gus', 'Ivo']) {
      expect(orgPersonStatus(s, pid(s.setup, name))).toEqual({ kind: 'idle' })
    }
    expect(orgPersonStatus(s, pid(s.setup, 'Ben'))).toEqual({ kind: 'working', featureId: 2, taskId: taskOf(s, 2, 'BIL', 'Java').id })
    expect(orgPersonStatus(s, pid(s.setup, 'Hana'))).toEqual({ kind: 'working', featureId: 1, taskId: taskOf(s, 1, 'WEB', 'Frontend').id })
  })

  it('v čase 1.5 je Idle Time 2.5 (Eli 1.5, Gus 1.0)', () => {
    const s = runUntil(stateOf(orgT(), ...D2), 1.5)
    expect(orgMetrics(s).idleTime).toBeCloseTo(2.5, 1)
    expect(idleOf(s, 'Eli')).toBeCloseTo(1.5, 1)
    expect(idleOf(s, 'Gus')).toBeCloseTo(1, 1)
  })

  it('na hranici úkolu (čas 3.0) už Hana pracuje na F-2 a nic nečeká — žádné probliknutí waiting', () => {
    // Hana dokončí Frontend ve F-1 přesně v 3.0; další úkol dostane ještě v témže kroku (spec, Technical Notes)
    const s = runUntil(stateOf(orgT(), ...D2), 3)
    expect(orgPersonStatus(s, pid(s.setup, 'Hana'))).toEqual({ kind: 'working', featureId: 2, taskId: taskOf(s, 2, 'WEB', 'Frontend').id })
    expect(waitingTasks(s)).toEqual([])
    expect(orgPersonStatus(s, pid(s.setup, 'Eli'))).toEqual({ kind: 'idle' })
    // Čísla se tím nemění: F-2 Frontend začne v 3.0 a Idle Time je 4.0 jako bez přidělení na konci kroku
    expect(taskOf(s, 2, 'WEB', 'Frontend').segments[0].from).toBeCloseTo(3, 1)
    expect(orgMetrics(s).idleTime).toBeCloseTo(4, 1)
  })

  it('v čase 4.0 nic nečeká, Eli má obyčejný idle a Idle Time je 4.0', () => {
    const s = runUntil(stateOf(orgT(), ...D2), 4)
    expect(waitingTasks(s)).toEqual([])
    expect(orgPersonStatus(s, pid(s.setup, 'Eli'))).toEqual({ kind: 'idle' })
    expect(orgMetrics(s).idleTime).toBeCloseTo(4, 1)
  })
})

describe('feat-029 E2: úkol zamčený fází není waiting (spec Příklad 2)', () => {
  it('D6 v 1.0: Java a QA v BIL i QA v MOB jsou „todo“; Ben, Gus, Chen, Fae i Ivo mají obyčejný idle', () => {
    const s = runUntil(stateOf(orgT(), D6), 1)
    const f = featureOf(s, 1)
    for (const [area, role] of [['BIL', 'Java'], ['BIL', 'QA'], ['MOB', 'QA']]) {
      expect(orgTaskStatus(s, f, taskOf(s, 1, area, role))).toBe('todo')
    }
    // Gus by Javu v BIL uměl a Team Web na BIL mandát nemá, ale Java čeká na Product → není to žlutý idle
    for (const name of ['Ben', 'Gus', 'Chen', 'Fae', 'Ivo']) expect(orgPersonStatus(s, pid(s.setup, name))).toEqual({ kind: 'idle' })
  })

  it('úkol featury v backlogu není nikdy waiting', () => {
    // D10 v 1.0: F-2 (MOB Frontend) je v backlogu a Hana (Team Web bez MOB) je idle
    const s = runUntil(stateOf(orgTMobileWeb(), 'F-1 (p1): WEB [Frontend 2]', 'F-2 (p2): MOB [Frontend 2]'), 1)
    const f2 = featureOf(s, 2)
    expect(f2.status).toBe('backlog')
    expect(orgTaskStatus(s, f2, taskOf(s, 2, 'MOB', 'Frontend'))).toBe('todo')
  })
})

describe('feat-029 E5: žlutý idle i kvůli práci v backlogu (spec Příklad 4)', () => {
  it('D10 v 1.0: Hana má žlutý idle kvůli MOB, rozpracovaná je jen F-1 a nic není waiting; Idle Time 1.0', () => {
    const s = runUntil(stateOf(orgTMobileWeb(), 'F-1 (p1): WEB [Frontend 2]', 'F-2 (p2): MOB [Frontend 2]'), 1)
    expect(orgPersonStatus(s, pid(s.setup, 'Hana'))).toEqual({ kind: 'blocked', areas: ['MOB'] })
    expect(s.inProgress.map(f => f.id)).toEqual([1])
    expect(waitingTasks(s)).toEqual([])
    expect(orgMetrics(s).idleTime).toBeCloseTo(1, 1)
  })
})

describe('feat-029 R2: waiting s více idle lidmi z různých týmů', () => {
  it('QA ve F-2 (BIL) čeká na Chena; Fae a Ivo mají žlutý idle kvůli BIL', () => {
    // F-2 začne v 0.0 díky Frontendu v MOB (Eli); QA v BIL drží Chen na F-1
    const s = runUntil(stateOf(orgT(), 'F-1 (p1): BIL [QA 2]', 'F-2 (p2): BIL [QA 2] | MOB [Frontend 1]'), 0.5)
    expect(waitingTasks(s)).toEqual(['F-2 BIL QA'])
    expect(orgPersonStatus(s, pid(s.setup, 'Fae'))).toEqual({ kind: 'blocked', areas: ['BIL'] })
    expect(orgPersonStatus(s, pid(s.setup, 'Ivo'))).toEqual({ kind: 'blocked', areas: ['BIL'] })
    expect(orgMetrics(s).idleTime).toBeCloseTo(1, 1)
  })

  it('žlutý idle vypíše všechny oblasti mimo mandát v pořadí oblastí, ne v pořadí úkolů featury', () => {
    // Chen a Fae drží QA ve F-1. Ve F-2 čeká QA v MOB a v BIL (mimo mandát Team Web); QA ve WEB je zamčená fází
    const s = runUntil(stateOf(orgT(),
      'F-1 (p1): BIL [QA 3] | MOB [QA 3]',
      'F-2 (p2): MOB [QA 1] | BIL [QA 1] | WEB [Product 2 · QA 1]'), 0.5)
    expect(orgPersonStatus(s, pid(s.setup, 'Ivo'))).toEqual({ kind: 'blocked', areas: ['BIL', 'MOB'] })
    expect(waitingTasks(s)).toEqual(['F-2 MOB QA', 'F-2 BIL QA'])
    expect(orgTaskStatus(s, featureOf(s, 2), taskOf(s, 2, 'WEB', 'QA'))).toBe('todo')
  })
})

describe('feat-029 J1: jeden tým se vším', () => {
  it('výchozí backlog (seed 42): žádný úkol není nikdy waiting a nikdo nemá žlutý idle', () => {
    const setup = makeSetup([['Team All', ['BIL', 'MOB', 'WEB'],
      [['Ada', ['Product']], ['Ben', ['Java']], ['Cyril', ['Frontend']], ['Chen', ['QA']]]]])
    const s = makeOrgState(setup, generateOrgBacklog(mulberry32(42), DEFAULT_ORG_BACKLOG_SETTINGS, setup))
    const ids = setup.teams[0].people.map(p => p.id)
    let steps = 0
    while (!s.finished) {
      tickOrg(s, 0.1, 'reduce-wip')
      expect(waitingTasks(s)).toEqual([])
      for (const id of ids) expect(orgPersonStatus(s, id).kind).not.toBe('blocked')
      steps++
      if (steps > 20_000) throw new Error('Běh nedoběhl')
    }
  })
})

describe('feat-029 I3: Reset a snapshot s Idle Time', () => {
  it('Reset vynuluje idle čas všech lidí a Idle Time', () => {
    const s = resetOrgState(runToEnd(stateOf(orgT(), ...D2)))
    expect(orgMetrics(s).idleTime).toBe(0)
    for (const p of s.setup.teams.flatMap(t => t.people)) expect(s.idleByPerson[p.id] ?? 0).toBe(0)
  })

  it('snapshot doběhnutého běhu nese Idle Time (D2: 4.0)', () => {
    const s = runToEnd(stateOf(orgT(), ...D2))
    expect(snapshotOrgRun(s).idleTime).toBeCloseTo(4, 1)
    expect(snapshotOrgRun(s).idleTime).toBeCloseTo(orgMetrics(s).idleTime, 5)
  })

  it('druhý běh po Resetu počítá Idle Time od nuly (D2 → Reset → Team Mobile s WEB → 1.0)', () => {
    const s = resetOrgState(runToEnd(stateOf(orgT(), ...D2)))
    s.setup = grant(structuredClone(s.setup), 'Team Mobile', 'WEB')
    expect(orgMetrics(runToEnd(s)).idleTime).toBeCloseTo(1, 1)
  })
})
