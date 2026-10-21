import { PRESETS } from '@/simulation/engine'
import { FeatureCard } from '@/components/FeatureCard'
import { RoleSettings } from '@/components/RoleSettings'
import { Slider } from '@/components/Slider'
import { PanelHeader } from '@/components/PanelHeader'
import { SegmentedControl } from '@/components/SegmentedControl'
import { ConfirmOverlay } from '@/components/ConfirmOverlay'
import { RevenueCurvePreview } from '@/components/RevenueCurvePreview'
import { Button } from '@/components/Button'
import { EmptyNote } from '@/components/EmptyNote'
import { REVENUE_PROFILE_INFO } from '@/lib/revenueProfiles'
import { downloadTemplate } from '@/lib/xlsImport'
import styles from './BacklogSettingsPanel.module.css'
import type { Feature, SimState, SimSettings, Role, RoleMeta, WipMode, UnitPreset, ActivePresetId, RevenueProfile } from '@/types/simulation'

/** Hover hint pro každý WIP mód — popisuje, jak jednotky vybírají další práci (feat-016: Min units). */
const WIP_HINTS: Record<WipMode, string> = {
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
  /** Zvolený tvar výnosu (jen Cash Flow mód, feat-017). Výchozí `'flat'`. */
  revenueProfile?: RevenueProfile
  /** Callback přepínače „Revenue curve“ — když není zadán, přepínač ani náhled se nevykreslí (Advanced mód). */
  onRevenueProfileChange?: (profile: RevenueProfile) => void
  /** Profil čekající na potvrzení (změna během běhu); `null` / nezadáno = dialog je zavřený. */
  confirmingRevenueProfile?: RevenueProfile | null
  /** „Change and reset“ v dialogu změny křivky. */
  onConfirmRevenueProfile?: () => void
  /** „Cancel“ v dialogu změny křivky. */
  onCancelRevenueProfile?: () => void
}

/**
 * Levý sloupec simulace: seznam backlogu + Settings panel (presety, XLS import,
 * generování backlogu, editor specializací, WIP mód). Sdíleno mezi Advanced a Cash Flow
 * módem (feat-015) — každý mód mu předává svůj vlastní nezávislý stav a handlery.
 * Vzhled podle design systému Org Flow (feat-021): preset, křivka výnosu i WIP mód jsou jeden
 * SegmentedControl, akce jsou hranatá tlačítka Button a barvy jdou jen z tokenů.
 *
 * @param props - Stav a handlery módu (viz BacklogSettingsPanelProps)
 * @returns Levý sloupec s backlogem a nastavením
 */
export function BacklogSettingsPanel({
  state, settings, setSettings, roleConfig, activePresetId, confirmingPreset, setConfirmingPreset,
  showBacklogControls, setShowBacklogControls, showRoleSettings, setShowRoleSettings,
  showTeamSettings, setShowTeamSettings, importMsg, fileInputRef, wipMode, setWipMode, maxWork,
  handleXlsImport, handleRegenerate, handlePresetClick, handleConfirmPreset, getRevenueBadge,
  handleRoleChange, handleAddRole, handleDeleteRole, tutorialTargetPrefix = 'experiment',
  coordinationOverhead = false, setCoordinationOverhead, coordinationOverheadLocked = false,
  revenueProfile = 'flat', onRevenueProfileChange, confirmingRevenueProfile = null,
  onConfirmRevenueProfile, onCancelRevenueProfile,
}: BacklogSettingsPanelProps) {
  /**
   * Hlavička akordeonu v nastavení (Backlog, Specializations, Team): hranaté tlačítko přes celou
   * šířku ve stylu „eyebrow“. Šipka ▸ / ▾ je samostatný aria-hidden prvek, aby přístupný název
   * zůstal jen název sekce; stav říká aria-expanded. Tlačítko je zároveň cílem kroku tutoriálu
   * (feat-025) — tutoriál zvýrazní jen hlavičku a sekci nerozbaluje.
   */
  const accordionButton = (label: string, open: boolean, toggle: () => void, tutorialTarget: string) => (
    <button
      type="button"
      aria-expanded={open}
      data-tutorial-target={tutorialTarget}
      className={[styles.accordionButton, open && styles.accordionOpen].filter(Boolean).join(' ')}
      onClick={toggle}
    >
      {label}
      <span aria-hidden="true" className={styles.accordionCaret}>{open ? '▾' : '▸'}</span>
    </button>
  )

  return (
    <section data-tutorial-target={`${tutorialTargetPrefix}-backlog`} className={styles.panel}>
      <div data-tutorial-target={`${tutorialTargetPrefix}-backlog-list`} className={styles.listArea}>
        <PanelHeader title="Backlog" count={state.backlog.length} hint={getRevenueBadge ? 'sorted by revenue' : undefined} />
        <div className={styles.list}>
          {state.backlog.length === 0 && <EmptyNote>No items waiting.</EmptyNote>}
          {state.backlog.map(f => (
            <FeatureCard key={f.id} feature={f} compact neutral maxWork={maxWork} roleConfig={roleConfig}
              revenue={getRevenueBadge?.(f)} />
          ))}
        </div>
      </div>

      <div data-tutorial-target={`${tutorialTargetPrefix}-settings`} className={styles.settings}>
        <h3 className={styles.title}>Settings</h3>

        <div data-tutorial-target={`${tutorialTargetPrefix}-unit-preset`} className={styles.presetSection}>
          <div className={styles.fieldLabel}>Unit preset</div>
          <div className={styles.presetRow}>
            {/* Ručně upravený tým (Custom) neodpovídá žádnému presetu → žádný segment není stisknutý.
                Klik i na aktivní preset ho znovu nabídne použít (s potvrzením), jako dřív. */}
            <SegmentedControl<UnitPreset['id']>
              options={PRESETS.map(preset => ({ value: preset.id, label: preset.label }))}
              value={activePresetId === 'custom' ? null : activePresetId}
              onChange={id => {
                const preset = PRESETS.find(p => p.id === id)
                if (preset) handlePresetClick(preset)
              }}
            />
            {activePresetId === 'custom' && <span className={styles.customBadge}>custom</span>}
          </div>
        </div>

        {confirmingPreset && (
          <ConfirmOverlay
            title={<>Apply &ldquo;{confirmingPreset.label}&rdquo; preset?</>}
            body="Your current team and specializations will be replaced. This cannot be undone."
            confirmLabel="Apply preset"
            onCancel={() => setConfirmingPreset(null)}
            onConfirm={handleConfirmPreset}
          />
        )}

        {/* Změna křivky výnosu během běhu (feat-017) — stejný dialog jako u presetu */}
        {confirmingRevenueProfile && onConfirmRevenueProfile && onCancelRevenueProfile && (
          <ConfirmOverlay
            title="Change revenue curve?"
            body="Changing the revenue curve resets the current run. The backlog stays the same."
            confirmLabel="Change and reset"
            onCancel={onCancelRevenueProfile}
            onConfirm={onConfirmRevenueProfile}
          />
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className={styles.hiddenInput}
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) handleXlsImport(file)
            e.target.value = ''
          }}
        />

        <div className={styles.accordion}>
          {accordionButton('Backlog', showBacklogControls, () => setShowBacklogControls(v => !v), `${tutorialTargetPrefix}-backlog-accordion`)}
          {showBacklogControls && (
            <div className={styles.accordionBody}>
              <div className={styles.fileRow}>
                <Button className={styles.fileButton} onClick={() => fileInputRef.current?.click()}>
                  ↑ Import XLS
                </Button>
                <Button variant="ghost" className={styles.fileButton} onClick={downloadTemplate}>
                  ↓ Template
                </Button>
              </div>

              {importMsg && (
                <div className={`${styles.importMsg} ${importMsg.ok ? styles.importOk : styles.importError}`}>
                  {importMsg.ok ? '✓' : '×'} {importMsg.text}
                </div>
              )}

              <Button variant="strong" className={styles.fullWidth} onClick={handleRegenerate}>
                Generate new backlog
              </Button>
              {/* Tvar výnosu featur po dodání (feat-017) — jen Cash Flow, který předává callback */}
              {onRevenueProfileChange && (
                <div>
                  <div className={styles.fieldLabel}>Revenue curve</div>
                  <SegmentedControl<RevenueProfile>
                    options={[
                      { value: 'flat', label: REVENUE_PROFILE_INFO['flat'].label },
                      { value: 'j-curve', label: REVENUE_PROFILE_INFO['j-curve'].label },
                      { value: 's-curve', label: REVENUE_PROFILE_INFO['s-curve'].label },
                    ]}
                    value={revenueProfile}
                    onChange={onRevenueProfileChange}
                    hint={REVENUE_PROFILE_INFO[revenueProfile].hint}
                  />
                  <RevenueCurvePreview profile={revenueProfile} />
                </div>
              )}
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
        <div className={styles.accordion}>
          {accordionButton('Specializations', showRoleSettings, () => setShowRoleSettings(v => !v), `${tutorialTargetPrefix}-specializations-accordion`)}
          {showRoleSettings && (
            <div className={styles.accordionBody}>
              <RoleSettings roleConfig={roleConfig} onChange={handleRoleChange} onAdd={handleAddRole} onDelete={handleDeleteRole} />
            </div>
          )}
        </div>
        <div className={styles.accordion}>
          {accordionButton('Team', showTeamSettings, () => setShowTeamSettings(v => !v), `${tutorialTargetPrefix}-team-accordion`)}
          {showTeamSettings && (
            <div className={styles.accordionBody}>
              <SegmentedControl
                options={[
                  { value: 'reduce-wip' as WipMode, label: 'Reduce WIP' },
                  { value: 'min-units' as WipMode, label: 'Min units' },
                ]}
                value={wipMode} onChange={setWipMode}
                hint={WIP_HINTS[wipMode]}
              />
              {/* Coordination overhead (feat-016) — jen Cash Flow, který předává setter */}
              {setCoordinationOverhead && (
                <div>
                  <div className={styles.fieldLabel}>Coordination overhead</div>
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
                    <div className={styles.note}>Takes effect after Reset</div>
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
