import { describe, it, expect } from 'vitest'
import { orgMetrics, resetOrgState, snapshotOrgRun } from '@/simulation/organizationEngine'
import type { OrgSimState } from '@/types/organization'
import { featureOf, grant, makeSetup, orgB, orgT, runToEnd, segmentsOf, stateOf, taskOf, team } from './feat028Fixtures'

// feat-028 inkrement 1 (Mandáty a tok práce) — engine módu Organization: přidělování práce, metriky, Reset.
//
// Schválený kontrakt (spec features/feat-028-tymy-slozene-z-lidi.md, „Pravidla chování“; testovací analýza
// docs/feat-028-test-analysis.md, scénáře D1–D7, D10, D11, D14, F1–F3, I3, J2, J11):
//  - `makeOrgState(setup, backlog)` → stav před během; `tickOrg(state, dt, 'reduce-wip')` posune běh o `dt` pracovních
//    dní (smí stav měnit na místě a vrací ho). Engine je deterministický (bez náhody).
//  - Úkol smí vzít člověk se skillem úkolu, jehož tým má mandát na oblast úkolu; člověk pracuje na jednom úkolu.
//  - Pořadí přidělování v jednom okamžiku: týmy shora dolů, lidé v týmu shora dolů; ve featuře úkoly v pořadí oblastí
//    a úkolů; vyšší priorita (nižší číslo) má přednost.
//  - Fáze platí v rámci oblasti: úkol fáze N čeká jen na nižší fáze v téže oblasti téže featury (R8); engine zvládne
//    fáze až do 10.
//  - Reduce WIP: rozpracované featury před backlogem.
//  - Úkol si vede úseky práce `segments` (od, do, člověk, tým); featura `startedAt` (první přidělení) a `finishedAt`.
//  - `orgMetrics(state)`: totalTime, avgCycleTime (null bez hotových featur), avgWip (null v čase 0), doneCount.
//  - `resetOrgState(state)` vrátí backlog do stavu před během a nechá organizaci; `snapshotOrgRun(state)` uloží
//    doběhnutý běh pro srovnání (totalTime, avgCycleTime, avgWip).
// Idle Time (feat-029), Min units (feat-032), výnosy (feat-033), timeline (feat-034) a AI (feat-035) přijdou později.
//
// Časy se porovnávají s tolerancí ±0.05 dne (toBeCloseTo(x, 1)), krok simulace je 0.01 dne.

/** Shodný úsek práce `[jméno, od, do]` s tolerancí ±0.05 dne. */
function expectSegments(actual: Array<[string, number, number | null]>, expected: Array<[string, number, number]>): void {
  expect(actual.map(s => s[0])).toEqual(expected.map(s => s[0]))
  actual.forEach(([, from, to], i) => {
    expect(from).toBeCloseTo(expected[i][1], 1)
    expect(to).not.toBeNull()
    expect(to as number).toBeCloseTo(expected[i][2], 1)
  })
}

/** Cycle time hotové featury. */
function cycleOf(state: OrgSimState, id: number): number {
  const f = featureOf(state, id)
  expect(f.finishedAt).not.toBeNull()
  expect(f.startedAt).not.toBeNull()
  return (f.finishedAt as number) - (f.startedAt as number)
}

/** ORG-T, kde Team Mobile má mandáty MOB a WEB. */
const orgTMobileWeb = () => grant(orgT(), 'Team Mobile', 'WEB')

/** D7: ORG-B, Reduce WIP. */
const d7 = () => stateOf(orgB(), 'F-1 (p1): BIL [QA 3]', 'F-2 (p3): BIL [Java 1 · QA 1]', 'F-3 (p2): BIL [QA 1]')

describe('feat-028 D1: skill a mandát', () => {
  it('Frontend ve WEB zpracuje Hana 0.0–3.0, Eli (Team Mobile bez mandátu na WEB) nedostane úkol', () => {
    const s = runToEnd(stateOf(orgT(), 'F-1 (p1): WEB [Frontend 3]'))
    expectSegments(segmentsOf(s, taskOf(s, 1, 'WEB', 'Frontend')), [['Hana', 0, 3]])
    expect(cycleOf(s, 1)).toBeCloseTo(3, 1)
  })

  it('úsek práce nese i tým člověka', () => {
    const s = runToEnd(stateOf(orgT(), 'F-1 (p1): WEB [Frontend 3]'))
    expect(taskOf(s, 1, 'WEB', 'Frontend').segments[0].teamId).toBe(team(s.setup, 'Team Web').id)
  })
})

describe('feat-028 D2: umí, ale nesmí', () => {
  const run = () => runToEnd(stateOf(orgT(),
    'F-1 (p1): BIL [Java 1] | WEB [Frontend 3]',
    'F-2 (p2): BIL [Java 1] | WEB [Frontend 3]'))

  it('Ben dělá Java F-1 a F-2 za sebou, Hana Frontend F-1 a pak F-2; Eli Frontend nevezme', () => {
    const s = run()
    expectSegments(segmentsOf(s, taskOf(s, 1, 'BIL', 'Java')), [['Ben', 0, 1]])
    expectSegments(segmentsOf(s, taskOf(s, 1, 'WEB', 'Frontend')), [['Hana', 0, 3]])
    expectSegments(segmentsOf(s, taskOf(s, 2, 'BIL', 'Java')), [['Ben', 1, 2]])
    expectSegments(segmentsOf(s, taskOf(s, 2, 'WEB', 'Frontend')), [['Hana', 3, 6]])
  })

  it('F-2 začne v 1.0; F-1 hotová v 3.0 (cycle 3.0), F-2 v 6.0 (cycle 5.0); Total time 6.0', () => {
    const s = run()
    expect(featureOf(s, 2).startedAt).toBeCloseTo(1, 1)
    expect(featureOf(s, 1).finishedAt).toBeCloseTo(3, 1)
    expect(cycleOf(s, 1)).toBeCloseTo(3, 1)
    expect(featureOf(s, 2).finishedAt).toBeCloseTo(6, 1)
    expect(cycleOf(s, 2)).toBeCloseTo(5, 1)
    expect(orgMetrics(s).totalTime).toBeCloseTo(6, 1)
  })
})

describe('feat-028 D3: stejná data, širší mandát', () => {
  it('Eli vezme F-1 Frontend, Hana F-2 Frontend (obě 0.0–3.0); obě hotové v 3.0', () => {
    const s = runToEnd(stateOf(orgTMobileWeb(),
      'F-1 (p1): BIL [Java 1] | WEB [Frontend 3]',
      'F-2 (p2): BIL [Java 1] | WEB [Frontend 3]'))
    expectSegments(segmentsOf(s, taskOf(s, 1, 'WEB', 'Frontend')), [['Eli', 0, 3]])
    expectSegments(segmentsOf(s, taskOf(s, 2, 'WEB', 'Frontend')), [['Hana', 0, 3]])
    expectSegments(segmentsOf(s, taskOf(s, 2, 'BIL', 'Java')), [['Ben', 1, 2]])
    expect(featureOf(s, 2).startedAt).toBeCloseTo(0, 1)
    expect(cycleOf(s, 1)).toBeCloseTo(3, 1)
    expect(cycleOf(s, 2)).toBeCloseTo(3, 1)
    expect(orgMetrics(s).totalTime).toBeCloseTo(3, 1)
  })
})

describe('feat-028 D4: kapacita týmu jsou jeho lidé', () => {
  it('Gus, Hana a Ivo pracují současně; vše hotové v 2.0; Avg WIP 3.0', () => {
    const s = runToEnd(stateOf(orgT(), 'F-1 (p1): WEB [Product 2]', 'F-2 (p2): WEB [Frontend 2]', 'F-3 (p3): WEB [QA 2]'))
    expectSegments(segmentsOf(s, taskOf(s, 1, 'WEB', 'Product')), [['Gus', 0, 2]])
    expectSegments(segmentsOf(s, taskOf(s, 2, 'WEB', 'Frontend')), [['Hana', 0, 2]])
    // QA ve F-3 začne hned: v oblasti nemá nižší fázi
    expectSegments(segmentsOf(s, taskOf(s, 3, 'WEB', 'QA')), [['Ivo', 0, 2]])
    const m = orgMetrics(s)
    expect(m.totalTime).toBeCloseTo(2, 1)
    expect(m.avgWip as number).toBeCloseTo(3, 1)
  })
})

describe('feat-028 D5: jeden člověk, jeden úkol', () => {
  it('Gus dělá F-1 Product 0.0–2.0 a pak F-2 Java 2.0–4.0; Ben Javu nevezme (Team Billing nemá mandát na WEB)', () => {
    const s = runToEnd(stateOf(orgT(), 'F-1 (p1): WEB [Product 2]', 'F-2 (p2): WEB [Java 2]'))
    expectSegments(segmentsOf(s, taskOf(s, 1, 'WEB', 'Product')), [['Gus', 0, 2]])
    expectSegments(segmentsOf(s, taskOf(s, 2, 'WEB', 'Java')), [['Gus', 2, 4]])
    expect(featureOf(s, 2).startedAt).toBeCloseTo(2, 1)
    expect(cycleOf(s, 2)).toBeCloseTo(2, 1)
    expect(orgMetrics(s).totalTime).toBeCloseTo(4, 1)
  })
})

describe('feat-028 D6: fáze v rámci oblasti', () => {
  it('BIL: Ada 0–2, Ben 2–5, Chen 5–7; MOB: Eli 0–3 (nečeká na BIL), Fae 3–4; hotová v 7.0', () => {
    const s = runToEnd(stateOf(orgT(), 'F-1 (p1): BIL [Product 2 · Java 3 · QA 2] | MOB [Frontend 3 · QA 1]'))
    expectSegments(segmentsOf(s, taskOf(s, 1, 'BIL', 'Product')), [['Ada', 0, 2]])
    expectSegments(segmentsOf(s, taskOf(s, 1, 'BIL', 'Java')), [['Ben', 2, 5]])
    expectSegments(segmentsOf(s, taskOf(s, 1, 'BIL', 'QA')), [['Chen', 5, 7]])
    expectSegments(segmentsOf(s, taskOf(s, 1, 'MOB', 'Frontend')), [['Eli', 0, 3]])
    expectSegments(segmentsOf(s, taskOf(s, 1, 'MOB', 'QA')), [['Fae', 3, 4]])
    expect(cycleOf(s, 1)).toBeCloseTo(7, 1)
  })
})

describe('feat-028 D7: Reduce WIP', () => {
  it('v 3.0 Chen vezme rozpracovanou F-2 (p3) před F-3 z backlogu (p2); cycle 3/4/1, avg 2.7, total 5.0, WIP 1.6', () => {
    const s = runToEnd(d7())
    expectSegments(segmentsOf(s, taskOf(s, 2, 'BIL', 'Java')), [['Ben', 0, 1]])
    expectSegments(segmentsOf(s, taskOf(s, 1, 'BIL', 'QA')), [['Chen', 0, 3]])
    expectSegments(segmentsOf(s, taskOf(s, 2, 'BIL', 'QA')), [['Chen', 3, 4]])
    expectSegments(segmentsOf(s, taskOf(s, 3, 'BIL', 'QA')), [['Chen', 4, 5]])
    expect([cycleOf(s, 1), cycleOf(s, 2), cycleOf(s, 3)].map(x => Math.round(x * 10) / 10)).toEqual([3, 4, 1])
    const m = orgMetrics(s)
    expect(m.avgCycleTime as number).toBeCloseTo(2.67, 1)
    expect(m.totalTime).toBeCloseTo(5, 1)
    expect(m.avgWip as number).toBeCloseTo(1.6, 1)
  })
})

describe('feat-028 D10: tým s více mandáty bere podle priority', () => {
  it('Eli vezme F-1 (WEB, p1), Hana nic (Team Web nemá MOB); F-2 2.0–4.0; Total time 4.0', () => {
    const s = runToEnd(stateOf(orgTMobileWeb(), 'F-1 (p1): WEB [Frontend 2]', 'F-2 (p2): MOB [Frontend 2]'))
    expectSegments(segmentsOf(s, taskOf(s, 1, 'WEB', 'Frontend')), [['Eli', 0, 2]])
    expectSegments(segmentsOf(s, taskOf(s, 2, 'MOB', 'Frontend')), [['Eli', 2, 4]])
    expect(cycleOf(s, 2)).toBeCloseTo(2, 1)
    expect(orgMetrics(s).totalTime).toBeCloseTo(4, 1)
  })
})

describe('feat-028 D11: dva stejní lidé, jeden úkol', () => {
  it('úkol vezme Hana (je v panelu dřív), Hugo nic', () => {
    const setup = orgT()
    team(setup, 'Team Web').people.splice(2, 0, { id: 99, name: 'Hugo', skills: ['Frontend'] })
    const s = runToEnd(stateOf(setup, 'F-1 (p1): WEB [Frontend 2]'))
    expectSegments(segmentsOf(s, taskOf(s, 1, 'WEB', 'Frontend')), [['Hana', 0, 2]])
  })
})

describe('feat-028 D14: úkoly stejné fáze běží souběžně', () => {
  it('Gus (Java) a Hana (Frontend) pracují oba 0.0–2.0; F-1 hotová v 2.0', () => {
    const s = runToEnd(stateOf(orgT(), 'F-1 (p1): WEB [Java 2 · Frontend 2]'))
    expectSegments(segmentsOf(s, taskOf(s, 1, 'WEB', 'Java')), [['Gus', 0, 2]])
    expectSegments(segmentsOf(s, taskOf(s, 1, 'WEB', 'Frontend')), [['Hana', 0, 2]])
    expect(featureOf(s, 1).finishedAt).toBeCloseTo(2, 1)
  })
})

describe('feat-028 F1–F3: cycle time, Total time a Avg WIP', () => {
  it('F1: D7 — Avg cycle time 2.7 a doneCount 3; bez hotových featur je Avg cycle time null', () => {
    expect(orgMetrics(d7()).avgCycleTime).toBeNull()
    expect(orgMetrics(d7()).doneCount).toBe(0)
    const m = orgMetrics(runToEnd(d7()))
    expect(m.avgCycleTime as number).toBeCloseTo(2.67, 1)
    expect(m.doneCount).toBe(3)
  })

  it('F2: D7 doběhne v 5.0 a stav je finished; v čase 0 je Avg WIP null', () => {
    expect(orgMetrics(d7()).avgWip).toBeNull()
    const s = runToEnd(d7())
    expect(s.finished).toBe(true)
    expect(orgMetrics(s).totalTime).toBeCloseTo(5, 1)
  })

  it('F3: D7 Avg WIP 1.6 (2 featury v 0.0–3.0, 1 v 3.0–5.0)', () => {
    expect(orgMetrics(runToEnd(d7())).avgWip as number).toBeCloseTo(1.6, 1)
  })

  it('done má nejnověji dokončenou featuru jako poslední prvek (UI ji zobrazí nahoře)', () => {
    expect(runToEnd(d7()).done.map(f => f.id)).toEqual([1, 2, 3])
  })
})

describe('feat-028 I3: Reset', () => {
  it('backlog se vrátí do stavu před během, Done je prázdný, čas 0; organizace beze změny', () => {
    const before = stateOf(grant(orgT(), 'Team Mobile', 'WEB'),
      'F-1 (p1): BIL [Java 1] | WEB [Frontend 3]', 'F-2 (p2): BIL [Java 1] | WEB [Frontend 3]')
    const backlogBefore = structuredClone(before.backlog)
    const setupBefore = structuredClone(before.setup)
    const reset = resetOrgState(runToEnd(before))
    expect(reset.simTime).toBe(0)
    expect(reset.finished).toBe(false)
    expect(reset.done).toEqual([])
    expect(reset.inProgress).toEqual([])
    expect(reset.backlog).toEqual(backlogBefore)
    expect(reset.setup).toEqual(setupBefore)
    expect(orgMetrics(reset).avgWip).toBeNull()
  })

  it('snapshot doběhnutého běhu nese Total time, Avg cycle time a Avg WIP pro srovnání', () => {
    const s = runToEnd(d7())
    const snap = snapshotOrgRun(s)
    expect(snap.totalTime).toBeCloseTo(5, 1)
    expect(snap.avgCycleTime as number).toBeCloseTo(2.67, 1)
    expect(snap.avgWip as number).toBeCloseTo(1.6, 1)
  })
})

describe('feat-028 J2: jeden člověk se všemi skilly', () => {
  it('úkoly jdou za sebou 0–2, 2–5, 5–7; Total time 7.0', () => {
    const setup = makeSetup([['Team Solo', ['BIL'], [['Ada', ['Product', 'Java', 'QA']]]]])
    const s = runToEnd(stateOf(setup, 'F-1 (p1): BIL [Product 2 · Java 3 · QA 2]'))
    expectSegments(segmentsOf(s, taskOf(s, 1, 'BIL', 'Product')), [['Ada', 0, 2]])
    expectSegments(segmentsOf(s, taskOf(s, 1, 'BIL', 'Java')), [['Ada', 2, 5]])
    expectSegments(segmentsOf(s, taskOf(s, 1, 'BIL', 'QA')), [['Ada', 5, 7]])
    expect(orgMetrics(s).totalTime).toBeCloseTo(7, 1)
  })
})

describe('feat-028 J11: nejvyšší fáze a mezery ve fázích', () => {
  it('Product fáze 1, QA fáze 10 (fáze 2–9 nikdo): Ada 0.0–2.0, Chen 2.0–3.0; hotová v 3.0', () => {
    const setup = orgB()
    setup.roleConfig.QA.level = 10
    setup.roleConfig.Java.level = 1
    setup.roleConfig.Frontend.level = 1
    const s = runToEnd(stateOf(setup, 'F-1 (p1): BIL [Product 2 · QA 1]'))
    expectSegments(segmentsOf(s, taskOf(s, 1, 'BIL', 'Product')), [['Ada', 0, 2]])
    expectSegments(segmentsOf(s, taskOf(s, 1, 'BIL', 'QA')), [['Chen', 2, 3]])
    expect(featureOf(s, 1).finishedAt).toBeCloseTo(3, 1)
  })
})
