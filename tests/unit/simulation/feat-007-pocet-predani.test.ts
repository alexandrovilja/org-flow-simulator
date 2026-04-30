import { describe, it, expect } from 'vitest'
import { mulberry32, makeInitialState, tick, ROLE_META } from '@/simulation/engine'
import { computeHandoffs, computeStats } from '@/simulation/engine'
import type { Feature, Task, SimSettings, Role, RoleMeta } from '@/types/simulation'

const SETTINGS: SimSettings = {
  minBacklog: 0,
  wipLimit: 10,
  sizeVar: 0,
  roleVar: 0,
  initialBacklog: 3,
  minSpecializations: 1,
}

/** Sestaví minimální Task objekt pro testování handoffů. */
function makeTask(id: number, role: Role, assignee: number): Task {
  return { id, role, work: 1, progress: 1, status: 'done', assignee }
}

/** Sestaví minimální Feature objekt se zadanými tasky. */
function makeFeature(tasks: Task[]): Feature {
  return {
    id: 1,
    name: 'F-001 Test',
    hue: 12,
    priority: 1,
    tasks,
    createdAt: 0,
    startedAt: 0,
    finishedAt: 10,
    status: 'done',
  }
}

/** Vytvoří kopii ROLE_META s přepsanými levely pro konkrétní role. */
function roleConfig(overrides: Partial<Record<Role, Partial<RoleMeta>>>): Record<Role, RoleMeta> {
  const base = structuredClone(ROLE_META)
  for (const [r, patch] of Object.entries(overrides) as [Role, Partial<RoleMeta>][]) {
    Object.assign(base[r], patch)
  }
  return base
}

// ---------------------------------------------------------------------------
// computeHandoffs — unit testy
// ---------------------------------------------------------------------------

describe('feat-007: computeHandoffs', () => {
  it('specializovaný tým — různí lidé ve všech fázích', () => {
    // DSGN/Ada(1) → FE/Ben(2) + BE/Chen(2) → QA/Dana(3)
    // fáze 1→2: Ada ∉ {Ben, Chen} = 1
    // fáze 2→3: Ben ∉ {Dana} = 1, Chen ∉ {Dana} = 1
    // celkem = 3
    const cfg = roleConfig({
      DSGN: { level: 1 }, FE: { level: 2 }, BE: { level: 2 }, QA: { level: 3 },
    })
    const feature = makeFeature([
      makeTask(1, 'DSGN', 1), // Ada = id 1
      makeTask(2, 'FE',   2), // Ben = id 2
      makeTask(3, 'BE',   3), // Chen = id 3
      makeTask(4, 'QA',   4), // Dana = id 4
    ])
    expect(computeHandoffs(feature, cfg)).toBe(3)
  })

  it('cross-funkční člen překlenuje fáze 1 a 2', () => {
    // DSGN/Ada(1) → FE/Ben(2) + BE/Ada(2) → QA/Chen(3)
    // fáze 1→2: Ada ∈ {Ben, Ada} → 0 předání
    // fáze 2→3: Ben ∉ {Chen} → 1, Ada ∉ {Chen} → 1
    // celkem = 2
    const cfg = roleConfig({
      DSGN: { level: 1 }, FE: { level: 2 }, BE: { level: 2 }, QA: { level: 3 },
    })
    const feature = makeFeature([
      makeTask(1, 'DSGN', 1), // Ada = id 1
      makeTask(2, 'FE',   2), // Ben = id 2
      makeTask(3, 'BE',   1), // Ada = id 1 (cross-funkční)
      makeTask(4, 'QA',   3), // Chen = id 3
    ])
    expect(computeHandoffs(feature, cfg)).toBe(2)
  })

  it('stejný člen ve všech fázích — nula předání', () => {
    // FE/Ada(1) → QA/Ada(2): Ada ∈ {Ada} → 0 předání
    const cfg = roleConfig({ FE: { level: 1 }, QA: { level: 2 } })
    const feature = makeFeature([
      makeTask(1, 'FE', 1), // Ada
      makeTask(2, 'QA', 1), // Ada
    ])
    expect(computeHandoffs(feature, cfg)).toBe(0)
  })

  it('jedna fáze — žádný přechod', () => {
    // FE/Ada(1) + BE/Ben(1): všichni na stejné fázi, žádný přechod
    const cfg = roleConfig({ FE: { level: 1 }, BE: { level: 1 } })
    const feature = makeFeature([
      makeTask(1, 'FE', 1), // Ada
      makeTask(2, 'BE', 2), // Ben
    ])
    expect(computeHandoffs(feature, cfg)).toBe(0)
  })

  it('jediný task — nula předání', () => {
    const cfg = roleConfig({ FE: { level: 1 } })
    const feature = makeFeature([makeTask(1, 'FE', 1)])
    expect(computeHandoffs(feature, cfg)).toBe(0)
  })

  it('dvě fáze, dva tasky ve zdrojové fázi', () => {
    // FE/Ada(1) + BE/Ben(1) → QA/Chen(2)
    // fáze 1→2: Ada ∉ {Chen} = 1, Ben ∉ {Chen} = 1
    // celkem = 2
    const cfg = roleConfig({ FE: { level: 1 }, BE: { level: 1 }, QA: { level: 2 } })
    const feature = makeFeature([
      makeTask(1, 'FE', 1), // Ada
      makeTask(2, 'BE', 2), // Ben
      makeTask(3, 'QA', 3), // Chen
    ])
    expect(computeHandoffs(feature, cfg)).toBe(2)
  })

  it('cross-funkční člen překlenuje fáze 2 a 3, ne fáze 1 a 2', () => {
    // DSGN/Ada(1) → FE/Ben(2) → QA/Ben(3)
    // fáze 1→2: Ada ∉ {Ben} = 1
    // fáze 2→3: Ben ∈ {Ben} = 0
    // celkem = 1
    const cfg = roleConfig({ DSGN: { level: 1 }, FE: { level: 2 }, QA: { level: 3 } })
    const feature = makeFeature([
      makeTask(1, 'DSGN', 1), // Ada
      makeTask(2, 'FE',   2), // Ben
      makeTask(3, 'QA',   2), // Ben (cross-funkční)
    ])
    expect(computeHandoffs(feature, cfg)).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// LeadTimeEntry.handoffs — ukládání při dokončení feature
// ---------------------------------------------------------------------------

describe('feat-007: LeadTimeEntry.handoffs', () => {
  it('handoffs se uloží do LeadTimeEntry při dokončení feature', () => {
    // Tým: jeden člen s FE+QA (cross-funkční) → 0 předání pro jednoduchou feature
    const cfg = roleConfig({
      FE: { level: 1, required: true },
      QA: { level: 2, required: true },
      BE: { required: false }, DSGN: { required: false }, OPS: { required: false }, DATA: { required: false },
    })
    const rng = mulberry32(42)
    const settings: SimSettings = { ...SETTINGS, initialBacklog: 1 }
    const state = makeInitialState(rng, settings, cfg)
    // Jeden cross-funkční člen pokrývá obě fáze
    state.team = [{ id: 1, name: 'Ada', roles: ['FE', 'QA'], currentTask: null, idleSec: 0 }]

    for (let i = 0; i < 100; i++) {
      tick(state, 1, settings, rng, cfg)
      if (state.done.length > 0) break
    }

    expect(state.leadTimes.length).toBeGreaterThan(0)
    // Každý LeadTimeEntry musí mít pole handoffs
    for (const lt of state.leadTimes) {
      expect(typeof lt.handoffs).toBe('number')
      expect(lt.handoffs).toBeGreaterThanOrEqual(0)
    }
  })

  it('specializovaný tým generuje více handoffs než cross-funkční', () => {
    // Feature se 2 fázemi, cfg: FE(1) required, QA(2) required
    const cfg = roleConfig({
      FE:   { level: 1, required: true },
      QA:   { level: 2, required: true },
      BE:   { required: false }, DSGN: { required: false }, OPS: { required: false }, DATA: { required: false },
    })
    const settings: SimSettings = { ...SETTINGS, initialBacklog: 5 }

    // --- Specializovaný tým: FE a QA jsou různí lidé ---
    const rng1 = mulberry32(1)
    const stateSpec = makeInitialState(rng1, settings, cfg)
    stateSpec.team = [
      { id: 1, name: 'FE-spec', roles: ['FE'], currentTask: null, idleSec: 0 },
      { id: 2, name: 'QA-spec', roles: ['QA'], currentTask: null, idleSec: 0 },
    ]
    for (let i = 0; i < 500; i++) {
      tick(stateSpec, 1, settings, rng1, cfg)
      if (stateSpec.finished) break
    }

    // --- Cross-funkční tým: jeden člen s oběma rolemi ---
    const rng2 = mulberry32(1)
    const stateCross = makeInitialState(rng2, settings, cfg)
    stateCross.team = [
      { id: 1, name: 'Ada-cross', roles: ['FE', 'QA'], currentTask: null, idleSec: 0 },
    ]
    for (let i = 0; i < 500; i++) {
      tick(stateCross, 1, settings, rng2, cfg)
      if (stateCross.finished) break
    }

    const avgSpec  = stateSpec.leadTimes.reduce((s, l) => s + l.handoffs, 0) / stateSpec.leadTimes.length
    const avgCross = stateCross.leadTimes.reduce((s, l) => s + l.handoffs, 0) / stateCross.leadTimes.length

    // Specializovaný tým musí mít více předání než cross-funkční
    expect(avgSpec).toBeGreaterThan(avgCross)
  })
})

// ---------------------------------------------------------------------------
// computeStats — avgHandoffs
// ---------------------------------------------------------------------------

describe('feat-007: computeStats — avgHandoffs', () => {
  it('avgHandoffs je průměr handoffs ze všech záznamů', () => {
    const entries = [
      { id: 1, ms: 10, finishedAt: 10, handoffs: 3 },
      { id: 2, ms: 12, finishedAt: 22, handoffs: 0 },
      { id: 3, ms: 8,  finishedAt: 30, handoffs: 3 },
    ]
    const stats = computeStats(entries)
    expect(stats.avgHandoffs).toBeCloseTo(2.0, 5)
  })

  it('avgHandoffs je 0 pro prázdný seznam', () => {
    const stats = computeStats([])
    expect(stats.avgHandoffs).toBe(0)
  })

  it('avgHandoffs je 0 pokud jsou všechny handoffs 0', () => {
    const entries = [
      { id: 1, ms: 5, finishedAt: 5, handoffs: 0 },
      { id: 2, ms: 6, finishedAt: 11, handoffs: 0 },
    ]
    const stats = computeStats(entries)
    expect(stats.avgHandoffs).toBe(0)
  })
})
