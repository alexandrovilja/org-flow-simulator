import { describe, it, expect } from 'vitest'
import { doneCount, makeInitialState, mulberry32, tick } from '@/simulation/engine'
import type { SimSettings, SimState } from '@/types/simulation'

// feat-001 Příklad 6 (revize 2026-10-13): `doneCount(state)` vrací počet VŠECH hotových features.
// `tick()` drží v `state.done` nejvýš 40 karet pro zobrazení a starší přesouvá do `state.doneOverflow`,
// takže `state.done.length` se u backlogu nad 40 features zastaví na 40.

const BASE_SETTINGS: SimSettings = {
  minBacklog: 0,
  wipLimit: 6,
  sizeVar: 0.4,
  roleVar: 0.5,
  initialBacklog: 100,
  minSpecializations: 1,
}

/** Kolik karet engine drží v `state.done` pro zobrazení (viz `tick()` v engine.ts). */
const DONE_DISPLAY_CAP = 40

// Krok simulačního času na jedno volání tick() — 0,25 s je dost jemné na to, aby engine
// zpracoval úkoly stejně jako v aplikaci, a dost hrubé, aby test doběhl rychle.
const DT_SIM = 0.25
// Pojistka proti nekonečné smyčce: 20 000 kroků × 0,25 s = 5 000 s simulace, o řád víc,
// než kolik potřebuje backlog o 100 features.
const MAX_STEPS = 20_000

/**
 * Vytvoří backlog o `size` features a nechá ho doběhnout do konce (`state.finished`).
 *
 * @param size - Počet features v backlogu
 * @returns Doběhnutý stav simulace
 */
function runToEnd(size: number): SimState {
  const rng = mulberry32(7)
  const settings: SimSettings = { ...BASE_SETTINGS, initialBacklog: size }
  const state = makeInitialState(rng, settings)
  for (let step = 0; step < MAX_STEPS && !state.finished; step++) {
    tick(state, DT_SIM, settings, rng)
  }
  if (!state.finished) throw new Error(`Backlog o ${size} features nedoběhl ani za ${MAX_STEPS} kroků`)
  return state
}

describe('feat-001 Příklad 6: doneCount počítá všechny hotové features', () => {
  it('nový stav (nic hotového) → 0', () => {
    const state = makeInitialState(mulberry32(7), BASE_SETTINGS)
    expect(doneCount(state)).toBe(0)
  })

  it('backlog o 100 features po doběhnutí → 100, i když se zobrazuje jen 40 karet', () => {
    const state = runToEnd(100)
    // Předpoklad testu: engine opravdu vytěsňuje karty nad limit 40
    expect(state.done.length).toBe(DONE_DISPLAY_CAP)
    expect(doneCount(state)).toBe(100)
  })

  it('backlog pod limitem 40 → stejné číslo jako state.done.length', () => {
    const state = runToEnd(20)
    expect(doneCount(state)).toBe(20)
    expect(doneCount(state)).toBe(state.done.length)
  })
})
