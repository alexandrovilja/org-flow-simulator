import type { ReactNode } from 'react'
import styles from './EmptyNote.module.css'

/** Props prázdného stavu. */
interface EmptyNoteProps {
  /** Krátký popis stavu, např. „Nothing in flight“ nebo „None yet“. */
  children: ReactNode
  /** Volitelná pozice v mřížce (In progress panel ji roztahuje přes všechny sloupce). */
  gridColumn?: string
}

/**
 * Prázdný stav seznamu karet (design system Org Flow, feat-021) — jednotný vzhled pro Kanban
 * v Compare, panel In progress a seznamy Done.
 *
 * @param props - Text prázdného stavu a volitelná pozice v mřížce
 * @returns Vykreslená poznámka
 */
export function EmptyNote({ children, gridColumn }: EmptyNoteProps) {
  return <div className={styles.note} style={gridColumn ? { gridColumn } : undefined}>{children}</div>
}
