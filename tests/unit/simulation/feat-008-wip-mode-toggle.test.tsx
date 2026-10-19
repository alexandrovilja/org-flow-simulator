import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { BacklogSettingsPanel } from '@/components/BacklogSettingsPanel'
import { mulberry32, makeInitialState, ROLE_META } from '@/simulation/engine'
import type { SimSettings } from '@/types/simulation'

// feat-008 / feat-016 (revize): WIP mód „Priority“ byl odstraněn — vždy bral novou práci z backlogu
// a zavádějícím názvem budil dojem „nejdůležitější dostupná práce“. Přepínač v Team settings
// nabízí jen Reduce WIP | Min units, výchozí je Reduce WIP.

const SETTINGS: SimSettings = {
  minBacklog: 0,
  wipLimit: 6,
  sizeVar: 0.4,
  roleVar: 0.5,
  initialBacklog: 5,
  minSpecializations: 1,
}

/** Vykreslí panel s otevřeným Team settings a mock handlery. */
function renderTeamSettings() {
  const state = makeInitialState(mulberry32(42), SETTINGS)
  const props: ComponentProps<typeof BacklogSettingsPanel> = {
    state, settings: SETTINGS, setSettings: vi.fn(), roleConfig: ROLE_META,
    activePresetId: 'teams', confirmingPreset: null, setConfirmingPreset: vi.fn(),
    showBacklogControls: false, setShowBacklogControls: vi.fn(),
    showRoleSettings: false, setShowRoleSettings: vi.fn(),
    showTeamSettings: true, setShowTeamSettings: vi.fn(),
    importMsg: null, fileInputRef: { current: null },
    wipMode: 'reduce-wip', setWipMode: vi.fn(), maxWork: 3,
    handleXlsImport: vi.fn(), handleRegenerate: vi.fn(), handlePresetClick: vi.fn(), handleConfirmPreset: vi.fn(),
    handleRoleChange: vi.fn(), handleAddRole: vi.fn(), handleDeleteRole: vi.fn(),
  }
  return render(<BacklogSettingsPanel {...props} />)
}

describe('feat-008: přepínač WIP módu v Team settings', () => {
  it('nabízí Reduce WIP a Min units', () => {
    renderTeamSettings()
    expect(screen.getByRole('button', { name: 'Reduce WIP' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Min units' })).toBeTruthy()
  })

  it('nenabízí mód Priority', () => {
    renderTeamSettings()
    expect(screen.queryByRole('button', { name: 'Priority' })).toBeNull()
  })
})
