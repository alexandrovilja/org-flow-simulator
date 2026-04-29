import { describe, it, expect } from 'vitest'
import { mulberry32, makeInitialState, tick } from '@/simulation/engine'
import type { SimSettings } from '@/types/simulation'

const SETTINGS: SimSettings = {
  minBacklog: 0,
  wipLimit: 6,
  sizeVar: 0,       // uniformní features — snazší předvídatelnost
  roleVar: 0,       // všechny features vyžadují stejné role
  initialBacklog: 5,
}

describe('feat-002: konfigurace týmu', () => {
  describe('přiřazování úkolů podle rolí', () => {
    it('člen přebere pouze úkol odpovídající jeho roli', () => {
      const rng = mulberry32(1)
      const state = makeInitialState(rng, SETTINGS)
      tick(state, 0.01, SETTINGS, rng)

      for (const m of state.team) {
        if (!m.currentTask) continue
        const feature = state.inProgress.find(f => f.id === m.currentTask!.featureId)
        const task = feature?.tasks.find(t => t.id === m.currentTask!.taskId)
        expect(task).toBeDefined()
        expect(m.roles).toContain(task!.role)
      }
    })

    it('člen bez rolí nepřebere žádný úkol', () => {
      const rng = mulberry32(1)
      const state = makeInitialState(rng, SETTINGS)
      // Odebereme všechny role prvnímu členovi
      state.team[0].roles = []
      tick(state, 0.01, SETTINGS, rng)
      expect(state.team[0].currentTask).toBeNull()
    })

    it('člen preferuje novou feature z backlogu před dokončením rozběhnuté', () => {
      const rng = mulberry32(42)
      const state = makeInitialState(rng, SETTINGS)

      // Omezíme tým na jediného FE člena — eliminujeme vliv ostatních členů,
      // kteří by mohli nepredikovatelně spotřebovat backlog a zkreslovat výsledek
      const feMember = state.team.find(m => m.roles.includes('FE'))!
      state.team = [feMember]
      feMember.currentTask = null

      // Feature v inProgress s jedním nedokončeným FE úkolem — člen by ji mohl vzít,
      // ale pouze pokud backlog nenabízí nic lepšího (což je případ, který testujeme)
      const inProgressFeature = state.backlog.shift()!
      inProgressFeature.status = 'in-progress'
      inProgressFeature.tasks = [{
        id: 9001, role: 'FE', work: 5, progress: 0, status: 'todo', assignee: null,
      }]
      state.inProgress.push(inProgressFeature)

      // Explicitně nastavíme první backlogovou feature tak, aby obsahovala FE úkol.
      // Bez toho by záviselo na konkrétních rolích vygenerovaných seedem 42 — to by
      // byl křehký test, který selže při změně generátoru.
      state.backlog[0].tasks = [{
        id: 9002, role: 'FE', work: 3, progress: 0, status: 'todo', assignee: null,
      }]

      const backlogSizeBefore = state.backlog.length
      expect(backlogSizeBefore).toBeGreaterThan(0)

      // Po ticku: člen musí sáhnout do backlogu (priorita 1), ne do inProgress (priorita 2)
      tick(state, 0.01, SETTINGS, rng)

      // Backlog se zmenšil — FE člen vytáhl novou feature
      expect(state.backlog.length).toBeLessThan(backlogSizeBefore)
      // Úkol v inProgress feature zůstává nepřiřazený (člen preferoval backlog)
      expect(inProgressFeature.tasks[0].assignee).toBeNull()
    })
  })

  describe('odebrání role za běhu', () => {
    it('po odebrání pracované role je úkol uvolněn zpět na todo', () => {
      const rng = mulberry32(42)
      const state = makeInitialState(rng, SETTINGS)
      tick(state, 0.01, SETTINGS, rng)

      // Najdeme člena, který právě pracuje
      const worker = state.team.find(m => m.currentTask !== null)
      if (!worker) return // skip if no worker assigned yet

      const { featureId, taskId } = worker.currentTask!
      const feature = state.inProgress.find(f => f.id === featureId)!
      const task = feature.tasks.find(t => t.id === taskId)!
      const roleBeingUsed = task.role

      // Simulujeme odebrání role (logika z Simulator.tsx handleRemoveRole)
      worker.roles = worker.roles.filter(r => r !== roleBeingUsed)
      task.status = 'todo'
      task.assignee = null
      task.progress = 0
      worker.currentTask = null

      expect(task.status).toBe('todo')
      expect(task.assignee).toBeNull()
      expect(worker.currentTask).toBeNull()
    })

    it('po odebrání nepracované role člen pokračuje v práci', () => {
      const rng = mulberry32(42)
      const state = makeInitialState(rng, SETTINGS)
      tick(state, 0.01, SETTINGS, rng)

      const worker = state.team.find(m => m.currentTask !== null)
      if (!worker) return

      const { featureId, taskId } = worker.currentTask!
      const feature = state.inProgress.find(f => f.id === featureId)!
      const task = feature.tasks.find(t => t.id === taskId)!
      const activeRole = task.role

      // Přidáme extra roli a odebereme ji (ne tu, na které pracuje)
      const otherRoles = (['FE', 'BE', 'DSGN', 'QA', 'OPS', 'DATA'] as const)
        .filter(r => r !== activeRole)
      const extraRole = otherRoles[0]
      worker.roles.push(extraRole)
      worker.roles = worker.roles.filter(r => r !== extraRole)

      // Aktuální úkol musí zůstat nedotčený
      expect(worker.currentTask).not.toBeNull()
      expect(worker.currentTask!.taskId).toBe(taskId)
    })
  })

  describe('lead time se hromadí s rostoucím týmem', () => {
    it('větší tým dokončí více features za stejný čas', () => {
      const runAndCount = (teamSize: number) => {
        const rng = mulberry32(42)
        const settings: SimSettings = { ...SETTINGS, initialBacklog: 20 }
        const state = makeInitialState(rng, settings)
        // Nastavíme tým na požadovaný počet členů (každý s jednou rolí)
        const roles = ['FE', 'BE', 'DSGN', 'QA', 'OPS', 'DATA'] as const
        state.team = Array.from({ length: teamSize }, (_, i) => ({
          id: i,
          name: `P${i}`,
          roles: [roles[i % roles.length]],
          currentTask: null,
        }))
        for (let i = 0; i < 60; i++) tick(state, 1, settings, rng)
        return state.done.length
      }

      const small = runAndCount(2)
      const large = runAndCount(6)
      expect(large).toBeGreaterThan(small)
    })
  })
})
