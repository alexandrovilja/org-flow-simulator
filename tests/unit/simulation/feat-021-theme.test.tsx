import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Simulator } from '@/components/Simulator'
import { loadThemePreference, saveThemePreference, markTutorialCompleted, markModeSeen, resetTutorial } from '@/lib/storage'
import { THEME_INIT_SCRIPT } from '@/lib/themeInitScript'

// feat-021 (Převod na design system Org Flow) — tmavé téma Workshop dark.
//
// Schválený kontrakt (spec features/feat-021-prevod-design-system-org-flow.md):
//  - Příklad 5: bez uložené volby se téma řídí systémem (prefers-color-scheme); kliknutí na přepínač
//    v horní liště téma přepne a volba přežije znovunačtení stránky.
//  - Technical Notes: volba se ukládá přes src/lib/storage.ts (klíč „theme“). Malý inline skript
//    THEME_INIT_SCRIPT (src/lib/themeInitScript.ts) nastaví data-theme na <html> ještě před
//    vykreslením — jediná výjimka z pravidla „localStorage jen přes storage.ts“, proto se testuje.
//  - Přepínač je komponenta ThemeToggle: přístupný název „Switch to light theme“ v tmavém tématu,
//    „Switch to dark theme“ ve světlém.

/**
 * Nahradí window.matchMedia (jsdom ho nemá) odpovědí pro `prefers-color-scheme: dark`.
 *
 * @param prefersDark - Co „systém“ preferuje
 */
function mockSystemTheme(prefersDark: boolean): void {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes('dark') ? prefersDark : !prefersDark,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

/** Spustí inline skript tak, jak ho prohlížeč spustí v <head>. */
function runInitScript(): void {
  new Function(THEME_INIT_SCRIPT)()
}

const html = () => document.documentElement

beforeEach(() => {
  localStorage.clear()
  delete html().dataset.theme
  resetTutorial()
  markTutorialCompleted()
  markModeSeen('compare')
  markModeSeen('experiment')
})

afterEach(() => {
  delete html().dataset.theme
})

describe('feat-021 Příklad 5: uložení volby tématu (storage.ts)', () => {
  it('bez uložené volby vrací null', () => {
    expect(loadThemePreference()).toBeNull()
  })

  it('uložená volba se načte zpět a leží pod klíčem „theme“', () => {
    saveThemePreference('dark')
    expect(loadThemePreference()).toBe('dark')
    expect(localStorage.getItem('theme')).toBe('dark')
    saveThemePreference('light')
    expect(loadThemePreference()).toBe('light')
  })

  it('neplatná hodnota v úložišti se ignoruje', () => {
    localStorage.setItem('theme', 'purple')
    expect(loadThemePreference()).toBeNull()
  })
})

describe('feat-021 Příklad 5: téma před vykreslením (THEME_INIT_SCRIPT)', () => {
  it('bez uložené volby a se systémem v tmavém režimu nastaví data-theme="dark"', () => {
    mockSystemTheme(true)
    runInitScript()
    expect(html().dataset.theme).toBe('dark')
  })

  it('bez uložené volby a se systémem ve světlém režimu nastaví data-theme="light"', () => {
    mockSystemTheme(false)
    runInitScript()
    expect(html().dataset.theme).toBe('light')
  })

  it('uložená volba má přednost před systémem', () => {
    mockSystemTheme(true)
    localStorage.setItem('theme', 'light')
    runInitScript()
    expect(html().dataset.theme).toBe('light')
  })
})

describe('feat-021 Příklad 5: přepínač tématu (ThemeToggle)', () => {
  it('v tmavém tématu nabízí přepnutí na světlé; kliknutí přepne <html> i uloženou volbu', () => {
    html().dataset.theme = 'dark'
    render(<ThemeToggle />)
    fireEvent.click(screen.getByRole('button', { name: 'Switch to light theme' }))
    expect(html().dataset.theme).toBe('light')
    expect(loadThemePreference()).toBe('light')
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeInTheDocument()
  })

  it('ve světlém tématu nabízí přepnutí na tmavé', () => {
    html().dataset.theme = 'light'
    render(<ThemeToggle />)
    fireEvent.click(screen.getByRole('button', { name: 'Switch to dark theme' }))
    expect(html().dataset.theme).toBe('dark')
    expect(loadThemePreference()).toBe('dark')
  })

  it('přepínač je v horní liště ve všech třech módech', () => {
    html().dataset.theme = 'light'
    render(<Simulator />)
    const toggle = () => screen.getByRole('button', { name: /^Switch to (light|dark) theme$/ })
    expect(toggle()).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Advanced' }))
    expect(toggle()).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'Cash Flow' }))
    expect(toggle()).toBeInTheDocument()
  })
})
