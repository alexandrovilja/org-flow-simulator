import { PRESETS } from '@/simulation/engine'
import { FeatureCard } from '@/components/FeatureCard'
import { RoleSettings } from '@/components/RoleSettings'
import { Slider } from '@/components/Slider'
import { PanelHeader } from '@/components/PanelHeader'
import { SegmentedControl } from '@/components/SegmentedControl'
import { downloadTemplate } from '@/lib/xlsImport'
import type { Feature, SimState, SimSettings, Role, RoleMeta, WipMode, UnitPreset, ActivePresetId } from '@/types/simulation'

/** Hover hint pro každý WIP mód — popisuje, jak jednotky vybírají další práci (feat-016: Min units). */
const WIP_HINTS: Record<WipMode, string> = {
  'priority': 'WIP: units can start new features freely based on priority.',
  'reduce-wip': 'WIP: units finish in-progress features before pulling new ones.',
  'min-units': 'WIP: units stay on features they already know and avoid features others are working on.',
}

/** Vstupní props komponenty BacklogSettingsPanel — levý sloupec sdílený Advanced a Cash Flow módem. */
interface BacklogSettingsPanelProps {
  state: SimState
  settings: SimSettings
  setSettings: React.Dispatch<React.SetStateAction<SimSettings>>
  roleConfig: Record<Role, RoleMeta>
  activePresetId: ActivePresetId
  confirmingPreset: UnitPreset | null
  setConfirmingPreset: React.Dispatch<React.SetStateAction<UnitPreset | null>>
  showBacklogControls: boolean
  setShowBacklogControls: React.Dispatch<React.SetStateAction<boolean>>
  showRoleSettings: boolean
  setShowRoleSettings: React.Dispatch<React.SetStateAction<boolean>>
  showTeamSettings: boolean
  setShowTeamSettings: React.Dispatch<React.SetStateAction<boolean>>
  importMsg: { ok: boolean; text: string } | null
  fileInputRef: React.RefObject<HTMLInputElement | null>
  wipMode: WipMode
  setWipMode: React.Dispatch<React.SetStateAction<WipMode>>
  maxWork: number
  handleXlsImport: (file: File) => void
  handleRegenerate: () => void
  handlePresetClick: (preset: UnitPreset) => void
  handleConfirmPreset: () => void
  handleRoleChange: (roleId: string, updates: Partial<RoleMeta>) => void
  handleAddRole: (label: string, color: string) => void
  handleDeleteRole: (roleId: string) => void
  /** Prefix pro data-tutorial-target atributy — odlišuje Advanced od Cash Flow v DOM. */
  tutorialTargetPrefix?: string
  /** Volitelný formátovač revenue badge na kartě backlogu (jen Cash Flow mód, feat-015). */
  getRevenueBadge?: (feature: Feature) => string
  /** Stav přepínače Coordination overhead (jen Cash Flow mód, feat-016). */
  coordinationOverhead?: boolean
  /** Setter přepínače — když není zadán, přepínač se nevykreslí (Advanced mód). */
  setCoordinationOverhead?: (value: boolean) => void
  /** true = běh už začal → přepínač je zamčený až do Resetu. */
  coordinationOverheadLocked?: boolean
}

/**
 * Levý sloupec simulace: seznam backlogu + Settings panel (presety, XLS import,
 * generování backlogu, editor specializací, WIP mód). Sdíleno mezi Advanced a Cash Flow
 * módem (feat-015) — každý mód mu předává svůj vlastní nezávislý stav a handlery.
 */
export function BacklogSettingsPanel({
  state, settings, setSettings, roleConfig, activePresetId, confirmingPreset, setConfirmingPreset,
  showBacklogControls, setShowBacklogControls, showRoleSettings, setShowRoleSettings,
  showTeamSettings, setShowTeamSettings, importMsg, fileInputRef, wipMode, setWipMode, maxWork,
  handleXlsImport, handleRegenerate, handlePresetClick, handleConfirmPreset, getRevenueBadge,
  handleRoleChange, handleAddRole, handleDeleteRole, tutorialTargetPrefix = 'experiment',
  coordinationOverhead = false, setCoordinationOverhead, coordinationOverheadLocked = false,
}: BacklogSettingsPanelProps) {
  return (
    <section data-tutorial-target={`${tutorialTargetPrefix}-backlog`} style={{ borderRight: '1px solid var(--line)', background: 'var(--panel)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div data-tutorial-target={`${tutorialTargetPrefix}-backlog-list`} style={{ flex: '1 1 50%', minHeight: 0, display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--line)' }}>
        <PanelHeader title="Backlog" count={state.backlog.length} hint={getRevenueBadge ? 'sorted by revenue' : undefined} />
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {state.backlog.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic', padding: '8px 4px' }}>No items waiting.</div>
          )}
          {state.backlog.map(f => (
            <FeatureCard key={f.id} feature={f} compact neutral maxWork={maxWork} roleConfig={roleConfig}
              revenue={getRevenueBadge?.(f)} />
          ))}
        </div>
      </div>

      <div data-tutorial-target={`${tutorialTargetPrefix}-settings`} style={{ flex: '0 0 auto', padding: '12px 14px 14px', display: 'flex', flexDirection: 'column', gap: 12, background: 'var(--panel)', position: 'relative' }}>
        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-2)' }}>Settings</h3>

        <div style={{ paddingBottom: 10, borderBottom: '1px solid var(--line)', marginBottom: -4 }}>
          <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--ink-3)', marginBottom: 6, letterSpacing: 0.2 }}>
            Unit preset
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {PRESETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => handlePresetClick(preset)}
                style={{
                  fontFamily: 'inherit',
                  fontSize: 11, fontWeight: 500,
                  padding: '4px 12px', borderRadius: 5,
                  cursor: 'pointer',
                  background: activePresetId === preset.id ? 'var(--ink)' : 'transparent',
                  color: activePresetId === preset.id ? 'white' : 'var(--ink-3)',
                  border: activePresetId === preset.id ? '1px solid var(--ink)' : '1px solid var(--line-2)',
                  transition: 'background 0.13s ease, color 0.13s ease, border-color 0.13s ease',
                }}
              >
                {preset.label}
              </button>
            ))}
            {activePresetId === 'custom' && (
              <span style={{
                marginLeft: 'auto',
                fontSize: 9, fontWeight: 500, letterSpacing: 0.3,
                color: 'var(--ink-3)', background: 'var(--bg)',
                border: '1px solid var(--line-2)',
                padding: '1px 6px', borderRadius: 3,
              }}>
                custom
              </span>
            )}
          </div>
        </div>

        {confirmingPreset && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(246, 245, 242, 0.84)',
            backdropFilter: 'blur(2px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 'var(--radius)',
            zIndex: 10,
          }}>
            <div style={{
              background: 'var(--panel)',
              border: '1px solid var(--line)',
              borderRadius: 10, padding: 16, width: 200,
              boxShadow: '0 4px 24px rgba(20,20,30,0.14), 0 1px 3px rgba(20,20,30,0.08)',
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 5 }}>
                Apply &ldquo;{confirmingPreset.label}&rdquo; preset?
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.5, marginBottom: 13 }}>
                Your current team and specializations will be replaced. This cannot be undone.
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setConfirmingPreset(null)}
                  style={{
                    flex: 1, fontFamily: 'inherit', fontSize: 11, fontWeight: 500,
                    padding: '5px 0', borderRadius: 5,
                    border: '1px solid var(--line-2)', background: 'transparent',
                    color: 'var(--ink-2)', cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmPreset}
                  style={{
                    flex: 1, fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
                    padding: '5px 0', borderRadius: 5,
                    border: 'none', background: 'var(--ink)',
                    color: 'white', cursor: 'pointer',
                  }}
                >
                  Apply preset
                </button>
              </div>
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) handleXlsImport(file)
            e.target.value = ''
          }}
        />

        <div style={{ paddingTop: 4, borderTop: '1px solid var(--line)', marginTop: 4 }}>
          <button
            onClick={() => setShowBacklogControls(v => !v)}
            style={{
              width: '100%', textAlign: 'left',
              fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
              border: '1px solid var(--line)', borderRadius: 4,
              padding: '4px 8px',
              background: showBacklogControls ? 'var(--line)' : 'var(--bg)',
              color: showBacklogControls ? 'var(--ink)' : 'var(--ink-2)',
              fontWeight: showBacklogControls ? 600 : 400,
            }}
          >
            ♻ Backlog
          </button>
          {showBacklogControls && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    flex: 1, border: '1px solid var(--ink-2)', borderRadius: 4,
                    padding: '6px 0', fontSize: 11, fontWeight: 600,
                    background: 'var(--bg)', color: 'var(--ink)',
                    cursor: 'pointer', letterSpacing: 0.2,
                  }}
                >
                  ↑ Import XLS
                </button>
                <button
                  onClick={downloadTemplate}
                  style={{
                    flex: 1, border: '1px solid var(--line)', borderRadius: 4,
                    padding: '6px 0', fontSize: 11, fontWeight: 400,
                    background: 'var(--bg)', color: 'var(--ink-2)',
                    cursor: 'pointer', letterSpacing: 0.2,
                  }}
                >
                  ↓ Šablona
                </button>
              </div>

              {importMsg && (
                <div style={{
                  fontSize: 11, padding: '5px 8px', borderRadius: 4,
                  background: importMsg.ok ? 'oklch(95% 0.05 145)' : 'oklch(95% 0.05 25)',
                  color: importMsg.ok ? 'oklch(35% 0.13 145)' : 'oklch(35% 0.13 25)',
                  border: `1px solid ${importMsg.ok ? 'oklch(75% 0.1 145)' : 'oklch(75% 0.1 25)'}`,
                  lineHeight: 1.4,
                }}>
                  {importMsg.ok ? '✓' : '✗'} {importMsg.text}
                </div>
              )}

              <button onClick={handleRegenerate} style={{
                background: 'var(--ink)', border: 'none', borderRadius: 4,
                padding: '7px 0', fontSize: 11, fontWeight: 600, color: 'white',
                cursor: 'pointer', width: '100%', letterSpacing: 0.2,
              }}>
                ♻ Generate new backlog
              </button>
              <Slider label="Backlog size" value={settings.initialBacklog} min={10} max={1000} step={10}
                onChange={v => setSettings(s => ({ ...s, initialBacklog: v }))}
                format={v => `${v} items`}
                tooltip="Number of features generated when clicking 'Generate new backlog'." />
              <Slider label="Min. specializations per item" value={settings.minSpecializations} min={1} max={6} step={1}
                onChange={v => setSettings(s => ({ ...s, minSpecializations: v }))}
                format={v => v === 1 ? 'no minimum' : `≥ ${v} roles`}
                tooltip="Minimum number of different specializations each backlog item must require." />
              <Slider label="Item size variability" value={settings.sizeVar} min={0} max={1} step={0.05}
                onChange={v => setSettings(s => ({ ...s, sizeVar: v }))}
                format={v => v < 0.1 ? 'uniform' : v < 0.5 ? 'low' : v < 0.85 ? 'high' : 'extreme'}
                tooltip="How much effort varies between items." />
              <Slider label="Role-mix variability" value={settings.roleVar} min={0} max={1} step={0.05}
                onChange={v => setSettings(s => ({ ...s, roleVar: v }))}
                format={v => v < 0.1 ? '2 roles' : v < 0.5 ? 'low' : v < 0.85 ? 'high' : '1–6 roles'}
                tooltip="How many different roles each item requires." />
            </div>
          )}
        </div>
        <div style={{ paddingTop: 8, borderTop: '1px solid var(--line)', marginTop: 4 }}>
          <button
            onClick={() => setShowRoleSettings(v => !v)}
            style={{
              width: '100%', textAlign: 'left',
              fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
              border: '1px solid var(--line)', borderRadius: 4,
              padding: '4px 8px',
              background: showRoleSettings ? 'var(--line)' : 'var(--bg)',
              color: showRoleSettings ? 'var(--ink)' : 'var(--ink-2)',
              fontWeight: showRoleSettings ? 600 : 400,
            }}
          >
            ⚙ Specializations
          </button>
          {showRoleSettings && (
            <div style={{ marginTop: 8 }}>
              <RoleSettings roleConfig={roleConfig} onChange={handleRoleChange} onAdd={handleAddRole} onDelete={handleDeleteRole} />
            </div>
          )}
        </div>
        <div style={{ paddingTop: 8, borderTop: '1px solid var(--line)', marginTop: 4 }}>
          <button
            onClick={() => setShowTeamSettings(v => !v)}
            style={{
              width: '100%', textAlign: 'left',
              fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
              border: '1px solid var(--line)', borderRadius: 4,
              padding: '4px 8px',
              background: showTeamSettings ? 'var(--line)' : 'var(--bg)',
              color: showTeamSettings ? 'var(--ink)' : 'var(--ink-2)',
              fontWeight: showTeamSettings ? 600 : 400,
            }}
          >
            👥 Team
          </button>
          {showTeamSettings && (
            <div style={{ marginTop: 8 }}>
              <SegmentedControl
                options={[
                  { value: 'priority' as WipMode, label: 'Priority' },
                  { value: 'reduce-wip' as WipMode, label: 'Reduce WIP' },
                  { value: 'min-units' as WipMode, label: 'Min units' },
                ]}
                value={wipMode} onChange={setWipMode}
                hint={WIP_HINTS[wipMode]}
              />
              {/* Coordination overhead (feat-016) — jen Cash Flow, který předává setter */}
              {setCoordinationOverhead && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 500, color: 'var(--ink-3)', marginBottom: 5, letterSpacing: 0.2 }}>
                    Coordination overhead
                  </div>
                  <SegmentedControl
                    options={[
                      { value: 'off', label: 'Off' },
                      { value: 'on', label: 'On' },
                    ]}
                    value={coordinationOverhead ? 'on' : 'off'}
                    onChange={v => setCoordinationOverhead(v === 'on')}
                    disabled={coordinationOverheadLocked}
                    hint="Each additional unit on a feature pays 25 % extra work and has a 20 % chance of causing rework."
                  />
                  {/* Změna uprostřed běhu by míchala dva modely v jednom výsledku → až po Resetu */}
                  {coordinationOverheadLocked && (
                    <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 4 }}>
                      🔒 Takes effect after Reset
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
