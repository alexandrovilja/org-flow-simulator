// ============================================================
// Main app — orchestrates simulation tick + layout
// ============================================================

const { makeInitialState, resetFromSnapshot, tick, computeStats, mulberry32, ROLE_META, ROLES: ALL_ROLES } = window.SimEngine;

function App() {
  // ---- Settings (live-tweakable) ----
  const [settings, setSettings] = useState({
    minBacklog: 0, // 0 = no auto-replenish; backlog drains as items move to In Progress
    wipLimit: 6,
    sizeVar: 0.4, // 0..1 — variability in feature size
    roleVar: 0.5, // 0..1 — variability in role mix
    initialBacklog: 100 // pre-seeded items
  });

  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(true);
  const [hasStarted, setHasStarted] = useState(false);
  const [, forceUpdate] = useState(0);

  // ---- Mutable refs (don't trigger re-render on every tick) ----
  const rngRef = useRef(mulberry32(42));
  const stateRef = useRef(null);
  if (stateRef.current === null) stateRef.current = makeInitialState(rngRef.current, settings);
  const settingsRef = useRef(settings);
  const speedRef = useRef(speed);
  const pausedRef = useRef(paused);

  useEffect(() => {settingsRef.current = settings;}, [settings]);
  useEffect(() => {speedRef.current = speed;}, [speed]);
  useEffect(() => {pausedRef.current = paused;}, [paused]);

  // ---- Animation loop ----
  useEffect(() => {
    let raf;
    let lastT = performance.now();
    const step = (t) => {
      const dtMs = Math.min(100, t - lastT); // clamp huge gaps
      lastT = t;
      if (!pausedRef.current) {
        const dtSim = dtMs / 1000 * speedRef.current;
        tick(stateRef.current, dtSim, settingsRef.current, rngRef.current);
      }
      forceUpdate((n) => n + 1 & 0xFFFF);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, []);

  // ---- Actions ----
  const addRole = useCallback((memberId, role) => {
    const m = stateRef.current.team.find((m) => m.id === memberId);
    if (m && !m.roles.includes(role)) m.roles.push(role);
    forceUpdate((n) => n + 1);
  }, []);

  const removeRole = useCallback((memberId, role) => {
    const m = stateRef.current.team.find((m) => m.id === memberId);
    if (!m) return;
    m.roles = m.roles.filter((r) => r !== role);
    // if currently working a task of this role, abort it (return to todo)
    if (m.currentTask) {
      const f = stateRef.current.inProgress.find((f) => f.id === m.currentTask.featureId);
      if (f) {
        const t = f.tasks.find((t) => t.id === m.currentTask.taskId);
        if (t && t.role === role) {
          t.status = 'todo';
          t.assignee = null;
          // keep partial progress so re-pickup is visible? Reset to 0 for fairness.
          t.progress = 0;
          m.currentTask = null;
        }
      }
    }
    forceUpdate((n) => n + 1);
  }, []);

  // Restore the backlog to its original (snapshot) state — same items as initially generated,
  // with all in-progress and done cleared. Use "New backlog" to actually generate fresh items.
  const reset = useCallback(() => {
    resetFromSnapshot(stateRef.current);
    forceUpdate((n) => n + 1);
  }, []);

  // Generate a fresh, brand-new backlog (and snapshot) using the current initialBacklog setting.
  const regenerateBacklog = useCallback(() => {
    rngRef.current = mulberry32(Math.floor(Math.random() * 1e9));
    stateRef.current = makeInitialState(rngRef.current, settingsRef.current);
    forceUpdate((n) => n + 1);
  }, []);

  const resetStats = useCallback(() => {
    stateRef.current.leadTimes = [];
    forceUpdate((n) => n + 1);
  }, []);

  // ---- Derived ----
  const s = stateRef.current;
  const stats = useMemo(() => computeStats(s.leadTimes), [s.leadTimes.length, s.leadTimes[s.leadTimes.length - 1]?.id]);

  // Util: compute team utilization
  const busyCount = s.team.filter((m) => m.currentTask).length;
  const activeMembers = s.team.filter((m) => m.roles.length > 0).length;
  const util = activeMembers > 0 ? Math.round(busyCount / activeMembers * 100) : 0;

  // Util: throughput — features completed in the last 60 sim seconds (or pro-rated to 60s if sim is younger)
  const windowSec = Math.max(1, Math.min(60, s.simTime));
  const cutoff = s.simTime - windowSec;
  const recentCount = s.leadTimes.filter((l) => l.finishedAt > cutoff).length;
  const recentDone = Math.round(recentCount * (60 / windowSec));

  return (
    <div style={{
      height: '100vh',
      display: 'grid',
      gridTemplateColumns: '320px 1fr 280px',
      gridTemplateRows: 'auto 1fr',
      gap: 0,
      background: 'var(--bg)'
    }}>
      {/* ========= TOP BAR ========= */}
      <header style={{
        gridColumn: '1 / 4',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px',
        borderBottom: '1px solid var(--line)',
        background: 'var(--panel)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 5,
            background: 'var(--ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
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
            speed={speed} paused={paused} hasStarted={hasStarted}
            onChange={setSpeed}
            onTogglePause={() => {
              setPaused((p) => !p);
              setHasStarted(true);
            }}
            onReset={() => { reset(); setPaused(true); setHasStarted(false); }} />
          
        </div>
      </header>

      {/* ========= LEFT: BACKLOG ========= */}
      <section style={{
        borderRight: '1px solid var(--line)',
        background: 'var(--panel)',
        display: 'flex', flexDirection: 'column',
        minHeight: 0
      }}>
        {/* Backlog (top half of left column) */}
        <div style={{
          flex: '1 1 50%', minHeight: 0,
          display: 'flex', flexDirection: 'column',
          borderBottom: '1px solid var(--line)'
        }}>
          <PanelHeader title="Backlog" count={s.backlog.length} />
          <div style={{
            flex: 1, overflow: 'auto', padding: '8px 12px 12px 12px',
            display: 'flex', flexDirection: 'column', gap: 6
          }}>
            {s.backlog.length === 0 &&
            <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic', padding: '8px 4px' }}>
                No items waiting.
              </div>
            }
            {s.backlog.map((f) =>
            <FeatureCard key={f.id} feature={f} compact neutral />
            )}
          </div>
        </div>

        {/* Controls (bottom-left corner) */}
        <div style={{
          flex: '0 0 auto',
          padding: '12px 14px 14px',
          display: 'flex', flexDirection: 'column', gap: 12,
          background: 'var(--panel)'
        }}>
          <h3 style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-2)' }}>
            Controls
          </h3>
          <Slider
            label="Backlog size (on regenerate)"
            value={settings.initialBacklog}
            min={10} max={1000} step={10}
            onChange={(v) => setSettings((s) => ({ ...s, initialBacklog: v }))}
            format={(v) => `${v} items`} />
          <button onClick={regenerateBacklog} style={{
            background: 'var(--panel)',
            border: '1px solid var(--line)',
            borderRadius: 4,
            padding: '5px 10px',
            fontSize: 11,
            fontWeight: 500,
            color: 'var(--ink-2)',
            cursor: 'pointer',
            alignSelf: 'flex-start',
          }} title="Generate a fresh backlog using the current size & variability settings. The Reset button replays this same backlog.">
            ♻ Generate new backlog
          </button>
          <Slider
            label="Item size variability"
            value={settings.sizeVar}
            min={0} max={1} step={0.05}
            onChange={(v) => setSettings((s) => ({ ...s, sizeVar: v }))}
            format={(v) => v < 0.1 ? 'uniform' : v < 0.5 ? 'low' : v < 0.85 ? 'high' : 'extreme'} />
          <Slider
            label="Role-mix variability"
            value={settings.roleVar}
            min={0} max={1} step={0.05}
            onChange={(v) => setSettings((s) => ({ ...s, roleVar: v }))}
            format={(v) => v < 0.1 ? '2 roles' : v < 0.5 ? 'low' : v < 0.85 ? 'high' : '1–6 roles'} />

          {/* Role legend */}
          <div style={{
            paddingTop: 4,
            borderTop: '1px solid var(--line)',
            display: 'flex', flexWrap: 'wrap', gap: 6,
            marginTop: 4,
          }}>
            {ALL_ROLES.map((r) =>
            <div key={r} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 10, color: 'var(--ink-2)'
            }}>
                <span style={{
                width: 8, height: 8, borderRadius: 2,
                background: ROLE_META[r].color
              }} />
                {ROLE_META[r].label}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ========= CENTER: IN-PROGRESS (top) + TEAM (bottom) ========= */}
      <section style={{
        display: 'flex', flexDirection: 'column',
        minHeight: 0, minWidth: 0,
        background: 'var(--bg)'
      }}>
        {/* In-Progress — fills the upper space */}
        <div style={{ borderBottom: '1px solid var(--line)', background: 'var(--panel)', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <PanelHeader title="In Progress" count={s.inProgress.length} hint="auto-scaled" />
          <div style={{
            padding: '8px 16px 14px 16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 8,
            overflowY: 'auto',
            minHeight: 64,
            alignContent: 'start',
          }}>
            {s.inProgress.length === 0 &&
            <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic', gridColumn: '1 / -1' }}>
                Nothing in flight.
              </div>
            }
            {s.inProgress.map((f) => <FeatureCard key={f.id} feature={f} team={s.team} />)}
          </div>
        </div>

        {/* Team — anchored to bottom, sized to its content */}
        <div style={{
          flex: '0 0 auto',
          padding: '10px 16px 12px',
          background: 'var(--panel)',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexShrink: 0 }}>
            <h3 style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-2)' }}>
              Team <span className="mono" style={{ color: 'var(--ink-3)', fontWeight: 500 }}>{s.team.length}</span>
            </h3>
            <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>
              Click <span className="mono" style={{ color: 'var(--ink-2)' }}>+ role</span> to give someone an extra specialty
            </span>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gridAutoRows: 'min-content',
            gap: 6,
            alignContent: 'start',
          }}>
            {s.team.map((m) => {
              let cf = null,ct = null;
              if (m.currentTask) {
                cf = s.inProgress.find((f) => f.id === m.currentTask.featureId);
                ct = cf?.tasks.find((t) => t.id === m.currentTask.taskId);
              }
              return (
                <MemberCard
                  key={m.id}
                  member={m}
                  currentFeature={cf}
                  currentTask={ct}
                  onAddRole={addRole}
                  onRemoveRole={removeRole} />);


            })}
          </div>
        </div>
      </section>

      {/* ========= RIGHT: DONE + CONTROLS ========= */}
      <aside style={{
        borderLeft: '1px solid var(--line)',
        background: 'var(--panel)',
        display: 'flex', flexDirection: 'column',
        minHeight: 0
      }}>
        {/* Lead Time + stats (top of right column) */}
        <div style={{
          padding: '12px 14px 14px',
          borderBottom: '1px solid var(--line)',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-2)' }}>
              Lead Time
            </h3>
            <button onClick={resetStats} disabled={stats.count === 0} style={{
              background: 'var(--panel)',
              border: '1px solid var(--line)',
              borderRadius: 4,
              padding: '3px 8px',
              fontSize: 10,
              fontWeight: 500,
              color: stats.count === 0 ? 'var(--ink-3)' : 'var(--ink-2)',
              cursor: stats.count === 0 ? 'default' : 'pointer',
              opacity: stats.count === 0 ? 0.5 : 1
            }} title="Clear lead time history (keep simulation running)">
              ↺ Reset stats
            </button>
          </div>
          <span style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: -6 }}>
            From backlog → done · {stats.count} feature{stats.count !== 1 ? 's' : ''} sampled
          </span>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
            <StatTile label="Avg" value={stats.count ? stats.avg.toFixed(1) : '—'} unit="s" tooltip="Mean lead time across all completed features." />
            <StatTile label="Median (p50)" value={stats.count ? stats.p50.toFixed(1) : '—'} unit="s" tooltip="Half the features finished faster than this, half slower. More robust to outliers than average." />
            <StatTile label="Avg WIP" value={s.simTime > 0.5 ? (s.wipIntegral / s.simTime).toFixed(1) : '—'} unit="" tooltip="Average Work In Progress over the simulation lifetime — running mean of items in flight. Lower Avg WIP usually means lower lead time (Little's Law)." />
            <StatTile label="Throughput" value={recentDone} unit="/60s" hint={util + '% utilization'} tooltip="Features completed per 60 sim seconds (pro-rated when the simulation is younger). Utilization = % of role-equipped team members currently working a task." />
          </div>
        </div>

        {/* Done */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <PanelHeader title="Done" count={s.done.length} />
          <div style={{
            flex: 1, overflow: 'auto', padding: '6px 14px 14px',
            display: 'flex', flexDirection: 'column', gap: 6
          }}>
            {s.done.length === 0 &&
            <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic', padding: '8px 0' }}>
                No completed features yet.
              </div>
            }
            {s.done.map((f) => {
              const lt = f.finishedAt - f.createdAt;
              return (
                <div key={f.id} style={{
                  display: 'flex', alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  background: `oklch(96% 0.03 ${f.hue})`,
                  border: `1px solid oklch(82% 0.06 ${f.hue})`,
                  borderRadius: 5
                }}>
                  <span style={{
                    width: 4, alignSelf: 'stretch',
                    background: `oklch(60% 0.14 ${f.hue})`,
                    borderRadius: 2
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mono" style={{
                      fontSize: 10, color: 'var(--ink-2)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                    }}>{f.name}</div>
                    <div style={{ fontSize: 9, color: 'var(--ink-3)' }}>
                      {f.tasks.length} task{f.tasks.length > 1 ? 's' : ''}
                    </div>
                  </div>
                  <span className="mono" style={{
                    fontSize: 11, fontWeight: 600,
                    color: 'var(--done)'
                  }}>{lt.toFixed(1)}s</span>
                </div>);

            })}
          </div>
        </div>
      </aside>
    </div>);

}

function PanelHeader({ title, count, hint }) {
  return (
    <div style={{
      padding: '12px 16px 8px',
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      borderBottom: '1px solid transparent'
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-2)' }}>
          {title}
        </h3>
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{count}</span>
      </div>
      {hint && <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{hint}</span>}
    </div>);

}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);