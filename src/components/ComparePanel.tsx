'use client'

import { ROLE_META } from '@/simulation/engine'
import { calcCompareDelta } from '@/simulation/compareMode'
import { formatTime } from '@/lib/formatTime'
import { FeatureCard } from '@/components/FeatureCard'
import { featureMaxWork } from '@/lib/featureSize'
import type { SimState, SimStats } from '@/types/simulation'

interface ComparePanelProps {
  teamLabel: string
  state: SimState
  stats: SimStats
  opponentStats: SimStats
  opponentState: SimState
  opponentLabel: string
}

/**
 * One column of the Compare view. Layout from top to bottom:
 * 1. Team header (name + badge)
 * 2. Kanban board (To Do / In Progress / Done) — takes all available space
 * 3. Metrics — pinned near bottom
 * 4. Team composition — pinned at bottom
 */
export function ComparePanel({
  teamLabel,
  state, stats, opponentStats, opponentState, opponentLabel,
}: ComparePanelProps) {
  const avgWip         = state.simTime > 0.5 ? state.wipIntegral / state.simTime : null
  const opponentAvgWip = opponentState.simTime > 0.5 ? opponentState.wipIntegral / opponentState.simTime : null

  // True once both simulations have finished — enables post-run stat coloring.
  const bothFinished = state.finished && opponentState.finished

  // Deltas: negative = this team is better (lower value is better for all four metrics).
  const ltDelta   = calcCompareDelta(opponentStats.count > 0 ? opponentStats.avg : null, stats.count > 0 ? stats.avg : null)
  const timeDelta = state.finished && opponentState.finished
    ? calcCompareDelta(opponentState.simTime, state.simTime)
    : undefined
  const wipDelta  = calcCompareDelta(opponentAvgWip, avgWip)
  const vsLabel = `vs ${opponentLabel}`

  // Compute max feature size across all columns so bar widths are proportional.
  // Using all three columns keeps the scale stable as items flow through.
  const maxWork = featureMaxWork(
    [...state.backlog, ...state.inProgress],
    state.done,
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Team header ── */}
      <div style={{
        padding: '12px 16px 10px',
        borderBottom: '1px solid var(--line)',
        flexShrink: 0,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', letterSpacing: -0.4 }}>
          {teamLabel}
        </div>
      </div>

      {/* ── Kanban board — fills all available vertical space ── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', minHeight: 0 }}>
        {/* To Do — grey */}
        <KanbanColumn
          title="To Do"
          count={state.backlog.length}
          borderRight
          headerBg="var(--bg)"
        >
          {state.backlog.map(f => (
            <FeatureCard key={f.id} feature={f} compact neutral maxWork={maxWork} />
          ))}
          {state.backlog.length === 0 && <EmptyNote>Backlog empty</EmptyNote>}
        </KanbanColumn>

        {/* In Progress — blue tint */}
        <KanbanColumn
          title="In Progress"
          count={state.inProgress.length}
          borderRight
          headerBg="oklch(95% 0.03 230)"
        >
          {state.inProgress.map(f => (
            <FeatureCard key={f.id} feature={f} compact team={state.team} maxWork={maxWork} />
          ))}
          {state.inProgress.length === 0 && <EmptyNote>Nothing in flight</EmptyNote>}
        </KanbanColumn>

        {/* Done — green tint */}
        <KanbanColumn
          title="Done"
          count={state.done.length}
          headerBg="oklch(95% 0.03 150)"
        >
          {state.done.map(f => {
            const lt = (f.finishedAt ?? 0) - f.createdAt
            return (
              <div key={f.id}>
                <FeatureCard feature={f} compact maxWork={maxWork} />
                <div style={{ textAlign: 'right', fontSize: 9, fontWeight: 700, color: 'var(--done)', marginTop: 1, paddingRight: 2 }}>
                  {lt.toFixed(1)}s
                </div>
              </div>
            )
          })}
          {state.done.length === 0 && <EmptyNote>None yet</EmptyNote>}
        </KanbanColumn>
      </div>

      {/* ── Metrics — pinned below kanban, single row ── */}
      <div style={{ padding: '8px 12px', borderTop: '1px solid var(--line)', flexShrink: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          <MetricTile
            label="Total Time"
            value={state.simTime > 0 || state.finished ? formatTime(state.simTime) : '—'}
            delta={timeDelta} vsLabel={vsLabel}
            deltaLabel={{ better: 'faster', worse: 'slower' }}
            tooltip="Elapsed simulation time. Stops when the last backlog item is done."
            bothFinished={bothFinished}
          />
          <MetricTile
            label="Avg Cycle Time"
            value={stats.count > 0 ? `${stats.avg.toFixed(1)}s` : '—'}
            delta={ltDelta} vsLabel={vsLabel}
            deltaLabel={{ better: 'faster', worse: 'slower' }}
            tooltip="Mean time from work start to completion (excludes backlog wait)."
            bothFinished={bothFinished}
          />
          <MetricTile
            label="Avg WIP"
            value={avgWip !== null ? avgWip.toFixed(1) : '—'}
            delta={wipDelta} vsLabel={vsLabel}
            deltaLabel={{ better: 'lower', worse: 'higher' }}
            tooltip="Average Work In Progress — lower usually means lower lead time (Little's Law)."
            bothFinished={bothFinished}
          />
        </div>
      </div>

      {/* ── Team composition — pinned at bottom ── */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--line)', flexShrink: 0 }}>
        <SectionTitle>Team composition</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
          {state.team.map(m => {
            const ct = m.currentTask
              ? state.inProgress.find(f => f.id === m.currentTask!.featureId)
                  ?.tasks.find(t => t.id === m.currentTask!.taskId) ?? null
              : null
            const cf = ct
              ? state.inProgress.find(f => f.id === m.currentTask!.featureId) ?? null
              : null
            const fillPct = ct ? (ct.progress / ct.work) * 100 : 0

            return (
              <div key={m.id} style={{
                background: 'var(--panel)', border: '1px solid var(--line)',
                borderRadius: 6, padding: '6px 8px',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: 'var(--ink)', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 600, flexShrink: 0,
                  }}>
                    {m.name[0]?.toUpperCase()}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)' }}>{m.name}</span>
                </div>
                {/* Role chips — read-only */}
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                  {m.roles.map(r => (
                    <span key={r} style={{
                      padding: '1px 6px', borderRadius: 3,
                      fontSize: 10, fontWeight: 600, color: 'white',
                      background: ROLE_META[r]?.color ?? 'var(--ink-3)',
                    }}>
                      {ROLE_META[r]?.label ?? r}
                    </span>
                  ))}
                </div>
                {/* Progress or idle */}
                <div style={{ minHeight: 28 }}>
                  {cf && ct ? (
                    <>
                      <div style={{
                        fontSize: 10, color: 'var(--ink-2)',
                        display: 'flex', alignItems: 'center', gap: 4,
                        whiteSpace: 'nowrap', overflow: 'hidden', marginBottom: 2,
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: 2, background: `oklch(70% 0.14 ${cf.hue})`, flexShrink: 0 }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }} className="mono">{cf.name}</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--line)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${fillPct}%`, background: ROLE_META[ct.role]?.color ?? 'var(--accent)' }} />
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 10, color: 'var(--ink-3)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--line-2)' }} />
                      idle
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}

// ── Small shared sub-components ───────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
      letterSpacing: 0.5, color: 'var(--ink-3)', marginBottom: 7,
    }}>
      {children}
    </div>
  )
}

interface MetricTileProps {
  label: string
  value: string
  delta?: number
  vsLabel: string
  tooltip: string
  /** Direction labels — default "faster/slower", use "lower/higher" for WIP and wait time. */
  deltaLabel?: { better: string; worse: string }
  /** When true and delta is known, tiles turn green (better) or stay neutral (worse). */
  bothFinished?: boolean
}

/**
 * Metric tile with a team-vs-team delta indicator.
 * After both simulations finish: green background + value when this team wins,
 * neutral background when this team loses.
 */
function MetricTile({ label, value, delta, vsLabel, tooltip, deltaLabel, bothFinished }: MetricTileProps) {
  const dl = deltaLabel ?? { better: 'faster', worse: 'slower' }

  const isBetter = bothFinished && delta !== undefined && delta < 0

  const tileBg     = isBetter ? 'oklch(94% 0.04 150)' : 'var(--bg)'
  const tileBorder = isBetter ? 'oklch(82% 0.09 150)' : 'var(--line)'
  const valueColor = isBetter ? 'var(--done)' : 'var(--ink)'

  return (
    <div title={tooltip} style={{
      padding: '8px 10px', borderRadius: 7, cursor: 'help',
      background: tileBg, border: `1px solid ${tileBorder}`,
      transition: 'background 0.4s, border-color 0.4s',
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--ink-3)' }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.5, marginTop: 2, fontVariantNumeric: 'tabular-nums', color: valueColor, transition: 'color 0.4s' }}>
        {value}
      </div>
      {delta !== undefined && (
        <div style={{
          fontSize: 11, fontWeight: 700, marginTop: 2,
          color: delta < 0 ? 'var(--done)' : 'var(--ink)',
        }}>
          {delta < 0
            ? `↓ ${Math.abs(delta).toFixed(0)}% ${dl.better}`
            : `↑ ${delta.toFixed(0)}% ${dl.worse}`}
          <span style={{ fontWeight: 400, color: 'var(--ink-3)', marginLeft: 3 }}>{vsLabel}</span>
        </div>
      )}
    </div>
  )
}

interface KanbanColumnProps {
  title: string
  count: number
  borderRight?: boolean
  /** Background colour of the sticky column header. */
  headerBg?: string
  children: React.ReactNode
}

/** One column of the Kanban board with a colour-coded sticky header and scrollable item list. */
function KanbanColumn({ title, count, borderRight, headerBg, children }: KanbanColumnProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', minHeight: 0,
      borderRight: borderRight ? '1px solid var(--line)' : undefined,
    }}>
      <div style={{
        padding: '6px 10px', borderTop: '1px solid var(--line)',
        background: headerBg ?? 'var(--bg)', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-3)' }}>
          {title}
        </span>
        <span style={{ fontSize: 10, color: 'var(--ink-3)', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '5px 8px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {children}
      </div>
    </div>
  )
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, color: 'var(--ink-3)', fontStyle: 'italic', padding: '4px 0' }}>
      {children}
    </div>
  )
}
