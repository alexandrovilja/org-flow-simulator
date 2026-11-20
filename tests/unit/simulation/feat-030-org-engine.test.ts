import { describe, it, expect } from 'vitest'
import { mulberry32 } from '@/simulation/engine'
import {
  DEFAULT_ORG_BACKLOG_SETTINGS, generateOrgBacklog, makeDefaultOrgSetup, makeOrgState, orgMetrics, tickOrg, validateOrgSetup,
} from '@/simulation/organizationEngine'
import { addPersonSkill, movePerson, removePerson } from '@/simulation/organizationSetup'
import type { OrgSetup } from '@/types/organization'
import {
  feat, featureOf, grant, makeSetup, orgDef, orgT, person, runToEnd, segmentsOf, stateOf, taskOf, team,
} from './feat028Fixtures'

// feat-030 (Úpravy týmů a lidí, mód Organization inkrement 3) — rozšířená kontrola před během a běh s upravenou
// organizací.
//
// Schválený kontrakt (spec features/feat-030-upravy-tymu-a-lidi.md, Pravidla chování a Příklady 5–9 a 13;
// analýza C3, C5, C7, C10, D13, E6, J3, J8):
//  - `validateOrgSetup(setup, backlog)`: pro každou oblast použitou v backlogu, v pořadí oblastí, nejvýš jedno varování:
//      • žádný tým s mandátem → „No team has a mandate for WEB“ (jako inkrement 1),
//      • jinak skilly, které úkoly v oblasti potřebují a v týmech s mandátem je nikdo nemá, v jednom řádku:
//        „No one with QA can work in BIL“, „No one with Frontend or QA can work in BIL“,
//        „No one with Java, Frontend or QA can work in BIL“ — v pořadí editoru (klíčů `roleConfig`) a s `label`.
//    Skill u člověka v týmu bez mandátu se nepočítá. Nepoužitá oblast ani tým bez mandátu a bez lidí varování nevyvolá.
//  - Když kontrola projde, má každý úkol aspoň jednoho člověka, který ho smí vzít, a běh doběhne.
//  - Engine běhu se nemění: člověk bez skillů úkol nedostane a nemá idle čas; přesunutý člověk bere práci podle
//    mandátů nového týmu.
//  - Velká organizace (15 týmů po 6 lidech, 8 oblastí, 100 featur) doběhne s dt = 0.1 do 2 s strojového času.

describe('feat-030 C3: chybí skill v týmech s mandátem', () => {
  it('Chen bez QA → „No one with QA can work in BIL“, přestože QA mají Fae a Ivo v týmech bez mandátu na BIL', () => {
    const setup = orgT()
    person(setup, 'Chen').skills = []
    expect(validateOrgSetup(setup, [feat('F-1 (p1): BIL [QA 2]')])).toEqual(['No one with QA can work in BIL'])
  })

  it('kontroluje se jen skill, který oblast opravdu potřebuje (Team Billing nemá Frontend, ale BIL ho nepotřebuje)', () => {
    expect(validateOrgSetup(orgT(), [feat('F-1: BIL [Product 1 · Java 2 · QA 1]')])).toEqual([])
  })

  it('stačí skill u člověka v jakémkoli týmu s mandátem na oblast (Eli z Team Mobile s mandátem BIL)', () => {
    const setup = orgT()
    grant(setup, 'Team Mobile', 'BIL')
    expect(validateOrgSetup(setup, [feat('F-1: BIL [Frontend 2]')])).toEqual([])
  })

  it('varování používá aktuální název skillu z editoru, ne jeho klíč', () => {
    const setup = orgT()
    person(setup, 'Chen').skills = []
    setup.roleConfig.QA.label = 'QA automation'
    expect(validateOrgSetup(setup, [feat('F-1 (p1): BIL [QA 2]')])).toEqual(['No one with QA automation can work in BIL'])
  })
})

describe('feat-030 C10: chybějící skilly jedné oblasti v jednom řádku', () => {
  it('dva skilly → „No one with Frontend or QA can work in BIL“', () => {
    const setup = orgT()
    person(setup, 'Chen').skills = []
    expect(validateOrgSetup(setup, [feat('F-1 (p1): BIL [Frontend 2 · QA 2]')])).toEqual([
      'No one with Frontend or QA can work in BIL',
    ])
  })

  it('tři skilly → „No one with Java, Frontend or QA can work in BIL“ v pořadí editoru, ne úkolů ani featur', () => {
    const setup = orgT()
    person(setup, 'Ben').skills = []
    person(setup, 'Chen').skills = []
    const backlog = [feat('F-1: BIL [QA 1 · Frontend 1]'), feat('F-2: BIL [Java 2]')]
    expect(validateOrgSetup(setup, backlog)).toEqual(['No one with Java, Frontend or QA can work in BIL'])
  })

  it('oblast bez týmu s mandátem má jen varování o mandátu, ne o skillech', () => {
    const setup = orgT()
    team(setup, 'Team Web').mandates = []
    expect(validateOrgSetup(setup, [feat('F-1: WEB [Frontend 1 · QA 1]')])).toEqual(['No team has a mandate for WEB'])
  })
})

describe('feat-030 C5: více problémů najednou', () => {
  it('dvě varování v pořadí oblastí, ne backlogu: BIL před WEB', () => {
    const setup = orgT()
    team(setup, 'Team Web').mandates = []
    person(setup, 'Chen').skills = []
    // Featury záměrně v opačném pořadí, než jsou oblasti — rozhoduje pořadí oblastí
    const backlog = [feat('F-1: WEB [Frontend 3]'), feat('F-2: BIL [QA 2]')]
    expect(validateOrgSetup(setup, backlog)).toEqual(['No one with QA can work in BIL', 'No team has a mandate for WEB'])
  })
})

describe('feat-030 C7 a E6: tým bez lidí', () => {
  it('C7: prázdný „Team 4“ bez mandátu varování nevyvolá', () => {
    const setup = orgDef()
    setup.teams.push({ id: 4, name: 'Team 4', mandates: [], people: [] })
    expect(validateOrgSetup(setup, [feat('F-1: BIL [Java 2]'), feat('F-2: WEB [QA 1]')])).toEqual([])
  })

  it('E6: prázdný „Team 4“ s mandátem BIL varování nevyvolá, když BIL pokrývá Team Billing', () => {
    const setup = orgDef()
    setup.teams.push({ id: 4, name: 'Team 4', mandates: ['BIL'], people: [] })
    expect(validateOrgSetup(setup, [feat('F-1 (p1): BIL [Java 2]')])).toEqual([])
  })

  it('jediný tým s mandátem bez lidí → chybí všechny skilly, které oblast potřebuje', () => {
    const setup = orgDef()
    team(setup, 'Team Billing').people = []
    expect(validateOrgSetup(setup, [feat('F-1: BIL [QA 1 · Product 1]')])).toEqual(['No one with Product or QA can work in BIL'])
  })
})

describe('feat-030 Př. 5 a 8: výchozí organizace a výchozí backlog (seed 42)', () => {
  /** Výchozí organizace aplikace (klíče skillů PRODUCT, JAVA, …) a její výchozí backlog. */
  function defaults(): { setup: OrgSetup; backlog: ReturnType<typeof generateOrgBacklog> } {
    const setup = makeDefaultOrgSetup()
    return { setup, backlog: generateOrgBacklog(mulberry32(42), DEFAULT_ORG_BACKLOG_SETTINGS, setup) }
  }

  it('bez úprav nemá výchozí organizace žádné varování', () => {
    const { setup, backlog } = defaults()
    expect(validateOrgSetup(setup, backlog)).toEqual([])
  })

  it('Př. 5: Eli přesunutá do Team Web → „No one with Frontend can work in MOB“', () => {
    const { setup, backlog } = defaults()
    const moved = movePerson(setup, person(setup, 'Eli').id, team(setup, 'Team Web').id)
    expect(validateOrgSetup(moved, backlog)).toEqual(['No one with Frontend can work in MOB'])
  })

  it('Př. 8: v Team Billing zůstane jen Ada → „No one with Java, Frontend or QA can work in BIL“', () => {
    const { setup, backlog } = defaults()
    let next = setup
    for (const name of ['Ben', 'Cyril', 'Chen']) next = removePerson(next, person(next, name).id)
    expect(validateOrgSetup(next, backlog)).toEqual(['No one with Java, Frontend or QA can work in BIL'])
  })

  it('když kontrola po úpravách projde, běh doběhne (Hana pryč, Frontend místo ní umí Hugo)', () => {
    const { setup, backlog } = defaults()
    const withoutHana = removePerson(setup, person(setup, 'Hana').id)
    expect(validateOrgSetup(withoutHana, backlog)).toEqual(['No one with Frontend can work in WEB'])
    const fixed = addPersonSkill(withoutHana, person(withoutHana, 'Hugo').id, 'FRONTEND')
    expect(validateOrgSetup(fixed, backlog)).toEqual([])
    const s = makeOrgState(fixed, backlog)
    // Pojistka proti nekonečné smyčce: 100 000 kroků po 0.1 dne je 10 000 dní
    for (let i = 0; i < 100_000 && !s.finished; i++) tickOrg(s, 0.1, 'reduce-wip')
    expect(s.finished).toBe(true)
    expect(orgMetrics(s).doneCount).toBe(100)
  })
})

describe('feat-030 D13: člověk bez skillů', () => {
  it('Petr v Team Web nedostane úkol a jeho Idle Time zůstane 0.0', () => {
    const setup = orgT()
    team(setup, 'Team Web').people.push({ id: 99, name: 'Petr', skills: [] })
    const s = runToEnd(stateOf(setup, 'F-1 (p1): WEB [Frontend 3]'))
    expect(segmentsOf(s, taskOf(s, 1, 'WEB', 'Frontend'))).toEqual([['Hana', 0, expect.closeTo(3, 1)]])
    expect(s.idleByPerson[99] ?? 0).toBe(0)
    expect(orgMetrics(s).idleTime).toBeCloseTo(0, 1)
  })
})

describe('feat-030 J8: přesunutý člověk bere práci podle nového týmu', () => {
  it('Eli v Team Web vezme F-2 Frontend 0.0–3.0; obě featury hotové v 3.0; metriky 3.0 / 3.0 / 2.0 / 1.0', () => {
    const base = orgT()
    const setup = movePerson(base, person(base, 'Eli').id, team(base, 'Team Web').id)
    const s = runToEnd(stateOf(setup,
      'F-1 (p1): BIL [Java 1] | WEB [Frontend 3]',
      'F-2 (p2): BIL [Java 1] | WEB [Frontend 3]'))
    const seg = (id: number, area: string, role: string) =>
      segmentsOf(s, taskOf(s, id, area, role)).map(([name, from, to]) => [name, Number(from.toFixed(1)), Number((to ?? NaN).toFixed(1))])
    expect(seg(1, 'BIL', 'Java')).toEqual([['Ben', 0, 1]])
    expect(seg(1, 'WEB', 'Frontend')).toEqual([['Hana', 0, 3]])
    expect(seg(2, 'WEB', 'Frontend')).toEqual([['Eli', 0, 3]])
    expect(seg(2, 'BIL', 'Java')).toEqual([['Ben', 1, 2]])
    expect(featureOf(s, 1).finishedAt).toBeCloseTo(3, 1)
    expect(featureOf(s, 2).startedAt).toBeCloseTo(0, 1)
    expect(featureOf(s, 2).finishedAt).toBeCloseTo(3, 1)
    const m = orgMetrics(s)
    expect(m.totalTime).toBeCloseTo(3, 1)
    expect(m.avgCycleTime).toBeCloseTo(3, 1)
    expect(m.avgWip).toBeCloseTo(2, 1)
    // Idle jen Gus 0.0–1.0: Java ve F-2 čeká na Bena
    expect(m.idleTime).toBeCloseTo(1, 1)
    expect(s.idleByPerson[person(setup, 'Gus').id]).toBeCloseTo(1, 1)
  })
})

describe('feat-030 J3: velká organizace', () => {
  /** 15 týmů po 6 lidech, 8 oblastí; každý tým má všechny 4 skilly, prvních 8 mandát na 1 oblast, dalších 7 na 2. */
  function bigSetup(): OrgSetup {
    const codes = ['BIL', 'PAY', 'MOB', 'WEB', 'CRM', 'API', 'DWH', 'IDN']
    const skillCycle = ['Product', 'Java', 'Frontend', 'QA', 'Java', 'QA']
    const setup = makeSetup(Array.from({ length: 15 }, (_, i) => [
      `Team ${i + 1}`,
      i < 8 ? [codes[i]] : [codes[i % 8], codes[(i + 3) % 8]].sort((a, b) => codes.indexOf(a) - codes.indexOf(b)),
      skillCycle.map((sk, j): [string, string[]] => [`P${i + 1}-${j + 1}`, [sk]]),
    ]))
    setup.areas = codes.map(code => ({ code, name: code }))
    return setup
  }

  it('100 featur doběhne do 2 s strojového času s dt = 0.1 a výsledek je při stejném seedu stejný', () => {
    const runOnce = () => {
      const setup = bigSetup()
      const backlog = generateOrgBacklog(mulberry32(1), DEFAULT_ORG_BACKLOG_SETTINGS, setup)
      expect(validateOrgSetup(setup, backlog)).toEqual([])
      const s = makeOrgState(setup, backlog)
      // Pojistka proti nekonečné smyčce: 10 000 kroků po 0.1 dne je 1000 dní
      for (let i = 0; i < 10_000 && !s.finished; i++) tickOrg(s, 0.1, 'reduce-wip')
      expect(s.finished).toBe(true)
      return orgMetrics(s)
    }
    const t0 = performance.now()
    const first = runOnce()
    const elapsed = performance.now() - t0
    expect(first.doneCount).toBe(100)
    expect(elapsed).toBeLessThan(2000)
    expect(runOnce()).toEqual(first)
  })
})
