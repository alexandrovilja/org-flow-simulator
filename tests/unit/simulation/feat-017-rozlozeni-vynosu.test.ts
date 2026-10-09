import { describe, it, expect } from 'vitest'
import {
  mulberry32, makeInitialState, tick, resetFromSnapshot, regenerate, computeRevenueAsOf,
  REVENUE_TICK_INTERVAL_SEC, applyPreset, PRESETS,
  revenueMultiplier, cumulativeRevenueMultiplier, revenuePlateau, plateauRevenuePerTick, setRevenueProfile,
} from '@/simulation/engine'
import { parseRows } from '@/lib/xlsImport'
import type { SimSettings, SimState, Feature, RevenueProfile } from '@/types/simulation'

// feat-017: Rozložení výnosu v čase (Flat / J-curve / S-curve).
// Tvar křivky je čistá funkce (profil, k), kde k = pořadí revenue ticku od dokončení featury
// (k = 1 je první tik, 3 s po dokončení). Profil je štítek na featuře, žádný RNG.
// Nové exporty engine.ts, které tyto testy předpokládají: revenueMultiplier, cumulativeRevenueMultiplier,
// revenuePlateau, setRevenueProfile. Nová pole Feature: revenueProfile, revenueTickCount.
// Nové pole SimSettings: revenueProfile? (chybějící = 'flat').

const BASE_SETTINGS: SimSettings = {
  minBacklog: 0,
  wipLimit: 6,
  sizeVar: 0.4,
  roleVar: 0.5,
  initialBacklog: 20,
  minSpecializations: 1,
}

const PROFILES: RevenueProfile[] = ['flat', 'j-curve', 's-curve']

/** Krok ticku pro celé běhy — mocnina dvojky, aby součty simTime byly přesné (žádné float posuny hranic ticků). */
const DT = 0.125

// Referenční tabulka multiplikátorů ze specu (k = 1..12), zaokrouhleno na 3 desetinná místa.
const S_TABLE = [0.066, 0.170, 0.317, 0.489, 0.656, 0.788, 0.878, 0.933, 0.964, 0.981, 0.990, 0.995]
const J_TABLE = [0.213, 0.231, 0.274, 0.372, 0.571, 0.901, 1.299, 1.629, 1.828, 1.926, 1.969, 1.987]

/** Součet multiplikátorů m(1..n) spočítaný naivně — referenční implementace pro porovnání. */
function naiveCumulative(profile: RevenueProfile, n: number): number {
  let sum = 0
  for (let k = 1; k <= n; k++) sum += revenueMultiplier(profile, k)
  return sum
}

// ───────────────────────────────────────────────────────────────────────────────
// Tvar křivek — čisté funkce
// ───────────────────────────────────────────────────────────────────────────────

describe('feat-017: tvar křivek (revenueMultiplier)', () => {
  it('Flat: multiplikátor je pro každý tik přesně 1', () => {
    for (let k = 1; k <= 60; k++) expect(revenueMultiplier('flat', k)).toBe(1)
  })

  it('S-curve odpovídá referenční tabulce ze specu (k = 1..12)', () => {
    S_TABLE.forEach((expected, i) => expect(revenueMultiplier('s-curve', i + 1)).toBeCloseTo(expected, 3))
  })

  it('J-curve odpovídá referenční tabulce ze specu (k = 1..12)', () => {
    J_TABLE.forEach((expected, i) => expect(revenueMultiplier('j-curve', i + 1)).toBeCloseTo(expected, 3))
  })

  it('S-curve roste monotónně, nikdy nepřekročí 1 a dospívá k plató 1', () => {
    let prev = 0
    for (let k = 1; k <= 60; k++) {
      const m = revenueMultiplier('s-curve', k)
      expect(m).toBeGreaterThanOrEqual(prev)
      expect(m).toBeLessThanOrEqual(1)
      prev = m
    }
    expect(revenueMultiplier('s-curve', 60)).toBeCloseTo(1, 6)
  })

  it('J-curve je vždy kladná (žádný propad), roste monotónně a dospívá k plató 2', () => {
    let prev = 0
    for (let k = 1; k <= 60; k++) {
      const m = revenueMultiplier('j-curve', k)
      expect(m).toBeGreaterThan(0)
      expect(m).toBeGreaterThanOrEqual(prev)
      prev = m
    }
    // Start je nízký, ale kladný (≈ 0,21).
    expect(revenueMultiplier('j-curve', 1)).toBeGreaterThan(0.2)
    expect(revenueMultiplier('j-curve', 1)).toBeLessThan(0.25)
    expect(revenueMultiplier('j-curve', 60)).toBeCloseTo(2, 6)
  })

  it('J-curve překročí úroveň Flat (1×) mezi 6. a 7. tikem', () => {
    expect(revenueMultiplier('j-curve', 6)).toBeLessThan(1)
    expect(revenueMultiplier('j-curve', 7)).toBeGreaterThan(1)
  })

  it('revenuePlateau: Flat 1×, S-curve 1×, J-curve 2×', () => {
    expect(revenuePlateau('flat')).toBe(1)
    expect(revenuePlateau('s-curve')).toBe(1)
    expect(revenuePlateau('j-curve')).toBe(2)
  })
})

describe('feat-017: plateauRevenuePerTick (číslo „€/tick“ na kartě i v Done listu)', () => {
  it('základ × plató profilu: Flat a S-curve základ, J-curve dvojnásobek', () => {
    expect(plateauRevenuePerTick({ revenuePerTick: 400, revenueProfile: 'flat' })).toBe(400)
    expect(plateauRevenuePerTick({ revenuePerTick: 400, revenueProfile: 's-curve' })).toBe(400)
    expect(plateauRevenuePerTick({ revenuePerTick: 400, revenueProfile: 'j-curve' })).toBe(800)
  })

  it('odpovídá násobku, ke kterému tik křivky skutečně dospěje', () => {
    for (const profile of PROFILES) {
      const plateau = plateauRevenuePerTick({ revenuePerTick: 100, revenueProfile: profile })
      expect(plateau).toBeCloseTo(100 * revenueMultiplier(profile, 60), 6)
    }
  })
})

describe('feat-017: kumulativní multiplikátor (cumulativeRevenueMultiplier)', () => {
  it('pro n = 0 je součet 0', () => {
    for (const p of PROFILES) expect(cumulativeRevenueMultiplier(p, 0)).toBe(0)
  })

  it('odpovídá naivnímu součtu m(1..n) pro n = 1..80 (včetně ocasu za předpočítanou tabulkou)', () => {
    for (const p of PROFILES) {
      for (let n = 1; n <= 80; n++) {
        expect(cumulativeRevenueMultiplier(p, n)).toBeCloseTo(naiveCumulative(p, n), 9)
      }
    }
  })

  it('J-curve dožene Flat v kumulativním výnosu po 11. tiku (33 s), ne dřív', () => {
    expect(cumulativeRevenueMultiplier('j-curve', 10)).toBeLessThan(10)
    expect(cumulativeRevenueMultiplier('j-curve', 11)).toBeGreaterThan(11)
  })

  it('po 15 tikách (45 s) je kumulativní násobek základu: Flat 15, S-curve ≈ 11,2, J-curve ≈ 19,2', () => {
    expect(cumulativeRevenueMultiplier('flat', 15)).toBeCloseTo(15, 9)
    expect(cumulativeRevenueMultiplier('s-curve', 15)).toBeCloseTo(11.22, 1)
    expect(cumulativeRevenueMultiplier('j-curve', 15)).toBeCloseTo(19.19, 1)
  })

  it('S-curve je v kumulativním výnosu vždy pod Flat (stejné plató, ale pozdější start)', () => {
    for (let n = 1; n <= 60; n++) expect(cumulativeRevenueMultiplier('s-curve', n)).toBeLessThan(n)
  })
})

// ───────────────────────────────────────────────────────────────────────────────
// Accrual v tick() — příklady 1–4 a 16
// ───────────────────────────────────────────────────────────────────────────────

describe('feat-017: revenue accrual v tick() podle profilu', () => {
  /**
   * Stav s jedinou featurou přesunutou rovnou do `done` — izoluje accrual od přiřazování tasků
   * (stejný přístup jako ve feat-015). `finishedAt` posune i simTime, aby šlo ověřit křivku od dokončení.
   */
  function makeDoneFeatureState(base: number, profile: RevenueProfile, finishedAt = 0) {
    const rng = mulberry32(42)
    const settings: SimSettings = { ...BASE_SETTINGS, initialBacklog: 1 }
    const state = makeInitialState(rng, settings)
    const feature = state.backlog.pop()!
    feature.status = 'done'
    feature.finishedAt = finishedAt
    feature.revenuePerTick = base
    feature.totalRevenue = 0
    feature.lastTickRevenue = null
    feature.lastRevenueTickAt = finishedAt
    feature.revenueProfile = profile
    feature.revenueTickCount = 0
    state.done.push(feature)
    state.simTime = finishedAt
    return { state, settings, rng, feature }
  }

  /** Odtikuje `n` revenue ticků (každý jeden interval) a vrátí přírůstek z každého z nich. */
  function collectTickAmounts(base: number, profile: RevenueProfile, n: number): number[] {
    const { state, settings, rng, feature } = makeDoneFeatureState(base, profile)
    const amounts: number[] = []
    for (let i = 0; i < n; i++) {
      tick(state, REVENUE_TICK_INTERVAL_SEC, settings, rng)
      amounts.push(feature.lastTickRevenue!)
    }
    return amounts
  }

  it('Příklad 1 — Flat: každý tik vydělá přesně základ, výsledek je shodný s chováním před feat-017', () => {
    const { state, settings, rng, feature } = makeDoneFeatureState(400, 'flat')
    for (let i = 1; i <= 5; i++) {
      tick(state, REVENUE_TICK_INTERVAL_SEC, settings, rng)
      expect(feature.lastTickRevenue).toBe(400)
      expect(feature.totalRevenue).toBe(400 * i)
    }
    expect(state.totalRevenueAllTime).toBe(2000)
  })

  it('Příklad 2 — S-curve (základ 400): tiky k = 1, 2, 3, 5 vydělají zhruba €26, €68, €127, €262 a nikdy nepřekročí €400', () => {
    const amounts = collectTickAmounts(400, 's-curve', 20)
    expect(Math.round(amounts[0])).toBe(26)
    expect(Math.round(amounts[1])).toBe(68)
    expect(Math.round(amounts[2])).toBe(127)
    expect(Math.round(amounts[4])).toBe(262)
    amounts.forEach((a, i) => {
      expect(a).toBeLessThanOrEqual(400)
      if (i > 0) expect(a).toBeGreaterThan(amounts[i - 1])
    })
  })

  it('Příklad 3 — J-curve (základ 400): tiky k = 1, 6, 7, 12 vydělají zhruba €85, €360, €520, €795 a plató se blíží €800', () => {
    const amounts = collectTickAmounts(400, 'j-curve', 40)
    expect(Math.round(amounts[0])).toBe(85)
    expect(Math.round(amounts[5])).toBe(360)
    expect(Math.round(amounts[6])).toBe(520)
    expect(Math.round(amounts[11])).toBe(795)
    expect(amounts[39]).toBeCloseTo(800, 6)
  })

  it('Příklad 4 — každý tik je kladný a Total Revenue nikdy neklesne (všechny profily)', () => {
    for (const profile of PROFILES) {
      const { state, settings, rng, feature } = makeDoneFeatureState(150, profile)
      let previousTotal = 0
      for (let i = 0; i < 30; i++) {
        tick(state, REVENUE_TICK_INTERVAL_SEC, settings, rng)
        expect(feature.lastTickRevenue!).toBeGreaterThan(0)
        expect(feature.totalRevenue).toBeGreaterThan(previousTotal)
        // První tik J-curve a S-curve je výrazně pod základem (jinak by profil nic nedělal).
        if (i === 0 && profile !== 'flat') expect(feature.lastTickRevenue!).toBeLessThan(40)
        previousTotal = feature.totalRevenue
      }
    }
  })

  it('součet po 15 tikách odpovídá základ × kumulativní multiplikátor (feature i state.totalRevenueAllTime)', () => {
    for (const profile of PROFILES) {
      const { state, settings, rng, feature } = makeDoneFeatureState(400, profile)
      for (let i = 0; i < 15; i++) tick(state, REVENUE_TICK_INTERVAL_SEC, settings, rng)
      const expected = 400 * cumulativeRevenueMultiplier(profile, 15)
      expect(feature.totalRevenue).toBeCloseTo(expected, 6)
      expect(state.totalRevenueAllTime).toBeCloseTo(expected, 6)
    }
  })

  it('revenueTickCount roste o 1 s každým připsaným tikem', () => {
    const { state, settings, rng, feature } = makeDoneFeatureState(400, 's-curve')
    expect(feature.revenueTickCount).toBe(0)
    tick(state, REVENUE_TICK_INTERVAL_SEC, settings, rng)
    expect(feature.revenueTickCount).toBe(1)
    tick(state, REVENUE_TICK_INTERVAL_SEC * 2, settings, rng) // dva tiky najednou (větší krok)
    expect(feature.revenueTickCount).toBe(3)
  })

  it('větší krok přes víc intervalů připíše správné k-té multiplikátory, ne jen poslední', () => {
    const { state, settings, rng, feature } = makeDoneFeatureState(400, 'j-curve')
    tick(state, REVENUE_TICK_INTERVAL_SEC * 3, settings, rng)
    expect(feature.totalRevenue).toBeCloseTo(400 * cumulativeRevenueMultiplier('j-curve', 3), 6)
    expect(feature.lastTickRevenue).toBeCloseTo(400 * revenueMultiplier('j-curve', 3), 6)
  })

  it('Příklad 16 — křivka se měří od dokončení featury, ne od startu běhu: dokončení v 12 s → první tik v 15 s s k = 1', () => {
    const { state, settings, rng, feature } = makeDoneFeatureState(400, 'j-curve', 12)
    tick(state, 2.5, settings, rng)
    expect(feature.totalRevenue).toBe(0)
    tick(state, 0.5, settings, rng)
    expect(state.simTime).toBe(15)
    expect(feature.lastRevenueTickAt).toBe(15)
    expect(feature.lastTickRevenue).toBeCloseTo(400 * revenueMultiplier('j-curve', 1), 9)
  })
})

// ───────────────────────────────────────────────────────────────────────────────
// computeRevenueAsOf — příklad 10
// ───────────────────────────────────────────────────────────────────────────────

describe('feat-017 Příklad 10: computeRevenueAsOf odpovídá živé smyčce pro všechny profily', () => {
  /** Tři hotové featury dokončené v různých časech (násobky 0,5 — přesné součty simTime). */
  function makeStateWithDoneFeatures(profile: RevenueProfile) {
    const rng = mulberry32(42)
    const settings: SimSettings = { ...BASE_SETTINGS, initialBacklog: 3 }
    const state = makeInitialState(rng, settings)
    const specs: Array<[number, number]> = [[0, 300], [1.5, 150], [4, 220]]
    for (const [finishedAt, base] of specs) {
      const f = state.backlog.pop()!
      f.status = 'done'
      f.finishedAt = finishedAt
      f.revenuePerTick = base
      f.totalRevenue = 0
      f.lastTickRevenue = null
      f.lastRevenueTickAt = finishedAt
      f.revenueProfile = profile
      f.revenueTickCount = 0
      state.done.push(f)
    }
    return { state, settings, rng }
  }

  const runTo = (state: SimState, settings: SimSettings, rng: () => number, until: number, step = 0.5) => {
    while (state.simTime < until) tick(state, step, settings, rng)
  }

  /** Očekávaný Total Revenue v čase T pro featury z makeStateWithDoneFeatures, spočítaný přímo z multiplikátorů. */
  const expectedTotalAt = (t: number, profile: RevenueProfile): number =>
    ([[0, 300], [1.5, 150], [4, 220]] as Array<[number, number]>).reduce(
      (sum, [finishedAt, base]) =>
        sum + base * cumulativeRevenueMultiplier(profile, Math.floor((t - finishedAt) / REVENUE_TICK_INTERVAL_SEC)), 0)

  for (const profile of PROFILES) {
    it(`${profile}: součet i hodnoty jednotlivých featur sedí s živým totalRevenueAllTime`, () => {
      const { state, settings, rng } = makeStateWithDoneFeatures(profile)
      runTo(state, settings, rng, 45)
      expect(computeRevenueAsOf(state.done, 45)).toBeCloseTo(state.totalRevenueAllTime, 6)
      for (const f of state.done) expect(computeRevenueAsOf([f], 45)).toBeCloseTo(f.totalRevenue, 6)
      // Nezávislé očekávání přes multiplikátory (jinak by smyčka i vzorec mohly ignorovat profil stejně).
      expect(state.totalRevenueAllTime).toBeCloseTo(expectedTotalAt(45, profile), 6)
    })

    it(`${profile}: retroaktivní dopočet k dřívějšímu času odpovídá tomu, co bylo tehdy skutečně nasbíráno`, () => {
      const { state, settings, rng } = makeStateWithDoneFeatures(profile)
      runTo(state, settings, rng, 20)
      const capturedAt20 = state.totalRevenueAllTime
      expect(capturedAt20).toBeCloseTo(expectedTotalAt(20, profile), 6)
      runTo(state, settings, rng, 45)
      expect(state.totalRevenueAllTime).toBeGreaterThan(capturedAt20)
      expect(computeRevenueAsOf(state.done, 20)).toBeCloseTo(capturedAt20, 6)
    })
  }

  it('záznam bez revenueProfile (starý snapshot předchozího běhu) se počítá jako Flat', () => {
    expect(computeRevenueAsOf([{ finishedAt: 0, revenuePerTick: 400 }], 9)).toBe(1200)
  })

  it('záznam s profilem (zjednodušený snapshot CashFlowRunSnapshot.doneFeatures) respektuje tvar křivky', () => {
    const expected = 400 * cumulativeRevenueMultiplier('s-curve', 3)
    expect(computeRevenueAsOf([{ finishedAt: 0, revenuePerTick: 400, revenueProfile: 's-curve' }], 9)).toBeCloseTo(expected, 9)
  })

  it('featura dokončená až po zadaném čase (nebo ještě nedokončená) přispívá 0 i u J-curve', () => {
    expect(computeRevenueAsOf([{ finishedAt: 30, revenuePerTick: 400, revenueProfile: 'j-curve' }], 20)).toBe(0)
    expect(computeRevenueAsOf([{ finishedAt: null, revenuePerTick: 400, revenueProfile: 'j-curve' }], 20)).toBe(0)
  })
})

// ───────────────────────────────────────────────────────────────────────────────
// Rychlost simulace — příklad 11
// ───────────────────────────────────────────────────────────────────────────────

describe('feat-017 Příklad 11: výnos nezávisí na kroku ani rychlosti simulace', () => {
  it('J-curve: krok 0,5 s, 1,5 s a 3 s dají stejný Total Revenue ve stejném simTime', () => {
    const run = (dt: number) => {
      const rng = mulberry32(42)
      const settings: SimSettings = { ...BASE_SETTINGS, initialBacklog: 1 }
      const state = makeInitialState(rng, settings)
      const f = state.backlog.pop()!
      f.status = 'done'
      f.finishedAt = 0
      f.revenuePerTick = 300
      f.lastRevenueTickAt = 0
      f.revenueProfile = 'j-curve'
      f.revenueTickCount = 0
      state.done.push(f)
      while (state.simTime < 45) tick(state, dt, settings, rng)
      return state.totalRevenueAllTime
    }
    const reference = run(0.5)
    expect(reference).toBeCloseTo(300 * cumulativeRevenueMultiplier('j-curve', 15), 6)
    expect(run(1.5)).toBeCloseTo(reference, 6)
    expect(run(3)).toBeCloseTo(reference, 6)
  })
})

// ───────────────────────────────────────────────────────────────────────────────
// doneOverflow — příklad 12
// ───────────────────────────────────────────────────────────────────────────────

describe('feat-017 Příklad 12: vytěsněné featury si drží tvar křivky', () => {
  /** Minimální hotová featura přímo v `done` — bez task-completion mechaniky. */
  function makeFinishedFeature(id: number, base: number, ticksPaid: number, profile: RevenueProfile): Feature {
    return {
      id, name: `F-${id}`, hue: 0, tasks: [], createdAt: 0, startedAt: 0, finishedAt: 0,
      status: 'done', priority: id, revenuePerTick: base, totalRevenue: 0,
      lastTickRevenue: null, lastRevenueTickAt: ticksPaid * REVENUE_TICK_INTERVAL_SEC,
      revenueProfile: profile, revenueTickCount: ticksPaid,
      joinCount: 0, reworkCount: 0, joinTaxSec: 0, reworkSec: 0, workedBy: [], pendingDivergence: [], coordSeed: 0,
    }
  }

  /**
   * Done list přesně na capu (40), všechny featury už vyplatily `ticksPaid` tiků (simTime = ticksPaid × 3 s)
   * a jedna featura v inProgress se dokončí hned na první tick(). Nejstarší (id 40, základ 999) se vytěsní
   * do `doneOverflow` uprostřed života křivky (výchozí: mezi 4. a 5. tikem).
   */
  function makeStateAtCap(ticksPaid = 4) {
    const rng = mulberry32(42)
    const settings: SimSettings = { ...BASE_SETTINGS, initialBacklog: 1 }
    const state = makeInitialState(rng, settings)
    state.backlog = []
    state.simTime = ticksPaid * REVENUE_TICK_INTERVAL_SEC
    state.done = Array.from({ length: 40 }, (_, i) => makeFinishedFeature(i + 1, i === 39 ? 999 : 50, ticksPaid, 'j-curve'))
    const finishing: Feature = {
      id: 41, name: 'F-41', hue: 0,
      tasks: [{ id: 1, role: 'FE', work: 1, progress: 1, status: 'done', assignee: 1 }],
      createdAt: 0, startedAt: 0, finishedAt: null, status: 'in-progress', priority: 41,
      revenuePerTick: 200, totalRevenue: 0, lastTickRevenue: null, lastRevenueTickAt: 0,
      revenueProfile: 'j-curve', revenueTickCount: 0,
      joinCount: 0, reworkCount: 0, joinTaxSec: 0, reworkSec: 0, workedBy: [], pendingDivergence: [], coordSeed: 0,
    }
    state.inProgress = [finishing]
    return { state, settings, rng }
  }

  it('záznam v doneOverflow nese profil a počet už vyplacených ticků', () => {
    const { state, settings, rng } = makeStateAtCap()
    tick(state, 0, settings, rng)
    expect(state.doneOverflow.length).toBe(1)
    expect(state.doneOverflow[0].revenuePerTick).toBe(999)
    expect(state.doneOverflow[0].revenueProfile).toBe('j-curve')
    expect(state.doneOverflow[0].revenueTickCount).toBe(4)
  })

  it('další tik vytěsněné featury je 5. tik křivky (nezačíná znovu od k = 1)', () => {
    const { state, settings, rng } = makeStateAtCap()
    tick(state, 0, settings, rng) // vytěsnění, zatím neuplynul žádný čas
    const before = state.totalRevenueAllTime
    tick(state, REVENUE_TICK_INTERVAL_SEC, settings, rng)
    // 39 starších featur a overflow platí k = 5, nově dokončená featura (id 41) platí k = 1.
    const expectedDelta =
      revenueMultiplier('j-curve', 5) * (39 * 50 + 999) + revenueMultiplier('j-curve', 1) * 200
    expect(state.totalRevenueAllTime - before).toBeCloseTo(expectedDelta, 6)
    expect(state.doneOverflow[0].revenueTickCount).toBe(5)
  })

  it('computeRevenueAsOf přes done + doneOverflow sedí s totalRevenueAllTime (křivka od k = 1 pro všechny, i vytěsněnou)', () => {
    // Žádný předstíraný náskok: všechny featury (i ta, která se vytěsní) začínají od k = 1 v čase 0.
    const { state, settings, rng } = makeStateAtCap(0)
    tick(state, 0, settings, rng)
    expect(state.doneOverflow.length).toBe(1)
    tick(state, REVENUE_TICK_INTERVAL_SEC * 5, settings, rng)
    // 39 starších featur po 50, vytěsněná po 999 a nově dokončená po 200 — všechny vyplatily 5 tiků křivky J.
    expect(state.totalRevenueAllTime).toBeCloseTo((39 * 50 + 999 + 200) * cumulativeRevenueMultiplier('j-curve', 5), 6)
    expect(computeRevenueAsOf([...state.done, ...state.doneOverflow], state.simTime))
      .toBeCloseTo(state.totalRevenueAllTime, 6)
  })
})

// ───────────────────────────────────────────────────────────────────────────────
// Generování backlogu a přepnutí profilu — příklady 5, 13, 14, 15
// ───────────────────────────────────────────────────────────────────────────────

/** Otisk backlogu bez profilu — slouží k ověření, že přepnutí mění jen tvar křivky. */
function backlogFingerprint(state: SimState): string {
  return JSON.stringify(state.backlog.map(f => ({
    id: f.id, name: f.name, priority: f.priority, revenuePerTick: f.revenuePerTick, coordSeed: f.coordSeed,
    tasks: f.tasks.map(t => [t.id, t.role, t.work]),
  })))
}

describe('feat-017: profil při generování backlogu', () => {
  it('výchozí profil (settings bez revenueProfile) je flat; featury mají revenueTickCount 0', () => {
    const state = makeInitialState(mulberry32(42), BASE_SETTINGS)
    for (const f of [...state.backlog, ...state.backlogSnapshot]) {
      expect(f.revenueProfile).toBe('flat')
      expect(f.revenueTickCount).toBe(0)
    }
  })

  it.each(PROFILES)('settings.revenueProfile = %s se zapíše na všechny featury backlogu i snapshotu', profile => {
    const state = makeInitialState(mulberry32(42), { ...BASE_SETTINGS, revenueProfile: profile })
    expect(state.backlog.length).toBeGreaterThan(0)
    for (const f of [...state.backlog, ...state.backlogSnapshot]) expect(f.revenueProfile).toBe(profile)
  })

  it('Příklad 5 — stejný seed a jiný profil dají identický backlog kromě tvaru křivky', () => {
    const states = PROFILES.map(p => makeInitialState(mulberry32(42), { ...BASE_SETTINGS, revenueProfile: p }))
    states.forEach((s, i) => expect(s.backlog.every(f => f.revenueProfile === PROFILES[i])).toBe(true))
    const fingerprints = states.map(backlogFingerprint)
    expect(fingerprints[1]).toBe(fingerprints[0])
    expect(fingerprints[2]).toBe(fingerprints[0])
  })

  it('profil neposune sekvenci RNG (další hodnota po generování je stejná pro všechny profily)', () => {
    const nextValues = PROFILES.map(p => {
      const rng = mulberry32(42)
      const state = makeInitialState(rng, { ...BASE_SETTINGS, revenueProfile: p })
      expect(state.backlog.every(f => f.revenueProfile === p)).toBe(true)
      return rng()
    })
    expect(nextValues[1]).toBe(nextValues[0])
    expect(nextValues[2]).toBe(nextValues[0])
  })

  it('Příklad 13 — regenerate („Generate new backlog“) zachová zvolený profil', () => {
    const { state } = regenerate({ ...BASE_SETTINGS, revenueProfile: 's-curve' })
    for (const f of [...state.backlog, ...state.backlogSnapshot]) expect(f.revenueProfile).toBe('s-curve')
  })

  it('Příklad 13 — featury z XLS importu mají flat a revenueTickCount 0 (aktuální profil jim nastaví hook)', () => {
    const result = parseRows([
      { Feature: 'Login', Specializace: 'FE', Tym: 'Squad A', Velikost: 3 },
      { Feature: 'Login', Specializace: 'BE', Tym: 'Squad B', Velikost: 2 },
    ])
    for (const f of result.features) {
      expect(f.revenueProfile).toBe('flat')
      expect(f.revenueTickCount).toBe(0)
    }
  })

  it('Reset (resetFromSnapshot) zachová profil a vynuluje revenueTickCount', () => {
    const state = makeInitialState(mulberry32(42), { ...BASE_SETTINGS, revenueProfile: 'j-curve' })
    state.backlogSnapshot[0].revenueTickCount = 7 // předstíráme zbytek po předchozím běhu
    resetFromSnapshot(state)
    for (const f of state.backlog) {
      expect(f.revenueProfile).toBe('j-curve')
      expect(f.revenueTickCount).toBe(0)
    }
  })
})

describe('feat-017 Příklad 5/6: setRevenueProfile (přepnutí zachová backlog a vrátí simulaci na začátek)', () => {
  /** Stav s týmem z presetu, částečně odběhnutý, aby bylo vidět, že přepnutí běh zahodí. */
  function makeRunningState(profile: RevenueProfile = 'flat') {
    const preset = PRESETS[0]
    const settings: SimSettings = { ...BASE_SETTINGS, initialBacklog: 6, revenueProfile: profile }
    const rng = mulberry32(7)
    const state = makeInitialState(rng, settings, preset.roleMeta)
    state.team = applyPreset(preset).team
    for (let i = 0; i < 160; i++) tick(state, DT, settings, rng, preset.roleMeta)
    return { state, settings, rng }
  }

  it('přepíše profil na backlogu i snapshotu všech featur', () => {
    const { state } = makeRunningState('flat')
    setRevenueProfile(state, 'j-curve')
    expect(state.backlog.length).toBeGreaterThan(0)
    for (const f of [...state.backlog, ...state.backlogSnapshot]) expect(f.revenueProfile).toBe('j-curve')
  })

  it('vrátí simulaci na začátek: žádná rozpracovaná ani hotová práce, nulový čas a výnos', () => {
    const { state } = makeRunningState('flat')
    expect(state.simTime).toBeGreaterThan(0) // předpoklad testu: běh už začal
    setRevenueProfile(state, 's-curve')
    expect(state.simTime).toBe(0)
    expect(state.startedAt).toBeNull()
    expect(state.finished).toBe(false)
    expect(state.inProgress).toEqual([])
    expect(state.done).toEqual([])
    expect(state.doneOverflow).toEqual([])
    expect(state.totalRevenueAllTime).toBe(0)
    expect(state.backlog.length).toBe(state.backlogSnapshot.length)
  })

  it('zachová stejný backlog (featury, tasky, priority, základní výnos) i tým', () => {
    const { state } = makeRunningState('flat')
    const fingerprintBefore = backlogFingerprint(makeInitialState(mulberry32(7), { ...BASE_SETTINGS, initialBacklog: 6 }, PRESETS[0].roleMeta))
    const teamIdsBefore = state.team.map(m => m.id)
    setRevenueProfile(state, 'j-curve')
    expect(backlogFingerprint(state)).toBe(fingerprintBefore)
    expect(state.team.map(m => m.id)).toEqual(teamIdsBefore)
    for (const m of state.team) expect(m.currentTask).toBeNull()
  })

  it('mutuje stav na místě a vrací tentýž objekt (jako resetFromSnapshot)', () => {
    const { state } = makeRunningState('flat')
    expect(setRevenueProfile(state, 's-curve')).toBe(state)
  })
})

// ───────────────────────────────────────────────────────────────────────────────
// Celý běh — příklady 7, 14, 15
// ───────────────────────────────────────────────────────────────────────────────

describe('feat-017: celý běh se stejným backlogem a týmem', () => {
  /** Doběhne celý backlog (6 featur, tým z presetu Teams) a vrátí finální stav. */
  function runToEnd(profile: RevenueProfile | undefined, seed = 7): SimState {
    const preset = PRESETS[0]
    const settings: SimSettings = { ...BASE_SETTINGS, initialBacklog: 6, ...(profile ? { revenueProfile: profile } : {}) }
    const rng = mulberry32(seed)
    const state = makeInitialState(rng, settings, preset.roleMeta)
    state.team = applyPreset(preset).team
    let steps = 0
    while (!state.finished && steps < 200_000) {
      tick(state, DT, settings, rng, preset.roleMeta)
      steps++
    }
    expect(state.finished).toBe(true)
    return state
  }

  it('Příklad 15 — Flat (explicitní i výchozí) dává přesně výnos podle vzorce z feat-015: floor(věk / 3) × základ', () => {
    for (const profile of ['flat', undefined] as const) {
      const state = runToEnd(profile)
      const expected = [...state.done, ...state.doneOverflow].reduce(
        (sum, f) => sum + Math.floor((state.simTime - f.finishedAt!) / REVENUE_TICK_INTERVAL_SEC) * f.revenuePerTick, 0)
      expect(state.totalRevenueAllTime).toBeCloseTo(expected, 6)
    }
  })

  it('Flat explicitně a bez nastavení profilu dají shodný běh i výnos', () => {
    const explicit = runToEnd('flat')
    const implicit = runToEnd(undefined)
    expect(explicit.simTime).toBe(implicit.simTime)
    expect(explicit.totalRevenueAllTime).toBe(implicit.totalRevenueAllTime)
  })

  it('Příklad 7 — profil nemění tok práce: stejný backlog a tým dají stejné časy a Cycle Time', () => {
    const flat = runToEnd('flat')
    for (const profile of ['j-curve', 's-curve'] as const) {
      const other = runToEnd(profile)
      expect(other.backlogSnapshot.every(f => f.revenueProfile === profile)).toBe(true)
      expect(other.simTime).toBe(flat.simTime)
      expect(other.leadTimes.map(l => [l.id, l.ms, l.finishedAt])).toEqual(flat.leadTimes.map(l => [l.id, l.ms, l.finishedAt]))
    }
  })

  it('Příklad 7 — ve stejném čase vydělá S-curve míň než Flat (time-matched srovnání přes computeRevenueAsOf)', () => {
    const flat = runToEnd('flat')
    const s = runToEnd('s-curve')
    const t = Math.min(flat.simTime, s.simTime)
    const flatAtT = computeRevenueAsOf([...flat.done, ...flat.doneOverflow], t)
    const sAtT = computeRevenueAsOf([...s.done, ...s.doneOverflow], t)
    expect(flatAtT).toBeGreaterThan(0)
    expect(sAtT).toBeLessThan(flatAtT)
  })

  it('Příklad 14 — Reset reprodukuje běh přesně (čas, Cycle Time, výnos celkový i po featurách)', () => {
    const preset = PRESETS[0]
    const settings: SimSettings = { ...BASE_SETTINGS, initialBacklog: 6, revenueProfile: 'j-curve' }
    const rng = mulberry32(7)
    const state = makeInitialState(rng, settings, preset.roleMeta)
    state.team = applyPreset(preset).team
    expect(state.backlogSnapshot.every(f => f.revenueProfile === 'j-curve')).toBe(true)
    const runOnce = () => {
      let steps = 0
      while (!state.finished && steps < 200_000) {
        tick(state, DT, settings, rng, preset.roleMeta)
        steps++
      }
      return {
        simTime: state.simTime,
        total: state.totalRevenueAllTime,
        leadTimes: state.leadTimes.map(l => [l.id, l.ms]),
        perFeature: state.done.map(f => [f.id, f.finishedAt]).sort(),
        overflowFinishedAt: state.doneOverflow.map(o => o.finishedAt),
      }
    }
    const first = runOnce()
    resetFromSnapshot(state)
    const second = runOnce()
    expect(second).toEqual(first)
    expect(first.total).toBeGreaterThan(0)
  })
})
