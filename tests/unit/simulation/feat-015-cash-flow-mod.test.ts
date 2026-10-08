import { describe, it, expect } from 'vitest'
import { mulberry32, makeInitialState, tick, REVENUE_TICK_INTERVAL_SEC, computeRevenueAsOf } from '@/simulation/engine'
import type { SimSettings, Feature } from '@/types/simulation'

const DEFAULT_SETTINGS: SimSettings = {
  minBacklog: 0,
  wipLimit: 6,
  sizeVar: 0.4,
  roleVar: 0.5,
  initialBacklog: 20,
  minSpecializations: 1,
}

describe('feat-015: revenuePerTick generation', () => {
  it('assigns a revenuePerTick of at least 15 to every backlog feature', () => {
    const rng = mulberry32(42)
    const state = makeInitialState(rng, DEFAULT_SETTINGS)
    for (const f of state.backlog) {
      expect(f.revenuePerTick).toBeGreaterThanOrEqual(15)
    }
  })

  it('sorts revenuePerTick descending by priority (feature #1 earns the most)', () => {
    const rng = mulberry32(42)
    const state = makeInitialState(rng, DEFAULT_SETTINGS)
    const sortedByPriority = [...state.backlog].sort((a, b) => a.priority - b.priority)
    for (let i = 1; i < sortedByPriority.length; i++) {
      expect(sortedByPriority[i].revenuePerTick).toBeLessThanOrEqual(sortedByPriority[i - 1].revenuePerTick)
    }
  })

  it('produces a real Gaussian spread, not a constant value (aggregated over many seeds to avoid flakiness)', () => {
    const NUM_SEEDS = 50
    let topSum = 0
    let bottomSum = 0
    for (let seed = 0; seed < NUM_SEEDS; seed++) {
      const rng = mulberry32(seed)
      const state = makeInitialState(rng, DEFAULT_SETTINGS)
      const sorted = [...state.backlog].sort((a, b) => a.priority - b.priority)
      topSum += sorted[0].revenuePerTick
      bottomSum += sorted[sorted.length - 1].revenuePerTick
    }
    const topAvg = topSum / NUM_SEEDS
    const bottomAvg = bottomSum / NUM_SEEDS
    // Top-priority features must earn meaningfully more than bottom-priority ones on average.
    expect(topAvg).toBeGreaterThan(bottomAvg)
    expect(bottomAvg).toBeGreaterThanOrEqual(15)
  })
})

describe('feat-015: revenue accrual on tick', () => {
  /**
   * Vytvoří stav s jedinou featurou přesunutou rovnou do `done` — izoluje
   * revenue-accrual logiku od task-assignment logiky (ta je otestovaná jinde).
   */
  function makeDoneFeatureState(revenuePerTick: number, finishedAt = 0) {
    const rng = mulberry32(42)
    const settings: SimSettings = { ...DEFAULT_SETTINGS, initialBacklog: 1 }
    const state = makeInitialState(rng, settings)
    const feature = state.backlog.pop()!
    feature.status = 'done'
    feature.finishedAt = finishedAt
    feature.revenuePerTick = revenuePerTick
    feature.totalRevenue = 0
    feature.lastTickRevenue = null
    // Vlastní hodiny featury začínají v okamžiku dokončení — stejně jako v tick().
    feature.lastRevenueTickAt = finishedAt
    state.done.push(feature)
    return { state, settings, rng, feature }
  }

  it('adds revenuePerTick to totalRevenue and lastTickRevenue once REVENUE_TICK_INTERVAL_SEC has elapsed', () => {
    const { state, settings, rng, feature } = makeDoneFeatureState(300)
    tick(state, REVENUE_TICK_INTERVAL_SEC, settings, rng)
    expect(feature.totalRevenue).toBe(300)
    expect(feature.lastTickRevenue).toBe(300)
    expect(state.totalRevenueAllTime).toBe(300)
  })

  it('does not accrue revenue before the interval has elapsed', () => {
    const { state, settings, rng, feature } = makeDoneFeatureState(300)
    tick(state, REVENUE_TICK_INTERVAL_SEC - 0.1, settings, rng)
    expect(feature.totalRevenue).toBe(0)
    expect(feature.lastTickRevenue).toBeNull()
    expect(state.totalRevenueAllTime).toBe(0)
  })

  it('ticks each done feature independently, exactly 3s after its own completion — not on a shared cycle', () => {
    // Feature A dokončena v simTime=0, Feature B o 1.5s později v simTime=1.5.
    const { state, settings, rng, feature: featureA } = makeDoneFeatureState(300, 0)
    const featureB = state.backlog.pop() ?? { ...featureA, id: featureA.id + 1 }
    featureB.status = 'done'
    featureB.finishedAt = 1.5
    featureB.revenuePerTick = 150
    featureB.totalRevenue = 0
    featureB.lastTickRevenue = null
    featureB.lastRevenueTickAt = 1.5
    state.done.push(featureB)

    // simTime: 0 → 3.0 — A dosáhla svých 3s (tiká), B jen 1.5s od svého dokončení (netiká).
    tick(state, REVENUE_TICK_INTERVAL_SEC, settings, rng)
    expect(featureA.totalRevenue).toBe(300)
    expect(featureB.totalRevenue).toBe(0)

    // simTime: 3.0 → 4.5 — B dosáhla svých 3s (4.5-1.5=3.0, tiká poprvé),
    // A má od svého posledního ticku jen 1.5s (netiká podruhé).
    tick(state, 1.5, settings, rng)
    expect(featureA.totalRevenue).toBe(300)
    expect(featureB.totalRevenue).toBe(150)
    expect(state.totalRevenueAllTime).toBe(450)
  })

  it('leaves totalRevenue unchanged when tick() is never called (paused simulation)', () => {
    const { state, feature } = makeDoneFeatureState(300)
    expect(feature.totalRevenue).toBe(0)
    expect(state.totalRevenueAllTime).toBe(0)
  })
})

describe('feat-015: revenue is speed-invariant', () => {
  it('speed=1 and speed=10 yield the same totalRevenueAllTime for the same simTime', () => {
    // Stejný pattern jako 'speed=1 a speed=10 dávají stejný simTime' v engine.test.ts:
    // dtSim je vždy fixní, speed mění jen počet ticků za snímek (accumulated).
    const TARGET_DT_MS = 1000 / 60
    const ELAPSED_MS = TARGET_DT_MS
    const settings: SimSettings = { ...DEFAULT_SETTINGS, initialBacklog: 1 }
    // Dva revenue ticky = 2 × REVENUE_TICK_INTERVAL_SEC simulačního času.
    const TARGET_SIM_TIME = REVENUE_TICK_INTERVAL_SEC * 2

    const runWithSpeed = (speed: number) => {
      const rng = mulberry32(42)
      const state = makeInitialState(rng, settings)
      const feature = state.backlog.pop()!
      feature.status = 'done'
      feature.finishedAt = 0
      feature.revenuePerTick = 300
      feature.totalRevenue = 0
      feature.lastTickRevenue = null
      feature.lastRevenueTickAt = 0
      state.done.push(feature)

      let accumulated = 0
      let safetyTicks = 0
      while (state.simTime < TARGET_SIM_TIME && safetyTicks < 1_000_000) {
        accumulated += ELAPSED_MS * speed
        while (accumulated >= TARGET_DT_MS && state.simTime < TARGET_SIM_TIME) {
          tick(state, TARGET_DT_MS / 1000, settings, rng)
          accumulated -= TARGET_DT_MS
          safetyTicks++
        }
      }
      return state.totalRevenueAllTime
    }

    expect(runWithSpeed(1)).toBe(runWithSpeed(10))
    expect(runWithSpeed(1)).toBe(600)
  })
})

describe('feat-015: computeRevenueAsOf (time-matched revenue comparison)', () => {
  it('sums whole elapsed ticks for a single feature', () => {
    const result = computeRevenueAsOf([{ finishedAt: 0, revenuePerTick: 300 }], REVENUE_TICK_INTERVAL_SEC * 3)
    expect(result).toBe(900)
  })

  it('floors to the last completed tick — does not round up to the next boundary', () => {
    const result = computeRevenueAsOf([{ finishedAt: 0, revenuePerTick: 300 }], REVENUE_TICK_INTERVAL_SEC * 3 - 0.1)
    expect(result).toBe(600)
  })

  it('sums multiple features with different finishedAt/revenuePerTick, independent of array order', () => {
    const featureA = { finishedAt: 0, revenuePerTick: 300 }
    const featureB = { finishedAt: 1.5, revenuePerTick: 150 }
    // Stejný scénář jako 'ticks each done feature independently' výše: v simTime=4.5
    // A stihla 1 tick (300), B stihla 1 tick (150) → 450 celkem.
    const forward = computeRevenueAsOf([featureA, featureB], 4.5)
    const reversed = computeRevenueAsOf([featureB, featureA], 4.5)
    expect(forward).toBe(450)
    expect(reversed).toBe(450)
  })

  it('contributes 0 for a feature that has not finished yet (finishedAt: null)', () => {
    const result = computeRevenueAsOf([{ finishedAt: null, revenuePerTick: 300 }], 100)
    expect(result).toBe(0)
  })

  it('contributes 0 when simTime is before the feature\'s own finishedAt', () => {
    // Přesně scénář "předchozí běh dopočítaný zpětně dřív, než sám přirozeně skončil":
    // feature dokončena v simTime=50, dotaz na dřívější simTime=30.
    const result = computeRevenueAsOf([{ finishedAt: 50, revenuePerTick: 300 }], 30)
    expect(result).toBe(0)
  })

  it('returns 0 for an empty feature list', () => {
    expect(computeRevenueAsOf([], 100)).toBe(0)
  })

  it('matches the live tick() accrual loop at the same simTime', () => {
    const rng = mulberry32(42)
    const settings: SimSettings = { ...DEFAULT_SETTINGS, initialBacklog: 2 }
    const state = makeInitialState(rng, settings)
    const featureA = state.backlog.pop()!
    featureA.status = 'done'
    featureA.finishedAt = 0
    featureA.revenuePerTick = 300
    featureA.totalRevenue = 0
    featureA.lastTickRevenue = null
    featureA.lastRevenueTickAt = 0
    state.done.push(featureA)
    const featureB = state.backlog.pop()!
    featureB.status = 'done'
    featureB.finishedAt = 1.5
    featureB.revenuePerTick = 150
    featureB.totalRevenue = 0
    featureB.lastTickRevenue = null
    featureB.lastRevenueTickAt = 1.5
    state.done.push(featureB)

    tick(state, REVENUE_TICK_INTERVAL_SEC, settings, rng)
    tick(state, 1.5, settings, rng)

    expect(computeRevenueAsOf(state.done, state.simTime)).toBe(state.totalRevenueAllTime)
    expect(computeRevenueAsOf([featureA], state.simTime)).toBe(featureA.totalRevenue)
    expect(computeRevenueAsOf([featureB], state.simTime)).toBe(featureB.totalRevenue)
  })

  it('reconstructs revenue retroactively at an earlier simTime than the run\'s current point', () => {
    const rng = mulberry32(42)
    const settings: SimSettings = { ...DEFAULT_SETTINGS, initialBacklog: 1 }
    const state = makeInitialState(rng, settings)
    const feature = state.backlog.pop()!
    feature.status = 'done'
    feature.finishedAt = 0
    feature.revenuePerTick = 300
    feature.totalRevenue = 0
    feature.lastTickRevenue = null
    feature.lastRevenueTickAt = 0
    state.done.push(feature)

    // Dotiknout na simTime = REVENUE_TICK_INTERVAL_SEC (1 tick, +300) a zachytit
    // totalRevenueAllTime v tomto dřívějším okamžiku T.
    tick(state, REVENUE_TICK_INTERVAL_SEC, settings, rng)
    const revenueAtEarlierT = state.totalRevenueAllTime
    const earlierT = state.simTime

    // Simulace pokračuje dál (další tick, +300) — živé číslo teď roste dál.
    tick(state, REVENUE_TICK_INTERVAL_SEC, settings, rng)
    expect(state.totalRevenueAllTime).toBeGreaterThan(revenueAtEarlierT)

    // Zpětný dopočet k dřívějšímu T musí odpovídat tomu, co bylo tehdy skutečně nasbíráno.
    expect(computeRevenueAsOf(state.done, earlierT)).toBe(revenueAtEarlierT)
  })
})

describe('feat-015: doneOverflow keeps evicted features earning (code review fix)', () => {
  /** Minimální hotová feature přímo v `done` listu — bez task-completion mechaniky. */
  function makeFinishedFeature(id: number, revenuePerTick: number, finishedAt: number): Feature {
    return {
      id, name: `F-${id}`, hue: 0, tasks: [], createdAt: 0, startedAt: 0, finishedAt,
      status: 'done', priority: id, revenuePerTick, totalRevenue: 0,
      lastTickRevenue: null, lastRevenueTickAt: finishedAt, handoffCount: 0, reworkCount: 0, handoffSec: 0, reworkSec: 0, workedBy: [],
    }
  }

  /** Připraví stav se `state.done` naplněným přesně na cap (40) a jednu featuru
   *  v `inProgress` se všemi tasky hotovými — dokončí se hned na první tick(). */
  function makeStateAtCap() {
    const rng = mulberry32(42)
    const settings: SimSettings = { ...DEFAULT_SETTINGS, initialBacklog: 1 }
    const state = makeInitialState(rng, settings)
    state.backlog = []
    // Nejstarší (index 39, na konci pole — unshift() dává nové na začátek) má distinktivní
    // revenuePerTick, aby šla po evikci jednoznačně identifikovat.
    state.done = Array.from({ length: 40 }, (_, i) => makeFinishedFeature(i + 1, i === 39 ? 999 : 50, 0))
    const finishingFeature: Feature = {
      id: 41, name: 'F-41', hue: 0,
      tasks: [{ id: 1, role: 'FE', work: 1, progress: 1, status: 'done', assignee: 1 }],
      createdAt: 0, startedAt: 0, finishedAt: null, status: 'in-progress', priority: 41,
      revenuePerTick: 200, totalRevenue: 0, lastTickRevenue: null, lastRevenueTickAt: 0, handoffCount: 0, reworkCount: 0, handoffSec: 0, reworkSec: 0, workedBy: [],
    }
    state.inProgress = [finishingFeature]
    return { state, settings, rng }
  }

  it('evicts the oldest Done feature into doneOverflow once the 40-item cap is exceeded', () => {
    const { state, settings, rng } = makeStateAtCap()
    tick(state, 0, settings, rng)

    expect(state.done.length).toBe(40)
    expect(state.doneOverflow.length).toBe(1)
    expect(state.doneOverflow[0].revenuePerTick).toBe(999)
  })

  it('keeps accruing totalRevenueAllTime for a feature after it moves into doneOverflow', () => {
    const { state, settings, rng } = makeStateAtCap()
    tick(state, 0, settings, rng) // eviction happens here — no time has passed yet

    const revenueBeforeTick = state.totalRevenueAllTime
    tick(state, REVENUE_TICK_INTERVAL_SEC, settings, rng)

    // Overflow feature samotná musí přispět svým revenuePerTick (999) do celkového součtu —
    // bez fixu by state.doneOverflow neexistovalo a tato feature by přestala vydělávat.
    expect(state.totalRevenueAllTime).toBeGreaterThanOrEqual(revenueBeforeTick + 999)
    expect(state.doneOverflow[0].lastRevenueTickAt).toBe(REVENUE_TICK_INTERVAL_SEC)
  })
})
