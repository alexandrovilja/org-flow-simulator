import { useEffect, useId, useRef, type ReactNode } from 'react'
import styles from './ConfirmOverlay.module.css'

/** Vstupní props komponenty ConfirmOverlay. */
interface ConfirmOverlayProps {
  /** Nadpis dialogu (může obsahovat formátovaný text, např. uvozovky kolem názvu presetu). */
  title: ReactNode
  /** Vysvětlení, co se po potvrzení stane. */
  body: string
  /** Text tlačítka, které akci zruší. */
  cancelLabel?: string
  /** Text tlačítka, které akci potvrdí. */
  confirmLabel: string
  /** Šířka dialogové karty v px (delší texty potřebují o něco víc místa). */
  width?: number
  /** Volá se po kliknutí na zrušení nebo stisku Escape. */
  onCancel: () => void
  /** Volá se po kliknutí na potvrzení. */
  onConfirm: () => void
}

/**
 * Potvrzovací dialog přes celou oblast nastavení: rozmazaný poloprůhledný překryv a uprostřed karta
 * s nadpisem, vysvětlením a dvěma tlačítky. Rodič musí mít `position: relative`, překryv se roztáhne
 * přes jeho celou plochu. Sdílí ho potvrzení výběru presetu a potvrzení změny křivky výnosu (feat-017).
 *
 * Přístupnost: má `role="dialog"` a `aria-modal`, po otevření přesune fokus na tlačítko zrušení
 * (bezpečná volba u destruktivní akce) a po zavření ho vrátí tam, kde byl. Klávesy se zachytávají na
 * úrovni dokumentu, takže fungují i po kliknutí na ztmavenou plochu kolem karty (fokus pak spadne na
 * `body`): Escape dialog zruší a Tab fokus vrátí do dialogu a cyklí jen mezi oběma tlačítky, aby se
 * klávesnicí nešlo dostat k ovládání pod překryvem.
 *
 * @param title - Nadpis dialogu
 * @param body - Vysvětlující text
 * @param cancelLabel - Text tlačítka zrušení (výchozí „Cancel“)
 * @param confirmLabel - Text tlačítka potvrzení
 * @param width - Šířka karty v px (výchozí 200)
 * @param onCancel - Callback zrušení (tlačítko i Escape)
 * @param onConfirm - Callback potvrzení
 */
export function ConfirmOverlay({ title, body, cancelLabel = 'Cancel', confirmLabel, width = 200, onCancel, onConfirm }: ConfirmOverlayProps) {
  const titleId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  // Nejnovější onCancel v refu: rodič ho předává jako novou funkci při každém překreslení (~60× za sekundu
  // za běhu simulace) a listener níže se kvůli tomu nemá pokaždé odpojovat a znovu připojovat.
  const onCancelRef = useRef(onCancel)
  useEffect(() => { onCancelRef.current = onCancel })

  // Po otevření fokus na Cancel a klávesy Escape / Tab na úrovni dokumentu; při zavření vrátíme
  // fokus na prvek, který ho měl před otevřením
  useEffect(() => {
    const previouslyFocused = document.activeElement
    cancelRef.current?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancelRef.current()
        return
      }
      if (e.key !== 'Tab') return
      // Focus trap: v dialogu jsou jen dvě tlačítka. Mimo ně (např. po kliknutí na pozadí) fokus vrátíme
      // dovnitř, na krajích ho zacyklíme na druhý konec.
      const first = cancelRef.current
      const last = confirmRef.current
      if (!first || !last) return
      const active = document.activeElement
      if (active !== first && active !== last) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      } else if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [])

  return (
    <div className={styles.overlay}>
      <div className={styles.card} style={{ width }} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div id={titleId} className={styles.title}>
          {title}
        </div>
        <div className={styles.body}>
          {body}
        </div>
        <div className={styles.buttons}>
          <button ref={cancelRef} className={`${styles.button} ${styles.cancel}`} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button ref={confirmRef} className={`${styles.button} ${styles.confirm}`} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
