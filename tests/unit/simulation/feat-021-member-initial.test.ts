import { describe, it, expect } from 'vitest'
import { memberInitial } from '@/lib/memberInitial'

// feat-021 (PR 4, na přání uživatele): avatar jednotky a iniciála v segmentu rozpracovaného tasku
// ukazují u týmů „Team X“ písmeno týmu místo „T“, u lidí první písmeno jména.

describe('feat-021: písmeno jednotky (memberInitial)', () => {
  it('tým „Team C“ má písmeno C', () => {
    expect(memberInitial('Team C')).toBe('C')
  })

  it('velikost písmen a mezery nehrají roli', () => {
    expect(memberInitial('  team b ')).toBe('B')
  })

  it('člověk má první písmeno jména', () => {
    expect(memberInitial('Ada')).toBe('A')
    expect(memberInitial('chen')).toBe('C')
  })

  it('slovo začínající na „team“ bez mezery není tým', () => {
    expect(memberInitial('Teamwork')).toBe('T')
  })

  it('tým s číslem má číslici', () => {
    expect(memberInitial('Team 7')).toBe('7')
  })

  it('prázdné jméno vrátí „?“', () => {
    expect(memberInitial('')).toBe('?')
  })
})
