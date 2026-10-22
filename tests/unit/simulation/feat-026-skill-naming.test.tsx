import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { Simulator } from '@/components/Simulator'
import { BacklogSettingsPanel } from '@/components/BacklogSettingsPanel'
import { MemberCard } from '@/components/MemberCard'
import { TUTORIAL_STEPS } from '@/lib/tutorialSteps'
import { markTutorialCompleted, markModeSeen, resetTutorial } from '@/lib/storage'
import { mulberry32, makeInitialState, ROLE_META, PRESETS } from '@/simulation/engine'
import type { Member, SimSettings } from '@/types/simulation'
import type { TutorialMode } from '@/types/tutorial'

// feat-026 (Přejmenování „Specialization“ na „Skill“) — texty v aplikaci a v tutoriálu.
//
// Schválený kontrakt: features/feat-026-prejmenovani-specialization-na-skill.md, Příklady 1–8.
//  - Příklady 1–2: rozbalovací sekce v Advanced i Cash Flow se jmenují „Backlog“, „Skills“, „Team“.
//  - Příklad 3: posuvník „Min. skills per item“ s nápovědou (atribut title) o skills.
//  - Příklad 4: potvrzení výchozí sestavy „Your current team and skills will be replaced. …“.
//  - Příklad 5: v sekci Skills formulář „Add skill“ a vstupy s přístupným názvem „Skill name“.
//  - Příklad 6: „+“ na kartě jednotky má přístupný název „Add skill“; nápověda panelu Units
//    „Click + to add a skill“ v Advanced i Cash Flow.
//  - Příklad 7: krok 8 prohlídky Advanced má nadpis „Skills“ a zvýrazní hlavičku sekce Skills;
//    text kroku 13 končí „…different phases under Skills.“
//  - Příklad 8: slova „specialization(s)“ a „specialty“ nejsou nikde ve viditelném textu, přístupných
//    názvech, nápovědách ani v textech tutoriálu. „specialisation“ (britsky, věta v rámečku výsledku)
//    a „specialist(s)“ zůstávají — proto se hledá jen tvar se „z“ a „specialty“.
//  - Příklad 16 (doplněno po review): posuvníky v sekci Backlog mluví o skills — „≥ 3 skills“,
//    „Skill-mix variability“ s hodnotami „2 skills“ / „1–6 skills“ a nápovědou o skills; v sekci
//    Backlog se slovo „role(s)“ nevyskytuje.
// Vnitřní názvy (`minSpecializations`, cíle `…-specializations-accordion`, id kroku) se nemění.

/** Zakázaná slova z Příkladu 8 — jen tvar se „z“, britské „specialisation“ v rámečku výsledku zůstává. */
const FORBIDDEN = /specialization|specialty/i

beforeEach(() => {
  localStorage.clear()
  resetTutorial()
  // Vracející se uživatel — tutoriál by jinak překryl obrazovku a přidal vlastní texty
  markTutorialCompleted()
  markModeSeen('compare')
  markModeSeen('experiment')
  markModeSeen('cashflow')
})

/** Přepne na záložku módu v horní liště. */
const tab = (name: 'Compare' | 'Advanced' | 'Cash Flow') => fireEvent.click(screen.getByRole('tab', { name }))

const SETTINGS: SimSettings = {
  minBacklog: 0,
  wipLimit: 6,
  sizeVar: 0.4,
  roleVar: 0.5,
  initialBacklog: 5,
  minSpecializations: 1,
}

/**
 * Vykreslí panel nastavení samostatně, se všemi povinnými props jako mock (stejně jako testy feat-022).
 *
 * @param extra - Props, které test přepisuje
 * @returns Výsledek renderu
 */
function renderPanel(extra: Partial<ComponentProps<typeof BacklogSettingsPanel>> = {}) {
  const state = makeInitialState(mulberry32(42), SETTINGS)
  const props: ComponentProps<typeof BacklogSettingsPanel> = {
    state, settings: SETTINGS, setSettings: vi.fn(), roleConfig: ROLE_META,
    activePresetId: 'teams', confirmingPreset: null, setConfirmingPreset: vi.fn(),
    showBacklogControls: true, setShowBacklogControls: vi.fn(),
    showRoleSettings: false, setShowRoleSettings: vi.fn(),
    showTeamSettings: false, setShowTeamSettings: vi.fn(),
    importMsg: null, fileInputRef: { current: null },
    wipMode: 'reduce-wip', setWipMode: vi.fn(), maxWork: 3,
    handleXlsImport: vi.fn(), handleRegenerate: vi.fn(), handlePresetClick: vi.fn(), handleConfirmPreset: vi.fn(),
    handleRoleChange: vi.fn(), handleAddRole: vi.fn(), handleDeleteRole: vi.fn(),
    ...extra,
  }
  return render(<BacklogSettingsPanel {...props} />)
}

/**
 * Vykreslí kartu jednotky s jediným skillem (DSGN), aby „+“ mělo co nabídnout.
 *
 * @returns Výsledek renderu
 */
function renderMemberCard() {
  const member: Member = { id: 1, name: 'Ada', roles: ['DSGN'], currentTask: null, idleSec: 0 }
  return render(
    <MemberCard member={member} currentFeature={null} currentTask={null} roleConfig={ROLE_META}
      onAddRole={vi.fn()} onRemoveRole={vi.fn()} onRename={vi.fn()} onRemove={vi.fn()} onSetAiMultiplier={vi.fn()} />,
  )
}

/**
 * Jediný prvek s daným cílem tutoriálu (test selže, když jich je víc nebo žádný).
 *
 * @param id - Hodnota atributu data-tutorial-target
 * @returns Nalezený prvek
 */
function target(id: string): HTMLElement {
  const found = document.querySelectorAll<HTMLElement>(`[data-tutorial-target="${id}"]`)
  expect(found, `cíl „${id}“`).toHaveLength(1)
  return found[0]
}

/**
 * Tlačítko rozbalovací sekce uvnitř cíle tutoriálu (cíl je tlačítko samo, nebo ho obsahuje).
 *
 * @param id - Hodnota atributu data-tutorial-target
 * @returns Tlačítko hlavičky sekce
 */
function accordionButton(id: string): HTMLButtonElement {
  const el = target(id)
  const button = el.matches('button[aria-expanded]') ? el : el.querySelector('button[aria-expanded]')
  expect(button, `tlačítko sekce v cíli „${id}“`).not.toBeNull()
  return button as HTMLButtonElement
}

/**
 * Rozbalí všechno, co jde rozbalit (sekce nastavení, nápovědy „?“, detaily dlaždic), aby hlídač
 * Příkladu 8 viděl i texty, které se ve výchozím stavu nevykreslují. Klikne jednou na každé
 * tlačítko, které je v okamžiku volání sbalené.
 */
function expandEverything(): void {
  const collapsed = Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-expanded="false"]'))
  for (const button of collapsed) fireEvent.click(button)
}

/**
 * Posbírá texty, které uživatel vidí nebo slyší ze čtečky: obsah stránky a atributy s textem
 * (přístupný název, nápověda přes title, placeholder, alt).
 *
 * @returns Pole textů k prohledání
 */
function userFacingTexts(): string[] {
  const texts = [document.body.textContent ?? '']
  for (const el of Array.from(document.body.querySelectorAll('*'))) {
    for (const attr of ['aria-label', 'title', 'placeholder', 'alt']) {
      const value = el.getAttribute(attr)
      if (value) texts.push(value)
    }
  }
  return texts
}

describe.each(['Advanced', 'Cash Flow'] as const)('feat-026 Příklady 1–2: sekce nastavení (%s)', mode => {
  it('sekce se jmenují „Backlog“, „Skills“ a „Team“', () => {
    render(<Simulator />)
    tab(mode)
    for (const name of ['Backlog', 'Skills', 'Team']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-expanded')
    }
    expect(screen.queryByRole('button', { name: 'Specializations' })).toBeNull()
  })
})

describe('feat-026 Příklad 3: posuvník minimálního počtu skillů', () => {
  it('má popisek „Min. skills per item“ a nápovědu o skills', () => {
    render(<Simulator />)
    tab('Advanced')
    fireEvent.click(screen.getByRole('button', { name: 'Backlog' }))
    expect(screen.getByRole('slider', { name: 'Min. skills per item' })).toBeInTheDocument()
    expect(screen.getByText('Min. skills per item')).toBeInTheDocument()
    expect(screen.getByTitle('Minimum number of different skills each backlog item must require.')).toBeInTheDocument()
    expect(screen.queryByRole('slider', { name: 'Min. specializations per item' })).toBeNull()
  })
})

describe('feat-026 Příklad 4: potvrzení výchozí sestavy', () => {
  it('dialog říká „Your current team and skills will be replaced. This cannot be undone.“', () => {
    renderPanel({ activePresetId: 'custom', confirmingPreset: PRESETS[1] })
    expect(screen.getByText('Your current team and skills will be replaced. This cannot be undone.')).toBeInTheDocument()
  })
})

describe('feat-026 Příklad 5: sekce Skills', () => {
  it('formulář pro novou položku má popisek „Add skill“', () => {
    renderPanel({ showRoleSettings: true })
    expect(screen.getByText('Add skill')).toBeInTheDocument()
    expect(screen.queryByText('Add specialization')).toBeNull()
  })

  it('každý vstup s názvem má přístupný název „Skill name“', () => {
    renderPanel({ showRoleSettings: true })
    expect(screen.getAllByRole('textbox', { name: 'Skill name' })).toHaveLength(Object.keys(ROLE_META).length)
    expect(screen.queryAllByRole('textbox', { name: 'Specialization name' })).toHaveLength(0)
  })
})

describe('feat-026 Příklad 6: přidání skillu jednotce', () => {
  it('„+“ na kartě jednotky má přístupný název „Add skill“ a nabídne ostatní skilly', () => {
    renderMemberCard()
    fireEvent.click(screen.getByRole('button', { name: 'Add skill' }))
    for (const [key, meta] of Object.entries(ROLE_META)) {
      if (key === 'DSGN') continue
      expect(screen.getByRole('button', { name: meta.label })).toBeInTheDocument()
    }
  })

  it.each(['Advanced', 'Cash Flow'] as const)('nápověda v hlavičce panelu Units je „Click + to add a skill“ (%s)', mode => {
    render(<Simulator />)
    tab(mode)
    expect(screen.getByText('Click + to add a skill')).toBeInTheDocument()
    expect(screen.queryByText('Click + to add a specialty')).toBeNull()
  })
})

describe('feat-026 Příklad 7: tutoriál Advanced', () => {
  it('krok 8 má nadpis „Skills“ a míří na hlavičku sekce Skills', () => {
    const step = TUTORIAL_STEPS.experiment[7]
    expect(step.id).toBe('experiment-specializations')
    expect(step.title).toBe('Skills')
    expect(step.targetId).toBe('experiment-specializations-accordion')
  })

  it('cíl kroku 8 je v Advanced tlačítko sekce s přístupným názvem „Skills“', () => {
    render(<Simulator />)
    tab('Advanced')
    expect(accordionButton('experiment-specializations-accordion')).toHaveAccessibleName('Skills')
  })

  it('text kroku 13 končí „…different phases under Skills.“', () => {
    const step = TUTORIAL_STEPS.experiment[12]
    expect(step.id).toBe('experiment-metrics')
    expect(step.description.endsWith('different phases under Skills.')).toBe(true)
  })
})

describe('feat-026 Příklad 8: slovo „specialization“ v UI nezůstane', () => {
  it.each(['Compare', 'Advanced', 'Cash Flow'] as const)('%s: ani v textu, ani v atributech po rozbalení všeho', mode => {
    render(<Simulator />)
    tab(mode)
    expandEverything()
    const hits = userFacingTexts().filter(text => FORBIDDEN.test(text))
    expect(hits).toEqual([])
  })

  it('karta jednotky před kliknutím na „+“ i po něm', () => {
    renderMemberCard()
    // Před kliknutím: „+“ je vidět a nese přístupný název — po kliknutí se schová, proto obě kontroly
    expect(userFacingTexts().filter(text => FORBIDDEN.test(text))).toEqual([])
    fireEvent.click(screen.getAllByRole('button').find(b => b.textContent === '+')!)
    expect(userFacingTexts().filter(text => FORBIDDEN.test(text))).toEqual([])
  })

  it('potvrzovací dialog výchozí sestavy', () => {
    renderPanel({ activePresetId: 'custom', confirmingPreset: PRESETS[1], showRoleSettings: true })
    expect(userFacingTexts().filter(text => FORBIDDEN.test(text))).toEqual([])
  })

  it.each(['compare', 'experiment', 'cashflow'] as TutorialMode[])('texty prohlídky %s', mode => {
    const texts = TUTORIAL_STEPS[mode].flatMap(step => [step.title, step.description, ...(step.bullets ?? [])])
    expect(texts.filter(text => FORBIDDEN.test(text))).toEqual([])
  })
})

describe('feat-026 Příklad 16: posuvníky v sekci Backlog mluví o skills', () => {
  /**
   * Obal rozbalené sekce Backlog — rodič tlačítka hlavičky obsahuje hlavičku i obsah sekce.
   *
   * @returns Prvek sekce Backlog
   */
  const backlogSection = (): HTMLElement => {
    const section = screen.getByRole('button', { name: 'Backlog' }).parentElement
    expect(section, 'obal sekce Backlog').not.toBeNull()
    return section as HTMLElement
  }

  it('Min. skills per item na 3 ukazuje „≥ 3 skills“, na 1 „no minimum“', () => {
    const { unmount } = renderPanel({ settings: { ...SETTINGS, minSpecializations: 3 } })
    expect(screen.getByText('≥ 3 skills')).toBeInTheDocument()
    unmount()
    renderPanel({ settings: { ...SETTINGS, minSpecializations: 1 } })
    expect(screen.getByText('no minimum')).toBeInTheDocument()
  })

  it('posuvník se jmenuje „Skill-mix variability“ a nápověda mluví o skills', () => {
    renderPanel()
    expect(screen.getByRole('slider', { name: 'Skill-mix variability' })).toBeInTheDocument()
    expect(screen.getByText('Skill-mix variability')).toBeInTheDocument()
    expect(screen.getByTitle('How many different skills each item requires.')).toBeInTheDocument()
    expect(screen.queryByRole('slider', { name: 'Role-mix variability' })).toBeNull()
  })

  it.each([
    [0, '2 skills'],
    [1, '1–6 skills'],
  ])('Skill-mix variability na %s ukazuje „%s“', (roleVar, label) => {
    renderPanel({ settings: { ...SETTINGS, roleVar } })
    expect(screen.getByText(label)).toBeInTheDocument()
  })

  it.each([
    [1, 0],
    [3, 1],
  ])('v sekci Backlog není slovo „role(s)“ (min. skills %s, skill-mix %s)', (minSpecializations, roleVar) => {
    renderPanel({ settings: { ...SETTINGS, minSpecializations, roleVar } })
    const section = backlogSection()
    const texts = [
      section.textContent ?? '',
      ...Array.from(section.querySelectorAll('*')).flatMap(el => ['aria-label', 'title'].map(attr => el.getAttribute(attr) ?? '')),
    ]
    expect(texts.filter(text => /\brole/i.test(text))).toEqual([])
  })
})
