'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  ROLES, ROLE_META, mulberry32,
  makeInitialState, resetFromSnapshot, regenerate, tick, computeStats,
} from '@/simulation/engine'
import type { SimSettings, SimState, Role } from '@/types/simulation'
import { FeatureCard } from '@/components/FeatureCard'
import { MemberCard } from '@/components/MemberCard'
import { StatTile } from '@/components/StatTile'
import { Slider } from '@/components/Slider'
import { SpeedControl } from '@/components/SpeedControl'
import { PanelHeader } from '@/components/PanelHeader'
import { formatTime } from '@/lib/formatTime'

const DEFAULT_SETTINGS: SimSettings = {
  minBacklog: 0,
  wipLimit: 6,
  sizeVar: 0.4,
  roleVar: 0.5,
  initialBacklog: 100,
}

export function Simulator() {
  const [settings, setSettings] = useState<SimSettings>(DEFAULT_SETTINGS)
  const [speed, setSpeed] = useState(1)
  const [paused, setPaused] = useState(true)
  const [hasStarted, setHasStarted] = useState(false)
  const [, forceUpdate] = useState(0)

  /** Statistiky posledního dokončeného běhu — slouží pro srovnání s aktuálním během.
   *  Nastavuje se při kliknutí na "Reset stats", kdy uživatel zahajuje nový běh. */
  const [prevStats, setPrevStats] = useState<{ avgLt: number; avgWip: number } | null>(null)

  const rngRef = useRef(mulberry32(42))
  const stateRef = useRef<SimState | null>(null)
  if (stateRef.current === null) {
    stateRef.current = makeInitialState(rngRef.current, DEFAULT_SETTINGS)
  }
  const settingsRef = useRef(settings)
  const speedRef = useRef(speed)
  const pausedRef = useRef(paused)

  useEffect(() => { settingsRef.current = settings }, [settings])
  useEffect(() => { speedRef.current = speed }, [speed])
  useEffect(() => { pausedRef.current = paused }, [paused])

  useEffect(() => {
    let raf: number
    let lastT = performance.now()
    const step = (t: number) => {
      const dtMs = Math.min(100, t - lastT)
      lastT = t
      if (!pausedRef.current && stateRef.current) {
        const state = stateRef.current
        if (!state.finished) {
          const dtSim = dtMs / 1000 * speedRef.current
          tick(state, dtSim, settingsRef.current, rngRef.current)
          if (state.finished) {
            setPaused(true)
          }
        }
      }
      forceUpdate(n => (n + 1) & 0xFFFF)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

  const handleAddRole = useCallback((memberId: number, role: Role) => {
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
          t.status = 'todo'
          t.assignee = null
          t.progress = 0
          m.currentTask = null
        }
      }
    }
    forceUpdate(n => n + 1)
  }, [])

  const handleReset = useCallback(() => {
    if (stateRef.current) resetFromSnapshot(stateRef.current)
    forceUpdate(n => n + 1)
  }, [])

  const handleRegenerate = useCallback(() => {
    const { state, rng } = regenerate(settingsRef.current)
    stateRef.current = state
    rngRef.current = rng
    // Nový backlog = nový experiment — srovnání s předchozím během by bylo zavádějící
    setPrevStats(null)
    setPaused(true)
    setHasStarted(false)
    forceUpdate(n => n + 1)
  }, [])

  const s = stateRef.current!
  const stats = useMemo(
    () => computeStats(s.leadTimes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [s.leadTimes.length, s.leadTimes[s.leadTimes.length - 1]?.id],
  )

  const handleResetStats = useCallback(() => {
    const state = stateRef.current
    if (!state) return

    // Uložíme statistiky aktuálního běhu jako referenci pro srovnání s dalším během.
    // Ukládáme jen pokud jsou data k dispozici — první běh bez předchůdce by neměl nic srovnávat.
    const currentAvgLt = stats.count > 0 ? stats.avg : 0
    const currentAvgWip = state.simTime > 0.5 ? state.wipIntegral / state.simTime : 0
    if (stats.count > 0) {
      setPrevStats({ avgLt: currentAvgLt, avgWip: currentAvgWip })
    }

    state.leadTimes = []
    state.finished = false
    state.simTime = 0
    state.wipIntegral = 0
    // Reset startedAt aby tick() správně zaznamenal čas příštího spuštění
    state.startedAt = null
    setPaused(true)
    setHasStarted(false)
    forceUpdate(n => n + 1)
  }, [stats])

  const totalTimeDisplay = s.simTime > 0 || s.finished ? formatTime(s.simTime) : '00:00.0'

  // Výpočet průměrného WIP pro aktuální běh
  const avgWip = s.simTime > 0.5 ? s.wipIntegral / s.simTime : null

  /**
   * Vypočítá procentuální změnu oproti předchozímu běhu.
   * Vrátí undefined pokud není předchozí běh k dispozici nebo aktuální hodnota chybí.
   * @param current - Aktuální hodnota metriky (nebo null pokud ještě není k dispozici)
   * @param previous - Hodnota z předchozího běhu
   */
  const calcDelta = (current: number | null, previous: number): number | undefined => {
    if (current === null || previous === 0) return undefined
    return ((current - previous) / previous) * 100
  }

  const ltDelta = prevStats && stats.count > 0
    ? calcDelta(stats.avg, prevStats.avgLt)
    : undefined

  const wipDelta = prevStats && avgWip !== null
    ? calcDelta(avgWip, prevStats.avgWip)
    : undefined

  return (
    <div style={{
      height: '100vh',
      display: 'grid',
      gridTemplateColumns: '320px 1fr 280px',
      gridTemplateRows: 'auto 1fr',
      gap: 0,
      background: 'var(--bg)',
    }}>
      {/* TOP BAR */}
      <header style={{
        gridColumn: '1 / 4',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px',
        borderBottom: '1px solid var(--line)',
        background: 'var(--panel)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <span style={{ fontWeight: 700, fontSize: 14, letterSpacing: -0.2 }}>Org Flow Simulator</span>
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
              Same backlog, different team structure — visible Lead time difference
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            sim t = {s.simTime.toFixed(1)}s
          </span>
          <SpeedControl
            speed={speed}
            paused={paused}
            hasStarted={hasStarted}
            finished={s.finished}
            onSpeedChange={setSpeed}
            onTogglePause={() => { setPaused(p => !p); setHasStarted(true) }}
            onReset={() => { handleReset(); setPaused(true); setHasStarted(false) }}
          />
        </div>
      </header>

      {/* LEFT: BACKLOG + CONTROLS */}
      <section style={{ borderRight: '1px solid var(--line)', background: 'var(--panel)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ flex: '1 1 50%', minHeight: 0, display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--line)' }}>
          <PanelHeader title="Backlog" count={s.backlog.length} />
          <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {s.backlog.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic', padding: '8px 4px' }}>No items waiting.</div>
            )}
            {s.backlog.map(f => <FeatureCard key={f.id} feature={f} compact neutral />)}
          </div>
        </div>

        <div style={{ flex: '0 0 auto', padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--panel)' }}>
          <h3 style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-2)' }}>Controls</h3>
          <Slider
            label="Backlog size (on regenerate)"
            value={settings.initialBacklog}
            min={10} max={1000} step={10}
            onChange={v => setSettings(s => ({ ...s, initialBacklog: v }))}
            format={v => `${v} items`}
          />
          <button onClick={handleRegenerate} style={{
            background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 4,
            padding: '5px 10px', fontSize: 11, fontWeight: 500, color: 'var(--ink-2)',
            cursor: 'pointer', alignSelf: 'flex-start',
          }} title="Generate a fresh backlog using the current size & variability settings">
            ♻ Generate new backlog
          </button>
          <Slider
            label="Item size variability"
            value={settings.sizeVar}
            min={0} max={1} step={0.05}
            onChange={v => setSettings(s => ({ ...s, sizeVar: v }))}
            format={v => v < 0.1 ? 'uniform' : v < 0.5 ? 'low' : v < 0.85 ? 'high' : 'extreme'}
          />
          <Slider
            label="Role-mix variability"
            value={settings.roleVar}
            min={0} max={1} step={0.05}
            onChange={v => setSettings(s => ({ ...s, roleVar: v }))}
            format={v => v < 0.1 ? '2 roles' : v < 0.5 ? 'low' : v < 0.85 ? 'high' : '1–6 roles'}
          />
          <div style={{ paddingTop: 4, borderTop: '1px solid var(--line)', display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {ROLES.map(r => (
              <div key={r} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--ink-2)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: ROLE_META[r].color }} />
                {ROLE_META[r].label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CENTER: IN-PROGRESS + TEAM */}
      <section style={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, background: 'var(--bg)' }}>
        <div style={{ borderBottom: '1px solid var(--line)', background: 'var(--panel)', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <PanelHeader title="In Progress" count={s.inProgress.length} hint="auto-scaled" />
          <div style={{
            padding: '8px 16px 14px 16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 8, overflowY: 'auto', minHeight: 64, alignContent: 'start',
          }}>
            {s.inProgress.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic', gridColumn: '1 / -1' }}>Nothing in flight.</div>
            )}
            {s.inProgress.map(f => <FeatureCard key={f.id} feature={f} team={s.team} />)}
          </div>
        </div>

        <div style={{ flex: '0 0 auto', padding: '10px 16px 12px', background: 'var(--panel)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexShrink: 0 }}>
            <h3 style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-2)' }}>
              Team <span className="mono" style={{ color: 'var(--ink-3)', fontWeight: 500 }}>{s.team.length}</span>
            </h3>
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
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
                <MemberCard
                  key={m.id}
                  member={m}
                  currentFeature={cf ?? null}
                  currentTask={ct ?? null}
                  onAddRole={handleAddRole}
                  onRemoveRole={handleRemoveRole}
                />
              )
            })}
          </div>
        </div>
      </section>

      {/* RIGHT: LEAD TIME + DONE */}
      <aside style={{ borderLeft: '1px solid var(--line)', background: 'var(--panel)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '12px 14px 14px', borderBottom: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-2)' }}>
              Lead Time
            </h3>
            <button onClick={handleResetStats} disabled={stats.count === 0} style={{
              background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 4,
              padding: '3px 8px', fontSize: 10, fontWeight: 500,
              color: stats.count === 0 ? 'var(--ink-3)' : 'var(--ink-2)',
              cursor: stats.count === 0 ? 'default' : 'pointer',
              opacity: stats.count === 0 ? 0.5 : 1,
            }} title="Clear lead time history (keep simulation running)">
              ↺ Reset stats
            </button>
          </div>
          <span style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: -6 }}>
            From backlog → done · {stats.count} feature{stats.count !== 1 ? 's' : ''} sampled
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
            <StatTile
              label="Total Time"
              value={totalTimeDisplay}
              variant="timer"
              finished={s.finished}
              wide
              tooltip="Elapsed simulation time. Stops when the last backlog item is done."
            />
            <StatTile
              label="Avg Lead Time"
              value={stats.count ? stats.avg.toFixed(1) : '—'}
              unit={stats.count ? 's' : undefined}
              tooltip="Mean lead time across all completed features."
              delta={ltDelta}
            />
            <StatTile
              label="Avg WIP"
              value={avgWip !== null ? avgWip.toFixed(1) : '—'}
              tooltip="Average Work In Progress — lower usually means lower lead time (Little's Law)."
              delta={wipDelta}
            />
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <PanelHeader title="Done" count={s.done.length} />
          <div style={{ flex: 1, overflow: 'auto', padding: '6px 14px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {s.done.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic', padding: '8px 0' }}>No completed features yet.</div>
            )}
            {s.done.map(f => {
              const lt = (f.finishedAt ?? 0) - f.createdAt
              return (
                <div key={f.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 8px',
                  background: `oklch(96% 0.03 ${f.hue})`,
                  border: `1px solid oklch(82% 0.06 ${f.hue})`,
                  borderRadius: 5,
                }}>
                  <span style={{ width: 4, alignSelf: 'stretch', background: `oklch(60% 0.14 ${f.hue})`, borderRadius: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {f.name}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--ink-3)' }}>
                      {f.tasks.length} task{f.tasks.length > 1 ? 's' : ''}
                    </div>
                  </div>
                  <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: 'var(--done)' }}>
                    {lt.toFixed(1)}s
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </aside>
    </div>
  )
}
