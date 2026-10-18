import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MemberCard } from '@/components/MemberCard'
import styles from '@/components/MemberCard.module.css'
import { ROLE_META } from '@/simulation/engine'
import type { Member } from '@/types/simulation'

// feat-019 (AI multiplikátor výkonu) — tlačítko AI na kartě jednotky (Příklad 5).
//
// Schválený kontrakt (spec features/feat-019-ai-multiplikator-vykonu.md, mockup docs/feat-019-ui-mockup.html):
//  - `MemberCard` dostane novou prop `onSetAiMultiplier: (memberId: number, value: AiMultiplier) => void`.
//  - V horním řádku karty je vlevo od křížku tlačítko AI s `aria-expanded` podle stavu menu.
//    Přístupný název: bez AI „AI speed-up“, se zapnutým AI „AI speed-up: 5×“ (viditelná hodnota je
//    součástí názvu — WCAG 2.5.3). Bez AI ukazuje text „AI“, se zapnutým AI hodnotu a ikonu blesku (svg).
//  - Statické styly jsou v `MemberCard.module.css` (konvence CLAUDE.md): tlačítko má třídu `aiButton`,
//    se zapnutým AI navíc `aiButtonOn` (modrý odznak); vybraná volba menu třídu `aiOptionSelected`.
//  - Kliknutí na tlačítko otevře v kartě skupinu voleb (role="group", název „AI speed-up options“,
//    propojenou přes `aria-controls`) s tlačítky „2×“ a „5×“; při zapnutém AI navíc „off“.
//    Aktuální volba má `aria-pressed="true"`.
//  - Výběr volby zavolá `onSetAiMultiplier(member.id, hodnota)` („off“ = 1), menu zavře a vrátí fokus
//    na tlačítko AI. Escape menu zavře (fokus zpět na tlačítko AI) bez volání handleru.
//    Opětovné kliknutí na tlačítko AI menu zavře bez volání handleru.
//  - Menu patří konkrétní jednotce: když karta dostane jiný objekt jednotky (výměna týmu, preset,
//    nová jednotka se stejným ID), menu se zavře.
//  - Křížek („Remove unit“) se nemění.

/**
 * Vytvoří jednotku pro test. `ai` vynecháno = jednotka bez pole `aiMultiplier`.
 *
 * @param ai - AI multiplikátor jednotky
 * @returns Jednotka „Ben“ se specializací Backend
 */
function ben(ai?: 1 | 2 | 5): Member {
  const m: Member = { id: 7, name: 'Ben', roles: ['BE'], currentTask: null, idleSec: 0 }
  if (ai !== undefined) m.aiMultiplier = ai
  return m
}

/**
 * Prvek karty jednotky se všemi povinnými props.
 *
 * @param member            - Vykreslovaná jednotka
 * @param onSetAiMultiplier - Mock handleru AI
 * @returns React element karty
 */
function card(member: Member, onSetAiMultiplier: ReturnType<typeof vi.fn>) {
  return (
    <MemberCard
      member={member}
      currentFeature={null}
      currentTask={null}
      roleConfig={ROLE_META}
      onAddRole={vi.fn()}
      onRemoveRole={vi.fn()}
      onRename={vi.fn()}
      onRemove={vi.fn()}
      onSetAiMultiplier={onSetAiMultiplier}
    />
  )
}

/**
 * Vykreslí kartu jednotky a vrátí mock handleru AI a funkci pro překreslení s jinou jednotkou.
 *
 * @param member - Vykreslovaná jednotka
 * @returns Mock `onSetAiMultiplier` a `rerenderWith`
 */
function renderCard(member: Member) {
  const onSetAiMultiplier = vi.fn()
  const { rerender } = render(card(member, onSetAiMultiplier))
  return { onSetAiMultiplier, rerenderWith: (m: Member) => rerender(card(m, onSetAiMultiplier)) }
}

const aiButton = () => screen.getByRole('button', { name: /^AI speed-up/ })
const optionsGroup = () => screen.queryByRole('group', { name: 'AI speed-up options' })

describe('feat-019 Příklad 5: tlačítko AI bez zapnutého AI', () => {
  it('vedle křížku je průhledné tlačítko „AI“, menu je zavřené', () => {
    renderCard(ben())
    const btn = aiButton()
    expect(btn.textContent).toBe('AI')
    expect(btn.getAttribute('aria-label')).toBe('AI speed-up')
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    expect(btn.querySelector('svg')).toBeNull()
    expect(btn.classList.contains(styles.aiButton)).toBe(true)
    expect(btn.classList.contains(styles.aiButtonOn)).toBe(false)
    expect(optionsGroup()).toBeNull()
  })

  it('tlačítko AI je v horním řádku hned před křížkem', () => {
    renderCard(ben())
    const remove = screen.getByTitle('Remove unit')
    expect(remove.previousElementSibling).toBe(aiButton())
  })

  it('jednotka s aiMultiplier 1 vypadá stejně jako jednotka bez AI', () => {
    renderCard(ben(1))
    expect(aiButton().textContent).toBe('AI')
    expect(aiButton().getAttribute('aria-label')).toBe('AI speed-up')
    expect(aiButton().querySelector('svg')).toBeNull()
  })

  it('kliknutí otevře menu s volbami 2× a 5× (bez „off“), propojené přes aria-controls', () => {
    renderCard(ben())
    fireEvent.click(aiButton())
    expect(aiButton().getAttribute('aria-expanded')).toBe('true')
    const group = optionsGroup()!
    expect(group).not.toBeNull()
    expect(aiButton().getAttribute('aria-controls')).toBe(group.id)
    const names = within(group).getAllByRole('button').map(b => b.textContent)
    expect(names).toEqual(['2×', '5×'])
    for (const b of within(group).getAllByRole('button')) expect(b.getAttribute('aria-pressed')).toBe('false')
  })

  it('výběr 5× zavolá onSetAiMultiplier(id, 5), menu zavře a vrátí fokus na tlačítko AI', () => {
    const { onSetAiMultiplier } = renderCard(ben())
    fireEvent.click(aiButton())
    const five = within(optionsGroup()!).getByRole('button', { name: '5×' })
    five.focus()
    fireEvent.click(five)
    expect(onSetAiMultiplier).toHaveBeenCalledTimes(1)
    expect(onSetAiMultiplier).toHaveBeenCalledWith(7, 5)
    expect(optionsGroup()).toBeNull()
    expect(aiButton().getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(aiButton())
  })

  it('výběr 2× zavolá onSetAiMultiplier(id, 2)', () => {
    const { onSetAiMultiplier } = renderCard(ben())
    fireEvent.click(aiButton())
    fireEvent.click(within(optionsGroup()!).getByRole('button', { name: '2×' }))
    expect(onSetAiMultiplier).toHaveBeenCalledWith(7, 2)
  })

  it('opětovné kliknutí na tlačítko AI menu zavře bez změny', () => {
    const { onSetAiMultiplier } = renderCard(ben())
    fireEvent.click(aiButton())
    fireEvent.click(aiButton())
    expect(optionsGroup()).toBeNull()
    expect(onSetAiMultiplier).not.toHaveBeenCalled()
  })

  it('Escape ve volbách menu zavře menu bez změny a vrátí fokus na tlačítko AI', () => {
    const { onSetAiMultiplier } = renderCard(ben())
    fireEvent.click(aiButton())
    const five = within(optionsGroup()!).getByRole('button', { name: '5×' })
    five.focus()
    fireEvent.keyDown(five, { key: 'Escape' })
    expect(optionsGroup()).toBeNull()
    expect(onSetAiMultiplier).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(aiButton())
  })

  it('Escape na tlačítku AI menu zavře', () => {
    renderCard(ben())
    fireEvent.click(aiButton())
    fireEvent.keyDown(aiButton(), { key: 'Escape' })
    expect(optionsGroup()).toBeNull()
    expect(aiButton().getAttribute('aria-expanded')).toBe('false')
  })
})

describe('feat-019 Příklad 5: tlačítko AI se zapnutým AI', () => {
  it('AI 5×: modrý odznak s bleskem a textem „5×“, přístupný název obsahuje hodnotu', () => {
    renderCard(ben(5))
    const btn = aiButton()
    expect(btn.textContent).toBe('5×')
    expect(btn.getAttribute('aria-label')).toBe('AI speed-up: 5×')
    expect(btn.querySelector('svg')).not.toBeNull()
    expect(btn.classList.contains(styles.aiButton)).toBe(true)
    expect(btn.classList.contains(styles.aiButtonOn)).toBe(true)
  })

  it('AI 2×: odznak ukazuje „2×“ a přístupný název „AI speed-up: 2×“', () => {
    renderCard(ben(2))
    expect(aiButton().textContent).toBe('2×')
    expect(aiButton().getAttribute('aria-label')).toBe('AI speed-up: 2×')
    expect(aiButton().querySelector('svg')).not.toBeNull()
  })

  it('menu při zapnutém AI nabídne i „off“ a aktuální volbu označí jako vybranou', () => {
    renderCard(ben(5))
    fireEvent.click(aiButton())
    const group = optionsGroup()!
    const buttons = within(group).getAllByRole('button')
    expect(buttons.map(b => b.textContent)).toEqual(['2×', '5×', 'off'])
    const five = within(group).getByRole('button', { name: '5×' })
    const two = within(group).getByRole('button', { name: '2×' })
    expect(five.getAttribute('aria-pressed')).toBe('true')
    expect(two.getAttribute('aria-pressed')).toBe('false')
    expect(five.classList.contains(styles.aiOptionSelected)).toBe(true)
    expect(two.classList.contains(styles.aiOptionSelected)).toBe(false)
  })

  it('„off“ zavolá onSetAiMultiplier(id, 1) a menu zavře', () => {
    const { onSetAiMultiplier } = renderCard(ben(5))
    fireEvent.click(aiButton())
    fireEvent.click(within(optionsGroup()!).getByRole('button', { name: 'off' }))
    expect(onSetAiMultiplier).toHaveBeenCalledWith(7, 1)
    expect(optionsGroup()).toBeNull()
  })
})

describe('feat-019: menu AI patří konkrétní jednotce', () => {
  it('když karta dostane jiný objekt jednotky se stejným ID (výměna týmu), otevřené menu se zavře', () => {
    const { rerenderWith } = renderCard(ben())
    fireEvent.click(aiButton())
    expect(optionsGroup()).not.toBeNull()
    rerenderWith(ben())
    expect(optionsGroup()).toBeNull()
    expect(aiButton().getAttribute('aria-expanded')).toBe('false')
  })

  it('překreslení se stejným objektem jednotky (např. po změně jména) menu nechá otevřené', () => {
    const member = ben()
    const { rerenderWith } = renderCard(member)
    fireEvent.click(aiButton())
    member.name = 'Benny'
    rerenderWith(member)
    expect(optionsGroup()).not.toBeNull()
  })
})
