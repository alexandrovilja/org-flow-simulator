import { describe, it, expect } from 'vitest'
import {
  COMPARE_ROLES,
  makeTeamByType,
  makeCompareTeams,
  makeCompareStates,
} from '@/simulation/compareMode'
import type { TeamType } from '@/simulation/compareMode'

// ---------------------------------------------------------------------------
// TeamType — valid values
// ---------------------------------------------------------------------------

describe('feat-011: TeamType values', () => {
  it('accepts "single" as a valid TeamType', () => {
    const t: TeamType = 'single'
    expect(t).toBe('single')
  })

  it('accepts "double" as a valid TeamType', () => {
    const t: TeamType = 'double'
    expect(t).toBe('double')
  })

  it('accepts "multi" as a valid TeamType', () => {
    const t: TeamType = 'multi'
    expect(t).toBe('multi')
  })
})

// ---------------------------------------------------------------------------
// makeTeamByType — structure for each type
// ---------------------------------------------------------------------------

describe('feat-011: makeTeamByType — single', () => {
  it('returns exactly 6 members', () => {
    expect(makeTeamByType('single', 1)).toHaveLength(6)
  })

  it('every member has exactly 1 role', () => {
    for (const m of makeTeamByType('single', 1)) {
      expect(m.roles).toHaveLength(1)
    }
  })

  it('all six COMPARE_ROLES are covered (one per member)', () => {
    const roles = makeTeamByType('single', 1).flatMap(m => m.roles)
    expect(new Set(roles).size).toBe(6)
    for (const r of COMPARE_ROLES) expect(roles).toContain(r)
  })

  it('member IDs start at the given idOffset', () => {
    const team = makeTeamByType('single', 1)
    const ids = team.map(m => m.id)
    expect(Math.min(...ids)).toBe(1)
    expect(Math.max(...ids)).toBe(6)
  })

  it('all members start idle with no current task', () => {
    for (const m of makeTeamByType('single', 1)) {
      expect(m.currentTask).toBeNull()
      expect(m.idleSec).toBe(0)
    }
  })
})

describe('feat-011: makeTeamByType — double', () => {
  it('returns exactly 6 members', () => {
    expect(makeTeamByType('double', 1)).toHaveLength(6)
  })

  it('every member has exactly 2 roles', () => {
    for (const m of makeTeamByType('double', 1)) {
      expect(m.roles).toHaveLength(2)
    }
  })

  it('all six COMPARE_ROLES are covered across the team', () => {
    const roles = makeTeamByType('double', 1).flatMap(m => m.roles)
    for (const r of COMPARE_ROLES) expect(roles).toContain(r)
  })

  it('each member has two adjacent roles (ring pattern)', () => {
    const team = makeTeamByType('double', 1)
    // Expected: DSGN+FE, FE+BE, BE+DATA, DATA+QA, QA+OPS, OPS+DSGN
    const expected = COMPARE_ROLES.map((r, i) => [r, COMPARE_ROLES[(i + 1) % COMPARE_ROLES.length]].sort())
    team.forEach((m, i) => {
      expect([...m.roles].sort()).toEqual(expected[i])
    })
  })

  it('member IDs respect the given idOffset', () => {
    const team = makeTeamByType('double', 7)
    const ids = team.map(m => m.id)
    expect(Math.min(...ids)).toBe(7)
    expect(Math.max(...ids)).toBe(12)
  })
})

describe('feat-011: makeTeamByType — multi', () => {
  it('returns exactly 6 members', () => {
    expect(makeTeamByType('multi', 1)).toHaveLength(6)
  })

  it('every member has exactly 3 roles', () => {
    for (const m of makeTeamByType('multi', 1)) {
      expect(m.roles).toHaveLength(3)
    }
  })

  it('all six COMPARE_ROLES are covered across the team', () => {
    const roles = makeTeamByType('multi', 1).flatMap(m => m.roles)
    for (const r of COMPARE_ROLES) expect(roles).toContain(r)
  })

  it('each member has three adjacent roles (ring pattern)', () => {
    const team = makeTeamByType('multi', 1)
    // Expected: DSGN+FE+BE, FE+BE+DATA, BE+DATA+QA, DATA+QA+OPS, QA+OPS+DSGN, OPS+DSGN+FE
    const expected = COMPARE_ROLES.map((_, i) => [
      COMPARE_ROLES[i % COMPARE_ROLES.length],
      COMPARE_ROLES[(i + 1) % COMPARE_ROLES.length],
      COMPARE_ROLES[(i + 2) % COMPARE_ROLES.length],
    ].sort())
    team.forEach((m, i) => {
      expect([...m.roles].sort()).toEqual(expected[i])
    })
  })

  it('no member has duplicate roles', () => {
    for (const m of makeTeamByType('multi', 1)) {
      expect(new Set(m.roles).size).toBe(m.roles.length)
    }
  })

  it('member IDs respect the given idOffset', () => {
    const team = makeTeamByType('multi', 7)
    const ids = team.map(m => m.id)
    expect(Math.min(...ids)).toBe(7)
    expect(Math.max(...ids)).toBe(12)
  })
})

// ---------------------------------------------------------------------------
// makeCompareTeams — accepts typeA / typeB, default single + double
// ---------------------------------------------------------------------------

describe('feat-011: makeCompareTeams — default (single + double)', () => {
  it('default call produces teamA with 1 role per member', () => {
    const { teamA } = makeCompareTeams()
    for (const m of teamA) expect(m.roles).toHaveLength(1)
  })

  it('default call produces teamB with 2 roles per member', () => {
    const { teamB } = makeCompareTeams()
    for (const m of teamB) expect(m.roles).toHaveLength(2)
  })
})

describe('feat-011: makeCompareTeams — explicit types', () => {
  it('makeCompareTeams("single", "multi") → teamA has 1 role, teamB has 3 roles', () => {
    const { teamA, teamB } = makeCompareTeams('single', 'multi')
    for (const m of teamA) expect(m.roles).toHaveLength(1)
    for (const m of teamB) expect(m.roles).toHaveLength(3)
  })

  it('makeCompareTeams("double", "multi") → teamA has 2 roles, teamB has 3 roles', () => {
    const { teamA, teamB } = makeCompareTeams('double', 'multi')
    for (const m of teamA) expect(m.roles).toHaveLength(2)
    for (const m of teamB) expect(m.roles).toHaveLength(3)
  })

  it('makeCompareTeams("multi", "multi") → both teams have 3 roles per member', () => {
    const { teamA, teamB } = makeCompareTeams('multi', 'multi')
    for (const m of [...teamA, ...teamB]) expect(m.roles).toHaveLength(3)
  })

  it('Team A and Team B IDs never overlap regardless of type combination', () => {
    for (const combo of [['single', 'double'], ['single', 'multi'], ['double', 'multi'], ['multi', 'multi']] as [TeamType, TeamType][]) {
      const { teamA, teamB } = makeCompareTeams(combo[0], combo[1])
      const idsA = new Set(teamA.map(m => m.id))
      for (const m of teamB) expect(idsA.has(m.id)).toBe(false)
    }
  })
})

// ---------------------------------------------------------------------------
// makeCompareStates — correct team types + identical backlogs
// ---------------------------------------------------------------------------

describe('feat-011: makeCompareStates', () => {
  it('default produces stateA with single team (1 role/member)', () => {
    const { stateA } = makeCompareStates()
    for (const m of stateA.team) expect(m.roles).toHaveLength(1)
  })

  it('default produces stateB with double team (2 roles/member)', () => {
    const { stateB } = makeCompareStates()
    for (const m of stateB.team) expect(m.roles).toHaveLength(2)
  })

  it('explicit types are respected', () => {
    const { stateA, stateB } = makeCompareStates('double', 'multi')
    for (const m of stateA.team) expect(m.roles).toHaveLength(2)
    for (const m of stateB.team) expect(m.roles).toHaveLength(3)
  })

  it('both states have identical backlog lengths (same seed)', () => {
    const { stateA, stateB } = makeCompareStates('single', 'multi')
    expect(stateA.backlog.length).toBe(stateB.backlog.length)
  })

  it('both states have identical feature names in order (same seed)', () => {
    const { stateA, stateB } = makeCompareStates()
    const namesA = stateA.backlog.map(f => f.name)
    const namesB = stateB.backlog.map(f => f.name)
    expect(namesA).toEqual(namesB)
  })
})
