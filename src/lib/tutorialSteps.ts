/**
 * Static configuration for the spotlight tutorial walkthrough (feat-013, revised in feat-025).
 *
 * Three tours, one per mode:
 *  - Compare (14 steps): a welcome card (no spotlight) → the top bar (the three modes and the feedback
 *    icon) → Compare in detail (Team A from top to bottom, then Team B, controls and Run).
 *  - Advanced (15 steps): the screen layout → the units → backlog and work rules → run and results →
 *    controls and Run.
 *  - Cash Flow (8 steps): only what Cash Flow adds on top of Advanced (revenue, coordination).
 *
 * Each step's `chapter` is shown in the card header ("TOP BAR · 2 / 14"), so a long tour reads as a few
 * short parts. Each `targetId` matches the `data-tutorial-target` attribute of the element to spotlight.
 * An empty `targetId` (the welcome card) means "no spotlight" — the card sits in the middle of the screen.
 * Texts may contain links written as `[label](https://…)`; the overlay renders them as links.
 * The exact content of every step is the approved table in features/feat-025-revize-tutorialu.md.
 */

import type { TutorialMode, TutorialStep } from '@/types/tutorial'

/** Parent of the Team A drill-down steps: the whole Team A column stays readable, the rest dims more. */
const TEAM_A_PANEL = 'compare-team-a-panel'

/**
 * Controls step of Advanced and Cash Flow — both modes have the same Reset (same backlog, units kept).
 *
 * @param id - Step id, unique within its tour
 * @param targetId - The mode's controls area (`experiment-controls` / `cashflow-controls`)
 * @returns The controls step for that tour
 */
function sandboxControlsStep(id: string, targetId: string): TutorialStep {
  return {
    id,
    chapter: 'CONTROLS',
    title: 'Controls',
    description:
      'Change the speed (0.5×, 1×, 10×) at any time. ↺ Reset puts the same backlog back to the start ' +
      'and keeps your units. ? brings this tour back.',
    targetId,
  }
}

/**
 * All tutorial steps, keyed by application mode.
 * Imported by TutorialOverlay to render the correct steps for the active mode.
 */
export const TUTORIAL_STEPS: Record<TutorialMode, TutorialStep[]> = {
  compare: [
    {
      // Welcome card: what the simulator is for. No spotlight — the card is centred on the screen.
      id: 'compare-welcome',
      chapter: 'WELCOME',
      title: 'Welcome to Org Flow Simulator',
      description:
        'A tool for understanding how different ways of setting up an organization affect flow and key metrics. ' +
        'Inspired by a [traffic simulator](https://traffic-simulation.de/) and the multi-learning game by ' +
        '[Robert Batůšek](https://www.batusek.cz/en/).',
      bullets: [
        "It's a simplification of reality — many aspects of real organizations are left out.",
        "It's still in development, so I'd really appreciate your feedback. It helps me steer the tool where it's most useful.",
        'To learn more about organizational design, I recommend [Org Topologies](https://www.orgtopologies.com).',
      ],
      // The card speaks in the first person — the footer says who "I" is and how to connect
      footer:
        "Made by Ilja Alexandrov. I'd be glad to connect with you on " +
        '[LinkedIn](https://www.linkedin.com/in/ilja-alexandrov).',
      targetId: '',
    },
    // Top bar: what each mode is for, then where to send feedback (feat-024 step moved here)
    {
      id: 'compare-mode-compare',
      chapter: 'TOP BAR',
      title: 'Compare',
      description:
        "Two teams work through the same backlog side by side. Only the team structure differs — that's the " +
        "variable you're testing. We'll go through it in detail in a moment.",
      targetId: 'mode-tab-compare',
    },
    {
      id: 'compare-mode-advanced',
      chapter: 'TOP BAR',
      title: 'Advanced',
      description:
        'Organization, fully in your hands: add units, give them skills and mandates, speed some up with AI ' +
        'and shape the backlog. Use it to model your own organization and try what-ifs.',
      targetId: 'mode-tab-advanced',
    },
    {
      id: 'compare-mode-cashflow',
      chapter: 'TOP BAR',
      title: 'Cash Flow',
      description:
        'Like Advanced, but every finished feature starts earning money. Use it to see what cycle time and ' +
        'work in progress mean for revenue.',
      targetId: 'mode-tab-cashflow',
    },
    {
      // The icon sits in the top bar, outside any panel, so the step has no parent
      id: 'compare-feedback',
      chapter: 'TOP BAR',
      title: 'Feedback',
      description:
        'Got an idea, found a bug, or something unclear? Click the speech-bubble icon any time to write to the author.',
      targetId: 'feedback-button',
    },
    // Compare in detail: Team A from the team type down to the results, each inside the Team A column
    {
      id: 'compare-team-type',
      chapter: 'COMPARE',
      title: 'Team type',
      description:
        'How many roles can one person cover? Single = one, Double = two, Multi = three. Team A starts as ' +
        'Single — pure specialists. Switching the type restarts both runs.',
      targetId: 'compare-team-a-settings',
      parentTargetId: TEAM_A_PANEL,
    },
    {
      id: 'compare-team',
      chapter: 'COMPARE',
      title: "Who's on the team",
      description:
        'Six people and the roles they can do. During the run, each card shows what that person is working ' +
        'on — or IDLE when they have nothing to do.',
      targetId: 'compare-team-a-composition',
      parentTargetId: TEAM_A_PANEL,
    },
    {
      // After a finished run To Do is empty — then the whole To Do column is spotlighted instead
      id: 'compare-feature',
      chapter: 'COMPARE',
      title: 'A feature',
      description:
        'Each colored segment is work for one role — the wider the segment, the more work. A feature is done ' +
        'when every segment is filled.',
      targetId: 'compare-team-a-first-feature',
      parentTargetId: TEAM_A_PANEL,
      fallbackTargetId: 'compare-team-a-todo',
    },
    {
      id: 'compare-in-progress',
      chapter: 'COMPARE',
      title: 'In Progress',
      description:
        'During the run, features being worked on sit here. The filled part of a segment is work done; a pale ' +
        'segment waits for someone free with that role.',
      targetId: 'compare-team-a-in-progress',
      parentTargetId: TEAM_A_PANEL,
    },
    {
      id: 'compare-done',
      chapter: 'COMPARE',
      title: 'Done',
      description:
        'Finished features land here. The number under each one is its lead time: from entering the backlog to done.',
      targetId: 'compare-team-a-done',
      parentTargetId: TEAM_A_PANEL,
    },
    {
      id: 'compare-results',
      chapter: 'COMPARE',
      title: 'Results',
      description:
        'Total Time: until the last feature is done. Avg Cycle Time: from work start to done. Avg WIP: features ' +
        'in progress at once. Lower is better — each tile shows the gap to the other team.',
      targetId: 'compare-team-a-results',
      parentTargetId: TEAM_A_PANEL,
    },
    {
      // Team B reads just like Team A, so one step on what is different is enough
      id: 'compare-team-b',
      chapter: 'COMPARE',
      title: 'Team B',
      description:
        'Team B starts as Double: the same six people, each covering two roles. Everything else is identical, ' +
        'so you read it just like Team A.',
      targetId: 'compare-team-b-panel',
    },
    {
      id: 'compare-controls',
      chapter: 'COMPARE',
      title: 'Controls',
      description:
        'Change the speed (0.5×, 1×, 10×) at any time, even mid-run. ↺ Reset starts over with the default ' +
        'Single vs Double teams. ? brings this tour back.',
      targetId: 'compare-controls',
    },
    {
      // The call-to-action — everything before was context, now act
      id: 'compare-run',
      chapter: 'COMPARE',
      title: 'Run it',
      description:
        'Click ▶ Run to start both teams. When both finish, a result box shows which team was faster and why.',
      targetId: 'compare-run-button',
    },
  ],

  experiment: [
    {
      id: 'experiment-layout',
      chapter: 'INTRO',
      title: 'Your organization',
      description:
        'Here you build and tune one organization. Left: backlog and settings. Middle: work in progress and ' +
        'your units. Right: results.',
      targetId: 'mode-tab-advanced',
    },
    // The organization: what a unit is, how to change it, AI and the ready-made setups
    {
      id: 'experiment-units',
      chapter: 'ORGANIZATION',
      title: 'Units',
      description:
        'Each card is one unit — a team or a person. Its colored chips are its skills and mandates: a unit can ' +
        'only work on segments in matching colors.',
      targetId: 'experiment-team-composition',
    },
    {
      id: 'experiment-shape-units',
      chapter: 'ORGANIZATION',
      title: 'Shape your units',
      description:
        '+ adds a skill, × on a chip removes it. Click the name to rename the unit, × in its corner removes it. ' +
        'The button under the grid adds a new unit.',
      targetId: 'experiment-first-unit',
      parentTargetId: 'experiment-team-composition',
    },
    {
      id: 'experiment-ai',
      chapter: 'ORGANIZATION',
      title: 'AI speed-up',
      description:
        'Click AI to make this unit work faster: 1× → 2× → 5× → off. Only this unit speeds up; everything else ' +
        'stays the same.',
      targetId: 'experiment-first-unit-ai',
      parentTargetId: 'experiment-first-unit',
    },
    {
      id: 'experiment-preset',
      chapter: 'ORGANIZATION',
      title: 'Starting point',
      description:
        'Pick a ready-made setup: Teams — six component teams (Payments, CRM, …); People — six individual ' +
        'specialists. Switching replaces your units and skills.',
      targetId: 'experiment-unit-preset',
    },
    // Backlog and the rules units follow. Accordion steps spotlight the header only — the tour never
    // opens or closes a section.
    {
      id: 'experiment-backlog',
      chapter: 'BACKLOG & RULES',
      title: 'Backlog',
      description:
        'Features waiting for work, most important at the top. A free unit picks the most important work ' +
        'matching its skills, following the rule set under Team.',
      targetId: 'experiment-backlog-list',
    },
    {
      id: 'experiment-backlog-settings',
      chapter: 'BACKLOG & RULES',
      title: 'Backlog settings',
      description:
        'Open it to generate a new backlog or import your own from Excel (↓ Template shows the format). ' +
        'Sliders set size and variability; they apply on Generate new backlog.',
      targetId: 'experiment-backlog-accordion',
    },
    {
      id: 'experiment-specializations',
      chapter: 'BACKLOG & RULES',
      title: 'Skills',
      description:
        'Define the skills and mandates units can have: add, rename or recolor them. Phase sets the order — a ' +
        'later phase starts only when earlier phases of that feature are done.',
      targetId: 'experiment-specializations-accordion',
    },
    {
      id: 'experiment-work-rules',
      chapter: 'BACKLOG & RULES',
      title: 'Work rules',
      description:
        'Open Team to choose how a free unit picks work. Reduce WIP: finish started features first. Min units: ' +
        'stick to features it knows and avoid those others work on.',
      targetId: 'experiment-team-accordion',
    },
    // Reading a run
    {
      id: 'experiment-in-progress',
      chapter: 'RUN & RESULTS',
      title: 'In Progress',
      description:
        'Features being worked on. A framed card has work going on right now. A letter on a segment shows which ' +
        'unit is on it; ✓ marks a finished segment.',
      targetId: 'experiment-in-progress',
    },
    {
      id: 'experiment-unit-states',
      chapter: 'RUN & RESULTS',
      title: 'Unit states',
      description:
        'During the run, each unit shows what it works on. idle — no work for its skills. waiting… (highlighted) ' +
        "— work exists, but an earlier phase of that feature isn't done.",
      targetId: 'experiment-team-composition',
    },
    {
      id: 'experiment-done',
      chapter: 'RUN & RESULTS',
      title: 'Done',
      description:
        'Finished features, with the number of tasks and the lead time of each: from entering the backlog to done.',
      targetId: 'experiment-done',
    },
    {
      id: 'experiment-metrics',
      chapter: 'RUN & RESULTS',
      title: 'Metrics',
      description:
        'Hover ? on a tile for its definition. Total Wait and Avg Handoffs stay at zero until you give skills ' +
        'different phases under Skills.',
      targetId: 'experiment-results',
    },
    sandboxControlsStep('experiment-controls', 'experiment-controls'),
    {
      // The call-to-action, with the experiment loop: change one thing and compare runs
      id: 'experiment-run',
      chapter: 'CONTROLS',
      title: 'Run it',
      description:
        'Click ▶ Run. When the run finishes, change one thing — a unit, a skill or a rule — press ↺ Reset and ' +
        'run again. Each tile then shows the change against the previous run.',
      targetId: 'experiment-run-button',
    },
  ],

  cashflow: [
    {
      id: 'cashflow-intro',
      chapter: 'INTRO',
      title: 'Flow meets money',
      description:
        'The same setup as Advanced, but every finished feature starts earning money. Units, AI and settings ' +
        "work just like there; this tour covers what's new.",
      targetId: 'mode-tab-cashflow',
    },
    // Revenue: value per feature, how it ramps up, what has been earned and how runs compare
    {
      id: 'cashflow-value',
      chapter: 'REVENUE',
      title: 'Value per feature',
      description:
        'Each feature shows what it earns per tick — every 3 s of simulation time — once delivered. The most ' +
        'valuable features sit at the top, as the highest priority.',
      targetId: 'cashflow-backlog-list',
    },
    {
      id: 'cashflow-curve',
      chapter: 'REVENUE',
      title: 'Revenue curve',
      description:
        'Open Backlog to pick how revenue ramps up after delivery. Flat: full amount at once. J-curve: low at ' +
        'first, then above flat. S-curve: slow start, levels off at flat.',
      targetId: 'cashflow-backlog-accordion',
    },
    {
      id: 'cashflow-earnings',
      chapter: 'REVENUE',
      title: 'Earnings',
      description:
        'Each delivered feature earns every tick. The big number is its total so far, +€ flashes on each payment ' +
        'and the bar counts down to the next one.',
      targetId: 'cashflow-done',
    },
    {
      id: 'cashflow-revenue',
      chapter: 'REVENUE',
      title: 'Revenue (time-matched)',
      description:
        "Compares this run with the previous one at the same moment, so a longer run can't win just by running " +
        'longer. Details shows the full totals.',
      targetId: 'cashflow-revenue',
    },
    {
      id: 'cashflow-coordination',
      chapter: 'COORDINATION',
      title: 'Coordination overhead',
      description:
        'Turn it on under Team: each extra unit that joins a feature pays 25 % extra work and may cause rework ' +
        '(20 % chance). Cards then show ⇄ joins and ↺ rework.',
      targetId: 'cashflow-team-accordion',
    },
    sandboxControlsStep('cashflow-controls', 'cashflow-controls'),
    {
      id: 'cashflow-run',
      chapter: 'CONTROLS',
      title: 'Run it',
      description:
        'Click ▶ Run. When the run finishes, change one thing — a unit, the curve or a rule — press ↺ Reset and ' +
        'run again. The revenue tile then shows the difference.',
      targetId: 'cashflow-run-button',
    },
  ],
}
