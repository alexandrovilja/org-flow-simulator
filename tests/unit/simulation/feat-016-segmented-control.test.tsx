import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SegmentedControl } from '@/components/SegmentedControl'
import type { WipMode } from '@/types/simulation'

// feat-016 (revize 2): sdílený přepínač WIP módu má tři volby — Priority | Reduce WIP | Min units.
// SegmentedControl byl dvouhodnotový, proto se zobecňuje na 2–3 volby.

describe('feat-016 Příklad 17: SegmentedControl se třemi volbami', () => {
  it('zobrazí všechny tři volby jako tlačítka', () => {
    render(
      <SegmentedControl<WipMode>
        options={[
          { value: 'priority', label: 'Priority' },
          { value: 'reduce-wip', label: 'Reduce WIP' },
          { value: 'min-units', label: 'Min units' },
        ]}
        value="reduce-wip"
        onChange={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: 'Priority' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Reduce WIP' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Min units' })).toBeTruthy()
  })

  it('kliknutí na třetí volbu zavolá onChange s hodnotou "min-units"', () => {
    const onChange = vi.fn()
    render(
      <SegmentedControl<WipMode>
        options={[
          { value: 'priority', label: 'Priority' },
          { value: 'reduce-wip', label: 'Reduce WIP' },
          { value: 'min-units', label: 'Min units' },
        ]}
        value="reduce-wip"
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Min units' }))
    expect(onChange).toHaveBeenCalledWith('min-units')
  })

  it('kliknutí na první a druhou volbu funguje také (žádná volba není „mrtvá“)', () => {
    const onChange = vi.fn()
    render(
      <SegmentedControl<WipMode>
        options={[
          { value: 'priority', label: 'Priority' },
          { value: 'reduce-wip', label: 'Reduce WIP' },
          { value: 'min-units', label: 'Min units' },
        ]}
        value="min-units"
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Priority' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reduce WIP' }))
    expect(onChange).toHaveBeenNthCalledWith(1, 'priority')
    expect(onChange).toHaveBeenNthCalledWith(2, 'reduce-wip')
  })

  it('disabled zablokuje všechny tři volby', () => {
    const onChange = vi.fn()
    render(
      <SegmentedControl<WipMode>
        options={[
          { value: 'priority', label: 'Priority' },
          { value: 'reduce-wip', label: 'Reduce WIP' },
          { value: 'min-units', label: 'Min units' },
        ]}
        value="reduce-wip"
        onChange={onChange}
        disabled
      />,
    )
    for (const name of ['Priority', 'Reduce WIP', 'Min units']) {
      fireEvent.click(screen.getByRole('button', { name }))
    }
    expect(onChange).not.toHaveBeenCalled()
  })

  it('dlouhý hint se zalomí a nepřesáhne šířku postranního panelu (max 260 px, ne nowrap)', () => {
    const longHint = 'WIP: units stay on features they already know and avoid features others are working on.'
    const { container } = render(
      <SegmentedControl<WipMode>
        options={[
          { value: 'priority', label: 'Priority' },
          { value: 'reduce-wip', label: 'Reduce WIP' },
          { value: 'min-units', label: 'Min units' },
        ]}
        value="reduce-wip"
        onChange={() => {}}
        hint={longHint}
      />,
    )
    fireEvent.mouseEnter(container.firstElementChild as Element)
    const tooltip = screen.getByText(longHint)
    expect(tooltip.style.whiteSpace).not.toBe('nowrap')
    expect(parseInt(tooltip.style.maxWidth, 10)).toBeLessThanOrEqual(260)
  })

  it('zpětná kompatibilita: dvě volby (Off / On) dál fungují', () => {
    const onChange = vi.fn()
    render(
      <SegmentedControl<'off' | 'on'>
        options={[
          { value: 'off', label: 'Off' },
          { value: 'on', label: 'On' },
        ]}
        value="off"
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'On' }))
    expect(onChange).toHaveBeenCalledWith('on')
  })
})
