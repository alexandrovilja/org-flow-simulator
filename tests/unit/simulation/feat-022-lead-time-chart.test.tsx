import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LeadTimeChart } from '@/components/LeadTimeChart'
import type { LeadTimeEntry, SimStats } from '@/types/simulation'

// feat-022 (Sjednocení designu v celém nástroji) — graf lead time.
//
// Komponenta LeadTimeChart je součást design systému, ale dnes se v aplikaci nevykresluje a neměla
// žádný test. feat-022 jí změnil způsob předání okrajů (inline padding → CSS proměnné
// `--pad-left` a `--pad-right`), proto dostává vlastní test vykreslení:
//  - bez dokončených features ukáže prázdný stav „Waiting for first completed feature…“,
//  - s daty vykreslí jeden bod na každý lead time, popisky os a referenční čáry avg a p85,
//  - okraje grafu jsou CSS proměnné na kořenovém prvku (28 px vlevo, 8 px vpravo), ne inline padding.

const stats = (over: Partial<SimStats> = {}): SimStats => ({
  count: 3, avg: 4, min: 2, max: 6, p50: 4, p85: 5.5, buckets: [], bucketSize: 1, maxBucket: 0,
  avgHandoffs: 0, ...over,
} as SimStats)

const leadTimes: LeadTimeEntry[] = [2, 4, 6].map((ms, i) => ({ id: i + 1, ms, finishedAt: ms, handoffs: 0 } as LeadTimeEntry))

describe('feat-022: LeadTimeChart', () => {
  it('bez dokončených features ukáže prázdný stav', () => {
    render(<LeadTimeChart leadTimes={[]} stats={stats({ count: 0 })} />)
    expect(screen.getByText('Waiting for first completed feature…')).toBeInTheDocument()
  })

  it('s daty vykreslí popisky os a referenční čáry avg a p85', () => {
    render(<LeadTimeChart leadTimes={leadTimes} stats={stats()} />)
    expect(screen.getByText('0s')).toBeInTheDocument()
    expect(screen.getByText('oldest')).toBeInTheDocument()
    expect(screen.getByText('newest')).toBeInTheDocument()
    expect(screen.getByText('avg 4.0s')).toBeInTheDocument()
    expect(screen.getByText('p85 5.5s')).toBeInTheDocument()
  })

  it('okraje grafu předává jako CSS proměnné, ne jako inline padding', () => {
    const { container } = render(<LeadTimeChart leadTimes={leadTimes} stats={stats()} />)
    const chart = container.firstElementChild as HTMLElement
    expect(chart.style.getPropertyValue('--pad-left')).toBe('28px')
    expect(chart.style.getPropertyValue('--pad-right')).toBe('8px')
    expect(chart.style.paddingLeft).toBe('')
    expect(chart.style.paddingRight).toBe('')
    expect(chart.style.height).toBe('110px')
  })

  it('vykreslí jeden bod na každý lead time', () => {
    const { container } = render(<LeadTimeChart leadTimes={leadTimes} stats={stats()} />)
    const dots = container.querySelectorAll<HTMLElement>('[style*="left:"][style*="top:"]')
    // body mají left/top v %; osy a čáry mají jiné styly
    expect([...dots].filter(d => d.style.left.endsWith('%') && d.style.top.endsWith('%'))).toHaveLength(3)
  })
})
