import { describe, it, expect } from 'vitest'
import { validateOrgSetup } from '@/simulation/organizationEngine'
import { feat, grant, orgDef, orgT, team } from './feat028Fixtures'

// feat-028 inkrement 1 (Mandáty a tok práce) — kontrola před během (R7, část o mandátech).
//
// Schválený kontrakt (spec, Pravidla chování „Kontrola před během“; analýza C1, C2):
//  - `validateOrgSetup(setup, backlog)` je čistá funkce a vrací seznam varování (prázdný = Run je povolený).
//  - Pro každou oblast použitou v backlogu bez týmu s mandátem: „No team has a mandate for WEB“, v pořadí oblastí
//    v organizaci (ne v pořadí backlogu).
// Kontrola chybějících skillů přijde s úpravami lidí (feat-030), prázdný backlog s editory (feat-036).

describe('feat-028 C1: oblast bez mandátu', () => {
  it('WEB bez mandátu → „No team has a mandate for WEB“', () => {
    const setup = orgT()
    team(setup, 'Team Web').mandates = []
    expect(validateOrgSetup(setup, [feat('F-1 (p1): WEB [Frontend 3]')])).toEqual(['No team has a mandate for WEB'])
  })

  it('dvě oblasti bez mandátu → dvě varování v pořadí oblastí, každá oblast jednou', () => {
    const setup = orgDef()
    team(setup, 'Team Billing').mandates = []
    team(setup, 'Team Web').mandates = []
    const backlog = [feat('F-1: WEB [Frontend 3]'), feat('F-2: BIL [QA 2] | WEB [Java 1]'), feat('F-3: BIL [Java 1]')]
    expect(validateOrgSetup(setup, backlog)).toEqual(['No team has a mandate for BIL', 'No team has a mandate for WEB'])
  })

  it('oblast bez mandátu, kterou žádný úkol nepoužívá, varování nevyvolá', () => {
    const setup = orgDef()
    team(setup, 'Team Mobile').mandates = []
    expect(validateOrgSetup(setup, [feat('F-1: BIL [Java 2]'), feat('F-2: WEB [QA 1]')])).toEqual([])
  })
})

describe('feat-028 C2: oprava zruší varování', () => {
  it('když Team Mobile dostane mandát WEB (Eli má Frontend), varování zmizí', () => {
    const setup = orgT()
    team(setup, 'Team Web').mandates = []
    grant(setup, 'Team Mobile', 'WEB')
    expect(validateOrgSetup(setup, [feat('F-1 (p1): WEB [Frontend 3]')])).toEqual([])
  })
})
