import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Simulator } from '@/components/Simulator'
import { TUTORIAL_STEPS } from '@/lib/tutorialSteps'
import { markTutorialCompleted, markModeSeen, resetTutorial } from '@/lib/storage'
import type { TutorialMode } from '@/types/tutorial'

// feat-024 Příklad 14: tutoriály Compare a Advanced mají předposlední krok o zpětné vazbě.
//
// Schválený kontrakt: features/feat-024-zpetna-vazba-uzivatelu.md, Příklad 14.
//  - Compare má 14 kroků (dříve 13), Advanced 10 (dříve 9).
//  - Předposlední krok zvýrazní ikonu bubliny (cíl `feedback-button`) s textem o zpětné vazbě,
//    poslední krok zůstává „▶ Run“ a krok ovládání je hned před krokem zpětné vazby.
//  - Cash Flow tutoriál nemá.

/** Text kroku o zpětné vazbě (stejný v obou tutoriálech). */
const FEEDBACK_STEP_TEXT =
  "Got an idea, or something you'd like to tell the author? Click the speech-bubble icon in the top bar to send feedback at any time."

/** Pro každý tutoriál: očekávaný počet kroků, id kroku zpětné vazby a cíle kroků kolem něj. */
const CASES: { mode: TutorialMode; length: number; id: string; controls: string; run: string }[] = [
  { mode: 'compare', length: 14, id: 'compare-feedback', controls: 'compare-controls', run: 'compare-run-button' },
  { mode: 'experiment', length: 10, id: 'experiment-feedback', controls: 'experiment-controls', run: 'experiment-run-button' },
]

describe('feat-024 Příklad 14: krok tutoriálu o zpětné vazbě', () => {
  it.each(CASES)('$mode: $length kroků, předposlední zvýrazní ikonu bubliny s textem o zpětné vazbě', ({ mode, length, id }) => {
    const steps = TUTORIAL_STEPS[mode]
    expect(steps).toHaveLength(length)
    const feedback = steps[length - 2]
    expect(feedback.id).toBe(id)
    expect(feedback.targetId).toBe('feedback-button')
    expect(feedback.description).toBe(FEEDBACK_STEP_TEXT)
    // Ikona je v liště, ne uvnitř panelu — krok nemá dvojí ztmavení
    expect(feedback.parentTargetId).toBeUndefined()
  })

  it.each(CASES)('$mode: pořadí na konci je ovládání → zpětná vazba → Run', ({ mode, controls, run }) => {
    const targets = TUTORIAL_STEPS[mode].map(s => s.targetId)
    expect(targets.slice(-3)).toEqual([controls, 'feedback-button', run])
  })

  it('Cash Flow tutoriál nemá', () => {
    expect(Object.keys(TUTORIAL_STEPS).sort()).toEqual(['compare', 'experiment'])
  })
})

describe('feat-024 Příklad 14: cíl kroku je ikona bubliny v liště', () => {
  beforeEach(() => {
    localStorage.clear()
    resetTutorial()
    markTutorialCompleted()
    markModeSeen('compare')
    markModeSeen('experiment')
  })

  it.each(['Compare', 'Advanced'] as const)('%s: [data-tutorial-target="feedback-button"] je tlačítko „Send feedback“', mode => {
    render(<Simulator />)
    fireEvent.click(screen.getByRole('tab', { name: mode }))
    const targets = document.querySelectorAll('[data-tutorial-target="feedback-button"]')
    expect(targets).toHaveLength(1)
    expect(targets[0]).toBe(screen.getByRole('button', { name: 'Send feedback' }))
  })
})
