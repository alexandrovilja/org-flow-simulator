import { FeatureCard } from '@/components/FeatureCard'
import { MemberCard } from '@/components/MemberCard'
import { PanelHeader } from '@/components/PanelHeader'
import type { Feature, Task, SimState, Role, RoleMeta, ActivePresetId } from '@/types/simulation'

/** Vstupní props komponenty InProgressTeamPanel — střední sloupec sdílený Advanced a Cash Flow módem. */
interface InProgressTeamPanelProps {
  state: SimState
  roleConfig: Record<Role, RoleMeta>
  maxWork: number
  activePresetId: ActivePresetId
  handleAssignRole: (memberId: number, role: Role) => void
  handleRemoveRole: (memberId: number, role: Role) => void
  handleRenameMember: (memberId: number, name: string) => void
  handleRemoveMember: (memberId: number) => void
  handleAddMember: () => void
  /** Prefix pro data-tutorial-target atributy — odlišuje Advanced od Cash Flow v DOM. */
  tutorialTargetPrefix?: string
}

/**
 * Střední sloupec simulace: karty rozpracovaných features + správa týmu (add/remove
 * role, přejmenování, add/remove jednotka). Sdíleno mezi Advanced a Cash Flow módem
 * (feat-015) — každý mód mu předává svůj vlastní nezávislý stav a handlery.
 */
export function InProgressTeamPanel({
  state, roleConfig, maxWork, activePresetId,
  handleAssignRole, handleRemoveRole, handleRenameMember, handleRemoveMember, handleAddMember,
  tutorialTargetPrefix = 'experiment',
}: InProgressTeamPanelProps) {
  return (
    <section data-tutorial-target={`${tutorialTargetPrefix}-team`} style={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, background: 'var(--bg)' }}>
      <div data-tutorial-target={`${tutorialTargetPrefix}-in-progress`} style={{ borderBottom: '1px solid var(--line)', background: 'var(--panel)', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <PanelHeader title="In Progress" count={state.inProgress.length} hint="auto-scaled" />
        <div style={{
          padding: '8px 16px 14px 16px',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 8, overflowY: 'auto', minHeight: 64, alignContent: 'start',
        }}>
          {state.inProgress.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--ink-3)', fontStyle: 'italic', gridColumn: '1 / -1' }}>Nothing in flight.</div>
          )}
          {state.inProgress.map(f => <FeatureCard key={f.id} feature={f} team={state.team} maxWork={maxWork} roleConfig={roleConfig} />)}
        </div>
      </div>

      <div data-tutorial-target={`${tutorialTargetPrefix}-team-composition`} style={{ flex: '0 0 auto', padding: '10px 16px 12px', background: 'var(--panel)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'nowrap', overflow: 'hidden' }}>
          <h3 style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-2)', flexShrink: 0 }}>
            Units <span className="mono" style={{ color: 'var(--ink-3)', fontWeight: 500 }}>{state.team.length}</span>
          </h3>
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-3)', flexShrink: 0 }}>
            Click <span className="mono" style={{ color: 'var(--ink-2)' }}>+</span> to add a specialty
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridAutoRows: 'min-content', gap: 6, alignContent: 'start' }}>
          {state.team.map(m => {
            let cf: Feature | null = null
            let ct: Task | null = null
            if (m.currentTask) {
              cf = state.inProgress.find(f => f.id === m.currentTask!.featureId) ?? null
              ct = cf?.tasks.find(t => t.id === m.currentTask!.taskId) ?? null
            }
            // Člen čeká (waiting time narůstá) pokud:
            //  - simulace již běžela (startedAt !== null) — před spuštěním zobrazujeme idle
            //  - má roli, nemá aktuální úkol
            //  - pro jeho roli existuje 'todo' task v backlogu nebo inProgress
            // Stejná podmínka jako v engine.ts (hasMatchingWork), plus guard na startedAt.
            const isWaiting = state.startedAt !== null && m.roles.length > 0 && m.currentTask === null && (
              state.backlog.some(f => f.tasks.some(t => t.status === 'todo' && m.roles.includes(t.role))) ||
              state.inProgress.some(f => f.tasks.some(t => t.status === 'todo' && m.roles.includes(t.role)))
            )
            return (
              <MemberCard key={m.id} member={m} currentFeature={cf} currentTask={ct}
                roleConfig={roleConfig} onAddRole={handleAssignRole} onRemoveRole={handleRemoveRole}
                onRename={handleRenameMember} onRemove={handleRemoveMember} isWaiting={isWaiting} />
            )
          })}
        </div>
        <button onClick={handleAddMember} style={{
          marginTop: 2, width: '100%', padding: '5px 0',
          fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
          border: '1px dashed var(--line-2)', borderRadius: 4,
          background: 'transparent', color: 'var(--ink-3)', fontWeight: 500, letterSpacing: 0.3,
        }}>
          {activePresetId === 'teams' ? '+ Add team' : activePresetId === 'people' ? '+ Add member' : '+ Add unit'}
        </button>
      </div>
    </section>
  )
}
