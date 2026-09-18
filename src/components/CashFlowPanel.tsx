import { REVENUE_TICK_INTERVAL_SEC } from '@/simulation/engine'
import { StatTile } from '@/components/StatTile'
import { PanelHeader } from '@/components/PanelHeader'
import { formatEuro } from '@/lib/formatCurrency'
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
  revenueDelta?: number
  /** Popisek "as of" referenčního času pro revenueDelta, např. "@ 00:50.0" — zobrazí se pod
   *  Total Revenue dlaždicí, kdykoli je revenueDelta definovaná. Nutné, protože revenueDelta
   *  neporovnává finální totaly obou běhů, ale hodnoty ve stejném dřívějším bodě (feat-015
   *  time-matched refinement) — bez tohoto labelu by srovnání vypadalo jako přímé porovnání
   *  finálních čísel, což by bylo zavádějící. */
  revenueDeltaHint?: string
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
 * @param revenueDelta - % rozdíl Total Revenue vs. předchozí dokončený běh (vyšší = lepší),
 *   time-matched k dřívějšímu ze dvou celkových časů (feat-015 refinement)
 * @param revenueDeltaHint - Popisek referenčního času pro revenueDelta (např. "@ 00:50.0")
 */
export function CashFlowPanel({
  state, stats, totalTimeDisplay, avgWip, timeDelta, ltDelta, wipDelta, revenueDelta, revenueDeltaHint,
}: CashFlowPanelProps) {
  const done = state.done
  const totalRevenueAllTime = state.totalRevenueAllTime

  return (
    <aside style={{ borderLeft: '1px solid var(--line)', background: 'var(--panel)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '12px 14px 14px', borderBottom: '1px solid var(--line)', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-2)' }}>Metrics</h3>
          <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{stats.count} feature{stats.count !== 1 ? 's' : ''} sampled</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 6 }}>
          <StatTile label="Total Time" value={totalTimeDisplay} variant="timer" finished={state.finished} wide tooltip="Elapsed simulation time." delta={timeDelta} />
          <StatTile label="Avg Cycle Time" value={stats.count ? stats.avg.toFixed(1) : '—'} unit={stats.count ? 's' : undefined} tooltip="Mean cycle time across all completed features (from work start to delivery)." delta={ltDelta} />
          <StatTile label="Avg WIP" value={avgWip !== null ? avgWip.toFixed(1) : '—'} tooltip="Average Work In Progress — lower usually means lower cycle time (Little's Law)." delta={wipDelta} />
          <StatTile label="Total Revenue" value={formatEuro(totalRevenueAllTime)} tooltip="Cumulative revenue from all delivered features." delta={revenueDelta} hint={revenueDeltaHint} higherIsBetter />
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <PanelHeader title="Done" count={done.length} />
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
                <div style={{ fontSize: 9, color: 'var(--ink-3)' }}>{formatEuro(f.revenuePerTick)}/tick</div>
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
