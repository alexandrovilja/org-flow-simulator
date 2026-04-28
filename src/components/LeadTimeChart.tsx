import type { LeadTimeEntry, SimStats } from '@/types/simulation'

interface LeadTimeChartProps {
  leadTimes: LeadTimeEntry[]
  stats: SimStats
}

export function LeadTimeChart({ leadTimes, stats }: LeadTimeChartProps) {
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
    )
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ position: 'relative', height: H, paddingLeft: padLeft, paddingRight: padRight }}>
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

        <div style={{
          position: 'absolute',
          left: padLeft, right: padRight, top: padTop, bottom: padBottom,
          background: 'var(--bg)',
          border: '1px solid var(--line)',
          borderRadius: 4, overflow: 'hidden',
        }}>
          {[0.25, 0.5, 0.75].map(p => (
            <div key={p} style={{ position: 'absolute', left: 0, right: 0, top: `${p * 100}%`, height: 1, background: 'var(--line)' }} />
          ))}

          <div style={{ position: 'absolute', left: 0, right: 0, top: yLineFor(stats.p85), height: 1, background: 'var(--warn)', opacity: 0.8 }}>
            <span className="mono" style={{ position: 'absolute', right: 4, top: -11, fontSize: 9, color: 'var(--warn)', fontWeight: 600, background: 'var(--bg)', padding: '0 3px' }}>
              p85 {stats.p85.toFixed(1)}s
            </span>
          </div>

          <div style={{ position: 'absolute', left: 0, right: 0, top: yLineFor(stats.avg), height: 1, background: 'var(--ink)', opacity: 0.6, borderTop: '1px dashed var(--ink)' }}>
            <span className="mono" style={{ position: 'absolute', left: 4, top: -11, fontSize: 9, color: 'var(--ink)', fontWeight: 600, background: 'var(--bg)', padding: '0 3px' }}>
              avg {stats.avg.toFixed(1)}s
            </span>
          </div>

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
  )
}
