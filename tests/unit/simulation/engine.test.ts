import { describe, it, expect } from 'vitest'
import { mulberry32, makeInitialState, resetFromSnapshot, tick, computeStats } from '@/simulation/engine'
import type { SimSettings } from '@/types/simulation'

const DEFAULT_SETTINGS: SimSettings = {
  minBacklog: 0,
  wipLimit: 6,
  sizeVar: 0.4,
  roleVar: 0.5,
  initialBacklog: 20,
}

describe('mulberry32', () => {
  it('produces deterministic output for the same seed', () => {
    const rng1 = mulberry32(42)
    const rng2 = mulberry32(42)
    expect(rng1()).toBe(rng2())
    expect(rng1()).toBe(rng2())
    expect(rng1()).toBe(rng2())
  })

  it('produces values in [0, 1)', () => {
    const rng = mulberry32(99)
    for (let i = 0; i < 100; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('makeInitialState', () => {
  it('pre-seeds backlog with initialBacklog items', () => {
    const rng = mulberry32(42)
    const state = makeInitialState(rng, DEFAULT_SETTINGS)
    expect(state.backlog).toHaveLength(DEFAULT_SETTINGS.initialBacklog)
  })

  it('starts with empty inProgress and done', () => {
    const rng = mulberry32(42)
    const state = makeInitialState(rng, DEFAULT_SETTINGS)
    expect(state.inProgress).toHaveLength(0)
    expect(state.done).toHaveLength(0)
  })

  it('snapshots the initial backlog', () => {
    const rng = mulberry32(42)
    const state = makeInitialState(rng, DEFAULT_SETTINGS)
    expect(state.backlogSnapshot).toHaveLength(DEFAULT_SETTINGS.initialBacklog)
  })

  it('creates a team with 6 members, one role each', () => {
    const rng = mulberry32(42)
    const state = makeInitialState(rng, DEFAULT_SETTINGS)
    expect(state.team).toHaveLength(6)
    state.team.forEach(m => expect(m.roles).toHaveLength(1))
  })
})

describe('resetFromSnapshot', () => {
  it('restores backlog to snapshot length', () => {
    const rng = mulberry32(42)
    const state = makeInitialState(rng, DEFAULT_SETTINGS)
    // drain the backlog artificially
    state.backlog = []
    resetFromSnapshot(state)
    expect(state.backlog).toHaveLength(DEFAULT_SETTINGS.initialBacklog)
  })

  it('clears inProgress, done, and leadTimes', () => {
    const rng = mulberry32(42)
    const state = makeInitialState(rng, DEFAULT_SETTINGS)
    tick(state, 5, DEFAULT_SETTINGS, rng)
    resetFromSnapshot(state)
    expect(state.inProgress).toHaveLength(0)
    expect(state.done).toHaveLength(0)
    expect(state.leadTimes).toHaveLength(0)
    expect(state.simTime).toBe(0)
  })
})

describe('tick', () => {
  it('advances simTime by dtSim', () => {
    const rng = mulberry32(42)
    const state = makeInitialState(rng, DEFAULT_SETTINGS)
    tick(state, 1.5, DEFAULT_SETTINGS, rng)
    expect(state.simTime).toBeCloseTo(1.5)
  })

  it('moves features from backlog to inProgress when team is idle', () => {
    const rng = mulberry32(42)
    const state = makeInitialState(rng, DEFAULT_SETTINGS)
    tick(state, 0.01, DEFAULT_SETTINGS, rng)
    expect(state.inProgress.length).toBeGreaterThan(0)
  })

  it('completes features over time and moves them to done', () => {
    const rng = mulberry32(42)
    const state = makeInitialState(rng, DEFAULT_SETTINGS)
    // Run simulation long enough for some features to complete (tasks take 0.8–2.2s each)
    for (let i = 0; i < 50; i++) {
      tick(state, 1, DEFAULT_SETTINGS, rng)
    }
    expect(state.done.length).toBeGreaterThan(0)
    expect(state.leadTimes.length).toBeGreaterThan(0)
  })
})

describe('computeStats', () => {
  it('returns zero stats for empty input', () => {
    const stats = computeStats([])
    expect(stats.count).toBe(0)
    expect(stats.avg).toBe(0)
  })

  it('computes correct avg for known values', () => {
    const stats = computeStats([
      { id: 1, ms: 10, finishedAt: 10 },
      { id: 2, ms: 20, finishedAt: 20 },
      { id: 3, ms: 30, finishedAt: 30 },
    ])
    expect(stats.avg).toBe(20)
    expect(stats.min).toBe(10)
    expect(stats.max).toBe(30)
    expect(stats.count).toBe(3)
  })

  it('computes p50 correctly', () => {
    const entries = [1, 2, 3, 4, 5].map((ms, i) => ({ id: i, ms, finishedAt: ms }))
    const stats = computeStats(entries)
    expect(stats.p50).toBe(3)
  })
})
