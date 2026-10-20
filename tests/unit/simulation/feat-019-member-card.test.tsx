import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemberCard } from '@/components/MemberCard'
import styles from '@/components/MemberCard.module.css'
import { ROLE_META } from '@/simulation/engine'
import type { AiMultiplier, Member } from '@/types/simulation'

// feat-019 (AI multiplikátor výkonu) — tlačítko AI na kartě jednotky (Příklady 5 a 10).
//
// Schválený kontrakt (spec features/feat-019-ai-multiplikator-vykonu.md, změna 2026-10-20):
//  - `MemberCard` má prop `onSetAiMultiplier: (memberId: number, value: AiMultiplier) => void`.
//  - V horním řádku karty je vlevo od křížku tlačítko AI. Přístupný název: bez AI „AI speed-up“,
//    se zapnutým AI „AI speed-up: 5×“ (viditelná hodnota je součástí názvu — WCAG 2.5.3).
//    Bez AI ukazuje text „AI“, se zapnutým AI hodnotu a ikonu blesku (svg).
//  - Statické styly jsou v `MemberCard.module.css` (konvence CLAUDE.md): tlačítko má třídu `aiButton`,
//    se zapnutým AI navíc `aiButtonOn` (odznak v barvě accent).
//  - Každé kliknutí nastaví další hodnotu v pořadí 1× → 2× → 5× → 1×: zavolá
//    `onSetAiMultiplier(member.id, další)`. Žádné menu voleb se neotevře (tlačítko nemá
//    `aria-expanded` ani `aria-controls`), fokus zůstává na tlačítku.
//  - Tooltip (`title`) říká, co udělá další kliknutí: „AI speed-up – click for 2×“,
//    „AI speed-up: 2× – click for 5×“, „AI speed-up: 5× – click to turn off“.
//  - Křížek („Remove unit“) se nemění.

/**
 * Vytvoří jednotku pro test. `ai` vynecháno = jednotka bez pole `aiMultiplier`.
 *
 * @param ai - AI multiplikátor jednotky
 * @returns Jednotka „Ben“ se specializací Backend
 */
function ben(ai?: AiMultiplier): Member {
  const m: Member = { id: 7, name: 'Ben', roles: ['BE'], currentTask: null, idleSec: 0 }
  if (ai !== undefined) m.aiMultiplier = ai
  return m
}

/**
 * Prvek karty jednotky se všemi povinnými props.
 *
 * @param member            - Vykreslovaná jednotka
 * @param onSetAiMultiplier - Handler AI (mock nebo zápis do stavu rodiče)
 * @returns React element karty
 */
function card(member: Member, onSetAiMultiplier: (memberId: number, value: AiMultiplier) => void) {
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
 * Vykreslí kartu jednotky a vrátí mock handleru AI.
 *
 * @param member - Vykreslovaná jednotka
 * @returns Mock `onSetAiMultiplier`
 */
function renderCard(member: Member) {
  const onSetAiMultiplier = vi.fn()
  render(card(member, onSetAiMultiplier))
  return { onSetAiMultiplier }
}

/**
 * Karta, která si změnu AI zapíše jako rodič (Simulator) — nová hodnota se hned vykreslí.
 * Díky tomu jde v testu klikat opakovaně a sledovat celé kolečko 1× → 2× → 5× → 1×.
 *
 * @param onSet - Mock, který zaznamená každé volání handleru
 * @returns React element karty se stavem jednotky
 */
function StatefulCard({ onSet }: { onSet: (memberId: number, value: AiMultiplier) => void }) {
  const [member, setMember] = useState<Member>(ben())
  return card(member, (id, value) => {
    onSet(id, value)
    setMember(m => ({ ...m, aiMultiplier: value }))
  })
}

const aiButton = () => screen.getByRole('button', { name: /^AI speed-up/ })
// Skupina voleb z dřívějšího menu — po změně 2026-10-20 nesmí existovat
const optionsGroup = () => screen.queryByRole('group', { name: 'AI speed-up options' })

/**
 * Stav tlačítka AI tak, jak ho vidí uživatel: text, přístupný název, blesk a třída odznaku.
 *
 * @returns Text, aria-label, zda má ikonu blesku a zda je odznakem (`aiButtonOn`)
 */
function aiState() {
  const btn = aiButton()
  return {
    text: btn.textContent,
    label: btn.getAttribute('aria-label'),
    bolt: btn.querySelector('svg') !== null,
    badge: btn.classList.contains(styles.aiButtonOn),
  }
}

describe('feat-019 Příklad 5: tlačítko AI bez zapnutého AI', () => {
  it('vedle křížku je průhledné tlačítko „AI“ bez vazby na menu', () => {
    renderCard(ben())
    const btn = aiButton()
    expect(aiState()).toEqual({ text: 'AI', label: 'AI speed-up', bolt: false, badge: false })
    expect(btn.classList.contains(styles.aiButton)).toBe(true)
    // Tlačítko nic neotevírá — nemá atributy rozbalovacího prvku
    expect(btn.hasAttribute('aria-expanded')).toBe(false)
    expect(btn.hasAttribute('aria-controls')).toBe(false)
    expect(optionsGroup()).toBeNull()
  })

  it('tlačítko AI je v horním řádku hned před křížkem', () => {
    renderCard(ben())
    const remove = screen.getByTitle('Remove unit')
    expect(remove.previousElementSibling).toBe(aiButton())
  })

  it('jednotka s aiMultiplier 1 vypadá stejně jako jednotka bez AI', () => {
    renderCard(ben(1))
    expect(aiState()).toEqual({ text: 'AI', label: 'AI speed-up', bolt: false, badge: false })
  })
})

describe('feat-019 Příklad 5: tlačítko AI se zapnutým AI', () => {
  it('AI 5×: odznak s bleskem a textem „5×“, přístupný název obsahuje hodnotu', () => {
    renderCard(ben(5))
    expect(aiState()).toEqual({ text: '5×', label: 'AI speed-up: 5×', bolt: true, badge: true })
    expect(aiButton().classList.contains(styles.aiButton)).toBe(true)
  })

  it('AI 2×: odznak ukazuje „2×“ a přístupný název „AI speed-up: 2×“', () => {
    renderCard(ben(2))
    expect(aiState()).toEqual({ text: '2×', label: 'AI speed-up: 2×', bolt: true, badge: true })
  })
})

describe('feat-019 Příklad 5: kliknutí nastaví další hodnotu v pořadí 1× → 2× → 5× → 1×', () => {
  // Pořadí sloupců odpovídá %s v názvu testu: popis jednotky, očekávaná další hodnota, výchozí AI
  it.each([
    ['bez AI (pole chybí)', 2, undefined],
    ['1×', 2, 1],
    ['2×', 5, 2],
    ['5×', 1, 5],
  ] as const)('jednotka %s: kliknutí zavolá onSetAiMultiplier(id, %s) právě jednou a neotevře menu', (_name, next, ai) => {
    const { onSetAiMultiplier } = renderCard(ben(ai))
    fireEvent.click(aiButton())
    expect(onSetAiMultiplier).toHaveBeenCalledTimes(1)
    expect(onSetAiMultiplier).toHaveBeenCalledWith(7, next)
    expect(optionsGroup()).toBeNull()
  })

  it('tři kliknutí po sobě: odznak 2×, odznak 5×, zpět průhledné „AI“; menu se neotevře', () => {
    const onSet = vi.fn()
    render(<StatefulCard onSet={onSet} />)

    fireEvent.click(aiButton())
    expect(aiState()).toEqual({ text: '2×', label: 'AI speed-up: 2×', bolt: true, badge: true })
    expect(optionsGroup()).toBeNull()

    fireEvent.click(aiButton())
    expect(aiState()).toEqual({ text: '5×', label: 'AI speed-up: 5×', bolt: true, badge: true })
    expect(optionsGroup()).toBeNull()

    fireEvent.click(aiButton())
    expect(aiState()).toEqual({ text: 'AI', label: 'AI speed-up', bolt: false, badge: false })
    expect(optionsGroup()).toBeNull()

    expect(onSet.mock.calls).toEqual([[7, 2], [7, 5], [7, 1]])
  })
})

describe('feat-019 Příklad 10: tooltip a klávesnice', () => {
  it.each([
    ['bez AI', undefined, 'AI speed-up – click for 2×'],
    ['2×', 2, 'AI speed-up: 2× – click for 5×'],
    ['5×', 5, 'AI speed-up: 5× – click to turn off'],
  ] as const)('tooltip jednotky %s říká, co udělá další kliknutí', (_name, ai, title) => {
    renderCard(ben(ai))
    expect(aiButton().getAttribute('title')).toBe(title)
  })

  it('Enter třikrát: 2×, 5×, 1× jako kliknutím; fokus zůstává na tlačítku, název i tooltip se mění', async () => {
    const user = userEvent.setup()
    const onSet = vi.fn()
    render(<StatefulCard onSet={onSet} />)
    aiButton().focus()

    await user.keyboard('{Enter}')
    expect(document.activeElement).toBe(aiButton())
    expect(aiButton().getAttribute('aria-label')).toBe('AI speed-up: 2×')
    expect(aiButton().getAttribute('title')).toBe('AI speed-up: 2× – click for 5×')

    await user.keyboard('{Enter}')
    expect(document.activeElement).toBe(aiButton())
    expect(aiButton().getAttribute('aria-label')).toBe('AI speed-up: 5×')
    expect(aiButton().getAttribute('title')).toBe('AI speed-up: 5× – click to turn off')

    await user.keyboard('{Enter}')
    expect(document.activeElement).toBe(aiButton())
    expect(aiButton().getAttribute('aria-label')).toBe('AI speed-up')
    expect(aiButton().getAttribute('title')).toBe('AI speed-up – click for 2×')

    expect(onSet.mock.calls).toEqual([[7, 2], [7, 5], [7, 1]])
  })

  it('mezerník přepne stejně jako Enter', async () => {
    const user = userEvent.setup()
    const { onSetAiMultiplier } = renderCard(ben())
    aiButton().focus()
    await user.keyboard(' ')
    expect(onSetAiMultiplier).toHaveBeenCalledWith(7, 2)
  })
})
