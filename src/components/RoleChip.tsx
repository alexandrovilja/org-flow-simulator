import { BoltIcon } from '@/components/BoltIcon'
import { useIsTruncated } from '@/hooks/useIsTruncated'
import type { AiMultiplier, Role } from '@/types/simulation'
import type { CssVariables } from '@/types/css'
import styles from './RoleChip.module.css'

/**
 * Ovládání AI na chipu skillu (feat-019). Chip jen zobrazuje; další hodnotu v pořadí 1× → 2× → 5× → 1×
 * počítá volající a předává ji v `onCycle`, takže se tu nemusí znát pravidla přepínání.
 */
interface RoleChipAi {
  /** Aktuální multiplikátor skillu: 1 = bez AI (průhledné „AI“), 2 / 5 = bílý odznak s bleskem. */
  value: AiMultiplier
  /** Přístupný název tlačítka, např. „AI speed-up for Development: 5×“ (viditelná hodnota je jeho součástí). */
  label: string
  /** Tooltip s tím, co udělá další kliknutí, např. „… – click for 2×“. */
  title: string
  /** Přepne skill na další hodnotu; volá se při kliknutí, Enteru i mezerníku. */
  onCycle: () => void
  /** Volitelný `data-tutorial-target` tlačítka (feat-025: první chip první jednotky). */
  tutorialTarget?: string
}

/** Vstupní props chipu specializace: role, její vzhled, volitelné odebrání a volitelné ovládání AI. */
interface RoleChipProps {
  role: Role
  /** Barva chipu — předává ji volající z roleConfig, aby fungovaly i custom specializace. */
  color: string
  /** Zobrazovaný text — plný název specializace z roleConfig.
   *  Pokud není zadán, zobrazí se ID role (FE, BE, …). */
  label?: string
  removable?: boolean
  onRemove?: () => void
  /** Tlačítko AI mezi názvem a křížkem (feat-019). Bez něj se chip nemění — používá to Compare. */
  ai?: RoleChipAi
}

/**
 * Barevný chip reprezentující jednu specializaci (design system Org Flow, feat-021).
 * Používá se v MemberCard pro zobrazení přiřazených rolí a v ComparePanel.
 * Barva i label přicházejí od volajícího (z roleConfig) — chip sám nic nevyhledává,
 * takže funguje i pro uživatelsky přidané specializace. Barva jde do CSS proměnné --role,
 * vzhled (výška, písmo, bílý text) je v RoleChip.module.css.
 *
 * Chip je řádek: název (zkrátí se výpustkou, když není místo) + volitelné tlačítko AI + volitelný křížek.
 * Tlačítko AI a křížek se nikdy nezkracují, takže jsou vidět i u dlouhého názvu v úzké kartě.
 *
 * @param props - Role, její barva, volitelný popisek, možnost odebrání a ovládání AI
 * @returns Vykreslený čip
 */
export function RoleChip({ role, color, label, removable, onRemove, ai }: RoleChipProps) {
  const style: CssVariables = { '--role': color }
  const text = label ?? role
  // Plný název v title jen tehdy, když ho v úzké kartě zkrátí výpustka (feat-023); měří se prvek s názvem
  const [ref, truncated] = useIsTruncated<HTMLSpanElement>(text)
  const aiOn = ai !== undefined && ai.value > 1
  return (
    <span className={styles.chip} style={style}>
      <span ref={ref} className={styles.label} title={truncated ? text : undefined}>{text}</span>
      {ai && (
        <button
          type="button"
          onClick={ai.onCycle}
          title={ai.title}
          aria-label={ai.label}
          data-tutorial-target={ai.tutorialTarget}
          className={aiOn ? `${styles.aiButton} ${styles.aiButtonOn}` : styles.aiButton}
        >
          {aiOn && <BoltIcon />}
          {aiOn ? `${ai.value}×` : 'AI'}
        </button>
      )}
      {removable && (
        <button type="button" onClick={onRemove} className={styles.remove} title="Remove role">×</button>
      )}
    </span>
  )
}
