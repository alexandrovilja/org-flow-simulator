import { describe, it, expect } from 'vitest'
import { mulberry32, makeInitialState, tick, ROLE_META, ROLES } from '@/simulation/engine'
import type { SimSettings, Role, RoleMeta } from '@/types/simulation'

/** Základní nastavení pro všechny testy: malý backlog, bez variability. */
const SETTINGS: SimSettings = {
  minBacklog: 0,
  wipLimit: 10,
  sizeVar: 0,
  roleVar: 0,
  initialBacklog: 3,
}

/** Vytvoří kopii ROLE_META s přepsanými hodnotami pro konkrétní role. */
function roleConfig(overrides: Partial<Record<Role, Partial<RoleMeta>>>): Record<Role, RoleMeta> {
  const base = structuredClone(ROLE_META)
  for (const [roleId, patch] of Object.entries(overrides) as [Role, Partial<RoleMeta>][]) {
    Object.assign(base[roleId], patch)
  }
  return base
}

describe('feat-005: konfigurace specializací', () => {
  describe('level — pořadí fází', () => {
    it('úkol level 1 může začít okamžitě (žádné prerekvizity)', () => {
      // Všechny role level 1 → všechny úkoly jsou paralelně dostupné od začátku
      const rng = mulberry32(1)
      const state = makeInitialState(rng, SETTINGS)
      // Všechny role mají výchozí level 1 — tým by měl rovnou dostat úkoly
      tick(state, 0.01, SETTINGS, rng)
      const working = state.team.filter(m => m.currentTask !== null)
      expect(working.length).toBeGreaterThan(0)
    })

    it('úkol level 2 je blokován, dokud nejsou hotové všechny úkoly level 1 ve stejné feature', () => {
      // DSGN level 1 required, FE level 2 required → obě role budou v každé feature
      // required: true zajistí, že roles jsou zahrnuty bez závislosti na roleVar
      const cfg = roleConfig({
        DSGN: { level: 1, required: true },
        FE:   { level: 2, required: true },
      })
      const rng = mulberry32(1)
      const state = makeInitialState(rng, SETTINGS, cfg)
      // Tým: pouze FE a DSGN specialisté, aby test byl izolovaný
      state.team = [
        { id: 1, name: 'DSGN', roles: ['DSGN'], currentTask: null },
        { id: 2, name: 'FE',   roles: ['FE'],   currentTask: null },
      ]

      tick(state, 0.01, SETTINGS, rng, cfg)

      // DSGN člen by měl mít úkol, FE člen ne (level 2 je blokován level 1)
      const dsgnWorking = state.team.find(m => m.name === 'DSGN')!.currentTask
      const feWorking   = state.team.find(m => m.name === 'FE')!.currentTask
      expect(dsgnWorking).not.toBeNull()
      expect(feWorking).toBeNull()
    })

    it('po dokončení level 1 se odemkne level 2', () => {
      // required: true zaručí přítomnost obou rolí v každé feature
      const cfg = roleConfig({
        DSGN: { level: 1, required: true },
        FE:   { level: 2, required: true },
      })
      const rng = mulberry32(1)
      const state = makeInitialState(rng, SETTINGS, cfg)
      state.team = [
        { id: 1, name: 'DSGN', roles: ['DSGN'], currentTask: null },
        { id: 2, name: 'FE',   roles: ['FE'],   currentTask: null },
      ]

      // Nastavíme VŠECHNY DSGN úkoly první feature na done
      // (s taskCount=3 a 2 rolemi může jedna role dostat 2 úkoly)
      const firstFeature = state.backlog[0]
      firstFeature.tasks.filter(t => t.role === 'DSGN').forEach(t => { t.status = 'done' })

      tick(state, 0.01, SETTINGS, rng, cfg)

      // Nyní FE úkol ve stejné feature by měl být dostupný
      const feWorking = state.team.find(m => m.name === 'FE')!.currentTask
      expect(feWorking).not.toBeNull()
    })

    it('úkoly na stejném levelu probíhají paralelně', () => {
      // FE a BE mají oba level 1 → oba mohou začít současně
      const cfg = roleConfig({
        FE: { level: 1 },
        BE: { level: 1 },
      })
      const rng = mulberry32(1)
      const state = makeInitialState(rng, SETTINGS, cfg)
      state.team = [
        { id: 1, name: 'FE', roles: ['FE'], currentTask: null },
        { id: 2, name: 'BE', roles: ['BE'], currentTask: null },
      ]

      tick(state, 0.01, SETTINGS, rng, cfg)

      const feWorking = state.team.find(m => m.name === 'FE')!.currentTask
      const beWorking = state.team.find(m => m.name === 'BE')!.currentTask
      expect(feWorking).not.toBeNull()
      expect(beWorking).not.toBeNull()
    })

    it('3-fázový řetězec: QA (level 3) je blokováno dokud FE/BE (level 2) nejsou hotové', () => {
      // Spec příklad 1: Design(1) → FE+BE(2) → QA(3)
      // Ověřujeme, že třetí fáze čeká — nestačí testovat jen 2 fáze
      const cfg = roleConfig({
        DSGN: { level: 1, required: true },
        FE:   { level: 2, required: true },
        QA:   { level: 3, required: true },
        BE:   { required: false },
        OPS:  { required: false },
        DATA: { required: false },
      })
      const rng = mulberry32(1)
      const state = makeInitialState(rng, SETTINGS, cfg)
      state.team = [
        { id: 1, name: 'DSGN', roles: ['DSGN'], currentTask: null },
        { id: 2, name: 'FE',   roles: ['FE'],   currentTask: null },
        { id: 3, name: 'QA',   roles: ['QA'],   currentTask: null },
      ]

      // Nastavíme DSGN (fáze 1) jako hotovou, FE (fáze 2) jako rozběhnutou (doing)
      const firstFeature = state.backlog[0]
      firstFeature.tasks.filter(t => t.role === 'DSGN').forEach(t => { t.status = 'done' })
      firstFeature.tasks.filter(t => t.role === 'FE').forEach(t => { t.status = 'doing' })

      tick(state, 0.01, SETTINGS, rng, cfg)

      // QA (fáze 3) nesmí začít, dokud FE (fáze 2) není done
      const qaWorking = state.team.find(m => m.name === 'QA')!.currentTask
      expect(qaWorking).toBeNull()
    })

    it('výchozí konfigurace (všechny role level 1) zachovává původní paralelní chování', () => {
      // Zpětná kompatibilita: default ROLE_META → všechny role level 1 → vše paralelně
      const rng = mulberry32(1)
      const state = makeInitialState(rng, SETTINGS)
      tick(state, 0.01, SETTINGS, rng)
      // Všichni členové s odpovídající rolí v backlogu by měli dostat úkol
      const working = state.team.filter(m => m.currentTask !== null)
      expect(working.length).toBeGreaterThan(1)
    })
  })

  describe('required — povinná specializace', () => {
    it('required role je přítomna v každé vygenerované feature', () => {
      const cfg = roleConfig({ QA: { required: true } })
      const rng = mulberry32(1)
      const state = makeInitialState(rng, SETTINGS, cfg)
      const allFeatures = [...state.backlog, ...state.inProgress]
      for (const f of allFeatures) {
        const hasQA = f.tasks.some(t => t.role === 'QA')
        expect(hasQA).toBe(true)
      }
    })

    it('required role je přítomna i při roleVar = 0', () => {
      // roleVar = 0 normálně generuje minimální sadu rolí — required ji přidá navíc
      const cfg = roleConfig({ QA: { required: true } })
      const settingsNoVar = { ...SETTINGS, roleVar: 0 }
      const rng = mulberry32(2)
      const state = makeInitialState(rng, settingsNoVar, cfg)
      for (const f of state.backlog) {
        expect(f.tasks.some(t => t.role === 'QA')).toBe(true)
      }
    })

    it('více required rolí jsou všechny přítomny v každé feature', () => {
      const cfg = roleConfig({ QA: { required: true }, DSGN: { required: true } })
      const rng = mulberry32(3)
      const state = makeInitialState(rng, SETTINGS, cfg)
      for (const f of state.backlog) {
        expect(f.tasks.some(t => t.role === 'QA')).toBe(true)
        expect(f.tasks.some(t => t.role === 'DSGN')).toBe(true)
      }
    })

    it('bez required rolí se chování neliší od výchozího', () => {
      // Explicitní required: false na všech rolích = totéž jako ROLE_META default
      const cfg = roleConfig({})  // žádné přepsání — všechny required: false
      const rng1 = mulberry32(7)
      const state1 = makeInitialState(rng1, SETTINGS, cfg)
      const rng2 = mulberry32(7)
      const state2 = makeInitialState(rng2, SETTINGS)
      // Backlog by měl být identický (stejný seed, stejná konfigurace)
      expect(state1.backlog.length).toBe(state2.backlog.length)
      for (let i = 0; i < state1.backlog.length; i++) {
        const roles1 = state1.backlog[i].tasks.map(t => t.role).sort()
        const roles2 = state2.backlog[i].tasks.map(t => t.role).sort()
        expect(roles1).toEqual(roles2)
      }
    })
  })
})
