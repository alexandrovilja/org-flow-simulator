import { describe, it, expect } from 'vitest'
import { addRole, deleteRole } from '@/simulation/roleManagement'
import type { SimState, RoleMeta, Feature, Task, Member } from '@/types/simulation'

// ---------------------------------------------------------------------------
// Pomocné továrny
// ---------------------------------------------------------------------------

function makeRoleConfig(): Record<string, RoleMeta> {
  return {
    FE:   { label: 'Frontend', color: 'oklch(70% 0.14 250)', level: 1, required: false },
    BE:   { label: 'Backend',  color: 'oklch(66% 0.14 285)', level: 1, required: false },
    QA:   { label: 'QA',       color: 'oklch(68% 0.13 145)', level: 2, required: false },
  }
}

function makeTask(id: number, role: string, status: Task['status'] = 'todo'): Task {
  return { id, role, work: 1, progress: 0, status, assignee: null }
}

function makeFeature(id: number, tasks: Task[]): Feature {
  return {
    id, name: `F-${id}`, hue: 0, priority: id,
    tasks, createdAt: 0, startedAt: null, finishedAt: null, status: 'backlog',
  }
}

function makeMember(id: number, roles: string[], currentTaskId?: { featureId: number; taskId: number }): Member {
  return { id, name: `M-${id}`, roles, currentTask: currentTaskId ?? null, idleSec: 0 }
}

function makeState(overrides: Partial<SimState> = {}): SimState {
  return {
    backlog: [], backlogSnapshot: [], inProgress: [], done: [],
    team: [], leadTimes: [], simTime: 0, wipIntegral: 0,
    lastGenAt: 0, startedAt: null, finished: false,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// addRole
// ---------------------------------------------------------------------------

describe('feat-007: addRole', () => {
  it('přidá novou roli do roleConfig', () => {
    const cfg = makeRoleConfig()
    const { roleConfig: next, id } = addRole(cfg, 'ML Engineer', 'oklch(70% 0.14 220)')
    expect(next[id]).toBeDefined()
    expect(next[id].label).toBe('ML Engineer')
    expect(next[id].color).toBe('oklch(70% 0.14 220)')
  })

  it('nová role má výchozí level 1 a required false', () => {
    const { roleConfig, id } = addRole(makeRoleConfig(), 'Ops', 'oklch(70% 0.14 75)')
    expect(roleConfig[id].level).toBe(1)
    expect(roleConfig[id].required).toBe(false)
  })

  it('vygenerované ID začíná "CUSTOM_"', () => {
    const { id } = addRole(makeRoleConfig(), 'Nová role', 'oklch(70% 0.14 30)')
    expect(id.startsWith('CUSTOM_')).toBe(true)
  })

  it('nová role nezmění stávající role', () => {
    const cfg = makeRoleConfig()
    const { roleConfig: next } = addRole(cfg, 'Extra', 'oklch(70% 0.14 0)')
    expect(next['FE']).toEqual(cfg['FE'])
    expect(next['BE']).toEqual(cfg['BE'])
    expect(next['QA']).toEqual(cfg['QA'])
  })

  it('původní roleConfig zůstane nezměněn (imutabilita)', () => {
    const cfg = makeRoleConfig()
    addRole(cfg, 'Extra', 'oklch(70% 0.14 0)')
    expect(Object.keys(cfg)).toHaveLength(3)
  })

  it('hodí chybu pro prázdný label', () => {
    expect(() => addRole(makeRoleConfig(), '  ', 'oklch(70% 0.14 0)')).toThrow()
  })

  it('hodí chybu pro duplicitní label (case-insensitive)', () => {
    expect(() => addRole(makeRoleConfig(), 'frontend', 'oklch(70% 0.14 0)')).toThrow()
  })

  it('dvě volání addRole vygenerují různá ID', () => {
    const cfg = makeRoleConfig()
    const { id: id1 } = addRole(cfg, 'Role A', 'oklch(70% 0.14 0)')
    const { id: id2 } = addRole(cfg, 'Role B', 'oklch(70% 0.14 30)')
    expect(id1).not.toBe(id2)
  })
})

// ---------------------------------------------------------------------------
// deleteRole — roleConfig
// ---------------------------------------------------------------------------

describe('feat-007: deleteRole — roleConfig', () => {
  it('odstraní klíč z roleConfig', () => {
    const state = makeState()
    const cfg = makeRoleConfig()
    const { roleConfig: next } = deleteRole(state, cfg, 'QA')
    expect(next['QA']).toBeUndefined()
    expect(next['FE']).toBeDefined()
    expect(next['BE']).toBeDefined()
  })

  it('původní roleConfig zůstane nezměněn (imutabilita)', () => {
    const state = makeState()
    const cfg = makeRoleConfig()
    deleteRole(state, cfg, 'QA')
    expect(cfg['QA']).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
// deleteRole — backlog cleanup
// ---------------------------------------------------------------------------

describe('feat-007: deleteRole — backlog', () => {
  it('odstraní task s mazanou rolí z feature v backlogu', () => {
    const f = makeFeature(1, [makeTask(1, 'FE'), makeTask(2, 'QA'), makeTask(3, 'BE')])
    const state = makeState({ backlog: [f] })
    deleteRole(state, makeRoleConfig(), 'QA')
    expect(state.backlog[0].tasks).toHaveLength(2)
    expect(state.backlog[0].tasks.every(t => t.role !== 'QA')).toBe(true)
  })

  it('odstraní celou feature z backlogu pokud ztratí všechny tasky', () => {
    const f = makeFeature(1, [makeTask(1, 'QA')])
    const state = makeState({ backlog: [f] })
    deleteRole(state, makeRoleConfig(), 'QA')
    expect(state.backlog).toHaveLength(0)
  })

  it('nezasáhne features v backlogu bez mazané role', () => {
    const f1 = makeFeature(1, [makeTask(1, 'FE'), makeTask(2, 'BE')])
    const f2 = makeFeature(2, [makeTask(3, 'QA')])
    const state = makeState({ backlog: [f1, f2] })
    deleteRole(state, makeRoleConfig(), 'QA')
    expect(state.backlog).toHaveLength(1)
    expect(state.backlog[0].id).toBe(1)
    expect(state.backlog[0].tasks).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// deleteRole — inProgress cleanup
// ---------------------------------------------------------------------------

describe('feat-007: deleteRole — inProgress', () => {
  it('odstraní task s mazanou rolí z feature v inProgress', () => {
    const f = makeFeature(1, [makeTask(1, 'FE'), makeTask(2, 'QA')])
    f.status = 'in-progress'
    const state = makeState({ inProgress: [f] })
    deleteRole(state, makeRoleConfig(), 'QA')
    expect(state.inProgress[0].tasks).toHaveLength(1)
    expect(state.inProgress[0].tasks[0].role).toBe('FE')
  })

  it('odstraní celou feature z inProgress pokud ztratí všechny tasky', () => {
    const f = makeFeature(1, [makeTask(1, 'QA')])
    f.status = 'in-progress'
    const state = makeState({ inProgress: [f] })
    deleteRole(state, makeRoleConfig(), 'QA')
    expect(state.inProgress).toHaveLength(0)
  })

  it('uvolní člena aktivně pracujícího na tasku mazané role', () => {
    const task = makeTask(10, 'QA', 'doing')
    task.assignee = 1
    const f = makeFeature(1, [task, makeTask(11, 'FE')])
    f.status = 'in-progress'
    const member = makeMember(1, ['QA'], { featureId: 1, taskId: 10 })
    const state = makeState({ inProgress: [f], team: [member] })
    deleteRole(state, makeRoleConfig(), 'QA')
    expect(state.team[0].currentTask).toBeNull()
  })

  it('člen pracující na jiné roli zůstane přiřazený', () => {
    const taskFE = makeTask(10, 'FE', 'doing')
    taskFE.assignee = 1
    const f = makeFeature(1, [taskFE, makeTask(11, 'QA')])
    f.status = 'in-progress'
    const member = makeMember(1, ['FE', 'QA'], { featureId: 1, taskId: 10 })
    const state = makeState({ inProgress: [f], team: [member] })
    deleteRole(state, makeRoleConfig(), 'QA')
    expect(state.team[0].currentTask).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// deleteRole — team cleanup
// ---------------------------------------------------------------------------

describe('feat-007: deleteRole — team', () => {
  it('odstraní mazanou roli ze všech členů', () => {
    const m1 = makeMember(1, ['FE', 'QA'])
    const m2 = makeMember(2, ['QA', 'BE'])
    const m3 = makeMember(3, ['FE', 'BE'])
    const state = makeState({ team: [m1, m2, m3] })
    deleteRole(state, makeRoleConfig(), 'QA')
    expect(state.team[0].roles).toEqual(['FE'])
    expect(state.team[1].roles).toEqual(['BE'])
    expect(state.team[2].roles).toEqual(['FE', 'BE']) // beze změny
  })

  it('člen bez mazané role zůstane beze změny', () => {
    const m = makeMember(1, ['FE', 'BE'])
    const state = makeState({ team: [m] })
    deleteRole(state, makeRoleConfig(), 'QA')
    expect(state.team[0].roles).toEqual(['FE', 'BE'])
  })
})
