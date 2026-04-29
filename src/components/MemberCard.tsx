'use client'

import { useState } from 'react'
import { ROLES, ROLE_META } from '@/simulation/engine'
import { RoleChip } from './RoleChip'
import type { Feature, Member, Task, Role, RoleMeta } from '@/types/simulation'

interface MemberCardProps {
  member: Member
  currentFeature: Feature | null
  currentTask: Task | null
  /** Aktuální konfigurace specializací — pro zobrazení plných názvů rolí. */
  roleConfig: Record<Role, RoleMeta>
  onAddRole: (memberId: number, role: Role) => void
  onRemoveRole: (memberId: number, role: Role) => void
  /** Callback pro přejmenování jednotky. */
  onRename: (memberId: number, name: string) => void
  /** Callback pro odebrání jednotky. Volající zajistí uvolnění aktivního úkolu. */
  onRemove: (memberId: number) => void
}

/**
 * Karta jednoho člena týmu zobrazující:
 * - editovatelné jméno + tlačítko pro odebrání jednotky
 * - přiřazené specializace (chipy s plným názvem)
 * - progress bar aktivního úkolu, nebo idle stav
 */
export function MemberCard({ member, currentFeature, currentTask, roleConfig, onAddRole, onRemoveRole, onRename, onRemove }: MemberCardProps) {
  const [adding, setAdding] = useState(false)
  const availableRoles = ROLES.filter(r => !member.roles.includes(r))
  const taskMeta = currentTask ? ROLE_META[currentTask.role] : null
  const fillPct = currentTask ? (currentTask.progress / currentTask.work) * 100 : 0

  return (
    <div style={{
      background: 'var(--panel)',
      border: '1px solid var(--line)',
      borderRadius: 6,
      padding: '6px 8px',
      display: 'flex', flexDirection: 'column', gap: 4,
      minHeight: 0, overflow: 'hidden',
    }}>
      {/* Řádek 1: avatar + editovatelné jméno + tlačítko smazání */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%',
          background: 'var(--ink)', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 600, flexShrink: 0,
        }}>
          {member.name[0]?.toUpperCase() ?? '?'}
        </div>

        {/* Inline name input — vždy editovatelný, uloží při blur nebo Enter */}
        <input
          type="text"
          value={member.name}
          onChange={e => onRename(member.id, e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
          style={{
            flex: 1, minWidth: 0,
            fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
            background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--ink)', padding: 0,
          }}
        />

        {/* Tlačítko odebrání jednotky */}
        <button
          onClick={() => onRemove(member.id)}
          title="Remove unit"
          style={{
            flexShrink: 0,
            width: 16, height: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'transparent',
            border: '1px solid var(--line)',
            borderRadius: 3, color: 'var(--ink-3)',
            fontSize: 11, lineHeight: 1, cursor: 'pointer',
            padding: 0,
          }}
        >×</button>
      </div>

      {/* Řádek 2: specializační chipy + tlačítko přidání role */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', position: 'relative' }}>
        {member.roles.map(r => (
          <RoleChip
            key={r}
            role={r}
            label={roleConfig[r].label}
            removable
            onRemove={() => onRemoveRole(member.id, r)}
          />
        ))}
        {!adding && availableRoles.length > 0 && (
          <button onClick={() => setAdding(true)} style={{
            background: 'transparent',
            border: '1px dashed var(--line-2)',
            color: 'var(--ink-3)',
            fontSize: 10, padding: '1px 5px', borderRadius: 3,
            fontWeight: 500, lineHeight: 1.2, cursor: 'pointer',
          }}>+</button>
        )}
        {adding && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 10,
            display: 'flex', gap: 4, flexWrap: 'wrap',
            padding: 6, background: 'var(--panel)',
            border: '1px solid var(--line-2)', borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)', minWidth: 'max-content',
          }}>
            {availableRoles.map(r => (
              <button key={r} onMouseDown={(e) => {
                e.preventDefault()
                onAddRole(member.id, r)
                setAdding(false)
              }} style={{
                background: ROLE_META[r].color,
                border: 'none', color: 'white',
                fontSize: 10, fontWeight: 600,
                padding: '2px 8px', borderRadius: 3,
                letterSpacing: 0.3, cursor: 'pointer',
              }}>
                {/* Plný název specializace z roleConfig */}
                {roleConfig[r].label}
              </button>
            ))}
            <button onClick={() => setAdding(false)} style={{
              background: 'transparent', border: 'none',
              color: 'var(--ink-3)', fontSize: 10, padding: '0 4px', cursor: 'pointer',
            }}>cancel</button>
          </div>
        )}
      </div>

      {/* Řádek 3: progress bar nebo idle stav */}
      <div style={{ minHeight: 22, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {currentFeature && currentTask && taskMeta ? (
          <>
            <div style={{
              fontSize: 10, color: 'var(--ink-2)',
              display: 'flex', alignItems: 'center', gap: 4,
              whiteSpace: 'nowrap', overflow: 'hidden',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: 2,
                background: `oklch(70% 0.14 ${currentFeature.hue})`, flexShrink: 0,
              }} />
              <span className="mono" style={{ overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
                {currentFeature.name}
              </span>
              <span className="mono" style={{ fontSize: 9, fontWeight: 600, color: taskMeta.color, flexShrink: 0 }}>
                {/* Plný název aktuálně pracované specializace */}
                {roleConfig[currentTask.role].label}
              </span>
            </div>
            {/* Wider progress bar — height 22px */}
            <div style={{ height: 22, background: 'var(--line)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${fillPct}%`, background: taskMeta.color, transition: 'width 0.1s linear' }} />
            </div>
          </>
        ) : (
          <div style={{ fontSize: 10, color: 'var(--ink-3)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--line-2)' }} />
            {member.roles.length === 0 ? 'no roles' : 'idle'}
          </div>
        )}
      </div>
    </div>
  )
}
