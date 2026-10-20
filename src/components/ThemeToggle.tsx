'use client'

import { useSyncExternalStore } from 'react'
import type { ThemeName } from '@/types/theme'
import { applyTheme, getCurrentTheme, subscribeTheme } from '@/lib/theme'
import { Button } from '@/components/Button'

/**
 * Téma, se kterým se přepínač vykreslí na serveru. Server neví, co si uživatel zvolil; React pak
 * při hydrataci přečte skutečné téma z <html> a přepínač hned překreslí.
 */
const SERVER_THEME: ThemeName = 'light'

/** Ikona měsíce (☾) — nabízí přepnutí do tmavého tématu. */
function MoonIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M11.5 8.6A5 5 0 0 1 5.4 2.5a5 5 0 1 0 6.1 6.1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

/** Ikona slunce (☀) — nabízí přepnutí do světlého tématu. */
function SunIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="2.6" stroke="currentColor" strokeWidth="1.4" />
      {/* Osm paprsků po 45° */}
      <path
        d="M7 0.8v1.6M7 11.6v1.6M0.8 7h1.6M11.6 7h1.6M2.6 2.6l1.1 1.1M10.3 10.3l1.1 1.1M2.6 11.4l1.1-1.1M10.3 3.7l1.1-1.1"
        stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * Přepínač světlého a tmavého tématu v horní liště (feat-021, Příklad 5). Ukazuje ikonu tématu,
 * na které kliknutí přepne: ve světlém ☾, v tmavém ☀. Přístupný název říká totéž slovy
 * („Switch to dark theme“ / „Switch to light theme“).
 *
 * @returns Kulaté tlačítko s ikonou pro antracitovou lištu
 */
export function ThemeToggle() {
  // Téma čteme z <html>, kde ho nastavil inline skript, a odebíráme jeho změny
  const theme = useSyncExternalStore(subscribeTheme, getCurrentTheme, () => SERVER_THEME)
  const next: ThemeName = theme === 'dark' ? 'light' : 'dark'
  const label = `Switch to ${next} theme`

  return (
    <Button onBar iconOnly aria-label={label} title={label} onClick={() => applyTheme(next)}>
      {next === 'dark' ? <MoonIcon /> : <SunIcon />}
    </Button>
  )
}
