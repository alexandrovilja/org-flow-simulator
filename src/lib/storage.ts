/**
 * Persistent storage helpers for Org Flow Simulator.
 * All localStorage access in the app goes through this module —
 * components must never call localStorage directly.
 *
 * Tutorial flags:
 *   'tutorial-completed'   — set permanently when user finishes or skips any tutorial
 *   'tutorial-seen-modes'  — JSON array of TutorialMode strings the user has already seen
 *
 * Preset:
 *   'unit-preset'          — active preset id: 'teams' | 'people' | 'custom'
 *
 * Theme (feat-021):
 *   'theme'                — the user's chosen colour theme: 'light' | 'dark'
 */

import type { TutorialMode } from '@/types/tutorial'
import type { ActivePresetId } from '@/types/simulation'
import type { ThemeName } from '@/types/theme'

// ── Key constants ─────────────────────────────────────────────────────────────

/** localStorage key that records whether the user has completed (or skipped) the tutorial. */
const TUTORIAL_COMPLETED_KEY = 'tutorial-completed'

/**
 * localStorage key that stores a JSON array of modes the user has already been
 * shown a tutorial for — e.g. ["compare", "experiment"].
 */
const TUTORIAL_SEEN_MODES_KEY = 'tutorial-seen-modes'

/** localStorage key that records the active unit preset ('teams' | 'people' | 'custom'). */
const ACTIVE_PRESET_KEY = 'unit-preset'

/**
 * localStorage key with the user's chosen colour theme ('light' | 'dark').
 * Exported because the inline THEME_INIT_SCRIPT (src/lib/themeInitScript.ts) must read the same key
 * before React loads — the one deliberate exception to "localStorage only through this module".
 */
export const THEME_KEY = 'theme'

// ── Tutorial: completed flag ───────────────────────────────────────────────────

/**
 * Returns true if the user has previously finished or skipped the tutorial.
 * Used by Simulator.tsx to decide whether to auto-launch the tutorial on load.
 */
export function isTutorialCompleted(): boolean {
  return localStorage.getItem(TUTORIAL_COMPLETED_KEY) === 'true'
}

/**
 * Permanently marks the tutorial as completed in localStorage.
 * Called both when the user clicks "Finish" and when they click "Skip tutorial".
 */
export function markTutorialCompleted(): void {
  localStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true')
}

// ── Tutorial: per-mode seen flags ─────────────────────────────────────────────

/**
 * Returns the set of modes the user has already seen a tutorial for.
 * Reads from a JSON-encoded array stored in localStorage.
 *
 * @returns A Set of TutorialMode strings.
 */
function getSeenModes(): Set<TutorialMode> {
  try {
    const raw = localStorage.getItem(TUTORIAL_SEEN_MODES_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as TutorialMode[]
    return new Set(parsed)
  } catch {
    // If the stored value is malformed JSON, treat it as empty.
    return new Set()
  }
}

/**
 * Returns true if the user has already been shown the tutorial for the given mode.
 *
 * @param mode - The application mode to check ('compare' or 'experiment').
 */
export function hasSeenMode(mode: TutorialMode): boolean {
  return getSeenModes().has(mode)
}

/**
 * Permanently records that the user has seen the tutorial for the given mode.
 * Called when a per-mode tutorial is completed or skipped.
 *
 * @param mode - The application mode that was just tutorialised.
 */
export function markModeSeen(mode: TutorialMode): void {
  const seen = getSeenModes()
  seen.add(mode)
  localStorage.setItem(TUTORIAL_SEEN_MODES_KEY, JSON.stringify([...seen]))
}

// ── Tutorial: reset ───────────────────────────────────────────────────────────

/**
 * Clears all tutorial-related flags from localStorage.
 * Intended for use in tests (beforeEach cleanup) and the manual "restart tutorial"
 * flow triggered by the ? button in the header.
 */
export function resetTutorial(): void {
  localStorage.removeItem(TUTORIAL_COMPLETED_KEY)
  localStorage.removeItem(TUTORIAL_SEEN_MODES_KEY)
}

// ── Active preset ─────────────────────────────────────────────────────────────

/**
 * Returns the currently stored active preset id.
 * Defaults to 'teams' when nothing is stored — Teams is the default preset
 * shown on first load.
 */
export function getActivePresetId(): ActivePresetId {
  const stored = localStorage.getItem(ACTIVE_PRESET_KEY)
  if (stored === 'teams' || stored === 'people' || stored === 'custom') return stored
  // No stored value means first visit — return the default preset.
  return 'teams'
}

/**
 * Persists the active preset id to localStorage.
 * Called whenever the user clicks a preset button or makes a manual edit.
 *
 * @param id - The preset id to store ('teams', 'people', or 'custom')
 */
export function setActivePresetId(id: ActivePresetId): void {
  localStorage.setItem(ACTIVE_PRESET_KEY, id)
}

/**
 * Removes the stored preset id from localStorage.
 * Intended for use in tests (beforeEach cleanup) so tests start with the
 * default 'teams' value without bleeding state between test cases.
 */
export function resetActivePresetId(): void {
  localStorage.removeItem(ACTIVE_PRESET_KEY)
}

// ── Theme (feat-021) ──────────────────────────────────────────────────────────

/**
 * Returns the colour theme the user picked with the theme toggle, if any.
 * Without a stored choice the app follows the system setting (prefers-color-scheme).
 *
 * @returns 'light' or 'dark', or null when nothing valid is stored
 */
export function loadThemePreference(): ThemeName | null {
  const stored = localStorage.getItem(THEME_KEY)
  // Anything else (old or hand-edited value) is ignored so the system setting applies again
  return stored === 'light' || stored === 'dark' ? stored : null
}

/**
 * Remembers the colour theme the user picked, so it survives a page reload.
 *
 * @param theme - The chosen theme
 */
export function saveThemePreference(theme: ThemeName): void {
  localStorage.setItem(THEME_KEY, theme)
}
