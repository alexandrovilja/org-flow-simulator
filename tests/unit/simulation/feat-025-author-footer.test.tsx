import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { TutorialOverlay } from '@/components/TutorialOverlay'
import type { TutorialMode } from '@/types/tutorial'

// feat-025 (Revize tutoriálu), změna 2026-10-22 — patička o autorovi na úvodní kartě.
//
// Schválený kontrakt: features/feat-025-revize-tutorialu.md („Autor na úvodní kartě“, Příklady 18 a 19).
//  - Úvodní karta Compare má pod odrážkami a nad tlačítky patičku `<footer>` s textem
//    „Made by Ilja Alexandrov. I'd be glad to connect with you on LinkedIn.“
//  - „LinkedIn“ je odkaz na https://www.linkedin.com/in/ilja-alexandrov, otevírá se v nové záložce
//    a má stejnou dekorativní značku nové záložky jako ostatní odkazy na kartě.
//  - Patička je jen na úvodní kartě: žádný další krok Compare ani žádný krok Advanced a Cash Flow ji nemá.
//  - Patička není `<p>`: text karty zůstává v jediném odstavci (E2E feat-023, Příklad 11, ho hledá
//    přes `card.locator('p')`).
// Testy kartu zkoumají jen přes vykreslený DOM, ne přes pole v konfiguraci kroků.
// Linku nad patičkou a vejití karty do okna ověřuje E2E (jsdom nepočítá CSS).

/** Celý text patičky, jak ho uživatel přečte (odkaz jen svým popiskem). */
const FOOTER_TEXT = "Made by Ilja Alexandrov. I'd be glad to connect with you on LinkedIn."

/** Adresa profilu autora na LinkedIn. */
const LINKEDIN_URL = 'https://www.linkedin.com/in/ilja-alexandrov'

beforeEach(() => {
  // Overlay měří cíl v requestAnimationFrame — falešný čas ho spustí na povel
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] })
})

afterEach(() => {
  vi.useRealTimers()
})

/** Vykreslí kartu tutoriálu pro daný mód. */
function renderOverlay(mode: TutorialMode, onComplete = vi.fn()) {
  render(<TutorialOverlay mode={mode} onComplete={onComplete} />)
  return { onComplete }
}

/** Patička karty, nebo null, když ji karta nemá. */
function footer(): HTMLElement | null {
  return screen.getByTestId('tutorial-overlay').querySelector('footer')
}

/**
 * Projde celou prohlídku od prvního kroku po „Finish“ a u každého kroku zaznamená, jestli má patičku.
 *
 * @param mode - Prohlídka, kterou projde
 * @returns Pořadová čísla kroků (od 1), na kterých karta patičku má
 */
async function stepsWithFooter(mode: TutorialMode): Promise<number[]> {
  renderOverlay(mode)
  const found: number[] = []
  // Pojistka proti nekonečné smyčce — nejdelší prohlídka má 15 kroků
  for (let step = 1; step <= 30; step++) {
    // Nechá proběhnout měření cíle (requestAnimationFrame) a překreslení
    await act(async () => { vi.advanceTimersByTime(20) })
    if (footer()) found.push(step)
    const next = screen.queryByRole('button', { name: 'Next →' })
    if (!next) break
    fireEvent.click(next)
  }
  // Prohlídka došla až na poslední krok
  expect(screen.getByRole('button', { name: 'Finish' })).toBeInTheDocument()
  return found
}

describe('feat-025 Příklad 18: patička o autorovi na úvodní kartě', () => {
  it('úvodní karta má patičku s textem o autorovi', () => {
    renderOverlay('compare')
    expect(screen.getByText('WELCOME · 1 / 14')).toBeInTheDocument()
    const el = footer()
    expect(el).not.toBeNull()
    expect(el!.textContent).toBe(FOOTER_TEXT)
  })

  it('patička je pod odrážkami a nad tlačítky', () => {
    renderOverlay('compare')
    const list = screen.getByRole('list')
    const el = footer()!
    const nextButton = screen.getByRole('button', { name: 'Next →' })
    // compareDocumentPosition: FOLLOWING = druhý prvek je v dokumentu až za prvním
    expect(list.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(el.compareDocumentPosition(nextButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Patička není součástí seznamu odrážek
    expect(list.contains(el)).toBe(false)
  })

  it('text karty zůstává v jediném odstavci <p> (patička odstavec není)', () => {
    renderOverlay('compare')
    const overlay = screen.getByTestId('tutorial-overlay')
    expect(overlay.querySelectorAll('p')).toHaveLength(1)
    expect(footer()!.querySelector('p')).toBeNull()
  })

  it('krok 2 Compare patičku nemá', () => {
    renderOverlay('compare')
    fireEvent.click(screen.getByRole('button', { name: 'Next →' }))
    expect(screen.getByText('TOP BAR · 2 / 14')).toBeInTheDocument()
    expect(footer()).toBeNull()
  })

  it.each<[TutorialMode, number[]]>([
    ['compare', [1]],
    ['experiment', []],
    ['cashflow', []],
  ])('prohlídka %s má patičku jen na krocích %j', async (mode, expected) => {
    expect(await stepsWithFooter(mode)).toEqual(expected)
  })
})

describe('feat-025 Příklad 19: odkaz na LinkedIn', () => {
  it('„LinkedIn“ v patičce vede na profil autora a otevře se v nové záložce', () => {
    renderOverlay('compare')
    const link = within(footer()!).getByRole('link', { name: 'LinkedIn' })
    expect(link).toHaveAttribute('href', LINKEDIN_URL)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    // Značka nové záložky je dekorativní ikona, ne znak — přístupný název zůstane jen popisek
    expect(link.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(link.textContent).toBe('LinkedIn')
  })

  it('kliknutí na odkaz prohlídku neposune ani nezavře', () => {
    const { onComplete } = renderOverlay('compare')
    // jsdom navigaci neumí — zrušíme ji, aby test nezávisel na prostředí
    const cancel = (e: Event) => e.preventDefault()
    document.addEventListener('click', cancel)
    fireEvent.click(screen.getByRole('link', { name: 'LinkedIn' }))
    document.removeEventListener('click', cancel)
    expect(screen.getByText('WELCOME · 1 / 14')).toBeInTheDocument()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('v patičce nejsou syrové značky odkazu [ ](…)', () => {
    renderOverlay('compare')
    expect(footer()!.textContent).not.toMatch(/\]\(https:/)
  })
})
