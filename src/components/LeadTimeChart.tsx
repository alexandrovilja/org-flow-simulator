import type { LeadTimeEntry, SimStats } from '@/types/simulation'
import styles from './LeadTimeChart.module.css'

/** Props grafu lead time. */
interface LeadTimeChartProps {
  /** Lead time dokončených features v pořadí dokončení. */
  leadTimes: LeadTimeEntry[]
  /** Statistiky (počet, průměr, p85, maximum) — určují měřítko a referenční čáry. */
  stats: SimStats
}

/**
 * Bodový graf lead time dokončených features (design system Org Flow, feat-021): body v `accent`,
 * průměr čárkovaně v `ink`, 85. percentil plnou čarou ve `wait`. Pozice bodů a čar se počítají
 * inline, vzhled je v LeadTimeChart.module.css.
 *
 * @param props - Lead time dokončených features a jejich statistiky
 * @returns Graf, nebo prázdný stav, dokud nic nedoběhlo
 */
export function LeadTimeChart({ leadTimes, stats }: LeadTimeChartProps) {
  if (stats.count === 0) {
    return <div className={styles.empty}>Waiting for first completed feature…</div>
  }

  const maxY = Math.max(stats.max * 1.1, 5)
  const H = 110
  const padTop = 6, padBottom = 14, padLeft = 28, padRight = 8

  const N = leadTimes.length
  const points = leadTimes.map((l, i) => ({
    x: N === 1 ? 50 : (i / (N - 1)) * 100,
    yPct: 1 - (l.ms / maxY),
    ms: l.ms,
    id: l.id,
  }))

  const yLineFor = (val: number) => `${(1 - val / maxY) * 100}%`

  return (
    <div className={styles.chart} style={{ height: H, paddingLeft: padLeft, paddingRight: padRight }}>
      {/* Osa Y: maximum, polovina, nula */}
      <div className={styles.axisY} style={{ top: padTop, bottom: padBottom, width: padLeft - 4 }}>
        <span>{maxY.toFixed(0)}s</span>
        <span>{(maxY / 2).toFixed(0)}s</span>
        <span>0s</span>
      </div>

      <div className={styles.plot} style={{ left: padLeft, right: padRight, top: padTop, bottom: padBottom }}>
        {[0.25, 0.5, 0.75].map(p => (
          <div key={p} className={styles.grid} style={{ top: `${p * 100}%` }} />
        ))}

        <div className={`${styles.ref} ${styles.p85}`} style={{ top: yLineFor(stats.p85) }}>
          <span className={styles.refLabel}>p85 {stats.p85.toFixed(1)}s</span>
        </div>

        <div className={`${styles.ref} ${styles.avg}`} style={{ top: yLineFor(stats.avg) }}>
          <span className={styles.refLabel}>avg {stats.avg.toFixed(1)}s</span>
        </div>

        {points.map(p => (
          <div
            key={p.id}
            title={`F-${String(p.id).padStart(3, '0')} · ${p.ms.toFixed(1)}s`}
            className={styles.dot}
            style={{ left: `${p.x}%`, top: `${p.yPct * 100}%` }}
          />
        ))}
      </div>

      {/* Osa X: pořadí dokončení */}
      <div className={styles.axisX} style={{ left: padLeft, right: padRight }}>
        <span>oldest</span>
        <span>completion order →</span>
        <span>newest</span>
      </div>
    </div>
  )
}
