/**
 * Static configuration for the spotlight tutorial walkthrough.
 * Compare mode uses 13 steps in a "Introduce A fully, then introduce B" order:
 * intro (no spotlight) → A panel → (settings → composition → kanban → results) for A →
 * B panel → (settings → composition → kanban → results) for B → controls → Run.
 * The user first understands Team A completely, then mirrors that mental model onto Team B.
 * An empty `targetId` (step 1) signals a full-backdrop intro card with no spotlight.
 * Experiment mode keeps 3 steps — one per major panel.
 *
 * Each step's `targetId` matches the `data-tutorial-target` attribute
 * on the corresponding DOM element in Simulator.tsx / ComparePanel.tsx.
 * An empty string means "no spotlight" — TutorialOverlay renders a full dark backdrop instead.
 */

import type { TutorialMode, TutorialStep } from '@/types/tutorial'

/**
 * All tutorial steps, keyed by application mode.
 * Imported by TutorialOverlay to render the correct steps for the active mode.
 */
export const TUTORIAL_STEPS: Record<TutorialMode, TutorialStep[]> = {
  compare: [
    {
      id: 'compare-overview',
      // Step 1: Full-backdrop intro — no spotlight. Empty targetId keeps the overlay in
      // full dark mode so the user reads the context before any element is highlighted.
      description:
        'Compare mode runs two teams on the exact same backlog simultaneously. ' +
        'Only team structure differs — that is the variable you are testing.',
      targetId: '',
    },
    {
      id: 'compare-team-a-panel',
      // Step 2: Orient the user to the left column — "this whole thing is Team A".
      description:
        'This is Team A. Each column runs a completely independent simulation — ' +
        'same backlog, different team structure.',
      targetId: 'compare-team-a-panel',
    },
    {
      id: 'compare-team-a-settings',
      // Step 3 (drill-down A, part 1): Spotlight the settings inside Team A's panel.
      // parentTargetId dims the rest of Team A, keeping context while focusing on settings.
      description:
        'Team A is Single-skill — each member focuses on exactly one type of work. ' +
        'Predictable, but features must pass through many hands.',
      targetId: 'compare-team-a-settings',
      parentTargetId: 'compare-team-a-panel',
    },
    {
      id: 'compare-team-a-composition',
      // Step 4 (drill-down A, part 2): Composition inside Team A.
      description:
        "Team A's members — each has a single role. Work must pass from specialist to specialist.",
      targetId: 'compare-team-a-composition',
      parentTargetId: 'compare-team-a-panel',
    },
    {
      id: 'compare-team-a-kanban',
      // Step 5 (drill-down A, part 3): Kanban board inside Team A.
      description:
        "Team A's kanban board. Features will move from TO DO → IN PROGRESS → DONE " +
        'during the simulation.',
      targetId: 'compare-team-a-kanban',
      parentTargetId: 'compare-team-a-panel',
    },
    {
      id: 'compare-team-a-results',
      // Step 6 (drill-down A, part 4): Results row inside Team A.
      description:
        "Team A's results: Total Time, Avg Cycle Time, and Avg WIP appear here during and after the run.",
      targetId: 'compare-team-a-results',
      parentTargetId: 'compare-team-a-panel',
    },
    {
      id: 'compare-team-b-panel',
      // Step 7: Now introduce Team B as a whole — mirrors the Team A panel step.
      // The user has seen Team A completely; now we establish Team B before drilling in.
      description:
        'This is Team B. Both teams process the identical backlog — ' +
        'the only variable is team specialization. That is what we are testing.',
      targetId: 'compare-team-b-panel',
    },
    {
      id: 'compare-team-b-settings',
      // Step 8 (drill-down B, part 1): Mirror Team A drill-down for Team B.
      description:
        'Team B is Double-skill — each member can handle two types of work. ' +
        'Same backlog, different structure. Will it make a difference?',
      targetId: 'compare-team-b-settings',
      parentTargetId: 'compare-team-b-panel',
    },
    {
      id: 'compare-team-b-composition',
      // Step 9 (drill-down B, part 2): Composition inside Team B.
      description:
        "Team B's members each carry two roles. Fewer handoffs, less waiting for the next specialist.",
      targetId: 'compare-team-b-composition',
      parentTargetId: 'compare-team-b-panel',
    },
    {
      id: 'compare-team-b-kanban',
      // Step 10 (drill-down B, part 3): Kanban inside Team B.
      description:
        "Team B's kanban board. Same features as Team A — watch how quickly they reach DONE.",
      targetId: 'compare-team-b-kanban',
      parentTargetId: 'compare-team-b-panel',
    },
    {
      id: 'compare-team-b-results',
      // Step 11 (drill-down B, part 4): Results row inside Team B.
      description:
        "Team B's results. After both finish, coloured indicators highlight which team won each metric.",
      targetId: 'compare-team-b-results',
      parentTargetId: 'compare-team-b-panel',
    },
    {
      id: 'compare-controls',
      // Step 12: Orient the user to speed and reset controls before the call-to-action.
      description:
        'Set the simulation speed (0.5×, 1×, or 10×) or reset the run to start over.',
      targetId: 'compare-controls',
    },
    {
      id: 'compare-run',
      // Step 13: The call-to-action — everything before was context, now act.
      description:
        'Click ▶ Run to start both simulations simultaneously. ' +
        'A Winner banner will reveal which team delivered faster — and by how much.',
      targetId: 'compare-run-button',
    },
  ],

  experiment: [
    {
      id: 'experiment-overview',
      // Step 1: Full-backdrop intro — same pattern as compare mode.
      // Empty targetId keeps the overlay in full dark mode for the context-setting card.
      description:
        'Advanced mode lets you freely configure a team and run the simulation ' +
        'to see how structure affects cycle time. Here is how the screen is laid out.',
      targetId: '',
    },
    {
      id: 'experiment-team-composition',
      // Step 2: Team first — spotlight only the units grid, nothing else visible.
      description:
        'Your team. Add or remove units, assign specializations, and watch how ' +
        'the mix of roles changes how quickly features move through the system.',
      targetId: 'experiment-team-composition',
    },
    {
      id: 'experiment-backlog',
      // Step 3: Backlog list only — uses experiment-backlog-list target so the
      // settings section below is not inadvertently spotlighted.
      description:
        'The backlog — features waiting to be picked up. Each feature requires ' +
        'specific roles to complete; unmatched roles create waiting time.',
      targetId: 'experiment-backlog-list',
    },
    {
      id: 'experiment-in-progress',
      // Step 4: In Progress — spotlight only this panel, team section stays dark.
      description:
        'In Progress shows features currently being worked on. ' +
        'Each card highlights which unit is handling it and which tasks remain.',
      targetId: 'experiment-in-progress',
    },
    {
      id: 'experiment-done',
      // Step 5: Done list — spotlight only the done section, results stay dark.
      description:
        'Done — features delivered. The time shown is each feature\'s cycle time: ' +
        'from when work started to when it was finished.',
      targetId: 'experiment-done',
    },
    {
      id: 'experiment-results',
      // Step 6: Results — spotlight only the metrics tiles, done list stays dark.
      description:
        'Results: Avg Cycle Time, Avg WIP, Total Wait, and Avg Handoffs. ' +
        'These update live — change the team and re-run to compare outcomes.',
      targetId: 'experiment-results',
    },
    {
      id: 'experiment-settings',
      // Step 7: Settings — spotlight only the controls section, backlog list stays dark.
      description:
        'Settings: regenerate the backlog, change its size and complexity, ' +
        'or adjust the available specializations your team can carry.',
      targetId: 'experiment-settings',
    },
    {
      id: 'experiment-controls',
      // Step 8: Speed and reset controls — orient before the call-to-action.
      description:
        'Simulation controls: choose speed (0.5×, 1×, 2×, 10×) or reset the run ' +
        'to restore the original backlog and start fresh.',
      targetId: 'experiment-controls',
    },
    {
      id: 'experiment-run',
      // Step 9: Call-to-action — start the simulation.
      description:
        'Click ▶ Start to run the simulation. ' +
        'Adjust the team, reset, and re-run as many times as you like.',
      targetId: 'experiment-run-button',
    },
  ],
}
