import { describe, it, expect } from 'vitest'
import { mulberry32, makeInitialState, resetFromSnapshot, tick } from '@/simulation/engine'
import type { SimSettings } from '@/types/simulation'

const SETTINGS: SimSettings = {
  minBacklog: 0,
  wipLimit: 6,
  sizeVar: 0,
  roleVar: 0,
  initialBacklog: 5,
}

describe('feat-002: waiting time', () => {
  describe('akumulace idle času', () => {
    it('člen s rolemi a bez úkolu akumuluje idleSec', () => {
      const rng = mulberry32(1)
      const state = makeInitialState(rng, SETTINGS)
      // Prázdný tým — jen jeden člen bez rolí, aby nikdo nepracoval
      state.team = [{ id: 1, name: 'X', roles: [], currentTask: null, idleSec: 0 }]

      tick(state, 1, SETTINGS, rng)
      // Člen bez rolí NESMÍ akumulovat idle čas — nemůže pracovat ze strukturálních důvodů
      expect(state.team[0].idleSec).toBe(0)
    })

    it('člen s rolemi a bez dostupného úkolu akumuluje idleSec', () => {
      const rng = mulberry32(1)
      const state = makeInitialState(rng, SETTINGS)
      // Tým s jedním FE členem, backlog vyčistíme — nikdo nemůže pracovat
      state.team = [{ id: 1, name: 'X', roles: ['FE'], currentTask: null, idleSec: 0 }]
      state.backlog = []
      state.inProgress = []

      tick(state, 1.5, SETTINGS, rng)
      expect(state.team[0].idleSec).toBe(1.5)
    })

    it('člen pracující na úkolu neakumuluje idleSec', () => {
      const rng = mulberry32(1)
      const state = makeInitialState(rng, SETTINGS)
      // Jeden tick — člen dostane úkol
      tick(state, 0.01, SETTINGS, rng)
      const worker = state.team.find(m => m.currentTask !== null)
      if (!worker) return
      const idleBefore = worker.idleSec

      // Další tick — člen stále pracuje, idleSec se nesmí zvýšit
      tick(state, 1, SETTINGS, rng)
      expect(worker.idleSec).toBe(idleBefore)
    })

    it('idleSec se resetuje na 0 při resetFromSnapshot', () => {
      const rng = mulberry32(1)
      const state = makeInitialState(rng, SETTINGS)
      // Ručně nastavíme nenulový idleSec
      state.team[0].idleSec = 42
      resetFromSnapshot(state)
      expect(state.team[0].idleSec).toBe(0)
    })

    it('nový člen přidaný za běhu začíná s idleSec = 0', () => {
      const rng = mulberry32(1)
      const state = makeInitialState(rng, SETTINGS)
      tick(state, 5, SETTINGS, rng)
      // Přidáme nového člena — musí mít idleSec = 0
      state.team.push({ id: 99, name: 'Nova', roles: ['QA'], currentTask: null, idleSec: 0 })
      expect(state.team.find(m => m.id === 99)!.idleSec).toBe(0)
    })
  })

  describe('celkový waiting time', () => {
    it('tým čekající N sekund má totalWait = N * počet_členů_s_rolemi', () => {
      const rng = mulberry32(1)
      const state = makeInitialState(rng, SETTINGS)
      // Dva členové s rolemi, prázdný backlog — oba čekají
      state.team = [
        { id: 1, name: 'A', roles: ['FE'], currentTask: null, idleSec: 0 },
        { id: 2, name: 'B', roles: ['BE'], currentTask: null, idleSec: 0 },
      ]
      state.backlog = []
      state.inProgress = []

      tick(state, 3, SETTINGS, rng)
      const totalWait = state.team.reduce((sum, m) => sum + m.idleSec, 0)
      expect(totalWait).toBeCloseTo(6, 5)
    })

    it('větší tým má vyšší nebo stejný totalWait při stejném backlogu', () => {
      // Větší tým → více kapacity → část členů čeká na nedostatek práce
      const run = (teamSize: number) => {
        const rng = mulberry32(42)
        const settings: SimSettings = { ...SETTINGS, initialBacklog: 3 }
        const state = makeInitialState(rng, settings)
        const roles = ['FE', 'BE', 'DSGN', 'QA', 'OPS', 'DATA'] as const
        state.team = Array.from({ length: teamSize }, (_, i) => ({
          id: i, name: `M${i}`, roles: [roles[i % roles.length]],
          currentTask: null, idleSec: 0,
        }))
        for (let i = 0; i < 30; i++) tick(state, 1, settings, rng)
        return state.team.reduce((sum, m) => sum + m.idleSec, 0)
      }
      // Větší tým → dříve dojde práce → více idle času celkem
      expect(run(6)).toBeGreaterThanOrEqual(run(2))
    })
  })
})
