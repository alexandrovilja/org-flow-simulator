import { describe, it, expect } from 'vitest'
import { mulberry32, makeInitialState, resetFromSnapshot, tick } from '@/simulation/engine'
import type { SimSettings } from '@/types/simulation'

const SETTINGS: SimSettings = {
  minBacklog: 0,
  wipLimit: 6,
  sizeVar: 0,
  roleVar: 0,
  initialBacklog: 5,
  minSpecializations: 1,
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

    it('člen s rolemi a bez dostupného úkolu NEakumuluje idleSec, pokud práce jeho role neexistuje', () => {
      // Prázdný backlog = žádná práce pro nikoho → člen není "blokován", jen nemá co dělat
      const rng = mulberry32(1)
      const state = makeInitialState(rng, SETTINGS)
      state.team = [{ id: 1, name: 'X', roles: ['FE'], currentTask: null, idleSec: 0 }]
      state.backlog = []
      state.inProgress = []

      tick(state, 1.5, SETTINGS, rng)
      expect(state.team[0].idleSec).toBe(0)
    })

    it('člen s rolemi akumuluje idleSec, pokud práce jeho role existuje ale je nedostupná', () => {
      // FE úkol existuje v inProgress ale je 'doing' (jiný člen ho právě dělá)
      // → FE člen čeká → idle SE počítá
      const rng = mulberry32(1)
      const state = makeInitialState(rng, SETTINGS)
      state.team = [{ id: 1, name: 'FE', roles: ['FE'], currentTask: null, idleSec: 0 }]
      state.backlog = []
      state.inProgress = [{
        id: 1, name: 'F-001', hue: 0, priority: 1,
        createdAt: 0, startedAt: 0, finishedAt: null, status: 'in-progress',
        tasks: [{ id: 1, role: 'FE', work: 10, progress: 2, status: 'doing', assignee: 99 }],
      }]

      tick(state, 1.5, SETTINGS, rng)
      expect(state.team[0].idleSec).toBe(1.5)
    })

    it('člen s rolemi NEakumuluje idleSec, pokud práce jeho role neexistuje (zbývá jen jiná role)', () => {
      // Backlog obsahuje pouze QA úkoly — FE člen nemá co dělat → idle SE NEPOČÍTÁ
      const rng = mulberry32(1)
      const state = makeInitialState(rng, SETTINGS)
      state.team = [{ id: 1, name: 'FE', roles: ['FE'], currentTask: null, idleSec: 0 }]
      state.backlog = [{
        id: 1, name: 'F-001', hue: 0, priority: 1,
        createdAt: 0, startedAt: null, finishedAt: null, status: 'backlog',
        tasks: [{ id: 1, role: 'QA', work: 5, progress: 0, status: 'todo', assignee: null }],
      }]
      state.inProgress = []

      tick(state, 2, SETTINGS, rng)
      expect(state.team[0].idleSec).toBe(0)
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

  describe('idle čas a dostupná práce — timing bugu', () => {
    it('člen dostane úkol v prvním ticku → idleSec zůstane 0', () => {
      // BUG: idleSec se přičítal PŘED přiřazením úkolu, takže každý člen
      // dostal falešný idle i když práci hned dostal.
      // FIX: idle se přičítá až AFTER assignment loopem.
      const rng = mulberry32(1)
      const state = makeInitialState(rng, SETTINGS)
      // Jeden FE člen, jedna feature s FE úkolem — práce hned dostupná
      state.team = [{ id: 1, name: 'FE', roles: ['FE'], currentTask: null, idleSec: 0 }]
      state.backlog = [{
        id: 1, name: 'F-001 Test', hue: 0, priority: 1,
        createdAt: 0, startedAt: null, finishedAt: null, status: 'backlog',
        tasks: [{ id: 1, role: 'FE', work: 10, progress: 0, status: 'todo', assignee: null }],
      }]
      state.inProgress = []

      tick(state, 0.1, SETTINGS, rng)

      // Člen dostal úkol → idleSec musí zůstat 0
      expect(state.team[0].currentTask).not.toBeNull()
      expect(state.team[0].idleSec).toBe(0)
    })

    it('člen dokončí úkol — v dalším ticku (s dostupnou prací) idleSec neroste', () => {
      // BUG: v ticku po dokončení úkolu (currentTask = null) se idle přičetl
      // před přiřazením nového úkolu, i když práce byla ihned k dispozici.
      const rng = mulberry32(1)
      const state = makeInitialState(rng, SETTINGS)
      state.team = [{ id: 1, name: 'FE', roles: ['FE'], currentTask: null, idleSec: 0 }]
      // Dvě features — člen zpracuje první úkol a pak má hned druhou práci
      state.backlog = [
        {
          id: 1, name: 'F-001 A', hue: 0, priority: 1,
          createdAt: 0, startedAt: null, finishedAt: null, status: 'backlog',
          tasks: [{ id: 1, role: 'FE', work: 0.5, progress: 0, status: 'todo', assignee: null }],
        },
        {
          id: 2, name: 'F-002 B', hue: 45, priority: 2,
          createdAt: 0, startedAt: null, finishedAt: null, status: 'backlog',
          tasks: [{ id: 2, role: 'FE', work: 10, progress: 0, status: 'todo', assignee: null }],
        },
      ]
      state.inProgress = []

      // Tick 1: člen dostane úkol z F-001 (work=0.5)
      tick(state, 0.1, SETTINGS, rng)
      expect(state.team[0].currentTask).not.toBeNull()
      expect(state.team[0].idleSec).toBe(0)

      // Tick 2: úkol se dokončí (progress 0.1 + 0.5 = 0.6 >= 0.5), F-002 je dostupná.
      // Dokončení nastane v části "postup práce" — po přiřazovacím loopu.
      // Proto re-assignment nastane až v ticku 3.
      tick(state, 0.5, SETTINGS, rng)
      // Po dokončení úkolu je člen momentálně idle, ale idleSec ještě nenarostl
      // (idle akumulace proběhla PŘED dokončením tasku v témže ticku).
      expect(state.team[0].currentTask).toBeNull()
      expect(state.team[0].idleSec).toBe(0)

      // Tick 3: re-assignment — člen ihned dostane F-002, bez idle
      tick(state, 0.1, SETTINGS, rng)
      expect(state.team[0].currentTask).not.toBeNull()
      expect(state.team[0].idleSec).toBe(0)
    })

    it('člen po dokončení veškeré práce idleSec NEakumuluje', () => {
      // Pokud veškerá práce (jediná feature) je hotová, člen není "blokován"
      // — práce prostě skončila → idle se nepočítá.
      const rng = mulberry32(1)
      const state = makeInitialState(rng, SETTINGS)
      state.team = [{ id: 1, name: 'FE', roles: ['FE'], currentTask: null, idleSec: 0 }]
      state.backlog = [{
        id: 1, name: 'F-001', hue: 0, priority: 1,
        createdAt: 0, startedAt: null, finishedAt: null, status: 'backlog',
        tasks: [{ id: 1, role: 'FE', work: 0.1, progress: 0, status: 'todo', assignee: null }],
      }]
      state.inProgress = []

      // Dokončíme jedinou feature
      tick(state, 0.5, SETTINGS, rng)
      const idleAfterFinish = state.team[0].idleSec
      // Žádná práce nezbývá — idleSec se nesmí zvyšovat
      tick(state, 1, SETTINGS, rng)
      expect(state.team[0].idleSec).toBe(idleAfterFinish)
    })
  })

  describe('celkový waiting time', () => {
    it('tým čekající N sekund (s prací dostupnou) má totalWait = N * počet_blokovaných', () => {
      const rng = mulberry32(1)
      const state = makeInitialState(rng, SETTINGS)
      // Dva členové, oba mají práci ke své roli v inProgress ale task je 'doing'
      // (jiný assignee) → oba jsou blokovaní → idle SE počítá
      state.team = [
        { id: 1, name: 'A', roles: ['FE'], currentTask: null, idleSec: 0 },
        { id: 2, name: 'B', roles: ['BE'], currentTask: null, idleSec: 0 },
      ]
      state.backlog = []
      state.inProgress = [{
        id: 1, name: 'F-001', hue: 0, priority: 1,
        createdAt: 0, startedAt: 0, finishedAt: null, status: 'in-progress',
        tasks: [
          { id: 1, role: 'FE', work: 10, progress: 1, status: 'doing', assignee: 99 },
          { id: 2, role: 'BE', work: 10, progress: 1, status: 'doing', assignee: 98 },
        ],
      }]

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
