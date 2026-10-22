import { describe, it, expect } from 'vitest'
import { ROLE_META, PRESETS } from '@/simulation/engine'
import { COLOR_PRESETS } from '@/components/RoleSettings'
import { parseRows } from '@/lib/xlsImport'

// feat-021 (Převod na design system Org Flow) — barvy rolí podle slotů.
//
// Schválený kontrakt (spec features/feat-021-prevod-design-system-org-flow.md):
//  - Příklad 7: role mají barvy design systému podle slotů — 1 role-rose, 2 role-blue, 3 role-brick,
//    4 role-green, 5 role-ochre, 6 role-teal, 7 role-violet, 8 role-slate. Barva je odkaz na CSS
//    token (`var(--role-…)`), takže engine dál pracuje jen s řetězci a nezná React.
//  - Technical Notes: výběr barvy pro vlastní specializace (COLOR_PRESETS) nabízí právě 8 role tokenů;
//    role z XLS importu dostanou sloty v pořadí výskytu a nad 8 se sloty opakují.

/** Barvy osmi slotů v pořadí. */
const SLOTS = [
  'var(--role-rose)', 'var(--role-blue)', 'var(--role-brick)', 'var(--role-green)',
  'var(--role-ochre)', 'var(--role-teal)', 'var(--role-violet)', 'var(--role-slate)',
]

/** Minimální platný řádek XLS importu (stejný tvar jako v testech feat-012; anglické sloupce od feat-026). */
function row(feature: string, skill: string, unit: string, size: number) {
  return { Feature: feature, Skill: skill, Unit: unit, Size: size }
}

describe('feat-021 Příklad 7: barvy rolí podle slotů', () => {
  it('ROLE_META (People / Compare) má barvy slotů', () => {
    expect(ROLE_META.DSGN.color).toBe('var(--role-rose)')
    expect(ROLE_META.FE.color).toBe('var(--role-blue)')
    expect(ROLE_META.BE.color).toBe('var(--role-brick)')
    expect(ROLE_META.QA.color).toBe('var(--role-green)')
    expect(ROLE_META.OPS.color).toBe('var(--role-ochre)')
    expect(ROLE_META.DATA.color).toBe('var(--role-teal)')
  })

  it('preset People má stejné barvy jako ROLE_META', () => {
    const people = PRESETS.find(p => p.id === 'people')!
    for (const role of ['DSGN', 'FE', 'BE', 'QA', 'OPS', 'DATA']) {
      expect(people.roleMeta[role].color).toBe(ROLE_META[role].color)
    }
  })

  it('preset Teams má barvy slotů podle svých specializací', () => {
    const teams = PRESETS.find(p => p.id === 'teams')!
    expect(teams.roleMeta.DSGN.color).toBe('var(--role-rose)')
    expect(teams.roleMeta.PAY.color).toBe('var(--role-blue)')
    expect(teams.roleMeta.PLAT.color).toBe('var(--role-brick)')
    expect(teams.roleMeta.ITST.color).toBe('var(--role-green)')
    expect(teams.roleMeta.CRM.color).toBe('var(--role-ochre)')
    expect(teams.roleMeta.ACQ.color).toBe('var(--role-teal)')
  })

  it('výběr barvy pro vlastní specializace nabízí právě 8 role tokenů v pořadí slotů', () => {
    expect(COLOR_PRESETS.map(p => p.color)).toEqual(SLOTS)
  })

  it('role z XLS importu dostanou sloty v pořadí výskytu a nad 8 se sloty opakují', () => {
    const roles = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9']
    const result = parseRows(roles.map((r, i) => row(`F${i}`, r, 'Squad A', 3)))
    expect(roles.map(r => result.roleConfig[r].color)).toEqual([...SLOTS, SLOTS[0]])
  })
})
