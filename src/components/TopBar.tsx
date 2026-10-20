import type { ReactNode } from 'react'
import type { AppMode } from '@/types/simulation'
import { ThemeToggle } from '@/components/ThemeToggle'
import styles from './TopBar.module.css'

/** Jedna záložka módu: text v UI a cíl tutoriálu, který ji zvýrazňuje. */
interface ModeTab {
  mode: AppMode
  label: string
  tutorialTarget: string
}

/** Záložky v pořadí zleva doprava. Texty bez emoji (feat-021, Příklad 4). */
const MODE_TABS: ModeTab[] = [
  { mode: 'compare', label: 'Compare', tutorialTarget: 'mode-tab-compare' },
  { mode: 'experiment', label: 'Advanced', tutorialTarget: 'mode-tab-advanced' },
  { mode: 'cashflow', label: 'Cash Flow', tutorialTarget: 'mode-tab-cashflow' },
]

/** Props horní lišty. */
interface TopBarProps {
  /** Aktuální mód — jeho záložka je označená jako vybraná. */
  mode: AppMode
  /** Kliknutí na záložku; Simulator rozhodne, co přepnutí módu obnáší (např. reset Compare). */
  onSelectMode: (mode: AppMode) => void
  /** Ovládání běhu vpravo — ve všech módech stejný SpeedControl (Cash Flow bez „?“), liší se jen obsluha Resetu. */
  children: ReactNode
}

/**
 * Antracitová horní lišta aplikace (design system Org Flow, feat-021): značka a název vlevo,
 * záložky módů uprostřed (role="tablist", aktivní má aria-selected) a vpravo přepínač tématu
 * a ovládání běhu.
 * Existuje, aby všechny tři módy měly stejnou lištu a lišily se jen ovládáním.
 *
 * @param props - Aktuální mód, callback přepnutí módu a ovládání vpravo
 * @returns Vykreslená lišta
 */
export function TopBar({ mode, onSelectMode, children }: TopBarProps) {
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
        {/* Přepínač tématu je ve všech módech stejný, proto ho lišta vykresluje sama, vedle „?“ */}
        <ThemeToggle />
        {children}
      </div>
    </header>
  )
}
