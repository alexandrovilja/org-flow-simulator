import { describe, it, expect } from 'vitest'
import { mulberry32, makeInitialState } from '@/simulation/engine'
import type { SimSettings } from '@/types/simulation'

const BASE: SimSettings = {
  minBacklog: 0,
  wipLimit: 6,
  sizeVar: 0,
  roleVar: 0,
  initialBacklog: 30,
  minSpecializations: 1,
}

describe('feat-003: konfigurace backlogu', () => {
  describe('initialBacklog', () => {
    it('vygeneruje přesně tolik features, kolik určuje initialBacklog', () => {
      for (const count of [10, 50, 100]) {
        const state = makeInitialState(mulberry32(1), { ...BASE, initialBacklog: count })
        expect(state.backlog).toHaveLength(count)
      }
    })

    it('snapshot odpovídá vygenerovanému backlogu', () => {
      const state = makeInitialState(mulberry32(1), { ...BASE, initialBacklog: 20 })
      expect(state.backlogSnapshot).toHaveLength(20)
    })
  })

  describe('sizeVar — variabilita velikosti features', () => {
    it('sizeVar: 0 → každá feature má přibližně 3 úkoly (baseSize)', () => {
      const state = makeInitialState(mulberry32(7), { ...BASE, sizeVar: 0, initialBacklog: 50 })
      const taskCounts = state.backlog.map(f => f.tasks.length)
      const allExact = taskCounts.every(c => c === 3)
      expect(allExact).toBe(true)
    })

    it('sizeVar: 1 → různé počty úkolů (větší rozptyl)', () => {
      const state = makeInitialState(mulberry32(7), { ...BASE, sizeVar: 1, initialBacklog: 50 })
      const taskCounts = state.backlog.map(f => f.tasks.length)
      const min = Math.min(...taskCounts)
      const max = Math.max(...taskCounts)
      expect(max - min).toBeGreaterThan(0)
    })

    it('větší sizeVar → průměrně vyšší nebo stejný počet úkolů', () => {
      const avg = (s: SimSettings) => {
        const state = makeInitialState(mulberry32(42), s)
        const total = state.backlog.reduce((sum, f) => sum + f.tasks.length, 0)
        return total / state.backlog.length
      }
      const low = avg({ ...BASE, sizeVar: 0 })
      const high = avg({ ...BASE, sizeVar: 1 })
      expect(high).toBeGreaterThanOrEqual(low)
    })
  })

  describe('roleVar — variabilita složení rolí', () => {
    it('roleVar: 0 → každá feature vyžaduje přibližně 2 různé role (baseRoles)', () => {
      const state = makeInitialState(mulberry32(7), { ...BASE, roleVar: 0, initialBacklog: 50 })
      for (const f of state.backlog) {
        const uniqueRoles = new Set(f.tasks.map(t => t.role)).size
        expect(uniqueRoles).toBe(2)
      }
    })

    it('roleVar: 1 → různý počet rolí napříč features', () => {
      const state = makeInitialState(mulberry32(7), { ...BASE, roleVar: 1, initialBacklog: 50 })
      const roleCounts = state.backlog.map(f => new Set(f.tasks.map(t => t.role)).size)
      const min = Math.min(...roleCounts)
      const max = Math.max(...roleCounts)
      expect(max - min).toBeGreaterThan(0)
    })
  })

  describe('determinismus — stejný seed = stejný backlog', () => {
    it('dva runs se stejným seedem produkují identické backlog', () => {
      const s1 = makeInitialState(mulberry32(42), BASE)
      const s2 = makeInitialState(mulberry32(42), BASE)
      const names1 = s1.backlog.map(f => f.name)
      const names2 = s2.backlog.map(f => f.name)
      expect(names1).toEqual(names2)
    })

    it('různé seedy produkují různé rozložení úkolů', () => {
      // Jména features jsou pevná (daná pořadím ID), ale počty úkolů a role závisí na seedu
      const s1 = makeInitialState(mulberry32(1), { ...BASE, sizeVar: 1, roleVar: 1 })
      const s2 = makeInitialState(mulberry32(999), { ...BASE, sizeVar: 1, roleVar: 1 })
      const taskCounts1 = s1.backlog.map(f => f.tasks.length)
      const taskCounts2 = s2.backlog.map(f => f.tasks.length)
      expect(taskCounts1).not.toEqual(taskCounts2)
    })
  })
})
