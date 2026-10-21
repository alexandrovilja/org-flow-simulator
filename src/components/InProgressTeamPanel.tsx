import { FeatureCard } from '@/components/FeatureCard'
import { MemberCard } from '@/components/MemberCard'
import { PanelHeader } from '@/components/PanelHeader'
import { Button } from '@/components/Button'
import { EmptyNote } from '@/components/EmptyNote'
import { isFeatureActive, sortInProgressForDisplay } from '@/lib/inProgressOrder'
import styles from './InProgressTeamPanel.module.css'
import type { Feature, Task, SimState, Role, RoleMeta, ActivePresetId, AiMultiplier } from '@/types/simulation'

/** Vstupní props komponenty InProgressTeamPanel — střední sloupec sdílený Advanced a Cash Flow módem. */
interface InProgressTeamPanelProps {
  state: SimState
  roleConfig: Record<Role, RoleMeta>
  maxWork: number
  activePresetId: ActivePresetId
  handleAssignRole: (memberId: number, role: Role) => void
  handleRemoveRole: (memberId: number, role: Role) => void
  handleRenameMember: (memberId: number, name: string) => void
  /** Nastaví jednotce AI multiplikátor (feat-019) — každý mód předává handler nad svým týmem. */
  handleSetAiMultiplier: (memberId: number, value: AiMultiplier) => void
  handleRemoveMember: (memberId: number) => void
  handleAddMember: () => void
  /** Prefix pro data-tutorial-target atributy — odlišuje Advanced od Cash Flow v DOM. */
  tutorialTargetPrefix?: string
  /** Zobrazí čipy coordination overhead na kartách In Progress (jen Cash Flow, feat-016). */
  showCoordination?: boolean
}

/**
 * Střední sloupec simulace: karty rozpracovaných features + správa týmu (add/remove
 * role, přejmenování, add/remove jednotka). Sdíleno mezi Advanced a Cash Flow módem
 * (feat-015) — každý mód mu předává svůj vlastní nezávislý stav a handlery.
 */
export function InProgressTeamPanel({
  state, roleConfig, maxWork, activePresetId,
  handleAssignRole, handleRemoveRole, handleRenameMember, handleSetAiMultiplier, handleRemoveMember, handleAddMember,
  tutorialTargetPrefix = 'experiment', showCoordination = false,
}: InProgressTeamPanelProps) {
  return (
    <section data-tutorial-target={`${tutorialTargetPrefix}-team`} className={styles.panel}>
      <div data-tutorial-target={`${tutorialTargetPrefix}-in-progress`} className={styles.inProgress}>
        <PanelHeader title="In Progress" count={state.inProgress.length} hint="auto-scaled" />
        <div className={styles.cards}>
          {state.inProgress.length === 0 && (
            <EmptyNote gridColumn="1 / -1">Nothing in flight.</EmptyNote>
          )}
          {/* Aktivní features nahoře a zvýrazněné; řazení je jen v zobrazení, state.inProgress se nemění */}
          {sortInProgressForDisplay(state.inProgress).map(f => <FeatureCard key={f.id} feature={f} team={state.team} maxWork={maxWork} roleConfig={roleConfig} showCoordination={showCoordination} active={isFeatureActive(f)} />)}
        </div>
      </div>

      <div data-tutorial-target={`${tutorialTargetPrefix}-team-composition`} className={styles.team}>
        {/* Stejná hlavička jako ostatní panely: nadpisek, počet jednotek a poznámka vpravo */}
        <PanelHeader title="Units" count={state.team.length} hint="Click + to add a specialty" />

        <div className={styles.members}>
          {state.team.map((m, i) => {
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
                onRename={handleRenameMember} onRemove={handleRemoveMember}
                onSetAiMultiplier={handleSetAiMultiplier} isWaiting={isWaiting}
                // První jednotka je cílem kroků „Shape your units“ a „AI speed-up“ (feat-025)
                tutorialTarget={i === 0 ? `${tutorialTargetPrefix}-first-unit` : undefined} />
            )
          })}
        </div>
        <Button variant="dashed" className={styles.addUnit} onClick={handleAddMember}>
          {activePresetId === 'teams' ? '+ Add team' : activePresetId === 'people' ? '+ Add member' : '+ Add unit'}
        </Button>
      </div>
    </section>
  )
}
