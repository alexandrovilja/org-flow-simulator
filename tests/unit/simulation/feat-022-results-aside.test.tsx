import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResultsAside } from '@/components/ResultsAside'

// feat-022 (Sjednocení designu v celém nástroji) — společný pravý panel Advanced a Cash Flow.
//
// Schválený kontrakt (spec features/feat-022-sjednoceni-designu.md, Technical Notes „Společný pravý panel“):
//  - `ResultsAside` vykreslí hlavičku „Metrics“ s poznámkou „N features sampled“ (jednotné číslo u 1),
//    dlaždice metrik pod ní a seznam Done s hlavičkou „Done“ a počtem.
//  - Prázdný seznam (`isEmpty`) ukáže „No completed features yet.“, jinak řádky z `children`.
//  - Volitelné `tutorialTargets` ({ aside, metrics, done }) nastaví data-tutorial-target (jen Advanced
//    je používá pro spotlight tutoriálu); bez nich atributy nejsou.

/** Vykreslí panel s minimem props; ostatní přepisuje test. */
function renderAside(extra: Partial<React.ComponentProps<typeof ResultsAside>> = {}) {
  const { children = <div>row</div>, ...rest } = extra
  return render(
    <ResultsAside sampleCount={3} tiles={<div>tile</div>} doneCount={3} isEmpty={false} {...rest}>
      {children}
    </ResultsAside>,
  )
}

describe('feat-022: ResultsAside', () => {
  it('Metrics: nadpis s poznámkou „N features sampled“ a dlaždice', () => {
    renderAside()
    expect(screen.getByRole('heading', { name: 'Metrics' }).textContent).toBe('Metrics')
    expect(screen.getByText('3 features sampled')).toBeInTheDocument()
    expect(screen.getByText('tile')).toBeInTheDocument()
  })

  it('jednotné číslo: „1 feature sampled“, nula: „0 features sampled“', () => {
    const { unmount } = renderAside({ sampleCount: 1 })
    expect(screen.getByText('1 feature sampled')).toBeInTheDocument()
    unmount()
    renderAside({ sampleCount: 0 })
    expect(screen.getByText('0 features sampled')).toBeInTheDocument()
  })

  it('Done: nadpis s počtem všech hotových features a řádky z children', () => {
    renderAside({ doneCount: 42 })
    const done = screen.getByRole('heading', { name: 'Done' })
    expect(done.nextElementSibling?.textContent).toBe('42')
    expect(screen.getByText('row')).toBeInTheDocument()
    expect(screen.queryByText('No completed features yet.')).toBeNull()
  })

  it('prázdný seznam: „No completed features yet.“ a žádné řádky', () => {
    // Prázdný seznam = volající nepředá žádné řádky
    renderAside({ isEmpty: true, doneCount: 0, children: null })
    expect(screen.getByText('No completed features yet.')).toBeInTheDocument()
    expect(screen.queryByText('row')).toBeNull()
  })

  it('tutorialTargets se propíšou do data-tutorial-target; bez nich atributy nejsou', () => {
    const { container, unmount } = renderAside({ tutorialTargets: { aside: 'a-target', metrics: 'm-target', done: 'd-target' } })
    expect(container.querySelector('aside')).toHaveAttribute('data-tutorial-target', 'a-target')
    expect(container.querySelector('[data-tutorial-target="m-target"]')).toContainElement(screen.getByRole('heading', { name: 'Metrics' }))
    expect(container.querySelector('[data-tutorial-target="d-target"]')).toContainElement(screen.getByRole('heading', { name: 'Done' }))
    unmount()
    const plain = renderAside()
    expect(plain.container.querySelector('[data-tutorial-target]')).toBeNull()
  })
})
