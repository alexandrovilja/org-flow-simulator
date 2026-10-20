import type { Role } from '@/types/simulation'
import type { CssVariables } from '@/types/css'
import styles from './RoleChip.module.css'

interface RoleChipProps {
  role: Role
  /** Barva chipu — předává ji volající z roleConfig, aby fungovaly i custom specializace. */
  color: string
  /** Zobrazovaný text — plný název specializace z roleConfig.
   *  Pokud není zadán, zobrazí se ID role (FE, BE, …). */
  label?: string
  removable?: boolean
  onRemove?: () => void
}

/**
 * Barevný chip reprezentující jednu specializaci (design system Org Flow, feat-021).
 * Používá se v MemberCard pro zobrazení přiřazených rolí.
 * Barva i label přicházejí od volajícího (z roleConfig) — chip sám nic nevyhledává,
 * takže funguje i pro uživatelsky přidané specializace. Barva jde do CSS proměnné --role,
 * vzhled (výška, písmo, bílý text) je v RoleChip.module.css.
 *
 * @param props - Role, její barva, volitelný popisek a možnost odebrání
 * @returns Vykreslený čip
 */
export function RoleChip({ role, color, label, removable, onRemove }: RoleChipProps) {
  const style: CssVariables = { '--role': color }
  return (
    <span className={styles.chip} style={style}>
      {label ?? role}
      {removable && (
        <button type="button" onClick={onRemove} className={styles.remove} title="Remove role">×</button>
      )}
    </span>
  )
}
