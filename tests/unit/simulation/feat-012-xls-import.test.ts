import { describe, it, expect } from 'vitest'
import { parseRows } from '@/lib/xlsImport'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid row — all four required columns present. */
function row(
  feature: string,
  specializace: string,
  tym: string,
  velikost: number | string,
) {
  return { Feature: feature, Specializace: specializace, Tym: tym, Velikost: velikost }
}

// ---------------------------------------------------------------------------
// feat-012: happy path
// ---------------------------------------------------------------------------

describe('feat-012: parseRows — happy path', () => {
  it('returns one feature per unique Feature value', () => {
    const rows = [
      row('Login', 'FE', 'Squad A', 3),
      row('Dashboard', 'BE', 'Squad B', 5),
    ]
    const result = parseRows(rows)
    expect(result.features).toHaveLength(2)
    expect(result.features.map(f => f.name)).toContain('Login')
    expect(result.features.map(f => f.name)).toContain('Dashboard')
  })

  it('groups multiple rows with the same Feature into one feature with multiple tasks', () => {
    const rows = [
      row('Login', 'FE', 'Squad A', 3),
      row('Login', 'BE', 'Squad A', 5),
      row('Login', 'QA', 'Squad B', 2),
    ]
    const result = parseRows(rows)
    expect(result.features).toHaveLength(1)
    expect(result.features[0].tasks).toHaveLength(3)
  })

  it('maps Velikost 1:1 to task.work', () => {
    const rows = [row('F1', 'FE', 'A', 7)]
    const result = parseRows(rows)
    expect(result.features[0].tasks[0].work).toBe(7)
  })

  it('maps decimal Velikost correctly', () => {
    const rows = [row('F1', 'FE', 'A', 0.5)]
    const result = parseRows(rows)
    expect(result.features[0].tasks[0].work).toBe(0.5)
  })

  it('returns one Member per unique Tym value', () => {
    const rows = [
      row('F1', 'FE', 'Squad A', 3),
      row('F1', 'BE', 'Squad B', 5),
      row('F2', 'QA', 'Squad A', 2),
    ]
    const result = parseRows(rows)
    expect(result.team).toHaveLength(2)
    const names = result.team.map(m => m.name)
    expect(names).toContain('Squad A')
    expect(names).toContain('Squad B')
  })

  it('assigns all roles appearing under a Tym to that Member', () => {
    const rows = [
      row('F1', 'FE', 'Squad A', 3),
      row('F1', 'BE', 'Squad A', 5),
      row('F1', 'QA', 'Squad B', 2),
    ]
    const result = parseRows(rows)
    const squadA = result.team.find(m => m.name === 'Squad A')!
    expect(squadA.roles).toContain('FE')
    expect(squadA.roles).toContain('BE')
    expect(squadA.roles).not.toContain('QA')
  })

  it('creates a new RoleMeta entry for each unique Specializace', () => {
    const rows = [
      row('F1', 'FE', 'A', 1),
      row('F1', 'BE', 'A', 2),
      row('F2', 'QA', 'B', 3),
    ]
    const result = parseRows(rows)
    expect(Object.keys(result.roleConfig)).toContain('FE')
    expect(Object.keys(result.roleConfig)).toContain('BE')
    expect(Object.keys(result.roleConfig)).toContain('QA')
  })

  it('converts Specializace to uppercase', () => {
    const rows = [row('F1', 'frontend', 'A', 3)]
    const result = parseRows(rows)
    expect(result.features[0].tasks[0].role).toBe('FRONTEND')
    expect(Object.keys(result.roleConfig)).toContain('FRONTEND')
  })

  it('trims whitespace from Specializace before uppercasing', () => {
    const rows = [row('F1', '  fe  ', 'A', 3)]
    const result = parseRows(rows)
    expect(result.features[0].tasks[0].role).toBe('FE')
  })

  it('new RoleMeta has level 1 and required false', () => {
    const rows = [row('F1', 'FE', 'A', 1)]
    const result = parseRows(rows)
    expect(result.roleConfig['FE'].level).toBe(1)
    expect(result.roleConfig['FE'].required).toBe(false)
  })

  it('all tasks start with status "todo" and progress 0 and no assignee', () => {
    const rows = [row('F1', 'FE', 'A', 5)]
    const result = parseRows(rows)
    const task = result.features[0].tasks[0]
    expect(task.status).toBe('todo')
    expect(task.progress).toBe(0)
    expect(task.assignee).toBeNull()
  })

  it('all features start with status "backlog"', () => {
    const rows = [row('F1', 'FE', 'A', 5)]
    const result = parseRows(rows)
    expect(result.features[0].status).toBe('backlog')
  })

  it('all members start idle with no currentTask', () => {
    const rows = [row('F1', 'FE', 'A', 5)]
    const result = parseRows(rows)
    expect(result.team[0].currentTask).toBeNull()
    expect(result.team[0].idleSec).toBe(0)
  })

  it('returns no warnings when all rows are valid', () => {
    const rows = [row('F1', 'FE', 'A', 3), row('F1', 'BE', 'B', 5)]
    const result = parseRows(rows)
    expect(result.warnings).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// feat-012: column name handling
// ---------------------------------------------------------------------------

describe('feat-012: parseRows — column name handling', () => {
  it('accepts lowercase column names', () => {
    const rows = [{ feature: 'F1', specializace: 'FE', tym: 'A', velikost: 3 }]
    expect(() => parseRows(rows)).not.toThrow()
    expect(parseRows(rows).features).toHaveLength(1)
  })

  it('accepts uppercase column names', () => {
    const rows = [{ FEATURE: 'F1', SPECIALIZACE: 'FE', TYM: 'A', VELIKOST: 3 }]
    expect(() => parseRows(rows)).not.toThrow()
    expect(parseRows(rows).features).toHaveLength(1)
  })

  it('accepts mixed-case column names', () => {
    const rows = [{ Feature: 'F1', Specializace: 'FE', Tym: 'A', Velikost: 3 }]
    expect(() => parseRows(rows)).not.toThrow()
    expect(parseRows(rows).features).toHaveLength(1)
  })

  it('trims whitespace from column names', () => {
    const rows = [{ '  Feature  ': 'F1', ' Specializace': 'FE', 'Tym ': 'A', 'Velikost': 3 }]
    expect(() => parseRows(rows)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// feat-012: duplicate row handling
// ---------------------------------------------------------------------------

describe('feat-012: parseRows — duplicate rows', () => {
  it('keeps only the first row when Feature+Specializace+Tym is duplicated', () => {
    const rows = [
      row('F1', 'FE', 'Squad A', 3),
      row('F1', 'FE', 'Squad A', 99), // duplicate — should be ignored
    ]
    const result = parseRows(rows)
    expect(result.features[0].tasks).toHaveLength(1)
    expect(result.features[0].tasks[0].work).toBe(3)
  })

  it('does not emit a warning for silently skipped duplicates', () => {
    const rows = [
      row('F1', 'FE', 'A', 3),
      row('F1', 'FE', 'A', 5),
    ]
    const result = parseRows(rows)
    expect(result.warnings).toHaveLength(0)
  })

  it('treats same Feature+Specializace but different Tym as distinct tasks', () => {
    const rows = [
      row('F1', 'FE', 'Squad A', 3),
      row('F1', 'FE', 'Squad B', 5),
    ]
    const result = parseRows(rows)
    expect(result.features[0].tasks).toHaveLength(2)
  })

  it('treats same Feature+Tym but different Specializace as distinct tasks', () => {
    const rows = [
      row('F1', 'FE', 'Squad A', 3),
      row('F1', 'BE', 'Squad A', 5),
    ]
    const result = parseRows(rows)
    expect(result.features[0].tasks).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// feat-012: empty rows ignored
// ---------------------------------------------------------------------------

describe('feat-012: parseRows — empty rows', () => {
  it('ignores rows where all values are empty/undefined', () => {
    const rows = [
      row('F1', 'FE', 'A', 3),
      {},
      row('F2', 'BE', 'B', 5),
    ]
    const result = parseRows(rows)
    expect(result.features).toHaveLength(2)
  })

  it('silently skips rows where Feature is whitespace-only after trim', () => {
    const rows = [
      row('   ', 'FE', 'A', 3),
      row('F1', 'BE', 'A', 5),
    ]
    const result = parseRows(rows)
    expect(result.features).toHaveLength(1)
    expect(result.features[0].name).toBe('F1')
  })
})

// ---------------------------------------------------------------------------
// feat-012: error states — blocking (throw)
// ---------------------------------------------------------------------------

describe('feat-012: parseRows — missing required columns', () => {
  it("throws when 'Feature' column is missing", () => {
    const rows = [{ Specializace: 'FE', Tym: 'A', Velikost: 3 }]
    expect(() => parseRows(rows)).toThrow(/Feature/i)
  })

  it("throws when 'Specializace' column is missing", () => {
    const rows = [{ Feature: 'F1', Tym: 'A', Velikost: 3 }]
    expect(() => parseRows(rows)).toThrow(/Specializace/i)
  })

  it("throws when 'Tym' column is missing", () => {
    const rows = [{ Feature: 'F1', Specializace: 'FE', Velikost: 3 }]
    expect(() => parseRows(rows)).toThrow(/Tym/i)
  })

  it("throws when 'Velikost' column is missing", () => {
    const rows = [{ Feature: 'F1', Specializace: 'FE', Tym: 'A' }]
    expect(() => parseRows(rows)).toThrow(/Velikost/i)
  })

  it('throws when there are no data rows at all', () => {
    expect(() => parseRows([])).toThrow()
  })
})

describe('feat-012: parseRows — too many Tym values', () => {
  it('throws when more than 50 unique Tym values are present', () => {
    const rows = Array.from({ length: 51 }, (_, i) =>
      row('F1', 'FE', `Unit-${i}`, 1),
    )
    expect(() => parseRows(rows)).toThrow(/50/i)
  })

  it('does not throw with exactly 50 unique Tym values', () => {
    const rows = Array.from({ length: 50 }, (_, i) =>
      row('F1', 'FE', `Unit-${i}`, 1),
    )
    expect(() => parseRows(rows)).not.toThrow()
  })
})

describe('feat-012: parseRows — too many Feature values', () => {
  it('throws when more than 200 unique Feature values are present', () => {
    const rows = Array.from({ length: 201 }, (_, i) =>
      row(`Feature-${i}`, 'FE', 'A', 1),
    )
    expect(() => parseRows(rows)).toThrow(/200/i)
  })

  it('does not throw with exactly 200 unique Feature values', () => {
    const rows = Array.from({ length: 200 }, (_, i) =>
      row(`Feature-${i}`, 'FE', 'A', 1),
    )
    expect(() => parseRows(rows)).not.toThrow()
  })
})

// ---------------------------------------------------------------------------
// feat-012: error states — skipped rows (non-blocking, warnings)
// ---------------------------------------------------------------------------

describe('feat-012: parseRows — invalid Velikost', () => {
  it('skips rows where Velikost is not a number', () => {
    const rows = [
      row('F1', 'FE', 'A', 'abc'),
      row('F1', 'BE', 'A', 5),
    ]
    const result = parseRows(rows)
    expect(result.features[0].tasks).toHaveLength(1)
    expect(result.features[0].tasks[0].work).toBe(5)
  })

  it('adds a warning when rows are skipped due to invalid Velikost', () => {
    const rows = [
      row('F1', 'FE', 'A', 'abc'),
      row('F1', 'BE', 'A', 5),
    ]
    const result = parseRows(rows)
    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings[0]).toMatch(/přeskočen/i)
  })

  it('skips rows where Velikost is 0', () => {
    const rows = [
      row('F1', 'FE', 'A', 0),
      row('F1', 'BE', 'A', 3),
    ]
    const result = parseRows(rows)
    expect(result.features[0].tasks).toHaveLength(1)
  })

  it('skips rows where Velikost is negative', () => {
    const rows = [
      row('F1', 'FE', 'A', -1),
      row('F1', 'BE', 'A', 3),
    ]
    const result = parseRows(rows)
    expect(result.features[0].tasks).toHaveLength(1)
  })

  it('skips rows where Velikost exceeds 999', () => {
    const rows = [
      row('F1', 'FE', 'A', 1000),
      row('F1', 'BE', 'A', 3),
    ]
    const result = parseRows(rows)
    expect(result.features[0].tasks).toHaveLength(1)
  })

  it('accepts Velikost exactly at boundary values 0.5 and 999', () => {
    const rows = [
      row('F1', 'FE', 'A', 0.5),
      row('F1', 'BE', 'A', 999),
    ]
    const result = parseRows(rows)
    expect(result.features[0].tasks).toHaveLength(2)
  })

  it('counts all skipped rows in a single warning message', () => {
    const rows = [
      row('F1', 'FE', 'A', 'bad'),
      row('F1', 'BE', 'A', -1),
      row('F1', 'QA', 'A', 5),
    ]
    const result = parseRows(rows)
    // 2 rows skipped — warning should mention the count
    expect(result.warnings[0]).toMatch(/2/)
  })
})

// ---------------------------------------------------------------------------
// feat-012: Tym trimming (case-sensitive, but trimmed)
// ---------------------------------------------------------------------------

describe('feat-012: parseRows — Tym value handling', () => {
  it('trims whitespace from Tym values', () => {
    const rows = [
      row('F1', 'FE', '  Squad A  ', 3),
      row('F1', 'BE', 'Squad A', 5),
    ]
    const result = parseRows(rows)
    // Both rows resolve to the same "Squad A" → 1 member, 2 tasks
    expect(result.team).toHaveLength(1)
    expect(result.features[0].tasks).toHaveLength(2)
  })

  it('treats differently-cased Tym values as distinct members (case-sensitive)', () => {
    const rows = [
      row('F1', 'FE', 'squad a', 3),
      row('F1', 'BE', 'Squad A', 5),
    ]
    const result = parseRows(rows)
    expect(result.team).toHaveLength(2)
  })
})
