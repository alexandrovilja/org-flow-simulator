import styles from './Slider.module.css'

/** Props posuvníku v nastavení backlogu. */
interface SliderProps {
  /** Popisek nad posuvníkem; zároveň přístupné jméno vstupu. */
  label: string
  /** Aktuální hodnota. */
  value: number
  /** Nejmenší povolená hodnota. */
  min: number
  /** Největší povolená hodnota. */
  max: number
  /** Krok posuvníku. */
  step: number
  /** Volá se s novou hodnotou při každém posunu. */
  onChange: (value: number) => void
  /** Převod hodnoty na text vpravo od popisku (např. „100 items“); bez něj se ukáže číslo. */
  format?: (value: number) => string
  /** Nápověda zobrazená jako odznak ⓘ vedle popisku — při hoveru jako title. */
  tooltip?: string
}

/**
 * Posuvník s popiskem a hodnotou v nastavení backlogu (design system Org Flow, feat-021):
 * popisek v `ink-2`, hodnota v mono písmu, tenká dráha v `line-control` a jezdec v `ink`.
 *
 * @param props - Popisek, hodnota, rozsah, callback změny, volitelný formát a nápověda
 * @returns Vykreslený posuvník
 */
export function Slider({ label, value, min, max, step, onChange, format, tooltip }: SliderProps) {
  return (
    <div title={tooltip} className={[styles.slider, tooltip && styles.withTooltip].filter(Boolean).join(' ')}>
      <div className={styles.head}>
        <span className={styles.label}>
          {label}
          {tooltip && <span className={styles.helpBadge}>?</span>}
        </span>
        <span className={`mono ${styles.value}`}>
          {format ? format(value) : value}
        </span>
      </div>
      {/* aria-label dá slideru přístupné jméno podle popisku — čtečka obrazovky ho přečte
          a testy ho najdou přes getByRole('slider', { name }) (feat-003) */}
      <input
        type="range"
        className={styles.range}
        aria-label={label}
        value={value}
        min={min} max={max} step={step}
        onChange={e => onChange(parseFloat(e.target.value))}
      />
    </div>
  )
}
