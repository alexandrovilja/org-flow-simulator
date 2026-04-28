export type Role = 'FE' | 'BE' | 'DSGN' | 'QA' | 'OPS' | 'DATA'

export interface RoleMeta {
  label: string
  color: string
}

export type TaskStatus = 'todo' | 'doing' | 'done'
export type FeatureStatus = 'backlog' | 'in-progress' | 'done'

export interface Task {
  id: number
  role: Role
  work: number
  progress: number
  status: TaskStatus
  assignee: number | null
}

export interface Feature {
  id: number
  name: string
  hue: number
  tasks: Task[]
  createdAt: number
  startedAt: number | null
  finishedAt: number | null
  status: FeatureStatus
}

export interface Member {
  id: number
  name: string
  roles: Role[]
  currentTask: { featureId: number; taskId: number } | null
}

export interface LeadTimeEntry {
  id: number
  ms: number
  finishedAt: number
}

export interface SimState {
  backlog: Feature[]
  backlogSnapshot: Feature[]
  inProgress: Feature[]
  done: Feature[]
  team: Member[]
  leadTimes: LeadTimeEntry[]
  simTime: number
  wipIntegral: number
  lastGenAt: number
  startedAt: number | null
}

export interface SimSettings {
  minBacklog: number
  wipLimit: number
  sizeVar: number
  roleVar: number
  initialBacklog: number
}

export interface SimStats {
  count: number
  avg: number
  min: number
  max: number
  p50: number
  p85: number
  buckets: number[]
  bucketSize: number
  maxBucket: number
}
