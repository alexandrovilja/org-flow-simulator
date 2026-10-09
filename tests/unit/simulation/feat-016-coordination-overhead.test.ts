import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import {
  mulberry32, makeInitialState, resetFromSnapshot, tick, computeStats, computeRevenueAsOf, ROLE_META, PRESETS,
  JOIN_TAX_PCT, REWORK_PROBABILITY, REWORK_PROGRESS_LOSS_PCT, resetTaskProgress, coordinationRoll, cloneFeatureFresh,
} from '@/simulation/engine'
import { parseRows } from '@/lib/xlsImport'
import { useCashFlowSimSetup } from '@/hooks/useCashFlowSimSetup'
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
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8]

/** Délka ticku pro celé běhy. */
const DT = 0.05

/**
 * RNG, který při jakémkoli použití vyhodí chybu. Revize 2 (determinismus): `tick()` nesmí pro
 * coordination overhead používat sdílený RNG — kostky jsou čistá funkce `coordinationRoll`.
 */
const NO_RNG = (): number => {
  throw new Error('tick() nesmí pro coordination overhead použít sdílený rng')
}

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
/** FE a QA v první fázi, BE ve druhé — BE čeká na obojí. */
const THREE_PHASE = roleConfig({ FE: { level: 1 }, QA: { level: 1 }, BE: { level: 2 } })
/** Všechny role ve stejné fázi (výchozí ROLE_META) — tasky mohou běžet souběžně. */
const FLAT = ROLE_META

/** Funkce vracející kostku featury pro dané (index, slot) — usnadňuje psaní predikátů v findSeed. */
type RollFn = (index: number, slot: 0 | 1 | 2) => number

/**
 * Najde `coordSeed`, pro který platí zadaný predikát nad kostkami. Díky tomu jsou testy
 * deterministické bez vstřikování RNG: seed vybereme podle toho, jak má kostka dopadnout.
 *
 * @param pred - Podmínka nad kostkami `r(index, slot)`
 * @returns První nalezený seed
 */
function findSeed(pred: (r: RollFn) => boolean): number {
  for (let s = 1; s < 100_000; s++) {
    if (pred((i, slot) => coordinationRoll(s, i, slot))) return s
  }
  throw new Error('žádný coordSeed nevyhovuje predikátu')
}

/** Hodnota kostky je pod prahem rozporu — rozpor nastane. */
const low = (v: number) => v < REWORK_PROBABILITY
/** Hodnota kostky je nad prahem rozporu — rozpor nenastane. */
const high = (v: number) => v >= REWORK_PROBABILITY

/**
 * Sestaví stav s jedinou featurou se zadanými tasky, týmem a `coordSeed`.
 * Feature vznikne přes makeInitialState, takže má všechna pole inicializovaná enginem.
 *
 * @param tasks - Dvojice [role, work] pro každý task featury
 * @param team - Dvojice [id, roles] pro každou jednotku
 * @param coordSeed - Seed kostek featury (určuje, zda nastane rozpor)
 * @returns Stav simulace a reference na featuru
 */
function setup(tasks: [Role, number][], team: [number, Role[]][], coordSeed: number): { state: SimState; feature: Feature } {
  const state = makeInitialState(mulberry32(1), { ...BASE_SETTINGS, initialBacklog: 1 })
  const feature = state.backlog[0]
  feature.tasks = tasks.map(([role, work], i): Task => ({ id: i + 1, role, work, progress: 0, status: 'todo', assignee: null }))
  feature.coordSeed = coordSeed
  state.team = team.map(([id, roles]): Member => ({ id, name: `U${id}`, roles, currentTask: null, idleSec: 0 }))
  return { state, feature }
}

/**
 * Tiká stav o `steps` kroků délky `dt` (vždy s NO_RNG — overhead nesmí RNG potřebovat).
 *
 * @param state - Stav simulace (mutován)
 * @param settings - Nastavení simulace
 * @param config - Konfigurace specializací
 * @param dt - Délka jednoho ticku
 * @param steps - Počet ticků
 * @param wipMode - WIP mód (výchozí Reduce WIP)
 */
function tickN(state: SimState, settings: SimSettings, config: Record<Role, RoleMeta>, dt: number, steps: number, wipMode: WipMode = 'reduce-wip'): void {
  for (let i = 0; i < steps; i++) tick(state, dt, settings, NO_RNG, config, 'priority', wipMode)
}

/**
 * Tiká stav, dokud simulace neskončí (s pojistkou proti nekonečné smyčce).
 *
 * @param state - Stav simulace (mutován)
 * @param settings - Nastavení simulace
 * @param config - Konfigurace specializací
 * @param dt - Délka jednoho ticku
 */
function runUntilFinished(state: SimState, settings: SimSettings, config: Record<Role, RoleMeta>, dt = 0.1): void {
  for (let i = 0; i < 200_000 && !state.finished; i++) tick(state, dt, settings, NO_RNG, config)
}

/**
 * Celý seedovaný běh s výchozím backlogem (20 features) až do konce.
 *
 * @param seed - Seed generování backlogu
 * @param settings - Nastavení (ON / OFF / bez pole)
 * @param units - 'silo' = výchozí tým (6 jednotek, jedna role každá); číslo N = N multiskill jednotek se všemi rolemi
 * @param wipMode - WIP mód; výchozí Reduce WIP
 * @returns Stav po doběhnutí
 */
function fullRun(seed: number, settings: SimSettings, units: 'silo' | number = 'silo', wipMode: WipMode = 'reduce-wip'): SimState {
  const state = makeInitialState(mulberry32(seed), settings)
  if (units !== 'silo') {
    state.team = state.team.slice(0, units)
    state.team.forEach(m => { m.roles = Object.keys(ROLE_META) })
  }
  for (let i = 0; i < 200_000 && !state.finished; i++) tick(state, DT, settings, NO_RNG, ROLE_META, 'priority', wipMode)
  return state
}

/** Průměrný Cycle Time z leadTimes. */
const avgCycleTime = (s: SimState) => s.leadTimes.reduce((a, l) => a + l.ms, 0) / s.leadTimes.length

/** Průměr hodnot získaných z běhů přes všechny SEEDS. */
const meanOverSeeds = (f: (seed: number) => number) => SEEDS.reduce((a, s) => a + f(s), 0) / SEEDS.length

/** Počet různých jednotek, které na featuře zpracovaly aspoň jeden task (funguje i při vypnutém overheadu). */
const distinctUnits = (f: Feature) => new Set(f.tasks.map(t => t.assignee)).size

/** FNV-1a hash řetězce — krátký otisk pro regresní testy. */
function fnv(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16)
}

/** Otisk backlogu (jméno, priorita, výnos, role a `work` tasků) — nový `coordSeed` do něj záměrně nepatří. */
const backlogFingerprint = (state: SimState) =>
  fnv(JSON.stringify(state.backlog.map(f => [f.name, f.priority, f.revenuePerTick.toFixed(9), f.tasks.map(t => [t.role, t.work.toFixed(9)])])))

/** Otisk historie Cycle Time — ms zaokrouhlené na 6 míst. */
const leadTimeFingerprint = (state: SimState) => fnv(JSON.stringify(state.leadTimes.map(l => l.ms.toFixed(6))))

/** Podrobný záznam běhu pro srovnání dvou běhů (příklady 11 a 13). */
function runSummary(state: SimState) {
  const features = [...state.done].sort((a, b) => a.id - b.id)
  return {
    simTime: state.simTime,
    revenue: state.totalRevenueAllTime,
    leadTimes: state.leadTimes.map(l => [l.id, l.ms, l.joinTaxSec, l.reworkSec]),
    features: features.map(f => [f.id, f.joinCount, f.reworkCount, f.joinTaxSec, f.reworkSec, (f.finishedAt ?? 0) - (f.startedAt ?? 0)]),
  }
}

afterEach(() => { vi.restoreAllMocks() })

// ───────────────────────────────────────────────────────────────────────────────
// coordinationRoll — čistá funkce kostek (revize 2: determinismus)
// ───────────────────────────────────────────────────────────────────────────────

describe('feat-016: coordinationRoll — čistá deterministická kostka', () => {
  it('stejné argumenty vrací vždy stejnou hodnotu', () => {
    expect(coordinationRoll(123, 4, 1)).toBe(coordinationRoll(123, 4, 1))
  })

  it('vrací hodnotu v intervalu [0, 1)', () => {
    for (let s = 1; s <= 200; s++) {
      for (const slot of [0, 1, 2] as const) {
        const v = coordinationRoll(s, s % 7, slot)
        expect(v).toBeGreaterThanOrEqual(0)
        expect(v).toBeLessThan(1)
      }
    }
  })

  it('různý seed, index i slot dávají různé hodnoty', () => {
    expect(coordinationRoll(1, 0, 0)).not.toBe(coordinationRoll(2, 0, 0))
    expect(coordinationRoll(1, 0, 0)).not.toBe(coordinationRoll(1, 1, 0))
    expect(coordinationRoll(1, 0, 0)).not.toBe(coordinationRoll(1, 0, 1))
    expect(coordinationRoll(1, 0, 1)).not.toBe(coordinationRoll(1, 0, 2))
  })

  it('je přibližně rovnoměrná: průměr ≈ 0.5 a podíl hodnot pod 0.2 ≈ 20 % (přes 2 000 seedů)', () => {
    let sum = 0
    let below = 0
    const N = 2000
    for (let s = 1; s <= N; s++) {
      const v = coordinationRoll(s, 0, 0)
      sum += v
      if (v < REWORK_PROBABILITY) below++
    }
    expect(sum / N).toBeGreaterThan(0.47)
    expect(sum / N).toBeLessThan(0.53)
    expect(below / N).toBeGreaterThan(0.17)
    expect(below / N).toBeLessThan(0.23)
  })
})

describe('feat-016: konstanty modelu', () => {
  it('exportuje pevné konstanty 25 % / 20 % / 50 %', () => {
    expect(JOIN_TAX_PCT).toBe(0.25)
    expect(REWORK_PROBABILITY).toBe(0.2)
    expect(REWORK_PROGRESS_LOSS_PCT).toBe(0.5)
  })
})

// ───────────────────────────────────────────────────────────────────────────────
// Inicializace, coordSeed, regrese backlogu
// ───────────────────────────────────────────────────────────────────────────────

describe('feat-016: inicializace polí featury', () => {
  it('každá nová feature má čítače 0, prázdnou historii a čekající rozpory a konečný celočíselný coordSeed', () => {
    const state = makeInitialState(mulberry32(42), ON)
    for (const f of state.backlog) {
      expect(f.joinCount).toBe(0)
      expect(f.reworkCount).toBe(0)
      expect(f.joinTaxSec).toBe(0)
      expect(f.reworkSec).toBe(0)
      expect(f.workedBy).toEqual([])
      expect(f.pendingDivergence).toEqual([])
      expect(Number.isInteger(f.coordSeed)).toBe(true)
    }
  })

  it('featury mají různé coordSeed (jinak by všechny „padaly“ stejně)', () => {
    const state = makeInitialState(mulberry32(42), ON)
    expect(new Set(state.backlog.map(f => f.coordSeed)).size).toBeGreaterThan(10)
  })

  it('resetFromSnapshot zachová coordSeed a vynuluje čítače, historii i čekající rozpory', () => {
    const state = makeInitialState(mulberry32(42), ON)
    const seeds = state.backlog.map(f => f.coordSeed)
    runUntilFinished(state, ON, ROLE_META, DT)

    resetFromSnapshot(state)
    expect(state.backlog.map(f => f.coordSeed)).toEqual(seeds)
    for (const f of state.backlog) {
      expect(f.joinCount).toBe(0)
      expect(f.reworkCount).toBe(0)
      expect(f.joinTaxSec).toBe(0)
      expect(f.reworkSec).toBe(0)
      expect(f.workedBy).toEqual([])
      expect(f.pendingDivergence).toEqual([])
    }
  })

  it('featury z XLS importu mají čítače 0, prázdné pole čekajících rozporů a konečný coordSeed', () => {
    const result = parseRows([
      { Feature: 'Login', Specializace: 'FE', Tym: 'Squad A', Velikost: 3 },
      { Feature: 'Login', Specializace: 'BE', Tym: 'Squad B', Velikost: 2 },
    ])
    for (const f of result.features) {
      expect(f.joinCount).toBe(0)
      expect(f.reworkCount).toBe(0)
      expect(f.joinTaxSec).toBe(0)
      expect(f.reworkSec).toBe(0)
      expect(f.workedBy).toEqual([])
      expect(f.pendingDivergence).toEqual([])
      expect(Number.isFinite(f.coordSeed)).toBe(true)
    }
  })
})

describe('feat-016 regrese: stávající backlogy a WIP režimy se nemění', () => {
  // POZOR: generování backlogu (`[...].sort(() => rng() - 0.5)` v makeFeature) závisí na implementaci
  // Array.prototype.sort — nekonzistentní komparátor dává v různých JS enginech i verzích Node různé
  // permutace (CI na Node 20 vidí jiný backlog než lokální Node 25). Regresní testy proto NESMÍ
  // pinovat výstup makeInitialState; používají ručně sestavený backlog a vlastní rozpoznání pořadí rng.

  it('coordSeed se generuje z posledních N volání rng (po revenue batchi) — dřívější volání se nezměnila', () => {
    const inner = mulberry32(42)
    const drawn: number[] = []
    const recording = () => { const v = inner(); drawn.push(v); return v }
    const state = makeInitialState(recording, BASE_SETTINGS, ROLE_META)
    const n = state.backlog.length
    // Pokud by se coordSeed losoval dřív, posunul by role, work i výnosy a tohle by neplatilo
    expect(state.backlog.map(f => f.coordSeed)).toEqual(drawn.slice(-n).map(v => Math.floor(v * 2 ** 31)))
  })

  /** Ručně sestavený backlog — nezávislý na řazení (Array.sort) i na transcendentních funkcích. */
  function manualBacklog(size: number): SimState {
    const state = makeInitialState(mulberry32(1), { ...BASE_SETTINGS, initialBacklog: size })
    const roles = Object.keys(ROLE_META)
    const rng = mulberry32(42)
    state.backlog.forEach((f, i) => {
      const count = 2 + Math.floor(rng() * 4)
      f.tasks = Array.from({ length: count }, (_, k): Task => ({
        id: i * 10 + k + 1, role: roles[Math.floor(rng() * 6)], work: 0.8 + rng() * 1.4, progress: 0, status: 'todo', assignee: null,
      }))
      f.revenuePerTick = 100 + (size - i) * 10
    })
    return state
  }

  /** Doběhne ručně sestavený backlog (20 features) s daným týmem a WIP módem; overhead Off. */
  function runManual(wipMode: WipMode, units: 'silo' | 3): SimState {
    const state = manualBacklog(20)
    if (units !== 'silo') {
      state.team = state.team.slice(0, units)
      state.team.forEach(m => { m.roles = Object.keys(ROLE_META) })
    }
    for (let i = 0; i < 200_000 && !state.finished; i++) tick(state, DT, BASE_SETTINGS, NO_RNG, ROLE_META, 'priority', wipMode)
    return state
  }

  // Referenční hodnoty spočítal původní engine (main, před revizí 2) i nový — shodují se
  it.each([
    ['reduce-wip', 'silo', '18.1500', '10600.00', 'fa3edff7'],
    ['reduce-wip', 3, '30.2000', '20580.00', '6627465f'],
    ['priority', 'silo', '18.1500', '6350.00', 'fe90b5b8'],
    ['priority', 3, '30.2500', '12160.00', '700519a8'],
  ] as const)('%s, tým %s: běh bez overheadu je shodný s referencí před revizí', (wipMode, units, simTime, revenue, leadTimes) => {
    const state = runManual(wipMode, units)
    expect(state.simTime.toFixed(4)).toBe(simTime)
    expect(state.totalRevenueAllTime.toFixed(2)).toBe(revenue)
    expect(leadTimeFingerprint(state)).toBe(leadTimes)
  })
})

// ───────────────────────────────────────────────────────────────────────────────
// Příklad 1 — Off = beze změny
// ───────────────────────────────────────────────────────────────────────────────

describe('feat-016 Příklad 1: přepínač Off = beze změny', () => {
  it('coordinationOverhead: false dává shodný běh jako nastavení bez pole (parita s Advanced)', () => {
    const off = fullRun(42, OFF)
    const legacy = fullRun(42, BASE_SETTINGS)
    expect(off.simTime).toBe(legacy.simTime)
    expect(off.totalRevenueAllTime).toBe(legacy.totalRevenueAllTime)
    expect(off.leadTimes.map(l => l.ms)).toEqual(legacy.leadTimes.map(l => l.ms))
  })

  it('při Off zůstávají všechny čítače na 0 a nikdo se nezapisuje do historie', () => {
    const off = fullRun(42, OFF)
    for (const f of off.done) {
      expect(f.joinCount).toBe(0)
      expect(f.reworkCount).toBe(0)
      expect(f.joinTaxSec).toBe(0)
      expect(f.reworkSec).toBe(0)
      expect(f.pendingDivergence).toEqual([])
    }
  })

  it('při Off se work přebíraného tasku nemění', () => {
    const seed = findSeed(r => low(r(0, 0)))
    const { state, feature } = setup([['FE', 1.0], ['BE', 1.5]], [[0, ['FE']], [1, ['BE']]], seed)
    tickN(state, OFF, PHASED, 1.0, 1)
    tickN(state, OFF, PHASED, 0.1, 1)
    expect(feature.tasks[1].work).toBe(1.5)
    expect(feature.tasks[0].status).toBe('done')
    expect(feature.joinCount).toBe(0)
    expect(feature.reworkCount).toBe(0)
  })

  it('při On silo tým (výchozí) připojení skutečně generuje', () => {
    const on = fullRun(42, ON)
    expect(on.done.reduce((a, f) => a + f.joinCount, 0)).toBeGreaterThan(0)
  })

  it('tick() při On nepoužije sdílený rng (NO_RNG by vyhodil chybu)', () => {
    expect(() => fullRun(3, ON)).not.toThrow()
  })
})

// ───────────────────────────────────────────────────────────────────────────────
// Příklad 2 a 3 — tax za připojení, žádné připojení
// ───────────────────────────────────────────────────────────────────────────────

describe('feat-016 Příklad 2: tax za připojení', () => {
  /** Seed bez rozporu u prvního připojení — izoluje tax od reworku. */
  const noDivergence = () => findSeed(r => high(r(0, 0)))

  it('nová jednotka přebírající práci po dokončeném tasku jiné jednotky zaplatí +25 % work', () => {
    const { state, feature } = setup([['FE', 1.0], ['BE', 1.5]], [[0, ['FE']], [1, ['BE']]], noDivergence())
    tickN(state, ON, PHASED, 1.0, 1)
    expect(feature.tasks[0].status).toBe('done')
    expect(feature.joinCount).toBe(0)

    tickN(state, ON, PHASED, 0.1, 1)
    expect(feature.tasks[1].work).toBeCloseTo(1.875)
    expect(feature.joinTaxSec).toBeCloseTo(0.375)
    expect(feature.joinCount).toBe(1)
    expect(feature.reworkCount).toBe(0)
  })

  it('joinTaxSec a reworkSec featury se přenesou do LeadTimeEntry', () => {
    const { state } = setup([['FE', 1.0], ['BE', 1.5]], [[0, ['FE']], [1, ['BE']]], noDivergence())
    runUntilFinished(state, ON, PHASED)
    expect(state.leadTimes).toHaveLength(1)
    expect(state.leadTimes[0].joinTaxSec).toBeCloseTo(0.375)
    expect(state.leadTimes[0].reworkSec).toBe(0)
  })
})

describe('feat-016 Příklad 3: žádné připojení, žádný overhead', () => {
  it('jedna jednotka s FE i BE zpracuje celou featuru bez overheadu', () => {
    const seed = findSeed(r => low(r(0, 0)))
    const { state, feature } = setup([['FE', 1.0], ['BE', 1.5]], [[0, ['FE', 'BE']]], seed)
    runUntilFinished(state, ON, PHASED)
    expect(feature.status).toBe('done')
    expect(feature.tasks.map(t => t.work)).toEqual([1.0, 1.5])
    expect(feature.joinCount).toBe(0)
    expect(feature.reworkCount).toBe(0)
    expect(feature.joinTaxSec).toBe(0)
    expect(feature.reworkSec).toBe(0)
  })
})

// ───────────────────────────────────────────────────────────────────────────────
// Příklad 4 — rework při převzetí hotové práce
// ───────────────────────────────────────────────────────────────────────────────

describe('feat-016 Příklad 4: rework při převzetí hotové práce', () => {
  it('při kostce rozporu < 0.2 se hotový task jiné jednotky vrátí do todo s poloviční ztrátou progresu', () => {
    const seed = findSeed(r => low(r(0, 0)))
    const { state, feature } = setup([['FE', 1.0], ['BE', 1.5]], [[0, ['FE']], [1, ['BE']]], seed)
    tickN(state, ON, PHASED, 1.0, 1)
    tickN(state, ON, PHASED, 0.1, 1)

    const fe = feature.tasks[0]
    expect(fe.status).toBe('todo')
    expect(fe.assignee).toBeNull()
    expect(fe.progress).toBeCloseTo(0.5)
    expect(feature.reworkSec).toBeCloseTo(0.5)
    expect(feature.reworkCount).toBe(1)
    // Tax se zaplatí i při reworku
    expect(feature.joinCount).toBe(1)
  })

  it('při kostce rozporu ≥ 0.2 rework nenastane', () => {
    const seed = findSeed(r => high(r(0, 0)))
    const { state, feature } = setup([['FE', 1.0], ['BE', 1.5]], [[0, ['FE']], [1, ['BE']]], seed)
    tickN(state, ON, PHASED, 1.0, 1)
    tickN(state, ON, PHASED, 0.1, 1)
    expect(feature.tasks[0].status).toBe('done')
    expect(feature.tasks[0].progress).toBe(1.0)
    expect(feature.reworkCount).toBe(0)
    expect(feature.reworkSec).toBe(0)
    expect(feature.joinCount).toBe(1)
  })

  it('jednotka, která se vrací k reworkem vrácenému tasku, nové připojení nevyvolá', () => {
    const seed = findSeed(r => low(r(0, 0)))
    const { state, feature } = setup([['FE', 1.0], ['BE', 1.5]], [[0, ['FE']], [1, ['BE']]], seed)
    tickN(state, ON, PHASED, 1.0, 1)
    tickN(state, ON, PHASED, 0.1, 2)
    // Jednotka 0 (na featuře už pracovala) znovu bere vrácený FE task
    expect(feature.tasks[0].status).toBe('doing')
    expect(feature.tasks[0].assignee).toBe(0)
    expect(feature.joinCount).toBe(1)
    expect(feature.reworkCount).toBe(1)
  })

  it('feature s reworkem nakonec doběhne', () => {
    const seed = findSeed(r => low(r(0, 0)))
    const { state, feature } = setup([['FE', 1.0], ['BE', 1.5]], [[0, ['FE']], [1, ['BE']]], seed)
    runUntilFinished(state, ON, PHASED)
    expect(feature.status).toBe('done')
    expect(feature.tasks.every(t => t.status === 'done')).toBe(true)
  })

  it('výběr vraceného tasku určuje kostka slotu 1: floor(kostka × počet kandidátů)', () => {
    // Připojení č. 0 (QA) bez rozporu; připojení č. 1 (BE) s rozporem při převzetí; kandidáti = [FE, QA]
    const pickFirst = findSeed(r => high(r(0, 0)) && low(r(1, 0)) && r(1, 1) < 0.5)
    const pickSecond = findSeed(r => high(r(0, 0)) && low(r(1, 0)) && r(1, 1) >= 0.5)

    for (const [seed, returned, kept] of [[pickFirst, 0, 1], [pickSecond, 1, 0]] as const) {
      const { state, feature } = setup(
        [['FE', 1.0], ['QA', 0.8], ['BE', 1.5]],
        [[0, ['FE']], [1, ['QA']], [2, ['BE']]],
        seed,
      )
      // dt = 1.5: FE (1.0) i QA (0.8 + 25 % tax = 1.0) jsou hotové; BE ještě čeká na obě
      tickN(state, ON, THREE_PHASE, 1.5, 1)
      expect(feature.tasks[0].status).toBe('done')
      expect(feature.tasks[1].status).toBe('done')
      expect(feature.reworkCount).toBe(0)

      tickN(state, ON, THREE_PHASE, 0.1, 1)
      expect(feature.reworkCount).toBe(1)
      expect(feature.tasks[returned].status).toBe('todo')
      expect(feature.tasks[returned].progress).toBeCloseTo(0.5)
      expect(feature.tasks[kept].status).toBe('done')
    }
  })
})

// ───────────────────────────────────────────────────────────────────────────────
// Příklad 5 — souběžný start: tax ano, rework hned ne
// ───────────────────────────────────────────────────────────────────────────────

describe('feat-016 Příklad 5: souběžný start platí tax, rework čeká', () => {
  it('druhá jednotka zaplatí tax i při souběžném startu, první jednotka je zdarma', () => {
    const seed = findSeed(r => high(r(0, 0)))
    const { state, feature } = setup([['FE', 1.0], ['BE', 1.5]], [[0, ['FE']], [1, ['BE']]], seed)
    tickN(state, ON, FLAT, 0.1, 1)
    expect(feature.tasks.map(t => t.status)).toEqual(['doing', 'doing'])
    expect(feature.tasks[0].work).toBe(1.0)
    expect(feature.tasks[1].work).toBeCloseTo(1.875)
    expect(feature.joinCount).toBe(1)
    expect(feature.joinTaxSec).toBeCloseTo(0.375)
    expect(feature.pendingDivergence).toEqual([])
  })

  it('při kostce rozporu < 0.2 rozpor čeká (rework se hned neodehraje)', () => {
    const seed = findSeed(r => low(r(0, 0)))
    const { state, feature } = setup([['FE', 1.0], ['BE', 1.5]], [[0, ['FE']], [1, ['BE']]], seed)
    tickN(state, ON, FLAT, 0.1, 1)
    expect(feature.joinCount).toBe(1)
    expect(feature.reworkCount).toBe(0)
    expect(feature.pendingDivergence).toEqual([1])
  })

  it('jednotka, která se na featuru vrací (už na ní pracovala), nezaplatí nic', () => {
    const seed = findSeed(r => high(r(0, 0)))
    const { state, feature } = setup([['FE', 0.5], ['FE', 0.5], ['BE', 1.5]], [[0, ['FE']], [1, ['BE']]], seed)
    tickN(state, ON, FLAT, 0.5, 1)
    expect(feature.tasks[0].status).toBe('done')
    tickN(state, ON, FLAT, 0.1, 1)
    // Jednotka 0 bere druhý FE task — už na featuře pracovala
    expect(feature.tasks[1].status).toBe('doing')
    expect(feature.tasks[1].assignee).toBe(0)
    expect(feature.tasks[1].work).toBe(0.5)
    expect(feature.joinCount).toBe(1)
  })
})

// ───────────────────────────────────────────────────────────────────────────────
// Příklad 14 — rozpor se projeví při dokončení featury
// ───────────────────────────────────────────────────────────────────────────────

describe('feat-016 Příklad 14b: větve vyřešení rozporu při dokončení', () => {
  it('když čekající jednotka nemá žádný vlastní hotový task, vrátí se jeden libovolný hotový task', () => {
    // Připojení č. 0 (jednotka 1) s rozporem čeká; připojení č. 1 (jednotka 2) bez rozporu
    const seed = findSeed(r => low(r(0, 0)) && high(r(1, 0)))
    const { state, feature } = setup(
      [['FE', 1.0], ['BE', 0.8]],
      [[0, ['FE']], [1, ['BE']], [2, ['BE']]],
      seed,
    )
    tickN(state, ON, FLAT, 0.5, 1)
    expect(feature.pendingDivergence).toEqual([1])

    // Koučem odebraná role jednotce 1: její task se resetuje a převezme ho jednotka 2
    state.team[1].currentTask = null
    state.team[1].roles = []
    resetTaskProgress(feature, feature.tasks[1])
    for (let i = 0; i < 100 && feature.reworkCount === 0; i++) tickN(state, ON, FLAT, 0.5, 1)

    // Jednotka 1 nemá žádný hotový task → vrátí se jeden z hotových tasků (FE nebo BE) a feature se nedokončí
    expect(feature.reworkCount).toBe(1)
    expect(feature.status).toBe('in-progress')
    expect(feature.tasks.filter(t => t.status !== 'done')).toHaveLength(1)
    expect(feature.pendingDivergence).toEqual([])
  })

  it('rework se řetězí přes více připojení: dvě připojení s rozporem = dva reworky a feature se nakonec dokončí', () => {
    const seed = findSeed(r => low(r(0, 0)) && low(r(1, 0)))
    const { state, feature } = setup(
      [['FE', 1.0], ['BE', 1.0], ['QA', 1.0]],
      [[0, ['FE']], [1, ['BE']], [2, ['QA']]],
      seed,
    )
    runUntilFinished(state, ON, PHASED)
    expect(feature.status).toBe('done')
    expect(feature.joinCount).toBe(2)
    expect(feature.reworkCount).toBe(2)
    expect(feature.pendingDivergence).toEqual([])
  })
})

describe('feat-016 Příklad 2b: tax se počítá z původního work', () => {
  it('task vrácený reworkem a převzatý další jednotkou nezaplatí tax z už zdaněné práce', () => {
    // Připojení č. 0 (jednotka 1) s rozporem → čeká; připojení č. 1 (jednotka 2) bez rozporu
    const seed = findSeed(r => low(r(0, 0)) && high(r(1, 0)))
    const { state, feature } = setup(
      [['FE', 1.0], ['BE', 0.8]],
      [[0, ['FE']], [1, ['BE']], [2, ['BE']]],
      seed,
    )
    tickN(state, ON, FLAT, 0.5, 2)
    // Jednotka 1 zaplatila tax 0.2 (0.8 → 1.0); rozpor vrátil její BE task do todo
    expect(feature.tasks[1].status).toBe('todo')
    expect(feature.tasks[1].work).toBeCloseTo(1.0)

    // Jednotka 1 už BE nemá; task převezme nová jednotka 2 — druhý tax je 25 % z původních 0.8, ne z 1.0
    state.team[1].roles = []
    tickN(state, ON, FLAT, 0.1, 1)
    expect(feature.tasks[1].assignee).toBe(2)
    expect(feature.tasks[1].work).toBeCloseTo(0.8 + 0.2 + 0.2)
    expect(feature.joinTaxSec).toBeCloseTo(0.4)
    expect(feature.joinCount).toBe(2)
  })
})

describe('feat-016: historie jednotek (workedBy) a kopie featur', () => {
  it('workedBy se vede i při vypnutém overheadu (využívá ji režim Min units)', () => {
    const { state, feature } = setup([['FE', 1.0], ['BE', 1.5]], [[0, ['FE']], [1, ['BE']]], 1)
    tickN(state, OFF, FLAT, 0.1, 1)
    expect([...feature.workedBy].sort()).toEqual([0, 1])
    expect(feature.joinCount).toBe(0)
  })

  it('cloneFeatureFresh vytvoří nezávislá pole workedBy a pendingDivergence', () => {
    const state = makeInitialState(mulberry32(5), { ...BASE_SETTINGS, initialBacklog: 1 })
    const original = state.backlog[0]
    const copy = cloneFeatureFresh(original)
    copy.workedBy.push(7)
    copy.pendingDivergence.push(7)
    expect(original.workedBy).toEqual([])
    expect(original.pendingDivergence).toEqual([])
    expect(copy.coordSeed).toBe(original.coordSeed)
  })

  it('features doplněné přes minBacklog dostanou vlastní, navzájem různé coordSeed', () => {
    const settings: SimSettings = { ...BASE_SETTINGS, initialBacklog: 1, minBacklog: 5 }
    const state = makeInitialState(mulberry32(1), settings)
    tick(state, 0.1, settings, mulberry32(9), ROLE_META)
    const seeds = [...state.backlog, ...state.inProgress].map(f => f.coordSeed)
    expect(seeds.length).toBeGreaterThanOrEqual(5)
    expect(seeds.every(sd => sd !== 0)).toBe(true)
    expect(new Set(seeds).size).toBe(seeds.length)
  })
})

describe('feat-016: ID jednotek se v Cash Flow nikdy neopakují', () => {
  it('po smazání jednotky s nejvyšším ID dostane nová jednotka nové, dosud nepoužité ID', () => {
    const { result } = renderHook(() => useCashFlowSimSetup({ ...BASE_SETTINGS, initialBacklog: 5 }))
    const team = () => result.current.stateRef.current!.team
    act(() => { result.current.handleAddMember() })
    const addedId = Math.max(...team().map(m => m.id))
    act(() => { result.current.handleRemoveMember(addedId) })
    act(() => { result.current.handleAddMember() })
    const newId = Math.max(...team().map(m => m.id))
    expect(newId).toBeGreaterThan(addedId)
  })
})

describe('feat-016 Příklad 14: rozpor se projeví při dokončení featury', () => {
  it('feature se nedokončí; task rozjeté jednotky se vrátí do todo s poloviční ztrátou, pak se dokončí', () => {
    const seed = findSeed(r => low(r(0, 0)))
    // BE: 0.8 + 25 % tax = 1.0 → po 2 tickech po 0.5 s jsou FE i BE přesně hotové
    const { state, feature } = setup([['FE', 1.0], ['BE', 0.8]], [[0, ['FE']], [1, ['BE']]], seed)
    tickN(state, ON, FLAT, 0.5, 2)

    expect(feature.status).toBe('in-progress')
    expect(state.done).toHaveLength(0)
    expect(state.leadTimes).toHaveLength(0)
    expect(feature.reworkCount).toBe(1)
    expect(feature.reworkSec).toBeCloseTo(0.5)
    expect(feature.tasks[1].status).toBe('todo')
    expect(feature.tasks[1].progress).toBeCloseTo(0.5)
    expect(feature.tasks[0].status).toBe('done')
    expect(feature.pendingDivergence).toEqual([])

    // Jednotka 1 si vrácený task vezme zpět (už na featuře pracovala → bez nového taxu) a dokončí ho
    tickN(state, ON, FLAT, 0.5, 1)
    expect(feature.status).toBe('done')
    expect(state.done).toHaveLength(1)
    expect(feature.reworkCount).toBe(1)
    expect(feature.joinCount).toBe(1)
  })

  it('při kostce rozporu ≥ 0.2 se feature dokončí hned', () => {
    const seed = findSeed(r => high(r(0, 0)))
    const { state, feature } = setup([['FE', 1.0], ['BE', 0.8]], [[0, ['FE']], [1, ['BE']]], seed)
    tickN(state, ON, FLAT, 0.5, 2)
    expect(feature.status).toBe('done')
    expect(feature.reworkCount).toBe(0)
    expect(state.done).toHaveLength(1)
  })

  it('za každou čekající jednotku se vrací jeden task (dvě rozjeté jednotky = dva reworky)', () => {
    const seed = findSeed(r => low(r(0, 0)) && low(r(1, 0)))
    const { state, feature } = setup(
      [['FE', 1.0], ['BE', 0.8], ['QA', 0.8]],
      [[0, ['FE']], [1, ['BE']], [2, ['QA']]],
      seed,
    )
    tickN(state, ON, FLAT, 0.5, 2)

    expect(feature.status).toBe('in-progress')
    expect(feature.joinCount).toBe(2)
    expect(feature.reworkCount).toBe(2)
    expect(feature.tasks[0].status).toBe('done')
    expect(feature.tasks[1].status).toBe('todo')
    expect(feature.tasks[2].status).toBe('todo')
    expect(feature.pendingDivergence).toEqual([])
  })

  it('vrácený task po dokončení znovu nespustí rozpor, pokud nepřibyla další jednotka', () => {
    const seed = findSeed(r => low(r(0, 0)))
    const { state, feature } = setup([['FE', 1.0], ['BE', 0.8]], [[0, ['FE']], [1, ['BE']]], seed)
    runUntilFinished(state, ON, FLAT, 0.5)
    expect(feature.status).toBe('done')
    expect(feature.reworkCount).toBe(1)
  })
})

// ───────────────────────────────────────────────────────────────────────────────
// Příklad 6 — souhrnná procenta
// ───────────────────────────────────────────────────────────────────────────────

describe('feat-016 Příklad 6: souhrnná procenta v computeStats', () => {
  it('coordinationPct = Σ(joinTaxSec + reworkSec) / Σ cycle time × 100, s rozpadem', () => {
    const lts: LeadTimeEntry[] = [
      { id: 1, ms: 10, finishedAt: 10, handoffs: 0, joinTaxSec: 1, reworkSec: 0.5 },
      { id: 2, ms: 10, finishedAt: 12, handoffs: 0, joinTaxSec: 1, reworkSec: 0.5 },
    ]
    const stats = computeStats(lts)
    expect(stats.joinTaxPct).toBeCloseTo(10)
    expect(stats.reworkPct).toBeCloseTo(5)
    expect(stats.coordinationPct).toBeCloseTo(15)
  })

  it('záznamy bez joinTaxSec / reworkSec se počítají jako 0', () => {
    const stats = computeStats([{ id: 1, ms: 20, finishedAt: 20, handoffs: 2 }])
    expect(stats.joinTaxPct).toBe(0)
    expect(stats.reworkPct).toBe(0)
    expect(stats.coordinationPct).toBe(0)
  })

  it('prázdná historie vrací 0 %', () => {
    const stats = computeStats([])
    expect(stats.joinTaxPct).toBe(0)
    expect(stats.reworkPct).toBe(0)
    expect(stats.coordinationPct).toBe(0)
  })
})

// ───────────────────────────────────────────────────────────────────────────────
// Příklad 7 — dopad na Cycle Time a výnos
// ───────────────────────────────────────────────────────────────────────────────

describe('feat-016 Příklad 7: dopad na Cycle Time a výnos', () => {
  it('On má delší průměrný Cycle Time než Off (agregováno přes seedy)', () => {
    expect(meanOverSeeds(s => avgCycleTime(fullRun(s, ON)))).toBeGreaterThan(meanOverSeeds(s => avgCycleTime(fullRun(s, OFF))))
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

// ───────────────────────────────────────────────────────────────────────────────
// Příklady 9, 15 — silo vs. multiskill, Min units, počet jednotek
// ───────────────────────────────────────────────────────────────────────────────

describe('feat-016 Příklad 9: silo vs. multiskill v režimu Min units', () => {
  it('multiskill (6×) má nižší coordination overhead než silo', () => {
    const silo = meanOverSeeds(s => computeStats(fullRun(s, ON, 'silo', 'min-units').leadTimes).coordinationPct)
    const multi = meanOverSeeds(s => computeStats(fullRun(s, ON, 6, 'min-units').leadTimes).coordinationPct)
    expect(multi).toBeLessThan(silo)
    expect(multi).toBeLessThan(4)
  })

  it('multiskill (6×) má vyšší výnos ve stejném čase než silo', () => {
    let siloRev = 0
    let multiRev = 0
    for (const seed of SEEDS) {
      const silo = fullRun(seed, ON, 'silo', 'min-units')
      const multi = fullRun(seed, ON, 6, 'min-units')
      const t = Math.min(silo.simTime, multi.simTime)
      siloRev += computeRevenueAsOf(silo.done, t)
      multiRev += computeRevenueAsOf(multi.done, t)
    }
    expect(multiRev).toBeGreaterThan(siloRev)
  })
})

describe('feat-016 Příklad 15: víc jednotek na featuře = víc overheadu (Reduce WIP)', () => {
  it('coordination overhead roste s počtem jednotek: 2× < 3× < 6× multiskill', () => {
    const pct = (n: number) => meanOverSeeds(s => computeStats(fullRun(s, ON, n, 'reduce-wip').leadTimes).coordinationPct)
    const p2 = pct(2)
    const p3 = pct(3)
    const p6 = pct(6)
    expect(p2).toBeLessThan(p3)
    expect(p3).toBeLessThan(p6)
  })

  it('i při vyšším overheadu je Cycle Time 6× multiskill kratší než 2× multiskill (swarm koordinaci zaplatí, paralelismus se vyplatí)', () => {
    const ct = (n: number) => meanOverSeeds(s => avgCycleTime(fullRun(s, ON, n, 'reduce-wip')))
    expect(ct(6)).toBeLessThan(ct(2))
  })
})

// ───────────────────────────────────────────────────────────────────────────────
// Příklady 16, 17 — režim Min units
// ───────────────────────────────────────────────────────────────────────────────

describe('feat-016 Příklad 16: pravidlo režimu Min units', () => {
  /** Vytvoří task pro ruční sestavení scény. */
  const mk = (id: number, role: Role, status: Task['status'], assignee: number | null = null): Task =>
    ({ id, role, work: 1, progress: status === 'done' ? 1 : 0, status, assignee })

  /**
   * Scéna: jednotka U (id 0, role FE) je volná. F (priorita 2) je rozpracovaná a U na ní už pracovala;
   * H (priorita 1) je rozpracovaná, pracuje na ní jednotka V (id 1); G (priorita 3) je v backlogu a nikdo na ní nepracuje.
   *
   * @param fHasTodoForU - true = na F zbývá další FE task pro U; false = na F zbývá jen BE task, který U neumí
   * @returns Stav a ID tří featur
   */
  function scene(fHasTodoForU: boolean) {
    const state = makeInitialState(mulberry32(1), { ...BASE_SETTINGS, initialBacklog: 3 })
    const [F, H, G] = state.backlog
    H.priority = 1
    F.priority = 2
    G.priority = 3
    F.tasks = fHasTodoForU ? [mk(1, 'FE', 'done', 0), mk(2, 'FE', 'todo')] : [mk(1, 'FE', 'done', 0), mk(2, 'BE', 'todo')]
    H.tasks = [mk(3, 'FE', 'doing', 1), mk(4, 'FE', 'todo')]
    G.tasks = [mk(5, 'FE', 'todo'), mk(6, 'FE', 'todo')]
    for (const f of [F, H]) { f.status = 'in-progress'; f.startedAt = 0 }
    // Historie jednotek na featuře (vede ji tick()): U pracovala na F, V pracuje na H
    F.workedBy = [0]
    H.workedBy = [1]
    state.backlog = [G]
    state.inProgress = [H, F]
    state.team = [
      { id: 0, name: 'U', roles: ['FE'], currentTask: null, idleSec: 0 },
      { id: 1, name: 'V', roles: ['FE'], currentTask: { featureId: H.id, taskId: 3 }, idleSec: 0 },
    ]
    return { state, F, H, G }
  }

  /** Vrátí ID featury, kterou si jednotka U vybrala po jednom ticku v daném WIP módu (overhead Off). */
  function pickedFeature(wipMode: WipMode, fHasTodoForU: boolean): { picked: number | undefined; ids: { F: number; H: number; G: number } } {
    const { state, F, H, G } = scene(fHasTodoForU)
    tick(state, 0.1, OFF, NO_RNG, FLAT, 'priority', wipMode)
    return { picked: state.team[0].currentTask?.featureId, ids: { F: F.id, H: H.id, G: G.id } }
  }

  it('Min units: jednotka pokračuje na featuře, kde už pracovala, i když má nižší prioritu', () => {
    const { picked, ids } = pickedFeature('min-units', true)
    expect(picked).toBe(ids.F)
  })

  it('kontrast: Reduce WIP vezme rozpracovanou feature s nejvyšší prioritou (H) a Priority nový task z backlogu (G)', () => {
    const rw = pickedFeature('reduce-wip', true)
    expect(rw.picked).toBe(rw.ids.H)
    const pr = pickedFeature('priority', true)
    expect(pr.picked).toBe(pr.ids.G)
  })

  it('Min units: když na své featuře nic není, vybere feature, na které nepracuje žádná jiná jednotka (G), před rozpracovanou H', () => {
    const { picked, ids } = pickedFeature('min-units', false)
    expect(picked).toBe(ids.G)
  })

  it('kontrast: Reduce WIP by v téže situaci vzal rozpracovanou H', () => {
    const { picked, ids } = pickedFeature('reduce-wip', false)
    expect(picked).toBe(ids.H)
  })

  it('Min units: mezi dvěma čerstvými featurami rozhoduje priorita, a obě mají přednost před featurou, kde pracuje jiná jednotka', () => {
    const { state } = scene(false)
    // Druhá čerstvá feature s prioritou 2 — horší než H (1), ale lepší než G (3). Čistá priorita by
    // vzala H; pravidlo 2 musí vzít čerstvou featuru s nejlepší prioritou, tedy tuto.
    const extra = makeInitialState(mulberry32(2), { ...BASE_SETTINGS, initialBacklog: 1 }).backlog[0]
    extra.id = 99
    extra.priority = 2
    extra.tasks = [mk(7, 'FE', 'todo')]
    state.backlog.push(extra)
    tick(state, 0.1, OFF, NO_RNG, FLAT, 'priority', 'min-units')
    expect(state.team[0].currentTask?.featureId).toBe(99)
  })

  it('Min units: „znám featuru“ se pozná z workedBy i po reworku, který vrácenému tasku vynuloval assignee', () => {
    const { state, F } = scene(true)
    // Úkol, který U dělala, se vrátil reworkem: todo, progress 0.5, bez assignee — historii drží jen workedBy
    F.tasks = [{ id: 1, role: 'FE', work: 1, progress: 0.5, status: 'todo', assignee: null }, mk(2, 'BE', 'todo')]
    tick(state, 0.1, OFF, NO_RNG, FLAT, 'priority', 'min-units')
    expect(state.team[0].currentTask?.featureId).toBe(F.id)
  })
})

describe('feat-016 Příklad 17: Min units funguje i bez overheadu (Advanced)', () => {
  it('multiskill 6×: průměrný počet různých jednotek na featuru je při Min units výrazně nižší než při Reduce WIP', () => {
    const avgUnits = (wip: WipMode) => meanOverSeeds(s => {
      const done = fullRun(s, OFF, 6, wip).done
      return done.reduce((a, f) => a + distinctUnits(f), 0) / done.length
    })
    const minUnits = avgUnits('min-units')
    const reduceWip = avgUnits('reduce-wip')
    expect(minUnits).toBeLessThan(reduceWip - 1)
    expect(minUnits).toBeLessThan(1.5)
  })
})

// ───────────────────────────────────────────────────────────────────────────────
// Příklad 13 — kostky patří featuře
// ───────────────────────────────────────────────────────────────────────────────

describe('feat-016 Příklad 13: kostky patří featuře, ne pořadí ani týmu', () => {
  it('rozpor se stejným coordSeed dopadne stejně při sekvenčním předání i při souběžné práci', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const expected = low(coordinationRoll(seed, 0, 0)) ? 1 : 0

      // A: sekvenční (BE čeká na FE) → rozpor se odhalí při převzetí
      const a = setup([['FE', 1.0], ['BE', 1.5]], [[0, ['FE']], [1, ['BE']]], seed)
      runUntilFinished(a.state, ON, PHASED)
      // B: souběžná práce → rozpor se odhalí při dokončení
      const b = setup([['FE', 1.0], ['BE', 1.5]], [[0, ['FE']], [1, ['BE']]], seed)
      runUntilFinished(b.state, ON, FLAT)

      expect(a.feature.reworkCount).toBe(expected)
      expect(b.feature.reworkCount).toBe(expected)
    }
  })

  it('dvě featury v téže simulaci: každá se řídí jen svým coordSeed, ať je v backlogu první kterákoli', () => {
    const seedLow = findSeed(r => low(r(0, 0)))
    const seedHigh = findSeed(r => high(r(0, 0)))

    for (const [seedF, seedG] of [[seedLow, seedHigh], [seedHigh, seedLow]] as const) {
      const state = makeInitialState(mulberry32(1), { ...BASE_SETTINGS, initialBacklog: 2 })
      const [F, G] = state.backlog
      // Každá feature má vlastní role — vrácený task tak může převzít jen jeho původní vlastník (žádná
      // další připojení) a počet reworků je zcela dán kostkami featury
      F.tasks = [
        { id: 1, role: 'FE', work: 1.0, progress: 0, status: 'todo', assignee: null },
        { id: 2, role: 'BE', work: 1.5, progress: 0, status: 'todo', assignee: null },
      ]
      G.tasks = [
        { id: 3, role: 'QA', work: 1.0, progress: 0, status: 'todo', assignee: null },
        { id: 4, role: 'OPS', work: 1.5, progress: 0, status: 'todo', assignee: null },
      ]
      F.coordSeed = seedF
      G.coordSeed = seedG
      // Dvě jednotky na každé featuře souběžně: každá feature má právě jedno připojení (k = 0)
      state.team = [
        { id: 0, name: 'U0', roles: ['FE'], currentTask: null, idleSec: 0 },
        { id: 1, name: 'U1', roles: ['BE'], currentTask: null, idleSec: 0 },
        { id: 2, name: 'U2', roles: ['QA'], currentTask: null, idleSec: 0 },
        { id: 3, name: 'U3', roles: ['OPS'], currentTask: null, idleSec: 0 },
      ]
      runUntilFinished(state, ON, FLAT, 0.1)
      // Rozpor vznikne právě u featury, jejíž kostka slotu 0 je < 0.2 — a nezávisle na druhé featuře
      expect(F.reworkCount).toBe(low(coordinationRoll(seedF, 0, 0)) ? 1 : 0)
      expect(G.reworkCount).toBe(low(coordinationRoll(seedG, 0, 0)) ? 1 : 0)
      expect(F.reworkCount + G.reworkCount).toBe(1)
    }
  })
})

// ───────────────────────────────────────────────────────────────────────────────
// Příklad 11 — Reset reprodukuje běh
// ───────────────────────────────────────────────────────────────────────────────

describe('feat-016 Příklad 11: Reset reprodukuje běh', () => {
  it('stejný backlog a tým po Resetu dají identický běh (časy, Cycle Time, čítače i výnos)', () => {
    const state = makeInitialState(mulberry32(42), ON)
    runUntilFinished(state, ON, ROLE_META, DT)
    const first = runSummary(state)
    // Běh musí něco stát, jinak by test nic nehlídal
    expect(first.features.some(f => (f[1] as number) > 0)).toBe(true)

    resetFromSnapshot(state)
    runUntilFinished(state, ON, ROLE_META, DT)
    expect(runSummary(state)).toEqual(first)
  })

  it('dvě nezávislé simulace téhož seedu dají identický běh', () => {
    const a = fullRun(42, ON)
    const b = fullRun(42, ON)
    expect(runSummary(a)).toEqual(runSummary(b))
  })
})

// ───────────────────────────────────────────────────────────────────────────────
// Příklad 12 — pevný seed Cash Flow (hook)
// ───────────────────────────────────────────────────────────────────────────────

describe('feat-016 Příklad 12: pevný seed po načtení Cash Flow', () => {
  const CF_SETTINGS: SimSettings = { ...BASE_SETTINGS, initialBacklog: 20 }
  const fp42 = (roleMeta: Record<Role, RoleMeta>) => backlogFingerprint(makeInitialState(mulberry32(42), CF_SETTINGS, roleMeta))

  it('počáteční backlog nezávisí na Math.random — vzniká ze seedu 42', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.111)
    const first = renderHook(() => useCashFlowSimSetup(CF_SETTINGS))
    const fpFirst = backlogFingerprint(first.result.current.stateRef.current!)
    first.unmount()

    vi.spyOn(Math, 'random').mockReturnValue(0.777)
    const second = renderHook(() => useCashFlowSimSetup(CF_SETTINGS))
    const fpSecond = backlogFingerprint(second.result.current.stateRef.current!)

    expect(fpFirst).toBe(fpSecond)
    expect(fpFirst).toBe(fp42(PRESETS[0].roleMeta))
  })

  it('výběr presetu vytvoří vždy tentýž backlog (seed 42)', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.333)
    const { result } = renderHook(() => useCashFlowSimSetup(CF_SETTINGS))
    act(() => { result.current.handlePresetClick(PRESETS[1]) })
    expect(backlogFingerprint(result.current.stateRef.current!)).toBe(fp42(PRESETS[1].roleMeta))
  })

  it('„Generate new backlog“ zůstává náhodný — vytvoří jiný backlog než pevný seed', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const { result } = renderHook(() => useCashFlowSimSetup(CF_SETTINGS))
    const before = backlogFingerprint(result.current.stateRef.current!)
    act(() => { result.current.handleRegenerate() })
    expect(backlogFingerprint(result.current.stateRef.current!)).not.toBe(before)
  })
})

// ───────────────────────────────────────────────────────────────────────────────
// Reset tasku za běhu (odebrání role / jednotky)
// ───────────────────────────────────────────────────────────────────────────────

describe('feat-016: reset tasku za běhu (odebrání role / jednotky)', () => {
  /** Seed bez rozporu u prvních dvou připojení. */
  const noDivergence = () => findSeed(r => high(r(0, 0)) && high(r(1, 0)))

  /** Stav po připojení: jednotka 0 dokončila FE, jednotka 1 převzala BE (work 1.5 → 1.875). */
  function afterJoin() {
    const ctx = setup([['FE', 1.0], ['BE', 1.5]], [[0, ['FE']], [1, ['BE']], [2, ['BE']]], noDivergence())
    tickN(ctx.state, ON, PHASED, 1.0, 1)
    tickN(ctx.state, ON, PHASED, 0.1, 1)
    return ctx
  }

  it('resetTaskProgress vrátí task do todo bez assignee a s nulovým progresem', () => {
    const { feature } = afterJoin()
    const be = feature.tasks[1]
    resetTaskProgress(feature, be)
    expect(be.status).toBe('todo')
    expect(be.assignee).toBeNull()
    expect(be.progress).toBe(0)
  })

  it('resetTaskProgress vrátí přirážku z taxu — work i joinTaxSec; joinCount zůstává', () => {
    const { feature } = afterJoin()
    const be = feature.tasks[1]
    resetTaskProgress(feature, be)
    expect(be.work).toBeCloseTo(1.5)
    expect(feature.joinTaxSec).toBeCloseTo(0)
    expect(feature.joinCount).toBe(1)
  })

  it('po resetu a převzetí jinou jednotkou se tax nesčítá (work = 1.875, ne 2.34)', () => {
    const { state, feature } = afterJoin()
    const be = feature.tasks[1]
    // Simulace odebrání role jednotce 1: uvolnit jednotku a resetovat task
    state.team[1].currentTask = null
    state.team[1].roles = []
    resetTaskProgress(feature, be)

    tickN(state, ON, PHASED, 0.1, 1)
    expect(be.assignee).toBe(2)
    expect(be.work).toBeCloseTo(1.875)
    expect(feature.joinTaxSec).toBeCloseTo(0.375)
    expect(feature.joinCount).toBe(2)
  })
})
