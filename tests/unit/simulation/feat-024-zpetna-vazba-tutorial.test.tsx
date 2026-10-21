import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Simulator } from '@/components/Simulator'
import { TUTORIAL_STEPS } from '@/lib/tutorialSteps'
import { markTutorialCompleted, markModeSeen, resetTutorial } from '@/lib/storage'
import type { TutorialMode } from '@/types/tutorial'

// feat-024 Příklad 14: krok tutoriálu o zpětné vazbě.
//
// Schválený kontrakt: features/feat-024-zpetna-vazba-uzivatelu.md, Příklad 14, ve znění feat-025
// (features/feat-025-revize-tutorialu.md, Příklad 6):
//  - Krok se zpětnou vazbou je krok 5 prohlídky Compare (část „TOP BAR“, nadpis „Feedback“), zvýrazní ikonu
//    bubliny (cíl `feedback-button`) a nemá rodiče.
//  - Prohlídky Advanced a Cash Flow krok se zpětnou vazbou nemají.

/** Text kroku o zpětné vazbě (feat-025). */
const FEEDBACK_STEP_TEXT =
  'Got an idea, found a bug, or something unclear? Click the speech-bubble icon any time to write to the author.'

describe('feat-024 Příklad 14: krok tutoriálu o zpětné vazbě', () => {
  it('Compare: krok 5 zvýrazní ikonu bubliny s textem o zpětné vazbě', () => {
    const feedback = TUTORIAL_STEPS.compare[4]
    expect(feedback.targetId).toBe('feedback-button')
    expect(feedback.chapter).toBe('TOP BAR')
    expect(feedback.title).toBe('Feedback')
    expect(feedback.description).toBe(FEEDBACK_STEP_TEXT)
    // Ikona je v liště, ne uvnitř panelu — krok nemá dvojí ztmavení
    expect(feedback.parentTargetId).toBeUndefined()
  })

  it.each(['experiment', 'cashflow'] as TutorialMode[])('%s: krok se zpětnou vazbou nemá', mode => {
    expect(TUTORIAL_STEPS[mode].map(s => s.targetId)).not.toContain('feedback-button')
  })
})

describe('feat-024 Příklad 14: cíl kroku je ikona bubliny v liště', () => {
  beforeEach(() => {
    localStorage.clear()
    resetTutorial()
    markTutorialCompleted()
    markModeSeen('compare')
    markModeSeen('experiment')
    markModeSeen('cashflow')
  })

  it.each(['Compare', 'Advanced'] as const)('%s: [data-tutorial-target="feedback-button"] je tlačítko „Send feedback“', mode => {
    render(<Simulator />)
    fireEvent.click(screen.getByRole('tab', { name: mode }))
    const targets = document.querySelectorAll('[data-tutorial-target="feedback-button"]')
    expect(targets).toHaveLength(1)
    expect(targets[0]).toBe(screen.getByRole('button', { name: 'Send feedback' }))
  })
})
