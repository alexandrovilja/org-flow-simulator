import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemberCard } from '@/components/MemberCard'
import cardStyles from '@/components/MemberCard.module.css'
import chipStyles from '@/components/RoleChip.module.css'
import { ROLE_META } from '@/simulation/engine'
import type { AiMultiplier, Feature, Member, RoleMeta, Task } from '@/types/simulation'

// feat-019 (AI multiplikátor výkonu, revize 2026-11-03: AI po skillech) — tlačítko AI na chipu skillu
// (Příklady 1, 8, 14 a 15).
//
// Schválený kontrakt (spec features/feat-019-ai-multiplikator-vykonu.md + mockup docs/feat-019-ui-mockup.html):
//  - `MemberCard` má prop `onSetAiMultiplier: (memberId: number, role: Role, value: AiMultiplier) => void`.
//  - Každý chip skillu má tlačítko AI mezi názvem skillu a křížkem pro odebrání skillu. Z horního řádku karty
//    (avatar, jméno, křížek jednotky) tlačítko AI zmizelo.
//  - Přístupný název: „AI speed-up for Development“, se zapnutým AI „AI speed-up for Development: 5×“
//    (viditelná hodnota je součástí názvu — WCAG 2.5.3). Bez AI ukazuje text „AI“, se zapnutým AI hodnotu
//    a ikonu blesku (svg).
//  - Statické styly jsou v `RoleChip.module.css` (konvence CLAUDE.md): tlačítko má třídu `aiButton`,
//    se zapnutým AI navíc `aiButtonOn` (bílý odznak).
//  - Každé kliknutí nastaví další hodnotu v pořadí 1× → 2× → 5× → 1×: zavolá
//    `onSetAiMultiplier(member.id, role, další)`. Žádné menu voleb se neotevře, fokus zůstává na tlačítku.
//  - Tooltip (`title`) říká, co udělá další kliknutí: „AI speed-up for Development – click for 2×“,
//    „… : 2× – click for 5×“, „… : 5× – click to turn off“.
//  - Značka u rozpracovaného úkolu: v řádku úkolu (`taskLine`) je vedle názvu skillu odznak „5×“ s bleskem
//    a titulkem „AI speed-up: 5×“, jen když skill právě zpracovávaného úkolu má AI. Není to tlačítko.

// Skilly jednotky podle příkladů ve specu: Development, Code Review, UAT
const ROLES: Record<string, RoleMeta> = {
  DEV: { ...ROLE_META.FE, label: 'Development' },
  REV: { ...ROLE_META.QA, label: 'Code Review' },
  UAT: { ...ROLE_META.OPS, label: 'UAT' },
}

/**
 * Vytvoří jednotku Anna se skilly Development, Code Review a UAT.
 *
 * @param ai - AI multiplikátory po skillech; vynecháno = pole `aiBySkill` chybí
 * @returns Jednotka „Anna“
 */
function anna(ai?: Partial<Record<string, AiMultiplier>>): Member {
  const m: Member = { id: 7, name: 'Anna', roles: ['DEV', 'REV', 'UAT'], currentTask: null, idleSec: 0 }
  if (ai !== undefined) m.aiBySkill = { ...ai }
  return m
}

type OnSetAi = (memberId: number, role: string, value: AiMultiplier) => void

/**
 * Prvek karty jednotky se všemi povinnými props.
 *
 * @param member            - Vykreslovaná jednotka
 * @param onSetAiMultiplier - Handler AI (mock nebo zápis do stavu rodiče)
 * @param work              - Úkol, na kterém jednotka pracuje (a jeho featura); vynecháno = idle
 * @returns React element karty
 */
function card(member: Member, onSetAiMultiplier: OnSetAi, work?: { feature: Feature; task: Task }) {
  return (
    <MemberCard
      member={member}
      currentFeature={work?.feature ?? null}
      currentTask={work?.task ?? null}
      roleConfig={ROLES}
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
 * @param work   - Úkol, na kterém jednotka pracuje; vynecháno = idle
 * @returns Mock `onSetAiMultiplier` a vykreslený kontejner
 */
function renderCard(member: Member, work?: { feature: Feature; task: Task }) {
  const onSetAiMultiplier = vi.fn()
  const { container } = render(card(member, onSetAiMultiplier, work))
  return { onSetAiMultiplier, container }
}

/**
 * Karta, která si změnu AI zapíše jako rodič (Simulator) — nová hodnota se hned vykreslí.
 * Díky tomu jde v testu klikat opakovaně a sledovat celé kolečko 1× → 2× → 5× → 1×.
 *
 * @param onSet - Mock, který zaznamená každé volání handleru
 * @returns React element karty se stavem jednotky
 */
function StatefulCard({ onSet }: { onSet: OnSetAi }) {
  const [member, setMember] = useState<Member>(anna())
  return card(member, (id, role, value) => {
    onSet(id, role, value)
    setMember(m => {
      const next = { ...(m.aiBySkill ?? {}), [role]: value }
      if (value === 1) delete next[role]
      return { ...m, aiBySkill: Object.keys(next).length > 0 ? next : undefined }
    })
  })
}

/**
 * Úkol skillu `role` s featurou pro řádek úkolu na kartě.
 *
 * @param role - Skill úkolu ('DEV', 'REV', 'UAT')
 * @returns Featura a task, na kterém jednotka právě pracuje
 */
function workOn(role: string): { feature: Feature; task: Task } {
  const task: Task = { id: 1, role, work: 10, progress: 4, status: 'doing', assignee: 7 }
  const feature: Feature = {
    id: 1, name: 'Checkout flow', hue: 250, priority: 1,
    createdAt: 0, startedAt: 0, finishedAt: null, status: 'in-progress',
    revenuePerTick: 100, totalRevenue: 0, lastTickRevenue: null, lastRevenueTickAt: 0,
    joinCount: 0, reworkCount: 0, joinTaxSec: 0, reworkSec: 0, workedBy: [7], pendingDivergence: [],
    revenueProfile: 'flat', revenueTickCount: 0, coordSeed: 0,
    tasks: [task],
  }
  return { feature, task }
}

// Tlačítko AI na chipu daného skillu (název skillu je součástí přístupného názvu)
const aiButton = (skill: string) => screen.getByRole('button', { name: new RegExp(`^AI speed-up for ${skill}`) })
const allAiButtons = () => screen.queryAllByRole('button', { name: /^AI speed-up/ })
// Skupina voleb z dřívějšího menu — nesmí existovat
const optionsGroup = () => screen.queryByRole('group', { name: 'AI speed-up options' })

/**
 * Stav tlačítka AI tak, jak ho vidí uživatel: text, přístupný název, blesk a třída odznaku.
 *
 * @param skill - Název skillu, jehož chip se čte
 * @returns Text, aria-label, zda má ikonu blesku a zda je odznakem (`aiButtonOn`)
 */
function aiState(skill: string) {
  const btn = aiButton(skill)
  return {
    text: btn.textContent,
    label: btn.getAttribute('aria-label'),
    bolt: btn.querySelector('svg') !== null,
    badge: btn.classList.contains(chipStyles.aiButtonOn),
  }
}

describe('feat-019 Příklad 1: tlačítko AI na chipu bez zapnutého AI', () => {
  it('každý skill má na chipu průhledné tlačítko „AI“ s názvem skillu bez vazby na menu', () => {
    renderCard(anna())
    expect(allAiButtons()).toHaveLength(3)
    for (const skill of ['Development', 'Code Review', 'UAT']) {
      expect(aiState(skill)).toEqual({ text: 'AI', label: `AI speed-up for ${skill}`, bolt: false, badge: false })
      const btn = aiButton(skill)
      expect(btn.classList.contains(chipStyles.aiButton)).toBe(true)
      // Tlačítko nic neotevírá — nemá atributy rozbalovacího prvku
      expect(btn.hasAttribute('aria-expanded')).toBe(false)
      expect(btn.hasAttribute('aria-controls')).toBe(false)
    }
    expect(optionsGroup()).toBeNull()
  })

  it('tlačítko AI je na chipu mezi názvem skillu a křížkem pro odebrání skillu', () => {
    renderCard(anna())
    const btn = aiButton('Development')
    const chip = btn.parentElement!
    expect(chip.textContent).toContain('Development')
    // Křížek skillu je hned za tlačítkem AI
    const removeSkill = within(chip).getByTitle('Remove role')
    expect(btn.nextElementSibling).toBe(removeSkill)
    // Název skillu je před tlačítkem AI
    expect(chip.textContent!.indexOf('Development')).toBeLessThan(chip.textContent!.indexOf('AI'))
  })

  it('v horním řádku karty (avatar, jméno, křížek jednotky) tlačítko AI není', () => {
    renderCard(anna())
    const topRow = screen.getByTitle('Remove unit').parentElement!
    expect(within(topRow).queryByRole('button', { name: /AI speed-up/ })).toBeNull()
    // Křížek jednotky se nemění
    expect(within(topRow).getByTitle('Remove unit')).toBeTruthy()
  })

  it('skill s hodnotou 1 vypadá stejně jako skill bez AI', () => {
    renderCard(anna({ DEV: 1 }))
    expect(aiState('Development')).toEqual({ text: 'AI', label: 'AI speed-up for Development', bolt: false, badge: false })
  })

  it('jednotka bez skillů nemá žádné tlačítko AI', () => {
    renderCard({ id: 7, name: 'Anna', roles: [], currentTask: null, idleSec: 0 })
    expect(allAiButtons()).toHaveLength(0)
  })
})

describe('feat-019 Příklad 8: chip se zapnutým AI', () => {
  it('Development 5×: odznak s bleskem a textem „5×“, přístupný název obsahuje skill i hodnotu', () => {
    renderCard(anna({ DEV: 5 }))
    expect(aiState('Development')).toEqual({ text: '5×', label: 'AI speed-up for Development: 5×', bolt: true, badge: true })
    expect(aiButton('Development').classList.contains(chipStyles.aiButton)).toBe(true)
  })

  it('Development 2×: odznak ukazuje „2×“ a přístupný název „AI speed-up for Development: 2×“', () => {
    renderCard(anna({ DEV: 2 }))
    expect(aiState('Development')).toEqual({ text: '2×', label: 'AI speed-up for Development: 2×', bolt: true, badge: true })
  })

  it('AI u jednoho skillu nemění ostatní chipy téže jednotky (Anna: Development 5×, Code Review a UAT bez AI)', () => {
    renderCard(anna({ DEV: 5 }))
    expect(aiState('Development').badge).toBe(true)
    expect(aiState('Code Review')).toEqual({ text: 'AI', label: 'AI speed-up for Code Review', bolt: false, badge: false })
    expect(aiState('UAT')).toEqual({ text: 'AI', label: 'AI speed-up for UAT', bolt: false, badge: false })
  })
})

describe('feat-019 Příklad 8: kliknutí nastaví další hodnotu v pořadí 1× → 2× → 5× → 1×', () => {
  // Pořadí sloupců odpovídá %s v názvu testu: popis chipu, očekávaná další hodnota, výchozí AI
  it.each([
    ['bez AI (klíč chybí)', 2, undefined],
    ['1×', 2, 1],
    ['2×', 5, 2],
    ['5×', 1, 5],
  ] as const)('chip Development %s: kliknutí zavolá onSetAiMultiplier(id, "DEV", %s) právě jednou a neotevře menu', (_name, next, ai) => {
    const { onSetAiMultiplier } = renderCard(anna(ai === undefined ? undefined : { DEV: ai }))
    fireEvent.click(aiButton('Development'))
    expect(onSetAiMultiplier).toHaveBeenCalledTimes(1)
    expect(onSetAiMultiplier).toHaveBeenCalledWith(7, 'DEV', next)
    expect(optionsGroup()).toBeNull()
  })

  it('kliknutí na AI u Code Review předá skill REV, ne skill jiného chipu', () => {
    const { onSetAiMultiplier } = renderCard(anna({ DEV: 5 }))
    fireEvent.click(aiButton('Code Review'))
    expect(onSetAiMultiplier).toHaveBeenCalledTimes(1)
    expect(onSetAiMultiplier).toHaveBeenCalledWith(7, 'REV', 2)
  })

  it('tři kliknutí po sobě na Development: odznak 2×, odznak 5×, zpět průhledné „AI“; ostatní chipy beze změny, menu se neotevře', () => {
    const onSet = vi.fn()
    render(<StatefulCard onSet={onSet} />)
    const others = () => ({ review: aiState('Code Review').badge, uat: aiState('UAT').badge })

    fireEvent.click(aiButton('Development'))
    expect(aiState('Development')).toEqual({ text: '2×', label: 'AI speed-up for Development: 2×', bolt: true, badge: true })
    expect(others()).toEqual({ review: false, uat: false })
    expect(optionsGroup()).toBeNull()

    fireEvent.click(aiButton('Development'))
    expect(aiState('Development')).toEqual({ text: '5×', label: 'AI speed-up for Development: 5×', bolt: true, badge: true })
    expect(others()).toEqual({ review: false, uat: false })

    fireEvent.click(aiButton('Development'))
    expect(aiState('Development')).toEqual({ text: 'AI', label: 'AI speed-up for Development', bolt: false, badge: false })
    expect(others()).toEqual({ review: false, uat: false })
    expect(optionsGroup()).toBeNull()

    expect(onSet.mock.calls).toEqual([[7, 'DEV', 2], [7, 'DEV', 5], [7, 'DEV', 1]])
  })
})

describe('feat-019 Příklad 14: značka AI u rozpracovaného úkolu', () => {
  /**
   * Řádek úkolu na kartě (název featury, skill, značka).
   *
   * @param container - Vykreslený kontejner karty
   * @returns Element řádku úkolu
   */
  const taskLine = (container: HTMLElement) => container.querySelector<HTMLElement>(`.${cardStyles.taskLine}`)!

  it('jednotka pracuje na Development s AI 5×: u skillu v řádku úkolu je odznak „5×“ s titulkem „AI speed-up: 5×“', () => {
    const { container } = renderCard(anna({ DEV: 5 }), workOn('DEV'))
    const line = taskLine(container)
    expect(within(line).getByText('Development')).toBeTruthy()
    const mark = within(line).getByTitle('AI speed-up: 5×')
    expect(mark.textContent).toBe('5×')
    expect(mark.querySelector('svg')).not.toBeNull()
    // Značka je jen informace — není to ovládací prvek
    expect(within(line).queryByRole('button')).toBeNull()
  })

  it('AI 2× u skillu úkolu ukáže „2×“', () => {
    const { container } = renderCard(anna({ DEV: 2 }), workOn('DEV'))
    expect(within(taskLine(container)).getByTitle('AI speed-up: 2×').textContent).toBe('2×')
  })

  it('jednotka pracuje na Code Review bez AI (AI je jen u Development): řádek úkolu je bez značky, chip Development odznak má', () => {
    const { container } = renderCard(anna({ DEV: 5 }), workOn('REV'))
    const line = taskLine(container)
    expect(within(line).getByText('Code Review')).toBeTruthy()
    expect(line.textContent).not.toContain('×')
    expect(within(line).queryByTitle(/AI speed-up/)).toBeNull()
    expect(aiState('Development').badge).toBe(true)
  })

  it('jednotka bez AI při práci značku nemá', () => {
    const { container } = renderCard(anna(), workOn('DEV'))
    expect(taskLine(container).textContent).not.toContain('×')
  })

  it('idle jednotka s AI u skillů nemá řádek úkolu, a tedy ani značku', () => {
    const { container } = renderCard(anna({ DEV: 5 }))
    expect(container.querySelector(`.${cardStyles.taskLine}`)).toBeNull()
  })
})

describe('feat-019 Příklad 15: tooltip a klávesnice', () => {
  it.each([
    ['bez AI', undefined, 'AI speed-up for Development – click for 2×'],
    ['2×', 2, 'AI speed-up for Development: 2× – click for 5×'],
    ['5×', 5, 'AI speed-up for Development: 5× – click to turn off'],
  ] as const)('tooltip chipu Development %s říká, co udělá další kliknutí', (_name, ai, title) => {
    renderCard(anna(ai === undefined ? undefined : { DEV: ai }))
    expect(aiButton('Development').getAttribute('title')).toBe(title)
  })

  it('tooltip obsahuje název skillu daného chipu', () => {
    renderCard(anna())
    expect(aiButton('Code Review').getAttribute('title')).toBe('AI speed-up for Code Review – click for 2×')
    expect(aiButton('UAT').getAttribute('title')).toBe('AI speed-up for UAT – click for 2×')
  })

  it('Enter třikrát: 2×, 5×, 1× jako kliknutím; fokus zůstává na tlačítku, název i tooltip se mění', async () => {
    const user = userEvent.setup()
    const onSet = vi.fn()
    render(<StatefulCard onSet={onSet} />)
    aiButton('Development').focus()

    await user.keyboard('{Enter}')
    expect(document.activeElement).toBe(aiButton('Development'))
    expect(aiButton('Development').getAttribute('aria-label')).toBe('AI speed-up for Development: 2×')
    expect(aiButton('Development').getAttribute('title')).toBe('AI speed-up for Development: 2× – click for 5×')

    await user.keyboard('{Enter}')
    expect(document.activeElement).toBe(aiButton('Development'))
    expect(aiButton('Development').getAttribute('aria-label')).toBe('AI speed-up for Development: 5×')
    expect(aiButton('Development').getAttribute('title')).toBe('AI speed-up for Development: 5× – click to turn off')

    await user.keyboard('{Enter}')
    expect(document.activeElement).toBe(aiButton('Development'))
    expect(aiButton('Development').getAttribute('aria-label')).toBe('AI speed-up for Development')
    expect(aiButton('Development').getAttribute('title')).toBe('AI speed-up for Development – click for 2×')

    expect(onSet.mock.calls).toEqual([[7, 'DEV', 2], [7, 'DEV', 5], [7, 'DEV', 1]])
  })

  it('mezerník přepne stejně jako Enter', async () => {
    const user = userEvent.setup()
    const { onSetAiMultiplier } = renderCard(anna())
    aiButton('Development').focus()
    await user.keyboard(' ')
    expect(onSetAiMultiplier).toHaveBeenCalledWith(7, 'DEV', 2)
  })
})
