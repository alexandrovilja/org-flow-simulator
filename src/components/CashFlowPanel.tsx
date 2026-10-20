import { useEffect, useRef, useState } from 'react'
import { REVENUE_TICK_INTERVAL_SEC, doneCount, plateauRevenuePerTick } from '@/simulation/engine'
import { StatTile } from '@/components/StatTile'
import { ResultsAside } from '@/components/ResultsAside'
import { CoordinationChips } from '@/components/CoordinationChips'
import { DoneRow } from '@/components/DoneRow'
import { formatEuro } from '@/lib/formatCurrency'
import { formatTime } from '@/lib/formatTime'
import { formatPercent } from '@/lib/formatPercent'
import type { RevenueComparison } from '@/lib/revenueComparison'
import styles from './CashFlowPanel.module.css'
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
    <ResultsAside
      sampleCount={stats.count}
      doneCount={doneCount(state)}
      isEmpty={done.length === 0}
      tiles={<>
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
                <div className={styles.breakdownBar}>
                  <div className={styles.handoffFill} style={{ width: `${joinTaxShare}%` }} />
                  <div className={[styles.reworkSlot, stats.reworkPct > 0 && styles.reworkFill].filter(Boolean).join(' ')} />
                </div>
                <span className={styles.legend}>
                  <span className={`${styles.dot} ${styles.dotHandoff}`} />
                  handoff {formatPercent(stats.joinTaxPct)} %
                  <span className={styles.legendSeparator}>·</span>
                  <span className={`${styles.dot} ${styles.dotRework}`} />
                  rework {formatPercent(stats.reworkPct)} %
                </span>
              </>
            )}
          </StatTile>
        )}
      </>}
    >
      {done.map(f => (
        <DoneRow
          key={f.id}
          hue={f.hue}
          name={f.name}
          detail={<>
            {/* Ustálený výnos (feat-017) — stejné číslo jako badge v Backlogu; pulse vpravo ukazuje skutečný přírůstek ticku */}
            {formatEuro(plateauRevenuePerTick(f))}/tick
            {/* Čipy coordination overhead (feat-016) — v Done listu bez pulse, událost už nevzniká */}
            {showCoordination && <CoordinationChips joins={f.joinCount} reworks={f.reworkCount} />}
          </>}
          value={formatEuro(f.totalRevenue)}
          delta={f.lastTickRevenue !== null ? `+${formatEuro(f.lastTickRevenue)}` : undefined}
          deltaKey={f.lastRevenueTickAt}
        >
          {/* Progress bar odpočtu do dalšího revenue ticku — vlastní nezávislý cyklus této featury. */}
          <div className={styles.countdown}>
            <div
              className={styles.countdownFill}
              style={{ width: `${Math.min(100, ((state.simTime - f.lastRevenueTickAt) / REVENUE_TICK_INTERVAL_SEC) * 100)}%` }}
            />
          </div>
        </DoneRow>
      ))}
    </ResultsAside>
  )
}
