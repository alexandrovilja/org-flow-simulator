import { useEffect, useRef, useState } from 'react'
import { REVENUE_TICK_INTERVAL_SEC, doneCount, plateauRevenuePerTick } from '@/simulation/engine'
import { StatTile } from '@/components/StatTile'
import { PanelHeader } from '@/components/PanelHeader'
import { CoordinationChips } from '@/components/CoordinationChips'
import { formatEuro } from '@/lib/formatCurrency'
import { formatTime } from '@/lib/formatTime'
import { formatPercent } from '@/lib/formatPercent'
import type { RevenueComparison } from '@/lib/revenueComparison'
import type { SimState, SimStats } from '@/types/simulation'

/** Vstupní props komponenty CashFlowPanel — pravý sloupec (Metriky + Done) Cash Flow módu. */
interface CashFlowPanelProps {
  /** Vlastní, nezávislý SimState Cash Flow módu — spravovaný a tikaný v Simulator.tsx. */
  state: SimState
  /** Předpočítané statistiky z leadTimes (memoizované v Simulator.tsx). */
  stats: SimStats
  /** Naformátovaný Total Time text (formatTime nebo "00:00.0"). */
  totalTimeDisplay: string
  /** Průměrný WIP (Little's Law) — null dokud simulace neběžela dost dlouho. */
  avgWip: number | null
  /** Delty vs. poslední přirozeně dokončený běh (stejný mechanismus jako Advanced mód). */
  timeDelta?: number
  ltDelta?: number
  wipDelta?: number
  /** Hodnoty dlaždice „Revenue (time-matched)“ (feat-018): velké číslo, delta a data detailu.
   *  Počítá je `computeRevenueComparison` v Simulator.tsx. */
  revenueComparison: RevenueComparison
  /** true = coordination overhead je v tomto běhu zapnutý → zobrazí se dlaždice a čipy (feat-016). */
  showCoordination?: boolean
  /** % rozdíl Coordination overhead vs. předchozí dokončený běh (nižší = lepší). */
  coordinationDelta?: number
}

/**
 * Cash Flow mód — pravý sloupec (Metriky + Done s revenue). Backlog a In Progress/Team
 * sloupce sdílí s Advanced módem přes `BacklogSettingsPanel`/`InProgressTeamPanel` (feat-015:
 * plná parita s Advanced). Čistě prezentační komponenta — veškerý stav pochází z reálného
 * simulačního enginu, spravovaného v Simulator.tsx přes `useCashFlowSimSetup`.
 *
 * @param state - Aktuální SimState Cash Flow simulace
 * @param stats - Statistiky cyklu (počítané v Simulator.tsx přes computeStats)
 * @param totalTimeDisplay - Naformátovaný celkový čas
 * @param avgWip - Průměrný WIP
 * @param timeDelta - % rozdíl Total Time vs. předchozí dokončený běh
 * @param ltDelta - % rozdíl Avg Cycle Time vs. předchozí dokončený běh
 * @param wipDelta - % rozdíl Avg WIP vs. předchozí dokončený běh
 * @param revenueComparison - Výnos ve společném čase obou běhů, delta (vyšší = lepší) a data
 *   rozbalitelného detailu dlaždice „Revenue (time-matched)“ (feat-018)
 * @param showCoordination - Zobrazit dlaždici Coordination overhead a čipy v Done listu (feat-016)
 * @param coordinationDelta - % rozdíl Coordination overhead vs. předchozí dokončený běh
 */
export function CashFlowPanel({
  state, stats, totalTimeDisplay, avgWip, timeDelta, ltDelta, wipDelta, revenueComparison,
  showCoordination = false, coordinationDelta,
}: CashFlowPanelProps) {
  // Poměr handoff : rework v rozpadovém pruhu dlaždice — šířky segmentů v % celkového overheadu
  const joinTaxShare = stats.coordinationPct > 0 ? (stats.joinTaxPct / stats.coordinationPct) * 100 : 0
  const done = state.done

  // Detail dlaždice výnosu se sbalí při Resetu: simulační čas se vrátí zpět (i uprostřed běhu).
  // Samotný start běhu (0 → >0) čas nesníží, takže rozbalený detail zůstane. Efekt běží při každé
  // změně simTime, ale `setRunEpoch` volá jen při Resetu; změna `key` dlaždici přemountuje.
  const [runEpoch, setRunEpoch] = useState(0)
  const lastSimTime = useRef(state.simTime)
  useEffect(() => {
    if (state.simTime < lastSimTime.current) setRunEpoch(e => e + 1)
    lastSimTime.current = state.simTime
  }, [state.simTime])

  // Hint pod hodnotou: za běhu upozorní, že jde o průběžný součet (po doběhnutí se přepočte na
  // společný čas); po srovnání ukáže společný čas, ale jen když k němu existuje delta
  const { comparison } = revenueComparison
  const revenueHint = comparison?.delta !== undefined
    ? `@ ${formatTime(comparison.compareTime)}`
    : (!state.finished && state.simTime > 0 ? 'live total' : undefined)

  return (
    <aside style={{ borderLeft: '1px solid var(--line)', background: 'var(--surface-panel)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '12px 14px 14px', borderBottom: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-2)' }}>Metrics</h3>
          <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{stats.count} feature{stats.count !== 1 ? 's' : ''} sampled</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
          <StatTile label="Total Time" value={totalTimeDisplay} variant="timer" finished={state.finished} wide tooltip="Elapsed simulation time." delta={timeDelta} />
          <StatTile label="Avg Cycle Time" value={stats.count ? stats.avg.toFixed(1) : '—'} unit={stats.count ? 's' : undefined} tooltip="Mean cycle time across all completed features (from work start to delivery)." delta={ltDelta} />
          <StatTile label="Avg WIP" value={avgWip !== null ? avgWip.toFixed(1) : '—'} tooltip="Average Work In Progress — lower usually means lower cycle time (Little's Law)." delta={wipDelta} />
          <StatTile
            key={runEpoch}
            label="Revenue (time-matched)"
            value={formatEuro(revenueComparison.value)}
            tooltip="Revenue of both runs compared at the same point in time (the shorter run's total time), so a longer run does not look better just because it ran longer. Open Details for the full total."
            delta={comparison?.delta}
            hint={revenueHint}
            higherIsBetter
            details={
              <>
                <div>Total {formatEuro(revenueComparison.currentTotal.revenue)} in {formatTime(revenueComparison.currentTotal.time)}</div>
                {comparison && (
                  <>
                    <div>Previous run @ {formatTime(comparison.compareTime)}: {formatEuro(comparison.previous.revenueAtCompare)}</div>
                    <div>Previous total {formatEuro(comparison.previous.totalRevenue)} in {formatTime(comparison.previous.totalTime)}</div>
                  </>
                )}
              </>
            }
          />
          {showCoordination && (
            <StatTile
              label="Coordination overhead"
              value={stats.count ? formatPercent(stats.coordinationPct) : '—'}
              unit={stats.count ? '% of cycle time' : undefined}
              tooltip="Extra work caused by coordination, relative to feature cycle time: handoff tax (extra work each additional unit pays when it joins a feature) plus rework (progress lost when units understood the feature differently). It is counted in work-seconds across all units, so highly parallel teams can show high values. Units using AI process this extra work faster, so the share can be higher than the time it actually took."
              delta={coordinationDelta}
            >
              {stats.count > 0 && (
                <>
                  {/* Rozpadový pruh handoff / rework — barvy shodné s čipy na kartách */}
                  <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', background: 'var(--line)', margin: '4px 0 2px' }}>
                    <div style={{ width: `${joinTaxShare}%`, background: 'var(--ink-3)' }} />
                    <div style={{ flex: 1, background: stats.reworkPct > 0 ? 'var(--rework)' : 'transparent' }} />
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 2, background: 'var(--ink-3)' }} />
                    handoff {formatPercent(stats.joinTaxPct)} %
                    <span style={{ margin: '0 2px' }}>·</span>
                    <span style={{ width: 6, height: 6, borderRadius: 2, background: 'var(--rework)' }} />
                    rework {formatPercent(stats.reworkPct)} %
                  </span>
                </>
              )}
            </StatTile>
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Počet všech hotových features, ne jen zobrazených karet (feat-001, Příklad 6) */}
        <PanelHeader title="Done" count={doneCount(state)} />
        <div style={{ flex: 1, overflow: 'auto', padding: '6px 14px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {done.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic', padding: '8px 0' }}>No completed features yet.</div>
          )}
          {done.map(f => (
            <div key={f.id} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
              background: `oklch(96% 0.03 ${f.hue})`,
              border: `1px solid oklch(82% 0.06 ${f.hue})`,
              borderRadius: 5,
            }}>
              <span style={{ width: 4, alignSelf: 'stretch', background: `oklch(60% 0.14 ${f.hue})`, borderRadius: 2 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="mono" style={{ fontSize: 10, color: 'var(--ink-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                <div style={{ fontSize: 9, color: 'var(--ink-3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {/* Ustálený výnos (feat-017) — stejné číslo jako badge v Backlogu; pulse vpravo ukazuje skutečný přírůstek ticku */}
                  {formatEuro(plateauRevenuePerTick(f))}/tick
                  {/* Čipy coordination overhead (feat-016) — v Done listu bez pulse, událost už nevzniká */}
                  {showCoordination && <CoordinationChips joins={f.joinCount} reworks={f.reworkCount} />}
                </div>
                {/* Progress bar odpočtu do dalšího revenue ticku — vlastní nezávislý cyklus této featury. */}
                <div style={{ height: 3, background: 'var(--line)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, ((state.simTime - f.lastRevenueTickAt) / REVENUE_TICK_INTERVAL_SEC) * 100)}%`,
                    background: 'var(--done)',
                  }} />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1, minWidth: 44 }}>
                <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--done)' }}>{formatEuro(f.totalRevenue)}</span>
                {f.lastTickRevenue !== null && (
                  <span key={f.lastRevenueTickAt} className="mono" style={{
                    fontSize: 9, fontWeight: 600, color: 'var(--done)',
                    animation: 'revenue-pulse 1.6s ease-out forwards',
                  }}>
                    +{formatEuro(f.lastTickRevenue)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
