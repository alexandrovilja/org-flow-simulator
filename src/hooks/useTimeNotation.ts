import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { chooseTimeNotation } from '@/lib/chooseTimeNotation'
import type { TimeNotation } from '@/types/workTime'

/**
 * Zjistí, jestli se čas v plných slovech („37 weeks 2.9 days“) vejde do prvku, a podle toho vybere zápis
 * (feat-027). Prvek se při měření vykreslí vždy v plném zápisu: jeho `scrollWidth` je pak šířka, kterou
 * slova potřebují, a `clientWidth` místo, které má. O zápisu rozhodne čistá funkce `chooseTimeNotation`.
 *
 * Měří se při změně DÉLKY textu a při každé změně velikosti prvku (`ResizeObserver`), takže se po zvětšení
 * okna vrátí plná slova. Šířka textu v neproporcionálním písmu (JetBrains Mono, tabulkové číslice) závisí jen
 * na počtu znaků, takže další desetina dne za běhu (až 60× za sekundu) žádné měření nepotřebuje.
 * Měření probíhá ve `useLayoutEffect`,
 * tedy před vykreslením na obrazovku — uživatel nevidí přeblikávání mezi zápisy. V prostředí bez
 * `ResizeObserver` a bez rozměrů (testy v jsdom) vychází vždy plný zápis.
 *
 * Prvek musí být blokový (zabírá šířku dlaždice) a nesmí se zalamovat (`white-space: nowrap`),
 * jinak by se přetečení nedalo změřit.
 *
 * @param fullText - Čas v plných slovech; změna jeho délky spustí nové měření
 * @returns Dvojice `[ref, notation]`: ref patří na měřený prvek, `notation` je zápis, který se má ukázat
 */
export function useTimeNotation<T extends HTMLElement>(fullText: string): [RefObject<T | null>, TimeNotation] {
  const ref = useRef<T>(null)
  const [notation, setNotation] = useState<TimeNotation>('full')
  // Dokud true, vykresluje se plný zápis, aby šlo změřit, kolik místa potřebuje
  const [measuring, setMeasuring] = useState(true)

  // Delší nebo kratší text (např. přibyl druhý týden) potřebuje jiné místo, takže se plná slova znovu změří.
  // Text stejné délky má stejnou šířku, proto se při každé další desetině dne znovu neměří.
  const textLength = fullText.length
  useLayoutEffect(() => {
    setMeasuring(true)
  }, [textLength])

  // Vlastní měření: plná slova jsou právě vykreslená, porovnáme potřebnou a dostupnou šířku
  useLayoutEffect(() => {
    const el = ref.current
    if (!measuring || !el) return
    setNotation(chooseTimeNotation(el.scrollWidth, el.clientWidth))
    setMeasuring(false)
  }, [measuring])

  // Změna velikosti prvku (okno, počet sloupců) spustí nové měření
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => setMeasuring(true))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return [ref, measuring ? 'full' : notation]
}
