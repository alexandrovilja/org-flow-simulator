import type { ThemeName } from '@/types/theme'
import { saveThemePreference } from '@/lib/storage'

// Aktuální téma žije jako atribut `data-theme` na <html>: nastaví ho THEME_INIT_SCRIPT ještě před
// Reactem a CSS tokeny v globals.css se podle něj přepínají. Tento modul je jediné místo, které ho
// po načtení mění, a dává o změně vědět komponentám (ThemeToggle) přes useSyncExternalStore.

/** Funkce, které chtějí vědět o změně tématu (předplatitelé z useSyncExternalStore). */
const listeners = new Set<() => void>()

/**
 * Vrátí téma, které je právě na stránce aktivní.
 * Cokoli jiného než `dark` (i chybějící atribut) znamená světlé téma, protože to je výchozí `:root`.
 *
 * @returns 'light' nebo 'dark'
 */
export function getCurrentTheme(): ThemeName {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

/**
 * Přihlásí odběr změn tématu. Tvar odpovídá parametru `subscribe` hooku useSyncExternalStore.
 *
 * @param listener - Funkce volaná po každé změně tématu
 * @returns Funkce, která odběr zruší
 */
export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/**
 * Přepne téma stránky a zapamatuje si volbu uživatele, aby přežila znovunačtení.
 * Odběratele upozorní synchronně, takže se přepínač překreslí hned po kliknutí.
 *
 * @param theme - Téma, které se má použít
 */
export function applyTheme(theme: ThemeName): void {
  document.documentElement.dataset.theme = theme
  saveThemePreference(theme)
  listeners.forEach(listener => listener())
}
