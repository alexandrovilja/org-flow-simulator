import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { Simulator } from '@/components/Simulator'
import { markTutorialCompleted, markModeSeen, resetTutorial } from '@/lib/storage'

// feat-030 (Úpravy týmů a lidí, mód Organization inkrement 3) — úpravy organizace v aplikaci: propsání do běhu,
// kontrola před během blokuje Run, zamčení od prvního Run a Reset, který úpravy nechá.
//
// Schválený kontrakt (spec features/feat-030-upravy-tymu-a-lidi.md, Pravidla chování a Příklady 1, 5 a 11;
// analýza B6, B11, C9, I1, I3):
//  - Před během jde v panelu „Organization“ přejmenovat tým (pole „Team name“), přidat tým („+ Add team“),
//    přidat člověka („+ Add person“), měnit skilly („Add skill“, „Remove skill Java“) a přesouvat lidi
//    („Person actions“ → „Move to Team Web“). Nová organizace platí hned pro běh, který ještě nezačal.
//  - Varování kontroly (např. „No one with Frontend can work in MOB“) zablokuje Run s tooltipem
//    „Fix the warnings in the Organization panel first“.
//  - Od prvního Run (i v pauze) jsou názvy, týmy, lidé a skilly zamčené; otevřená nabídka nebo potvrzení se zavře.
//  - Reset nechá organizaci se všemi úpravami a úpravy jdou zase dělat.

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })
  localStorage.clear()
  resetTutorial()
  markTutorialCompleted()
  markModeSeen('compare')
  markModeSeen('experiment')
  markModeSeen('cashflow')
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  vi.useRealTimers()
})

/** Posune falešný čas o `ms` milisekund uvnitř act(). */
async function advance(ms: number): Promise<void> {
  await act(async () => { vi.advanceTimersByTime(ms) })
}

/** Vykreslí aplikaci a přepne na mód Organization. */
function openOrganization(): void {
  render(<Simulator />)
  fireEvent.click(screen.getByRole('tab', { name: 'Organization' }))
}

const org = () => screen.getByRole('region', { name: 'Organization' })
const rows = () => within(org()).getAllByTestId('org-team-row')
/** Tlačítko běhu v liště podle konce názvu (glyf ▶ / ❙❙ / ✓ před ním). */
const runButton = (name: 'Run' | 'Pause' | 'Done' = 'Run') => screen.getByRole('button', { name: new RegExp(`${name}$`) })

/** Řádek týmu podle názvu: před během podle hodnoty pole „Team name“, za běhu podle textu. */
function teamRow(name: string): HTMLElement {
  const row = rows().find(r => within(r).queryAllByDisplayValue(name).length > 0)
    ?? rows().find(r => within(r).queryAllByText(name).length > 0)
  if (!row) throw new Error(`Řádek týmu ${name} není`)
  return row
}

/** Názvy týmů v pořadí panelu podle polí „Team name“ (před během). */
const teamNames = () => rows().map(r => {
  const input = within(r).queryByRole('textbox', { name: 'Team name' })
  return input instanceof HTMLInputElement ? input.value : '?'
})

/** Rozbalí lidi týmu (pokud ještě nejsou) a vrátí kartu člověka. */
function personCard(teamName: string, personName: string): HTMLElement {
  const toggle = within(teamRow(teamName)).getByRole('button', { name: 'Show or hide people' })
  if (toggle.getAttribute('aria-expanded') !== 'true') fireEvent.click(toggle)
  const card = within(teamRow(teamName)).getAllByTestId('org-person').find(c => within(c).queryAllByText(personName).length > 0)
  if (!card) throw new Error(`Karta ${personName} v ${teamName} není`)
  return card
}

/** Text varování v panelu organizace (prázdné pole = žádné varování). */
function warnings(): string[] {
  const alert = within(org()).queryByRole('alert')
  return alert ? within(alert).getAllByRole('listitem').map(li => li.textContent ?? '') : []
}

/** Ověří, že v panelu nejsou žádné ovládací prvky úprav týmů, lidí a skillů. */
function expectNoEditControls(): void {
  const panel = org()
  expect(within(panel).queryAllByRole('textbox', { name: 'Team name' })).toHaveLength(0)
  for (const name of ['+ Add team', '+ Add person', 'Person actions', 'Add skill']) {
    expect(within(panel).queryAllByRole('button', { name })).toHaveLength(0)
  }
  expect(within(panel).queryAllByRole('button', { name: /^Remove (Team|skill) / })).toHaveLength(0)
}

describe('feat-030 B6: přejmenování se propíše do běhu', () => {
  it('„Mobile Apple“ po Enter; po Run ukazuje řádek týmu za běhu „Mobile Apple“', async () => {
    openOrganization()
    const input = within(teamRow('Team Mobile')).getByRole('textbox', { name: 'Team name' })
    fireEvent.change(input, { target: { value: '  Mobile Apple ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(teamNames()).toEqual(['Team Billing', 'Mobile Apple', 'Team Web'])
    fireEvent.click(runButton())
    await advance(500)
    expect(within(org()).getByText('Mobile Apple')).toBeInTheDocument()
    expect(within(org()).queryByText('Team Mobile')).toBeNull()
  })
})

describe('feat-030 Př. 5 (B11, C9): přesun člověka zablokuje Run', () => {
  it('Eli → Team Web: varování „No one with Frontend can work in MOB“ a neaktivní Run s tooltipem', () => {
    openOrganization()
    expect(runButton()).toBeEnabled()
    fireEvent.click(within(personCard('Team Mobile', 'Eli')).getByRole('button', { name: 'Person actions' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move to Team Web' }))
    expect(warnings()).toEqual(['No one with Frontend can work in MOB'])
    expect(runButton()).toBeDisabled()
    expect(runButton()).toHaveAttribute('title', 'Fix the warnings in the Organization panel first')
  })

  it('vrácení Eli do Team Mobile varování zruší a Run je zase aktivní', () => {
    openOrganization()
    fireEvent.click(within(personCard('Team Mobile', 'Eli')).getByRole('button', { name: 'Person actions' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move to Team Web' }))
    fireEvent.click(within(personCard('Team Web', 'Eli')).getByRole('button', { name: 'Person actions' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Move to Team Mobile' }))
    expect(warnings()).toEqual([])
    expect(runButton()).toBeEnabled()
  })
})

describe('feat-030 Př. 11 (I1, I3): zamčení úprav a Reset', () => {
  it('Run zavře otevřenou nabídku a zamkne úpravy i v pauze; Reset nechá Team 4 a Person 13 a úpravy povolí', async () => {
    openOrganization()
    fireEvent.click(within(org()).getByRole('button', { name: '+ Add team' }))
    personCard('Team Web', 'Hana')
    fireEvent.click(within(teamRow('Team Web')).getByRole('button', { name: '+ Add person' }))
    expect(within(teamRow('Team Web')).getByText('5 people')).toBeInTheDocument()
    fireEvent.click(within(personCard('Team Web', 'Hana')).getByRole('button', { name: 'Add skill' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    fireEvent.click(runButton())
    expect(screen.queryByRole('menu')).toBeNull()
    await advance(500)
    expectNoEditControls()
    expect(within(org()).getByText('Skills, AI and mandates are locked during the run')).toBeInTheDocument()
    fireEvent.click(runButton('Pause'))
    expectNoEditControls()

    fireEvent.click(screen.getByRole('button', { name: /Reset$/ }))
    expect(teamNames()).toEqual(['Team Billing', 'Team Mobile', 'Team Web', 'Team 4'])
    expect(within(teamRow('Team Web')).getByText('5 people')).toBeInTheDocument()
    expect(within(org()).getByRole('button', { name: '+ Add team' })).toBeInTheDocument()
    expect(within(personCard('Team Web', 'Hana')).getByRole('button', { name: 'Add skill' })).toBeInTheDocument()
  })

  it('Run zavře i otevřené potvrzení odebrání týmu', () => {
    openOrganization()
    fireEvent.click(within(teamRow('Team Billing')).getByRole('button', { name: 'Remove Team Billing' }))
    expect(screen.getByText('Remove Team Billing? 4 people will be removed.')).toBeInTheDocument()
    fireEvent.click(runButton())
    expect(screen.queryByText('Remove Team Billing? 4 people will be removed.')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull()
  })
})
