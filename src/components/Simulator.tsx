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
import { formatTime } from '@/lib/formatTime'
import { featureMaxWork } from '@/lib/featureSize'
import { addRole, deleteRole } from '@/simulation/roleManagement'

const DEFAULT_SETTINGS: SimSettings = {
  minBacklog: 0,
  wipLimit: 6,
  sizeVar: 0.4,
  roleVar: 0.5,
  initialBacklog: 100,
  minSpecializations: 1,
}

export function Simulator() {
  const [settings, setSettings] = useState<SimSettings>(DEFAULT_SETTINGS)
  const [speed, setSpeed] = useState(1)
  const [paused, setPaused] = useState(true)
  const [hasStarted, setHasStarted] = useState(false)
  const [, forceUpdate] = useState(0)

  /** Snapshot statistik jednoho dokončeného běhu — slouží pro delta výpočty. */
  type RunSnapshot = { avgLt: number; avgWip: number; totalTime: number; totalWait: number; avgHandoffs: number }

  /** Statistiky posledního dokončeného běhu — slouží pro srovnání s aktuálním během. */
  const [prevStats, setPrevStats] = useState<RunSnapshot | null>(null)
  /**
   * Statistiky právě dokončeného běhu — uložené při konci simulace.
   * Propagují se do prevStats až při startu nového běhu (reset/regenerate),
   * aby delta zůstala viditelná i po dokončení aktuálního běhu.
   */
  const lastFinishedRef = useRef<RunSnapshot | null>(null)

  /** Konfigurace specializací — kopie ROLE_META, upravitelná uživatelem.
   *  Předává se do engine funkcí (tick, makeInitialState, regenerate). */
  const [roleConfig, setRoleConfig] = useState<Record<Role, RoleMeta>>(() => ({ ...ROLE_META }))
  /** Viditelnost panelu Specializations — výchozí stav skrytý. */
  const [showRoleSettings, setShowRoleSettings] = useState(false)

  /** Režim přiřazování — zda členové preferují vlastní feature nebo nejvyšší prioritu. */
  const [focusMode, setFocusMode] = useState<FocusMode>('priority')
  /** Ref pro přístup k focusMode uvnitř RAF smyčky. */
  const focusModeRef = useRef<FocusMode>('priority')
  useEffect(() => { focusModeRef.current = focusMode }, [focusMode])

  /** Režim WIP — zda členové preferují in-progress features nebo vybírají dle priority. */
  const [wipMode, setWipMode] = useState<WipMode>('priority')
  /** Ref pro přístup k wipMode uvnitř RAF smyčky. */
  const wipModeRef = useRef<WipMode>('priority')
  useEffect(() => { wipModeRef.current = wipMode }, [wipMode])
  /** Ref pro přístup k roleConfig uvnitř RAF smyčky bez potřeby restartovat effect. */
  const roleConfigRef = useRef(roleConfig)
  useEffect(() => { roleConfigRef.current = roleConfig }, [roleConfig])

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
    let accumulated = 0
    // Cílový krok simulace v ms — odpovídá jednomu snímku při 60 fps (≈ 16.67 ms).
    // Fixed-timestep accumulator: reálný elapsed čas se hromadí v `accumulated`
    // a spotřebovává se v krocích TARGET_DT_MS. Díky tomu:
    //   • výsledky jsou deterministické (dtSim je vždy stejný)
    //   • simulace běží stejně rychle na 60 Hz i 120 Hz monitorech
    //   • na pomalejších displejích (<60 fps) se provede více ticků na snímek
    //     (catch-up), takže sim-čas drží krok s reálným časem
    const TARGET_DT_MS = 1000 / 60

    const step = (t: number) => {
      // Cap 100 ms chrání před "spiral of death" po přepnutí tabu nebo resize okna,
      // kdy by jinak jeden snímek mohl simulovat sekundy najednou.
      const elapsed = Math.min(100, t - lastT)
      lastT = t

      if (!pausedRef.current && stateRef.current) {
        const state = stateRef.current
        if (!state.finished) {
          // Speed škáluje accumulated čas, NE velikost dtSim.
          // Díky tomu dtSim zůstává konstantní (TARGET_DT_MS/1000) bez ohledu
          // na rychlost simulace — engine vždy dostane stejně velký krok a výsledky
          // jsou deterministické při speed=1 i speed=10 (nebo jakémkoli jiném).
          accumulated += elapsed * speedRef.current
          // Spotřebujeme nahromaděný čas v pevných krocích — každý tick má stejný dtSim.
          while (accumulated >= TARGET_DT_MS && !state.finished) {
            const dtSim = TARGET_DT_MS / 1000   // konstantní, nezávisí na speed
            tick(state, dtSim, settingsRef.current, rngRef.current, roleConfigRef.current, focusModeRef.current, wipModeRef.current)
            accumulated -= TARGET_DT_MS
          }
          if (state.finished) {
            setPaused(true)
            // Simulace právě doběhla — uložíme statistiky do lastFinishedRef.
            // Do prevStats je nepropagujeme hned, aby delta zůstala viditelná
            // i po skončení běhu. Propagace proběhne až při startu nového běhu.
            const finishedStats = computeStats(state.leadTimes)
            const finishedAvgWip = state.simTime > 0.5 ? state.wipIntegral / state.simTime : 0
            if (finishedStats.count > 0) {
              const finishedTotalWait = state.team.reduce((sum, m) => sum + m.idleSec, 0)
              lastFinishedRef.current = { avgLt: finishedStats.avg, avgWip: finishedAvgWip, totalTime: state.simTime, totalWait: finishedTotalWait, avgHandoffs: finishedStats.avgHandoffs }
            }
          }
        }
        // flushSync zajistí synchronní render PŘED koncem RAF callbacku.
        // Bez toho React 18 (Concurrent Mode) plánuje render přes MessageChannel,
        // který může přijít AŽ po dalším RAF → snímky se slučují → viditelná přerušovanost.
        flushSync(() => { forceUpdate(n => (n + 1) & 0xFFFF) })
      } else {
        // Při pauze zahodíme nahromaděný čas — při obnovení simulace nechceme
        // skokové dohnání celé pauzy (burst ticků najednou).
        accumulated = 0
      }

      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])

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
    if (lastFinishedRef.current) setPrevStats(lastFinishedRef.current)
    if (stateRef.current) resetFromSnapshot(stateRef.current)
    forceUpdate(n => n + 1)
  }, [])

  /** Přejmenuje jednotku. Změna se projeví okamžitě v UI. */
  const handleRenameMember = useCallback((memberId: number, name: string) => {
    const m = stateRef.current?.team.find(m => m.id === memberId)
    if (m) m.name = name
    forceUpdate(n => n + 1)
  }, [])

  /**
   * Odebere jednotku z týmu.
   * Pokud právě pracuje na úkolu, úkol se vrátí do stavu 'todo'
   * a zůstane ve feature pro přiřazení jinému členovi.
   */
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

  /**
   * Přidá novou jednotku bez rolí.
   * Jméno se vybere z MEMBER_NAMES podle počtu existujících členů,
   * nebo "Unit N" pokud jsou všechna jména obsazena.
   */
  const handleAddMember = useCallback(() => {
    const s = stateRef.current
    if (!s) return
    const usedNames = new Set(s.team.map(m => m.name))
    const name = MEMBER_NAMES.find(n => !usedNames.has(n))
      ?? `Unit ${s.team.length + 1}`
    const maxId = s.team.reduce((max, m) => Math.max(max, m.id), 0)
    s.team.push({ id: maxId + 1, name, roles: [], currentTask: null, idleSec: 0 })
    forceUpdate(n => n + 1)
  }, [])

  /**
   * Aktualizuje konfiguraci jedné specializace.
   * Změny label, color a level se projeví okamžitě (při příštím ticku).
   * Změna required se projeví při příštím generování backlogu.
   */
  const handleRoleChange = useCallback((roleId: string, updates: Partial<RoleMeta>) => {
    setRoleConfig(prev => ({
      ...prev,
      [roleId]: { ...prev[roleId], ...updates },
    }))
  }, [])

  /**
   * Přidá novou specializaci do konfigurace.
   * Nová specializace se okamžitě zobrazí v pickerech MemberCard.
   * Vliv na backlog se projeví až při příštím generování.
   */
  const handleAddRole = useCallback((label: string, color: string) => {
    setRoleConfig(prev => {
      const { roleConfig: next } = addRole(prev, label, color)
      return next
    })
  }, [])

  /**
   * Smaže specializaci a vyčistí závislosti v SimState.
   * Tasky dané role se odstraní z backlogu a inProgress; členové ztratí tuto roli.
   */
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
    rngRef.current = rng
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

  // Total time delta zobrazujeme jen po dokončení běhu — průběžný čas nemá smysl porovnávat
  const timeDelta = prevStats && s.finished
    ? calcDelta(s.simTime, prevStats.totalTime)
    : undefined

  // Maximální totalWork přes všechny viditelné features — základ pro proporcionální šířku barů.
  // Zahrnujeme backlog i inProgress, aby se bary nezměnily při přechodu feature do WIP.
  const maxWork = featureMaxWork(s.backlog, s.inProgress)

  // Celkový čas čekání — součet idleSec za všechny členy (u členů bez rolí je vždy 0)
  const totalWait = s.team.reduce((sum, m) => sum + m.idleSec, 0)
  // Zobrazujeme jen po dokončení běhu — průběžná hodnota by byla zavádějící
  // (aktuální run má méně idle než finální, delta by ukazovala falešné zlepšení)
  const waitDelta = prevStats && s.finished
    ? calcDelta(totalWait, prevStats.totalWait)
    : undefined

  // avgHandoffs je průměr per-feature (stejně jako avgLt) — delta je smysluplná průběžně od první hotové feature
  const handoffsDelta = prevStats && stats.count > 0
    ? calcDelta(stats.avgHandoffs, prevStats.avgHandoffs)
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
            {s.backlog.map(f => <FeatureCard key={f.id} feature={f} compact neutral maxWork={maxWork} />)}
          </div>
        </div>

        <div style={{ flex: '0 0 auto', padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--panel)' }}>
          <h3 style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-2)' }}>Controls</h3>
          {/* Generate button — první a full-width, aby byl vždy viditelný a snadno dostupný */}
          <button onClick={handleRegenerate} style={{
            background: 'var(--ink)', border: 'none', borderRadius: 4,
            padding: '7px 0', fontSize: 11, fontWeight: 600, color: 'white',
            cursor: 'pointer', width: '100%', letterSpacing: 0.2,
          }}>
            ♻ Generate new backlog
          </button>
          <Slider
            label="Backlog size"
            value={settings.initialBacklog}
            min={10} max={1000} step={10}
            onChange={v => setSettings(s => ({ ...s, initialBacklog: v }))}
            format={v => `${v} items`}
            tooltip="Number of features generated when clicking 'Generate new backlog'. Larger backlogs reveal long-term flow patterns."
          />
          <Slider
            label="Min. specializations per item"
            value={settings.minSpecializations}
            min={1} max={6} step={1}
            onChange={v => setSettings(s => ({ ...s, minSpecializations: v }))}
            format={v => v === 1 ? 'no minimum' : `≥ ${v} roles`}
            tooltip="Minimum number of different specializations each backlog item must require. Higher values force cross-functional collaboration on every item."
          />
          <Slider
            label="Item size variability"
            value={settings.sizeVar}
            min={0} max={1} step={0.05}
            onChange={v => setSettings(s => ({ ...s, sizeVar: v }))}
            format={v => v < 0.1 ? 'uniform' : v < 0.5 ? 'low' : v < 0.85 ? 'high' : 'extreme'}
            tooltip="How much effort varies between items. Uniform = all items take the same work. Extreme = some items are tiny, some very large — mimics real project unpredictability."
          />
          <Slider
            label="Role-mix variability"
            value={settings.roleVar}
            min={0} max={1} step={0.05}
            onChange={v => setSettings(s => ({ ...s, roleVar: v }))}
            format={v => v < 0.1 ? '2 roles' : v < 0.5 ? 'low' : v < 0.85 ? 'high' : '1–6 roles'}
            tooltip="How many different roles each item requires. Low = every item needs the same 2 roles. High = items require random mixes of up to 6 roles."
          />
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
                <RoleSettings
                  roleConfig={roleConfig}
                  onChange={handleRoleChange}
                  onAdd={handleAddRole}
                  onDelete={handleDeleteRole}
                />
              </div>
            )}
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
            {s.inProgress.map(f => <FeatureCard key={f.id} feature={f} team={s.team} maxWork={maxWork} />)}
          </div>
        </div>

        <div style={{ flex: '0 0 auto', padding: '10px 16px 12px', background: 'var(--panel)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Header row: title + both controls + hint */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'nowrap', overflow: 'hidden' }}>
            <h3 style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-2)', flexShrink: 0 }}>
              Units <span className="mono" style={{ color: 'var(--ink-3)', fontWeight: 500 }}>{s.team.length}</span>
            </h3>
            <SegmentedControl
              options={[
                { value: 'priority' as FocusMode, label: 'Priority' },
                { value: 'continuity' as FocusMode, label: 'Continuity' },
              ]}
              value={focusMode}
              onChange={setFocusMode}
              hint={focusMode === 'priority'
                ? 'Focus: units always pick the highest-priority feature available.'
                : 'Focus: units prefer to finish what they started — reduces handoffs.'}
            />
            <SegmentedControl
              options={[
                { value: 'priority' as WipMode, label: 'Priority' },
                { value: 'reduce-wip' as WipMode, label: 'Reduce WIP' },
              ]}
              value={wipMode}
              onChange={setWipMode}
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
                <MemberCard
                  key={m.id}
                  member={m}
                  currentFeature={cf ?? null}
                  currentTask={ct ?? null}
                  roleConfig={roleConfig}
                  onAddRole={handleAssignRole}
                  onRemoveRole={handleRemoveRole}
                  onRename={handleRenameMember}
                  onRemove={handleRemoveMember}
                />
              )
            })}
          </div>
          {/* Tlačítko pro přidání nové jednotky */}
          <button
            onClick={handleAddMember}
            style={{
              marginTop: 2,
              width: '100%', padding: '5px 0',
              fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
              border: '1px dashed var(--line-2)', borderRadius: 4,
              background: 'transparent', color: 'var(--ink-3)',
              fontWeight: 500, letterSpacing: 0.3,
            }}
          >
            + Add unit
          </button>
        </div>
      </section>

      {/* RIGHT: LEAD TIME + DONE */}
      <aside style={{ borderLeft: '1px solid var(--line)', background: 'var(--panel)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '12px 14px 14px', borderBottom: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-2)' }}>
              Lead Time
            </h3>
            <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>
              {stats.count} feature{stats.count !== 1 ? 's' : ''} sampled
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
            <StatTile
              label="Total Time"
              value={totalTimeDisplay}
              variant="timer"
              finished={s.finished}
              wide
              tooltip="Elapsed simulation time. Stops when the last backlog item is done."
              delta={timeDelta}
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
            <StatTile
              label="Total Wait"
              value={totalWait > 0 ? totalWait.toFixed(1) : '—'}
              unit={totalWait > 0 ? 's' : undefined}
              tooltip="Total idle time accumulated by all units with roles — time spent waiting for available work."
              delta={waitDelta}
            />
            <StatTile
              label="Avg Handoffs"
              value={stats.count > 0 ? stats.avgHandoffs.toFixed(1) : '—'}
              tooltip="Average number of handoffs per feature — phase transitions where a different unit takes over. Requires multi-phase setup in Specializations (different levels). Lower means less coordination overhead."
              delta={handoffsDelta}
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
