import { useState } from 'react'
import { formatPercent } from '@/lib/formatPercent'

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
export function StatTile({ label, value, unit, hint, tooltip, variant, finished, wide, delta, higherIsBetter = false, children, details }: StatTileProps) {
  const isTimer = variant === 'timer'
  // Stav rozbalení je lokální — nepersistuje se (feat-018); rodič ho resetuje změnou `key`
  const [expanded, setExpanded] = useState(false)
  // Text delty (bez znaménka a %) a příznak „beze změny“ — malé rozdíly se nesmí tvářit jako zlepšení/zhoršení
  const deltaText = delta === undefined ? '' : formatPercent(Math.abs(delta))
  const isUnchanged = delta !== undefined && deltaText === '0.0'

  const borderColor = isTimer && finished ? 'var(--done)' : 'var(--line)'
  const bg = isTimer && finished ? 'oklch(97% 0.02 155)' : 'var(--panel)'

  return (
    <div title={tooltip} data-testid={`stat-tile-${label}`} style={{
      background: bg,
      border: `1px solid ${borderColor}`,
      borderRadius: 6,
      padding: isTimer ? '10px 12px' : '8px 10px',
      display: 'flex', flexDirection: 'column', gap: isTimer ? 4 : 2,
      minWidth: 0,
      cursor: tooltip ? 'help' : 'default',
      // '1 / -1' roztáhne dlaždici přes všechny sloupce nadřazeného gridu
      // (aktuálně repeat(2, 1fr) v Simulator.tsx — při změně gridu upravit i toto)
      gridColumn: wide ? '1 / -1' : undefined,
      transition: 'background 0.3s, border-color 0.3s',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{
          fontSize: 10, color: 'var(--ink-3)',
          textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500,
          display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          {label}
          {tooltip && !isTimer && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 11, height: 11, borderRadius: '50%',
              background: 'var(--line)', color: 'var(--ink-3)',
              fontSize: 8, fontWeight: 700,
            }}>?</span>
          )}
        </span>
        {isTimer && (
          finished
            ? <span style={{ fontSize: 10, color: 'var(--done)', fontWeight: 600, letterSpacing: 0.3 }}>✓ Complete</span>
            : <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--done)',
                display: 'inline-block',
                animation: 'timer-pulse 1.2s ease-in-out infinite',
              }} />
        )}
      </div>
      <span className="mono" style={{
        fontSize: isTimer ? 22 : 18,
        fontWeight: 600,
        color: isTimer && finished ? 'var(--done)' : 'var(--ink)',
        lineHeight: 1.1,
        transition: 'color 0.3s',
        letterSpacing: isTimer ? -0.5 : 0,
      }}>
        {value}
        {unit && <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 2, fontWeight: 500 }}>{unit}</span>}
      </span>
      {children}
      {hint && <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{hint}</span>}
      {/* Delta indikátor porovnávající aktuální hodnotu s předchozím během.
          Šipka vždy odpovídá skutečnému směru změny; barva závisí na higherIsBetter
          (výchozí: záporné delta = pokles = zlepšení = zelená; obráceně pro higherIsBetter). */}
      {delta !== undefined && (
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          // Změna, která se zaokrouhlí na 0.0 %, je „beze změny“ — neutrální šedá, ne zelená/červená
          color: isUnchanged ? 'var(--ink-3)' : (higherIsBetter ? delta > 0 : delta < 0) ? 'var(--done)' : 'oklch(58% 0.2 25)',
          letterSpacing: 0.2,
        }}>
          {isUnchanged ? `→ ${deltaText}%` : delta < 0 ? `↓ ${deltaText}%` : `↑ ${deltaText}%`}
          {' '}
          <span style={{ fontWeight: 400, color: 'var(--ink-3)' }}>vs prev run</span>
        </span>
      )}
      {details !== undefined && (
        <>
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded(e => !e)}
            style={{
              alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0,
              fontSize: 10, color: 'var(--ink-3)', cursor: 'pointer', textDecoration: 'underline',
            }}
          >
            Details {expanded ? '▴' : '▾'}
          </button>
          {expanded && (
            <div style={{ fontSize: 10, color: 'var(--ink-2)', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {details}
            </div>
          )}
        </>
      )}
    </div>
  )
}
