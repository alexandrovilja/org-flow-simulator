import { useCallback, useEffect, useRef } from 'react'

/**
 * Žádost o posun prvku s klíčem `key` do viditelné části. Každá nová žádost musí být nový objekt (třeba s pořadovým
 * číslem), aby se posunulo i při opakovaném kliku na stejný prvek; stejný objekt mezi překresleními nic nespustí.
 */
export interface ScrollRequest<K> {
  /** Klíč prvku, který se má ukázat (např. číslo featury). */
  key: K
}

/**
 * Posune prvek seznamu do viditelné části jeho rolovacího kontejneru, když přijde nová žádost (feat-029: skok na
 * featuru z panelu organizace). Komponenta tak sama nesahá na DOM: jen registruje prvky přes vrácenou funkci
 * a předává žádost. Posun proběhne až po vykreslení, takže funguje i pro prvek, který se teprve objevil (třeba po
 * vypnutí filtru).
 *
 * @param request - Poslední žádost o posun, nebo `null`, když se nic posouvat nemá
 * @returns Stabilní funkce `(key, element)` pro registraci prvků; patří do ref callbacku prvku (při odpojení dostane `null`)
 */
export function useScrollIntoView<K>(request: ScrollRequest<K> | null): (key: K, element: HTMLElement | null) => void {
  // Prvky podle klíče; ref, protože registrace nesmí spouštět překreslení
  const elements = useRef(new Map<K, HTMLElement>())

  const register = useCallback((key: K, element: HTMLElement | null) => {
    if (element) elements.current.set(key, element)
    else elements.current.delete(key)
  }, [])

  useEffect(() => {
    // „nearest“ posune jen nejbližší rolovací kontejner a jen tolik, aby byl prvek celý vidět
    if (request) elements.current.get(request.key)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [request])

  return register
}
