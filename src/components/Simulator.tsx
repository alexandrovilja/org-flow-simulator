'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { flushSync } from 'react-dom'
import {
  ROLE_META, MEMBER_NAMES, mulberry32,
  makeInitialState, resetFromSnapshot, regenerate, tick, computeStats,
} from '@/simulation/engine'
import type { SimSettings, SimState, Role, RoleMeta, FocusMode, WipMode } from '@/types/simulation'
import { FeatureCard } from '@/components/FeatureCard'
import { MemberCard } from '@/components/MemberCard'
import { RoleSettings } from '@/components/RoleSettings'
import { StatTile } from '@/components/StatTile'
import { Slider } from '@/components/Slider'
import { SpeedControl } from '@/components/SpeedControl'
import { PanelHeader } from '@/components/PanelHeader'
import { SegmentedControl } from '@/components/SegmentedControl'
import { ComparePanel } from '@/components/ComparePanel'
import { formatTime } from '@/lib/formatTime'
import { featureMaxWork } from '@/lib/featureSize'
import { parseXlsFile, downloadTemplate, type ImportResult } from '@/lib/xlsImport'
import { addRole, deleteRole } from '@/simulation/roleManagement'
import {
  makeCompareStates, COMPARE_SETTINGS,
} from '@/simulation/compareMode'
import type { TeamType } from '@/simulation/compareMode'
import { isTutorialCompleted, markTutorialCompleted, hasSeenMode, markModeSeen } from '@/lib/storage'
import { TutorialOverlay } from '@/components/TutorialOverlay'
import type { TutorialMode } from '@/types/tutorial'

// ── Types ────────────────────────────────────────────────────────────────────

/** Application-level mode: Compare shows two teams side-by-side, Experiment is the full sandbox. */
type AppMode = 'compare' | 'experiment'

// ── Experiment mode defaults ─────────────────────────────────────────────────

const DEFAULT_SETTINGS: SimSettings = {
  minBacklog: 0,
  wipLimit: 6,
  sizeVar: 0.4,
  roleVar: 0.5,
  initialBacklog: 100,
  minSpecializations: 1,
}

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

  // ── Experiment mode state ─────────────────────────────────────────────────
  const [settings, setSettings] = useState<SimSettings>(DEFAULT_SETTINGS)
  const [speed, setSpeed]       = useState(1)
  const [paused, setPaused]     = useState(true)
  const [hasStarted, setHasStarted] = useState(false)

  type RunSnapshot = { avgLt: number; avgWip: number; totalTime: number; totalWait: number; avgHandoffs: number }
  const [prevStats, setPrevStats] = useState<RunSnapshot | null>(null)
  const lastFinishedRef = useRef<RunSnapshot | null>(null)

  const [roleConfig, setRoleConfig] = useState<Record<Role, RoleMeta>>(() => ({ ...ROLE_META }))
  const [showRoleSettings, setShowRoleSettings] = useState(false)
  const [showBacklogControls, setShowBacklogControls] = useState(false)
  // Import status message — null = no message, object = show message
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [focusMode, setFocusMode] = useState<FocusMode>('priority')
  const [wipMode, setWipMode]     = useState<WipMode>('priority')

  const focusModeRef = useRef<FocusMode>('priority')
  const wipModeRef   = useRef<WipMode>('priority')
  useEffect(() => { focusModeRef.current = focusMode }, [focusMode])
  useEffect(() => { wipModeRef.current   = wipMode   }, [wipMode])

  const roleConfigRef = useRef(roleConfig)
  useEffect(() => { roleConfigRef.current = roleConfig }, [roleConfig])

  const rngRef      = useRef(mulberry32(42))
  const stateRef    = useRef<SimState | null>(null)
  if (stateRef.current === null) {
    stateRef.current = makeInitialState(rngRef.current, DEFAULT_SETTINGS)
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
      } else {
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
      }

      raf = requestAnimationFrame(step)
    }

    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
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
        setImportMsg({ ok: false, text: err instanceof Error ? err.message : 'Nepodařilo se načíst soubor.' })
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
        team: result.team,
        leadTimes: [],
        simTime: 0,
        wipIntegral: 0,
        lastGenAt: 0,
        startedAt: null,
        finished: false,
      }

      stateRef.current = newState
      setRoleConfig(result.roleConfig)
      setPaused(true)
      setHasStarted(false)
      forceUpdate(n => n + 1)

      const taskCount = result.features.reduce((n, f) => n + f.tasks.length, 0)
      const msg = `Importováno: ${result.features.length} features, ${taskCount} tasků, ${result.team.length} členů týmu.`
      const fullMsg = result.warnings.length > 0 ? `${msg} ${result.warnings.join(' ')}` : msg
      setImportMsg({ ok: true, text: fullMsg })
      setTimeout(() => setImportMsg(null), 4000)

      // Switch to experiment mode if not already there
      setMode('experiment')
    }).catch(() => {
      setImportMsg({ ok: false, text: 'Soubor se nepodařilo přečíst.' })
    })
  }, [])

  const handleReset = useCallback(() => {
    if (lastFinishedRef.current) setPrevStats(lastFinishedRef.current)
    if (stateRef.current) resetFromSnapshot(stateRef.current)
    forceUpdate(n => n + 1)
  }, [])

  const handleRenameMember = useCallback((memberId: number, name: string) => {
    const m = stateRef.current?.team.find(m => m.id === memberId)
    if (m) m.name = name
    forceUpdate(n => n + 1)
  }, [])

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
    forceUpdate(n => n + 1)
  }, [])

  const handleAddMember = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    const usedNames = new Set(s.team.map(m => m.name))
    const name = MEMBER_NAMES.find(n => !usedNames.has(n)) ?? `Unit ${s.team.length + 1}`
    const maxId = s.team.reduce((max, m) => Math.max(max, m.id), 0)
    s.team.push({ id: maxId + 1, name, roles: [], currentTask: null, idleSec: 0 })
    forceUpdate(n => n + 1)
  }, [])

  const handleRoleChange = useCallback((roleId: string, updates: Partial<RoleMeta>) => {
    setRoleConfig(prev => ({ ...prev, [roleId]: { ...prev[roleId], ...updates } }))
  }, [])

  const handleAddRole = useCallback((label: string, color: string) => {
    setRoleConfig(prev => {
      const { roleConfig: next } = addRole(prev, label, color)
      return next
    })
  }, [])

  const handleDeleteRole = useCallback((roleId: string) => {
    const s = stateRef.current
    if (!s) return
    setRoleConfig(prev => {
      const { roleConfig: next } = deleteRole(s, prev, roleId)
      return next
    })
    forceUpdate(n => n + 1)
  }, [])

  const handleRegenerate = useCallback(() => {
    if (lastFinishedRef.current) setPrevStats(lastFinishedRef.current)
    const { state, rng } = regenerate(settingsRef.current, roleConfigRef.current)
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

  const header = (
    <header style={{
      gridColumn: '1 / -1',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px',
      borderBottom: '1px solid var(--line)',
      background: 'var(--panel)',
      height: 52,
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 5,
          background: 'var(--ink)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="3" cy="3" r="1.6" fill="white" />
            <circle cx="11" cy="3" r="1.6" fill="white" />
            <circle cx="7" cy="11" r="1.6" fill="white" />
            <path d="M3 3 L11 3 M3 3 L7 11 M11 3 L7 11" stroke="white" strokeWidth="0.7" />
          </svg>
        </div>
        <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: -0.2 }}>Org Flow Simulator</span>
      </div>

      {/* Mode tabs */}
      <div style={{ display: 'flex', alignItems: 'stretch', height: '100%' }}>
        <button
          onClick={handleSwitchToCompare}
          style={{
            padding: '0 20px', background: 'transparent', border: 'none',
            borderBottom: mode === 'compare' ? '2px solid var(--ink)' : '2px solid transparent',
            cursor: 'pointer', fontSize: 13,
            fontWeight: mode === 'compare' ? 600 : 400,
            color: mode === 'compare' ? 'var(--ink)' : 'var(--ink-3)',
            display: 'flex', alignItems: 'center', gap: 7,
          }}
        >
          ⚖️ Compare
        </button>
        <button
          onClick={handleSwitchToExperiment}
          style={{
            padding: '0 20px', background: 'transparent', border: 'none',
            borderBottom: mode === 'experiment' ? '2px solid var(--ink)' : '2px solid transparent',
            cursor: 'pointer', fontSize: 13,
            fontWeight: mode === 'experiment' ? 600 : 400,
            color: mode === 'experiment' ? 'var(--ink)' : 'var(--ink-3)',
            display: 'flex', alignItems: 'center', gap: 7,
          }}
        >
          🔬 Advanced
        </button>
      </div>

      {/* Controls — differ per mode */}
      {mode === 'compare' ? (
        // data-tutorial-target lets the spotlight overlay focus on the compare simulation controls
        <div data-tutorial-target="compare-controls" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* ? Tutorial relaunch — always visible, opens the tutorial for this mode */}
          <button
            onClick={() => handleTutorialRelaunch('compare')}
            title="Restart tutorial"
            aria-label="Restart tutorial"
            style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '1px solid var(--line-2)', background: 'transparent',
              color: 'var(--ink-3)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >?</button>
          <button
            onClick={handleCompareReset}
            style={{
              padding: '6px 12px', borderRadius: 7,
              background: 'transparent', color: 'var(--ink-2)',
              border: '1px solid var(--line)', fontSize: 12, fontWeight: 500, cursor: 'pointer',
            }}
          >
            ↺ Reset
          </button>
          {/* Speed selector — 0.5×, 1×, 10× */}
          <div style={{ display: 'flex', border: '1px solid var(--line)', borderRadius: 7, overflow: 'hidden' }}>
            {([0.5, 1, 10] as const).map(sp => (
              <button key={sp} onClick={() => { compareSpeedRef.current = sp; setCompareSpeed(sp) }} style={{
                padding: '6px 10px', fontSize: 12, fontWeight: compareSpeed === sp ? 700 : 400,
                background: compareSpeed === sp ? 'var(--line)' : 'transparent',
                color: compareSpeed === sp ? 'var(--ink)' : 'var(--ink-3)',
                border: 'none', cursor: 'pointer',
                borderRight: sp !== 10 ? '1px solid var(--line)' : 'none',
              }}>
                {sp}×
              </button>
            ))}
          </div>
          <button
            data-tutorial-target="compare-run-button"
            onClick={() => {
              setComparePaused(p => !p)
              setCompareHasStarted(true)
            }}
            disabled={bothFinished && compareHasStarted}
            style={{
              padding: '9px 28px', borderRadius: 8, border: 'none',
              background: comparePaused
                ? 'oklch(52% 0.22 150)'
                : 'oklch(58% 0.13 240)',
              color: 'white',
              fontSize: 14, fontWeight: 700, letterSpacing: 0.2,
              cursor: bothFinished && compareHasStarted ? 'default' : 'pointer',
              opacity: bothFinished && compareHasStarted ? 0.4 : 1,
              display: 'flex', alignItems: 'center', gap: 8,
              // Pulse glow before first click draws the eye; stops once simulation has started.
              animation: comparePaused && !compareHasStarted ? 'run-cta-pulse 2s ease-out infinite' : 'none',
              boxShadow: comparePaused ? '0 2px 8px oklch(52% 0.22 150 / 0.35)' : 'none',
              transition: 'background 0.2s, box-shadow 0.2s, opacity 0.2s',
            }}
          >
            {comparePaused ? '▶ Run' : '⏸ Pause'}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* ? Tutorial relaunch — opens the experiment mode tutorial */}
          <button
            onClick={() => handleTutorialRelaunch('experiment')}
            title="Restart tutorial"
            aria-label="Restart tutorial"
            style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '1px solid var(--line-2)', background: 'transparent',
              color: 'var(--ink-3)', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >?</button>
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            sim t = {s.simTime.toFixed(1)}s
          </span>
          {/* data-tutorial-target lets the spotlight overlay focus on speed/reset controls */}
          <div data-tutorial-target="experiment-controls">
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
    </header>
  )

  // ── Compare layout ─────────────────────────────────────────────────────────

  if (mode === 'compare') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
        {header}

        {/* Identical backlog badge — reassures the user both teams process the same work */}
        <div
          data-tutorial-target="compare-backlog-badge"
          style={{
            margin: '4px 16px 0',
            display: 'flex', justifyContent: 'center',
          }}
        >
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 11, color: 'var(--ink-3)',
            background: 'var(--panel)',
            border: '1px solid var(--line)',
            borderRadius: 20, padding: '2px 10px',
          }}>
            {/* = symbol signals equality of the two backlogs */}
            <span style={{ fontWeight: 700 }}>⇌</span>
            Identical backlog · {sA.backlog.length + sA.inProgress.length + sA.done.length} items
          </span>
        </div>

        {/* Two-column comparison — each team in its own bordered card */}
        <div
          style={{
            flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: 12,
            margin: '8px 16px 16px',
            minHeight: 0,
          }}
        >
          {/* data-tutorial-target lets the spotlight overlay frame the entire Team A column */}
          <div
            data-tutorial-target="compare-team-a-panel"
            style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--panel)' }}
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
            style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid var(--line)', background: 'var(--panel)' }}
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

  // ── Experiment layout (original 3-column layout, unchanged) ───────────────

  return (
    <div style={{
      height: '100vh',
      display: 'grid',
      gridTemplateColumns: '320px 1fr 280px',
      gridTemplateRows: 'auto 1fr',
      gap: 0,
      background: 'var(--bg)',
    }}>
      {header}

      {/* LEFT: BACKLOG + CONTROLS */}
      {/* data-tutorial-target lets the tutorial overlay spotlight the backlog panel */}
      <section data-tutorial-target="experiment-backlog" style={{ borderRight: '1px solid var(--line)', background: 'var(--panel)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ flex: '1 1 50%', minHeight: 0, display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--line)' }}>
          <PanelHeader title="Backlog" count={s.backlog.length} />
          <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {s.backlog.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic', padding: '8px 4px' }}>No items waiting.</div>
            )}
            {s.backlog.map(f => <FeatureCard key={f.id} feature={f} compact neutral maxWork={maxWork} roleConfig={roleConfig} />)}
          </div>
        </div>

        {/* data-tutorial-target lets the spotlight cover backlog generation + specialization controls */}
        <div data-tutorial-target="experiment-settings" style={{ flex: '0 0 auto', padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--panel)' }}>
          <h3 style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-2)' }}>Controls</h3>

          {/* Hidden file input — triggered by the Import button below */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) handleXlsImport(file)
              // Reset input so the same file can be re-imported
              e.target.value = ''
            }}
          />

          <div style={{ paddingTop: 4, borderTop: '1px solid var(--line)', marginTop: 4 }}>
            <button
              onClick={() => setShowBacklogControls(v => !v)}
              style={{
                width: '100%', textAlign: 'left',
                fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
                border: '1px solid var(--line)', borderRadius: 4,
                padding: '4px 8px',
                background: showBacklogControls ? 'var(--line)' : 'var(--bg)',
                color: showBacklogControls ? 'var(--ink)' : 'var(--ink-2)',
                fontWeight: showBacklogControls ? 600 : 400,
              }}
            >
              ♻ Backlog generation
            </button>
            {showBacklogControls && (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      flex: 1, border: '1px solid var(--ink-2)', borderRadius: 4,
                      padding: '6px 0', fontSize: 11, fontWeight: 600,
                      background: 'var(--bg)', color: 'var(--ink)',
                      cursor: 'pointer', letterSpacing: 0.2,
                    }}
                  >
                    ↑ Import XLS
                  </button>
                  <button
                    onClick={downloadTemplate}
                    style={{
                      flex: 1, border: '1px solid var(--line)', borderRadius: 4,
                      padding: '6px 0', fontSize: 11, fontWeight: 400,
                      background: 'var(--bg)', color: 'var(--ink-2)',
                      cursor: 'pointer', letterSpacing: 0.2,
                    }}
                  >
                    ↓ Šablona
                  </button>
                </div>

                {importMsg && (
                  <div style={{
                    fontSize: 11, padding: '5px 8px', borderRadius: 4,
                    background: importMsg.ok ? 'oklch(95% 0.05 145)' : 'oklch(95% 0.05 25)',
                    color: importMsg.ok ? 'oklch(35% 0.13 145)' : 'oklch(35% 0.13 25)',
                    border: `1px solid ${importMsg.ok ? 'oklch(75% 0.1 145)' : 'oklch(75% 0.1 25)'}`,
                    lineHeight: 1.4,
                  }}>
                    {importMsg.ok ? '✓' : '✗'} {importMsg.text}
                  </div>
                )}

                <button onClick={handleRegenerate} style={{
                  background: 'var(--ink)', border: 'none', borderRadius: 4,
                  padding: '7px 0', fontSize: 11, fontWeight: 600, color: 'white',
                  cursor: 'pointer', width: '100%', letterSpacing: 0.2,
                }}>
                  ♻ Generate new backlog
                </button>
                <Slider label="Backlog size" value={settings.initialBacklog} min={10} max={1000} step={10}
                  onChange={v => setSettings(s => ({ ...s, initialBacklog: v }))}
                  format={v => `${v} items`}
                  tooltip="Number of features generated when clicking 'Generate new backlog'." />
                <Slider label="Min. specializations per item" value={settings.minSpecializations} min={1} max={6} step={1}
                  onChange={v => setSettings(s => ({ ...s, minSpecializations: v }))}
                  format={v => v === 1 ? 'no minimum' : `≥ ${v} roles`}
                  tooltip="Minimum number of different specializations each backlog item must require." />
                <Slider label="Item size variability" value={settings.sizeVar} min={0} max={1} step={0.05}
                  onChange={v => setSettings(s => ({ ...s, sizeVar: v }))}
                  format={v => v < 0.1 ? 'uniform' : v < 0.5 ? 'low' : v < 0.85 ? 'high' : 'extreme'}
                  tooltip="How much effort varies between items." />
                <Slider label="Role-mix variability" value={settings.roleVar} min={0} max={1} step={0.05}
                  onChange={v => setSettings(s => ({ ...s, roleVar: v }))}
                  format={v => v < 0.1 ? '2 roles' : v < 0.5 ? 'low' : v < 0.85 ? 'high' : '1–6 roles'}
                  tooltip="How many different roles each item requires." />
              </div>
            )}
          </div>
          <div style={{ paddingTop: 8, borderTop: '1px solid var(--line)', marginTop: 4 }}>
            <button
              onClick={() => setShowRoleSettings(v => !v)}
              style={{
                width: '100%', textAlign: 'left',
                fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
                border: '1px solid var(--line)', borderRadius: 4,
                padding: '4px 8px',
                background: showRoleSettings ? 'var(--line)' : 'var(--bg)',
                color: showRoleSettings ? 'var(--ink)' : 'var(--ink-2)',
                fontWeight: showRoleSettings ? 600 : 400,
              }}
            >
              ⚙ Specializations
            </button>
            {showRoleSettings && (
              <div style={{ marginTop: 8 }}>
                <RoleSettings roleConfig={roleConfig} onChange={handleRoleChange} onAdd={handleAddRole} onDelete={handleDeleteRole} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CENTER: IN-PROGRESS + TEAM */}
      {/* data-tutorial-target lets the tutorial spotlight the team configuration area */}
      <section data-tutorial-target="experiment-team" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, background: 'var(--bg)' }}>
        {/* data-tutorial-target lets the spotlight cover only the in-progress kanban panel */}
        <div data-tutorial-target="experiment-in-progress" style={{ borderBottom: '1px solid var(--line)', background: 'var(--panel)', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <PanelHeader title="In Progress" count={s.inProgress.length} hint="auto-scaled" />
          <div style={{
            padding: '8px 16px 14px 16px',
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 8, overflowY: 'auto', minHeight: 64, alignContent: 'start',
          }}>
            {s.inProgress.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic', gridColumn: '1 / -1' }}>Nothing in flight.</div>
            )}
            {s.inProgress.map(f => <FeatureCard key={f.id} feature={f} team={s.team} maxWork={maxWork} roleConfig={roleConfig} />)}
          </div>
        </div>

        {/* data-tutorial-target lets the spotlight cover team member cards + add/remove controls */}
        <div data-tutorial-target="experiment-team-composition" style={{ flex: '0 0 auto', padding: '10px 16px 12px', background: 'var(--panel)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'nowrap', overflow: 'hidden' }}>
            <h3 style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-2)', flexShrink: 0 }}>
              Units <span className="mono" style={{ color: 'var(--ink-3)', fontWeight: 500 }}>{s.team.length}</span>
            </h3>
            <SegmentedControl
              options={[
                { value: 'priority' as FocusMode, label: 'Priority' },
                { value: 'continuity' as FocusMode, label: 'Continuity' },
              ]}
              value={focusMode} onChange={setFocusMode}
              hint={focusMode === 'priority'
                ? 'Focus: units always pick the highest-priority feature available.'
                : 'Focus: units prefer to finish what they started — reduces handoffs.'}
            />
            <SegmentedControl
              options={[
                { value: 'priority' as WipMode, label: 'Priority' },
                { value: 'reduce-wip' as WipMode, label: 'Reduce WIP' },
              ]}
              value={wipMode} onChange={setWipMode}
              hint={wipMode === 'priority'
                ? 'WIP: units can start new features freely based on priority.'
                : 'WIP: units finish in-progress features before pulling new ones.'}
            />
            <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-3)', flexShrink: 0 }}>
              Click <span className="mono" style={{ color: 'var(--ink-2)' }}>+</span> to add a specialty
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridAutoRows: 'min-content', gap: 6, alignContent: 'start' }}>
            {s.team.map(m => {
              let cf = null, ct = null
              if (m.currentTask) {
                cf = s.inProgress.find(f => f.id === m.currentTask!.featureId) ?? null
                ct = cf?.tasks.find(t => t.id === m.currentTask!.taskId) ?? null
              }
              return (
                <MemberCard key={m.id} member={m} currentFeature={cf ?? null} currentTask={ct ?? null}
                  roleConfig={roleConfig} onAddRole={handleAssignRole} onRemoveRole={handleRemoveRole}
                  onRename={handleRenameMember} onRemove={handleRemoveMember} />
              )
            })}
          </div>
          <button onClick={handleAddMember} style={{
            marginTop: 2, width: '100%', padding: '5px 0',
            fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
            border: '1px dashed var(--line-2)', borderRadius: 4,
            background: 'transparent', color: 'var(--ink-3)', fontWeight: 500, letterSpacing: 0.3,
          }}>
            + Add unit
          </button>
        </div>
      </section>

      {/* RIGHT: LEAD TIME + DONE */}
      {/* data-tutorial-target lets the tutorial spotlight the metrics and chart area */}
      <aside data-tutorial-target="experiment-chart" style={{ borderLeft: '1px solid var(--line)', background: 'var(--panel)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* data-tutorial-target lets the spotlight cover the stats/metrics tiles only */}
        <div data-tutorial-target="experiment-results" style={{ padding: '12px 14px 14px', borderBottom: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-2)' }}>Cycle Time</h3>
            <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{stats.count} feature{stats.count !== 1 ? 's' : ''} sampled</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
            <StatTile label="Total Time" value={totalTimeDisplay} variant="timer" finished={s.finished} wide tooltip="Elapsed simulation time." delta={timeDelta} />
            <StatTile label="Avg Cycle Time" value={stats.count ? stats.avg.toFixed(1) : '—'} unit={stats.count ? 's' : undefined} tooltip="Mean cycle time across all completed features (from work start to delivery)." delta={ltDelta} />
            <StatTile label="Avg WIP" value={avgWip !== null ? avgWip.toFixed(1) : '—'} tooltip="Average Work In Progress — lower usually means lower cycle time (Little's Law)." delta={wipDelta} />
            <StatTile label="Total Wait" value={totalWait > 0 ? totalWait.toFixed(1) : '—'} unit={totalWait > 0 ? 's' : undefined} tooltip="Total idle time across all units with roles." delta={waitDelta} />
            <StatTile label="Avg Handoffs" value={stats.count > 0 ? stats.avgHandoffs.toFixed(1) : '—'} tooltip="Average number of handoffs per feature." delta={handoffsDelta} />
          </div>
        </div>

        {/* data-tutorial-target lets the spotlight cover the done list only */}
        <div data-tutorial-target="experiment-done" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <PanelHeader title="Done" count={s.done.length} />
          <div style={{ flex: 1, overflow: 'auto', padding: '6px 14px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {s.done.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic', padding: '8px 0' }}>No completed features yet.</div>
            )}
            {s.done.map(f => {
              const lt = (f.finishedAt ?? 0) - f.createdAt
              return (
                <div key={f.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
                  background: `oklch(96% 0.03 ${f.hue})`,
                  border: `1px solid oklch(82% 0.06 ${f.hue})`,
                  borderRadius: 5,
                }}>
                  <span style={{ width: 4, alignSelf: 'stretch', background: `oklch(60% 0.14 ${f.hue})`, borderRadius: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                    <div style={{ fontSize: 9, color: 'var(--ink-3)' }}>{f.tasks.length} task{f.tasks.length > 1 ? 's' : ''}</div>
                  </div>
                  <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--done)' }}>{lt.toFixed(1)}s</span>
                </div>
              )
            })}
          </div>
        </div>
      </aside>

      {/* Tutorial overlay — shown on first visit to experiment mode or when ? is clicked */}
      {showTutorial && (
        <TutorialOverlay mode={tutorialMode} onComplete={handleTutorialComplete} />
      )}
    </div>
  )
}
