import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import {
  isTutorialCompleted,
  markTutorialCompleted,
  hasSeenMode,
  markModeSeen,
  resetTutorial,
} from '@/lib/storage'
import { TUTORIAL_STEPS } from '@/lib/tutorialSteps'
import { TutorialOverlay } from '@/components/TutorialOverlay'
import { HelpIcon } from '@/components/HelpIcon'
import { Simulator } from '@/components/Simulator'
import type { TutorialMode } from '@/types/tutorial'

// ---------------------------------------------------------------------------
// Tutorial storage — localStorage flags
// Covers: isTutorialCompleted, markTutorialCompleted, hasSeenMode,
//         markModeSeen, resetTutorial
// ---------------------------------------------------------------------------

describe('feat-013: tutorial storage — isTutorialCompleted', () => {
  beforeEach(() => {
    // Clear tutorial flags before each test so tests don't bleed into each other.
    // We use resetTutorial() rather than localStorage.clear() because the jsdom
    // environment used by Vitest does not expose the clear() method.
    resetTutorial()
  })

  it('returns false when localStorage has no tutorial flag', () => {
    expect(isTutorialCompleted()).toBe(false)
  })

  it('returns true after markTutorialCompleted is called', () => {
    markTutorialCompleted()
    expect(isTutorialCompleted()).toBe(true)
  })

  it('persists the flag — isTutorialCompleted reads directly from localStorage', () => {
    markTutorialCompleted()
    // Simulate a second read (as if the page was reopened) by calling again
    expect(isTutorialCompleted()).toBe(true)
  })

  it('returns false again after resetTutorial clears the flag', () => {
    markTutorialCompleted()
    resetTutorial()
    expect(isTutorialCompleted()).toBe(false)
  })
})

describe('feat-013: tutorial storage — hasSeenMode / markModeSeen', () => {
  beforeEach(() => {
    resetTutorial()
  })

  it('returns false for "compare" when no modes have been seen', () => {
    expect(hasSeenMode('compare')).toBe(false)
  })

  it('returns false for "experiment" when no modes have been seen', () => {
    expect(hasSeenMode('experiment')).toBe(false)
  })

  it('returns true for "compare" after markModeSeen("compare")', () => {
    markModeSeen('compare')
    expect(hasSeenMode('compare')).toBe(true)
  })

  it('returns true for "experiment" after markModeSeen("experiment")', () => {
    markModeSeen('experiment')
    expect(hasSeenMode('experiment')).toBe(true)
  })

  it('marking one mode does not affect the other mode', () => {
    markModeSeen('compare')
    expect(hasSeenMode('experiment')).toBe(false)
  })

  it('both modes can be marked as seen independently', () => {
    markModeSeen('compare')
    markModeSeen('experiment')
    expect(hasSeenMode('compare')).toBe(true)
    expect(hasSeenMode('experiment')).toBe(true)
  })

  it('resetTutorial clears seen-modes alongside the completed flag', () => {
    markModeSeen('compare')
    markModeSeen('experiment')
    resetTutorial()
    expect(hasSeenMode('compare')).toBe(false)
    expect(hasSeenMode('experiment')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Tutorial step configuration
// Covers: TUTORIAL_STEPS structure, required fields, ordering
// ---------------------------------------------------------------------------

describe('feat-013: TUTORIAL_STEPS — compare mode', () => {
  it('contains exactly 13 steps for compare mode (intro + drill-down A + drill-down B)', () => {
    expect(TUTORIAL_STEPS.compare).toHaveLength(13)
  })

  it('every compare step has a non-empty id', () => {
    for (const step of TUTORIAL_STEPS.compare) {
      expect(step.id).toBeTruthy()
    }
  })

  it('every compare step has a non-empty description', () => {
    for (const step of TUTORIAL_STEPS.compare) {
      expect(step.description).toBeTruthy()
    }
  })

  it('all compare steps except the intro have a non-empty targetId (used to locate the DOM element)', () => {
    // Step 0 intentionally has targetId '' (full-backdrop intro — no element to spotlight).
    // Every other step must target a specific DOM element.
    for (const step of TUTORIAL_STEPS.compare.slice(1)) {
      expect(step.targetId).toBeTruthy()
    }
  })

  it('compare step IDs are unique', () => {
    const ids = TUTORIAL_STEPS.compare.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('starts with an intro step that has no spotlight (empty targetId)', () => {
    // Empty targetId = full-backdrop intro card, no element highlighted.
    expect(TUTORIAL_STEPS.compare[0].targetId).toBe('')
  })

  it('Team A panel is the second step (index 1) — after the intro', () => {
    expect(TUTORIAL_STEPS.compare[1].targetId).toBe('compare-team-a-panel')
  })

  it('Team B panel is introduced after all Team A sub-steps (not immediately after A panel)', () => {
    const targets = TUTORIAL_STEPS.compare.map(s => s.targetId)
    const bPanelIdx = targets.indexOf('compare-team-b-panel')
    const aResultsIdx = targets.indexOf('compare-team-a-results')
    expect(bPanelIdx).not.toBe(-1)
    expect(aResultsIdx).not.toBe(-1)
    // B panel must come after Team A has been fully drilled down
    expect(bPanelIdx).toBeGreaterThan(aResultsIdx)
  })

  it('drill-down A: settings → composition → kanban → results in order for Team A', () => {
    const targets = TUTORIAL_STEPS.compare.map(s => s.targetId)
    const aSettingsIdx   = targets.indexOf('compare-team-a-settings')
    const aCompIdx       = targets.indexOf('compare-team-a-composition')
    const aKanbanIdx     = targets.indexOf('compare-team-a-kanban')
    const aResultsIdx    = targets.indexOf('compare-team-a-results')
    // All four A sub-steps must be present and in this exact drill-down order
    expect(aSettingsIdx).not.toBe(-1)
    expect(aCompIdx).not.toBe(-1)
    expect(aKanbanIdx).not.toBe(-1)
    expect(aResultsIdx).not.toBe(-1)
    expect(aSettingsIdx).toBeLessThan(aCompIdx)
    expect(aCompIdx).toBeLessThan(aKanbanIdx)
    expect(aKanbanIdx).toBeLessThan(aResultsIdx)
  })

  it('drill-down B: settings → composition → kanban → results in order for Team B', () => {
    const targets = TUTORIAL_STEPS.compare.map(s => s.targetId)
    const bSettingsIdx   = targets.indexOf('compare-team-b-settings')
    const bCompIdx       = targets.indexOf('compare-team-b-composition')
    const bKanbanIdx     = targets.indexOf('compare-team-b-kanban')
    const bResultsIdx    = targets.indexOf('compare-team-b-results')
    // All four B sub-steps must be present and in this exact drill-down order
    expect(bSettingsIdx).not.toBe(-1)
    expect(bCompIdx).not.toBe(-1)
    expect(bKanbanIdx).not.toBe(-1)
    expect(bResultsIdx).not.toBe(-1)
    expect(bSettingsIdx).toBeLessThan(bCompIdx)
    expect(bCompIdx).toBeLessThan(bKanbanIdx)
    expect(bKanbanIdx).toBeLessThan(bResultsIdx)
  })

  it('Team A block precedes Team B block — all A sub-steps come before all B sub-steps', () => {
    const targets = TUTORIAL_STEPS.compare.map(s => s.targetId)
    // The last A sub-step must appear before the first B sub-step
    const maxA = Math.max(
      targets.indexOf('compare-team-a-settings'),
      targets.indexOf('compare-team-a-composition'),
      targets.indexOf('compare-team-a-kanban'),
      targets.indexOf('compare-team-a-results'),
    )
    const minB = Math.min(
      targets.indexOf('compare-team-b-settings'),
      targets.indexOf('compare-team-b-composition'),
      targets.indexOf('compare-team-b-kanban'),
      targets.indexOf('compare-team-b-results'),
    )
    expect(maxA).toBeLessThan(minB)
  })

  it('controls step comes immediately before the Run button step', () => {
    const targets = TUTORIAL_STEPS.compare.map(s => s.targetId)
    const controlsIdx = targets.indexOf('compare-controls')
    const runIdx = targets.indexOf('compare-run-button')
    expect(controlsIdx).not.toBe(-1)
    expect(runIdx).not.toBe(-1)
    // Controls orientation comes right before the call-to-action
    expect(runIdx).toBe(controlsIdx + 1)
  })

  it('ends with the Run button as the final call-to-action', () => {
    const last = TUTORIAL_STEPS.compare[TUTORIAL_STEPS.compare.length - 1]
    expect(last.targetId).toBe('compare-run-button')
  })
})

describe('feat-013: TUTORIAL_STEPS — experiment mode', () => {
  it('contains exactly 9 steps for experiment mode', () => {
    expect(TUTORIAL_STEPS.experiment).toHaveLength(9)
  })

  it('every experiment step has a non-empty id', () => {
    for (const step of TUTORIAL_STEPS.experiment) {
      expect(step.id).toBeTruthy()
    }
  })

  it('every experiment step has a non-empty description', () => {
    for (const step of TUTORIAL_STEPS.experiment) {
      expect(step.description).toBeTruthy()
    }
  })

  it('all experiment steps except the intro have a non-empty targetId', () => {
    // Step 0 is the full-backdrop intro — empty targetId is intentional.
    for (const step of TUTORIAL_STEPS.experiment.slice(1)) {
      expect(step.targetId).toBeTruthy()
    }
  })

  it('experiment step IDs are unique', () => {
    const ids = TUTORIAL_STEPS.experiment.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('starts with a full-backdrop intro (empty targetId)', () => {
    expect(TUTORIAL_STEPS.experiment[0].targetId).toBe('')
  })

  it('team composition is the second step — primary lever introduced first', () => {
    expect(TUTORIAL_STEPS.experiment[1].targetId).toBe('experiment-team-composition')
  })

  it('ends with the run button as the final call-to-action', () => {
    const last = TUTORIAL_STEPS.experiment[TUTORIAL_STEPS.experiment.length - 1]
    expect(last.targetId).toBe('experiment-run-button')
  })

  it('results step comes before controls step', () => {
    const targets = TUTORIAL_STEPS.experiment.map(s => s.targetId)
    const resultsIdx = targets.indexOf('experiment-results')
    const controlsIdx = targets.indexOf('experiment-controls')
    expect(resultsIdx).not.toBe(-1)
    expect(controlsIdx).not.toBe(-1)
    expect(resultsIdx).toBeLessThan(controlsIdx)
  })
})

describe('feat-013: TUTORIAL_STEPS — cross-mode uniqueness', () => {
  it('compare and experiment modes cover different targetIds (each targets different elements)', () => {
    const compareTargets = new Set(TUTORIAL_STEPS.compare.map(s => s.targetId))
    const experimentTargets = new Set(TUTORIAL_STEPS.experiment.map(s => s.targetId))
    // At least some targets must differ — they are different modes with different UI elements
    const hasAnyDifference =
      [...compareTargets].some(t => !experimentTargets.has(t)) ||
      [...experimentTargets].some(t => !compareTargets.has(t))
    expect(hasAnyDifference).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// TutorialOverlay component
// Covers: step display, navigation, skip, finish, progress indicator
// ---------------------------------------------------------------------------

/** Helper — renders the overlay for the given mode with a no-op onComplete. */
function renderOverlay(mode: TutorialMode, onComplete = () => {}) {
  return render(
    React.createElement(TutorialOverlay, { mode, onComplete })
  )
}

describe('feat-013: TutorialOverlay — initial render', () => {
  it('renders the dark overlay backdrop', () => {
    renderOverlay('compare')
    expect(screen.getByTestId('tutorial-overlay')).toBeInTheDocument()
  })

  it('shows the first step description on initial render', () => {
    renderOverlay('compare')
    expect(screen.getByText(TUTORIAL_STEPS.compare[0].description)).toBeInTheDocument()
  })

  it('shows progress indicator "1 / 13" on the first step', () => {
    renderOverlay('compare')
    expect(screen.getByText('1 / 13')).toBeInTheDocument()
  })

  it('shows "Next →" button (not "Finish") on the first step', () => {
    renderOverlay('compare')
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /finish/i })).not.toBeInTheDocument()
  })

  it('shows "Skip tutorial" button', () => {
    renderOverlay('compare')
    expect(screen.getByRole('button', { name: /skip tutorial/i })).toBeInTheDocument()
  })
})

/** Helper — clicks "Next →" n times in the currently rendered overlay. */
function clickNext(times: number) {
  for (let i = 0; i < times; i++) {
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
  }
}

describe('feat-013: TutorialOverlay — step navigation', () => {
  it('advances to step 2 when "Next →" is clicked once', () => {
    renderOverlay('compare')
    clickNext(1)
    expect(screen.getByText(TUTORIAL_STEPS.compare[1].description)).toBeInTheDocument()
  })

  it('shows progress "2 / 13" on step 2', () => {
    renderOverlay('compare')
    clickNext(1)
    expect(screen.getByText('2 / 13')).toBeInTheDocument()
  })

  it('advances to step 3 on second "Next →" click', () => {
    renderOverlay('compare')
    clickNext(2)
    expect(screen.getByText(TUTORIAL_STEPS.compare[2].description)).toBeInTheDocument()
  })

  it('shows progress "3 / 13" on step 3', () => {
    renderOverlay('compare')
    clickNext(2)
    expect(screen.getByText('3 / 13')).toBeInTheDocument()
  })

  it('shows progress "13 / 13" after twelve "Next →" clicks (last step)', () => {
    renderOverlay('compare')
    clickNext(12)
    expect(screen.getByText('13 / 13')).toBeInTheDocument()
  })

  it('shows "Finish" button instead of "Next →" on the last step (step 13)', () => {
    renderOverlay('compare')
    clickNext(12)
    expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument()
  })

  it('works the same way for experiment mode — step 1 advances to step 2', () => {
    renderOverlay('experiment')
    expect(screen.getByText(TUTORIAL_STEPS.experiment[0].description)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText(TUTORIAL_STEPS.experiment[1].description)).toBeInTheDocument()
  })

  it('shows "Finish" instead of "Next →" on experiment mode last step (step 9)', () => {
    renderOverlay('experiment')
    clickNext(8) // advance through all 9 steps (0-indexed: clicks 8 times to reach step 9)
    expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument()
  })
})

describe('feat-013: TutorialOverlay — completing and skipping', () => {
  it('calls onComplete when "Finish" is clicked on the last step (step 13)', () => {
    let completed = false
    renderOverlay('compare', () => { completed = true })
    clickNext(12)
    fireEvent.click(screen.getByRole('button', { name: /finish/i }))
    expect(completed).toBe(true)
  })

  it('calls onComplete when "Skip tutorial" is clicked on the first step', () => {
    let completed = false
    renderOverlay('compare', () => { completed = true })
    fireEvent.click(screen.getByRole('button', { name: /skip tutorial/i }))
    expect(completed).toBe(true)
  })

  it('calls onComplete when "Skip tutorial" is clicked mid-tutorial', () => {
    let completed = false
    renderOverlay('compare', () => { completed = true })
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    fireEvent.click(screen.getByRole('button', { name: /skip tutorial/i }))
    expect(completed).toBe(true)
  })
})

describe('feat-013: TutorialOverlay — overlay blocks background interaction', () => {
  it('overlay backdrop element is present to block pointer events', () => {
    renderOverlay('compare')
    // The backdrop must exist as a DOM element — CSS sets pointer-events: none
    // on everything underneath via the overlay. Its presence in the DOM is the
    // contract; the visual blocking is enforced by CSS, not JS logic.
    const backdrop = screen.getByTestId('tutorial-overlay')
    expect(backdrop).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// HelpIcon component
// Covers: renders, tooltip visibility on click, tooltip content
// ---------------------------------------------------------------------------

describe('feat-013: HelpIcon — rendering', () => {
  it('renders a button element', () => {
    render(React.createElement(HelpIcon, { text: 'Some help text' }))
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('button has an accessible label (aria-label)', () => {
    render(React.createElement(HelpIcon, { text: 'Some help text' }))
    // The button should be identifiable by a screen reader
    expect(screen.getByRole('button', { name: /help|info|\?/i })).toBeInTheDocument()
  })
})

describe('feat-013: HelpIcon — tooltip behaviour', () => {
  it('tooltip is not visible before interaction', () => {
    render(React.createElement(HelpIcon, { text: 'Specialization drives wait time' }))
    expect(screen.queryByText('Specialization drives wait time')).not.toBeInTheDocument()
  })

  it('tooltip appears after clicking the ? button', () => {
    render(React.createElement(HelpIcon, { text: 'Specialization drives wait time' }))
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('Specialization drives wait time')).toBeInTheDocument()
  })

  it('tooltip shows the exact text passed via the text prop', () => {
    const helpText = 'WIP limit controls how many features can be in progress at once'
    render(React.createElement(HelpIcon, { text: helpText }))
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText(helpText)).toBeInTheDocument()
  })

  it('tooltip disappears when ? button is clicked a second time (toggle)', () => {
    render(React.createElement(HelpIcon, { text: 'Toggle me' }))
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByText('Toggle me')).not.toBeInTheDocument()
  })

  it('tooltip disappears when Escape is pressed while open', () => {
    render(React.createElement(HelpIcon, { text: 'Press Escape to close' }))
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('Press Escape to close')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('Press Escape to close')).not.toBeInTheDocument()
  })

  it('tooltip is linked to button via aria-describedby when open', () => {
    render(React.createElement(HelpIcon, { text: 'Accessible tooltip' }))
    const btn = screen.getByRole('button')
    // Before opening: no aria-describedby
    expect(btn).not.toHaveAttribute('aria-describedby')
    fireEvent.click(btn)
    // After opening: aria-describedby points to the tooltip element
    const tooltipId = btn.getAttribute('aria-describedby')
    expect(tooltipId).toBeTruthy()
    expect(document.getElementById(tooltipId!)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Simulator component — tutorial auto-launch integration
// Covers: first-visit auto-launch, no repeat after completion,
//         experiment mode tutorial trigger on mode switch
// ---------------------------------------------------------------------------

describe('feat-013: Simulator — tutorial auto-launch on first visit', () => {
  beforeEach(() => {
    resetTutorial()
  })

  it('shows the tutorial overlay on first load (no tutorial flags set)', () => {
    render(React.createElement(Simulator))
    expect(screen.getByTestId('tutorial-overlay')).toBeInTheDocument()
  })

  it('does not show the tutorial when tutorial-completed flag is set', () => {
    markTutorialCompleted()
    markModeSeen('compare')
    render(React.createElement(Simulator))
    expect(screen.queryByTestId('tutorial-overlay')).not.toBeInTheDocument()
  })
})
