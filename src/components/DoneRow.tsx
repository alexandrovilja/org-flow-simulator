import type { ReactNode } from 'react'
import type { CssVariables } from '@/types/css'
import styles from './DoneRow.module.css'

/** Props řádku hotové feature. */
interface DoneRowProps {
  /** Odstín feature (0–360) — tón řádku a čtvereček. */
  hue: number
  /** Název feature, např. „F-001 Login flow“. */
  name: string
  /** Druhý řádek pod názvem (počet tasků, výnos za tick, čipy). */
  detail: ReactNode
  /** Hodnota vpravo (lead time v Advanced, celkový výnos v Cash Flow). */
  value: ReactNode
  /** Volitelný přírůstek pod hodnotou (v Cash Flow „+€299“), který se po vzniku krátce rozbliká. */
  delta?: ReactNode
  /** Změna klíče spustí probliknutí přírůstku znovu (v Cash Flow čas posledního výnosu). */
  deltaKey?: string | number
  /** Volitelný obsah pod detailem (v Cash Flow odpočet do dalšího ticku výnosu). */
  children?: ReactNode
}

/**
 * Řádek hotové feature v seznamu Done (design system Org Flow, feat-021). Sdílí ho Advanced
 * (lead time) a Cash Flow (výnos), aby oba seznamy vypadaly stejně a vzhled žil na jednom místě.
 *
 * @param props - Odstín a název feature, detail, hodnota vpravo, volitelný přírůstek a obsah pod detailem
 * @returns Vykreslený řádek
 */
export function DoneRow({ hue, name, detail, value, delta, deltaKey, children }: DoneRowProps) {
  const style: CssVariables = { '--hue': hue }
  return (
    <div className={styles.row} style={style}>
      <span className={styles.swatch} aria-hidden="true" />
      <div className={styles.main}>
        <div className={styles.name}>{name}</div>
        <div className={styles.detail}>{detail}</div>
        {children}
      </div>
      <div className={styles.aside}>
        <span className={styles.value}>{value}</span>
        {delta != null && <span key={deltaKey} className={styles.delta}>{delta}</span>}
      </div>
    </div>
  )
}
