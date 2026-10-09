import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { BacklogSettingsPanel } from '@/components/BacklogSettingsPanel'
import { RevenueCurvePreview } from '@/components/RevenueCurvePreview'
import { REVENUE_PROFILE_INFO } from '@/lib/revenueProfiles'
import { ConfirmOverlay } from '@/components/ConfirmOverlay'
import { mulberry32, makeInitialState, ROLE_META, PRESETS } from '@/simulation/engine'
import type { SimSettings, RevenueProfile } from '@/types/simulation'

// feat-017, schválený UI návrh (fáze 3, docs/feat-017-ui-mockup.html):
//  - přepínač „Revenue curve“ (Flat | J-curve | S-curve) je uvnitř akordeonu „♻ Backlog“ pod
//    „Generate new backlog“ a nad slidery; vykresluje se jen když panel dostane `onRevenueProfileChange`
//    (Cash Flow), Advanced ho nepředává;
//  - pod přepínačem je jediný náhled tvaru křivky (RevenueCurvePreview), na kartách featur mini-graf není;
//  - potvrzovací dialog „Change revenue curve?“ se řídí propem `confirmingRevenueProfile`.
// Nové props BacklogSettingsPanel: revenueProfile, onRevenueProfileChange, confirmingRevenueProfile,
// onConfirmRevenueProfile, onCancelRevenueProfile. Nová komponenta: RevenueCurvePreview({ profile }).

const SETTINGS: SimSettings = {
  minBacklog: 0,
  wipLimit: 6,
  sizeVar: 0.4,
  roleVar: 0.5,
  initialBacklog: 5,
  minSpecializations: 1,
}

/** Vykreslí panel s minimálním, ale plně funkčním sadou props (každý handler je mock). */
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
  return { ...render(<BacklogSettingsPanel {...props} />), props }
}

/** Props, které předává jen Cash Flow. */
const cashFlowProps = (profile: RevenueProfile = 'flat') => ({
  revenueProfile: profile,
  onRevenueProfileChange: vi.fn(),
  confirmingRevenueProfile: null,
  onConfirmRevenueProfile: vi.fn(),
  onCancelRevenueProfile: vi.fn(),
})

// ───────────────────────────────────────────────────────────────────────────────
// RevenueCurvePreview
// ───────────────────────────────────────────────────────────────────────────────

describe('feat-017: RevenueCurvePreview (náhled tvaru křivky)', () => {
  const POINTS = (el: HTMLElement) =>
    el.getAttribute('points')!.trim().split(/\s+/).map(p => p.split(',').map(Number) as [number, number])
  const flatY = () => Number(screen.getByTestId('flat-level-line').getAttribute('y1'))

  it.each([
    ['flat', 'Flat', 1],
    ['j-curve', 'J-curve', 2],
    ['s-curve', 'S-curve', 1],
  ] as const)('%s: má přístupný popisek a text „plateau N× Flat“', (profile, label, plateau) => {
    render(<RevenueCurvePreview profile={profile} />)
    expect(screen.getByRole('img', { name: `Revenue curve preview: ${label}` })).toBeTruthy()
    expect(screen.getByText(`Revenue per tick after delivery · 0–16 ticks · plateau ${plateau}× Flat`)).toBeTruthy()
  })

  it('křivka má 17 bodů (tiky 0–16)', () => {
    render(<RevenueCurvePreview profile="j-curve" />)
    expect(POINTS(screen.getByTestId('revenue-curve-line')).length).toBe(17)
  })

  it('Flat: celá křivka leží na tečkované čáře úrovně Flat', () => {
    render(<RevenueCurvePreview profile="flat" />)
    for (const [, y] of POINTS(screen.getByTestId('revenue-curve-line'))) expect(y).toBeCloseTo(flatY(), 3)
  })

  it('S-curve: začíná pod čárou Flat a dospívá na ni (plató 1×)', () => {
    render(<RevenueCurvePreview profile="s-curve" />)
    const pts = POINTS(screen.getByTestId('revenue-curve-line'))
    // V SVG míří osa Y dolů: větší y = níž na obrazovce.
    expect(pts[0][1]).toBeGreaterThan(flatY())
    expect(pts[16][1]).toBeCloseTo(flatY(), 1)
  })

  it('J-curve: začíná pod čárou Flat a končí nad ní (plató 2×)', () => {
    render(<RevenueCurvePreview profile="j-curve" />)
    const pts = POINTS(screen.getByTestId('revenue-curve-line'))
    expect(pts[0][1]).toBeGreaterThan(flatY())
    expect(pts[16][1]).toBeLessThan(flatY())
  })

  it('tři profily se kreslí třemi různými křivkami', () => {
    const lines = (['flat', 'j-curve', 's-curve'] as const).map(profile => {
      const { unmount } = render(<RevenueCurvePreview profile={profile} />)
      const points = screen.getByTestId('revenue-curve-line').getAttribute('points')
      unmount()
      return points
    })
    expect(new Set(lines).size).toBe(3)
  })
})

// ───────────────────────────────────────────────────────────────────────────────
// Přepínač v BacklogSettingsPanel
// ───────────────────────────────────────────────────────────────────────────────

describe('feat-017: přepínač „Revenue curve“ v BacklogSettingsPanel', () => {
  it('je uvnitř otevřeného akordeonu ♻ Backlog: pod „Generate new backlog“ a nad slidery', () => {
    renderPanel(cashFlowProps())
    const generate = screen.getByText('♻ Generate new backlog')
    const label = screen.getByText('Revenue curve')
    const firstSlider = screen.getByText('Backlog size')
    expect(screen.getByRole('button', { name: 'Flat' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'J-curve' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'S-curve' })).toBeTruthy()
    expect(generate.compareDocumentPosition(label) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(label.compareDocumentPosition(firstSlider) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('má tlačítko pro každý profil z REVENUE_PROFILE_INFO (nový profil bez volby v přepínači by test shodil)', () => {
    renderPanel(cashFlowProps())
    const infos = Object.values(REVENUE_PROFILE_INFO)
    expect(infos.length).toBe(3)
    for (const info of infos) expect(screen.getByRole('button', { name: info.label })).toBeTruthy()
  })

  it('zavřený akordeon přepínač ani náhled neukazuje', () => {
    renderPanel({ ...cashFlowProps(), showBacklogControls: false })
    expect(screen.queryByText('Revenue curve')).toBeNull()
    expect(screen.queryByRole('button', { name: 'J-curve' })).toBeNull()
    expect(screen.queryAllByRole('img', { name: /Revenue curve preview/ }).length).toBe(0)
  })

  it('bez onRevenueProfileChange (Advanced mód) se přepínač ani náhled nevykreslí', () => {
    renderPanel()
    expect(screen.queryByText('Revenue curve')).toBeNull()
    expect(screen.queryByRole('button', { name: 'J-curve' })).toBeNull()
    expect(screen.queryAllByRole('img', { name: /Revenue curve preview/ }).length).toBe(0)
  })

  it.each([
    ['Flat', 'flat'],
    ['J-curve', 'j-curve'],
    ['S-curve', 's-curve'],
  ] as const)('kliknutí na „%s“ zavolá onRevenueProfileChange("%s")', (label, value) => {
    const cf = cashFlowProps(value === 'flat' ? 'j-curve' : 'flat')
    renderPanel(cf)
    fireEvent.click(screen.getByRole('button', { name: label }))
    expect(cf.onRevenueProfileChange).toHaveBeenCalledWith(value)
  })

  it('pod přepínačem je jediný náhled tvaru zvolené křivky; na kartách featur mini-graf není', () => {
    renderPanel(cashFlowProps('s-curve'))
    const previews = screen.queryAllByRole('img', { name: /Revenue curve preview/ })
    expect(previews.length).toBe(1)
    expect(previews[0].getAttribute('aria-label')).toBe('Revenue curve preview: S-curve')
  })

  it.each([
    ['flat', 'Every feature earns the same amount per tick from the moment it is delivered.'],
    ['j-curve', 'Earns little right after delivery, then grows past the flat level. Illustrative shape inspired by delayed returns to IT investment.'],
    ['s-curve', 'Ramps up gradually after delivery and levels off at the flat amount. Bass adoption curve.'],
  ] as const)('hover hint zvoleného profilu „%s“ popisuje jeho tvar', async (profile, hint) => {
    renderPanel(cashFlowProps(profile))
    await userEvent.hover(screen.getByRole('button', { name: 'Flat' }))
    expect(await screen.findByText(hint)).toBeTruthy()
  })
})

describe('feat-017: potvrzovací dialog při změně křivky během běhu', () => {
  it('bez čekající změny se dialog nezobrazuje', () => {
    renderPanel(cashFlowProps())
    expect(screen.queryByText('Change revenue curve?')).toBeNull()
  })

  it('s čekající změnou ukáže nadpis, vysvětlení a tlačítka Cancel / Change and reset', () => {
    renderPanel({ ...cashFlowProps(), confirmingRevenueProfile: 'j-curve' })
    expect(screen.getByText('Change revenue curve?')).toBeTruthy()
    expect(screen.getByText('Changing the revenue curve resets the current run. The backlog stays the same.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Change and reset' })).toBeTruthy()
  })

  it('„Cancel“ zavolá onCancelRevenueProfile, „Change and reset“ zavolá onConfirmRevenueProfile', () => {
    const cf = { ...cashFlowProps(), confirmingRevenueProfile: 's-curve' as const }
    renderPanel(cf)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(cf.onCancelRevenueProfile).toHaveBeenCalledTimes(1)
    expect(cf.onConfirmRevenueProfile).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Change and reset' }))
    expect(cf.onConfirmRevenueProfile).toHaveBeenCalledTimes(1)
  })
})

describe('feat-017: dialog výběru presetu po přechodu na sdílený ConfirmOverlay (regrese)', () => {
  it('zobrazí nadpis s názvem presetu a tlačítka Cancel / Apply preset', () => {
    renderPanel({ confirmingPreset: PRESETS[1] })
    expect(screen.getByText('Apply \u201cPeople\u201d preset?')).toBeTruthy()
    expect(screen.getByText('Your current team and specializations will be replaced. This cannot be undone.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Apply preset' })).toBeTruthy()
  })
})

/** Odebere fokus aktivnímu prvku — simuluje kliknutí na ztmavenou plochu kolem dialogu (fokus spadne na body). */
function blurActiveElement(): void {
  const active = document.activeElement
  if (active instanceof HTMLElement) active.blur()
}

describe('feat-017: ConfirmOverlay — přístupnost', () => {
  const renderOverlay = () => {
    const onCancel = vi.fn()
    const onConfirm = vi.fn()
    const view = render(
      <>
        <button>outside</button>
        <ConfirmOverlay title="Change revenue curve?" body="Body text." confirmLabel="Change and reset" onCancel={onCancel} onConfirm={onConfirm} />
      </>,
    )
    return { ...view, onCancel, onConfirm }
  }

  it('má role dialog, aria-modal a přístupný název z nadpisu', () => {
    renderOverlay()
    const dialog = screen.getByRole('dialog', { name: 'Change revenue curve?' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
  })

  it('po otevření přesune fokus na Cancel (bezpečná volba u destruktivní akce)', () => {
    renderOverlay()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }))
  })

  it('Escape zavolá onCancel a nepotvrdí', () => {
    const { onCancel, onConfirm } = renderOverlay()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('Tab na posledním tlačítku skočí na první a Shift+Tab na prvním na poslední (fokus neunikne pod překryv)', () => {
    renderOverlay()
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    const confirm = screen.getByRole('button', { name: 'Change and reset' })
    confirm.focus()
    fireEvent.keyDown(confirm, { key: 'Tab' })
    expect(document.activeElement).toBe(cancel)
    fireEvent.keyDown(cancel, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(confirm)
  })

  it('po kliknutí na pozadí (fokus spadne na body) Escape dál zruší dialog', () => {
    const { onCancel } = renderOverlay()
    blurActiveElement()
    expect(document.activeElement).toBe(document.body)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('po kliknutí na pozadí Tab vrátí fokus do dialogu (na Cancel) a Shift+Tab na Confirm', () => {
    renderOverlay()
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    const confirm = screen.getByRole('button', { name: 'Change and reset' })
    blurActiveElement()
    fireEvent.keyDown(document.body, { key: 'Tab' })
    expect(document.activeElement).toBe(cancel)
    blurActiveElement()
    fireEvent.keyDown(document.body, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(confirm)
  })

  it('po odpojení dialogu už Escape nic nevolá (listener se odpojí)', () => {
    const { onCancel, unmount } = renderOverlay()
    unmount()
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('po překreslení s novým onCancel Escape zavolá nejnovější callback', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = render(<ConfirmOverlay title="T" body="B" confirmLabel="OK" onCancel={first} onConfirm={() => {}} />)
    rerender(<ConfirmOverlay title="T" body="B" confirmLabel="OK" onCancel={second} onConfirm={() => {}} />)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('po zavření vrátí fokus na prvek, který ho měl před otevřením', () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.focus()
    const { unmount } = render(
      <ConfirmOverlay title="T" body="B" confirmLabel="OK" onCancel={() => {}} onConfirm={() => {}} />,
    )
    expect(document.activeElement).not.toBe(outside)
    unmount()
    expect(document.activeElement).toBe(outside)
    outside.remove()
  })
})
