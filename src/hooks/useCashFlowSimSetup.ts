'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MEMBER_NAMES, TEAM_NAMES, PRESETS, mulberry32,
  makeInitialState, regenerate, applyPreset, resetTaskProgress, cloneFeatureFresh, setRevenueProfile,
} from '@/simulation/engine'
import { addRole, deleteRole } from '@/simulation/roleManagement'
import { parseXlsFile, type ImportResult } from '@/lib/xlsImport'
import type {
  SimSettings, SimState, Role, RoleMeta, FocusMode, WipMode, UnitPreset, ActivePresetId, RevenueProfile,
} from '@/types/simulation'

/**
 * Pevný seed výchozího backlogu Cash Flow (feat-016, determinismus). Po načtení stránky a po
 * výběru presetu tak vzniká vždy stejný backlog — stejně jako v Advanced módu (seed 42).
 * „Generate new backlog“ používá náhodný seed záměrně (cesta k jinému backlogu).
 */
const CASH_FLOW_SEED = 42

/** Kompletní stav a handlery pro plnou konfiguraci Cash Flow simulace (backlog,
 *  specializace, tým, presety, XLS import) — zrcadlí Advanced mód, ale jako zcela
 *  nezávislá instance (feat-015). Vrací ho `useCashFlowSimSetup`. */
export interface CashFlowSimSetup {
  stateRef: React.RefObject<SimState | null>
  rngRef: React.RefObject<(() => number) | null>
  settings: SimSettings
  setSettings: React.Dispatch<React.SetStateAction<SimSettings>>
  settingsRef: React.RefObject<SimSettings>
  roleConfig: Record<Role, RoleMeta>
  roleConfigRef: React.RefObject<Record<Role, RoleMeta>>
  activePresetId: ActivePresetId
  confirmingPreset: UnitPreset | null
  setConfirmingPreset: React.Dispatch<React.SetStateAction<UnitPreset | null>>
  showRoleSettings: boolean
  setShowRoleSettings: React.Dispatch<React.SetStateAction<boolean>>
  showBacklogControls: boolean
  setShowBacklogControls: React.Dispatch<React.SetStateAction<boolean>>
  showTeamSettings: boolean
  setShowTeamSettings: React.Dispatch<React.SetStateAction<boolean>>
  importMsg: { ok: boolean; text: string } | null
  fileInputRef: React.RefObject<HTMLInputElement | null>
  focusMode: FocusMode
  focusModeRef: React.RefObject<FocusMode>
  wipMode: WipMode
  wipModeRef: React.RefObject<WipMode>
  setWipMode: React.Dispatch<React.SetStateAction<WipMode>>
  /** Přepínač Coordination overhead (feat-016) — uložený v `settings.coordinationOverhead`. */
  coordinationOverhead: boolean
  setCoordinationOverhead: (value: boolean) => void
  /** Aktuální tvar výnosu featur (feat-017) — uložený v `settings.revenueProfile`, výchozí `'flat'`. */
  revenueProfile: RevenueProfile
  /** Profil, na který se uživatel právě ptá potvrzovací dialog (změna během běhu); `null` = dialog je zavřený. */
  confirmingRevenueProfile: RevenueProfile | null
  setConfirmingRevenueProfile: React.Dispatch<React.SetStateAction<RevenueProfile | null>>
  /** Kliknutí na volbu přepínače „Revenue curve“: před startem a po doběhnutém běhu změna proběhne hned,
   *  během běhu se jen otevře dialog. */
  handleRevenueProfileChange: (profile: RevenueProfile) => void
  /** „Change and reset“ v dialogu — provede čekající změnu profilu. */
  handleConfirmRevenueProfile: () => void
  forceUpdate: () => void
  handleAssignRole: (memberId: number, role: Role) => void
  handleRemoveRole: (memberId: number, role: Role) => void
  handleXlsImport: (file: File) => void
  handleRegenerate: () => void
  handlePresetClick: (preset: UnitPreset) => void
  handleConfirmPreset: () => void
  handleRenameMember: (memberId: number, name: string) => void
  handleRemoveMember: (memberId: number) => void
  handleAddMember: () => void
  handleRoleChange: (roleId: string, updates: Partial<RoleMeta>) => void
  handleAddRole: (label: string, color: string) => void
  handleDeleteRole: (roleId: string) => void
}

/**
 * Vrací kompletní stav a handlery pro plnou konfiguraci simulace (backlog, specializace,
 * tým, presety, XLS import) — zrcadlí Advanced mód, ale jako zcela nezávislá instance pro
 * Cash Flow (feat-015: "úplně stejně jako Advanced, akorát bez sledování waiting času a
 * předávek"). Voláno jednou v Simulator.tsx; RAF ticking zůstává mimo tento hook.
 *
 * @param initialSettings - Počáteční SimSettings pro seed prvního backlogu
 * @param onStateReplaced - Volitelný callback zavolaný pokaždé, když handler uvnitř hooku
 *   zcela nahradí `stateRef.current` (XLS import, preset apply) — Simulator.tsx ho používá
 *   k resetu cashFlowPaused/cashFlowHasStarted, stejně jako to Advanced mód dělá inline na
 *   stejných místech. `handleRegenerate` tímto callbackem NEprochází — jeho pause-reset řeší
 *   Simulator.tsx zvlášť, propletený s promocí run-comparison statistik do prevStats.
 * @returns Stav, refs a handlery pro Cash Flow Settings/Team panely
 */
export function useCashFlowSimSetup(
  initialSettings: SimSettings,
  onStateReplaced?: () => void,
): CashFlowSimSetup {
  const [, localForceUpdate] = useState(0)
  const forceUpdate = useCallback(() => localForceUpdate(n => n + 1), [])

  const [settings, setSettings] = useState<SimSettings>(initialSettings)
  const settingsRef = useRef(settings)
  useEffect(() => { settingsRef.current = settings }, [settings])

  // Cash Flow má vlastní preset stav jen v paměti — nesdílí localStorage klíč s Advanced,
  // aby si módy neovlivňovaly výchozí konfiguraci mezi sezeními (feat-015: nezávislá konfigurace).
  const [activePresetId, setActivePresetIdState] = useState<ActivePresetId>('teams')
  const activePresetIdRef = useRef<ActivePresetId>('teams')
  useEffect(() => { activePresetIdRef.current = activePresetId }, [activePresetId])

  const [confirmingPreset, setConfirmingPreset] = useState<UnitPreset | null>(null)

  const [roleConfig, setRoleConfig] = useState<Record<Role, RoleMeta>>(() => ({ ...PRESETS[0].roleMeta }))
  const roleConfigRef = useRef(roleConfig)
  useEffect(() => { roleConfigRef.current = roleConfig }, [roleConfig])

  const [showRoleSettings, setShowRoleSettings] = useState(false)
  const [showBacklogControls, setShowBacklogControls] = useState(false)
  const [showTeamSettings, setShowTeamSettings] = useState(false)
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Nejvyšší ID jednotky, které kdy bylo přiděleno (feat-016). Samotný max ID aktuálního týmu
  // nestačí: po smazání jednotky s nejvyšším ID by nová jednotka dostala stejné ID a v historii
  // featur (workedBy, pendingDivergence) by se tvářila jako ta smazaná.
  const lastMemberIdRef = useRef(0)

  const [focusMode] = useState<FocusMode>('priority')
  const focusModeRef = useRef<FocusMode>('priority')
  const [wipMode, setWipMode] = useState<WipMode>('reduce-wip')
  const wipModeRef = useRef<WipMode>('reduce-wip')
  useEffect(() => { wipModeRef.current = wipMode }, [wipMode])

  // Coordination overhead (feat-016) žije v SimSettings, protože ho čte tick() přes settingsRef.
  // Zamčení během běhu řeší UI (Simulator.tsx) — tady stačí prostý setter.
  const coordinationOverhead = settings.coordinationOverhead ?? false
  const setCoordinationOverhead = useCallback((value: boolean) => {
    setSettings(s => ({ ...s, coordinationOverhead: value }))
  }, [])

  // Tvar výnosu (feat-017) žije v SimSettings, aby ho zachovaly „Generate new backlog“ i výběr presetu
  // (obojí předává settingsRef.current do generování backlogu).
  const revenueProfile: RevenueProfile = settings.revenueProfile ?? 'flat'
  const [confirmingRevenueProfile, setConfirmingRevenueProfile] = useState<RevenueProfile | null>(null)

  const rngRef = useRef<(() => number) | null>(null)
  const stateRef = useRef<SimState | null>(null)
  if (stateRef.current === null) {
    const initPreset = PRESETS[0]
    const { team: initTeam } = applyPreset(initPreset)
    const rng = mulberry32(CASH_FLOW_SEED)
    rngRef.current = rng
    stateRef.current = makeInitialState(rng, initialSettings, initPreset.roleMeta)
    stateRef.current.team = initTeam
    setRoleConfig({ ...initPreset.roleMeta })
  }

  const markCustom = useCallback(() => {
    setActivePresetIdState('custom')
  }, [])

  const handleAssignRole = useCallback((memberId: number, role: Role) => {
    const m = stateRef.current?.team.find(m => m.id === memberId)
    if (m && !m.roles.includes(role)) m.roles.push(role)
    forceUpdate()
  }, [forceUpdate])

  const handleRemoveRole = useCallback((memberId: number, role: Role) => {
    const s = stateRef.current
    if (!s) return
    const m = s.team.find(m => m.id === memberId)
    if (!m) return
    m.roles = m.roles.filter(r => r !== role)
    if (m.currentTask) {
      const f = s.inProgress.find(f => f.id === m.currentTask!.featureId)
      if (f) {
        const t = f.tasks.find(t => t.id === m.currentTask!.taskId)
        if (t && t.role === role) {
          // resetTaskProgress vrací i přirážku z handoff taxu (feat-016)
          resetTaskProgress(f, t)
          m.currentTask = null
        }
      }
    }
    forceUpdate()
  }, [forceUpdate])

  /** Builds a fresh SimState from ImportResult — replaces backlog, team and roleConfig. */
  const handleXlsImport = useCallback((file: File) => {
    setImportMsg(null)
    file.arrayBuffer().then(buffer => {
      let result: ImportResult
      try {
        result = parseXlsFile(buffer)
      } catch (err) {
        setImportMsg({ ok: false, text: err instanceof Error ? err.message : 'Nepodařilo se načíst soubor.' })
        return
      }

      // Import zakládá featury na Flat — zvolený tvar výnosu (feat-017) jim nastavíme před tvorbou snapshotu
      const importProfile = settingsRef.current.revenueProfile ?? 'flat'
      for (const f of result.features) f.revenueProfile = importProfile

      const newState: SimState = {
        backlog: result.features,
        // cloneFeatureFresh vytvoří nezávislé kopie včetně polí workedBy / pendingDivergence — plochá
        // kopie přes `...f` by je sdílela s živými featurami a tick() by do snapshotu zapisoval
        backlogSnapshot: result.features.map(cloneFeatureFresh),
        inProgress: [],
        done: [],
        doneOverflow: [],
        team: result.team,
        leadTimes: [],
        simTime: 0,
        wipIntegral: 0,
        lastGenAt: 0,
        startedAt: null,
        finished: false,
        totalRevenueAllTime: 0,
      }

      stateRef.current = newState
      setRoleConfig(result.roleConfig)
      // Rozpracovaný dialog změny křivky by se ptal na zahozený běh — zavřeme ho (platí i pro preset a Generate níže)
      setConfirmingRevenueProfile(null)
      onStateReplaced?.()
      forceUpdate()

      const taskCount = result.features.reduce((n, f) => n + f.tasks.length, 0)
      const msg = `Importováno: ${result.features.length} features, ${taskCount} tasků, ${result.team.length} členů týmu.`
      const fullMsg = result.warnings.length > 0 ? `${msg} ${result.warnings.join(' ')}` : msg
      setImportMsg({ ok: true, text: fullMsg })
      setTimeout(() => setImportMsg(null), 4000)
    }).catch(() => {
      setImportMsg({ ok: false, text: 'Soubor se nepodařilo přečíst.' })
    })
  }, [forceUpdate, onStateReplaced])

  /** Applies a preset: replaces team + roleConfig, regenerates backlog, resets simulation. */
  const doApplyPreset = useCallback((preset: UnitPreset) => {
    const { team, roleConfig: newRoleConfig } = applyPreset(preset)
    const rng = mulberry32(CASH_FLOW_SEED)
    rngRef.current = rng
    stateRef.current = makeInitialState(rng, settingsRef.current, newRoleConfig)
    stateRef.current.team = team
    setRoleConfig(newRoleConfig)
    setActivePresetIdState(preset.id)
    setConfirmingRevenueProfile(null)
    onStateReplaced?.()
    forceUpdate()
  }, [forceUpdate, onStateReplaced])

  const handlePresetClick = useCallback((preset: UnitPreset) => {
    if (activePresetIdRef.current === 'custom') {
      setConfirmingPreset(preset)
    } else {
      doApplyPreset(preset)
    }
  }, [doApplyPreset])

  const handleConfirmPreset = useCallback(() => {
    if (!confirmingPreset) return
    doApplyPreset(confirmingPreset)
    setConfirmingPreset(null)
  }, [confirmingPreset, doApplyPreset])

  const handleRenameMember = useCallback((memberId: number, name: string) => {
    const m = stateRef.current?.team.find(m => m.id === memberId)
    if (m) m.name = name
    markCustom()
    forceUpdate()
  }, [markCustom, forceUpdate])

  const handleRemoveMember = useCallback((memberId: number) => {
    const s = stateRef.current
    if (!s) return
    const m = s.team.find(m => m.id === memberId)
    if (m?.currentTask) {
      const f = s.inProgress.find(f => f.id === m.currentTask!.featureId)
      const t = f?.tasks.find(t => t.id === m.currentTask!.taskId)
      if (f && t) resetTaskProgress(f, t)
    }
    s.team = s.team.filter(m => m.id !== memberId)
    markCustom()
    forceUpdate()
  }, [markCustom, forceUpdate])

  const handleAddMember = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    const usedNames = new Set(s.team.map(m => m.name))
    const namePool = activePresetIdRef.current === 'teams' ? TEAM_NAMES : MEMBER_NAMES
    const name = namePool.find(n => !usedNames.has(n)) ?? `Unit ${s.team.length + 1}`
    const maxId = s.team.reduce((max, m) => Math.max(max, m.id), lastMemberIdRef.current)
    const newId = maxId + 1
    lastMemberIdRef.current = newId
    s.team.push({ id: newId, name, roles: [], currentTask: null, idleSec: 0 })
    markCustom()
    forceUpdate()
  }, [markCustom, forceUpdate])

  const handleRoleChange = useCallback((roleId: string, updates: Partial<RoleMeta>) => {
    setRoleConfig(prev => ({ ...prev, [roleId]: { ...prev[roleId], ...updates } }))
    markCustom()
  }, [markCustom])

  const handleAddRole = useCallback((label: string, color: string) => {
    setRoleConfig(prev => {
      const { roleConfig: next } = addRole(prev, label, color)
      return next
    })
    markCustom()
  }, [markCustom])

  const handleDeleteRole = useCallback((roleId: string) => {
    const s = stateRef.current
    if (!s) return
    setRoleConfig(prev => {
      const { roleConfig: next } = deleteRole(s, prev, roleId)
      return next
    })
    markCustom()
    forceUpdate()
  }, [markCustom, forceUpdate])

  const handleRegenerate = useCallback(() => {
    const { state, rng } = regenerate(settingsRef.current, roleConfigRef.current)
    state.team = stateRef.current!.team.map(m => ({ ...m, currentTask: null, idleSec: 0 }))
    stateRef.current = state
    rngRef.current = rng
    setConfirmingRevenueProfile(null)
    forceUpdate()
  }, [forceUpdate])

  /** Přepne tvar výnosu na všech featurách a vrátí simulaci na začátek se stejným backlogem. */
  const applyRevenueProfile = useCallback((profile: RevenueProfile) => {
    const s = stateRef.current
    if (!s) return
    setRevenueProfile(s, profile)
    setSettings(prev => ({ ...prev, revenueProfile: profile }))
    // ref se jinak srovná až efektem po renderu; handlery volané hned po změně (Generate, preset) ho čtou
    settingsRef.current = { ...settingsRef.current, revenueProfile: profile }
    // Simulace se vrátila na začátek — stejně jako po výběru presetu se má zastavit a čekat na Start
    onStateReplaced?.()
    forceUpdate()
  }, [forceUpdate, onStateReplaced])

  const handleRevenueProfileChange = useCallback((profile: RevenueProfile) => {
    const s = stateRef.current
    if (!s || profile === (settingsRef.current.revenueProfile ?? 'flat')) return
    // Dialog jen když běh už začal a ještě nedoběhl; před startem a po doběhnutém běhu se mění hned
    if (s.startedAt !== null && !s.finished) {
      setConfirmingRevenueProfile(profile)
      return
    }
    applyRevenueProfile(profile)
  }, [applyRevenueProfile])

  const handleConfirmRevenueProfile = useCallback(() => {
    if (!confirmingRevenueProfile) return
    applyRevenueProfile(confirmingRevenueProfile)
    setConfirmingRevenueProfile(null)
  }, [confirmingRevenueProfile, applyRevenueProfile])

  return {
    stateRef, rngRef, settings, setSettings, settingsRef,
    roleConfig, roleConfigRef, activePresetId, confirmingPreset, setConfirmingPreset,
    showRoleSettings, setShowRoleSettings, showBacklogControls, setShowBacklogControls,
    showTeamSettings, setShowTeamSettings, importMsg, fileInputRef,
    focusMode, focusModeRef, wipMode, wipModeRef, setWipMode,
    coordinationOverhead, setCoordinationOverhead,
    revenueProfile, confirmingRevenueProfile, setConfirmingRevenueProfile,
    handleRevenueProfileChange, handleConfirmRevenueProfile, forceUpdate,
    handleAssignRole, handleRemoveRole, handleXlsImport, handleRegenerate,
    handlePresetClick, handleConfirmPreset, handleRenameMember, handleRemoveMember,
    handleAddMember, handleRoleChange, handleAddRole, handleDeleteRole,
  }
}
