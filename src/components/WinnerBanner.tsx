import type { SimStats, SimState } from '@/types/simulation'
import { calcCompareDelta } from '@/simulation/compareMode'
import styles from './WinnerBanner.module.css'

/** Props rámu výsledku: oba běhy Compare a jejich statistiky. */
interface WinnerBannerProps {
  stateA: SimState
  statsA: SimStats
  stateB: SimState
  statsB: SimStats
}

/**
 * Rám výsledku, který se ukáže, když obě simulace v Compare doběhnou (design system Org Flow,
 * feat-021, Příklad 9): písmeno vítězného týmu, titulek „Team B was 42% faster“ podle průměrného
 * lead time, jedna věta proč a ručně psaná poznámka kouče. Týmy se nerozlišují barvou (dřív
 * oranžová / zelená), ale písmenem — rám bere barvy jen z tokenů a nemá emoji.
 *
 * @param props - Stav a statistiky obou týmů
 * @returns Rám výsledku, nebo nic, dokud oba běhy nedoběhnou
 */
export function WinnerBanner({ stateA, statsA, stateB, statsB }: WinnerBannerProps) {
  if (!stateA.finished || !stateB.finished) return null
  if (statsA.count === 0 || statsB.count === 0) return null

  const delta = calcCompareDelta(statsA.avg, statsB.avg)
  if (delta === undefined) return null

  // Negative delta means Team B has lower (better) lead time.
  const bWins = delta < 0
  const improvementPct = Math.abs(delta).toFixed(0)
  const winner = bWins ? 'B' : 'A'

  return (
    <div className={styles.frame} role="status">
      <span className={styles.badge}>{winner}</span>
      <div>
        <div className={styles.eyebrow}>Result · avg lead time</div>
        <h2 className={styles.title}>
          Team {winner} was <em className={styles.gain}>{improvementPct}% faster</em>
        </h2>
        <p className={styles.reason}>
          {bWins
            ? 'Broader skills meant less waiting between stages.'
            : 'Deep specialisation meant each person stayed fully loaded.'}
        </p>
      </div>
      <div className={styles.note}>same backlog!</div>
    </div>
  )
}
