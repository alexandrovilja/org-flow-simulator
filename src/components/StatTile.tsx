import { useState } from 'react'
import { formatPercent } from '@/lib/formatPercent'
import styles from './StatTile.module.css'

interface StatTileProps {
  label: string
  value: string
  unit?: string
  hint?: string
  tooltip?: string
  variant?: 'default' | 'timer'
  finished?: boolean
  wide?: boolean
  /**
   * Procentuální změna oproti předchozímu běhu simulace.
   * Výchozí sémantika (higherIsBetter=false, platí pro Cycle Time/WIP/Wait/Handoffs):
   * záporná hodnota = pokles = zlepšení = zelená šipka dolů; kladná = nárůst = zhoršení = červená šipka nahoru.
   * Undefined = první běh, žádné srovnání není k dispozici.
   */
  delta?: number
  /**
   * Obrátí barevnou sémantiku delta indikátoru — pro metriky, kde vyšší hodnota je lepší
   * (např. Total Revenue). Šipka (↓/↑) vždy odpovídá skutečnému směru změny, mění se jen barva:
   * kladná delta = zelená (zlepšení), záporná = červená (zhoršení). Výchozí: false.
   */
  higherIsBetter?: boolean
  /** Volitelný obsah pod hodnotou (nad hintem a deltou) — např. rozpadový pruh s legendou (feat-016). */
  children?: React.ReactNode
  /**
   * Volitelný rozbalitelný detail (feat-018). Když je zadaný, dlaždice dostane tlačítko „Details“
   * s `aria-expanded`; obsah se vykresluje jen v rozbaleném stavu. Ve výchozím stavu je sbalený.
   */
  details?: React.ReactNode
  /** Volitelný `data-tutorial-target` dlaždice (feat-025: dlaždice výnosu v Cash Flow). */
  tutorialTarget?: string
}

/**
 * Dlaždice jedné metriky v panelu Metrics: popisek, velká hodnota, volitelný hint, delta badge
 * oproti předchozímu běhu a volitelný rozbalitelný detail. Existuje, aby všechny metriky
 * (Compare, Advanced, Cash Flow) vypadaly a chovaly se stejně.
 *
 * @param props - Popisek, hodnota, jednotka, hint, tooltip, varianta, delta (v %), `higherIsBetter`
 *   (obrací barvy delty), `children` (obsah pod hodnotou) a `details` (rozbalitelný detail, feat-018)
 * @returns Vykreslená dlaždice
 */
export function StatTile({ label, value, unit, hint, tooltip, variant, finished, wide, delta, higherIsBetter = false, children, details, tutorialTarget }: StatTileProps) {
  const isTimer = variant === 'timer'
  // Stav rozbalení je lokální — nepersistuje se (feat-018); rodič ho resetuje změnou `key`
  const [expanded, setExpanded] = useState(false)
  // Text delty (bez znaménka a %) a příznak „beze změny“ — malé rozdíly se nesmí tvářit jako zlepšení/zhoršení
  const deltaText = delta === undefined ? '' : formatPercent(Math.abs(delta))
  const isUnchanged = delta !== undefined && deltaText === '0.0'

  // Delta: zlepšení zeleně (done), zhoršení červeně (rework), „beze změny“ neutrálně — šipka nese význam vždy
  const deltaClass = isUnchanged ? styles.deltaFlat : (higherIsBetter ? (delta ?? 0) > 0 : (delta ?? 0) < 0) ? styles.deltaGood : styles.deltaBad
  const tileClass = [
    styles.tile,
    isTimer && styles.timer,
    isTimer && finished && styles.finished,
    tooltip && styles.withTooltip,
  ].filter(Boolean).join(' ')

  return (
    <div
      title={tooltip}
      data-testid={`stat-tile-${label}`}
      data-tutorial-target={tutorialTarget}
      className={tileClass}
      // '1 / -1' roztáhne dlaždici přes všechny sloupce nadřazeného gridu
      // (aktuálně repeat(2, 1fr) v Simulator.tsx — při změně gridu upravit i toto)
      style={wide ? { gridColumn: '1 / -1' } : undefined}
    >
      <div className={styles.head}>
        <span className={styles.label}>
          {label}
          {tooltip && !isTimer && <span className={styles.helpBadge} aria-hidden="true">?</span>}
        </span>
        {isTimer && (
          finished
            ? <span className={styles.complete}>✓ Complete</span>
            : <span className={styles.live} />
        )}
      </div>
      {/* Třída „mono“ zůstává: E2E test feat-015 podle ní hledá hodnotu časovače */}
      <span className={`mono ${styles.value}`}>
        {value}
        {unit && <span className={styles.unit}>{unit}</span>}
      </span>
      {children}
      {hint && <span className={styles.hint}>{hint}</span>}
      {/* Delta indikátor porovnávající aktuální hodnotu s předchozím během.
          Šipka vždy odpovídá skutečnému směru změny; barva závisí na higherIsBetter
          (výchozí: záporné delta = pokles = zlepšení = zelená; obráceně pro higherIsBetter). */}
      {delta !== undefined && (
        <span className={`${styles.delta} ${deltaClass}`}>
          {isUnchanged ? `→ ${deltaText}%` : delta < 0 ? `↓ ${deltaText}%` : `↑ ${deltaText}%`}
          {' '}
          <span className={styles.deltaNote}>vs prev run</span>
        </span>
      )}
      {details !== undefined && (
        <>
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded(e => !e)}
            className={styles.detailsButton}
          >
            Details {expanded ? '▴' : '▾'}
          </button>
          {expanded && <div className={styles.details}>{details}</div>}
        </>
      )}
    </div>
  )
}
