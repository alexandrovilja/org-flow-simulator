import type { SimStats, SimState } from '@/types/simulation'
import { calcCompareDelta } from '@/simulation/compareMode'

interface WinnerBannerProps {
  stateA: SimState
  statsA: SimStats
  stateB: SimState
  statsB: SimStats
}

/**
 * Banner displayed once both simulations have finished.
 * Identifies the faster team by Avg Lead Time and shows the percentage
 * improvement — the primary "aha moment" of the Compare mode.
 */
export function WinnerBanner({ stateA, statsA, stateB, statsB }: WinnerBannerProps) {
  if (!stateA.finished || !stateB.finished) return null
  if (statsA.count === 0 || statsB.count === 0) return null

  const delta = calcCompareDelta(statsA.avg, statsB.avg)
  if (delta === undefined) return null

  // Negative delta means Team B has lower (better) lead time.
  const bWins = delta < 0
  const improvementPct = Math.abs(delta).toFixed(0)

  const winner     = bWins ? 'B' : 'A'
  const winnerName = bWins ? 'Multi Skill Specialists' : 'Single Skill Specialists'
  // Hue follows the team colour convention (A = orange, B = green).
  const hue        = bWins ? 155 : 30

  return (
    <div style={{
      margin: '0 16px',
      padding: '12px 16px',
      borderRadius: 10,
      background: `oklch(96% 0.025 ${hue})`,
      border: `1px solid oklch(84% 0.07 ${hue})`,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <span style={{ fontSize: 22, flexShrink: 0 }}>
        {bWins ? '🚀' : '⚡'}
      </span>
      <div>
        <span style={{ fontSize: 14, fontWeight: 700, color: `oklch(35% 0.12 ${hue})` }}>
          Team {winner} ({winnerName}) was {improvementPct}% faster.
        </span>
        <span style={{ fontSize: 13, color: `oklch(48% 0.08 ${hue})` }}>
          {bWins
            ? '  Broader skills meant less waiting between stages.'
            : '  Deep specialisation meant each person stayed fully loaded.'}
        </span>
      </div>
    </div>
  )
}
