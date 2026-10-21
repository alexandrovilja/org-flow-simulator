import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { TutorialOverlay } from '@/components/TutorialOverlay'
import type { TutorialMode } from '@/types/tutorial'

// feat-025 (Revize tutoriálu) — karta tutoriálu.
//
// Schválený kontrakt: features/feat-025-revize-tutorialu.md (UI / Design „Karta tutoriálu“ a „Úvodní karta“,
// Příklady 1–4 a 7) a schválená maketa docs/feat-025-ui-mockup.html.
//  - Hlavička ukazuje `ČÁST · n / N` jako jeden text (např. „WELCOME · 1 / 14“), pořadí je celkové.
//  - Nadpis kroku je nadpis (role heading) s textem `title`.
//  - „← Back“ vrátí předchozí krok; na prvním kroku tlačítko není. Na posledním kroku je „← Back“ a „Finish“.
//  - Úvodní karta (krok bez cíle) má odrážky jako seznam a odkazy `<a target="_blank" rel="noopener noreferrer">`.
//    Přístupný název odkazu je jen jeho popisek; značka nové záložky je dekorativní SVG (aria-hidden),
//    ne znak ↗ — ten hlídač emoji z feat-022 nepovoluje. Kliknutí na odkaz prohlídku neposune.
//  - Pulzující rámeček má `data-testid="tutorial-ring"` a sedí 5 px vně zvýrazněného prvku.
//  - Když cíl kroku v DOM není, overlay zkusí `fallbackTargetId`; když chybí i ten, rámeček není.
// Vzhled (ostré rohy rámečku, umístění úvodní karty uprostřed) ověřuje E2E test — jsdom nepočítá CSS.

beforeEach(() => {
  // Overlay měří cíl v requestAnimationFrame — falešný čas ho spustí na povel
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] })
})

afterEach(() => {
  vi.useRealTimers()
})

/** Nechá proběhnout měření cíle (requestAnimationFrame) a překreslení. */
async function flushMeasure(): Promise<void> {
  await act(async () => { vi.advanceTimersByTime(20) })
}

/** Vykreslí kartu tutoriálu pro daný mód. */
function renderOverlay(mode: TutorialMode, onComplete = vi.fn()) {
  render(<TutorialOverlay mode={mode} onComplete={onComplete} />)
  return { onComplete }
}

/** Klikne n-krát na „Next →“. */
function clickNext(times: number): void {
  for (let i = 0; i < times; i++) fireEvent.click(screen.getByRole('button', { name: 'Next →' }))
}

const back = () => screen.queryByRole('button', { name: '← Back' })

/**
 * Přidá do stránky prvek s cílem tutoriálu a nastaví mu pevnou polohu (jsdom sám nic nerozmisťuje).
 *
 * @param target - Hodnota `data-tutorial-target`
 * @param rect - Poloha a rozměry prvku
 * @returns Vytvořený prvek
 */
function addTarget(target: string, rect: { top: number; left: number; width: number; height: number }): HTMLElement {
  const el = document.createElement('div')
  el.setAttribute('data-tutorial-target', target)
  document.body.appendChild(el)
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    ...rect, x: rect.left, y: rect.top, right: rect.left + rect.width, bottom: rect.top + rect.height, toJSON: () => ({}),
  } as DOMRect)
  return el
}

afterEach(() => {
  document.querySelectorAll('body > [data-tutorial-target]').forEach(el => el.remove())
})

describe('feat-025 Příklad 1: úvodní karta', () => {
  it('hlavička „WELCOME · 1 / 14“, nadpis, odstavec a tři odrážky', () => {
    renderOverlay('compare')
    expect(screen.getByText('WELCOME · 1 / 14')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Welcome to Org Flow Simulator' })).toBeInTheDocument()
    expect(screen.getByText(/A tool for understanding how different ways of setting up an organization/)).toBeInTheDocument()
    const items = within(screen.getByRole('list')).getAllByRole('listitem')
    expect(items.map(li => li.textContent)).toEqual([
      "It's a simplification of reality — many aspects of real organizations are left out.",
      "It's still in development, so I'd really appreciate your feedback. It helps me steer the tool where it's most useful.",
      'To learn more about organizational design, I recommend Org Topologies.',
    ])
  })

  it('má „Next →“ a „Skip tutorial“, ale ne „← Back“', () => {
    renderOverlay('compare')
    expect(screen.getByRole('button', { name: 'Next →' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Skip tutorial' })).toBeInTheDocument()
    expect(back()).toBeNull()
  })

  it('úvodní karta nic nezvýrazňuje — rámeček není', async () => {
    renderOverlay('compare')
    await flushMeasure()
    expect(screen.queryByTestId('tutorial-ring')).toBeNull()
  })
})

describe('feat-025 Příklad 2: odkazy na úvodní kartě', () => {
  it.each([
    ['traffic simulator', 'https://traffic-simulation.de/'],
    ['Robert Batůšek', 'https://www.batusek.cz/en/'],
    ['Org Topologies', 'https://www.orgtopologies.com'],
  ])('„%s“ vede na %s a otevře se v nové záložce', (label, href) => {
    renderOverlay('compare')
    const link = screen.getByRole('link', { name: label })
    expect(link).toHaveAttribute('href', href)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    // Značka nové záložky je dekorativní ikona, ne znak — přístupný název zůstane jen popisek
    expect(link.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(link.textContent).toBe(label)
  })

  it('kliknutí na odkaz prohlídku neposune ani nezavře', () => {
    const { onComplete } = renderOverlay('compare')
    // jsdom navigaci neumí — zrušíme ji, aby test nezávisel na prostředí
    const cancel = (e: Event) => e.preventDefault()
    document.addEventListener('click', cancel)
    fireEvent.click(screen.getByRole('link', { name: 'Org Topologies' }))
    document.removeEventListener('click', cancel)
    expect(screen.getByText('WELCOME · 1 / 14')).toBeInTheDocument()
    expect(onComplete).not.toHaveBeenCalled()
  })

  it('v textu karty nejsou syrové značky odkazů [ ](…)', () => {
    renderOverlay('compare')
    const card = screen.getByTestId('tutorial-overlay')
    expect(card.textContent).not.toMatch(/\]\(https:/)
  })
})

describe('feat-025 Příklad 3: název části v hlavičce', () => {
  it('Next → přejde na krok 2: „TOP BAR · 2 / 14“ a nadpis „Compare“', () => {
    renderOverlay('compare')
    clickNext(1)
    expect(screen.getByText('TOP BAR · 2 / 14')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Compare' })).toBeInTheDocument()
  })

  it.each([
    ['compare', 0, 'WELCOME · 1 / 14', 'Welcome to Org Flow Simulator'],
    ['compare', 5, 'COMPARE · 6 / 14', 'Team type'],
    ['experiment', 0, 'INTRO · 1 / 15', 'Your organization'],
    ['experiment', 5, 'BACKLOG & RULES · 6 / 15', 'Backlog'],
    ['experiment', 14, 'CONTROLS · 15 / 15', 'Run it'],
    ['cashflow', 0, 'INTRO · 1 / 8', 'Flow meets money'],
    ['cashflow', 5, 'COORDINATION · 6 / 8', 'Coordination overhead'],
  ] as const)('%s po %i kliknutích: hlavička „%s“, nadpis „%s“', (mode, clicks, header, title) => {
    renderOverlay(mode)
    clickNext(clicks)
    expect(screen.getByText(header)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument()
  })
})

describe('feat-025 Příklad 4: návrat o krok', () => {
  it('„← Back“ na kroku 3 vrátí krok 2', () => {
    renderOverlay('compare')
    clickNext(2)
    expect(screen.getByText('TOP BAR · 3 / 14')).toBeInTheDocument()
    fireEvent.click(back()!)
    expect(screen.getByText('TOP BAR · 2 / 14')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Compare' })).toBeInTheDocument()
  })

  it('návrat na krok 1 tlačítko „← Back“ skryje', () => {
    renderOverlay('compare')
    clickNext(1)
    fireEvent.click(back()!)
    expect(screen.getByText('WELCOME · 1 / 14')).toBeInTheDocument()
    expect(back()).toBeNull()
  })

  it('poslední krok má „← Back“ a „Finish“, ne „Next →“', () => {
    renderOverlay('compare')
    clickNext(13)
    expect(screen.getByText('COMPARE · 14 / 14')).toBeInTheDocument()
    expect(back()).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Finish' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next →' })).toBeNull()
  })

  it('„← Back“ z posledního kroku vrátí předposlední a znovu ukáže „Next →“', () => {
    renderOverlay('cashflow')
    clickNext(7)
    fireEvent.click(back()!)
    expect(screen.getByText('CONTROLS · 7 / 8')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next →' })).toBeInTheDocument()
  })

  it('„← Back“ přesune rámeček na cíl předchozího kroku', async () => {
    addTarget('mode-tab-compare', { top: 10, left: 300, width: 100, height: 40 })
    addTarget('mode-tab-advanced', { top: 10, left: 420, width: 110, height: 40 })
    renderOverlay('compare')
    clickNext(2)
    await flushMeasure()
    expect(screen.getByTestId('tutorial-ring')).toHaveStyle({ left: '415px' })
    fireEvent.click(back()!)
    await flushMeasure()
    expect(screen.getByTestId('tutorial-ring')).toHaveStyle({ left: '295px' })
  })
})

describe('feat-025 Příklad 7: rámeček a záložní cíl kroku „A feature“', () => {
  /** Přejde na krok 8 prohlídky Compare („A feature“) a nechá proběhnout měření. */
  async function openFeatureStep(): Promise<void> {
    renderOverlay('compare')
    clickNext(7)
    expect(screen.getByRole('heading', { name: 'A feature' })).toBeInTheDocument()
    await flushMeasure()
  }

  it('když je v To Do featura, rámeček je 5 px vně první karty', async () => {
    addTarget('compare-team-a-panel', { top: 64, left: 16, width: 490, height: 688 })
    addTarget('compare-team-a-first-feature', { top: 171, left: 25, width: 174, height: 42 })
    addTarget('compare-team-a-todo', { top: 140, left: 17, width: 190, height: 200 })
    await openFeatureStep()
    expect(screen.getByTestId('tutorial-ring')).toHaveStyle({ top: '166px', left: '20px', width: '184px', height: '52px' })
  })

  it('když je To Do prázdné, rámeček je kolem celého sloupce To Do', async () => {
    addTarget('compare-team-a-panel', { top: 64, left: 16, width: 490, height: 688 })
    addTarget('compare-team-a-todo', { top: 140, left: 17, width: 190, height: 200 })
    await openFeatureStep()
    expect(screen.getByTestId('tutorial-ring')).toHaveStyle({ top: '135px', left: '12px', width: '200px', height: '210px' })
    // Text kroku je stejný
    expect(screen.getByText(/Each colored segment is work for one role/)).toBeInTheDocument()
  })

  it('když chybí cíl i záložní cíl, rámeček není a karta zůstane vidět', async () => {
    await openFeatureStep()
    expect(screen.queryByTestId('tutorial-ring')).toBeNull()
    expect(screen.getByText('COMPARE · 8 / 14')).toBeInTheDocument()
  })
})

describe('feat-025 review: zvýrazněný prvek je vidět a fokus zůstává v kartě', () => {
  it('před měřením se cíl posune do viditelné oblasti (odscrollovaný sloupec To Do)', async () => {
    const card = addTarget('compare-team-a-first-feature', { top: 171, left: 25, width: 174, height: 42 })
    // jsdom scrollIntoView nemá — doplníme ho jako špión
    const scrollIntoView = vi.fn()
    card.scrollIntoView = scrollIntoView
    renderOverlay('compare')
    clickNext(7)
    await flushMeasure()
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' })
  })

  it('„← Back“ na první krok vrátí fokus na „Next →“ (tlačítko Back na kroku 1 není)', () => {
    renderOverlay('compare')
    clickNext(1)
    back()!.focus()
    fireEvent.click(back()!)
    expect(screen.getByText('WELCOME · 1 / 14')).toBeInTheDocument()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Next →' }))
  })

  it('„Next →“ z úvodní karty na krok se zvýrazněním nechá fokus na stejném tlačítku', async () => {
    addTarget('mode-tab-compare', { top: 10, left: 300, width: 100, height: 40 })
    renderOverlay('compare')
    const next = screen.getByRole('button', { name: 'Next →' })
    next.focus()
    fireEvent.click(next)
    await flushMeasure()
    // Karta se mezi krokem bez a se zvýrazněním nepřekreslí od nuly — tlačítko je pořád stejný prvek
    expect(screen.getByTestId('tutorial-ring')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next →' })).toBe(next)
    expect(document.activeElement).toBe(next)
  })
})
