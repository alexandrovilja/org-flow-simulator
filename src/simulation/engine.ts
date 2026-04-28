import type {
  Role, RoleMeta, Feature, Task, Member,
  SimState, SimSettings, SimStats, LeadTimeEntry,
} from '@/types/simulation'

export const ROLES: Role[] = ['FE', 'BE', 'DSGN', 'QA', 'OPS', 'DATA']

export const ROLE_META: Record<Role, RoleMeta> = {
  FE:   { label: 'Frontend', color: 'oklch(70% 0.14 250)' },
  BE:   { label: 'Backend',  color: 'oklch(66% 0.14 285)' },
  DSGN: { label: 'Design',   color: 'oklch(72% 0.13 25)'  },
  QA:   { label: 'QA',       color: 'oklch(68% 0.13 145)' },
  OPS:  { label: 'DevOps',   color: 'oklch(68% 0.13 75)'  },
  DATA: { label: 'Data',     color: 'oklch(64% 0.14 320)' },
}

const FEATURE_HUES = [12, 45, 90, 140, 180, 215, 260, 300, 335]

const FEATURE_NAMES = [
  'Login flow', 'Search filters', 'Export CSV', 'Dark mode', 'Onboarding',
  'Notifications', 'API rate limits', 'Audit log', 'Billing portal', 'SSO',
  'Bulk actions', 'Webhooks', 'Mobile nav', 'Empty states', 'Settings page',
  'Activity feed', 'Permissions', 'Inline editing', 'Drag & drop', 'Comments',
  'Reactions', '2FA', 'Profile page', 'Charts', 'Keyboard shortcuts',
  'File upload', 'Sharing', 'Tags', 'Saved views', 'Reports',
]

const MEMBER_NAMES = ['Ada', 'Ben', 'Chen', 'Dani', 'Eli', 'Fae', 'Gus', 'Hari']

// Seedable RNG — deterministic randomness so Reset restores the same backlog
export function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0
    seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let nextFeatureId = 1
let nextTaskId = 1

function makeFeature(rng: () => number, now: number, settings: SimSettings): Feature {
  const id = nextFeatureId++
  const hue = FEATURE_HUES[(id - 1) % FEATURE_HUES.length]
  const name = FEATURE_NAMES[(id - 1) % FEATURE_NAMES.length]

  const baseSize = 3
  const spread = Math.round(settings.sizeVar * 3)
  const minSize = Math.max(1, baseSize - spread)
  const maxSize = baseSize + spread
  const taskCount = minSize + Math.floor(rng() * (maxSize - minSize + 1))

  const baseRoles = 2
  const roleSpread = Math.round(settings.roleVar * 4)
  const minRoles = Math.max(1, baseRoles - Math.floor(roleSpread / 2))
  const maxRoles = Math.min(ROLES.length, baseRoles + roleSpread)
  const roleCount = minRoles + Math.floor(rng() * (maxRoles - minRoles + 1))

  const shuffled = [...ROLES].sort(() => rng() - 0.5)
  const chosenRoles = shuffled.slice(0, roleCount)

  const tasks: Task[] = []
  const counts = new Array(chosenRoles.length).fill(1) as number[]
  let remaining = taskCount - chosenRoles.length
  while (remaining > 0) {
    counts[Math.floor(rng() * chosenRoles.length)]++
    remaining--
  }

  for (let r = 0; r < chosenRoles.length; r++) {
    for (let i = 0; i < counts[r]; i++) {
      const work = 0.8 + rng() * 1.4
      tasks.push({
        id: nextTaskId++,
        role: chosenRoles[r],
        work,
        progress: 0,
        status: 'todo',
        assignee: null,
      })
    }
  }

  return {
    id,
    name: `F-${String(id).padStart(3, '0')} ${name}`,
    hue,
    tasks,
    createdAt: now,
    startedAt: null,
    finishedAt: null,
    status: 'backlog',
  }
}

function makeMember(i: number, role: Role): Member {
  return {
    id: i,
    name: MEMBER_NAMES[i] ?? `P${i + 1}`,
    roles: [role],
    currentTask: null,
  }
}

function defaultTeam(): Member[] {
  const defaults: Role[] = ['FE', 'BE', 'DSGN', 'QA', 'OPS', 'DATA']
  return defaults.map((r, i) => makeMember(i, r))
}

function cloneFeatureFresh(f: Feature): Feature {
  return {
    ...f,
    status: 'backlog',
    startedAt: null,
    finishedAt: null,
    tasks: f.tasks.map(t => ({
      ...t,
      status: 'todo',
      progress: 0,
      assignee: null,
    })),
  }
}

export function makeInitialState(rng: () => number, settings: SimSettings): SimState {
  nextFeatureId = 1
  nextTaskId = 1

  const state: SimState = {
    backlog: [],
    backlogSnapshot: [],
    inProgress: [],
    done: [],
    team: defaultTeam(),
    leadTimes: [],
    simTime: 0,
    wipIntegral: 0,
    lastGenAt: 0,
    startedAt: null,
  }

  const seedCount = settings.initialBacklog ?? 20
  for (let i = 0; i < seedCount; i++) {
    state.backlog.push(makeFeature(rng, 0, settings))
  }
  state.backlogSnapshot = state.backlog.map(cloneFeatureFresh)

  return state
}

export function resetFromSnapshot(state: SimState): SimState {
  state.backlog = state.backlogSnapshot.map(cloneFeatureFresh)
  state.inProgress = []
  state.done = []
  state.leadTimes = []
  state.simTime = 0
  state.wipIntegral = 0
  state.lastGenAt = 0
  state.startedAt = null
  for (const m of state.team) {
    m.currentTask = null
  }
  return state
}

export function regenerate(settings: SimSettings): { state: SimState; rng: () => number } {
  const rng = mulberry32(Math.floor(Math.random() * 1e9))
  const state = makeInitialState(rng, settings)
  return { state, rng }
}

export function tick(
  state: SimState,
  dtSim: number,
  settings: SimSettings,
  rng: () => number,
): SimState {
  state.simTime += dtSim
  state.wipIntegral += state.inProgress.length * dtSim
  if (state.startedAt === null) state.startedAt = state.simTime

  const minBacklog = settings.minBacklog ?? 10
  while (state.backlog.length < minBacklog) {
    state.backlog.push(makeFeature(rng, state.simTime, settings))
  }

  for (const m of state.team) {
    if (m.currentTask) continue
    if (m.roles.length === 0) continue

    let chosen: { f: Feature; t: Task } | null = null

    for (const f of state.inProgress) {
      const t = f.tasks.find(t => t.status === 'todo' && m.roles.includes(t.role))
      if (t) { chosen = { f, t }; break }
    }

    if (!chosen) {
      for (let i = 0; i < state.backlog.length; i++) {
        const f = state.backlog[i]
        const t = f.tasks.find(t => t.status === 'todo' && m.roles.includes(t.role))
        if (t) {
          state.backlog.splice(i, 1)
          f.status = 'in-progress'
          f.startedAt = state.simTime
          state.inProgress.push(f)
          chosen = { f, t }
          break
        }
      }
    }

    if (chosen) {
      chosen.t.status = 'doing'
      chosen.t.assignee = m.id
      m.currentTask = { featureId: chosen.f.id, taskId: chosen.t.id }
    }
  }

  for (const f of state.inProgress) {
    for (const t of f.tasks) {
      if (t.status === 'doing') {
        t.progress += dtSim
        if (t.progress >= t.work) {
          t.progress = t.work
          t.status = 'done'
          const m = state.team.find(m => m.id === t.assignee)
          if (m) m.currentTask = null
        }
      }
    }
  }

  for (let i = state.inProgress.length - 1; i >= 0; i--) {
    const f = state.inProgress[i]
    if (f.tasks.every(t => t.status === 'done')) {
      f.status = 'done'
      f.finishedAt = state.simTime
      const lt: LeadTimeEntry = { id: f.id, ms: f.finishedAt - f.createdAt, finishedAt: f.finishedAt }
      state.leadTimes.push(lt)
      if (state.leadTimes.length > 200) state.leadTimes.shift()
      state.done.unshift(f)
      if (state.done.length > 40) state.done.length = 40
      state.inProgress.splice(i, 1)
    }
  }

  return state
}

export function computeStats(leadTimes: LeadTimeEntry[]): SimStats {
  if (leadTimes.length === 0) {
    return { count: 0, avg: 0, min: 0, max: 0, p50: 0, p85: 0, buckets: [], bucketSize: 0, maxBucket: 0 }
  }

  const vals = leadTimes.map(l => l.ms)
  const sorted = [...vals].sort((a, b) => a - b)
  const sum = vals.reduce((a, b) => a + b, 0)
  const avg = sum / vals.length
  const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
  const min = sorted[0]
  const max = sorted[sorted.length - 1]

  const maxBucket = Math.max(20, Math.ceil(max / 5) * 5)
  const bucketCount = 12
  const bucketSize = maxBucket / bucketCount
  const buckets = new Array(bucketCount).fill(0) as number[]
  for (const v of vals) {
    const idx = Math.min(bucketCount - 1, Math.floor(v / bucketSize))
    buckets[idx]++
  }

  return { count: vals.length, avg, min, max, p50: pct(0.5), p85: pct(0.85), buckets, bucketSize, maxBucket }
}
