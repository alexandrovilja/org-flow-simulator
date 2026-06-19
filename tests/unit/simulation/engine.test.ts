import { describe, it, expect } from 'vitest'
import { mulberry32, makeInitialState, resetFromSnapshot, tick, computeStats, regenerate, applyPreset, PRESETS } from '@/simulation/engine'
import type { SimSettings } from '@/types/simulation'

const DEFAULT_SETTINGS: SimSettings = {
  minBacklog: 0,
  wipLimit: 6,
  sizeVar: 0.4,
  roleVar: 0.5,
  initialBacklog: 20,
  minSpecializations: 1,
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

describe('determinismus simulace', () => {
  // Pevný dt odpovídá jednomu snímku při 60 fps — stejná hodnota jako TARGET_DT_MS/1000 v UI.
  const FIXED_DT = 1 / 60

  it('dva běhy se stejným seedem a stejným fixním dtSim producují identický simTime', () => {
    // Engine je deterministický: stejný seed + stejná sekvence dtSim → stejný výsledek.
    const runSimulation = () => {
      const rng = mulberry32(42)
      const state = makeInitialState(rng, DEFAULT_SETTINGS)
      let ticks = 0
      while (!state.finished && ticks < 100_000) {
        tick(state, FIXED_DT, DEFAULT_SETTINGS, rng)
        ticks++
      }
      return state.simTime
    }

    expect(runSimulation()).toBe(runSimulation())
  })

  it('resetFromSnapshot + stejný fixní dtSim produkuje stejný výsledek jako první běh', () => {
    // Reset musí vrátit backlog do přesně stejného stavu → druhý běh musí doběhnout
    // ve stejném sim čase jako první.
    const rng = mulberry32(7)
    const settings: SimSettings = { ...DEFAULT_SETTINGS, initialBacklog: 10 }
    const state = makeInitialState(rng, settings)

    const runUntilDone = () => {
      let ticks = 0
      while (!state.finished && ticks < 100_000) {
        tick(state, FIXED_DT, settings, rng)
        ticks++
      }
      return state.simTime
    }

    const firstRun = runUntilDone()
    resetFromSnapshot(state)
    const secondRun = runUntilDone()

    expect(secondRun).toBe(firstRun)
  })

  it('různý dtSim (různé speed) dává různý simTime — izolace bugu', () => {
    // Bug: Simulator předával dtSim = FIXED_DT * speed. Velký dtSim způsobí jiné
    // floating-point zaokrouhlení při progress += dtSim → různý simTime.
    // Tento test dokumentuje chování enginu: dtSim MUSÍ být konstantní.
    const settings: SimSettings = { ...DEFAULT_SETTINGS, initialBacklog: 5 }

    const runWithDt = (dtSim: number) => {
      const rng = mulberry32(42)
      const state = makeInitialState(rng, settings)
      let ticks = 0
      while (!state.finished && ticks < 100_000) {
        tick(state, dtSim, settings, rng)
        ticks++
      }
      return state.simTime
    }

    // Různé dtSim → různé výsledky (floating point accumulation differs per step size)
    expect(runWithDt(FIXED_DT)).not.toBe(runWithDt(FIXED_DT * 10))
  })

  it('speed=1 a speed=10 dávají stejný simTime pokud dtSim je fixní a speed mění počet ticků', () => {
    // FIX: speed řídí počet ticků za snímek, ne velikost dtSim.
    // Simulujeme UI accumulator: accumulated += elapsed * speed, dtSim = fixed.
    const TARGET_DT_MS = 1000 / 60
    const ELAPSED_MS = TARGET_DT_MS  // jeden "frame" při 60 Hz
    const settings: SimSettings = { ...DEFAULT_SETTINGS, initialBacklog: 5 }

    const runWithSpeed = (speed: number) => {
      const rng = mulberry32(42)
      const state = makeInitialState(rng, settings)
      let accumulated = 0
      let safetyTicks = 0
      while (!state.finished && safetyTicks < 1_000_000) {
        // Přidáme elapsed čas škálovaný speedem — více accumulated = více ticků/frame
        accumulated += ELAPSED_MS * speed
        while (accumulated >= TARGET_DT_MS && !state.finished) {
          tick(state, FIXED_DT, settings, rng)
          accumulated -= TARGET_DT_MS
          safetyTicks++
        }
      }
      return state.simTime
    }

    expect(runWithSpeed(1)).toBe(runWithSpeed(10))
  })
})

describe('regenerate', () => {
  // Bug: regenerate() vždy vytváří tým přes defaultTeam() s jmény z MEMBER_NAMES
  // (Ada, Ben…), čímž přepsal jména nastavená presetem (Team A, Team B…).
  // Oprava: volající (handleRegenerate) po regenerate() překopíruje existující tým
  // a resetuje pouze per-simulační stav (currentTask, idleSec).

  it('vrátí stav s backlogem požadované délky', () => {
    const { state } = regenerate(DEFAULT_SETTINGS)
    expect(state.backlog).toHaveLength(DEFAULT_SETTINGS.initialBacklog)
  })

  it('vrátí nový RNG nezávislý na předchozích voláních', () => {
    const { rng: rng1 } = regenerate(DEFAULT_SETTINGS)
    const { rng: rng2 } = regenerate(DEFAULT_SETTINGS)
    // Dvě volání mají různý seed → různé první hodnoty
    expect(rng1()).not.toBe(rng2())
  })

  it('bez zachování týmu přepíše jména presetových jednotek výchozími (Ada, Ben…)', () => {
    // Dokumentuje chování samotného regenerate() — intentional, ne bug.
    // Bug nastane teprve pokud volající nezachová existující tým.
    const teamsPreset = PRESETS.find(p => p.id === 'teams')!
    const { state } = regenerate(DEFAULT_SETTINGS, teamsPreset.roleMeta)
    const names = state.team.map(m => m.name)
    expect(names).not.toContain('Team A')
  })

  it('po zachování existujícího týmu zůstanou jména Teams presetu', () => {
    // Toto je pattern použitý v handleRegenerate (Simulator.tsx) — fix bugu.
    const teamsPreset = PRESETS.find(p => p.id === 'teams')!
    const { team: existingTeam } = applyPreset(teamsPreset)
    const { state } = regenerate(DEFAULT_SETTINGS, teamsPreset.roleMeta)
    // Zachováme existující tým, jen vynulujeme simulační stav
    state.team = existingTeam.map(m => ({ ...m, currentTask: null, idleSec: 0 }))
    expect(state.team.map(m => m.name)).toEqual(
      ['Team A', 'Team B', 'Team C', 'Team D', 'Team E', 'Team F'],
    )
  })

  it('po zachování týmu People presetu zůstanou jména Ada–Fae', () => {
    const peoplePreset = PRESETS.find(p => p.id === 'people')!
    const { team: existingTeam } = applyPreset(peoplePreset)
    const { state } = regenerate(DEFAULT_SETTINGS, peoplePreset.roleMeta)
    state.team = existingTeam.map(m => ({ ...m, currentTask: null, idleSec: 0 }))
    expect(state.team.map(m => m.name)).toEqual(
      ['Ada', 'Ben', 'Chen', 'Dani', 'Eli', 'Fae'],
    )
  })

  it('po zachování týmu je simulační stav všech členů vynulován', () => {
    const teamsPreset = PRESETS.find(p => p.id === 'teams')!
    const { team: existingTeam } = applyPreset(teamsPreset)
    // Simulujeme "dirty" stav z předchozího běhu
    existingTeam[0].idleSec = 42
    const { state } = regenerate(DEFAULT_SETTINGS, teamsPreset.roleMeta)
    state.team = existingTeam.map(m => ({ ...m, currentTask: null, idleSec: 0 }))
    for (const m of state.team) {
      expect(m.currentTask).toBeNull()
      expect(m.idleSec).toBe(0)
    }
  })

  it('po zachování týmu jsou zachovány i role členů', () => {
    const teamsPreset = PRESETS.find(p => p.id === 'teams')!
    const { team: existingTeam } = applyPreset(teamsPreset)
    const { state } = regenerate(DEFAULT_SETTINGS, teamsPreset.roleMeta)
    state.team = existingTeam.map(m => ({ ...m, currentTask: null, idleSec: 0 }))
    expect(state.team[0].roles).toEqual(['DSGN'])
    expect(state.team[1].roles).toEqual(['ACQ'])
    expect(state.team[2].roles).toEqual(['PAY'])
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
      { id: 1, ms: 10, finishedAt: 10, handoffs: 0 },
      { id: 2, ms: 20, finishedAt: 20, handoffs: 0 },
      { id: 3, ms: 30, finishedAt: 30, handoffs: 0 },
    ])
    expect(stats.avg).toBe(20)
    expect(stats.min).toBe(10)
    expect(stats.max).toBe(30)
    expect(stats.count).toBe(3)
  })

  it('computes p50 correctly', () => {
    const entries = [1, 2, 3, 4, 5].map((ms, i) => ({ id: i, ms, finishedAt: ms, handoffs: 0 }))
    const stats = computeStats(entries)
    expect(stats.p50).toBe(3)
  })
})
