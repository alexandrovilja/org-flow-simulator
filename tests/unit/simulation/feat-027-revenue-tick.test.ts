import { describe, it, expect } from 'vitest'
import {
  mulberry32, makeInitialState, tick, computeRevenueAsOf, plateauRevenuePerTick,
  REVENUE_TICK_INTERVAL_SEC, WORKING_DAYS_PER_WEEK,
} from '@/simulation/engine'
import type { SimSettings } from '@/types/simulation'

// feat-027 (Čas simulace v pracovních dnech) — tik výnosu je jeden pracovní týden.
//
// Schválený kontrakt (spec features/feat-027-cas-simulace-pracovni-dny.md, Příklady 10 a 17):
//  - Nový export `WORKING_DAYS_PER_WEEK = 5` v engine.ts; `REVENUE_TICK_INTERVAL_SEC` (název zůstává, feat-010)
//    se z něj odvodí, tedy 5 (dřív 3). Tik výnosu = 1 pracovní týden.
//  - Každá hotová featura vydělá výnos za týden po každých 5 pracovních dnech od svého dokončení; hodiny každé
//    featury běží nezávisle (feat-015). `computeRevenueAsOf` a `doneOverflow` interval převezmou samy.
//  - Příklad 17 (engine se nemění, jen interval tiku): simTime, Cycle Time featur, idleSec a pořadí dokončování
//    zůstávají číselně shodné. Hlídají to regresní testy feat-016 (otisky běhů; změnily se jen součty výnosů,
//    simTime „18.1500“ / „30.2000“ a otisky lead timů zůstaly).

const SETTINGS: SimSettings = {
  minBacklog: 0,
  wipLimit: 6,
  sizeVar: 0.4,
  roleVar: 0.5,
  initialBacklog: 1,
  minSpecializations: 1,
}

/** Stav s jednou hotovou Flat featurou dokončenou ve dni `finishedAt` a s výnosem `base` €/týden. */
function stateWithDoneFeature(base: number, finishedAt: number) {
  const rng = mulberry32(42)
  const state = makeInitialState(rng, SETTINGS)
  const feature = state.backlog.pop()!
  feature.status = 'done'
  feature.finishedAt = finishedAt
  feature.revenuePerTick = base
  feature.totalRevenue = 0
  feature.lastTickRevenue = null
  feature.lastRevenueTickAt = finishedAt
  feature.revenueProfile = 'flat'
  feature.revenueTickCount = 0
  state.done.push(feature)
  state.simTime = finishedAt
  return { state, rng, feature }
}

describe('feat-027: tik výnosu je jeden pracovní týden', () => {
  it('týden má 5 pracovních dnů', () => {
    expect(WORKING_DAYS_PER_WEEK).toBe(5)
  })

  it('REVENUE_TICK_INTERVAL_SEC = 1 týden = 5 pracovních dnů (dřív 3)', () => {
    expect(REVENUE_TICK_INTERVAL_SEC).toBe(WORKING_DAYS_PER_WEEK)
    expect(REVENUE_TICK_INTERVAL_SEC).toBe(5)
  })
})

describe('feat-027 Příklad 10: tik výnosu je týden', () => {
  it('živá smyčka: ve dni 16.875 featura nic nevydělala, ve dni 17 první tik (+€400), ve dni 22 druhý (celkem €800)', () => {
    // Featura dokončena ve dni 12. Kroky jsou mocniny dvojky (16.875 místo 16.9), aby byly součty simTime přesné.
    const { state, rng, feature } = stateWithDoneFeature(400, 12)

    tick(state, 4.875, SETTINGS, rng)
    expect(state.simTime).toBe(16.875)
    expect(feature.totalRevenue).toBe(0)
    expect(state.totalRevenueAllTime).toBe(0)

    tick(state, 0.125, SETTINGS, rng)
    expect(state.simTime).toBe(17)
    expect(feature.totalRevenue).toBe(400)
    expect(feature.lastTickRevenue).toBe(400)
    expect(feature.lastRevenueTickAt).toBe(17)

    tick(state, 5, SETTINGS, rng)
    expect(state.simTime).toBe(22)
    expect(feature.totalRevenue).toBe(800)
    expect(feature.lastRevenueTickAt).toBe(22)
    expect(state.totalRevenueAllTime).toBe(800)
  })

  it('vzorec computeRevenueAsOf: den 16.9 → 0, den 17.0 → €400, den 22.0 → €800', () => {
    const features = [{ finishedAt: 12, revenuePerTick: 400 }]
    expect(computeRevenueAsOf(features, 16.9)).toBe(0)
    expect(computeRevenueAsOf(features, 17)).toBe(400)
    expect(computeRevenueAsOf(features, 22)).toBe(800)
  })

  it('běh po 1/60 dne (krok smyčky v prohlížeči) dá stejný výnos jako vzorec: dva tiky za deset dní od dokončení', () => {
    const { state, rng } = stateWithDoneFeature(400, 12)
    // 22.5 = deset a půl dne po dokončení: dva celé týdny, třetí tik teprve ve dni 27
    while (state.simTime < 22.5) tick(state, 1 / 60, SETTINGS, rng)
    expect(state.totalRevenueAllTime).toBe(800)
    expect(computeRevenueAsOf(state.done, state.simTime)).toBe(800)
  })

  it('každá featura tiká podle svých hodin: dokončení ve dnech 12 a 14 → první tiky ve dnech 17 a 19', () => {
    const { state, rng, feature: first } = stateWithDoneFeature(400, 12)
    const second = { ...first, id: first.id + 1, finishedAt: 14, lastRevenueTickAt: 14, totalRevenue: 0, lastTickRevenue: null, revenueTickCount: 0, revenuePerTick: 100 }
    state.done.push(second)

    tick(state, 5, SETTINGS, rng) // den 17: první featura tiká, druhá je 3 dny od dokončení
    expect(first.totalRevenue).toBe(400)
    expect(second.totalRevenue).toBe(0)

    tick(state, 2, SETTINGS, rng) // den 19: druhá featura má za sebou týden
    expect(first.totalRevenue).toBe(400)
    expect(second.totalRevenue).toBe(100)
  })

  it('ustálený výnos J-curve je dvojnásobek základu: €800/týden při základu €400', () => {
    const { feature } = stateWithDoneFeature(400, 0)
    feature.revenueProfile = 'j-curve'
    expect(plateauRevenuePerTick(feature)).toBe(800)
    feature.revenueProfile = 'flat'
    expect(plateauRevenuePerTick(feature)).toBe(400)
  })
})
