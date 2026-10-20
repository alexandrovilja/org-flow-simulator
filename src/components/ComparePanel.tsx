'use client'

import { ROLE_META, doneCount } from '@/simulation/engine'
import { calcCompareDelta } from '@/simulation/compareMode'
import type { TeamType } from '@/simulation/compareMode'
import { formatTime } from '@/lib/formatTime'
import { FeatureCard } from '@/components/FeatureCard'
import { SegmentedControl } from '@/components/SegmentedControl'
import { EmptyNote } from '@/components/EmptyNote'
import styles from './ComparePanel.module.css'
import { RoleChip } from '@/components/RoleChip'
import { memberInitial } from '@/lib/memberInitial'
import type { CssVariables } from '@/types/css'
import { featureMaxWork } from '@/lib/featureSize'
import type { SimState, SimStats } from '@/types/simulation'

/** Labels and descriptions for the three team types shown in the picker. */
const TEAM_TYPE_OPTIONS: { value: TeamType; label: string; title: string }[] = [
  { value: 'single', label: 'Single', title: 'Single-skill specialists — each member has 1 role' },
  { value: 'double', label: 'Double', title: 'Double-skill specialists — each member has 2 adjacent roles' },
  { value: 'multi',  label: 'Multi',  title: 'Multi-skill specialists — each member has 3 adjacent roles' },
]

/** Full team-type labels used as the panel heading. */
const TEAM_TYPE_LABELS: Record<TeamType, string> = {
  single: 'Single-skill specialists team',
  double: 'Double-skill specialists team',
  multi:  'Multi-skill specialists team',
}

interface ComparePanelProps {
  /** Currently selected team type for this column. */
  teamType: TeamType
  /** Called when the user selects a different team type. */
  onChangeType: (type: TeamType) => void
  state: SimState
  stats: SimStats
  opponentStats: SimStats
  opponentState: SimState
  /** Team type of the opposing column — used to build the "vs …" label in metric tiles. */
  opponentLabel: TeamType
  /**
   * Optional prefix for `data-tutorial-target` attributes on this panel's sub-sections.
   * When provided, the team header gets `{prefix}-settings` and the composition section
   * gets `{prefix}-composition` — e.g. passing `"compare-team-a"` produces
   * `data-tutorial-target="compare-team-a-settings"` and `"compare-team-a-composition"`.
   * This allows the spotlight tutorial to target individual sub-panels within each column.
   */
  tutorialTargetPrefix?: string
}

/**
 * One column of the Compare view. Layout from top to bottom:
 * 1. Team header (type picker + label)
 * 2. Kanban board (To Do / In Progress / Done) — takes all available space
 * 3. Metrics — pinned near bottom
 * 4. Team composition — pinned at bottom
 */
export function ComparePanel({
  teamType, onChangeType,
  state, stats, opponentStats, opponentState, opponentLabel,
  tutorialTargetPrefix,
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
  // opponentLabel is always a valid TeamType, so the lookup is guaranteed to succeed.
  const vsLabel = `vs ${TEAM_TYPE_OPTIONS.find(o => o.value === opponentLabel)!.label}`

  // Compute max feature size across all columns so bar widths are proportional.
  // Using all three columns keeps the scale stable as items flow through.
  const maxWork = featureMaxWork(
    [...state.backlog, ...state.inProgress],
    state.done,
  )

  return (
    <div className={styles.root}>

      {/* ── Team header ── */}
      {/* data-tutorial-target lets the spotlight overlay focus on this team's type picker */}
      <div
        data-tutorial-target={tutorialTargetPrefix ? `${tutorialTargetPrefix}-settings` : undefined}
        className={styles.teamHeader}
      >
        <h3 className={styles.teamTitle}>{TEAM_TYPE_LABELS[teamType]}</h3>
        {/* Team-type picker — stejný SegmentedControl jako ostatní volby v aplikaci (feat-021, Příklad 8) */}
        <SegmentedControl<TeamType>
          options={TEAM_TYPE_OPTIONS}
          value={teamType}
          onChange={onChangeType}
        />
      </div>

      {/* ── Kanban board — fills all available vertical space ── */}
      {/* data-tutorial-target lets the spotlight overlay focus on this team's kanban board */}
      <div
        data-tutorial-target={tutorialTargetPrefix ? `${tutorialTargetPrefix}-kanban` : undefined}
        className={styles.board}
      >
        {/* To Do — neutrální */}
        <KanbanColumn
          title="To Do"
          count={state.backlog.length}
          flow="todo"
        >
          {state.backlog.map(f => (
            <FeatureCard key={f.id} feature={f} compact neutral maxWork={maxWork} />
          ))}
          {state.backlog.length === 0 && <EmptyNote>Backlog empty</EmptyNote>}
        </KanbanColumn>

        {/* In Progress — fialová (accent) */}
        <KanbanColumn
          title="In Progress"
          count={state.inProgress.length}
          flow="doing"
        >
          {state.inProgress.map(f => (
            <FeatureCard key={f.id} feature={f} compact team={state.team} maxWork={maxWork} />
          ))}
          {state.inProgress.length === 0 && <EmptyNote>Nothing in flight</EmptyNote>}
        </KanbanColumn>

        {/* Done — zelená (done) */}
        {/* Počet všech hotových features, ne jen zobrazených karet (feat-001, Příklad 6) */}
        <KanbanColumn
          title="Done"
          count={doneCount(state)}
          flow="done"
        >
          {state.done.map(f => {
            const lt = (f.finishedAt ?? 0) - f.createdAt
            return (
              <div key={f.id}>
                <FeatureCard feature={f} compact maxWork={maxWork} />
                <div className={styles.leadTime}>{lt.toFixed(1)}s</div>
              </div>
            )
          })}
          {state.done.length === 0 && <EmptyNote>None yet</EmptyNote>}
        </KanbanColumn>
      </div>

      {/* ── Metrics — pinned below kanban, single row ── */}
      {/* data-tutorial-target lets the spotlight overlay focus on this team's result metrics */}
      <div
        data-tutorial-target={tutorialTargetPrefix ? `${tutorialTargetPrefix}-results` : undefined}
        className={styles.metrics}
      >
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

      {/* ── Team composition — pinned at bottom ── */}
      {/* data-tutorial-target lets the spotlight overlay focus on this team's member roster */}
      <div
        data-tutorial-target={tutorialTargetPrefix ? `${tutorialTargetPrefix}-composition` : undefined}
        className={styles.composition}
      >
        <SectionTitle>Team composition</SectionTitle>
        <div className={styles.members}>
          {state.team.map(m => {
            const ct = m.currentTask
              ? state.inProgress.find(f => f.id === m.currentTask!.featureId)
                  ?.tasks.find(t => t.id === m.currentTask!.taskId) ?? null
              : null
            const cf = ct
              ? state.inProgress.find(f => f.id === m.currentTask!.featureId) ?? null
              : null
            const fillPct = ct ? (ct.progress / ct.work) * 100 : 0
            const swatchStyle: CssVariables | undefined = cf ? { '--hue': cf.hue } : undefined
            const progressStyle: CssVariables | undefined = ct ? { '--role': ROLE_META[ct.role]?.color ?? 'var(--accent)' } : undefined

            return (
              <div key={m.id} className={styles.member}>
                <div className={styles.memberTop}>
                  <div className={styles.avatar}>{memberInitial(m.name)}</div>
                  <span className={styles.memberName}>{m.name}</span>
                </div>
                {/* Role chips — read-only */}
                <div className={styles.chips}>
                  {m.roles.map(r => (
                    <RoleChip key={r} role={r} color={ROLE_META[r]?.color ?? 'var(--ink-3)'} label={ROLE_META[r]?.label} />
                  ))}
                </div>
                {/* Progress or idle */}
                <div className={styles.work}>
                  {cf && ct ? (
                    <>
                      <div className={styles.workLine}>
                        <span className={styles.swatch} style={swatchStyle} />
                        <span className={styles.workName}>{cf.name}</span>
                      </div>
                      <div className={styles.progress} style={progressStyle}>
                        <div className={styles.progressFill} style={{ width: `${fillPct}%` }} />
                      </div>
                    </>
                  ) : (
                    <div className={styles.idle}>
                      <span className={styles.idleDot} />
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

/** Nadpisek sekce sloupce („Team composition“) ve stylu „eyebrow“. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className={styles.sectionTitle}>{children}</div>
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

  return (
    <div title={tooltip} className={[styles.metric, isBetter && styles.metricBetter].filter(Boolean).join(' ')}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue}>{value}</div>
      {delta !== undefined && (
        <div className={[styles.metricDelta, delta < 0 && styles.metricDeltaBetter].filter(Boolean).join(' ')}>
          {delta < 0
            ? `↓ ${Math.abs(delta).toFixed(0)}% ${dl.better}`
            : `↑ ${delta.toFixed(0)}% ${dl.worse}`}
          <span className={styles.metricVs}>{vsLabel}</span>
        </div>
      )}
    </div>
  )
}

/** Props jednoho sloupce Kanbanu. */
interface KanbanColumnProps {
  /** Nadpis sloupce. */
  title: string
  /** Počet položek ve sloupci. */
  count: number
  /** Stav toku sloupce — určuje barvu hlavičky (To Do neutrální, In Progress accent, Done done). */
  flow: 'todo' | 'doing' | 'done'
  children: React.ReactNode
}

/** One column of the Kanban board with a flow-state header and scrollable item list. */
function KanbanColumn({ title, count, flow, children }: KanbanColumnProps) {
  const headClass = [styles.columnHead, flow === 'doing' && styles.doing, flow === 'done' && styles.done].filter(Boolean).join(' ')
  return (
    <div className={styles.column}>
      <div className={headClass}>
        <span>{title}</span>
        <span className={styles.count}>{count}</span>
      </div>
      <div className={styles.columnBody}>{children}</div>
    </div>
  )
}


