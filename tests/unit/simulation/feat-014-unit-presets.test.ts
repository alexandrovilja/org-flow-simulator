import { describe, it, expect, beforeEach } from 'vitest'
import { PRESETS, applyPreset } from '@/simulation/engine'
import { getActivePresetId, setActivePresetId, resetActivePresetId } from '@/lib/storage'

// ── PRESETS data integrity ─────────────────────────────────────────────────────

describe('feat-014: PRESETS — structure', () => {
  it('exports exactly 2 presets', () => {
    expect(PRESETS).toHaveLength(2)
  })

  it('first preset has id "teams"', () => {
    expect(PRESETS[0].id).toBe('teams')
  })

  it('second preset has id "people"', () => {
    expect(PRESETS[1].id).toBe('people')
  })

  it('teams preset label is "Teams"', () => {
    const teams = PRESETS.find(p => p.id === 'teams')!
    expect(teams.label).toBe('Teams')
  })

  it('people preset label is "People"', () => {
    const people = PRESETS.find(p => p.id === 'people')!
    expect(people.label).toBe('People')
  })

  it('teams preset addLabel is "Add team"', () => {
    const teams = PRESETS.find(p => p.id === 'teams')!
    expect(teams.addLabel).toBe('Add team')
  })

  it('people preset addLabel is "Add member"', () => {
    const people = PRESETS.find(p => p.id === 'people')!
    expect(people.addLabel).toBe('Add member')
  })
})

describe('feat-014: PRESETS — teams preset specializations', () => {
  const teams = () => PRESETS.find(p => p.id === 'teams')!

  it('has exactly 6 roles', () => {
    expect(teams().roles).toHaveLength(6)
  })

  it('contains roles DSGN, ACQ, PAY, PLAT, CRM, ITST', () => {
    expect(teams().roles).toEqual(expect.arrayContaining(['DSGN', 'ACQ', 'PAY', 'PLAT', 'CRM', 'ITST']))
  })

  it('roleMeta has label "Design" for DSGN', () => {
    expect(teams().roleMeta['DSGN'].label).toBe('Design')
  })

  it('roleMeta has label "Client Acquisition" for ACQ', () => {
    expect(teams().roleMeta['ACQ'].label).toBe('Client Acquisition')
  })

  it('roleMeta has label "Payments" for PAY', () => {
    expect(teams().roleMeta['PAY'].label).toBe('Payments')
  })

  it('roleMeta has label "Platform" for PLAT', () => {
    expect(teams().roleMeta['PLAT'].label).toBe('Platform')
  })

  it('roleMeta has label "CRM" for CRM', () => {
    expect(teams().roleMeta['CRM'].label).toBe('CRM')
  })

  it('roleMeta has label "Integration Testing" for ITST', () => {
    expect(teams().roleMeta['ITST'].label).toBe('Integration Testing')
  })

  it('every role in roles array has a corresponding entry in roleMeta', () => {
    const { roles, roleMeta } = teams()
    for (const r of roles) {
      expect(roleMeta[r]).toBeDefined()
    }
  })

  it('every roleMeta entry has a non-empty color string', () => {
    for (const meta of Object.values(teams().roleMeta)) {
      expect(meta.color).toBeTruthy()
    }
  })
})

describe('feat-014: PRESETS — people preset specializations', () => {
  const people = () => PRESETS.find(p => p.id === 'people')!

  it('has exactly 6 roles', () => {
    expect(people().roles).toHaveLength(6)
  })

  it('contains roles FE, BE, DSGN, QA, OPS, DATA', () => {
    expect(people().roles).toEqual(expect.arrayContaining(['FE', 'BE', 'DSGN', 'QA', 'OPS', 'DATA']))
  })

  it('roleMeta has label "Frontend" for FE', () => {
    expect(people().roleMeta['FE'].label).toBe('Frontend')
  })

  it('roleMeta has label "Backend" for BE', () => {
    expect(people().roleMeta['BE'].label).toBe('Backend')
  })

  it('roleMeta has label "Design" for DSGN', () => {
    expect(people().roleMeta['DSGN'].label).toBe('Design')
  })

  it('roleMeta has label "Testing" for QA', () => {
    expect(people().roleMeta['QA'].label).toBe('Testing')
  })

  it('roleMeta has label "DevOps" for OPS', () => {
    expect(people().roleMeta['OPS'].label).toBe('DevOps')
  })

  it('roleMeta has label "Data" for DATA', () => {
    expect(people().roleMeta['DATA'].label).toBe('Data')
  })

  it('every role in roles array has a corresponding entry in roleMeta', () => {
    const { roles, roleMeta } = people()
    for (const r of roles) {
      expect(roleMeta[r]).toBeDefined()
    }
  })
})

describe('feat-014: PRESETS — teams preset members', () => {
  const teams = () => PRESETS.find(p => p.id === 'teams')!

  it('has exactly 6 members', () => {
    expect(teams().members).toHaveLength(6)
  })

  it('members are named Team A through Team F', () => {
    const names = teams().members.map(m => m.name)
    expect(names).toEqual(['Team A', 'Team B', 'Team C', 'Team D', 'Team E', 'Team F'])
  })

  it('every member has exactly 1 specialization (silosový výchozí stav)', () => {
    for (const m of teams().members) {
      expect(m.roles).toHaveLength(1)
    }
  })

  it('every member specialization references a key in roleMeta', () => {
    const { members, roleMeta } = teams()
    for (const m of members) {
      for (const r of m.roles) {
        expect(roleMeta[r]).toBeDefined()
      }
    }
  })

  it('Team A has role DSGN (Design)', () => {
    const teamA = teams().members.find(m => m.name === 'Team A')!
    expect(teamA.roles).toContain('DSGN')
  })

  it('Team B has role ACQ (Client Acquisition)', () => {
    const teamB = teams().members.find(m => m.name === 'Team B')!
    expect(teamB.roles).toContain('ACQ')
  })

  it('Team C has role PAY (Payments)', () => {
    const teamC = teams().members.find(m => m.name === 'Team C')!
    expect(teamC.roles).toContain('PAY')
  })

  it('Team D has role PLAT (Platform)', () => {
    const teamD = teams().members.find(m => m.name === 'Team D')!
    expect(teamD.roles).toContain('PLAT')
  })

  it('Team E has role CRM', () => {
    const teamE = teams().members.find(m => m.name === 'Team E')!
    expect(teamE.roles).toContain('CRM')
  })

  it('Team F has role ITST (Integration Testing)', () => {
    const teamF = teams().members.find(m => m.name === 'Team F')!
    expect(teamF.roles).toContain('ITST')
  })

  it('all 6 specializations are covered — each appears in exactly one team', () => {
    const allRoles = teams().members.flatMap(m => m.roles)
    expect(new Set(allRoles).size).toBe(6)
  })
})

describe('feat-014: PRESETS — people preset members', () => {
  const people = () => PRESETS.find(p => p.id === 'people')!

  it('has exactly 6 members', () => {
    expect(people().members).toHaveLength(6)
  })

  it('members are named Ada, Ben, Chen, Dani, Eli, Fae', () => {
    const names = people().members.map(m => m.name)
    expect(names).toEqual(['Ada', 'Ben', 'Chen', 'Dani', 'Eli', 'Fae'])
  })

  it('every member has exactly 1 specialization (silosový výchozí stav)', () => {
    for (const m of people().members) {
      expect(m.roles).toHaveLength(1)
    }
  })

  it('every member specialization references a key in roleMeta', () => {
    const { members, roleMeta } = people()
    for (const m of members) {
      for (const r of m.roles) {
        expect(roleMeta[r]).toBeDefined()
      }
    }
  })

  it('Ada has role FE (Frontend)', () => {
    const ada = people().members.find(m => m.name === 'Ada')!
    expect(ada.roles).toContain('FE')
  })

  it('Ben has role BE (Backend)', () => {
    const ben = people().members.find(m => m.name === 'Ben')!
    expect(ben.roles).toContain('BE')
  })

  it('Chen has role DSGN (Design)', () => {
    const chen = people().members.find(m => m.name === 'Chen')!
    expect(chen.roles).toContain('DSGN')
  })

  it('Dani has role QA (Testing)', () => {
    const dani = people().members.find(m => m.name === 'Dani')!
    expect(dani.roles).toContain('QA')
  })

  it('Eli has role OPS (DevOps)', () => {
    const eli = people().members.find(m => m.name === 'Eli')!
    expect(eli.roles).toContain('OPS')
  })

  it('Fae has role DATA (Data)', () => {
    const fae = people().members.find(m => m.name === 'Fae')!
    expect(fae.roles).toContain('DATA')
  })
})

// ── applyPreset ────────────────────────────────────────────────────────────────

describe('feat-014: applyPreset — teams preset', () => {
  const teams = () => PRESETS.find(p => p.id === 'teams')!

  it('returns an object with team and roleConfig keys', () => {
    const result = applyPreset(teams())
    expect(result).toHaveProperty('team')
    expect(result).toHaveProperty('roleConfig')
  })

  it('returned team has 6 members', () => {
    const { team } = applyPreset(teams())
    expect(team).toHaveLength(6)
  })

  it('returned team members have names from the preset', () => {
    const { team } = applyPreset(teams())
    const names = team.map(m => m.name)
    expect(names).toEqual(['Team A', 'Team B', 'Team C', 'Team D', 'Team E', 'Team F'])
  })

  it('returned team members have roles from the preset', () => {
    const { team } = applyPreset(teams())
    expect(team[0].roles).toEqual(['DSGN'])
    expect(team[1].roles).toEqual(['ACQ'])
    expect(team[2].roles).toEqual(['PAY'])
  })

  it('returned team members have sequential IDs starting from 1', () => {
    const { team } = applyPreset(teams())
    const ids = team.map(m => m.id)
    expect(ids).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('returned team members start with currentTask null and idleSec 0', () => {
    const { team } = applyPreset(teams())
    for (const m of team) {
      expect(m.currentTask).toBeNull()
      expect(m.idleSec).toBe(0)
    }
  })

  it('returned roleConfig matches the preset roleMeta', () => {
    const preset = teams()
    const { roleConfig } = applyPreset(preset)
    expect(roleConfig).toEqual(preset.roleMeta)
  })

  it('does not mutate the preset object', () => {
    const preset = teams()
    const originalMemberCount = preset.members.length
    const originalRoleCount = preset.roles.length
    applyPreset(preset)
    expect(preset.members).toHaveLength(originalMemberCount)
    expect(preset.roles).toHaveLength(originalRoleCount)
  })
})

describe('feat-014: applyPreset — people preset', () => {
  const people = () => PRESETS.find(p => p.id === 'people')!

  it('returned team has 6 members', () => {
    const { team } = applyPreset(people())
    expect(team).toHaveLength(6)
  })

  it('returned team members have names Ada through Fae', () => {
    const { team } = applyPreset(people())
    const names = team.map(m => m.name)
    expect(names).toEqual(['Ada', 'Ben', 'Chen', 'Dani', 'Eli', 'Fae'])
  })

  it('returned roleConfig contains FE, BE, DSGN, QA, OPS, DATA', () => {
    const { roleConfig } = applyPreset(people())
    expect(Object.keys(roleConfig)).toEqual(expect.arrayContaining(['FE', 'BE', 'DSGN', 'QA', 'OPS', 'DATA']))
  })

  it('returned roleConfig labels match people preset (Frontend, Backend…)', () => {
    const { roleConfig } = applyPreset(people())
    expect(roleConfig['FE'].label).toBe('Frontend')
    expect(roleConfig['BE'].label).toBe('Backend')
    expect(roleConfig['QA'].label).toBe('Testing')
    expect(roleConfig['OPS'].label).toBe('DevOps')
  })
})

describe('feat-014: applyPreset — each call produces fresh independent members', () => {
  it('two calls return different array references (no shared state)', () => {
    const preset = PRESETS.find(p => p.id === 'teams')!
    const { team: team1 } = applyPreset(preset)
    const { team: team2 } = applyPreset(preset)
    expect(team1).not.toBe(team2)
  })

  it('mutating returned team does not affect subsequent applyPreset calls', () => {
    const preset = PRESETS.find(p => p.id === 'teams')!
    const { team: team1 } = applyPreset(preset)
    // Mutate first result
    team1[0].name = 'CHANGED'
    const { team: team2 } = applyPreset(preset)
    expect(team2[0].name).toBe('Team A')
  })
})

// ── activePresetId storage ─────────────────────────────────────────────────────

describe('feat-014: activePresetId storage', () => {
  beforeEach(() => {
    // Reset to clean state before each test so tests don't bleed into each other.
    resetActivePresetId()
  })

  it('getActivePresetId returns "teams" when localStorage has no stored value (default)', () => {
    expect(getActivePresetId()).toBe('teams')
  })

  it('setActivePresetId("people") persists — getActivePresetId returns "people"', () => {
    setActivePresetId('people')
    expect(getActivePresetId()).toBe('people')
  })

  it('setActivePresetId("custom") persists — getActivePresetId returns "custom"', () => {
    setActivePresetId('custom')
    expect(getActivePresetId()).toBe('custom')
  })

  it('setActivePresetId("teams") persists — getActivePresetId returns "teams"', () => {
    setActivePresetId('teams')
    expect(getActivePresetId()).toBe('teams')
  })

  it('setActivePresetId overwrites a previous value', () => {
    setActivePresetId('people')
    setActivePresetId('custom')
    expect(getActivePresetId()).toBe('custom')
  })

  it('setActivePresetId("teams") overwrites "custom"', () => {
    setActivePresetId('custom')
    setActivePresetId('teams')
    expect(getActivePresetId()).toBe('teams')
  })

  it('resetActivePresetId clears the stored value — getActivePresetId returns "teams" again', () => {
    setActivePresetId('people')
    resetActivePresetId()
    expect(getActivePresetId()).toBe('teams')
  })
})
