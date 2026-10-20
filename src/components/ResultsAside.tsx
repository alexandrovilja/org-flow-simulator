import type { ReactNode } from 'react'
import { PanelHeader } from '@/components/PanelHeader'
import { EmptyNote } from '@/components/EmptyNote'
import styles from './ResultsAside.module.css'

/** Cíle tutoriálu (`data-tutorial-target`) pro jednotlivé části panelu; všechny jsou volitelné. */
interface ResultsAsideTargets {
  /** Celý panel (spotlight na metriky i Done). */
  aside?: string
  /** Hlavička Metrics a dlaždice. */
  metrics?: string
  /** Hlavička a seznam Done. */
  done?: string
}

/** Props společného pravého panelu. */
interface ResultsAsideProps {
  /** Počet dokončených features, ze kterých jsou statistiky — ukáže se v poznámce „N features sampled“. */
  sampleCount: number
  /** Dlaždice metrik (StatTile) — každý mód má svou sadu. */
  tiles: ReactNode
  /** Počet všech hotových features v hlavičce Done, ne jen zobrazených řádků (feat-001, Příklad 6). */
  doneCount: number
  /** Seznam Done je prázdný — místo řádků se ukáže „No completed features yet.“ */
  isEmpty: boolean
  /** Řádky hotových features (DoneRow). */
  children: ReactNode
  /** Volitelné cíle tutoriálu; jen Advanced je používá. */
  tutorialTargets?: ResultsAsideTargets
}

/**
 * Pravý sloupec Advanced a Cash Flow (feat-022): hlavička Metrics s dlaždicemi nahoře a seznam
 * Done dole. Rozložení je na jednom místě, módy mu předávají jen svoje dlaždice a řádky Done.
 *
 * @param props - Počet vzorků, dlaždice, počet hotových features, příznak prázdného seznamu, řádky a cíle tutoriálu
 * @returns Vykreslený panel
 */
export function ResultsAside({ sampleCount, tiles, doneCount, isEmpty, children, tutorialTargets }: ResultsAsideProps) {
  return (
    <aside data-tutorial-target={tutorialTargets?.aside} className={styles.aside}>
      <div data-tutorial-target={tutorialTargets?.metrics} className={styles.metrics}>
        <PanelHeader title="Metrics" hint={`${sampleCount} feature${sampleCount !== 1 ? 's' : ''} sampled`} />
        <div className={styles.tiles}>{tiles}</div>
      </div>

      <div data-tutorial-target={tutorialTargets?.done} className={styles.done}>
        <PanelHeader title="Done" count={doneCount} />
        <div className={styles.doneList}>
          {isEmpty && <EmptyNote>No completed features yet.</EmptyNote>}
          {children}
        </div>
      </div>
    </aside>
  )
}
