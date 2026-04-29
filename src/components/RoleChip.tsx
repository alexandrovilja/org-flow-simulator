import { ROLE_META } from '@/simulation/engine'
import type { Role } from '@/types/simulation'

interface RoleChipProps {
  role: Role
  /** Zobrazovaný text — plný název specializace z roleConfig.
   *  Pokud není zadán, zobrazí se ID role (FE, BE, …). */
  label?: string
  removable?: boolean
  onRemove?: () => void
}

/**
 * Barevný chip reprezentující jednu specializaci.
 * Používá se v MemberCard pro zobrazení přiřazených rolí.
 * Barva je vždy z ROLE_META (fixní), label je konfigurovatelný.
 */
export function RoleChip({ role, label, removable, onRemove }: RoleChipProps) {
  const meta = ROLE_META[role]
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: meta.color,
      color: 'white',
      fontSize: 10, fontWeight: 600,
      padding: '2px 6px', borderRadius: 3,
      letterSpacing: 0.3,
    }}>
      {label ?? role}
      {removable && (
        <button onClick={onRemove} style={{
          background: 'rgba(255,255,255,0.25)',
          border: 'none', color: 'white',
          width: 12, height: 12, borderRadius: 2,
          padding: 0, lineHeight: 1, fontSize: 10,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }} title="Remove role">×</button>
      )}
    </span>
  )
}
