import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSimSpeed } from '@/hooks/useSimSpeed'

// feat-021, změna 2026-10-20: rychlost běhu drží ve všech třech módech (Compare, Advanced, Cash Flow)
// stejný hook `useSimSpeed`. Smyčka requestAnimationFrame v Simulator.tsx čte rychlost z refu mimo React,
// proto setSpeed přepíše ref hned a ne až po překreslení — jinak by se rychlost v jednotlivých módech
// měnila s jiným zpožděním.

describe('feat-021: useSimSpeed', () => {
  it('výchozí rychlost je 1× ve stavu i v refu', () => {
    const { result } = renderHook(() => useSimSpeed())
    expect(result.current.speed).toBe(1)
    expect(result.current.speedRef.current).toBe(1)
  })

  it('setSpeed přepíše ref hned, ještě před překreslením, a stav po něm', () => {
    const { result } = renderHook(() => useSimSpeed())
    act(() => {
      result.current.setSpeed(10)
      // Ještě uvnitř act() (React stav nepřekreslil) už smyčka musí vidět novou rychlost
      expect(result.current.speedRef.current).toBe(10)
    })
    expect(result.current.speed).toBe(10)
    expect(result.current.speedRef.current).toBe(10)
  })

  it('ref i setSpeed zůstávají mezi překresleními stejné (smyčka drží ref po celou dobu života komponenty)', () => {
    const { result, rerender } = renderHook(() => useSimSpeed())
    const { speedRef, setSpeed } = result.current
    act(() => result.current.setSpeed(0.5))
    rerender()
    expect(result.current.speedRef).toBe(speedRef)
    expect(result.current.setSpeed).toBe(setSpeed)
  })

  it('každé volání hooku má vlastní rychlost (módy se neovlivňují)', () => {
    const a = renderHook(() => useSimSpeed())
    const b = renderHook(() => useSimSpeed())
    act(() => a.result.current.setSpeed(10))
    expect(a.result.current.speed).toBe(10)
    expect(b.result.current.speed).toBe(1)
    expect(b.result.current.speedRef.current).toBe(1)
  })
})
