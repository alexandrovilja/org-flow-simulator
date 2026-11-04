import type { ReactNode } from 'react'
import styles from './ValueUnit.module.css'

/** Props jednotky za číslem. */
interface ValueUnitProps {
  /** Text jednotky, např. „days“. Chce-li se mezera v textu (kopírování, čtečky), patří na začátek textu (např. „ days“). */
  children: ReactNode
  /** true = těsnější odsazení od čísla (výchozí je volnější, počítá s mezerou v textu). */
  tight?: boolean
}

/**
 * Jednotka za číslem hodnoty (feat-027): malé tlumené písmo vedle velkého čísla, např. **9.1** days.
 * Sdílí ji `StatTile`, dlaždice v Compare a `WorkTimeValue`, aby vzhled jednotky žil na jednom místě.
 *
 * @param props - Text jednotky a těsnější odsazení
 * @returns Prvek `<span>` s jednotkou
 */
export function ValueUnit({ children, tight = false }: ValueUnitProps) {
  return <span className={tight ? `${styles.unit} ${styles.tight}` : styles.unit}>{children}</span>
}
