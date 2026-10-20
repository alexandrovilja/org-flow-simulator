import { useLayoutEffect, useRef, useState, type RefObject } from 'react'

/**
 * Zjistí, jestli je text prvku zkrácený výpustkou (`text-overflow: ellipsis`), tedy jestli je obsah
 * širší než viditelná plocha prvku. Komponenty podle toho nastaví `title` s plným textem jen tam, kde
 * se opravdu zkrátil; nezkrácený text tooltip nepotřebuje a nebyl by jen zdvojením toho, co je vidět.
 *
 * Měří se při změně textu a při každé změně velikosti prvku (`ResizeObserver`), takže se stav
 * přepočítá i po změně šířky okna nebo počtu sloupců karet. V prostředí bez `ResizeObserver`
 * (testy v jsdom) se měří jen při změně textu.
 *
 * @param text - Zobrazovaný text; změna spustí nové měření
 * @returns Dvojice `[ref, truncated]`: ref patří na měřený prvek, `truncated` je true při zkrácení
 */
export function useIsTruncated<T extends HTMLElement>(text: string): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null)
  const [truncated, setTruncated] = useState(false)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // Zkrácený text je delší než viditelná plocha; 1 px tolerance vyrovná zaokrouhlení rozměrů
    const measure = () => setTruncated(el.scrollWidth > el.clientWidth + 1)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [text])

  return [ref, truncated]
}
