import { describe, it, expect } from 'vitest'
import { computeRevenueComparison } from '@/lib/revenueComparison'
import type { CurrentRunRevenue, PreviousRunRevenue } from '@/lib/revenueComparison'
import { computeRevenueAsOf } from '@/simulation/engine'

// feat-018 (Time-matched revenue) — čistá logika dlaždice „Revenue (time-matched)“.
//
// Kontrakt nového modulu `src/lib/revenueComparison.ts` (mimo Simulator.tsx, aby šel testovat):
//
//   computeRevenueComparison(current: CurrentRunRevenue, previous: PreviousRunRevenue | null): RevenueComparison
//
//   CurrentRunRevenue  = { finished: boolean; simTime: number; totalRevenue: number; features: RunFeatureRevenue[] }
//   PreviousRunRevenue = { totalTime: number; totalRevenue: number; doneFeatures: RunFeatureRevenue[] }
//   RunFeatureRevenue  = Pick<Feature, 'finishedAt' | 'revenuePerTick'> & { revenueProfile?: RevenueProfile }
//
//   RevenueComparison = {
//     value: number                  // velké číslo dlaždice
//     currentTotal: { revenue: number; time: number }   // celkový výnos aktuálního běhu a jeho čas (detail)
//     comparison?: {                 // jen když se srovnává (aktuální běh doběhl A existuje předchozí běh)
//       compareTime: number          // T_compare = min(časy obou běhů)
//       delta?: number               // % změna oproti předchozímu běhu ve společném čase; undefined = bez delty
//       previous: { revenueAtCompare: number; totalRevenue: number; totalTime: number }
//     }
//   }
//
// Výpočet výnosu ke společnému času využívá stávající `computeRevenueAsOf` (engine se nemění).
// Když je společný čas konec vlastního běhu, `value` je skutečně nasbíraný `totalRevenue`.

/** Pomocná featura: Flat profil, pevný výnos 100 €/tik, dokončená v čase `finishedAt`. */
const flat = (finishedAt: number) => ({ finishedAt, revenuePerTick: 100, revenueProfile: 'flat' as const })

// Pomalejší běh A: featury hotové v 6, 12, 24 s (Total Time 24 s).
//  výnos v 24 s: 100·⌊18/3⌋ + 100·⌊12/3⌋ + 0 = 600 + 400 = 1000
//  výnos ve 12 s: 100·⌊6/3⌋ + 0 (feature hotová přesně ve 12 s ještě neměla tik) = 200
const RUN_A_FEATURES = [flat(6), flat(12), flat(24)]
const RUN_A_TOTAL_TIME = 24
const RUN_A_TOTAL_REVENUE = 1000

// Rychlejší běh B: featury hotové ve 3, 6, 12 s (Total Time 12 s).
//  výnos ve 12 s: 100·⌊9/3⌋ + 100·⌊6/3⌋ + 0 = 300 + 200 = 500
const RUN_B_FEATURES = [flat(3), flat(6), flat(12)]
const RUN_B_TOTAL_TIME = 12
const RUN_B_TOTAL_REVENUE = 500

const runAAsCurrent: CurrentRunRevenue = {
  finished: true, simTime: RUN_A_TOTAL_TIME, totalRevenue: RUN_A_TOTAL_REVENUE, features: RUN_A_FEATURES,
}
const runBAsCurrent: CurrentRunRevenue = {
  finished: true, simTime: RUN_B_TOTAL_TIME, totalRevenue: RUN_B_TOTAL_REVENUE, features: RUN_B_FEATURES,
}
const runAAsPrevious: PreviousRunRevenue = {
  totalTime: RUN_A_TOTAL_TIME, totalRevenue: RUN_A_TOTAL_REVENUE, doneFeatures: RUN_A_FEATURES,
}
const runBAsPrevious: PreviousRunRevenue = {
  totalTime: RUN_B_TOTAL_TIME, totalRevenue: RUN_B_TOTAL_REVENUE, doneFeatures: RUN_B_FEATURES,
}

describe('feat-018: computeRevenueComparison', () => {
  describe('Příklad 1: živý běh bez předchozího běhu', () => {
    it('ukáže kumulativní výnos běhu, bez delty a bez společného času', () => {
      const result = computeRevenueComparison(
        { finished: false, simTime: 10, totalRevenue: 3000, features: [] },
        null,
      )
      expect(result.value).toBe(3000)
      expect(result.comparison).toBeUndefined()
    })

    it('detail ukáže celkový výnos a aktuální simTime', () => {
      const result = computeRevenueComparison(
        { finished: false, simTime: 10, totalRevenue: 3000, features: [] },
        null,
      )
      expect(result.currentTotal).toEqual({ revenue: 3000, time: 10 })
    })

    it('doběhnutý běh bez předchozího běhu ukáže finální výnos, bez delty', () => {
      const result = computeRevenueComparison(runBAsCurrent, null)
      expect(result.value).toBe(RUN_B_TOTAL_REVENUE)
      expect(result.comparison).toBeUndefined()
    })

    it('předchozí běh existuje, ale aktuální ještě neběží do konce: ukáže živý kumulativní výnos, bez delty', () => {
      const result = computeRevenueComparison(
        { finished: false, simTime: 6, totalRevenue: 100, features: [flat(3)] },
        runAAsPrevious,
      )
      expect(result.value).toBe(100)
      expect(result.comparison).toBeUndefined()
    })
  })

  describe('Příklad 2: aktuální běh je kratší než předchozí', () => {
    // aktuální = rychlejší B (12 s), předchozí = pomalejší A (24 s)
    const result = computeRevenueComparison(runBAsCurrent, runAAsPrevious)

    it('společný čas je kratší z obou časů', () => {
      expect(result.comparison?.compareTime).toBe(12)
    })

    it('velké číslo je výnos aktuálního běhu ve společném čase', () => {
      expect(result.value).toBeCloseTo(500, 6)
    })

    it('delta je +150 % (500 vs. 200 ve společném čase 12 s)', () => {
      expect(result.comparison?.delta).toBeCloseTo(150, 6)
    })

    it('detail nese celkový výnos aktuálního běhu a data předchozího běhu', () => {
      expect(result.currentTotal).toEqual({ revenue: RUN_B_TOTAL_REVENUE, time: RUN_B_TOTAL_TIME })
      expect(result.comparison?.previous.revenueAtCompare).toBeCloseTo(200, 6)
      expect(result.comparison?.previous.totalRevenue).toBe(RUN_A_TOTAL_REVENUE)
      expect(result.comparison?.previous.totalTime).toBe(RUN_A_TOTAL_TIME)
    })
  })

  describe('Příklad 3: aktuální běh je delší než předchozí', () => {
    // aktuální = pomalejší A (24 s), předchozí = rychlejší B (12 s)
    const result = computeRevenueComparison(runAAsCurrent, runBAsPrevious)

    it('společný čas je kratší z obou časů', () => {
      expect(result.comparison?.compareTime).toBe(12)
    })

    it('velké číslo je výnos dopočtený k společnému času (200), ne celkových 1000', () => {
      expect(result.value).toBeCloseTo(200, 6)
      expect(result.value).not.toBeCloseTo(RUN_A_TOTAL_REVENUE, 0)
    })

    it('delta je −60 % (200 vs. 500 ve společném čase 12 s)', () => {
      expect(result.comparison?.delta).toBeCloseTo(-60, 6)
    })

    it('detail nese skutečný celkový výnos a čas aktuálního běhu a data předchozího běhu', () => {
      expect(result.currentTotal).toEqual({ revenue: RUN_A_TOTAL_REVENUE, time: RUN_A_TOTAL_TIME })
      expect(result.comparison?.previous.revenueAtCompare).toBeCloseTo(500, 6)
      expect(result.comparison?.previous.totalRevenue).toBe(RUN_B_TOTAL_REVENUE)
      expect(result.comparison?.previous.totalTime).toBe(RUN_B_TOTAL_TIME)
    })
  })

  describe('Příklad 4: předchozí běh nevydělal nic ve společném čase', () => {
    // předchozí běh má jedinou featuru hotovou ve 20 s → ve 12 s je jeho výnos 0
    const previousZero: PreviousRunRevenue = { totalTime: 24, totalRevenue: 100, doneFeatures: [flat(20)] }
    const result = computeRevenueComparison(runBAsCurrent, previousZero)

    it('velké číslo se zobrazí (výnos aktuálního běhu ve společném čase)', () => {
      expect(result.value).toBeCloseTo(500, 6)
    })

    it('delta chybí (dělení nulou)', () => {
      expect(result.comparison?.delta).toBeUndefined()
    })

    it('výnos předchozího běhu ve společném čase je 0', () => {
      expect(result.comparison?.previous.revenueAtCompare).toBe(0)
    })
  })

  describe('shoda s engine a profily výnosu (feat-017)', () => {
    it('výnosy ve společném čase odpovídají computeRevenueAsOf, včetně J-curve a S-curve', () => {
      const current: CurrentRunRevenue = {
        finished: true,
        simTime: 60,
        totalRevenue: 0, // pro srovnání ve společném čase (30 s) se nepoužije
        features: [
          { finishedAt: 3, revenuePerTick: 100, revenueProfile: 'j-curve' },
          { finishedAt: 9, revenuePerTick: 150, revenueProfile: 's-curve' },
        ],
      }
      const previousFeatures = [{ finishedAt: 3, revenuePerTick: 100, revenueProfile: 'flat' as const }]
      const previous: PreviousRunRevenue = {
        totalTime: 30,
        totalRevenue: computeRevenueAsOf(previousFeatures, 30), // v čase 30 s je to skutečný výnos běhu
        doneFeatures: previousFeatures,
      }
      const result = computeRevenueComparison(current, previous)
      expect(result.comparison?.compareTime).toBe(30)
      expect(result.value).toBeCloseTo(computeRevenueAsOf(current.features, 30), 6)
      expect(result.comparison?.previous.revenueAtCompare).toBeCloseTo(computeRevenueAsOf(previous.doneFeatures, 30), 6)
    })

    it('když je společný čas konec vlastního běhu, value je skutečný totalRevenue, ne uzavřený dopočet', () => {
      // totalRevenue záměrně o tik jinak než dopočet (500): simulace a uzavřený vzorec se mohou
      // rozejít kvůli zaokrouhlení času; „Total“ v detailu musí sedět s velkým číslem
      const current: CurrentRunRevenue = { ...runBAsCurrent, totalRevenue: 600 }
      const result = computeRevenueComparison(current, runAAsPrevious)
      expect(result.comparison?.compareTime).toBe(RUN_B_TOTAL_TIME)
      expect(result.value).toBe(600)
      expect(result.currentTotal.revenue).toBe(600)
    })

    it('identické běhy se srovnají přesně: delta je přesně 0 (žádný float šum)', () => {
      // totalRevenue záměrně s float šumem oproti uzavřenému dopočtu — obě strany jsou ve svém konci,
      // takže se použije skutečný výnos a delta musí vyjít přesně 0
      const current: CurrentRunRevenue = { ...runBAsCurrent, totalRevenue: 500.0000000001 }
      const previous: PreviousRunRevenue = { ...runBAsPrevious, totalRevenue: 500.0000000001 }
      const result = computeRevenueComparison(current, previous)
      expect(result.comparison?.delta).toBe(0)
    })

    it('featura bez revenueProfile se počítá jako Flat (starší snapshoty)', () => {
      const legacy: PreviousRunRevenue = {
        totalTime: 12, totalRevenue: 500,
        doneFeatures: [{ finishedAt: 3, revenuePerTick: 100 }, { finishedAt: 6, revenuePerTick: 100 }],
      }
      const result = computeRevenueComparison(runAAsCurrent, legacy)
      expect(result.comparison?.previous.revenueAtCompare).toBeCloseTo(500, 6)
    })
  })
})
