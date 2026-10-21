import { useId, useRef, type ReactNode } from 'react'
import { Button } from '@/components/Button'
import { useModalFocus } from '@/hooks/useModalFocus'
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
  /** Šířka dialogové karty v px (výchozí 280 podle design systému; dialog se musí vejít do postranního panelu). */
  width?: number
  /** Volá se po kliknutí na zrušení nebo stisku Escape. */
  onCancel: () => void
  /** Volá se po kliknutí na potvrzení. */
  onConfirm: () => void
}

/**
 * Potvrzovací dialog přes celou oblast nastavení: rozmazaný závoj v barvě stránky a uprostřed karta
 * s nadpisem, vysvětlením a dvěma tlačítky stejné šířky — Cancel (`ghost`) a potvrzení (`strong`,
 * záměrně ne v barvě Run ani v červené reworku; design system Org Flow, feat-021). Rodič musí mít `position: relative`, překryv se roztáhne
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
 * @param width - Šířka karty v px (výchozí 280)
 * @param onCancel - Callback zrušení (tlačítko i Escape)
 * @param onConfirm - Callback potvrzení
 */
export function ConfirmOverlay({ title, body, cancelLabel = 'Cancel', confirmLabel, width = 280, onCancel, onConfirm }: ConfirmOverlayProps) {
  const titleId = useId()
  const cardRef = useRef<HTMLDivElement>(null)

  // Fokus na Cancel (první tlačítko v kartě — bezpečná volba u destruktivní akce), Tab cyklí mezi
  // oběma tlačítky, Escape zruší a po zavření se fokus vrátí; když je přes dialog otevřený jiný
  // dialog (zpětná vazba, feat-024), klávesy patří tomu hornímu
  useModalFocus(cardRef, onCancel)

  return (
    <div className={styles.overlay}>
      <div ref={cardRef} className={styles.card} style={{ width }} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div id={titleId} className={styles.title}>
          {title}
        </div>
        <div className={styles.body}>
          {body}
        </div>
        <div className={styles.buttons}>
          <Button variant="ghost" className={styles.button} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="strong" className={styles.button} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
