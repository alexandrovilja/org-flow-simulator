import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { RoleChip } from '@/components/RoleChip'
import { MemberCard } from '@/components/MemberCard'
import { RoleSettings } from '@/components/RoleSettings'
import { ROLE_META } from '@/simulation/engine'
import type { Member } from '@/types/simulation'

// feat-023 (Jednotné písmo) — plný název v `title` jen u zkráceného textu a přístupné názvy vstupů.
//
// Schválený kontrakt (spec features/feat-023-jednotne-pismo-textu.md, UI / Design „Šířky“, Příklad 9):
//  - jména jednotek, chipy rolí a vstupy specializací mají atribut `title` s plným textem JEN když je text
//    zkrácený výpustkou (`scrollWidth > clientWidth`); nezkrácený text tooltip nemá. Stav se přepočítá
//    při změně velikosti prvku (ResizeObserver).
//  - vstup se jménem jednotky má `aria-label` „Unit name“, vstup názvu skillu „Skill name“ (do feat-026 „Specialization name“).
// jsdom nepočítá rozložení, proto `scrollWidth` a `clientWidth` dodáme přes prototyp a ResizeObserver nahradíme
// ovladatelnou náhradou; bez ResizeObserveru (výchozí stav jsdom) se měří jen při změně textu a komponenty nesmí spadnout.

/** Šířka obsahu pro „zkrácený“ text a pro text, který se vejde; clientWidth je vždy 100. */
let truncatedNow = true

/** Zpětná volání zaregistrovaná přes ResizeObserver — test je zavolá, aby simuloval změnu velikosti. */
const resizeCallbacks: Array<() => void> = []

beforeEach(() => {
  truncatedNow = true
  resizeCallbacks.length = 0
  // Text obsahující „Long“ je podle příznaku širší než prvek; ostatní se vždy vejdou
  vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockImplementation(function (this: Element) {
    const text = this instanceof HTMLInputElement ? this.value : this.textContent ?? ''
    return truncatedNow && text.includes('Long') ? 300 : 50
  })
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(100)
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { resizeCallbacks.push(callback) }
    observe() {}
    disconnect() {}
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const member = (name: string): Member => ({ id: 1, name, roles: ['DSGN'], currentTask: null, idleSec: 0 })

/** Karta jednotky se všemi povinnými props. */
const card = (name: string) => (
  <MemberCard member={member(name)} currentFeature={null} currentTask={null} roleConfig={ROLE_META}
    onAddRole={vi.fn()} onRemoveRole={vi.fn()} onRename={vi.fn()} onRemove={vi.fn()} onSetAiMultiplier={vi.fn()} />
)

describe('feat-023: title jen u zkráceného textu', () => {
  it('chip role: zkrácený název má title, krátký ne', () => {
    const { rerender } = render(<RoleChip role="DSGN" color="var(--role-rose)" label="Long specialization name" />)
    expect(screen.getByText('Long specialization name')).toHaveAttribute('title', 'Long specialization name')
    rerender(<RoleChip role="DSGN" color="var(--role-rose)" label="Design" />)
    expect(screen.getByText('Design')).not.toHaveAttribute('title')
  })

  it('jméno jednotky: zkrácené jméno má title, krátké ne', () => {
    const { rerender } = render(card('Long team name for the projector'))
    expect(screen.getByRole('textbox', { name: 'Unit name' })).toHaveAttribute('title', 'Long team name for the projector')
    rerender(card('Team A'))
    expect(screen.getByRole('textbox', { name: 'Unit name' })).not.toHaveAttribute('title')
  })

  it('název specializace: zkrácený má title, krátký ne a vstup má přístupný název', () => {
    const config = { ...ROLE_META, DSGN: { ...ROLE_META.DSGN, label: 'Long specialization name' } }
    render(<RoleSettings roleConfig={config} onChange={vi.fn()} onAdd={vi.fn()} onDelete={vi.fn()} />)
    const inputs = screen.getAllByRole('textbox', { name: 'Skill name' })
    const long = inputs.find(i => (i as HTMLInputElement).value === 'Long specialization name')!
    const short = inputs.find(i => (i as HTMLInputElement).value === 'Frontend')!
    expect(long).toHaveAttribute('title', 'Long specialization name')
    expect(short).not.toHaveAttribute('title')
  })

  it('po změně velikosti (ResizeObserver) se title přidá nebo odebere', () => {
    truncatedNow = false
    render(<RoleChip role="DSGN" color="var(--role-rose)" label="Long specialization name" />)
    const chip = screen.getByText('Long specialization name')
    expect(chip).not.toHaveAttribute('title')

    truncatedNow = true
    act(() => { resizeCallbacks.forEach(cb => cb()) })
    expect(chip).toHaveAttribute('title', 'Long specialization name')

    truncatedNow = false
    act(() => { resizeCallbacks.forEach(cb => cb()) })
    expect(chip).not.toHaveAttribute('title')
  })

  it('bez ResizeObserveru komponenta nespadne a měří se jen při změně textu', () => {
    vi.unstubAllGlobals() // jsdom ResizeObserver nemá
    render(<RoleChip role="DSGN" color="var(--role-rose)" label="Long specialization name" />)
    expect(screen.getByText('Long specialization name')).toBeInTheDocument()
  })
})
