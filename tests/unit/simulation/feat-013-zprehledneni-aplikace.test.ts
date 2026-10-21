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
  // Přesné pořadí, části, nadpisy a cíle kroků od feat-025 hlídá feat-025-tutorial-steps.test.ts.
  it('contains exactly 14 steps for compare mode (feat-025: welcome → top bar → Compare in detail)', () => {
    expect(TUTORIAL_STEPS.compare).toHaveLength(14)
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

  it('every compare step except the welcome card has a non-empty targetId (feat-025)', () => {
    for (const step of TUTORIAL_STEPS.compare.slice(1)) {
      expect(step.targetId).toBeTruthy()
    }
    // Úvodní karta nic nezvýrazňuje — prázdný cíl znamená celoplošné ztmavení
    expect(TUTORIAL_STEPS.compare[0].targetId).toBe('')
  })

  it('compare step IDs are unique', () => {
    const ids = TUTORIAL_STEPS.compare.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ends with the Run button as the final call-to-action', () => {
    const last = TUTORIAL_STEPS.compare[TUTORIAL_STEPS.compare.length - 1]
    expect(last.targetId).toBe('compare-run-button')
  })
})

describe('feat-013: TUTORIAL_STEPS — experiment mode', () => {
  it('contains exactly 15 steps for experiment mode (feat-025)', () => {
    expect(TUTORIAL_STEPS.experiment).toHaveLength(15)
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

  it('every experiment step has a non-empty targetId', () => {
    for (const step of TUTORIAL_STEPS.experiment) {
      expect(step.targetId).toBeTruthy()
    }
  })

  it('experiment step IDs are unique', () => {
    const ids = TUTORIAL_STEPS.experiment.map(s => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('starts with the Advanced tab spotlighted on the first step', () => {
    expect(TUTORIAL_STEPS.experiment[0].targetId).toBe('mode-tab-advanced')
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

  it('shows the first step title on initial render (feat-025: the welcome card)', () => {
    renderOverlay('compare')
    expect(screen.getByRole('heading', { name: TUTORIAL_STEPS.compare[0].title })).toBeInTheDocument()
  })

  it('shows progress indicator "WELCOME · 1 / 14" on the first step (feat-025)', () => {
    renderOverlay('compare')
    expect(screen.getByText('WELCOME · 1 / 14')).toBeInTheDocument()
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

  it('shows progress "TOP BAR · 2 / 14" on step 2 (feat-025)', () => {
    renderOverlay('compare')
    clickNext(1)
    expect(screen.getByText('TOP BAR · 2 / 14')).toBeInTheDocument()
  })

  it('advances to step 3 on second "Next →" click', () => {
    renderOverlay('compare')
    clickNext(2)
    expect(screen.getByText(TUTORIAL_STEPS.compare[2].description)).toBeInTheDocument()
  })

  it('shows progress "TOP BAR · 3 / 14" on step 3 (feat-025)', () => {
    renderOverlay('compare')
    clickNext(2)
    expect(screen.getByText('TOP BAR · 3 / 14')).toBeInTheDocument()
  })

  it('shows progress "COMPARE · 14 / 14" after thirteen "Next →" clicks (last step, feat-025)', () => {
    renderOverlay('compare')
    clickNext(13)
    expect(screen.getByText('COMPARE · 14 / 14')).toBeInTheDocument()
  })

  it('shows "Finish" button instead of "Next →" on the last step (step 14)', () => {
    renderOverlay('compare')
    clickNext(13)
    expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument()
  })

  it('works the same way for experiment mode — step 1 advances to step 2', () => {
    renderOverlay('experiment')
    expect(screen.getByText(TUTORIAL_STEPS.experiment[0].description)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByText(TUTORIAL_STEPS.experiment[1].description)).toBeInTheDocument()
  })

  it('shows "Finish" instead of "Next →" on experiment mode last step (step 15, feat-025)', () => {
    renderOverlay('experiment')
    clickNext(14) // advance through all 15 steps (0-indexed: clicks 14 times to reach step 15)
    expect(screen.getByRole('button', { name: /finish/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /next/i })).not.toBeInTheDocument()
  })
})

describe('feat-013: TutorialOverlay — completing and skipping', () => {
  it('calls onComplete when "Finish" is clicked on the last step (step 14)', () => {
    let completed = false
    renderOverlay('compare', () => { completed = true })
    clickNext(13)
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
