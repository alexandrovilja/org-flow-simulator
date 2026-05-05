import { describe, it, expect } from 'vitest'
import { mulberry32, makeInitialState, tick } from '@/simulation/engine'
import { computeStats } from '@/simulation/engine'
import type { SimSettings, Role, RoleMeta } from '@/types/simulation'

/** Minimální roleConfig s jedinou aktivní rolí FE.
 *  Tím zajistíme, že každá feature obsahuje pouze FE tasky —
 *  s jedním FE členem se features zpracovávají čistě sériově. */
function singleRoleConfig(): Record<Role, RoleMeta> {
  return {
    FE:   { label: 'React',    color: '', level: 1, required: true },
    BE:   { label: 'Java',     color: '', level: 1, required: false },
    DSGN: { label: 'Design',   color: '', level: 1, required: false },
    QA:   { label: 'QA',       color: '', level: 1, required: false },
    OPS:  { label: 'Ops',      color: '', level: 1, required: false },
    DATA: { label: 'Database', color: '', level: 1, required: false },
  }
}

/** Settings pro jednoduchý test — bez variability, bez doplňování backlogu. */
const BASE_SETTINGS: SimSettings = {
  minBacklog: 0,
  wipLimit: 10,
  sizeVar: 0,
  roleVar: 0,
  initialBacklog: 1,
  minSpecializations: 1,
}

// ---------------------------------------------------------------------------
// Cycle Time = finishedAt − startedAt (ne finishedAt − createdAt)
// ---------------------------------------------------------------------------

describe('feat-010: LeadTimeEntry.ms je Cycle Time (finishedAt − startedAt)', () => {
  it('feature čekající v backlogu má ms < (finishedAt − createdAt)', () => {
    // Dvě features, jeden FE člen — druhá feature čeká, než první skončí.
    // singleRoleConfig má pouze FE jako required a ostatní required=false.
    // activeRoles = 6, ale features dostávají 2 role (baseRoles=2, roleVar=0) —
    // FE (required) + 1 optional. Aby Ada mohla dokončit i optional role,
    // dáme jí všechny role.
    const cfg = singleRoleConfig()
    const settings: SimSettings = { ...BASE_SETTINGS, initialBacklog: 2 }
    const rng = mulberry32(42)
    const state = makeInitialState(rng, settings, cfg)

    // Ada má všechny role — zvládne jakýkoli task ve featurách
    state.team = [{ id: 1, name: 'Ada', roles: ['FE', 'BE', 'DSGN', 'QA', 'OPS', 'DATA'], currentTask: null, idleSec: 0 }]

    for (let i = 0; i < 2000; i++) {
      tick(state, 0.1, settings, rng, cfg)
      if (state.done.length >= 2) break
    }

    expect(state.leadTimes.length).toBe(2)

    // Oba záznamy mají ms > 0
    for (const lt of state.leadTimes) {
      expect(lt.ms).toBeGreaterThan(0)
    }

    // Druhá dokončená feature musela čekat v backlogu (Ada musela nejdřív dokončit první).
    // state.done je seřazen nejnovější první (unshift) → done[0] je druhá dokončená.
    const secondDone = state.done[0]
    expect(secondDone.startedAt).not.toBeNull()
    expect(secondDone.startedAt!).toBeGreaterThan(0)

    // Cycle Time (ms) = finishedAt − startedAt; protože startedAt > createdAt (=0),
    // musí být Cycle Time < Lead Time (finishedAt − createdAt = finishedAt − 0)
    const secondEntry = state.leadTimes[1]
    const leadTimeOld = (secondDone.finishedAt ?? 0) - secondDone.createdAt
    expect(secondEntry.ms).toBeLessThan(leadTimeOld)
  })

  it('feature zpracovaná okamžitě má Cycle Time ≈ finishedAt − startedAt', () => {
    // Jediná feature, jeden člen — nastoupí hned v prvním ticku (startedAt ≈ 0.1)
    const cfg = singleRoleConfig()
    const settings: SimSettings = { ...BASE_SETTINGS, initialBacklog: 1 }
    const rng = mulberry32(1)
    const state = makeInitialState(rng, settings, cfg)
    state.team = [{ id: 1, name: 'Ada', roles: ['FE', 'BE', 'DSGN', 'QA', 'OPS', 'DATA'], currentTask: null, idleSec: 0 }]

    for (let i = 0; i < 2000; i++) {
      tick(state, 0.1, settings, rng, cfg)
      if (state.done.length >= 1) break
    }

    expect(state.leadTimes.length).toBe(1)
    const lt = state.leadTimes[0]
    const f = state.done[0]

    expect(f.startedAt).not.toBeNull()
    expect(f.finishedAt).not.toBeNull()

    // ms musí přesně odpovídat finishedAt − startedAt
    const expectedCycleTime = f.finishedAt! - f.startedAt!
    expect(lt.ms).toBeCloseTo(expectedCycleTime, 9)
  })

  it('ms je vždy kladné číslo pro všechny dokončené features', () => {
    const cfg = singleRoleConfig()
    const settings: SimSettings = { ...BASE_SETTINGS, initialBacklog: 5 }
    const rng = mulberry32(99)
    const state = makeInitialState(rng, settings, cfg)
    state.team = [{ id: 1, name: 'Ada', roles: ['FE', 'BE', 'DSGN', 'QA', 'OPS', 'DATA'], currentTask: null, idleSec: 0 }]

    for (let i = 0; i < 5000; i++) {
      tick(state, 0.1, settings, rng, cfg)
      if (state.finished) break
    }

    expect(state.leadTimes.length).toBeGreaterThan(0)
    for (const lt of state.leadTimes) {
      expect(lt.ms).toBeGreaterThan(0)
    }
  })
})

// ---------------------------------------------------------------------------
// computeStats — pracuje se správnou hodnotou ms (Cycle Time)
// ---------------------------------------------------------------------------

describe('feat-010: computeStats zpracovává Cycle Time hodnoty', () => {
  it('avg odráží průměr hodnot ms', () => {
    const entries = [
      { id: 1, ms: 4, finishedAt: 10, handoffs: 0 },
      { id: 2, ms: 6, finishedAt: 20, handoffs: 0 },
    ]
    const stats = computeStats(entries)
    expect(stats.avg).toBeCloseTo(5, 9)
  })

  it('p50 a p85 jsou správné percentily', () => {
    // sorted = [2, 4, 6, 8]
    // p50 = sorted[floor(4 * 0.5)] = sorted[2] = 6
    // p85 = sorted[floor(4 * 0.85)] = sorted[3] = 8
    const entries = [
      { id: 1, ms: 2, finishedAt: 2,  handoffs: 0 },
      { id: 2, ms: 4, finishedAt: 6,  handoffs: 0 },
      { id: 3, ms: 6, finishedAt: 12, handoffs: 0 },
      { id: 4, ms: 8, finishedAt: 20, handoffs: 0 },
    ]
    const stats = computeStats(entries)
    expect(stats.p50).toBe(6)
    expect(stats.p85).toBe(8)
  })
})
