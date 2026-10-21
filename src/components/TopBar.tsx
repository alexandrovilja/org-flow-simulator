import type { ReactNode } from 'react'
import type { AppMode } from '@/types/simulation'
import { Button } from '@/components/Button'
import { ThemeToggle } from '@/components/ThemeToggle'
import { MODE_LABELS } from '@/lib/modeLabels'
import styles from './TopBar.module.css'

/** Přístupný název i tooltip ikony zpětné vazby (feat-024, Příklad 1). */
const FEEDBACK_LABEL = 'Send feedback'

/** Ikona bubliny se zprávou — otevře dialog zpětné vazby. Stejná mřížka 14 × 14 jako ikony tématu. */
function FeedbackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      {/* Bublina s ocáskem vlevo dole */}
      <path d="M2 2.2h10v7.2H6.2L3.4 11.8V9.4H2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

/** Jedna záložka módu: text v UI a cíl tutoriálu, který ji zvýrazňuje. */
interface ModeTab {
  mode: AppMode
  label: string
  tutorialTarget: string
}

/** Záložky v pořadí zleva doprava. Texty bez emoji (feat-021, Příklad 4). */
const MODE_TABS: ModeTab[] = [
  { mode: 'compare', label: MODE_LABELS.compare, tutorialTarget: 'mode-tab-compare' },
  { mode: 'experiment', label: MODE_LABELS.experiment, tutorialTarget: 'mode-tab-advanced' },
  { mode: 'cashflow', label: MODE_LABELS.cashflow, tutorialTarget: 'mode-tab-cashflow' },
]

/** Props horní lišty. */
interface TopBarProps {
  /** Aktuální mód — jeho záložka je označená jako vybraná. */
  mode: AppMode
  /** Kliknutí na záložku; Simulator rozhodne, co přepnutí módu obnáší (např. reset Compare). */
  onSelectMode: (mode: AppMode) => void
  /** Ovládání běhu vpravo — ve všech módech stejný SpeedControl (Cash Flow bez „?“), liší se jen obsluha Resetu. */
  children: ReactNode
  /** Kliknutí na ikonu bubliny — Simulator otevře dialog zpětné vazby (feat-024). */
  onOpenFeedback: () => void
}

/**
 * Antracitová horní lišta aplikace (design system Org Flow, feat-021): značka a název vlevo,
 * záložky módů uprostřed (role="tablist", aktivní má aria-selected) a vpravo ikona zpětné vazby,
 * přepínač tématu a ovládání běhu.
 * Existuje, aby všechny tři módy měly stejnou lištu a lišily se jen ovládáním.
 *
 * @param props - Aktuální mód, callback přepnutí módu, otevření zpětné vazby a ovládání vpravo
 * @returns Vykreslená lišta
 */
export function TopBar({ mode, onSelectMode, children, onOpenFeedback }: TopBarProps) {
  return (
    <header className={styles.bar}>
      <div className={styles.brand}>
        <span className={styles.mark} aria-hidden="true">
          {/* Značka: tři uzly spojené linkami — síť, kterou práce putuje mezi lidmi */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="3" cy="3" r="1.6" fill="white" />
            <circle cx="11" cy="3" r="1.6" fill="white" />
            <circle cx="7" cy="11" r="1.6" fill="white" />
            <path d="M3 3 L11 3 M3 3 L7 11 M11 3 L7 11" stroke="white" strokeWidth="0.7" />
          </svg>
        </span>
        <span className={styles.wordmark}>
          <span className={styles.name}>Org Flow Simulator</span>
          <span className={styles.tagline}>Same backlog · different team</span>
        </span>
      </div>

      <nav className={styles.tabs} role="tablist" aria-label="Mode">
        {MODE_TABS.map(tab => (
          <button
            key={tab.mode}
            type="button"
            role="tab"
            aria-selected={mode === tab.mode}
            data-tutorial-target={tab.tutorialTarget}
            className={styles.tab}
            onClick={() => onSelectMode(tab.mode)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div className={styles.controls}>
        {/* Zpětná vazba a přepínač tématu jsou ve všech módech stejné, proto je lišta vykresluje sama, před „?“ */}
        <Button
          onBar
          iconOnly
          aria-label={FEEDBACK_LABEL}
          title={FEEDBACK_LABEL}
          data-tutorial-target="feedback-button"
          onClick={onOpenFeedback}
        >
          <FeedbackIcon />
        </Button>
        <ThemeToggle />
        {children}
      </div>
    </header>
  )
}
