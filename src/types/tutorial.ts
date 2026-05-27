/** The two application modes that each have their own tutorial walkthrough.
 *  'compare'    = two-team side-by-side comparison view (default on first load)
 *  'experiment' = full sandbox view with all controls */
export type TutorialMode = 'compare' | 'experiment'

/** One step in the spotlight tutorial walkthrough.
 *  Each step highlights a single UI element and explains what it does. */
export interface TutorialStep {
  /** Unique identifier for this step — used as a React key. */
  id: string
  /** Explanation shown to the user in the tutorial card. */
  description: string
  /**
   * Matches the value of the `data-tutorial-target` attribute on the DOM element
   * that should be spotlighted. The overlay uses this to position the highlight.
   *
   * **Special case — empty string `''`**: signals an intentional "no spotlight" step.
   * The overlay renders a full dark backdrop with the card centred at the bottom.
   * Use this for intro/context steps where there is no specific element to point at.
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
}
