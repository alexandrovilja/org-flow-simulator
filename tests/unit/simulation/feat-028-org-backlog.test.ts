import { describe, it, expect } from 'vitest'
import { mulberry32 } from '@/simulation/engine'
import {
  DEFAULT_ORG_BACKLOG_SETTINGS,
  generateOrgBacklog,
  makeDefaultOrgSetup,
  validateOrgSetup,
} from '@/simulation/organizationEngine'
import type { OrgFeature, OrgSetup } from '@/types/organization'

// feat-028 inkrement 1 (Mandáty a tok práce) — výchozí organizace a výchozí backlog.
//
// Schválený kontrakt (spec features/feat-028-tymy-slozene-z-lidi.md, „Výchozí stav“; analýza A1, A2, A4):
//  - `makeDefaultOrgSetup()` vrací ORG-DEF: Team Billing (BIL), Team Mobile (MOB), Team Web (WEB), každý se 4 lidmi
//    (Product, Java, Frontend, QA) se jmény z analýzy; skilly Product 1, Java 2, Frontend 2, QA 3; oblasti BIL Billing,
//    MOB Mobile app, WEB Web portal.
//  - `DEFAULT_ORG_BACKLOG_SETTINGS` = 100 featur, 1–3 oblasti na featuru, 1–3 skilly v oblasti, pracnost 1–5 dní.
//  - `generateOrgBacklog(rng, settings, setup)`: priority 1..N, různé oblasti ve featuře, různé skilly v oblasti
//    (každý skill je jeden úkol), pracnost celé číslo v rozsahu, úkoly v oblasti seřazené podle fáze,
//    stejný seed = stejný backlog.
//  - Výchozí organizace s výchozím backlogem nemá žádné varování.
// Výnosy (feat-033), nastavení backlogu (feat-031) a Req. (feat-036) přijdou v dalších inkrementech.

/** Skilly všech úkolů jedné oblasti featury v pořadí úkolů. */
function rolesIn(f: OrgFeature, area: string): string[] {
  return f.tasks.filter(t => t.area === area).map(t => t.role)
}

/** Kódy oblastí featury v pořadí, v jakém se poprvé objeví mezi úkoly. */
function areasOf(f: OrgFeature): string[] {
  return [...new Set(f.tasks.map(t => t.area))]
}

/** Názvy skillů podle klíčů výchozí organizace (klíče jsou interní, testy čtou názvy). */
function labelsOf(setup: OrgSetup, keys: string[]): string[] {
  return keys.map(k => setup.roleConfig[k].label)
}

describe('feat-028 A1: výchozí organizace', () => {
  it('má 3 týmy po 4 lidech s mandátem na jednu oblast a jmény z analýzy (ORG-DEF)', () => {
    const setup = makeDefaultOrgSetup()
    expect(setup.teams.map(t => t.name)).toEqual(['Team Billing', 'Team Mobile', 'Team Web'])
    expect(setup.teams.map(t => t.mandates)).toEqual([['BIL'], ['MOB'], ['WEB']])
    expect(setup.teams.map(t => t.people.map(p => p.name))).toEqual([
      ['Ada', 'Ben', 'Cyril', 'Chen'],
      ['Dani', 'Emil', 'Eli', 'Fae'],
      ['Gus', 'Hugo', 'Hana', 'Ivo'],
    ])
    for (const t of setup.teams) {
      expect(t.people.map(p => labelsOf(setup, p.skills))).toEqual([['Product'], ['Java'], ['Frontend'], ['QA']])
    }
  })

  it('má skilly Product 1, Java 2, Frontend 2, QA 3 bez Req. a oblasti BIL, MOB, WEB', () => {
    const setup = makeDefaultOrgSetup()
    expect(Object.values(setup.roleConfig).map(m => [m.label, m.level, m.required])).toEqual([
      ['Product', 1, false], ['Java', 2, false], ['Frontend', 2, false], ['QA', 3, false],
    ])
    expect(setup.areas).toEqual([
      { code: 'BIL', name: 'Billing' }, { code: 'MOB', name: 'Mobile app' }, { code: 'WEB', name: 'Web portal' },
    ])
  })

  it('id týmů i lidí jsou jedinečná a každé volání vrací novou organizaci', () => {
    const a = makeDefaultOrgSetup()
    expect(new Set(a.teams.map(t => t.id)).size).toBe(3)
    expect(new Set(a.teams.flatMap(t => t.people).map(p => p.id)).size).toBe(12)
    a.teams[0].mandates.push('WEB')
    expect(makeDefaultOrgSetup().teams[0].mandates).toEqual(['BIL'])
  })

  it('výchozí nastavení backlogu je 100 featur, 1–3 oblasti, 1–3 skilly, pracnost 1–5', () => {
    expect(DEFAULT_ORG_BACKLOG_SETTINGS).toEqual({
      size: 100, areasPerFeature: [1, 3], skillsPerArea: [1, 3], effortPerSkill: [1, 5],
    })
  })
})

describe('feat-028 A2: invarianty generovaného backlogu', () => {
  const setup = makeDefaultOrgSetup()
  const backlog = generateOrgBacklog(mulberry32(42), DEFAULT_ORG_BACKLOG_SETTINGS, setup)

  it('má 100 featur s prioritami 1–100, každou právě jednou, ve stavu backlog', () => {
    expect(backlog).toHaveLength(100)
    expect([...backlog.map(f => f.priority)].sort((a, b) => a - b)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1))
    for (const f of backlog) {
      expect(f.status).toBe('backlog')
      expect(f.startedAt).toBeNull()
      expect(f.finishedAt).toBeNull()
    }
  })

  it('každá featura má 1–3 různé oblasti a v každé 1–3 různé skilly', () => {
    const codes = setup.areas.map(a => a.code)
    const skillKeys = Object.keys(setup.roleConfig)
    for (const f of backlog) {
      const fa = areasOf(f)
      expect(fa.length).toBeGreaterThanOrEqual(1)
      expect(fa.length).toBeLessThanOrEqual(3)
      for (const a of fa) {
        expect(codes).toContain(a)
        const roles = rolesIn(f, a)
        expect(roles.length).toBeGreaterThanOrEqual(1)
        expect(roles.length).toBeLessThanOrEqual(3)
        // V oblasti featury je každý skill nejvýš jednou (Konvence analýzy)
        expect(new Set(roles).size).toBe(roles.length)
        for (const r of roles) expect(skillKeys).toContain(r)
      }
    }
  })

  it('pracnost každého úkolu je celé číslo 1–5 a úkol je nezačatý', () => {
    for (const t of backlog.flatMap(f => f.tasks)) {
      expect(Number.isInteger(t.work)).toBe(true)
      expect(t.work).toBeGreaterThanOrEqual(1)
      expect(t.work).toBeLessThanOrEqual(5)
      expect(t.status).toBe('todo')
      expect(t.progress).toBe(0)
      expect(t.assignee).toBeNull()
      expect(t.segments).toEqual([])
    }
  })

  it('úkoly v oblasti jsou seřazené podle fáze (Product před Java a Frontend, QA poslední)', () => {
    for (const f of backlog) {
      for (const a of areasOf(f)) {
        const levels = rolesIn(f, a).map(r => setup.roleConfig[r].level)
        expect(levels).toEqual([...levels].sort((x, y) => x - y))
      }
    }
  })

  it('druhé generování se seedem 42 dá úplně stejný backlog, jiný seed jiný', () => {
    expect(generateOrgBacklog(mulberry32(42), DEFAULT_ORG_BACKLOG_SETTINGS, makeDefaultOrgSetup())).toEqual(backlog)
    expect(generateOrgBacklog(mulberry32(43), DEFAULT_ORG_BACKLOG_SETTINGS, makeDefaultOrgSetup())).not.toEqual(backlog)
  })
})

describe('feat-028 A4: výchozí backlog nezablokuje Run', () => {
  it('ORG-DEF a výchozí backlog (seed 42) nemají žádné varování', () => {
    const setup = makeDefaultOrgSetup()
    const backlog = generateOrgBacklog(mulberry32(42), DEFAULT_ORG_BACKLOG_SETTINGS, setup)
    expect(validateOrgSetup(setup, backlog)).toEqual([])
  })
})
