import type { ComponentProps } from 'react'
import styles from './Button.module.css'

/**
 * Role tlačítka v toku workshopu (design system Org Flow, feat-021):
 * - `primary` — Run, jediná primární výzva na obrazovce (`action`)
 * - `running` — Pause, když simulace běží (`accent`)
 * - `done` — ✓ Done po doběhnutí běhu (`done`)
 * - `secondary` — Reset a další běžné akce (obrys `line-control`)
 * - `strong` — potvrzení v dialogu (`ink`), záměrně ne v barvě Run
 * - `ghost` — ústupové volby jako Cancel
 * - `light` — hlavní akce na antracitové kartě tutoriálu (Next / Finish), bílá výplň
 * - `dashed` — přidání položky (+ Add unit): čárkovaný obrys, průhledné pozadí, tlumený text
 */
type ButtonVariant = 'primary' | 'running' | 'done' | 'secondary' | 'strong' | 'ghost' | 'light' | 'dashed'

/**
 * Props tlačítka: všechny atributy nativního <button> (včetně `ref`, který React 19 předává jako
 * běžný prop — potřebuje ho dialog pro přesun fokusu) plus vzhled podle design systému.
 */
interface ButtonProps extends ComponentProps<'button'> {
  /** Role tlačítka; výchozí je `secondary`. */
  variant?: ButtonVariant
  /** Tlačítko stojí na antracitové horní liště — obrys a text se přizpůsobí tmavému podkladu. */
  onBar?: boolean
  /** Kulaté tlačítko jen s ikonou (např. „?“); vyžaduje `aria-label`. */
  iconOnly?: boolean
  /** Měkký pulzující prstenec — jen pro Run před prvním spuštěním simulace. */
  pulse?: boolean
}

/**
 * Hranaté tlačítko design systému Org Flow. Vzhled (barvy, výška, písmo) bere výhradně z tokenů
 * v globals.css, takže se jednotně mění s tématem. Popisek píše volající ve větné velikosti —
 * verzálky dělá CSS, aby ho čtečka nečetla po písmenech.
 *
 * @param props - Nativní atributy tlačítka plus `variant`, `onBar`, `iconOnly` a `pulse`
 * @returns Vykreslené tlačítko
 */
export function Button({ variant = 'secondary', onBar = false, iconOnly = false, pulse = false, className, type = 'button', ...rest }: ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    onBar && styles.onBar,
    iconOnly && styles.iconOnly,
    pulse && styles.pulse,
    className,
  ].filter(Boolean).join(' ')
  return <button type={type} className={classes} {...rest} />
}
