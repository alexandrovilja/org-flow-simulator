import Link from 'next/link'
import styles from './not-found.module.css'

/**
 * Stránka 404 ve stylu design systému Org Flow (feat-022): „404“ ve stylu display-xl, krátká
 * zpráva a odkaz zpět na simulátor. Barvy a písma bere ze stylů v CSS modulu, takže se mění
 * s tématem stejně jako zbytek aplikace.
 *
 * @returns Vykreslená stránka 404
 */
export default function NotFound() {
  return (
    <div className={styles.page}>
      <h1 className={styles.code}>404</h1>
      <p className={styles.message}>Page not found</p>
      {/* Use Next.js Link for internal navigation so client-side routing works */}
      <Link href="/" className={styles.back}>
        ← Back to simulator
      </Link>
    </div>
  )
}
