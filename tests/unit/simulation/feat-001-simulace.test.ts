import { describe, it, expect } from 'vitest'
import { mulberry32, makeInitialState, resetFromSnapshot, tick } from '@/simulation/engine'
import type { SimSettings } from '@/types/simulation'

const SETTINGS: SimSettings = {
  minBacklog: 0,
  wipLimit: 6,
  sizeVar: 0.4,
  roleVar: 0.5,
  initialBacklog: 20,
}

describe('feat-001: simulace průběhu vývoje', () => {
  describe('počáteční stav', () => {
    it('simTime začíná na 0', () => {
      const state = makeInitialState(mulberry32(1), SETTINGS)
      expect(state.simTime).toBe(0)
    })

    it('simulace neběží sama od sebe — bez volání tick() zůstane simTime na 0', () => {
      const state = makeInitialState(mulberry32(1), SETTINGS)
      // bez tick() se nic nemění
      expect(state.simTime).toBe(0)
      expect(state.inProgress).toHaveLength(0)
    })
  })

  describe('průběh simulace (tick)', () => {
    it('každý tick posune simTime o dtSim', () => {
      const rng = mulberry32(1)
      const state = makeInitialState(rng, SETTINGS)
      tick(state, 0.5, SETTINGS, rng)
      expect(state.simTime).toBeCloseTo(0.5)
      tick(state, 1.0, SETTINGS, rng)
      expect(state.simTime).toBeCloseTo(1.5)
    })

    it('features se časem přesouvají do done', () => {
      const rng = mulberry32(42)
      const state = makeInitialState(rng, SETTINGS)
      for (let i = 0; i < 60; i++) tick(state, 1, SETTINGS, rng)
      expect(state.done.length).toBeGreaterThan(0)
    })

    it('hotové features mají nastaveno finishedAt', () => {
      const rng = mulberry32(42)
      const state = makeInitialState(rng, SETTINGS)
      for (let i = 0; i < 60; i++) tick(state, 1, SETTINGS, rng)
      for (const f of state.done) {
        expect(f.finishedAt).not.toBeNull()
        expect(f.finishedAt).toBeGreaterThan(0)
      }
    })
  })

  describe('reset backlogu', () => {
    it('po resetu je simTime zpět na 0', () => {
      const rng = mulberry32(1)
      const state = makeInitialState(rng, SETTINGS)
      tick(state, 10, SETTINGS, rng)
      resetFromSnapshot(state)
      expect(state.simTime).toBe(0)
    })

    it('po resetu jsou inProgress a done prázdné', () => {
      const rng = mulberry32(42)
      const state = makeInitialState(rng, SETTINGS)
      for (let i = 0; i < 30; i++) tick(state, 1, SETTINGS, rng)
      resetFromSnapshot(state)
      expect(state.inProgress).toHaveLength(0)
      expect(state.done).toHaveLength(0)
    })

    it('po resetu jsou vymazány přiřazení úkolů členům týmu', () => {
      const rng = mulberry32(42)
      const state = makeInitialState(rng, SETTINGS)
      tick(state, 1, SETTINGS, rng)
      resetFromSnapshot(state)
      for (const m of state.team) {
        expect(m.currentTask).toBeNull()
      }
    })

    it('po resetu je backlog obnoven na původní počet položek', () => {
      const rng = mulberry32(1)
      const state = makeInitialState(rng, SETTINGS)
      for (let i = 0; i < 30; i++) tick(state, 1, SETTINGS, rng)
      resetFromSnapshot(state)
      expect(state.backlog).toHaveLength(SETTINGS.initialBacklog)
    })
  })
})
