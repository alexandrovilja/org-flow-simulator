import styles from './BoltIcon.module.css'

/**
 * Ikona blesku, kterou aplikace značí AI (feat-019): v tlačítku AI na chipu skillu a ve značce u
 * rozpracovaného úkolu. Odlišuje AI multiplikátor od přepínače rychlosti simulace (0.5× / 1× / 10×),
 * který používá stejný zápis „N×“. Barvu přebírá z textu okolního prvku (`currentColor`).
 * Pro čtečky obrazovky je skrytá — hodnotu nese přístupný název tlačítka nebo titulek značky.
 *
 * @returns SVG ikona blesku
 */
export function BoltIcon() {
  return (
    <svg width={6} height={9} viewBox="0 0 6 9" aria-hidden="true" className={styles.icon}>
      <path d="M3.6 0 0 5h2.3L1.7 9 6 3.6H3.7L4.4 0z" fill="currentColor" />
    </svg>
  )
}
