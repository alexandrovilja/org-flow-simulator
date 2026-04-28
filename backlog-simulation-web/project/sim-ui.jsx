// ============================================================
// UI building blocks
// ============================================================

const { useState, useEffect, useRef, useMemo, useCallback } = React;
const { ROLES, ROLE_META } = window.SimEngine;

// ---------- Feature card visualization ----------
// A horizontal bar where each segment = one task, colored by role.
// The bar itself sits on a tinted background derived from the feature hue,
// so the user can identify features at a glance.
function FeatureCard({ feature, team = [], compact = false, neutral = false }) {
  const total = feature.tasks.length;
  const segW = `${100 / total}%`;
  const bg = neutral ? 'var(--panel)' : `oklch(96% 0.03 ${feature.hue})`;
  const border = neutral ? 'var(--line)' : `oklch(80% 0.08 ${feature.hue})`;
  const barH = compact ? 6 : 22;

  // Build a quick lookup for assignee initial
  const initialFor = (id) => {
    if (id == null) return null;
    const m = team.find(m => m.id === id);
    return m ? m.name[0] : null;
  };

  return (
    <div className="feat-card" style={{
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 6,
      padding: compact ? '6px 8px' : '8px 10px',
      display: 'flex', flexDirection: 'column', gap: 6,
      minHeight: compact ? undefined : 64,
      justifyContent: compact ? undefined : 'space-between',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        <span className="mono" style={{
          fontSize: 11, color: 'var(--ink-2)', fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1,
        }}>
          {feature.name}
        </span>
        {!compact && (
          <span className="mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>
            {feature.tasks.length}t
          </span>
        )}
      </div>
      <div style={{
        display: 'flex',
        height: barH,
        gap: 2,
        borderRadius: 3,
        overflow: 'hidden',
      }}>
        {feature.tasks.map((t, i) => {
          const meta = ROLE_META[t.role];
          const filled = t.status === 'done' ? 1 : (t.status === 'doing' ? t.progress / t.work : 0);
          const initial = !compact && t.status === 'doing' ? initialFor(t.assignee) : null;
          return (
            <div key={t.id} style={{
              width: segW,
              background: 'rgba(0,0,0,0.06)',
              position: 'relative',
              overflow: 'hidden',
            }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, bottom: 0,
                width: `${filled * 100}%`,
                background: meta.color,
              }} />
              {t.status === 'todo' && (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: meta.color,
                  opacity: 0.25,
                }} />
              )}
              {initial && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: 'white',
                  textShadow: '0 0 2px rgba(0,0,0,0.35)',
                  pointerEvents: 'none',
                  letterSpacing: 0.2,
                }}>
                  {initial}
                </div>
              )}
              {!compact && t.status === 'done' && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, color: 'rgba(255,255,255,0.85)',
                  pointerEvents: 'none',
                }}>✓</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Role chip ----------
function RoleChip({ role, onRemove, removable }) {
  const meta = ROLE_META[role];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: meta.color,
      color: 'white',
      fontSize: 10, fontWeight: 600,
      padding: '2px 6px', borderRadius: 3,
      letterSpacing: 0.3,
    }}>
      {role}
      {removable && (
        <button onClick={onRemove} style={{
          background: 'rgba(255,255,255,0.25)',
          border: 'none', color: 'white',
          width: 12, height: 12, borderRadius: 2,
          padding: 0, lineHeight: 1, fontSize: 10,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }} title="Remove role">×</button>
      )}
    </span>
  );
}

// ---------- Member card ----------
function MemberCard({ member, currentFeature, currentTask, onAddRole, onRemoveRole }) {
  const [adding, setAdding] = useState(false);
  const availableRoles = ROLES.filter(r => !member.roles.includes(r));
  const taskMeta = currentTask ? ROLE_META[currentTask.role] : null;
  const fillPct = currentTask ? (currentTask.progress / currentTask.work) * 100 : 0;

  return (
    <div style={{
      background: 'var(--panel)',
      border: '1px solid var(--line)',
      borderRadius: 6,
      padding: '6px 8px',
      display: 'flex', flexDirection: 'column', gap: 4,
      minHeight: 0,
      overflow: 'hidden',
    }}>
      {/* Top row: name + roles inline */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', position: 'relative' }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%',
          background: 'var(--ink)',
          color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 600,
          flexShrink: 0,
        }}>
          {member.name[0]}
        </div>
        <span style={{ fontWeight: 600, fontSize: 12, marginRight: 2 }}>{member.name}</span>
        {member.roles.map(r => (
          <RoleChip key={r} role={r} removable onRemove={() => onRemoveRole(member.id, r)} />
        ))}
        {!adding && availableRoles.length > 0 && (
          <button onClick={() => setAdding(true)} style={{
            background: 'transparent',
            border: '1px dashed var(--line-2)',
            color: 'var(--ink-3)',
            fontSize: 10, padding: '1px 5px', borderRadius: 3,
            fontWeight: 500,
            lineHeight: 1.2,
          }}>+</button>
        )}
        {adding && (
          <div style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            zIndex: 10,
            display: 'flex',
            gap: 4,
            flexWrap: 'wrap',
            padding: 6,
            background: 'var(--panel)',
            border: '1px solid var(--line-2)',
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            minWidth: 'max-content',
          }}>
            {availableRoles.map(r => (
              <button key={r} onMouseDown={(e) => {
                e.preventDefault();
                onAddRole(member.id, r);
                setAdding(false);
              }} style={{
                background: ROLE_META[r].color,
                border: 'none', color: 'white',
                fontSize: 10, fontWeight: 600,
                padding: '2px 6px', borderRadius: 3,
                letterSpacing: 0.3,
              }}>{r}</button>
            ))}
            <button onClick={() => setAdding(false)} style={{
              background: 'transparent', border: 'none',
              color: 'var(--ink-3)', fontSize: 10, padding: '0 4px',
            }}>cancel</button>
          </div>
        )}
      </div>

      {/* Current work — compact: feature name + progress bar inline */}
      <div style={{ minHeight: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {currentFeature && currentTask ? (
          <React.Fragment>
            <div style={{
              fontSize: 10, color: 'var(--ink-2)',
              display: 'flex', alignItems: 'center', gap: 4,
              whiteSpace: 'nowrap', overflow: 'hidden',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: 2,
                background: `oklch(70% 0.14 ${currentFeature.hue})`,
                flexShrink: 0,
              }} />
              <span className="mono" style={{
                overflow: 'hidden', textOverflow: 'ellipsis', flex: 1,
              }}>{currentFeature.name}</span>
              <span className="mono" style={{
                fontSize: 9, fontWeight: 600,
                color: taskMeta.color, flexShrink: 0,
              }}>{currentTask.role}</span>
            </div>
            <div style={{
              height: 14, background: 'var(--line)', borderRadius: 4, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${fillPct}%`,
                background: taskMeta.color,
              }} />
            </div>
          </React.Fragment>
        ) : (
          <div style={{
            fontSize: 10, color: 'var(--ink-3)',
            fontStyle: 'italic',
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: 'var(--line-2)',
            }} />
            {member.roles.length === 0 ? 'no roles' : 'idle'}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- Lead Time scatter plot ----------
// Each dot = one completed feature. X = completion order, Y = lead time.
// Horizontal lines mark the running average and p85 (85th percentile).
function LeadTimeChart({ leadTimes, stats }) {
  if (stats.count === 0) {
    return (
      <div style={{
        height: 130,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--ink-3)', fontSize: 12, fontStyle: 'italic',
        border: '1px dashed var(--line-2)', borderRadius: 6,
      }}>
        Waiting for first completed feature…
      </div>
    );
  }

  // Y-axis range: a bit above max with some headroom
  const maxY = Math.max(stats.max * 1.1, 5);
  const W = 100; // pct
  const H = 110; // px
  const padTop = 6, padBottom = 14, padLeft = 28, padRight = 8;

  // X positions: most-recent N points spread across width
  const N = leadTimes.length;
  const points = leadTimes.map((l, i) => {
    const x = N === 1 ? 50 : (i / (N - 1)) * 100;
    const yPct = 1 - (l.ms / maxY); // 0 at top
    return { x, yPct, ms: l.ms, id: l.id };
  });

  const yLineFor = (val) => `${(1 - val / maxY) * 100}%`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ position: 'relative', height: H, paddingLeft: padLeft, paddingRight: padRight }}>
        {/* Y axis labels */}
        <div className="mono" style={{
          position: 'absolute', left: 0, top: padTop, bottom: padBottom,
          width: padLeft - 4,
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          fontSize: 9, color: 'var(--ink-3)', textAlign: 'right',
        }}>
          <span>{maxY.toFixed(0)}s</span>
          <span>{(maxY / 2).toFixed(0)}s</span>
          <span>0s</span>
        </div>

        {/* Plot area */}
        <div style={{
          position: 'absolute',
          left: padLeft, right: padRight, top: padTop, bottom: padBottom,
          background: 'var(--bg)',
          border: '1px solid var(--line)',
          borderRadius: 4,
          overflow: 'hidden',
        }}>
          {/* Gridlines: 25%, 50%, 75% */}
          {[0.25, 0.5, 0.75].map(p => (
            <div key={p} style={{
              position: 'absolute', left: 0, right: 0, top: `${p * 100}%`,
              height: 1, background: 'var(--line)',
            }} />
          ))}

          {/* p85 line */}
          <div style={{
            position: 'absolute', left: 0, right: 0,
            top: yLineFor(stats.p85),
            height: 1, background: 'var(--warn)', opacity: 0.8,
          }}>
            <span className="mono" style={{
              position: 'absolute', right: 4, top: -11,
              fontSize: 9, color: 'var(--warn)', fontWeight: 600,
              background: 'var(--bg)', padding: '0 3px',
            }}>p85 {stats.p85.toFixed(1)}s</span>
          </div>

          {/* Avg line */}
          <div style={{
            position: 'absolute', left: 0, right: 0,
            top: yLineFor(stats.avg),
            height: 1, background: 'var(--ink)', opacity: 0.6,
            borderTop: '1px dashed var(--ink)',
          }}>
            <span className="mono" style={{
              position: 'absolute', left: 4, top: -11,
              fontSize: 9, color: 'var(--ink)', fontWeight: 600,
              background: 'var(--bg)', padding: '0 3px',
            }}>avg {stats.avg.toFixed(1)}s</span>
          </div>

          {/* Dots */}
          {points.map(p => (
            <div key={p.id} title={`F-${String(p.id).padStart(3, '0')} · ${p.ms.toFixed(1)}s`} style={{
              position: 'absolute',
              left: `${p.x}%`, top: `${p.yPct * 100}%`,
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--accent)',
              transform: 'translate(-50%, -50%)',
              boxShadow: '0 0 0 1.5px var(--bg)',
            }} />
          ))}
        </div>

        {/* X-axis label */}
        <div className="mono" style={{
          position: 'absolute', left: padLeft, right: padRight, bottom: 0,
          display: 'flex', justifyContent: 'space-between',
          fontSize: 9, color: 'var(--ink-3)',
        }}>
          <span>oldest</span>
          <span>completion order →</span>
          <span>newest</span>
        </div>
      </div>
    </div>
  );
}

// ---------- Stat tile ----------
function StatTile({ label, value, unit, hint, tooltip }) {
  return (
    <div title={tooltip} style={{
      background: 'var(--panel)',
      border: '1px solid var(--line)',
      borderRadius: 6,
      padding: '8px 10px',
      display: 'flex', flexDirection: 'column', gap: 2,
      minWidth: 0,
      cursor: tooltip ? 'help' : 'default',
    }}>
      <span style={{
        fontSize: 10, color: 'var(--ink-3)',
        textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500,
        display: 'inline-flex', alignItems: 'center', gap: 4,
      }}>{label}{tooltip && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 11, height: 11, borderRadius: '50%',
          background: 'var(--line)', color: 'var(--ink-3)',
          fontSize: 8, fontWeight: 700,
        }}>?</span>
      )}</span>
      <span className="mono" style={{
        fontSize: 18, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.1,
      }}>
        {value}<span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 2, fontWeight: 500 }}>{unit}</span>
      </span>
      {hint && <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{hint}</span>}
    </div>
  );
}

// ---------- Slider control ----------
function Slider({ label, value, min, max, step, onChange, format }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--ink-2)', fontWeight: 500 }}>{label}</span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink)', fontWeight: 600 }}>
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        value={value}
        min={min} max={max} step={step}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ accentColor: 'var(--ink)', width: '100%' }}
      />
    </div>
  );
}

// ---------- Speed control ----------
function SpeedControl({ speed, paused, hasStarted, onChange, onTogglePause, onReset }) {
  const speeds = [0.5, 1, 2, 10];
  const label = !hasStarted ? '▶ Start' : (paused ? '▶ Resume' : '❙❙ Pause');
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <button onClick={onTogglePause} style={{
        background: paused ? 'var(--accent)' : 'var(--ink)',
        color: 'white', border: 'none', borderRadius: 4,
        padding: '6px 10px', fontWeight: 600, fontSize: 12,
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
        {label}
      </button>
      <div style={{ display: 'flex', border: '1px solid var(--line)', borderRadius: 4, overflow: 'hidden' }}>
        {speeds.map(s => (
          <button key={s} onClick={() => onChange(s)} style={{
            background: speed === s ? 'var(--ink)' : 'var(--panel)',
            color: speed === s ? 'white' : 'var(--ink-2)',
            border: 'none',
            padding: '6px 10px',
            fontSize: 11, fontWeight: 600,
            borderRight: s !== speeds[speeds.length - 1] ? '1px solid var(--line)' : 'none',
          }} className="mono">
            {s}×
          </button>
        ))}
      </div>
      <button onClick={onReset}
        title="Regenerate the initial backlog and clear in-progress / done"
        style={{
        background: 'var(--panel)',
        border: '1px solid var(--line)', borderRadius: 4,
        padding: '6px 10px', fontSize: 11, color: 'var(--ink-2)',
      }}>↺ Reset backlog</button>
    </div>
  );
}

Object.assign(window, {
  FeatureCard, MemberCard, RoleChip, LeadTimeChart, StatTile, Slider, SpeedControl,
});
