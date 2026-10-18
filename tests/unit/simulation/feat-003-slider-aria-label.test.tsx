import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Slider } from '@/components/Slider'

// feat-003 (revize 2026-10-13): range input ve Slideru má přístupné jméno podle popisku,
// aby ho čtečka obrazovky pojmenovala a testy ho našly přes roli a jméno.

describe('feat-003: přístupné jméno slideru', () => {
  it('slider jde najít přes roli „slider“ a jméno z popisku', () => {
    render(<Slider label="Backlog size" value={100} min={10} max={1000} step={10} onChange={() => {}} />)
    const slider = screen.getByRole('slider', { name: 'Backlog size' })
    expect(slider).toHaveValue('100')
  })

  it('dva slidery se od sebe liší jménem', () => {
    render(
      <>
        <Slider label="Backlog size" value={100} min={10} max={1000} step={10} onChange={() => {}} />
        <Slider label="Min. specializations per item" value={1} min={1} max={6} step={1} onChange={() => {}} />
      </>,
    )
    expect(screen.getByRole('slider', { name: 'Backlog size' })).toHaveValue('100')
    expect(screen.getByRole('slider', { name: 'Min. specializations per item' })).toHaveValue('1')
  })
})
