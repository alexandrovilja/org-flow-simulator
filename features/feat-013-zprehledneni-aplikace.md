# Feature: Zpřehlednění aplikace

## Status
done

## Problem
Noví uživatelé nemohou pochopit, co vše se zobrazuje a jak by měli s aplikací pracovat. Bez kontextu
je UI pro nového uživatele neintuitivní — neví, kde začít, co jednotlivé prvky znamenají ani jak
spustit a nastavit simulaci.

## User Story
As a **new user**, I want to quickly understand what the application does, what is displayed on
screen, how to run a simulation and how to configure it, so that I can start using it without
needing external explanation.

## UI / Design

### Spotlight Walkthrough

A semi-transparent dark overlay highlights one UI element at a time. The highlighted element remains
fully visible and interactive-looking. A progress indicator (e.g. „1 / 3") is always visible.
Two buttons are always present: **Next →** (or **Finish** on the last step) and **Skip tutorial**.

**Triggered automatically** on first visit (localStorage does not contain `tutorial-completed`).
**Triggered manually** via a `?` button in the app header (always visible).

When the user switches to a mode they haven't seen the tutorial for yet, a prompt appears:
*"Do you want a quick tour of this mode?"*

---

#### Compare mode — 12 steps (Parallel Reveal, drill-down order)

The tutorial first introduces both teams at panel level (A then B), then does a full drill-down
of Team A (settings → composition → kanban → results), followed by a full drill-down of Team B
in the same order. The user first understands one team completely, then mirrors that understanding
onto the second team. Controls and Run close the tour.

Narrative arc: overview A → overview B → settings A → composition A → kanban A → results A →
settings B → composition B → kanban B → results B → controls → Run.

**Step 1 — Full Team A panel** `[compare-team-a-panel]`
> "This is Team A. Each column runs a completely independent simulation — same backlog,
> different team structure."

**Step 2 — Full Team B panel** `[compare-team-b-panel]`
> "This is Team B. Both teams process the identical backlog — the only variable is team
> specialization. That is what we are testing."

**Step 3 — Team A specialization type** `[compare-team-a-settings]`
> "Team A is Single-skill — each member focuses on exactly one type of work. Predictable,
> but features must pass through many hands."

**Step 4 — Team A composition** `[compare-team-a-composition]`
> "Team A's members — each has a single role. Work must pass from specialist to specialist."

**Step 5 — Team A kanban board** `[compare-team-a-kanban]`
> "Team A's kanban board. Features will move from TO DO → IN PROGRESS → DONE
> during the simulation."

**Step 6 — Team A results** `[compare-team-a-results]`
> "Team A's results: Total Time, Avg Cycle Time, and Avg WIP appear here during and after the run."

**Step 7 — Team B specialization type** `[compare-team-b-settings]`
> "Team B is Double-skill — each member can handle two types of work. Same backlog,
> different structure. Will it make a difference?"

**Step 8 — Team B composition** `[compare-team-b-composition]`
> "Team B's members each carry two roles. Fewer handoffs, less waiting for the next specialist."

**Step 9 — Team B kanban board** `[compare-team-b-kanban]`
> "Team B's kanban board. Same features as Team A — watch how quickly they reach DONE."

**Step 10 — Team B results** `[compare-team-b-results]`
> "Team B's results. After both finish, coloured indicators highlight which team won each metric."

**Step 11 — Simulation controls** `[compare-controls]`
> "Set the simulation speed (0.5×, 1×, or 10×) or reset the run to start over."

**Step 12 — Run button** `[compare-run-button]`
> "Click ▶ Run to start both simulations simultaneously. A Winner banner will reveal which team
> delivered faster — and by how much."

---

#### Experiment mode — 3 steps

**Step 1 — Backlog panel**
> "This is the backlog — a list of features waiting to be developed. Each feature has a size
> (story points) and a required role."

**Step 2 — Team panel**
> "Configure your team here — number of members, their roles, and degree of specialization.
> This directly drives simulation results."

**Step 3 — Chart + metrics**
> "The chart shows Cycle Time — how long each feature takes from start to finish. Metrics update
> live as the simulation runs."

---

### Contextual `?` icons

A small `?` icon appears next to each key UI element. On hover or click, a tooltip appears
with a short explanation: what the element is + how it affects the simulation.

**Elements with `?` icons:**
- Specialization sliders (Team panel, both modes)
- Cycle Time / Lead Time chart title
- Backlog size and variability settings
- Number of team members
- WIP, Handoffs, and Waiting metrics

---

## Specification by Example

**Example 1: First visit — tutorial auto-starts**
- Given: User opens the app for the first time (localStorage does not contain `tutorial-completed`)
- When: The page loads
- Then: The spotlight overlay appears on Step 1 of the Compare mode tutorial (Team A panel
  spotlighted), with progress indicator „1 / 12" and a „Skip tutorial" button visible

**Example 2: Parallel reveal — stepping from Team A settings to Team B settings**
- Given: Tutorial is active on Step 3 in Compare mode (Team A settings spotlighted)
- When: User clicks „Next →"
- Then: The spotlight moves to Step 4 (Team B settings spotlighted), progress indicator updates
  to „4 / 12" — the user can directly compare Single vs Double specialization

**Example 3: Completing the tutorial**
- Given: Tutorial is active on Step 12 in Compare mode (Run button spotlighted)
- When: User clicks „Finish"
- Then: The overlay disappears, `tutorial-completed` flag is saved to localStorage,
  the app is fully usable

**Example 4: Skipping the tutorial**
- Given: Tutorial is active (any step, any mode)
- When: User clicks „Skip tutorial"
- Then: The overlay immediately disappears, `tutorial-completed` flag is saved to localStorage

**Example 5: Second visit — tutorial does not auto-start**
- Given: localStorage contains `tutorial-completed`
- When: User opens the app
- Then: The tutorial does not start automatically, the app loads normally

**Example 6: Manual re-launch of tutorial**
- Given: User is on the main page (tutorial was previously completed)
- When: User clicks the `?` button in the header
- Then: The tutorial starts from Step 1 of the currently active mode

**Example 7: Switching to unseen mode — prompt appears**
- Given: User has completed the Compare mode tutorial but has not seen the Experiment mode tutorial
- When: User switches to Experiment mode
- Then: A prompt appears asking „Do you want a quick tour of this mode?" with Yes / No options

**Example 8: Overlay blocks interaction outside spotlight**
- Given: Tutorial is active on any step
- When: User clicks on a UI element that is NOT currently spotlighted
- Then: The click has no effect; the overlay absorbs the event; the tutorial remains on the current step

**Example 9: Contextual tooltip on a UI element**
- Given: User sees the specialization slider in the Team panel
- When: User hovers or clicks the `?` icon next to the slider
- Then: A tooltip appears explaining what specialization is and how it affects the simulation

## Out of Scope
- Video tutorials
- Languages other than English (other languages may be added later)
- Usage analytics (e.g. tutorial completion rate) — good idea, deferred to later
- Editable help texts via admin panel
- Blocking interaction with app elements **outside** the spotlight (overlay blocks clicks on non-highlighted areas; the highlighted element itself remains interactive)

## Technical Notes
- New component: `src/components/TutorialOverlay.tsx` — spotlight overlay + step logic
- New component: `src/components/HelpIcon.tsx` — reusable `?` icon + tooltip
- `src/lib/storage.ts` — add `tutorial-completed` and `tutorial-seen-modes` flags
- `src/components/Simulator.tsx` — integrate `TutorialOverlay` and `?` button in header
- Tutorial step content (texts) stored as a static config object, not in a database
- Per-mode tutorial state tracked separately (e.g. `{ compare: boolean, experiment: boolean }`)
- No dependency on external onboarding libraries — built in-house to stay lightweight

### Compare mode — `data-tutorial-target` attributes (v3 full parallel reveal, 12 steps)

All twelve targets and their DOM locations:

| Target ID | Element | File |
|---|---|---|
| `compare-team-a-panel` | Left bordered card wrapper (entire Team A column) | `Simulator.tsx` |
| `compare-team-b-panel` | Right bordered card wrapper (entire Team B column) | `Simulator.tsx` |
| `compare-team-a-settings` | Team A type picker (Single/Double/Multi) | `ComparePanel.tsx` — header div |
| `compare-team-b-settings` | Team B type picker | `ComparePanel.tsx` — header div |
| `compare-team-a-kanban` | Team A kanban board grid | `ComparePanel.tsx` — kanban div |
| `compare-team-b-kanban` | Team B kanban board grid | `ComparePanel.tsx` — kanban div |
| `compare-team-a-composition` | Team A member cards grid | `ComparePanel.tsx` — composition div |
| `compare-team-b-composition` | Team B member cards grid | `ComparePanel.tsx` — composition div |
| `compare-team-a-results` | Team A metrics row | `ComparePanel.tsx` — metrics div |
| `compare-team-b-results` | Team B metrics row | `ComparePanel.tsx` — metrics div |
| `compare-controls` | Header controls div (?, Reset, speed, Run) | `Simulator.tsx` |
| `compare-run-button` | ▶ Run / ⏸ Pause button | `Simulator.tsx` |

`TUTORIAL_STEPS.compare` in `src/lib/tutorialSteps.ts` changes from **7 steps → 12 steps**.
Tests in `feat-013-zprehledneni-aplikace.test.ts` must be updated to assert `toHaveLength(12)`.

## Open Questions
~~All resolved.~~

**Resolved decisions:**
- **Overlay style:** dark semi-transparent overlay covers the entire UI; only the spotlighted element
  is visible above it. Interaction with elements outside the overlay is blocked (pointer-events none).
- **Skip tutorial persistence:** clicking „Skip tutorial" saves `tutorial-completed` permanently
  to localStorage — identical behaviour to completing the tutorial.
