/**
 * Persistent storage helpers for Org Flow Simulator.
 * All localStorage access in the app goes through this module —
 * components must never call localStorage directly.
 *
 * Tutorial flags:
 *   'tutorial-completed'   — set permanently when user finishes or skips any tutorial
 *   'tutorial-seen-modes'  — JSON array of TutorialMode strings the user has already seen
 */

import type { TutorialMode } from '@/types/tutorial'

// ── Key constants ─────────────────────────────────────────────────────────────

/** localStorage key that records whether the user has completed (or skipped) the tutorial. */
const TUTORIAL_COMPLETED_KEY = 'tutorial-completed'

/**
 * localStorage key that stores a JSON array of modes the user has already been
 * shown a tutorial for — e.g. ["compare", "experiment"].
 */
const TUTORIAL_SEEN_MODES_KEY = 'tutorial-seen-modes'

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
