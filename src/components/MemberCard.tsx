'use client'

import { useState } from 'react'
import { ROLES, ROLE_META } from '@/simulation/engine'
import { RoleChip } from './RoleChip'
import type { Feature, Member, Task, Role } from '@/types/simulation'

interface MemberCardProps {
  member: Member
  currentFeature: Feature | null
  currentTask: Task | null
  onAddRole: (memberId: number, role: Role) => void
  onRemoveRole: (memberId: number, role: Role) => void
}

export function MemberCard({ member, currentFeature, currentTask, onAddRole, onRemoveRole }: MemberCardProps) {
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', position: 'relative' }}>
        <div style={{
          width: 18, height: 18, borderRadius: '50%',
          background: 'var(--ink)', color: 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 600, flexShrink: 0,
        }}>
          {member.name[0]}
        </div>
        <span style={{ fontWeight: 600, fontSize: 12, marginRight: 2 }}>{member.name}</span>
        {member.roles.map(r => (
          <RoleChip key={r} role={r} removable onRemove={() => onRemoveRole(member.id, r)} />
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
                padding: '2px 6px', borderRadius: 3,
                letterSpacing: 0.3, cursor: 'pointer',
              }}>{r}</button>
            ))}
            <button onClick={() => setAdding(false)} style={{
              background: 'transparent', border: 'none',
              color: 'var(--ink-3)', fontSize: 10, padding: '0 4px', cursor: 'pointer',
            }}>cancel</button>
          </div>
        )}
      </div>

      <div style={{ minHeight: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                {currentTask.role}
              </span>
            </div>
            <div style={{ height: 14, background: 'var(--line)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${fillPct}%`, background: taskMeta.color }} />
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
