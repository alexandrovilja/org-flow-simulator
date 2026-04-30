import { describe, it, expect } from 'vitest'
import { mulberry32, makeInitialState, tick, ROLE_META } from '@/simulation/engine'
import type { SimSettings, Member, Feature, Task, Role, RoleMeta } from '@/types/simulation'

const SETTINGS: SimSettings = {
  minBacklog: 0,
  wipLimit: 10,
  sizeVar: 0,
  roleVar: 0,
  initialBacklog: 3,
  minSpecializations: 1,
}

/** Vytvoří kopii ROLE_META s přepsanými hodnotami pro konkrétní role. */
function roleConfig(overrides: Partial<Record<Role, Partial<RoleMeta>>>): Record<Role, RoleMeta> {
  const base = structuredClone(ROLE_META)
  for (const [r, patch] of Object.entries(overrides) as [Role, Partial<RoleMeta>][]) {
    Object.assign(base[r], patch)
  }
  return base
}

/** Sestaví minimální Task objekt. */
function makeTask(id: number, role: Role, status: Task['status'] = 'todo', assignee: number | null = null): Task {
  return { id, role, work: 1, progress: status === 'done' ? 1 : 0, status, assignee }
}

/** Sestaví minimální Member objekt. */
function makeMember(id: number, roles: Role[]): Member {
  return { id, name: `M${id}`, roles, currentTask: null, idleSec: 0 }
}

/** Sestaví minimální Feature pro inProgress/backlog. */
function makeFeature(id: number, priority: number, tasks: Task[], inProgress = false): Feature {
  return {
    id,
    name: `F-${String(id).padStart(3, '0')}`,
    hue: 12,
    priority,
    tasks,
    createdAt: 0,
    startedAt: inProgress ? 0 : null,
    finishedAt: null,
    status: inProgress ? 'in-progress' : 'backlog',
  }
}

// ---------------------------------------------------------------------------
// Focus mode — Priority (výchozí chování)
// ---------------------------------------------------------------------------

describe('feat-008: focusMode=priority (výchozí)', () => {
  it('člen vezme úkol z nejvýše prioritní feature bez ohledu na minulou práci', () => {
    // Ben (FE+BE) dokončil FE na F-001 (priority 3).
    // Volné: BE na F-001 (priority 3) a FE na F-002 (priority 1).
    // Prioritní režim → Ben musí vybrat FE z F-002 (nižší číslo = vyšší priorita).
    const cfg = roleConfig({ FE: { level: 1 }, BE: { level: 1 } })
    const rng = mulberry32(1)
    const settings: SimSettings = { ...SETTINGS, initialBacklog: 0 }
    const state = makeInitialState(rng, settings, cfg)

    const ben = makeMember(1, ['FE', 'BE'])
    state.team = [ben]

    const f001 = makeFeature(1, 3, [
      makeTask(1, 'FE', 'done', ben.id), // Ben již dokončil FE
      makeTask(2, 'BE', 'todo'),
    ], true)
    const f002 = makeFeature(2, 1, [makeTask(3, 'FE', 'todo')])

    state.inProgress = [f001]
    state.backlog    = [f002]

    tick(state, 0.01, settings, rng, cfg, 'priority', 'priority')

    // Prioritní režim: Ben musí vzít FE z F-002 (priorita 1 < 3)
    expect(ben.currentTask?.featureId).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// Focus mode — Continuity
// ---------------------------------------------------------------------------

describe('feat-008: focusMode=continuity', () => {
  it('člen preferuje feature kde již pracoval, i když má nižší prioritu', () => {
    // Ben (FE+BE) dokončil FE na F-001 (priority 3).
    // Volné: BE na F-001 (priority 3) a FE na F-002 (priority 1).
    // Kontinuitní režim → Ben musí vybrat BE z F-001 (kontinuita > priorita).
    const cfg = roleConfig({ FE: { level: 1 }, BE: { level: 1 } })
    const rng = mulberry32(1)
    const settings: SimSettings = { ...SETTINGS, initialBacklog: 0 }
    const state = makeInitialState(rng, settings, cfg)

    const ben = makeMember(1, ['FE', 'BE'])
    state.team = [ben]

    const f001 = makeFeature(1, 3, [
      makeTask(1, 'FE', 'done', ben.id),
      makeTask(2, 'BE', 'todo'),
    ], true)
    const f002 = makeFeature(2, 1, [makeTask(3, 'FE', 'todo')])

    state.inProgress = [f001]
    state.backlog    = [f002]

    tick(state, 0.01, settings, rng, cfg, 'continuity', 'priority')

    // Kontinuitní režim: Ben musí vzít BE z F-001
    expect(ben.currentTask?.featureId).toBe(1)
    expect(ben.currentTask?.taskId).toBe(2)
  })

  it('fallback na prioritu pokud na vlastní feature není dostupný úkol', () => {
    // Ben (FE) dokončil FE na F-001. Na F-001 zbývá jen QA — Ben nemá roli QA.
    // Volné: FE na F-002 (priority 1), FE na F-003 (priority 2).
    // Fallback → Ben musí vzít FE z F-002 (vyšší priorita).
    const cfg = roleConfig({ FE: { level: 1 }, QA: { level: 2 } })
    const rng = mulberry32(1)
    const settings: SimSettings = { ...SETTINGS, initialBacklog: 0 }
    const state = makeInitialState(rng, settings, cfg)

    const ben = makeMember(1, ['FE'])
    state.team = [ben]

    const f001 = makeFeature(1, 3, [
      makeTask(1, 'FE', 'done', ben.id),
      makeTask(2, 'QA', 'todo'), // Ben nemá roli QA
    ], true)
    const f002 = makeFeature(2, 1, [makeTask(3, 'FE', 'todo')])
    const f003 = makeFeature(3, 2, [makeTask(4, 'FE', 'todo')])

    state.inProgress = [f001]
    state.backlog    = [f002, f003]

    tick(state, 0.01, settings, rng, cfg, 'continuity', 'priority')

    expect(ben.currentTask?.featureId).toBe(2) // F-002 má prioritu 1
  })

  it('člen bez minulé práce se řídí prioritou', () => {
    // Ada (FE) na ničem dosud nepracovala.
    // Volné: FE na F-003 (priority 2), FE na F-001 (priority 1).
    // → Ada musí vzít FE z F-001 (priorita).
    const cfg = roleConfig({ FE: { level: 1 } })
    const rng = mulberry32(1)
    const settings: SimSettings = { ...SETTINGS, initialBacklog: 0 }
    const state = makeInitialState(rng, settings, cfg)

    const ada = makeMember(1, ['FE'])
    state.team = [ada]

    const f001 = makeFeature(1, 1, [makeTask(1, 'FE', 'todo')])
    const f003 = makeFeature(3, 2, [makeTask(3, 'FE', 'todo')])

    state.backlog = [f003, f001] // záměrně v obráceném pořadí

    tick(state, 0.01, settings, rng, cfg, 'continuity', 'priority')

    expect(ada.currentTask?.featureId).toBe(1) // F-001 má prioritu 1
  })

  it('více features kde člen pracoval — rozhodne priorita', () => {
    // Ben pracoval na F-001 (priority 3) i F-002 (priority 1). Obě mají dostupné úkoly.
    // → Ben musí vzít úkol z F-002 (oba jsou "jeho", rozhodne priorita).
    const cfg = roleConfig({ FE: { level: 1 }, BE: { level: 1 } })
    const rng = mulberry32(1)
    const settings: SimSettings = { ...SETTINGS, initialBacklog: 0 }
    const state = makeInitialState(rng, settings, cfg)

    const ben = makeMember(1, ['FE', 'BE'])
    state.team = [ben]

    const f001 = makeFeature(1, 3, [
      makeTask(1, 'FE', 'done', ben.id),
      makeTask(2, 'BE', 'todo'),
    ], true)
    const f002 = makeFeature(2, 1, [
      makeTask(3, 'FE', 'done', ben.id),
      makeTask(4, 'BE', 'todo'),
    ], true)

    state.inProgress = [f001, f002]
    state.backlog    = []

    tick(state, 0.01, settings, rng, cfg, 'continuity', 'priority')

    expect(ben.currentTask?.featureId).toBe(2) // F-002 má prioritu 1
  })
})

// ---------------------------------------------------------------------------
// WIP mode — Priority (výchozí chování)
// ---------------------------------------------------------------------------

describe('feat-008: wipMode=priority (výchozí)', () => {
  it('člen vybírá dle priority bez ohledu na to, zda je feature v backlogu nebo inProgress', () => {
    // Volné: BE na F-003 inProgress (priority 5), FE na F-002 backlog (priority 1).
    // Prioritní WIP režim → Ada (FE+BE) musí vzít FE z F-002 (nižší priorita číslo).
    const cfg = roleConfig({ FE: { level: 1 }, BE: { level: 1 } })
    const rng = mulberry32(1)
    const settings: SimSettings = { ...SETTINGS, initialBacklog: 0 }
    const state = makeInitialState(rng, settings, cfg)

    const ada = makeMember(1, ['FE', 'BE'])
    state.team = [ada]

    const f002 = makeFeature(2, 1, [makeTask(3, 'FE', 'todo')])
    const f003 = makeFeature(3, 5, [makeTask(4, 'BE', 'todo')], true)

    state.inProgress = [f003]
    state.backlog    = [f002]

    tick(state, 0.01, settings, rng, cfg, 'priority', 'priority')

    expect(ada.currentTask?.featureId).toBe(2) // F-002 má prioritu 1
  })
})

// ---------------------------------------------------------------------------
// WIP mode — Reduce WIP
// ---------------------------------------------------------------------------

describe('feat-008: wipMode=reduce-wip', () => {
  it('člen preferuje in-progress feature před backlogovou, i když má nižší prioritu', () => {
    // Volné: FE na F-002 backlog (priority 1), BE na F-003 inProgress (priority 5).
    // Reduce WIP → Ada (FE+BE) musí vzít BE z F-003 (inProgress > backlog).
    const cfg = roleConfig({ FE: { level: 1 }, BE: { level: 1 } })
    const rng = mulberry32(1)
    const settings: SimSettings = { ...SETTINGS, initialBacklog: 0 }
    const state = makeInitialState(rng, settings, cfg)

    const ada = makeMember(1, ['FE', 'BE'])
    state.team = [ada]

    const f002 = makeFeature(2, 1, [makeTask(3, 'FE', 'todo')])
    const f003 = makeFeature(3, 5, [makeTask(4, 'BE', 'todo')], true)

    state.inProgress = [f003]
    state.backlog    = [f002]

    tick(state, 0.01, settings, rng, cfg, 'priority', 'reduce-wip')

    expect(ada.currentTask?.featureId).toBe(3) // F-003 je inProgress
  })

  it('více in-progress features — mezi nimi rozhodne priorita', () => {
    // Volné: FE na F-003 inProgress (priority 5), BE na F-002 inProgress (priority 1).
    // Reduce WIP + obě inProgress → rozhodne priorita → F-002.
    const cfg = roleConfig({ FE: { level: 1 }, BE: { level: 1 } })
    const rng = mulberry32(1)
    const settings: SimSettings = { ...SETTINGS, initialBacklog: 0 }
    const state = makeInitialState(rng, settings, cfg)

    const ada = makeMember(1, ['FE', 'BE'])
    state.team = [ada]

    const f002 = makeFeature(2, 1, [makeTask(1, 'BE', 'todo')], true)
    const f003 = makeFeature(3, 5, [makeTask(2, 'FE', 'todo')], true)

    state.inProgress = [f002, f003]
    state.backlog    = []

    tick(state, 0.01, settings, rng, cfg, 'priority', 'reduce-wip')

    expect(ada.currentTask?.featureId).toBe(2) // F-002 má prioritu 1
  })

  it('fallback na backlog pokud žádná in-progress nemá dostupný úkol', () => {
    // Na in-progress feature je jen QA — Ada nemá roli QA. Backlog: FE na F-005 (priority 2), FE na F-006 (priority 1).
    // Fallback → Ada musí vzít FE z F-006 (vyšší priorita).
    const cfg = roleConfig({ FE: { level: 1 }, QA: { level: 1 } })
    const rng = mulberry32(1)
    const settings: SimSettings = { ...SETTINGS, initialBacklog: 0 }
    const state = makeInitialState(rng, settings, cfg)

    const ada = makeMember(1, ['FE'])
    state.team = [ada]

    const f004 = makeFeature(4, 1, [makeTask(1, 'QA', 'todo')], true) // Ada nemá QA
    const f005 = makeFeature(5, 2, [makeTask(2, 'FE', 'todo')])
    const f006 = makeFeature(6, 1, [makeTask(3, 'FE', 'todo')])

    state.inProgress = [f004]
    state.backlog    = [f005, f006]

    tick(state, 0.01, settings, rng, cfg, 'priority', 'reduce-wip')

    expect(ada.currentTask?.featureId).toBe(6) // F-006 má prioritu 1
  })
})

// ---------------------------------------------------------------------------
// Kombinace: Continuity + Reduce WIP
// ---------------------------------------------------------------------------

describe('feat-008: kombinace focusMode=continuity + wipMode=reduce-wip', () => {
  it('pořadí: in-progress → vlastní feature → priorita', () => {
    // Ben (FE+BE) dokončil FE na F-001 (inProgress, priority 3).
    // Volné: BE na F-001 inProgress (priority 3), FE na F-002 backlog (priority 1), BE na F-004 inProgress (priority 2).
    // Reduce WIP odfiltruje backlog → zbývají F-001 a F-004 (obě inProgress).
    // Continuity: F-001 je Benova → Ben musí vzít BE z F-001.
    const cfg = roleConfig({ FE: { level: 1 }, BE: { level: 1 } })
    const rng = mulberry32(1)
    const settings: SimSettings = { ...SETTINGS, initialBacklog: 0 }
    const state = makeInitialState(rng, settings, cfg)

    const ben = makeMember(1, ['FE', 'BE'])
    state.team = [ben]

    const f001 = makeFeature(1, 3, [
      makeTask(1, 'FE', 'done', ben.id),
      makeTask(2, 'BE', 'todo'),
    ], true)
    const f002 = makeFeature(2, 1, [makeTask(3, 'FE', 'todo')]) // backlog
    const f004 = makeFeature(4, 2, [makeTask(5, 'BE', 'todo')], true)

    state.inProgress = [f001, f004]
    state.backlog    = [f002]

    tick(state, 0.01, settings, rng, cfg, 'continuity', 'reduce-wip')

    expect(ben.currentTask?.featureId).toBe(1) // F-001: inProgress + kontinuita
  })

  it('žádná in-progress s dostupným úkolem — fallback přes kontinuitu na prioritu', () => {
    // Ben (FE) dokončil FE na F-001 (inProgress). Na F-001 zbývá jen QA.
    // Backlog: FE na F-003 (priority 2), FE na F-002 (priority 1).
    // Ben nemá roli QA → fallback na backlog. Kontinuita: F-002 ani F-003 nejsou Benovy. Priorita → F-002.
    const cfg = roleConfig({ FE: { level: 1 }, QA: { level: 2 } })
    const rng = mulberry32(1)
    const settings: SimSettings = { ...SETTINGS, initialBacklog: 0 }
    const state = makeInitialState(rng, settings, cfg)

    const ben = makeMember(1, ['FE'])
    state.team = [ben]

    const f001 = makeFeature(1, 1, [
      makeTask(1, 'FE', 'done', ben.id),
      makeTask(2, 'QA', 'todo'),
    ], true)
    const f002 = makeFeature(2, 1, [makeTask(3, 'FE', 'todo')])
    const f003 = makeFeature(3, 2, [makeTask(4, 'FE', 'todo')])

    state.inProgress = [f001]
    state.backlog    = [f002, f003]

    tick(state, 0.01, settings, rng, cfg, 'continuity', 'reduce-wip')

    expect(ben.currentTask?.featureId).toBe(2) // F-002 má prioritu 1
  })
})
