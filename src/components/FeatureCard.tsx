import { ROLE_META } from '@/simulation/engine'
import type { Feature, Member } from '@/types/simulation'

interface FeatureCardProps {
  feature: Feature
  team?: Member[]
  compact?: boolean
  neutral?: boolean
}

export function FeatureCard({ feature, team = [], compact = false, neutral = false }: FeatureCardProps) {
  const total = feature.tasks.length
  const segW = `${100 / total}%`
  const bg = neutral ? 'var(--panel)' : `oklch(96% 0.03 ${feature.hue})`
  const border = neutral ? 'var(--line)' : `oklch(80% 0.08 ${feature.hue})`
  const barH = compact ? 6 : 22

  const initialFor = (id: number | null) => {
    if (id == null) return null
    const m = team.find(m => m.id === id)
    return m ? m.name[0] : null
  }

  return (
    <div style={{
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
      <div style={{ display: 'flex', height: barH, gap: 2, borderRadius: 3, overflow: 'hidden' }}>
        {feature.tasks.map((t) => {
          const meta = ROLE_META[t.role]
          const filled = t.status === 'done' ? 1 : (t.status === 'doing' ? t.progress / t.work : 0)
          const initial = !compact && t.status === 'doing' ? initialFor(t.assignee) : null
          return (
            <div key={t.id} style={{ width: segW, background: 'rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${filled * 100}%`, background: meta.color }} />
              {t.status === 'todo' && (
                <div style={{ position: 'absolute', inset: 0, background: meta.color, opacity: 0.25 }} />
              )}
              {initial && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, color: 'white',
                  textShadow: '0 0 2px rgba(0,0,0,0.35)',
                  pointerEvents: 'none', letterSpacing: 0.2,
                }}>
                  {initial}
                </div>
              )}
              {!compact && t.status === 'done' && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, color: 'rgba(255,255,255,0.85)', pointerEvents: 'none',
                }}>✓</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
