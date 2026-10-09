import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import * as XLSX from 'xlsx'
import { PRESETS } from '@/simulation/engine'
import { useCashFlowSimSetup } from '@/hooks/useCashFlowSimSetup'
import type { SimSettings, SimState, RevenueProfile } from '@/types/simulation'

// feat-017: chování přepínače „Revenue curve“ v hooku Cash Flow (useCashFlowSimSetup).
// Nové členy hooku, které tyto testy předpokládají:
//   revenueProfile                       — aktuální profil (settings.revenueProfile, výchozí 'flat')
//   confirmingRevenueProfile             — čekající profil, na který se uživatel ptá dialog (null = žádný dialog)
//   setConfirmingRevenueProfile(p|null)  — zrušení dialogu = setConfirmingRevenueProfile(null)
//   handleRevenueProfileChange(profile)  — kliknutí na volbu přepínače
//   handleConfirmRevenueProfile()        — „Change and reset“ v dialogu
// Pravidlo dialogu: jen když běh už začal a ještě nedoběhl (startedAt !== null && !finished).
// Před startem a po doběhnutém běhu se změna provede hned. Změna vrací simulaci na začátek
// se stejným backlogem (engine funkce setRevenueProfile).

const CF_SETTINGS: SimSettings = {
  minBacklog: 0,
  wipLimit: 6,
  sizeVar: 0.4,
  roleVar: 0.5,
  initialBacklog: 12,
  minSpecializations: 1,
}

/** Otisk backlogu bez profilu — ověřuje, že přepnutí nepřegeneruje featury. */
function backlogFingerprint(state: SimState): string {
  return JSON.stringify(state.backlog.map(f => ({
    id: f.id, name: f.name, priority: f.priority, revenuePerTick: f.revenuePerTick, coordSeed: f.coordSeed,
    tasks: f.tasks.map(t => [t.id, t.role, t.work]),
  })))
}

const allHaveProfile = (state: SimState, profile: RevenueProfile): boolean =>
  state.backlog.length > 0 && [...state.backlog, ...state.backlogSnapshot].every(f => f.revenueProfile === profile)

/** Simuluje „běh začal“ — hook sám tick() nevolá (RAF smyčka je v Simulator.tsx). */
function markRunning(state: SimState, simTime = 5): void {
  state.startedAt = 1.5
  state.simTime = simTime
  state.finished = false
}

describe('feat-017: přepínač profilu v hooku Cash Flow', () => {
  it('výchozí profil je flat a žádný dialog není otevřený', () => {
    const { result } = renderHook(() => useCashFlowSimSetup(CF_SETTINGS))
    expect(result.current.revenueProfile).toBe('flat')
    expect(result.current.settings.revenueProfile ?? 'flat').toBe('flat')
    expect(result.current.confirmingRevenueProfile).toBeNull()
    expect(allHaveProfile(result.current.stateRef.current!, 'flat')).toBe(true)
  })

  it('před startem běhu se změna provede hned a bez dialogu na všech featurách backlogu i snapshotu', () => {
    const { result } = renderHook(() => useCashFlowSimSetup(CF_SETTINGS))
    act(() => { result.current.handleRevenueProfileChange('j-curve') })
    expect(result.current.revenueProfile).toBe('j-curve')
    expect(result.current.settings.revenueProfile).toBe('j-curve')
    expect(result.current.confirmingRevenueProfile).toBeNull()
    expect(allHaveProfile(result.current.stateRef.current!, 'j-curve')).toBe(true)
  })

  it('Příklad 5 — přepnutí zachová backlog: stejné featury, tasky, priority a základní výnos (žádné nové generování)', () => {
    const { result } = renderHook(() => useCashFlowSimSetup(CF_SETTINGS))
    const before = backlogFingerprint(result.current.stateRef.current!)
    act(() => { result.current.handleRevenueProfileChange('s-curve') })
    expect(backlogFingerprint(result.current.stateRef.current!)).toBe(before)
  })

  it('výběr téhož profilu nic nedělá (ani dialog, ani reset)', () => {
    const { result } = renderHook(() => useCashFlowSimSetup(CF_SETTINGS))
    act(() => { markRunning(result.current.stateRef.current!) })
    act(() => { result.current.handleRevenueProfileChange('flat') })
    expect(result.current.confirmingRevenueProfile).toBeNull()
    expect(result.current.stateRef.current!.simTime).toBe(5)
  })

  it('Příklad 6 — během běhu se změna jen nabídne k potvrzení: profil, featury ani čas se nezmění', () => {
    const { result } = renderHook(() => useCashFlowSimSetup(CF_SETTINGS))
    act(() => { markRunning(result.current.stateRef.current!) })
    act(() => { result.current.handleRevenueProfileChange('s-curve') })
    expect(result.current.confirmingRevenueProfile).toBe('s-curve')
    expect(result.current.revenueProfile).toBe('flat')
    expect(allHaveProfile(result.current.stateRef.current!, 'flat')).toBe(true)
    expect(result.current.stateRef.current!.simTime).toBe(5)
    expect(result.current.stateRef.current!.startedAt).toBe(1.5)
  })

  it('Příklad 6 — „Cancel“ (setConfirmingRevenueProfile(null)) nechá profil i běh beze změny', () => {
    const { result } = renderHook(() => useCashFlowSimSetup(CF_SETTINGS))
    act(() => { markRunning(result.current.stateRef.current!) })
    act(() => { result.current.handleRevenueProfileChange('j-curve') })
    act(() => { result.current.setConfirmingRevenueProfile(null) })
    expect(result.current.confirmingRevenueProfile).toBeNull()
    expect(result.current.revenueProfile).toBe('flat')
    expect(result.current.stateRef.current!.simTime).toBe(5)
  })

  it('Příklad 6 — „Change and reset“ změní profil a vrátí simulaci na začátek se stejným backlogem', () => {
    const { result } = renderHook(() => useCashFlowSimSetup(CF_SETTINGS))
    const before = backlogFingerprint(result.current.stateRef.current!)
    act(() => { markRunning(result.current.stateRef.current!) })
    act(() => { result.current.handleRevenueProfileChange('j-curve') })
    act(() => { result.current.handleConfirmRevenueProfile() })

    const state = result.current.stateRef.current!
    expect(result.current.confirmingRevenueProfile).toBeNull()
    expect(result.current.revenueProfile).toBe('j-curve')
    expect(allHaveProfile(state, 'j-curve')).toBe(true)
    expect(state.simTime).toBe(0)
    expect(state.startedAt).toBeNull()
    expect(state.finished).toBe(false)
    expect(backlogFingerprint(state)).toBe(before)
  })

  it('Příklad 7 — po doběhnutém běhu se změna provede hned bez dialogu a simulace se vrátí na začátek', () => {
    const { result } = renderHook(() => useCashFlowSimSetup(CF_SETTINGS))
    act(() => {
      const s = result.current.stateRef.current!
      markRunning(s, 47)
      s.finished = true
    })
    act(() => { result.current.handleRevenueProfileChange('s-curve') })

    const state = result.current.stateRef.current!
    expect(result.current.confirmingRevenueProfile).toBeNull()
    expect(result.current.revenueProfile).toBe('s-curve')
    expect(allHaveProfile(state, 's-curve')).toBe(true)
    expect(state.simTime).toBe(0)
    expect(state.finished).toBe(false)
  })

  it('Příklad 13 — „Generate new backlog“ zachová zvolený profil', () => {
    const { result } = renderHook(() => useCashFlowSimSetup(CF_SETTINGS))
    act(() => { result.current.handleRevenueProfileChange('s-curve') })
    act(() => { result.current.handleRegenerate() })
    expect(allHaveProfile(result.current.stateRef.current!, 's-curve')).toBe(true)
    expect(result.current.revenueProfile).toBe('s-curve')
  })

  it('Příklad 13 — výběr presetu (Teams / People) zachová zvolený profil', () => {
    const { result } = renderHook(() => useCashFlowSimSetup(CF_SETTINGS))
    act(() => { result.current.handleRevenueProfileChange('j-curve') })
    act(() => { result.current.handlePresetClick(PRESETS[1]) })
    expect(allHaveProfile(result.current.stateRef.current!, 'j-curve')).toBe(true)
    expect(result.current.revenueProfile).toBe('j-curve')
  })

  it('profil se neukládá do localStorage: při změně se nezavolá setItem a po novém načtení je opět flat', () => {
    const setItem = vi.spyOn(window.localStorage, 'setItem')
    const first = renderHook(() => useCashFlowSimSetup(CF_SETTINGS))
    act(() => { first.result.current.handleRevenueProfileChange('j-curve') })
    act(() => { first.result.current.handleRevenueProfileChange('s-curve') })
    expect(setItem).not.toHaveBeenCalled()
    first.unmount()
    const second = renderHook(() => useCashFlowSimSetup(CF_SETTINGS))
    expect(second.result.current.revenueProfile).toBe('flat')
    setItem.mockRestore()
  })
})

/** Vytvoří .xlsx soubor se dvěma featurami (4 řádky) — formát podle feat-012. */
function makeXlsFile(): File {
  const rows = [
    { Feature: 'Login', Specializace: 'FE', Tym: 'Squad A', Velikost: 3 },
    { Feature: 'Login', Specializace: 'BE', Tym: 'Squad B', Velikost: 2 },
    { Feature: 'Search', Specializace: 'FE', Tym: 'Squad A', Velikost: 4 },
    { Feature: 'Search', Specializace: 'QA', Tym: 'Squad B', Velikost: 1 },
  ]
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), 'Backlog')
  const data: ArrayBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
  const file = new File([data], 'backlog.xlsx')
  // jsdom neimplementuje File.arrayBuffer(), které hook při importu volá — doplníme ho na instanci
  Object.defineProperty(file, 'arrayBuffer', { value: () => Promise.resolve(data) })
  return file
}

describe('feat-017 Příklad 13: XLS import zachová zvolený profil', () => {
  it('importované featury (backlog i snapshot) mají profil zvolený v přepínači', async () => {
    const { result } = renderHook(() => useCashFlowSimSetup(CF_SETTINGS))
    act(() => { result.current.handleRevenueProfileChange('s-curve') })
    act(() => { result.current.handleXlsImport(makeXlsFile()) })
    await waitFor(() => expect(result.current.stateRef.current!.backlog.length).toBe(2))

    const state = result.current.stateRef.current!
    expect(allHaveProfile(state, 's-curve')).toBe(true)
    expect(result.current.revenueProfile).toBe('s-curve')
  })

  it('profil zvolený po importu se přepíše i na importovaném backlogu (funguje i pro XLS backlog)', async () => {
    const { result } = renderHook(() => useCashFlowSimSetup(CF_SETTINGS))
    act(() => { result.current.handleXlsImport(makeXlsFile()) })
    await waitFor(() => expect(result.current.stateRef.current!.backlog.length).toBe(2))
    expect(allHaveProfile(result.current.stateRef.current!, 'flat')).toBe(true)

    act(() => { result.current.handleRevenueProfileChange('j-curve') })
    expect(allHaveProfile(result.current.stateRef.current!, 'j-curve')).toBe(true)
    expect(result.current.stateRef.current!.backlog.length).toBe(2)
  })
})

describe('feat-017: rozpracovaný dialog se zavře, když se běh nahradí něčím jiným', () => {
  /** Hook s během v chodu a otevřeným dialogem „Change revenue curve?“. */
  function withOpenDialog() {
    const hook = renderHook(() => useCashFlowSimSetup(CF_SETTINGS))
    act(() => { markRunning(hook.result.current.stateRef.current!) })
    act(() => { hook.result.current.handleRevenueProfileChange('j-curve') })
    expect(hook.result.current.confirmingRevenueProfile).toBe('j-curve')
    return hook
  }

  it('„Generate new backlog“ dialog zavře', () => {
    const { result } = withOpenDialog()
    act(() => { result.current.handleRegenerate() })
    expect(result.current.confirmingRevenueProfile).toBeNull()
  })

  it('výběr presetu dialog zavře', () => {
    const { result } = withOpenDialog()
    act(() => { result.current.handlePresetClick(PRESETS[1]) })
    expect(result.current.confirmingRevenueProfile).toBeNull()
  })

  it('XLS import dialog zavře', async () => {
    const { result } = withOpenDialog()
    act(() => { result.current.handleXlsImport(makeXlsFile()) })
    await waitFor(() => expect(result.current.stateRef.current!.backlog.length).toBe(2))
    expect(result.current.confirmingRevenueProfile).toBeNull()
  })
})

describe('feat-017: settings.revenueProfile a profil featur se nikdy nerozejdou', () => {
  const inSync = (result: { current: ReturnType<typeof useCashFlowSimSetup> }) => {
    const state = result.current.stateRef.current!
    const profile = result.current.settings.revenueProfile ?? 'flat'
    expect(result.current.revenueProfile).toBe(profile)
    expect(allHaveProfile(state, profile)).toBe(true)
  }

  it('po přepnutí, Generate, presetu i importu je profil v nastavení shodný s profilem každé featury', async () => {
    const { result } = renderHook(() => useCashFlowSimSetup(CF_SETTINGS))
    inSync(result)
    act(() => { result.current.handleRevenueProfileChange('j-curve') })
    inSync(result)
    act(() => { result.current.handleRegenerate() })
    inSync(result)
    act(() => { result.current.handlePresetClick(PRESETS[1]) })
    inSync(result)
    act(() => { result.current.handleRevenueProfileChange('s-curve') })
    act(() => { result.current.handleXlsImport(makeXlsFile()) })
    await waitFor(() => expect(result.current.stateRef.current!.backlog.length).toBe(2))
    inSync(result)
  })
})
