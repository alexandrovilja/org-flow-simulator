import { useCallback, useRef, useState, type RefObject } from 'react'
import type { SimSpeed } from '@/types/simulation'

/** Rychlost běhu jednoho módu: stav pro UI, ref pro smyčku a funkce, která mění obojí. */
interface SimSpeedControl {
  /** Aktuální rychlost pro vykreslení přepínače (mění se s překreslením). */
  speed: SimSpeed
  /** Ref se stejnou rychlostí pro smyčku `requestAnimationFrame`, která běží mimo React. */
  speedRef: RefObject<SimSpeed>
  /** Nastaví rychlost: ref hned, stav pro přepínač při dalším překreslení. */
  setSpeed: (next: SimSpeed) => void
}

/**
 * Drží rychlost běhu simulace jednoho módu (Compare, Advanced i Cash Flow mají každý svou).
 * Smyčka `requestAnimationFrame` v Simulatoru čte rychlost z refu, protože její callback je
 * vytvořený jednou a stav by viděl jen v hodnotě z doby vzniku. Ref se proto přepisuje přímo
 * v `setSpeed`, ne až po překreslení v `useEffect`: nová rychlost pak platí už v dalším snímku
 * a ve všech třech módech stejně.
 *
 * @returns Rychlost (výchozí 1×), ref pro smyčku a stabilní funkci `setSpeed`
 */
export function useSimSpeed(): SimSpeedControl {
  const [speed, setSpeedState] = useState<SimSpeed>(1)
  const speedRef = useRef<SimSpeed>(1)

  // Stabilní identita, aby ji šlo předat do přepínače i do závislostí hooků bez zbytečných překreslení
  const setSpeed = useCallback((next: SimSpeed) => {
    speedRef.current = next
    setSpeedState(next)
  }, [])

  return { speed, speedRef, setSpeed }
}
