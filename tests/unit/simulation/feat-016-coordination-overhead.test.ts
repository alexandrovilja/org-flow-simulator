import { describe, it, expect } from 'vitest'
import {
  mulberry32, makeInitialState, resetFromSnapshot, tick, computeStats, computeRevenueAsOf, ROLE_META,
  HANDOFF_TAX_PCT, REWORK_PROBABILITY, REWORK_PROGRESS_LOSS_PCT, resetTaskProgress,
} from '@/simulation/engine'
import { parseRows } from '@/lib/xlsImport'
import type { SimSettings, SimState, Member, Feature, Task, Role, RoleMeta, LeadTimeEntry, WipMode } from '@/types/simulation'

const BASE_SETTINGS: SimSettings = {
  minBacklog: 0,
  wipLimit: 6,
  sizeVar: 0.4,
  roleVar: 0.5,
  initialBacklog: 20,
  minSpecializations: 1,
}

/** Nastavení se zapnutým / vypnutým coordination overhead. */
const ON: SimSettings = { ...BASE_SETTINGS, coordinationOverhead: true }
const OFF: SimSettings = { ...BASE_SETTINGS, coordinationOverhead: false }

/** Seedy pro agregované (statistické) testy — průměr přes více běhů brání flakiness. */
const SEEDS = [1, 2, 3, 42]

/** Délka ticku pro celé běhy — stejná granularita jako v prototypu, který ověřil model. */
const DT = 0.05

/** RNG, který vždy vrací stejnou hodnotu — umožňuje přesně řídit hod na rework. */
const always = (v: number) => () => v

/** Kopie ROLE_META s přepsanými hodnotami pro konkrétní role. */
function roleConfig(overrides: Partial<Record<Role, Partial<RoleMeta>>>): Record<Role, RoleMeta> {
  const base = structuredClone(ROLE_META)
  for (const [r, patch] of Object.entries(overrides) as [Role, Partial<RoleMeta>][]) {
    Object.assign(base[r], patch)
  }
  return base
}

/** FE → BE → QA ve třech po sobě jdoucích fázích — BE může začít až po dokončení FE. */
const PHASED = roleConfig({ FE: { level: 1 }, BE: { level: 2 }, QA: { level: 3 } })
/** Všechny role ve stejné fázi (výchozí ROLE_META) — tasky mohou běžet souběžně. */
const FLAT = ROLE_META

/**
 * Sestaví stav s jedinou featurou se zadanými tasky a zadaným týmem.
 * Feature vznikne přes makeInitialState, takže má všechna pole (včetně nových čítačů)
 * inicializovaná enginem — přepíšeme jen tasky a tým.
 *
 * @param tasks - Dvojice [role, work] pro každý task featury
 * @param team - Dvojice [id, roles] pro každou jednotku
 * @returns Stav simulace a referenci na featuru
 */
function setup(tasks: [Role, number][], team: [number, Role[]][]): { state: SimState; feature: Feature } {
  const state = makeInitialState(mulberry32(1), { ...BASE_SETTINGS, initialBacklog: 1 })
  const feature = state.backlog[0]
  feature.tasks = tasks.map(([role, work], i): Task => ({ id: i + 1, role, work, progress: 0, status: 'todo', assignee: null }))
  state.team = team.map(([id, roles]): Member => ({ id, name: `U${id}`, roles, currentTask: null, idleSec: 0 }))
  return { state, feature }
}

/**
 * Tiká stav, dokud simulace neskončí (s pojistkou proti nekonečné smyčce).
 *
 * @param state - Stav simulace (mutován)
 * @param settings - Nastavení simulace
 * @param rng - RNG předávaný do tick()
 * @param config - Konfigurace specializací
 * @param dt - Délka jednoho ticku
 */
function runUntilFinished(state: SimState, settings: SimSettings, rng: () => number, config: Record<Role, RoleMeta>, dt = 0.1): void {
  for (let i = 0; i < 100_000 && !state.finished; i++) tick(state, dt, settings, rng, config)
}

/**
 * Celý seedovaný běh s výchozím backlogem (20 features) až do konce.
 *
 * @param seed - Seed RNG (stejný seed = stejný backlog)
 * @param settings - Nastavení (ON / OFF / bez pole)
 * @param multiskill - true = každá jednotka má všechny role; false = výchozí silo tým
 * @param wipMode - WIP mód; výchozí Reduce WIP (výchozí v Cash Flow)
 * @returns Stav po doběhnutí
 */
function fullRun(seed: number, settings: SimSettings, multiskill = false, wipMode: WipMode = 'reduce-wip'): SimState {
  const rng = mulberry32(seed)
  const state = makeInitialState(rng, settings)
  if (multiskill) state.team.forEach(m => { m.roles = Object.keys(ROLE_META) })
  for (let i = 0; i < 100_000 && !state.finished; i++) tick(state, DT, settings, rng, ROLE_META, 'priority', wipMode)
  return state
}

/** Průměrný Cycle Time z leadTimes. */
const avgCycleTime = (s: SimState) => s.leadTimes.reduce((a, l) => a + l.ms, 0) / s.leadTimes.length

describe('feat-016: konstanty modelu', () => {
  it('exportuje pevné konstanty 25 % / 20 % / 50 %', () => {
    expect(HANDOFF_TAX_PCT).toBe(0.25)
    expect(REWORK_PROBABILITY).toBe(0.2)
    expect(REWORK_PROGRESS_LOSS_PCT).toBe(0.5)
  })
})

describe('feat-016: inicializace čítačů', () => {
  it('každá nová feature má handoffCount, reworkCount, handoffSec a reworkSec = 0', () => {
    const state = makeInitialState(mulberry32(42), ON)
    for (const f of state.backlog) {
      expect(f.handoffCount).toBe(0)
      expect(f.reworkCount).toBe(0)
      expect(f.handoffSec).toBe(0)
      expect(f.reworkSec).toBe(0)
    }
  })

  it('resetFromSnapshot vynuluje čítače i historii — druhý běh je identický s prvním', () => {
    const state = makeInitialState(mulberry32(42), ON)
    runUntilFinished(state, ON, mulberry32(7), ROLE_META, DT)
    const firstRun = state.leadTimes.map(l => ({ ms: l.ms, h: l.handoffSec, r: l.reworkSec }))

    resetFromSnapshot(state)
    for (const f of state.backlog) {
      expect(f.handoffCount).toBe(0)
      expect(f.reworkCount).toBe(0)
      expect(f.handoffSec).toBe(0)
      expect(f.reworkSec).toBe(0)
    }

    runUntilFinished(state, ON, mulberry32(7), ROLE_META, DT)
    expect(state.leadTimes.map(l => ({ ms: l.ms, h: l.handoffSec, r: l.reworkSec }))).toEqual(firstRun)
  })
})

describe('feat-016: inicializace featur z XLS importu', () => {
  it('importované featury mají čítače 0 a prázdnou historii jednotek', () => {
    const result = parseRows([
      { Feature: 'Login', Specializace: 'FE', Tym: 'Squad A', Velikost: 3 },
      { Feature: 'Login', Specializace: 'BE', Tym: 'Squad B', Velikost: 2 },
    ])
    for (const f of result.features) {
      expect(f.handoffCount).toBe(0)
      expect(f.reworkCount).toBe(0)
      expect(f.handoffSec).toBe(0)
      expect(f.reworkSec).toBe(0)
      expect(f.workedBy).toEqual([])
    }
  })
})

describe('feat-016: reset tasku za běhu (odebrání role / jednotky)', () => {
  /** Stav po předání: jednotka 0 dokončila FE, jednotka 1 převzala BE (work 1.5 → 1.875). */
  function afterHandoff() {
    const ctx = setup([['FE', 1.0], ['BE', 1.5]], [[0, ['FE']], [1, ['BE']], [2, ['BE']]])
    tick(ctx.state, 1.0, ON, always(0.99), PHASED)
    tick(ctx.state, 0.1, ON, always(0.99), PHASED)
    return ctx
  }

  it('resetTaskProgress vrátí task do todo bez assignee a s nulovým progresem', () => {
    const { feature } = afterHandoff()
    const be = feature.tasks[1]
    resetTaskProgress(feature, be)
    expect(be.status).toBe('todo')
    expect(be.assignee).toBeNull()
    expect(be.progress).toBe(0)
  })

  it('resetTaskProgress vrátí přirážku z handoff taxu — work i handoffSec', () => {
    const { feature } = afterHandoff()
    const be = feature.tasks[1]
    resetTaskProgress(feature, be)
    expect(be.work).toBeCloseTo(1.5)
    expect(feature.handoffSec).toBeCloseTo(0)
    // Předání jako událost proběhlo — počet zůstává
    expect(feature.handoffCount).toBe(1)
  })

  it('po resetu a převzetí jinou jednotkou se tax nesčítá (work = 1.875, ne 2.34)', () => {
    const { state, feature } = afterHandoff()
    const be = feature.tasks[1]
    // Simulace odebrání role jednotce 1: uvolnit jednotku a resetovat task
    state.team[1].currentTask = null
    state.team[1].roles = []
    resetTaskProgress(feature, be)

    tick(state, 0.1, ON, always(0.99), PHASED)
    expect(be.assignee).toBe(2)
    expect(be.work).toBeCloseTo(1.875)
    expect(feature.handoffSec).toBeCloseTo(0.375)
    expect(feature.handoffCount).toBe(2)
  })
})

describe('feat-016 Příklad 1: přepínač Off = beze změny', () => {
  it('coordinationOverhead: false dává shodný běh jako nastavení bez pole (parita s Advanced)', () => {
    const off = fullRun(42, OFF)
    const legacy = fullRun(42, BASE_SETTINGS)
    expect(off.simTime).toBe(legacy.simTime)
    expect(off.totalRevenueAllTime).toBe(legacy.totalRevenueAllTime)
    expect(off.leadTimes.map(l => l.ms)).toEqual(legacy.leadTimes.map(l => l.ms))
  })

  it('při Off zůstávají všechny čítače na 0', () => {
    const off = fullRun(42, OFF)
    for (const f of off.done) {
      expect(f.handoffCount).toBe(0)
      expect(f.reworkCount).toBe(0)
      expect(f.handoffSec).toBe(0)
      expect(f.reworkSec).toBe(0)
    }
  })

  it('při Off se work přebíraného tasku nemění', () => {
    const { state, feature } = setup([['FE', 1.0], ['BE', 1.5]], [[0, ['FE']], [1, ['BE']]])
    tick(state, 1.0, OFF, always(0.1), PHASED)
    tick(state, 0.1, OFF, always(0.1), PHASED)
    expect(feature.tasks[1].work).toBe(1.5)
    expect(feature.tasks[0].status).toBe('done')
    expect(feature.handoffCount).toBe(0)
  })

  it('při On silo tým (výchozí) předání skutečně generuje', () => {
    const on = fullRun(42, ON)
    expect(on.done.reduce((a, f) => a + f.handoffCount, 0)).toBeGreaterThan(0)
  })
})

describe('feat-016 Příklad 2: handoff tax', () => {
  it('nová jednotka přebírající práci po dokončeném tasku jiné jednotky zaplatí +25 % work', () => {
    const { state, feature } = setup([['FE', 1.0], ['BE', 1.5]], [[0, ['FE']], [1, ['BE']]])
    // Tick 1: jednotka 0 dokončí FE (BE ještě nemůže začít — je ve vyšší fázi)
    tick(state, 1.0, ON, always(0.99), PHASED)
    expect(feature.tasks[0].status).toBe('done')
    expect(feature.handoffCount).toBe(0)

    // Tick 2: jednotka 1 převezme BE → předání
    tick(state, 0.1, ON, always(0.99), PHASED)
    expect(feature.tasks[1].work).toBeCloseTo(1.875)
    expect(feature.handoffSec).toBeCloseTo(0.375)
    expect(feature.handoffCount).toBe(1)
    expect(feature.reworkCount).toBe(0)
  })

  it('handoffSec a reworkSec featury se přenesou do LeadTimeEntry', () => {
    const { state } = setup([['FE', 1.0], ['BE', 1.5]], [[0, ['FE']], [1, ['BE']]])
    runUntilFinished(state, ON, always(0.99), PHASED)
    expect(state.leadTimes).toHaveLength(1)
    expect(state.leadTimes[0].handoffSec).toBeCloseTo(0.375)
    expect(state.leadTimes[0].reworkSec).toBe(0)
  })
})

describe('feat-016 Příklad 3: žádné předání, žádný overhead', () => {
  it('jedna jednotka s FE i BE zpracuje celou featuru bez overheadu', () => {
    const { state, feature } = setup([['FE', 1.0], ['BE', 1.5]], [[0, ['FE', 'BE']]])
    runUntilFinished(state, ON, always(0.1), PHASED)
    expect(feature.status).toBe('done')
    expect(feature.tasks.map(t => t.work)).toEqual([1.0, 1.5])
    expect(feature.handoffCount).toBe(0)
    expect(feature.reworkCount).toBe(0)
    expect(feature.handoffSec).toBe(0)
    expect(feature.reworkSec).toBe(0)
  })
})

describe('feat-016 Příklad 4: rework', () => {
  it('při rng < 0.2 se hotový task jiné jednotky vrátí do todo s poloviční ztrátou progresu', () => {
    const { state, feature } = setup([['FE', 1.0], ['BE', 1.5]], [[0, ['FE']], [1, ['BE']]])
    tick(state, 1.0, ON, always(0.1), PHASED)
    tick(state, 0.1, ON, always(0.1), PHASED)

    const fe = feature.tasks[0]
    expect(fe.status).toBe('todo')
    expect(fe.assignee).toBeNull()
    expect(fe.progress).toBeCloseTo(0.5)
    expect(feature.reworkSec).toBeCloseTo(0.5)
    expect(feature.reworkCount).toBe(1)
    // Tax se zaplatí i při reworku
    expect(feature.handoffCount).toBe(1)
  })

  it('při rng = 0.2 (hranice) rework nenastane', () => {
    const { state, feature } = setup([['FE', 1.0], ['BE', 1.5]], [[0, ['FE']], [1, ['BE']]])
    tick(state, 1.0, ON, always(0.2), PHASED)
    tick(state, 0.1, ON, always(0.2), PHASED)
    expect(feature.tasks[0].status).toBe('done')
    expect(feature.tasks[0].progress).toBe(1.0)
    expect(feature.reworkCount).toBe(0)
    expect(feature.reworkSec).toBe(0)
    expect(feature.handoffCount).toBe(1)
  })

  it('jednotka, která se vrací k reworkem vrácenému tasku, nové předání nevyvolá', () => {
    const { state, feature } = setup([['FE', 1.0], ['BE', 1.5]], [[0, ['FE']], [1, ['BE']]])
    tick(state, 1.0, ON, always(0.1), PHASED)
    tick(state, 0.1, ON, always(0.1), PHASED)
    // Tick 3: jednotka 0 (na featuře už pracovala) znovu bere vrácený FE task
    tick(state, 0.1, ON, always(0.1), PHASED)
    expect(feature.tasks[0].status).toBe('doing')
    expect(feature.tasks[0].assignee).toBe(0)
    expect(feature.handoffCount).toBe(1)
    expect(feature.reworkCount).toBe(1)
  })

  it('feature s reworkem nakonec doběhne', () => {
    const { state, feature } = setup([['FE', 1.0], ['BE', 1.5]], [[0, ['FE']], [1, ['BE']]])
    runUntilFinished(state, ON, always(0.1), PHASED)
    expect(feature.status).toBe('done')
    expect(feature.tasks.every(t => t.status === 'done')).toBe(true)
  })
})

describe('feat-016 Příklad 5: souběžný start není předání', () => {
  it('dvě jednotky začínající ve stejném ticku (stejná fáze) předání nevyvolají', () => {
    const { state, feature } = setup([['FE', 1.0], ['BE', 1.5]], [[0, ['FE']], [1, ['BE']]])
    tick(state, 0.1, ON, always(0.1), FLAT)
    expect(feature.tasks.map(t => t.status)).toEqual(['doing', 'doing'])
    expect(feature.handoffCount).toBe(0)
    expect(feature.tasks.map(t => t.work)).toEqual([1.0, 1.5])

    runUntilFinished(state, ON, always(0.1), FLAT)
    expect(feature.handoffCount).toBe(0)
    expect(feature.reworkCount).toBe(0)
  })

  it('jednotka, která na featuře už pracovala, při návratu v pozdější fázi předání nevyvolá', () => {
    // FE (jednotka 0) → BE (jednotka 1, předání) → QA (jednotka 0, vrací se — bez předání)
    const { state, feature } = setup([['FE', 1.0], ['BE', 1.0], ['QA', 1.0]], [[0, ['FE', 'QA']], [1, ['BE']]])
    runUntilFinished(state, ON, always(0.99), PHASED)
    expect(feature.handoffCount).toBe(1)
    expect(feature.tasks[2].work).toBe(1.0)
  })
})

describe('feat-016 Příklad 6: souhrnná procenta v computeStats', () => {
  it('coordinationPct = Σ(handoffSec + reworkSec) / Σ cycle time × 100, s rozpadem', () => {
    const lts: LeadTimeEntry[] = [
      { id: 1, ms: 10, finishedAt: 10, handoffs: 0, handoffSec: 1, reworkSec: 0.5 },
      { id: 2, ms: 10, finishedAt: 12, handoffs: 0, handoffSec: 1, reworkSec: 0.5 },
    ]
    const stats = computeStats(lts)
    expect(stats.handoffPct).toBeCloseTo(10)
    expect(stats.reworkPct).toBeCloseTo(5)
    expect(stats.coordinationPct).toBeCloseTo(15)
  })

  it('záznamy bez handoffSec / reworkSec se počítají jako 0', () => {
    const stats = computeStats([{ id: 1, ms: 20, finishedAt: 20, handoffs: 2 }])
    expect(stats.handoffPct).toBe(0)
    expect(stats.reworkPct).toBe(0)
    expect(stats.coordinationPct).toBe(0)
  })

  it('prázdná historie vrací 0 %', () => {
    const stats = computeStats([])
    expect(stats.handoffPct).toBe(0)
    expect(stats.reworkPct).toBe(0)
    expect(stats.coordinationPct).toBe(0)
  })
})

describe('feat-016 Příklad 7: dopad na Cycle Time a výnos', () => {
  it('On má delší průměrný Cycle Time než Off (agregováno přes seedy)', () => {
    let offSum = 0
    let onSum = 0
    for (const seed of SEEDS) {
      offSum += avgCycleTime(fullRun(seed, OFF))
      onSum += avgCycleTime(fullRun(seed, ON))
    }
    expect(onSum).toBeGreaterThan(offSum)
  })

  it('On má nižší výnos ve stejném čase (k času kratšího běhu), agregováno přes seedy', () => {
    let offRev = 0
    let onRev = 0
    for (const seed of SEEDS) {
      const off = fullRun(seed, OFF)
      const on = fullRun(seed, ON)
      const t = Math.min(off.simTime, on.simTime)
      offRev += computeRevenueAsOf(off.done, t)
      onRev += computeRevenueAsOf(on.done, t)
    }
    expect(onRev).toBeLessThan(offRev)
  })
})

describe('feat-016 Příklad 9: silo vs. multiskill (Reduce WIP)', () => {
  it('silo má vyšší coordination overhead; multiskill je blízko 0 % (< 3 %)', () => {
    let siloPct = 0
    let multiPct = 0
    for (const seed of SEEDS) {
      siloPct += computeStats(fullRun(seed, ON, false).leadTimes).coordinationPct
      multiPct += computeStats(fullRun(seed, ON, true).leadTimes).coordinationPct
    }
    siloPct /= SEEDS.length
    multiPct /= SEEDS.length
    expect(siloPct).toBeGreaterThan(multiPct)
    expect(multiPct).toBeLessThan(3)
  })

  it('multiskill má vyšší výnos ve stejném čase než silo', () => {
    let siloRev = 0
    let multiRev = 0
    for (const seed of SEEDS) {
      const silo = fullRun(seed, ON, false)
      const multi = fullRun(seed, ON, true)
      const t = Math.min(silo.simTime, multi.simTime)
      siloRev += computeRevenueAsOf(silo.done, t)
      multiRev += computeRevenueAsOf(multi.done, t)
    }
    expect(multiRev).toBeGreaterThan(siloRev)
  })
})
