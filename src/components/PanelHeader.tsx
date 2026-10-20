import styles from './PanelHeader.module.css'

/** Props hlavičky panelu. */
interface PanelHeaderProps {
  /** Nadpis panelu (např. „Backlog“, „In Progress“, „Done“). */
  title: string
  /** Počet položek vedle nadpisu. */
  count: number
  /** Volitelná poznámka vpravo, např. „auto-scaled“. */
  hint?: string
}

/**
 * Hlavička panelu podle design systému Org Flow (feat-021): nadpisek v mono verzálkách,
 * počet v `ink-3` a volitelná poznámka vpravo. Počet je sourozenec nadpisu (ne jeho součást),
 * aby přístupný název nadpisu zůstal jen „Backlog“, „Done“… a počet šel přečíst zvlášť.
 *
 * @param props - Nadpis, počet a volitelná poznámka
 * @returns Vykreslená hlavička
 */
export function PanelHeader({ title, count, hint }: PanelHeaderProps) {
  return (
    <div className={styles.header}>
      <div className={styles.titleRow}>
        <h3 className={styles.title}>{title}</h3>
        <span className={styles.count}>{count}</span>
      </div>
      {hint && <span className={styles.hint}>{hint}</span>}
    </div>
  )
}
