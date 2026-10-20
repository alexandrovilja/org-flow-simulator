'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { flushSync } from 'react-dom'
import {
  ROLE_META, MEMBER_NAMES, TEAM_NAMES, PRESETS, mulberry32,
  makeInitialState, resetFromSnapshot, regenerate, tick, computeStats, applyPreset, plateauRevenuePerTick, doneCount,
  setMemberAiMultiplier,
} from '@/simulation/engine'
import type { AppMode, SimSettings, SimState, Feature, Role, RoleMeta, FocusMode, WipMode, UnitPreset, ActivePresetId, RevenueProfile, AiMultiplier } from '@/types/simulation'
import { StatTile } from '@/components/StatTile'
import { SpeedControl } from '@/components/SpeedControl'
import { Button } from '@/components/Button'
import { SegmentedControl } from '@/components/SegmentedControl'
import { TopBar } from '@/components/TopBar'
import { WinnerBanner } from '@/components/WinnerBanner'
import { DoneRow } from '@/components/DoneRow'
import { ResultsAside } from '@/components/ResultsAside'
import { ComparePanel } from '@/components/ComparePanel'
import { CashFlowPanel } from '@/components/CashFlowPanel'
import { BacklogSettingsPanel } from '@/components/BacklogSettingsPanel'
import { InProgressTeamPanel } from '@/components/InProgressTeamPanel'
import { useCashFlowSimSetup } from '@/hooks/useCashFlowSimSetup'
import { formatTime } from '@/lib/formatTime'
import { formatEuro } from '@/lib/formatCurrency'
import { computeRevenueComparison } from '@/lib/revenueComparison'
import { featureMaxWork } from '@/lib/featureSize'
import { parseXlsFile, formatImportSummary, type ImportResult } from '@/lib/xlsImport'
import { addRole, deleteRole } from '@/simulation/roleManagement'
import {
  makeCompareStates, COMPARE_SETTINGS,
} from '@/simulation/compareMode'
import type { TeamType } from '@/simulation/compareMode'
import { isTutorialCompleted, markTutorialCompleted, hasSeenMode, markModeSeen, getActivePresetId, setActivePresetId } from '@/lib/storage'
import { TutorialOverlay } from '@/components/TutorialOverlay'
import type { TutorialMode } from '@/types/tutorial'
import styles from './Simulator.module.css'

// ── Types ────────────────────────────────────────────────────────────────────


/** Rychlosti, které nabízí přepínač v Compare (násobek reálného času). */
const COMPARE_SPEEDS = [0.5, 1, 10] as const

// ── Experiment mode defaults ─────────────────────────────────────────────────

const DEFAULT_SETTINGS: SimSettings = {
  minBacklog: 0,
  wipLimit: 6,
  sizeVar: 0.4,
  roleVar: 0.5,
  initialBacklog: 100,
  minSpecializations: 1,
}

// ── Cash Flow mode settings (feat-015) ──────────────────────────────────────
// Cash Flow startuje se stejným nastavením jako Advanced, včetně backlogu o 100 featurách
// (feat-015, Příklad 2). Vlastní konstanta zůstává jako místo pro budoucí výchozí hodnoty,
// které by se týkaly jen Cash Flow.
const CASHFLOW_SETTINGS: SimSettings = { ...DEFAULT_SETTINGS }

// ── Simulator component ───────────────────────────────────────────────────────

export function Simulator() {
  // ── Tutorial state ────────────────────────────────────────────────────────
  // showTutorial: whether the overlay is currently visible.
  // tutorialMode: which mode's steps to display in the overlay.
  const [showTutorial, setShowTutorial] = useState<boolean>(false)
  const [tutorialMode, setTutorialMode] = useState<TutorialMode>('compare')

  // On mount: auto-launch tutorial for first-time visitors.
  // We check both the global completed flag and the per-mode seen flag.
  useEffect(() => {
    if (!isTutorialCompleted() && !hasSeenMode('compare')) {
      setTutorialMode('compare')
      setShowTutorial(true)
    }
  }, [])

  /**
   * Called when the user finishes or skips the tutorial.
   * Saves both the global completed flag and the per-mode seen flag,
   * then hides the overlay.
   */
  const handleTutorialComplete = useCallback(() => {
    markTutorialCompleted()
    markModeSeen(tutorialMode)
    setShowTutorial(false)
  }, [tutorialMode])

  /**
   * Manually re-launches the tutorial for the given mode.
   * Triggered by the ? button in the header.
   */
  const handleTutorialRelaunch = useCallback((m: TutorialMode) => {
    setTutorialMode(m)
    setShowTutorial(true)
  }, [])

  // ── App mode ──────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<AppMode>('compare')
  const modeRef = useRef<AppMode>('compare')
  useEffect(() => { modeRef.current = mode }, [mode])

  // ── Shared force-update counter (used by both modes) ──────────────────────
  const [, forceUpdate] = useState(0)

  // ── Compare mode state ────────────────────────────────────────────────────
  const compareStateARef = useRef<SimState | null>(null)
  const compareStateBRef = useRef<SimState | null>(null)
  const compareRngARef   = useRef<(() => number) | null>(null)
  const compareRngBRef   = useRef<(() => number) | null>(null)
  const [comparePaused, setComparePaused]       = useState(true)
  const [compareHasStarted, setCompareHasStarted] = useState(false)
  const [compareSpeed, setCompareSpeed]         = useState<0.5 | 1 | 10>(1)
  const [compareTypeA, setCompareTypeA] = useState<TeamType>('single')
  const [compareTypeB, setCompareTypeB] = useState<TeamType>('double')
  const comparePausedRef = useRef(true)
  // Direct ref — updated synchronously in the click handler so RAF sees the new speed immediately.
  const compareSpeedRef  = useRef<0.5 | 1 | 10>(1)
  useEffect(() => { comparePausedRef.current = comparePaused }, [comparePaused])

  // Initialise compare states once on mount with default types (single vs double).
  if (compareStateARef.current === null) {
    const { stateA, rngA, stateB, rngB } = makeCompareStates('single', 'double', COMPARE_SETTINGS)
    compareStateARef.current = stateA
    compareStateBRef.current = stateB
    compareRngARef.current   = rngA
    compareRngBRef.current   = rngB
  }

  // ── Cash Flow mode state (feat-015) ─────────────────────────────────────────
  // Vlastní, nezávislý SimState/rng/settings/roleConfig/tým — plná parita s Advanced módem
  // (backlog, specializace, presety, XLS import), jen bez Total Wait/Avg Handoffs a s revenue
  // navíc. `useCashFlowSimSetup` zrcadlí Advanced módu stejnou logiku jako samostatná instance.
  const [cashFlowPaused, setCashFlowPaused]         = useState(true)
  const [cashFlowHasStarted, setCashFlowHasStarted] = useState(false)
  // Volá se z hooku pokaždé, když handler uvnitř něj zcela nahradí stateRef.current (XLS
  // import, preset apply) — mirror Advanced módu, který na stejných místech dělá totéž
  // inline (setPaused(true); setHasStarted(false)). handleRegenerate tímto NEprochází —
  // jeho pause-reset řeší handleCashFlowRegenerate níže, propletený s promocí prevStats.
  const handleCashFlowStateReplaced = useCallback(() => {
    setCashFlowPaused(true)
    setCashFlowHasStarted(false)
  }, [])
  const cf = useCashFlowSimSetup(CASHFLOW_SETTINGS, handleCashFlowStateReplaced)
  const [cashFlowSpeed, setCashFlowSpeed]           = useState<number>(1)
  const cashFlowPausedRef = useRef(true)
  const cashFlowSpeedRef  = useRef(1)
  useEffect(() => { cashFlowPausedRef.current = cashFlowPaused }, [cashFlowPaused])
  useEffect(() => { cashFlowSpeedRef.current   = cashFlowSpeed }, [cashFlowSpeed])

  // Run comparison (feat-015) — stejný vzor jako Advanced mód (lastFinishedRef/prevStats):
  // zachytí se jen když běh přirozeně doběhne (state.finished, auto-pauza je vždy okamžitá),
  // a promotuje se do prevStats při Reset/Regenerate. Total Revenue nejde porovnávat přímo
  // (běhy různé délky = nefér srovnání kumulativního čísla) — proto doneFeatures ukládá
  // minimální per-feature data pro zpětný dopočet revenue k libovolnému dřívějšímu času
  // (computeRevenueAsOf), viz cfRevenueComparison níže.
  type CashFlowRunSnapshot = {
    avgLt: number
    avgWip: number
    totalTime: number
    totalRevenue: number
    /** Tvar výnosu každé featury (feat-017) je součástí snapshotu, aby se běhy s různými profily
     *  dopočítaly ke stejnému času správně. */
    doneFeatures: Pick<Feature, 'finishedAt' | 'revenuePerTick' | 'revenueProfile'>[]
    /** Celkový coordination overhead v % (feat-016) — 0, pokud byl přepínač vypnutý. */
    coordinationPct: number
  }
  const [cashFlowPrevStats, setCashFlowPrevStats] = useState<CashFlowRunSnapshot | null>(null)
  const cashFlowLastFinishedRef = useRef<CashFlowRunSnapshot | null>(null)

  // ── Experiment mode state ─────────────────────────────────────────────────
  const [settings, setSettings] = useState<SimSettings>(DEFAULT_SETTINGS)
  const [speed, setSpeed]       = useState(1)
  const [paused, setPaused]     = useState(true)
  const [hasStarted, setHasStarted] = useState(false)

  type RunSnapshot = { avgLt: number; avgWip: number; totalTime: number; totalWait: number; avgHandoffs: number }
  const [prevStats, setPrevStats] = useState<RunSnapshot | null>(null)
  const lastFinishedRef = useRef<RunSnapshot | null>(null)

  // Active preset — persisted in localStorage; 'teams' is the default on first load
  const [activePresetId, setActivePresetIdState] = useState<ActivePresetId>(() => getActivePresetId())
  const activePresetIdRef = useRef<ActivePresetId>(getActivePresetId())
  useEffect(() => { activePresetIdRef.current = activePresetId }, [activePresetId])

  // Preset to confirm — non-null when the dialog should be shown (custom state only)
  const [confirmingPreset, setConfirmingPreset] = useState<UnitPreset | null>(null)

  // Initialize roleConfig from the active preset (or default Teams preset on first load)
  const [roleConfig, setRoleConfig] = useState<Record<Role, RoleMeta>>(() => {
    const id = getActivePresetId()
    const preset = PRESETS.find(p => p.id === id) ?? PRESETS[0]
    return { ...preset.roleMeta }
  })
  const [showRoleSettings, setShowRoleSettings] = useState(false)
  const [showBacklogControls, setShowBacklogControls] = useState(false)
  const [showTeamSettings, setShowTeamSettings] = useState(false)
  // Import status message — null = no message, object = show message
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [focusMode] = useState<FocusMode>('priority')
  const [wipMode, setWipMode]     = useState<WipMode>('reduce-wip')

  const focusModeRef = useRef<FocusMode>('priority')
  const wipModeRef   = useRef<WipMode>('reduce-wip')
  useEffect(() => { focusModeRef.current = focusMode }, [focusMode])
  useEffect(() => { wipModeRef.current   = wipMode   }, [wipMode])

  const roleConfigRef = useRef(roleConfig)
  useEffect(() => { roleConfigRef.current = roleConfig }, [roleConfig])

  const rngRef      = useRef(mulberry32(42))
  const stateRef    = useRef<SimState | null>(null)
  if (stateRef.current === null) {
    const initPreset = PRESETS.find(p => p.id === getActivePresetId()) ?? PRESETS[0]
    const { team: initTeam } = applyPreset(initPreset)
    stateRef.current = makeInitialState(rngRef.current, DEFAULT_SETTINGS, initPreset.roleMeta)
    // Override the defaultTeam created by makeInitialState with the preset's team
    stateRef.current.team = initTeam
  }
  const settingsRef  = useRef(settings)
  const speedRef     = useRef(speed)
  const pausedRef    = useRef(paused)
  useEffect(() => { settingsRef.current = settings }, [settings])
  useEffect(() => { speedRef.current    = speed    }, [speed])
  useEffect(() => { pausedRef.current   = paused   }, [paused])

  // ── Unified RAF loop ───────────────────────────────────────────────────────
  useEffect(() => {
    let raf: number
    let lastT      = performance.now()
    let accumulated = 0
    // Vlastní accumulator pro Cash Flow — oddělený od `accumulated` výše, aby zbytková
    // hodnota z Compare/Advanced při přepnutí tabu neovlivnila Cash Flow ticking.
    let cashFlowAccumulated = 0
    const TARGET_DT_MS = 1000 / 60

    const step = (t: number) => {
      const elapsed = Math.min(100, t - lastT)
      lastT = t

      if (modeRef.current === 'compare') {
        if (!comparePausedRef.current) {
          accumulated += elapsed * compareSpeedRef.current
          while (accumulated >= TARGET_DT_MS) {
            const dtSim = TARGET_DT_MS / 1000
            const sA = compareStateARef.current
            const sB = compareStateBRef.current
            if (sA && !sA.finished && compareRngARef.current) {
              tick(sA, dtSim, COMPARE_SETTINGS, compareRngARef.current, ROLE_META, 'priority', 'reduce-wip')
            }
            if (sB && !sB.finished && compareRngBRef.current) {
              tick(sB, dtSim, COMPARE_SETTINGS, compareRngBRef.current, ROLE_META, 'priority', 'reduce-wip')
            }
            accumulated -= TARGET_DT_MS
            // Pause automatically once both simulations finish.
            if (sA?.finished && sB?.finished) {
              setComparePaused(true)
              break
            }
          }
          flushSync(() => { forceUpdate(n => (n + 1) & 0xFFFF) })
        } else {
          accumulated = 0
        }
      } else if (modeRef.current === 'experiment') {
        // Experiment mode — original logic unchanged.
        if (!pausedRef.current && stateRef.current) {
          const state = stateRef.current
          if (!state.finished) {
            accumulated += elapsed * speedRef.current
            while (accumulated >= TARGET_DT_MS && !state.finished) {
              const dtSim = TARGET_DT_MS / 1000
              tick(state, dtSim, settingsRef.current, rngRef.current, roleConfigRef.current, focusModeRef.current, wipModeRef.current)
              accumulated -= TARGET_DT_MS
            }
            if (state.finished) {
              setPaused(true)
              const finishedStats = computeStats(state.leadTimes)
              const finishedAvgWip = state.simTime > 0.5 ? state.wipIntegral / state.simTime : 0
              if (finishedStats.count > 0) {
                const finishedTotalWait = state.team.reduce((sum, m) => sum + m.idleSec, 0)
                lastFinishedRef.current = { avgLt: finishedStats.avg, avgWip: finishedAvgWip, totalTime: state.simTime, totalWait: finishedTotalWait, avgHandoffs: finishedStats.avgHandoffs }
              }
            }
          }
          flushSync(() => { forceUpdate(n => (n + 1) & 0xFFFF) })
        } else {
          accumulated = 0
        }
      } else if (modeRef.current === 'cashflow') {
        if (!cashFlowPausedRef.current && cf.stateRef.current && cf.rngRef.current) {
          const state = cf.stateRef.current
          if (!state.finished) {
            cashFlowAccumulated += elapsed * cashFlowSpeedRef.current
            while (cashFlowAccumulated >= TARGET_DT_MS && !state.finished) {
              const dtSim = TARGET_DT_MS / 1000
              tick(state, dtSim, cf.settingsRef.current, cf.rngRef.current, cf.roleConfigRef.current, cf.focusModeRef.current, cf.wipModeRef.current)
              cashFlowAccumulated -= TARGET_DT_MS
            }
            // Auto-pause once the whole backlog is processed — matches Advanced mode's
            // behavior. Revenue already accrued on Done features is kept; it just stops
            // growing further once ticking stops (no more work left to demonstrate).
            if (state.finished) {
              setCashFlowPaused(true)
              const finishedStats = computeStats(state.leadTimes)
              const finishedAvgWip = state.simTime > 0.5 ? state.wipIntegral / state.simTime : 0
              if (finishedStats.count > 0) {
                cashFlowLastFinishedRef.current = {
                  avgLt: finishedStats.avg, avgWip: finishedAvgWip,
                  totalTime: state.simTime, totalRevenue: state.totalRevenueAllTime,
                  // doneOverflow zahrnuto, aby zpětný dopočet (computeRevenueAsOf) nepodhodnocoval
                  // běhy s > 40 dokončenými featurami — stejný fix jako pro živé totalRevenueAllTime.
                  doneFeatures: [
                    ...state.done.map(f => ({ finishedAt: f.finishedAt, revenuePerTick: f.revenuePerTick, revenueProfile: f.revenueProfile })),
                    ...state.doneOverflow.map(o => ({ finishedAt: o.finishedAt, revenuePerTick: o.revenuePerTick, revenueProfile: o.revenueProfile })),
                  ],
                  coordinationPct: finishedStats.coordinationPct,
                }
              }
            }
          }
          flushSync(() => { forceUpdate(n => (n + 1) & 0xFFFF) })
        } else {
          cashFlowAccumulated = 0
        }
      }

      raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
    // cf.stateRef/cf.rngRef/etc. are useRef() objects created inside useCashFlowSimSetup and
    // are stable across renders — only the `cf` wrapper object is recreated each render, which
    // is why ESLint can't statically prove their stability here. Same reasoning as the other
    // refs already read in this effect (stateRef, rngRef, settingsRef, ...).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Mode switching ─────────────────────────────────────────────────────────

  /** Switches to Compare mode and resets both compare simulations to initial state. */
  const handleSwitchToCompare = useCallback(() => {
    setComparePaused(true)
    setCompareHasStarted(false)
    setCompareTypeA('single')
    setCompareTypeB('double')
    const { stateA, rngA, stateB, rngB } = makeCompareStates('single', 'double', COMPARE_SETTINGS)
    compareStateARef.current = stateA
    compareStateBRef.current = stateB
    compareRngARef.current   = rngA
    compareRngBRef.current   = rngB
    setMode('compare')
  }, [])

  const handleSwitchToExperiment = useCallback(() => {
    // Pause experiment mode if it was running (it keeps its own state).
    setPaused(true)
    setMode('experiment')
    // If the user hasn't seen the experiment tutorial yet, offer it now.
    if (!hasSeenMode('experiment')) {
      setTutorialMode('experiment')
      setShowTutorial(true)
    }
  }, [])

  // ── Compare mode handlers ──────────────────────────────────────────────────

  const handleCompareReset = useCallback(() => {
    setCompareTypeA('single')
    setCompareTypeB('double')
    const { stateA, rngA, stateB, rngB } = makeCompareStates('single', 'double', COMPARE_SETTINGS)
    compareStateARef.current = stateA
    compareStateBRef.current = stateB
    compareRngARef.current   = rngA
    compareRngBRef.current   = rngB
    setComparePaused(true)
    setCompareHasStarted(false)
    forceUpdate(n => n + 1)
  }, [])

  /**
   * Called when the user picks a new team type in one of the ComparePanel columns.
   * Rebuilds both simulations from scratch so the backlog stays identical for the new team pair.
   */
  const handleCompareTypeChange = useCallback((column: 'A' | 'B', newType: TeamType) => {
    // Determine the effective types after this change.
    const nextTypeA = column === 'A' ? newType : compareTypeA
    const nextTypeB = column === 'B' ? newType : compareTypeB
    if (column === 'A') setCompareTypeA(newType)
    else                setCompareTypeB(newType)
    const { stateA, rngA, stateB, rngB } = makeCompareStates(nextTypeA, nextTypeB, COMPARE_SETTINGS)
    compareStateARef.current = stateA
    compareStateBRef.current = stateB
    compareRngARef.current   = rngA
    compareRngBRef.current   = rngB
    setComparePaused(true)
    setCompareHasStarted(false)
    forceUpdate(n => n + 1)
  }, [compareTypeA, compareTypeB])

  // ── Experiment mode handlers ───────────────────────────────────────────────

  const handleAssignRole = useCallback((memberId: number, role: Role) => {
    const m = stateRef.current?.team.find(m => m.id === memberId)
    if (m && !m.roles.includes(role)) m.roles.push(role)
    forceUpdate(n => n + 1)
  }, [])

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
    forceUpdate(n => n + 1)
  }, [])

  /** Builds a fresh SimState from ImportResult — replaces backlog, team and roleConfig. */
  const handleXlsImport = useCallback((file: File) => {
    setImportMsg(null)
    file.arrayBuffer().then(buffer => {
      let result: ImportResult
      try {
        result = parseXlsFile(buffer)
      } catch (err) {
        setImportMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not load the file.' })
        return
      }

      // Build a new SimState from imported data
      const newState: SimState = {
        backlog: result.features,
        // Deep-clone features for snapshot so reset works correctly
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
      setPaused(true)
      setHasStarted(false)
      forceUpdate(n => n + 1)

      setImportMsg({ ok: true, text: formatImportSummary(result) })
      setTimeout(() => setImportMsg(null), 4000)

      // Switch to experiment mode if not already there
      setMode('experiment')
    }).catch(() => {
      setImportMsg({ ok: false, text: 'Could not read the file.' })
    })
  }, [])

  const handleReset = useCallback(() => {
    if (lastFinishedRef.current) setPrevStats(lastFinishedRef.current)
    if (stateRef.current) resetFromSnapshot(stateRef.current)
    forceUpdate(n => n + 1)
  }, [])

  /** Marks the current config as 'custom' — called after any manual team or role edit. */
  const markCustom = useCallback(() => {
    setActivePresetIdState('custom')
    setActivePresetId('custom')
  }, [])

  /**
   * Applies a preset: replaces team + roleConfig, regenerates backlog, resets simulation.
   * Always regenerates the backlog because roles differ between presets — keeping the old
   * backlog would leave tasks for roles that no longer exist in the new preset.
   *
   * @param preset - The preset to apply
   */
  const doApplyPreset = useCallback((preset: UnitPreset) => {
    const { team, roleConfig: newRoleConfig } = applyPreset(preset)
    // Fresh RNG seed so the new backlog is reproducible from t=0 after reset
    rngRef.current = mulberry32(42)
    stateRef.current = makeInitialState(rngRef.current, settingsRef.current, newRoleConfig)
    stateRef.current.team = team
    setRoleConfig(newRoleConfig)
    setActivePresetIdState(preset.id)
    setActivePresetId(preset.id)
    setPaused(true)
    setHasStarted(false)
    forceUpdate(n => n + 1)
  }, [])

  /** Called when user clicks a preset button in Settings. */
  const handlePresetClick = useCallback((preset: UnitPreset) => {
    if (activePresetIdRef.current === 'custom') {
      // Custom state: show confirmation dialog before overwriting
      setConfirmingPreset(preset)
    } else {
      doApplyPreset(preset)
    }
  }, [doApplyPreset])

  /** Called when user confirms the dialog ("Apply preset"). */
  const handleConfirmPreset = useCallback(() => {
    if (!confirmingPreset) return
    doApplyPreset(confirmingPreset)
    setConfirmingPreset(null)
  }, [confirmingPreset, doApplyPreset])

  const handleRenameMember = useCallback((memberId: number, name: string) => {
    const m = stateRef.current?.team.find(m => m.id === memberId)
    if (m) m.name = name
    markCustom()
    forceUpdate(n => n + 1)
  }, [markCustom])

  /**
   * Nastaví jednotce AI multiplikátor (feat-019); 1 = vypnout AI. Zápis dělá sdílený
   * `setMemberAiMultiplier` (stejně jako Cash Flow). Skutečná změna je ruční úprava týmu, proto
   * preset přejde na „custom“; beze změny hodnoty se nic neděje.
   *
   * @param memberId - ID jednotky
   * @param value    - Nový multiplikátor (1, 2 nebo 5)
   */
  const handleSetAiMultiplier = useCallback((memberId: number, value: AiMultiplier) => {
    const s = stateRef.current
    if (!s || !setMemberAiMultiplier(s, memberId, value)) return
    markCustom()
    forceUpdate(n => n + 1)
  }, [markCustom])

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
    forceUpdate(n => n + 1)
  }, [markCustom])

  const handleAddMember = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    const usedNames = new Set(s.team.map(m => m.name))
    // Pick name from the pool matching the active preset; fall back to generic label
    const namePool = activePresetIdRef.current === 'teams' ? TEAM_NAMES : MEMBER_NAMES
    const name = namePool.find(n => !usedNames.has(n)) ?? `Unit ${s.team.length + 1}`
    const maxId = s.team.reduce((max, m) => Math.max(max, m.id), 0)
    s.team.push({ id: maxId + 1, name, roles: [], currentTask: null, idleSec: 0 })
    markCustom()
    forceUpdate(n => n + 1)
  }, [markCustom])

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
    forceUpdate(n => n + 1)
  }, [markCustom])

  const handleRegenerate = useCallback(() => {
    if (lastFinishedRef.current) setPrevStats(lastFinishedRef.current)
    const { state, rng } = regenerate(settingsRef.current, roleConfigRef.current)
    // Preserve current team names and roles — only reset per-simulation state
    state.team = stateRef.current!.team.map(m => ({ ...m, currentTask: null, idleSec: 0 }))
    stateRef.current = state
    rngRef.current   = rng
    setPaused(true)
    setHasStarted(false)
    forceUpdate(n => n + 1)
  }, [])

  // ── Derived values (experiment mode) ──────────────────────────────────────

  const s = stateRef.current!
  const stats = useMemo(
    () => computeStats(s.leadTimes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.leadTimes.length, s.leadTimes[s.leadTimes.length - 1]?.id],
  )
  const totalTimeDisplay = s.simTime > 0 || s.finished ? formatTime(s.simTime) : '00:00.0'
  const avgWip           = s.simTime > 0.5 ? s.wipIntegral / s.simTime : null

  const calcDelta = (current: number | null, previous: number): number | undefined => {
    if (current === null || previous === 0) return undefined
    return ((current - previous) / previous) * 100
  }
  const ltDelta   = prevStats && stats.count > 0 ? calcDelta(stats.avg, prevStats.avgLt) : undefined
  const wipDelta  = prevStats && avgWip !== null  ? calcDelta(avgWip, prevStats.avgWip)   : undefined
  const timeDelta = prevStats && s.finished       ? calcDelta(s.simTime, prevStats.totalTime) : undefined
  const totalWait = s.team.reduce((sum, m) => sum + m.idleSec, 0)
  const waitDelta = prevStats && s.finished       ? calcDelta(totalWait, prevStats.totalWait) : undefined
  const handoffsDelta = prevStats && stats.count > 0 ? calcDelta(stats.avgHandoffs, prevStats.avgHandoffs) : undefined
  const maxWork = featureMaxWork(s.backlog, s.inProgress)

  // ── Derived values (Cash Flow mode) — same pattern as Advanced above, feat-015 ─────
  const cfState = cf.stateRef.current!
  const cfStats = useMemo(
    () => computeStats(cfState.leadTimes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cfState.leadTimes.length, cfState.leadTimes[cfState.leadTimes.length - 1]?.id],
  )
  const cfTotalTimeDisplay = cfState.simTime > 0 || cfState.finished ? formatTime(cfState.simTime) : '00:00.0'
  const cfAvgWip = cfState.simTime > 0.5 ? cfState.wipIntegral / cfState.simTime : null
  const cfLtDelta = cashFlowPrevStats && cfStats.count > 0 ? calcDelta(cfStats.avg, cashFlowPrevStats.avgLt) : undefined
  const cfWipDelta = cashFlowPrevStats && cfAvgWip !== null ? calcDelta(cfAvgWip, cashFlowPrevStats.avgWip) : undefined
  const cfTimeDelta = cashFlowPrevStats && cfState.finished ? calcDelta(cfState.simTime, cashFlowPrevStats.totalTime) : undefined
  // Time-matched výnos (feat-015 refinement, feat-018): finální totaly nejsou fér porovnatelné
  // mezi běhy různé délky (rychlejší běh přestane sbírat tiky dřív). Po doběhnutí obou běhů se
  // proto velké číslo i delta vyhodnotí ve STEJNÉM čase = kratším ze dvou celkových časů.
  // doneOverflow je zahrnuto stejně jako v cashFlowLastFinishedRef výše — jinak by se výnos
  // podhodnotil u běhů s > 40 dokončenými featurami.
  const cfRevenueComparison = computeRevenueComparison(
    {
      finished: cfState.finished,
      simTime: cfState.simTime,
      totalRevenue: cfState.totalRevenueAllTime,
      // Pole featur se skládá jen po doběhnutí — dřív se nepoužije a render běží ~60× za sekundu
      features: cfState.finished ? [...cfState.done, ...cfState.doneOverflow] : [],
    },
    cashFlowPrevStats,
  )
  // Coordination overhead delta (feat-016) — calcDelta vrací undefined, když předchozí běh
  // měl 0 % (např. přepínač Off), protože procentuální změna z nuly nedává smysl.
  const cfCoordinationDelta = cashFlowPrevStats && cfStats.count > 0
    ? calcDelta(cfStats.coordinationPct, cashFlowPrevStats.coordinationPct)
    : undefined
  const cfMaxWork = featureMaxWork(cfState.backlog, cfState.inProgress)

  /** Uloží naposledy doběhnutý běh jako předchozí (pro delta badge) — stejný krok jako tlačítko Reset. */
  const promoteCashFlowFinishedRun = useCallback(() => {
    if (cashFlowLastFinishedRef.current) setCashFlowPrevStats(cashFlowLastFinishedRef.current)
  }, [])

  /** Wraps cf.handleRegenerate to also promote the last finished run into prevStats first —
   *  mirrors Advanced mode's handleRegenerate, which lives in Simulator.tsx (not the hook)
   *  because run-comparison bookkeeping is coordinated alongside the RAF loop above. */
  const handleCashFlowRegenerate = useCallback(() => {
    promoteCashFlowFinishedRun()
    cf.handleRegenerate()
    setCashFlowPaused(true)
    setCashFlowHasStarted(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cf.handleRegenerate, promoteCashFlowFinishedRun])

  /** Změna křivky výnosu (feat-017). Po doběhnutém běhu hook změnu provede hned a simulaci vrátí na začátek,
   *  proto před tím uložíme doběhnutý běh jako předchozí — jako tlačítko Reset — a delta badge pak srovná
   *  stejný backlog napříč profily. Během běhu hook jen otevře potvrzovací dialog a nic nepromuje. */
  const handleCashFlowRevenueProfileChange = useCallback((profile: RevenueProfile) => {
    if (profile !== cf.revenueProfile && cf.stateRef.current?.finished) promoteCashFlowFinishedRun()
    cf.handleRevenueProfileChange(profile)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cf.revenueProfile, cf.handleRevenueProfileChange, promoteCashFlowFinishedRun])

  /** „Change and reset“ v dialogu změny křivky. Běh mohl doběhnout, zatímco dialog byl otevřený (simulace
   *  za překryvem dál tiká), proto i tady před resetem uložíme doběhnutý běh jako předchozí. */
  const handleCashFlowConfirmRevenueProfile = useCallback(() => {
    promoteCashFlowFinishedRun()
    cf.handleConfirmRevenueProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cf.handleConfirmRevenueProfile, promoteCashFlowFinishedRun])

  // ── Derived values (compare mode) ─────────────────────────────────────────

  const sA = compareStateARef.current!
  const sB = compareStateBRef.current!
  const statsA = useMemo(
    () => computeStats(sA.leadTimes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sA.leadTimes.length, sA.leadTimes[sA.leadTimes.length - 1]?.id],
  )
  const statsB = useMemo(
    () => computeStats(sB.leadTimes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sB.leadTimes.length, sB.leadTimes[sB.leadTimes.length - 1]?.id],
  )

  const bothFinished = sA.finished && sB.finished

  // ── Shared header ──────────────────────────────────────────────────────────

  /** Přepne mód podle kliknuté záložky — každý mód má vlastní přípravu (Compare se resetuje). */
  const handleSelectMode = (next: AppMode) => {
    if (next === 'compare') handleSwitchToCompare()
    else if (next === 'experiment') handleSwitchToExperiment()
    else setMode('cashflow')
  }

  /** Run / Pause v Compare: první kliknutí spustí obě simulace, další je pozastaví a znovu rozběhne. */
  const handleToggleCompareRun = () => {
    setComparePaused(p => !p)
    setCompareHasStarted(true)
  }

  // Tlačítko běhu v Compare: po doběhnutí obou běhů „✓ Done“, jinak Run (před startem pulzuje) / Pause
  const compareRunButton = bothFinished && compareHasStarted ? (
    <Button variant="done" disabled data-tutorial-target="compare-run-button">✓ Done</Button>
  ) : comparePaused ? (
    <Button variant="primary" pulse={!compareHasStarted} onClick={handleToggleCompareRun} data-tutorial-target="compare-run-button">
      ▶ Run
    </Button>
  ) : (
    <Button variant="running" onClick={handleToggleCompareRun} data-tutorial-target="compare-run-button">❙❙ Pause</Button>
  )

  const header = (
    <TopBar mode={mode} onSelectMode={handleSelectMode}>
      {mode === 'cashflow' ? (
        <SpeedControl
          speed={cashFlowSpeed}
          paused={cashFlowPaused}
          hasStarted={cashFlowHasStarted}
          finished={cf.stateRef.current?.finished ?? false}
          onSpeedChange={setCashFlowSpeed}
          onTogglePause={() => { setCashFlowPaused(p => !p); setCashFlowHasStarted(true) }}
          onReset={() => {
            // Promote the last naturally-finished run into prevStats for comparison —
            // same pattern as Advanced mode's handleReset.
            promoteCashFlowFinishedRun()
            if (cf.stateRef.current) resetFromSnapshot(cf.stateRef.current)
            // Dialog změny křivky by se ptal na zahozený běh
            cf.setConfirmingRevenueProfile(null)
            setCashFlowPaused(true)
            setCashFlowHasStarted(false)
            cf.forceUpdate()
          }}
          runButtonTarget="cashflow-run-button"
        />
      ) : mode === 'compare' ? (
        // data-tutorial-target lets the spotlight overlay focus on the compare simulation controls
        <div data-tutorial-target="compare-controls" className={styles.controls}>
          {/* ? Tutorial relaunch — always visible, opens the tutorial for this mode */}
          <Button onBar iconOnly onClick={() => handleTutorialRelaunch('compare')} title="Restart tutorial" aria-label="Restart tutorial">?</Button>
          <Button onBar onClick={handleCompareReset}>↺ Reset</Button>
          {/* Speed selector — 0.5×, 1×, 10× (stejný SegmentedControl jako všude, feat-021 Příklad 8) */}
          <SegmentedControl
            tone="bar"
            options={COMPARE_SPEEDS.map(sp => ({ value: String(sp), label: `${sp}×` }))}
            value={String(compareSpeed)}
            onChange={v => {
              const sp = COMPARE_SPEEDS.find(s => String(s) === v)
              if (sp === undefined) return
              compareSpeedRef.current = sp
              setCompareSpeed(sp)
            }}
          />
          {compareRunButton}
        </div>
      ) : (
        <div className={styles.controls}>
          {/* ? Tutorial relaunch — opens the experiment mode tutorial */}
          <Button onBar iconOnly onClick={() => handleTutorialRelaunch('experiment')} title="Restart tutorial" aria-label="Restart tutorial">?</Button>
          {/* data-tutorial-target lets the spotlight overlay focus on speed/reset controls */}
          <div data-tutorial-target="experiment-controls" className={styles.controls}>
            <SpeedControl
              speed={speed}
              paused={paused}
              hasStarted={hasStarted}
              finished={s.finished}
              onSpeedChange={setSpeed}
              onTogglePause={() => { setPaused(p => !p); setHasStarted(true) }}
              onReset={() => { handleReset(); setPaused(true); setHasStarted(false) }}
              runButtonTarget="experiment-run-button"
            />
          </div>
        </div>
      )}
    </TopBar>
  )

  // ── Compare layout ─────────────────────────────────────────────────────────

  if (mode === 'compare') {
    return (
      <div className={styles.compare}>
        {header}

        {/* Rám výsledku po doběhnutí obou běhů (feat-021, Příklad 9) — kdo byl rychlejší, o kolik a proč */}
        {bothFinished && compareHasStarted && (
          <div className={styles.winner}>
            <WinnerBanner stateA={sA} statsA={statsA} stateB={sB} statsB={statsB} />
          </div>
        )}

        {/* Two-column comparison — each team in its own bordered card */}
        <div className={styles.compareColumns}>
          {/* data-tutorial-target lets the spotlight overlay frame the entire Team A column */}
          <div
            data-tutorial-target="compare-team-a-panel"
            className={styles.teamColumn}
          >
            <ComparePanel
              teamType={compareTypeA}
              onChangeType={t => handleCompareTypeChange('A', t)}
              state={sA}
              stats={statsA}
              opponentStats={statsB}
              opponentState={sB}
              opponentLabel={compareTypeB}
              tutorialTargetPrefix="compare-team-a"
            />
          </div>
          {/* data-tutorial-target lets the spotlight overlay frame the entire Team B column */}
          <div
            data-tutorial-target="compare-team-b-panel"
            className={styles.teamColumn}
          >
            <ComparePanel
              teamType={compareTypeB}
              onChangeType={t => handleCompareTypeChange('B', t)}
              state={sB}
              stats={statsB}
              opponentStats={statsA}
              opponentState={sA}
              opponentLabel={compareTypeA}
              tutorialTargetPrefix="compare-team-b"
            />
          </div>
        </div>

        {/* Tutorial overlay — shown on first visit or when ? is clicked */}
        {showTutorial && (
          <TutorialOverlay mode={tutorialMode} onComplete={handleTutorialComplete} />
        )}
      </div>
    )
  }

  // ── Cash Flow layout — full parity with Advanced (own backlog/team/specializations),
  // plus revenue tracking, minus Total Wait/Avg Handoffs (feat-015) ────────────────────

  if (mode === 'cashflow') {
    return (
      <div className={styles.threeColumns}>
        {header}

        <BacklogSettingsPanel
          state={cfState}
          settings={cf.settings}
          setSettings={cf.setSettings}
          roleConfig={cf.roleConfig}
          activePresetId={cf.activePresetId}
          confirmingPreset={cf.confirmingPreset}
          setConfirmingPreset={cf.setConfirmingPreset}
          showBacklogControls={cf.showBacklogControls}
          setShowBacklogControls={cf.setShowBacklogControls}
          showRoleSettings={cf.showRoleSettings}
          setShowRoleSettings={cf.setShowRoleSettings}
          showTeamSettings={cf.showTeamSettings}
          setShowTeamSettings={cf.setShowTeamSettings}
          importMsg={cf.importMsg}
          fileInputRef={cf.fileInputRef}
          wipMode={cf.wipMode}
          setWipMode={cf.setWipMode}
          maxWork={cfMaxWork}
          handleXlsImport={cf.handleXlsImport}
          handleRegenerate={handleCashFlowRegenerate}
          handlePresetClick={cf.handlePresetClick}
          handleConfirmPreset={cf.handleConfirmPreset}
          handleRoleChange={cf.handleRoleChange}
          handleAddRole={cf.handleAddRole}
          handleDeleteRole={cf.handleDeleteRole}
          tutorialTargetPrefix="cashflow"
          // Badge ukazuje ustálený výnos (feat-017), ke kterému zvolená křivka dospěje
          getRevenueBadge={f => `${formatEuro(plateauRevenuePerTick(f))}/tick`}
          coordinationOverhead={cf.coordinationOverhead}
          setCoordinationOverhead={cf.setCoordinationOverhead}
          coordinationOverheadLocked={cashFlowHasStarted}
          revenueProfile={cf.revenueProfile}
          onRevenueProfileChange={handleCashFlowRevenueProfileChange}
          confirmingRevenueProfile={cf.confirmingRevenueProfile}
          onConfirmRevenueProfile={handleCashFlowConfirmRevenueProfile}
          onCancelRevenueProfile={() => cf.setConfirmingRevenueProfile(null)}
        />

        <InProgressTeamPanel
          state={cfState}
          roleConfig={cf.roleConfig}
          maxWork={cfMaxWork}
          activePresetId={cf.activePresetId}
          handleAssignRole={cf.handleAssignRole}
          handleRemoveRole={cf.handleRemoveRole}
          handleRenameMember={cf.handleRenameMember}
          handleSetAiMultiplier={cf.handleSetAiMultiplier}
          handleRemoveMember={cf.handleRemoveMember}
          handleAddMember={cf.handleAddMember}
          tutorialTargetPrefix="cashflow"
          showCoordination={cf.coordinationOverhead}
        />

        <CashFlowPanel
          state={cfState}
          stats={cfStats}
          totalTimeDisplay={cfTotalTimeDisplay}
          avgWip={cfAvgWip}
          timeDelta={cfTimeDelta}
          ltDelta={cfLtDelta}
          wipDelta={cfWipDelta}
          revenueComparison={cfRevenueComparison}
          showCoordination={cf.coordinationOverhead}
          coordinationDelta={cfCoordinationDelta}
        />
      </div>
    )
  }

  // ── Experiment layout (original 3-column layout, unchanged) ───────────────

  return (
    <div className={styles.threeColumns}>
      {header}

      {/* LEFT: BACKLOG + CONTROLS */}
      <BacklogSettingsPanel
        state={s}
        settings={settings}
        setSettings={setSettings}
        roleConfig={roleConfig}
        activePresetId={activePresetId}
        confirmingPreset={confirmingPreset}
        setConfirmingPreset={setConfirmingPreset}
        showBacklogControls={showBacklogControls}
        setShowBacklogControls={setShowBacklogControls}
        showRoleSettings={showRoleSettings}
        setShowRoleSettings={setShowRoleSettings}
        showTeamSettings={showTeamSettings}
        setShowTeamSettings={setShowTeamSettings}
        importMsg={importMsg}
        fileInputRef={fileInputRef}
        wipMode={wipMode}
        setWipMode={setWipMode}
        maxWork={maxWork}
        handleXlsImport={handleXlsImport}
        handleRegenerate={handleRegenerate}
        handlePresetClick={handlePresetClick}
        handleConfirmPreset={handleConfirmPreset}
        handleRoleChange={handleRoleChange}
        handleAddRole={handleAddRole}
        handleDeleteRole={handleDeleteRole}
        tutorialTargetPrefix="experiment"
      />

      {/* CENTER: IN-PROGRESS + TEAM */}
      <InProgressTeamPanel
        state={s}
        roleConfig={roleConfig}
        maxWork={maxWork}
        activePresetId={activePresetId}
        handleAssignRole={handleAssignRole}
        handleRemoveRole={handleRemoveRole}
        handleRenameMember={handleRenameMember}
        handleSetAiMultiplier={handleSetAiMultiplier}
        handleRemoveMember={handleRemoveMember}
        handleAddMember={handleAddMember}
        tutorialTargetPrefix="experiment"
      />

      {/* RIGHT: LEAD TIME + DONE — data-tutorial-target nechá spotlight tutoriálu zvýraznit celý panel,
          jen dlaždice metrik, nebo jen seznam Done */}
      <ResultsAside
        sampleCount={stats.count}
        doneCount={doneCount(s)}
        isEmpty={s.done.length === 0}
        tutorialTargets={{ aside: 'experiment-chart', metrics: 'experiment-results', done: 'experiment-done' }}
        tiles={<>
          <StatTile label="Total Time" value={totalTimeDisplay} variant="timer" finished={s.finished} wide tooltip="Elapsed simulation time." delta={timeDelta} />
          <StatTile label="Avg Cycle Time" value={stats.count ? stats.avg.toFixed(1) : '—'} unit={stats.count ? 's' : undefined} tooltip="Mean cycle time across all completed features (from work start to delivery)." delta={ltDelta} />
          <StatTile label="Avg WIP" value={avgWip !== null ? avgWip.toFixed(1) : '—'} tooltip="Average Work In Progress — lower usually means lower cycle time (Little's Law)." delta={wipDelta} />
          <StatTile label="Total Wait" value={totalWait > 0 ? totalWait.toFixed(1) : '—'} unit={totalWait > 0 ? 's' : undefined} tooltip="Total idle time across all units with roles." delta={waitDelta} />
          <StatTile label="Avg Handoffs" value={stats.count > 0 ? stats.avgHandoffs.toFixed(1) : '—'} tooltip="Average number of handoffs per feature." delta={handoffsDelta} />
        </>}
      >
        {s.done.map(f => {
          const lt = (f.finishedAt ?? 0) - f.createdAt
          return (
            <DoneRow
              key={f.id}
              hue={f.hue}
              name={f.name}
              detail={`${f.tasks.length} task${f.tasks.length > 1 ? 's' : ''}`}
              value={`${lt.toFixed(1)}s`}
            />
          )
        })}
      </ResultsAside>

      {/* Tutorial overlay — shown on first visit to experiment mode or when ? is clicked */}
      {showTutorial && (
        <TutorialOverlay mode={tutorialMode} onComplete={handleTutorialComplete} />
      )}
    </div>
  )
}
