import type { ReactNode } from 'react'
import styles from './PanelHeader.module.css'

/** Props hlavičky panelu. */
interface PanelHeaderProps {
  /** Nadpis panelu (např. „Backlog“, „In Progress“, „Done“). */
  title: string
  /** Počet položek vedle nadpisu; hlavička bez počtu (např. „Metrics“) ho vynechá. Text místo čísla
   *  dovolí souhrn o více počtech, např. „3 teams · 12 people“ v módu Organization (feat-028). */
  count?: number | string
  /** Volitelná poznámka vpravo, např. „auto-scaled“. */
  hint?: string
  /** Volitelný doplněk hned za počtem, např. „7 idle“ v hlavičce organizace (feat-029). */
  children?: ReactNode
  /** Volitelné ovládací prvky vpravo před poznámkou, např. filtr „1 waiting“ v In progress (feat-029). */
  actions?: ReactNode
}

/**
 * Hlavička panelu podle design systému Org Flow (feat-021): nadpisek v mono verzálkách,
 * počet v `ink-3` a volitelná poznámka vpravo. Počet je sourozenec nadpisu (ne jeho součást),
 * aby přístupný název nadpisu zůstal jen „Backlog“, „Done“… a počet šel přečíst zvlášť.
 * Doplněk za počtem a ovládací prvky vpravo jsou volitelné; bez nich se hlavička nemění.
 *
 * @param props - Nadpis, volitelný počet, poznámka, doplněk za počtem a ovládací prvky
 * @returns Vykreslená hlavička
 */
export function PanelHeader({ title, count, hint, children, actions }: PanelHeaderProps) {
  const hintEl = hint ? <span className={styles.hint}>{hint}</span> : null
  return (
    <div className={styles.header}>
      <div className={styles.titleRow}>
        <h3 className={styles.title}>{title}</h3>
        {count !== undefined && <span className={styles.count}>{count}</span>}
        {children}
      </div>
      {actions ? <div className={styles.aside}>{actions}{hintEl}</div> : hintEl}
    </div>
  )
}
