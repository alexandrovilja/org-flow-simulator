import type { FeedbackRating } from '@/types/feedback'
import { FEEDBACK_RATINGS, FEEDBACK_RATING_LABELS } from '@/lib/feedback'
import styles from './RatingScale.module.css'

/** Props škály hodnocení. */
interface RatingScaleProps {
  /** Vybraný bod; `null` = nic nevybráno. */
  value: FeedbackRating | null
  /** Nová hodnota po kliknutí; klik na už vybraný bod pošle `null` (zrušení výběru). */
  onChange: (value: FeedbackRating | null) => void
  /** Id prvku s textem otázky nad škálou — skupina tlačítek ponese její název. */
  labelId: string
}

/**
 * Škála užitečnosti 1–5 pro dialog zpětné vazby (feat-024, Příklady 4 a 5). Pět stejně širokých
 * hranatých polí ve stylu segmentového přepínače; vybraný bod má plnou výplň a body pod ním jemný
 * podklad, takže je vidět i „kolik“ hodnocení je. Pod škálou jsou názvy krajních bodů a po výběru
 * uprostřed název vybraného bodu. Vlastní komponenta, protože `SegmentedControl` je pro 2–4 volby.
 *
 * @param props - Vybraná hodnota, obsluha změny a id popisku s otázkou
 * @returns Skupina pěti tlačítek s popisky pod nimi
 */
export function RatingScale({ value, onChange, labelId }: RatingScaleProps) {
  return (
    <div className={styles.root}>
      <div role="group" aria-labelledby={labelId} className={styles.track}>
        {FEEDBACK_RATINGS.map(point => {
          const name = `${point} – ${FEEDBACK_RATING_LABELS[point]}`
          // Body pod vybraným dostanou jemný podklad — škála se čte i jako míra, ne jen jako volba
          const below = value !== null && point < value
          return (
            <button
              key={point}
              type="button"
              className={[styles.point, below && styles.below].filter(Boolean).join(' ')}
              aria-pressed={point === value}
              aria-label={name}
              title={name}
              onClick={() => onChange(point === value ? null : point)}
            >
              {point}
            </button>
          )
        })}
      </div>

      {/* Popisky pod škálou jsou jen vizuální — přístupné názvy nesou samotná tlačítka */}
      <div className={styles.legend} aria-hidden="true">
        <span>{FEEDBACK_RATING_LABELS[1]}</span>
        <span className={styles.picked}>{value === null ? '' : FEEDBACK_RATING_LABELS[value]}</span>
        <span>{FEEDBACK_RATING_LABELS[5]}</span>
      </div>
    </div>
  )
}
