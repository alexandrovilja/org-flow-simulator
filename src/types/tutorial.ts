/** The three application modes that each have their own tutorial walkthrough (feat-025 adds Cash Flow).
 *  'compare'    = two-team side-by-side comparison view (default on first load)
 *  'experiment' = full sandbox view with all controls (tab "Advanced")
 *  'cashflow'   = Advanced plus revenue tracking (tab "Cash Flow") */
export type TutorialMode = 'compare' | 'experiment' | 'cashflow'

/** One step in the spotlight tutorial walkthrough.
 *  Each step highlights a single UI element and explains what it does. */
export interface TutorialStep {
  /** Unique identifier for this step within its tour — used as a React key. */
  id: string
  /**
   * Part of the tour the step belongs to (e.g. "TOP BAR", "COMPARE"). Shown in the card header as
   * "CHAPTER · n / N" so a long tour reads as a few short parts (feat-025).
   */
  chapter: string
  /** Short bold title shown above the explanation (feat-025). */
  title: string
  /**
   * Explanation shown to the user in the tutorial card.
   * May contain links written as `[label](https://…)` — the overlay turns them into links that open
   * in a new tab (see `splitTutorialText` in src/lib/tutorialText.ts).
   */
  description: string
  /**
   * Optional bullet points shown under the description (used by the welcome card, feat-025).
   * They may contain links in the same `[label](https://…)` form.
   */
  bullets?: string[]
  /**
   * Matches the value of the `data-tutorial-target` attribute on the DOM element
   * that should be spotlighted. The overlay uses this to position the highlight.
   *
   * **Special case — empty string `''`**: signals an intentional "no spotlight" step.
   * The overlay renders a full dark backdrop with the card centred on the screen.
   * Use this for intro steps where there is no specific element to point at (the welcome card).
   */
  targetId: string
  /**
   * Optional: `data-tutorial-target` of the parent panel that contains `targetId`.
   * When set, the overlay renders two levels of dimming:
   *   • Outer (dark)  — covers everything outside the parent panel.
   *   • Inner (lighter) — covers the rest of the parent panel, so only the
   *     specific sub-element (`targetId`) is fully visible.
   * Use this for steps that drill into a sub-section of a larger panel so the
   * user retains context ("I'm still inside Team A") while focusing on the detail.
   */
  parentTargetId?: string
  /**
   * Optional: `data-tutorial-target` to spotlight when `targetId` is not in the DOM right now
   * (e.g. the first To Do card after a finished run, when To Do is empty — feat-025, Example 7).
   */
  fallbackTargetId?: string
}

/**
 * One piece of a tutorial text after links have been found in it (feat-025).
 * Plain text is rendered as is; a link is rendered as an `<a>` that opens in a new tab.
 */
export type TutorialTextPart =
  | { kind: 'text'; text: string }
  | { kind: 'link'; label: string; href: string }
