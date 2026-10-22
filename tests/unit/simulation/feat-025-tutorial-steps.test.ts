import { describe, it, expect } from 'vitest'
import { TUTORIAL_STEPS } from '@/lib/tutorialSteps'
import type { TutorialMode } from '@/types/tutorial'

// feat-025 (Revize tutoriálu) — obsah tří prohlídek.
//
// Schválený kontrakt: features/feat-025-revize-tutorialu.md (UI / Design, Příklady 5 a 6).
//  - Compare má 14 kroků, Advanced 15, Cash Flow 8 (nová prohlídka, klíč `cashflow`).
//  - Každý krok má část (`chapter`), nadpis (`title`), text (`description`) a cíl zvýraznění
//    (`targetId`) přesně podle tabulek ve specu, ve stejném pořadí.
//  - Kroky 6–11 Compare mají rodiče `compare-team-a-panel` (dvojí ztmavení). V Advanced má krok 3
//    rodiče `experiment-team-composition` a krok 4 rodiče `experiment-first-unit` (schválená maketa).
//  - Krok 8 Compare má záložní cíl `compare-team-a-todo` pro prázdné To Do (Příklad 7).
//  - Jediný krok bez cíle je úvodní karta Compare; jako jediný má odrážky (`bullets`).
//  - Odkazy jsou v textu ve tvaru `[popisek](https://…)` (vykreslí je overlay, viz feat-025-tutorial-text).
//  - Krok se zpětnou vazbou je krok 5 prohlídky Compare; Advanced ani Cash Flow ho nemají (Příklad 6).

/** Očekávaný krok: část, nadpis, cíl, text a volitelně rodič a záložní cíl. */
interface ExpectedStep {
  chapter: string
  title: string
  targetId: string
  description: string
  parentTargetId?: string
  fallbackTargetId?: string
}

/** Rodič kroků 6–11 Compare: celý panel týmu A. */
const TEAM_A = 'compare-team-a-panel'

/** Text úvodní karty s odkazy ve formátu `[popisek](adresa)`. */
const WELCOME_TEXT =
  'A tool for understanding how different ways of setting up an organization affect flow and key metrics. ' +
  'Inspired by a [traffic simulator](https://traffic-simulation.de/) and the multi-learning game by ' +
  '[Robert Batůšek](https://www.batusek.cz/en/).'

/** Odrážky úvodní karty. */
const WELCOME_BULLETS = [
  "It's a simplification of reality — many aspects of real organizations are left out.",
  "It's still in development, so I'd really appreciate your feedback. It helps me steer the tool where it's most useful.",
  'To learn more about organizational design, I recommend [Org Topologies](https://www.orgtopologies.com).',
]

/** Text kroku ovládání v Advanced a Cash Flow (oba módy mají stejný Reset). */
const CONTROLS_TEXT =
  'Change the speed (0.5×, 1×, 10×) at any time. ↺ Reset puts the same backlog back to the start and keeps your units. ? brings this tour back.'

/** Tabulka „Prohlídka Compare (14 kroků)“ ze specu. */
const COMPARE: ExpectedStep[] = [
  { chapter: 'WELCOME', title: 'Welcome to Org Flow Simulator', targetId: '', description: WELCOME_TEXT },
  { chapter: 'TOP BAR', title: 'Compare', targetId: 'mode-tab-compare', description: "Two teams work through the same backlog side by side. Only the team structure differs — that's the variable you're testing. We'll go through it in detail in a moment." },
  { chapter: 'TOP BAR', title: 'Advanced', targetId: 'mode-tab-advanced', description: 'Organization, fully in your hands: add units, give them skills and mandates, speed some up with AI and shape the backlog. Use it to model your own organization and try what-ifs.' },
  { chapter: 'TOP BAR', title: 'Cash Flow', targetId: 'mode-tab-cashflow', description: 'Like Advanced, but every finished feature starts earning money. Use it to see what cycle time and work in progress mean for revenue.' },
  { chapter: 'TOP BAR', title: 'Feedback', targetId: 'feedback-button', description: 'Got an idea, found a bug, or something unclear? Click the speech-bubble icon any time to write to the author.' },
  { chapter: 'COMPARE', title: 'Team type', targetId: 'compare-team-a-settings', parentTargetId: TEAM_A, description: 'How many roles can one person cover? Single = one, Double = two, Multi = three. Team A starts as Single — pure specialists. Switching the type restarts both runs.' },
  { chapter: 'COMPARE', title: "Who's on the team", targetId: 'compare-team-a-composition', parentTargetId: TEAM_A, description: 'Six people and the roles they can do. During the run, each card shows what that person is working on — or IDLE when they have nothing to do.' },
  { chapter: 'COMPARE', title: 'A feature', targetId: 'compare-team-a-first-feature', parentTargetId: TEAM_A, fallbackTargetId: 'compare-team-a-todo', description: 'Each colored segment is work for one role — the wider the segment, the more work. A feature is done when every segment is filled.' },
  { chapter: 'COMPARE', title: 'In Progress', targetId: 'compare-team-a-in-progress', parentTargetId: TEAM_A, description: 'During the run, features being worked on sit here. The filled part of a segment is work done; a pale segment waits for someone free with that role.' },
  { chapter: 'COMPARE', title: 'Done', targetId: 'compare-team-a-done', parentTargetId: TEAM_A, description: 'Finished features land here. The number under each one is its lead time: from entering the backlog to done.' },
  { chapter: 'COMPARE', title: 'Results', targetId: 'compare-team-a-results', parentTargetId: TEAM_A, description: 'Total Time: until the last feature is done. Avg Cycle Time: from work start to done. Avg WIP: features in progress at once. Lower is better — each tile shows the gap to the other team.' },
  { chapter: 'COMPARE', title: 'Team B', targetId: 'compare-team-b-panel', description: 'Team B starts as Double: the same six people, each covering two roles. Everything else is identical, so you read it just like Team A.' },
  { chapter: 'COMPARE', title: 'Controls', targetId: 'compare-controls', description: 'Change the speed (0.5×, 1×, 10×) at any time, even mid-run. ↺ Reset starts over with the default Single vs Double teams. ? brings this tour back.' },
  { chapter: 'COMPARE', title: 'Run it', targetId: 'compare-run-button', description: 'Click ▶ Run to start both teams. When both finish, a result box shows which team was faster and why.' },
]

/** Tabulka „Prohlídka Advanced (15 kroků)“ ze specu. */
const EXPERIMENT: ExpectedStep[] = [
  { chapter: 'INTRO', title: 'Your organization', targetId: 'mode-tab-advanced', description: 'Here you build and tune one organization. Left: backlog and settings. Middle: work in progress and your units. Right: results.' },
  { chapter: 'ORGANIZATION', title: 'Units', targetId: 'experiment-team-composition', description: 'Each card is one unit — a team or a person. Its colored chips are its skills and mandates: a unit can only work on segments in matching colors.' },
  { chapter: 'ORGANIZATION', title: 'Shape your units', targetId: 'experiment-first-unit', parentTargetId: 'experiment-team-composition', description: '+ adds a skill, × on a chip removes it. Click the name to rename the unit, × in its corner removes it. The button under the grid adds a new unit.' },
  { chapter: 'ORGANIZATION', title: 'AI speed-up', targetId: 'experiment-first-unit-ai', parentTargetId: 'experiment-first-unit', description: 'Click AI to make this unit work faster: 1× → 2× → 5× → off. Only this unit speeds up; everything else stays the same.' },
  { chapter: 'ORGANIZATION', title: 'Starting point', targetId: 'experiment-unit-preset', description: 'Pick a ready-made setup: Teams — six component teams (Payments, CRM, …); People — six individual specialists. Switching replaces your units and skills.' },
  { chapter: 'BACKLOG & RULES', title: 'Backlog', targetId: 'experiment-backlog-list', description: 'Features waiting for work, most important at the top. A free unit picks the most important work matching its skills, following the rule set under Team.' },
  { chapter: 'BACKLOG & RULES', title: 'Backlog settings', targetId: 'experiment-backlog-accordion', description: 'Open it to generate a new backlog or import your own from Excel (↓ Template shows the format). Sliders set size and variability; they apply on Generate new backlog.' },
  { chapter: 'BACKLOG & RULES', title: 'Skills', targetId: 'experiment-specializations-accordion', description: 'Define the skills and mandates units can have: add, rename or recolor them. Phase sets the order — a later phase starts only when earlier phases of that feature are done.' },
  { chapter: 'BACKLOG & RULES', title: 'Work rules', targetId: 'experiment-team-accordion', description: 'Open Team to choose how a free unit picks work. Reduce WIP: finish started features first. Min units: stick to features it knows and avoid those others work on.' },
  { chapter: 'RUN & RESULTS', title: 'In Progress', targetId: 'experiment-in-progress', description: 'Features being worked on. A framed card has work going on right now. A letter on a segment shows which unit is on it; ✓ marks a finished segment.' },
  { chapter: 'RUN & RESULTS', title: 'Unit states', targetId: 'experiment-team-composition', description: "During the run, each unit shows what it works on. idle — no work for its skills. waiting… (highlighted) — work exists, but an earlier phase of that feature isn't done." },
  { chapter: 'RUN & RESULTS', title: 'Done', targetId: 'experiment-done', description: 'Finished features, with the number of tasks and the lead time of each: from entering the backlog to done.' },
  { chapter: 'RUN & RESULTS', title: 'Metrics', targetId: 'experiment-results', description: 'Hover ? on a tile for its definition. Total Wait and Avg Handoffs stay at zero until you give skills different phases under Skills.' },
  { chapter: 'CONTROLS', title: 'Controls', targetId: 'experiment-controls', description: CONTROLS_TEXT },
  { chapter: 'CONTROLS', title: 'Run it', targetId: 'experiment-run-button', description: 'Click ▶ Run. When the run finishes, change one thing — a unit, a skill or a rule — press ↺ Reset and run again. Each tile then shows the change against the previous run.' },
]

/** Tabulka „Prohlídka Cash Flow (8 kroků, nová)“ ze specu. */
const CASHFLOW: ExpectedStep[] = [
  { chapter: 'INTRO', title: 'Flow meets money', targetId: 'mode-tab-cashflow', description: "The same setup as Advanced, but every finished feature starts earning money. Units, AI and settings work just like there; this tour covers what's new." },
  { chapter: 'REVENUE', title: 'Value per feature', targetId: 'cashflow-backlog-list', description: 'Each feature shows what it earns per tick — every 3 s of simulation time — once delivered. The most valuable features sit at the top, as the highest priority.' },
  { chapter: 'REVENUE', title: 'Revenue curve', targetId: 'cashflow-backlog-accordion', description: 'Open Backlog to pick how revenue ramps up after delivery. Flat: full amount at once. J-curve: low at first, then above flat. S-curve: slow start, levels off at flat.' },
  { chapter: 'REVENUE', title: 'Earnings', targetId: 'cashflow-done', description: 'Each delivered feature earns every tick. The big number is its total so far, +€ flashes on each payment and the bar counts down to the next one.' },
  { chapter: 'REVENUE', title: 'Revenue (time-matched)', targetId: 'cashflow-revenue', description: "Compares this run with the previous one at the same moment, so a longer run can't win just by running longer. Details shows the full totals." },
  { chapter: 'COORDINATION', title: 'Coordination overhead', targetId: 'cashflow-team-accordion', description: 'Turn it on under Team: each extra unit that joins a feature pays 25 % extra work and may cause rework (20 % chance). Cards then show ⇄ joins and ↺ rework.' },
  { chapter: 'CONTROLS', title: 'Controls', targetId: 'cashflow-controls', description: CONTROLS_TEXT },
  { chapter: 'CONTROLS', title: 'Run it', targetId: 'cashflow-run-button', description: 'Click ▶ Run. When the run finishes, change one thing — a unit, the curve or a rule — press ↺ Reset and run again. The revenue tile then shows the difference.' },
]

/** Všechny tři prohlídky s očekávaným obsahem. */
const TOURS: { mode: TutorialMode; steps: ExpectedStep[] }[] = [
  { mode: 'compare', steps: COMPARE },
  { mode: 'experiment', steps: EXPERIMENT },
  { mode: 'cashflow', steps: CASHFLOW },
]

/** Řádky pro it.each: mód, pořadí kroku (od 1) a očekávaný krok. */
const ROWS = TOURS.flatMap(({ mode, steps }) => steps.map((step, i) => ({ mode, n: i + 1, step })))

describe('feat-025 Příklad 5: obsah tří prohlídek', () => {
  it('tutoriál má prohlídky pro všechny tři módy', () => {
    expect(Object.keys(TUTORIAL_STEPS).sort()).toEqual(['cashflow', 'compare', 'experiment'])
  })

  it.each([
    ['compare', 14],
    ['experiment', 15],
    ['cashflow', 8],
  ] as const)('%s má %i kroků', (mode, length) => {
    expect(TUTORIAL_STEPS[mode]).toHaveLength(length)
  })

  it.each(ROWS)('$mode, krok $n: část, nadpis, cíl a text podle specu', ({ mode, n, step }) => {
    const actual = TUTORIAL_STEPS[mode][n - 1]
    expect(actual).toMatchObject({
      chapter: step.chapter,
      title: step.title,
      targetId: step.targetId,
      description: step.description,
    })
    // Rodič a záložní cíl jen tam, kde je spec uvádí — jinde nesmí být
    expect(actual.parentTargetId).toBe(step.parentTargetId)
    expect(actual.fallbackTargetId).toBe(step.fallbackTargetId)
  })

  it.each(TOURS)('$mode: id kroků jsou neprázdná a jedinečná', ({ mode }) => {
    const ids = TUTORIAL_STEPS[mode].map(s => s.id)
    expect(ids.every(id => id.length > 0)).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('jediný krok bez cíle je úvodní karta Compare a jen ona má odrážky', () => {
    const all = TOURS.flatMap(({ mode }) => TUTORIAL_STEPS[mode].map(step => ({ mode, step })))
    const withoutTarget = all.filter(({ step }) => step.targetId === '')
    expect(withoutTarget).toHaveLength(1)
    expect(withoutTarget[0].step).toBe(TUTORIAL_STEPS.compare[0])
    const withBullets = all.filter(({ step }) => step.bullets !== undefined)
    expect(withBullets.map(({ step }) => step)).toEqual([TUTORIAL_STEPS.compare[0]])
  })

  it('úvodní karta má tři odrážky podle specu', () => {
    expect(TUTORIAL_STEPS.compare[0].bullets).toEqual(WELCOME_BULLETS)
  })
})

describe('feat-025 Příklad 6: zpětná vazba je v úvodu Compare', () => {
  it('krok 5 prohlídky Compare zvýrazní ikonu bubliny a nemá rodiče', () => {
    const step = TUTORIAL_STEPS.compare[4]
    expect(step.targetId).toBe('feedback-button')
    expect(step.title).toBe('Feedback')
    expect(step.parentTargetId).toBeUndefined()
  })

  it.each(['experiment', 'cashflow'] as const)('%s krok se zpětnou vazbou nemá', mode => {
    expect(TUTORIAL_STEPS[mode].map(s => s.targetId)).not.toContain('feedback-button')
  })

  it('ikona bubliny je v prohlídce Compare jen jednou', () => {
    expect(TUTORIAL_STEPS.compare.filter(s => s.targetId === 'feedback-button')).toHaveLength(1)
  })
})
