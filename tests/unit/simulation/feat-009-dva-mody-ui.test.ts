import { describe, it, expect } from 'vitest'
import { mulberry32, makeInitialState, ROLE_META } from '@/simulation/engine'
import { makeCompareTeams, COMPARE_ROLES, calcCompareDelta } from '@/simulation/compareMode'
import type { SimSettings } from '@/types/simulation'

const SETTINGS: SimSettings = {
  minBacklog: 0,
  wipLimit: 6,
  sizeVar: 0.4,
  roleVar: 0.5,
  initialBacklog: 20,
  minSpecializations: 1,
}

// ---------------------------------------------------------------------------
// Identical backlog — same settings produce identical feature lists
// ---------------------------------------------------------------------------

describe('feat-009: identical backlog', () => {
  it('two states initialised with the same seed have identical backlog item counts', () => {
    const rngA = mulberry32(42)
    const rngB = mulberry32(42)
    const stateA = makeInitialState(rngA, SETTINGS, ROLE_META)
    const stateB = makeInitialState(rngB, SETTINGS, ROLE_META)

    expect(stateA.backlog.length).toBe(stateB.backlog.length)
  })

  it('two states initialised with the same seed have identical feature names in order', () => {
    const rngA = mulberry32(42)
    const rngB = mulberry32(42)
    const stateA = makeInitialState(rngA, SETTINGS, ROLE_META)
    const stateB = makeInitialState(rngB, SETTINGS, ROLE_META)

    const namesA = stateA.backlog.map(f => f.name)
    const namesB = stateB.backlog.map(f => f.name)
    expect(namesA).toEqual(namesB)
  })

  it('two states initialised with the same seed have identical task role distributions', () => {
    const rngA = mulberry32(42)
    const rngB = mulberry32(42)
    const stateA = makeInitialState(rngA, SETTINGS, ROLE_META)
    const stateB = makeInitialState(rngB, SETTINGS, ROLE_META)

    // Compare role of each task in each feature at each position
    stateA.backlog.forEach((featureA, fi) => {
      const featureB = stateB.backlog[fi]
      expect(featureA.tasks.length).toBe(featureB.tasks.length)
      featureA.tasks.forEach((taskA, ti) => {
        expect(taskA.role).toBe(featureB.tasks[ti].role)
      })
    })
  })

  it('two states initialised with different seeds produce different task role distributions', () => {
    // Feature names are deterministic (based on ID), but task role lists are RNG-driven.
    // Different seeds should produce different role mixes across the backlog.
    const rngA = mulberry32(42)
    const rngB = mulberry32(99)
    const settings = { ...SETTINGS, sizeVar: 0.5, roleVar: 0.5 }
    const stateA = makeInitialState(rngA, settings, ROLE_META)
    const stateB = makeInitialState(rngB, settings, ROLE_META)

    const rolesA = stateA.backlog.map(f => f.tasks.map(t => t.role).join(','))
    const rolesB = stateB.backlog.map(f => f.tasks.map(t => t.role).join(','))
    expect(rolesA).not.toEqual(rolesB)
  })
})

// ---------------------------------------------------------------------------
// COMPARE_ROLES — the six roles used in Compare mode
// ---------------------------------------------------------------------------

describe('feat-009: COMPARE_ROLES', () => {
  it('contains exactly 6 roles', () => {
    expect(COMPARE_ROLES).toHaveLength(6)
  })

  it('contains Design, React/FE, Java/BE, Database, QA, Ops', () => {
    // Roles are identified by their engine Role keys
    expect(COMPARE_ROLES).toContain('DSGN')
    expect(COMPARE_ROLES).toContain('FE')
    expect(COMPARE_ROLES).toContain('BE')
    expect(COMPARE_ROLES).toContain('DATA')
    expect(COMPARE_ROLES).toContain('QA')
    expect(COMPARE_ROLES).toContain('OPS')
  })

  it('has no duplicates', () => {
    expect(new Set(COMPARE_ROLES).size).toBe(COMPARE_ROLES.length)
  })
})

// ---------------------------------------------------------------------------
// makeCompareTeams — pre-configured Team A (specialists) and Team B (cross-functional)
// ---------------------------------------------------------------------------

describe('feat-009: makeCompareTeams — structure', () => {
  it('returns exactly 6 members per team', () => {
    const { teamA, teamB } = makeCompareTeams()
    expect(teamA).toHaveLength(6)
    expect(teamB).toHaveLength(6)
  })

  it('Team A: every member has exactly 1 role', () => {
    const { teamA } = makeCompareTeams()
    for (const member of teamA) {
      expect(member.roles).toHaveLength(1)
    }
  })

  it('Team B: every member has exactly 2 roles', () => {
    const { teamB } = makeCompareTeams()
    for (const member of teamB) {
      expect(member.roles).toHaveLength(2)
    }
  })

  it('Team A: all six COMPARE_ROLES are represented (one per member)', () => {
    const { teamA } = makeCompareTeams()
    const covered = teamA.flatMap(m => m.roles)
    expect(new Set(covered).size).toBe(6)
    for (const role of COMPARE_ROLES) {
      expect(covered).toContain(role)
    }
  })

  it('Team B: all six COMPARE_ROLES are represented across the team', () => {
    const { teamB } = makeCompareTeams()
    const covered = teamB.flatMap(m => m.roles)
    for (const role of COMPARE_ROLES) {
      expect(covered).toContain(role)
    }
  })

  it('Team B: each member has two adjacent roles (ring pattern)', () => {
    // Expected pairing: DSGN+FE, FE+BE, BE+DATA, DATA+QA, QA+OPS, OPS+DSGN
    const { teamB } = makeCompareTeams()
    const expectedPairs = [
      ['DSGN', 'FE'],
      ['FE', 'BE'],
      ['BE', 'DATA'],
      ['DATA', 'QA'],
      ['QA', 'OPS'],
      ['OPS', 'DSGN'],
    ]
    teamB.forEach((member, i) => {
      const sorted = [...member.roles].sort()
      const expected = [...expectedPairs[i]].sort()
      expect(sorted).toEqual(expected)
    })
  })

  it('member IDs are unique within each team', () => {
    const { teamA, teamB } = makeCompareTeams()
    const idsA = teamA.map(m => m.id)
    const idsB = teamB.map(m => m.id)
    expect(new Set(idsA).size).toBe(6)
    expect(new Set(idsB).size).toBe(6)
  })

  it('Team A and Team B member IDs do not overlap', () => {
    const { teamA, teamB } = makeCompareTeams()
    const idsA = new Set(teamA.map(m => m.id))
    for (const m of teamB) {
      expect(idsA.has(m.id)).toBe(false)
    }
  })

  it('members start with no current task and zero idle time', () => {
    const { teamA, teamB } = makeCompareTeams()
    for (const member of [...teamA, ...teamB]) {
      expect(member.currentTask).toBeNull()
      expect(member.idleSec).toBe(0)
    }
  })
})

// ---------------------------------------------------------------------------
// minTasks / maxTasks — hard task-count bounds in SimSettings
// ---------------------------------------------------------------------------

describe('feat-009: minTasks / maxTasks bounds', () => {
  it('every feature has at least minTasks tasks when minTasks is set', () => {
    const rng = mulberry32(7)
    const settings: SimSettings = { ...SETTINGS, minTasks: 4, maxTasks: 8, sizeVar: 0 }
    const state = makeInitialState(rng, settings, ROLE_META)
    for (const f of state.backlog) {
      expect(f.tasks.length).toBeGreaterThanOrEqual(4)
    }
  })

  it('every feature has at most maxTasks tasks when maxTasks is set', () => {
    const rng = mulberry32(7)
    const settings: SimSettings = { ...SETTINGS, minTasks: 4, maxTasks: 8, sizeVar: 1 }
    const state = makeInitialState(rng, settings, ROLE_META)
    for (const f of state.backlog) {
      expect(f.tasks.length).toBeLessThanOrEqual(8)
    }
  })

  it('minTasks > maxTasks does not crash (clamps to minTasks)', () => {
    const rng = mulberry32(7)
    const settings: SimSettings = { ...SETTINGS, minTasks: 6, maxTasks: 2 }
    const state = makeInitialState(rng, settings, ROLE_META)
    for (const f of state.backlog) {
      expect(f.tasks.length).toBeGreaterThanOrEqual(6)
    }
  })
})

// ---------------------------------------------------------------------------
// calcCompareDelta — metric comparison between two teams
// ---------------------------------------------------------------------------

describe('feat-009: calcCompareDelta', () => {
  it('returns negative percentage when Team B is better (lower value)', () => {
    // Team A: 6.8s lead time, Team B: 4.0s → B is 41% faster
    const delta = calcCompareDelta(6.8, 4.0)
    expect(delta).toBeCloseTo(-41.18, 1)
  })

  it('returns positive percentage when Team B is worse (higher value)', () => {
    // Team A: 4.0s, Team B: 6.8s → B is 70% slower
    const delta = calcCompareDelta(4.0, 6.8)
    expect(delta).toBeCloseTo(70, 0)
  })

  it('returns 0 when both teams have equal values', () => {
    expect(calcCompareDelta(5.0, 5.0)).toBe(0)
  })

  it('returns undefined when Team A value is zero (division guard)', () => {
    expect(calcCompareDelta(0, 4.0)).toBeUndefined()
  })

  it('returns undefined when Team A value is null (no data yet)', () => {
    expect(calcCompareDelta(null, 4.0)).toBeUndefined()
  })

  it('returns undefined when Team B value is null (no data yet)', () => {
    expect(calcCompareDelta(5.0, null)).toBeUndefined()
  })
})
