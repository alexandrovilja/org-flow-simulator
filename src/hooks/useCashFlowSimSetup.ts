'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  MEMBER_NAMES, TEAM_NAMES, PRESETS, mulberry32,
  makeInitialState, regenerate, applyPreset,
} from '@/simulation/engine'
import { addRole, deleteRole } from '@/simulation/roleManagement'
import { parseXlsFile, type ImportResult } from '@/lib/xlsImport'
import type {
  SimSettings, SimState, Role, RoleMeta, FocusMode, WipMode, UnitPreset, ActivePresetId,
} from '@/types/simulation'

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

  const [focusMode] = useState<FocusMode>('priority')
  const focusModeRef = useRef<FocusMode>('priority')
  const [wipMode, setWipMode] = useState<WipMode>('reduce-wip')
  const wipModeRef = useRef<WipMode>('reduce-wip')
  useEffect(() => { wipModeRef.current = wipMode }, [wipMode])

  const rngRef = useRef<(() => number) | null>(null)
  const stateRef = useRef<SimState | null>(null)
  if (stateRef.current === null) {
    const initPreset = PRESETS[0]
    const { team: initTeam } = applyPreset(initPreset)
    const rng = mulberry32(Math.floor(Math.random() * 1e9))
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
          t.status = 'todo'; t.assignee = null; t.progress = 0; m.currentTask = null
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

      const newState: SimState = {
        backlog: result.features,
        backlogSnapshot: result.features.map(f => ({
          ...f,
          tasks: f.tasks.map(t => ({ ...t })),
        })),
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
    const rng = mulberry32(Math.floor(Math.random() * 1e9))
    rngRef.current = rng
    stateRef.current = makeInitialState(rng, settingsRef.current, newRoleConfig)
    stateRef.current.team = team
    setRoleConfig(newRoleConfig)
    setActivePresetIdState(preset.id)
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
      if (t) { t.status = 'todo'; t.assignee = null; t.progress = 0 }
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
    const maxId = s.team.reduce((max, m) => Math.max(max, m.id), 0)
    s.team.push({ id: maxId + 1, name, roles: [], currentTask: null, idleSec: 0 })
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
    forceUpdate()
  }, [forceUpdate])

  return {
    stateRef, rngRef, settings, setSettings, settingsRef,
    roleConfig, roleConfigRef, activePresetId, confirmingPreset, setConfirmingPreset,
    showRoleSettings, setShowRoleSettings, showBacklogControls, setShowBacklogControls,
    showTeamSettings, setShowTeamSettings, importMsg, fileInputRef,
    focusMode, focusModeRef, wipMode, wipModeRef, setWipMode, forceUpdate,
    handleAssignRole, handleRemoveRole, handleXlsImport, handleRegenerate,
    handlePresetClick, handleConfirmPreset, handleRenameMember, handleRemoveMember,
    handleAddMember, handleRoleChange, handleAddRole, handleDeleteRole,
  }
}
