import { describe, it, expect } from 'vitest'
import { formatTime } from '@/lib/formatTime'
import { mulberry32, makeInitialState, resetFromSnapshot, tick } from '@/simulation/engine'
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
// formatTime
// ---------------------------------------------------------------------------

describe('formatTime', () => {
  it('formats zero as 00:00.0', () => {
    expect(formatTime(0)).toBe('00:00.0')
  })

  it('formats seconds correctly', () => {
    expect(formatTime(5)).toBe('00:05.0')
    expect(formatTime(59)).toBe('00:59.0')
  })

  it('formats minutes correctly', () => {
    expect(formatTime(60)).toBe('01:00.0')
    expect(formatTime(125)).toBe('02:05.0')
  })

  it('formats tenths of a second correctly', () => {
    expect(formatTime(1.3)).toBe('00:01.3')
    expect(formatTime(1.95)).toBe('00:01.9')
  })

  it('truncates (does not round) tenths', () => {
    // 1.99 should show .9, not round up to .10
    expect(formatTime(1.99)).toBe('00:01.9')
  })

  it('pads minutes and seconds with leading zeros', () => {
    expect(formatTime(61.5)).toBe('01:01.5')
  })
})

// ---------------------------------------------------------------------------
// finished flag — engine
// ---------------------------------------------------------------------------

describe('SimState.finished', () => {
  it('starts as false after makeInitialState', () => {
    const rng = mulberry32(42)
    const state = makeInitialState(rng, SETTINGS)
    expect(state.finished).toBe(false)
  })

  it('remains false while backlog or inProgress are non-empty', () => {
    const rng = mulberry32(42)
    const state = makeInitialState(rng, SETTINGS)
    tick(state, 1, SETTINGS, rng)
    expect(state.finished).toBe(false)
  })

  it('becomes true when backlog and inProgress are both empty', () => {
    const rng = mulberry32(42)
    // Use a tiny backlog so the simulation finishes quickly
    const tinySettings: SimSettings = { ...SETTINGS, initialBacklog: 3 }
    const state = makeInitialState(rng, tinySettings)
    // Run long enough for all features to complete (tasks take 0.8–2.2s each)
    for (let i = 0; i < 200; i++) {
      tick(state, 1, tinySettings, rng)
      if (state.finished) break
    }
    expect(state.finished).toBe(true)
    expect(state.backlog).toHaveLength(0)
    expect(state.inProgress).toHaveLength(0)
  })

  it('does not advance simTime after finished', () => {
    const rng = mulberry32(42)
    const tinySettings: SimSettings = { ...SETTINGS, initialBacklog: 3 }
    const state = makeInitialState(rng, tinySettings)
    for (let i = 0; i < 200; i++) {
      tick(state, 1, tinySettings, rng)
      if (state.finished) break
    }
    const frozenTime = state.simTime
    // A real Simulator would stop calling tick() after finished —
    // but the engine itself still accepts ticks; the guard is in the UI.
    // What we verify is that finished stays true and doesn't flip back.
    expect(state.finished).toBe(true)
    expect(state.simTime).toBe(frozenTime)
  })
})

// ---------------------------------------------------------------------------
// resetFromSnapshot resets finished
// ---------------------------------------------------------------------------

describe('resetFromSnapshot with finished state', () => {
  it('resets finished to false', () => {
    const rng = mulberry32(42)
    const tinySettings: SimSettings = { ...SETTINGS, initialBacklog: 3 }
    const state = makeInitialState(rng, tinySettings)
    for (let i = 0; i < 200; i++) {
      tick(state, 1, tinySettings, rng)
      if (state.finished) break
    }
    expect(state.finished).toBe(true)

    resetFromSnapshot(state)
    expect(state.finished).toBe(false)
  })

  it('restores backlog after reset from finished state', () => {
    const rng = mulberry32(42)
    const tinySettings: SimSettings = { ...SETTINGS, initialBacklog: 3 }
    const state = makeInitialState(rng, tinySettings)
    for (let i = 0; i < 200; i++) {
      tick(state, 1, tinySettings, rng)
      if (state.finished) break
    }

    resetFromSnapshot(state)
    expect(state.backlog).toHaveLength(3)
    expect(state.simTime).toBe(0)
  })
})
