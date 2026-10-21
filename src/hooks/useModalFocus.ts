import { useEffect, useRef, type RefObject } from 'react'

/**
 * Prvky, na které se dá v dialogu dostat Tabem. Prvky s tabIndex -1 (např. skryté pole proti
 * robotům nebo nadpis, na který se fokus přesouvá jen programově) se nepočítají.
 */
const FOCUSABLE = [
  'button:not([disabled]):not([tabindex="-1"])',
  'a[href]:not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
].join(', ')

/**
 * Otevřené modální dialogy od nejstaršího po nejnovější. Klávesy obsluhuje jen ten nahoře — když je
 * otevřený potvrzovací dialog nastavení a přes něj dialog zpětné vazby, Tab a Escape patří jen tomu
 * hornímu (feat-024, nález z review). Sdílí se mezi všemi dialogy, proto je na úrovni modulu.
 */
const openModals: symbol[] = []

/**
 * Společné chování modálních dialogů (ConfirmOverlay, FeedbackDialog): po otevření přesune fokus
 * dovnitř, Tab a Shift+Tab cyklí jen mezi prvky dialogu, Escape dialog zavře a po zavření se fokus
 * vrátí tam, kde byl. Klávesy se zachytávají na úrovni dokumentu, takže fungují i po kliknutí na
 * závoj kolem karty (fokus pak spadne na `body`). Když je otevřených dialogů víc, reaguje jen
 * nejnovější.
 *
 * @param containerRef - Karta dialogu; prvky pro Tab se hledají uvnitř ní při každém stisku
 * @param onClose - Volá se při Escape (vždy nejnovější verze callbacku)
 */
export function useModalFocus(containerRef: RefObject<HTMLElement | null>, onClose: () => void): void {
  // Posluchač se registruje jen jednou; aktuální onClose drží ref
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  useEffect(() => {
    const id = Symbol('modal')
    openModals.push(id)
    const previouslyFocused = document.activeElement
    containerRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      // Dialog pod jiným dialogem klávesy nechá tomu hornímu
      if (openModals[openModals.length - 1] !== id) return
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
        return
      }
      const container = containerRef.current
      if (e.key !== 'Tab' || !container) return
      // Seznam se čte při každém Tabu — obsah dialogu se může měnit (formulář ↔ poděkování)
      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const index = focusable.indexOf(document.activeElement as HTMLElement)
      if (index === -1) {
        // Fokus je mimo seznam (na závoji, na body nebo na nadpisu) — Tab ho vrátí do dialogu
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      } else if (e.shiftKey && index === 0) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && index === focusable.length - 1) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      openModals.splice(openModals.indexOf(id), 1)
      // Fokus zpět jen na prvek, který v dokumentu ještě je (tlačítko mohlo mezitím zmizet)
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) previouslyFocused.focus()
    }
    // containerRef je stabilní ref objekt; efekt má běžet jen při otevření a zavření dialogu
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
