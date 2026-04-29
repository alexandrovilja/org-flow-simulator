/**
 * Formátuje simulační čas v sekundách do čitelného formátu MM:SS.d.
 * Příklady: 0 → "00:00.0", 65.3 → "01:05.3", 125.99 → "02:05.9"
 *
 * Desetiny jsou záměrně zkráceny (floor), ne zaokrouhleny — takový čítač
 * působí přirozeněji a nikdy neukáže hodnotu, které ještě nebylo dosaženo.
 *
 * @param simSec - Uplynulý simulační čas v sekundách (nezáporné číslo)
 * @returns Čas ve formátu "MM:SS.d" (minuty, sekundy, desetiny sekundy)
 */
export function formatTime(simSec: number): string {
  // Převedeme sekundy na desetiny a odvozujeme zbylé jednotky
  const totalDeci = Math.floor(simSec * 10)
  const deci = totalDeci % 10
  const totalSec = Math.floor(simSec)
  const sec = totalSec % 60
  const min = Math.floor(totalSec / 60)

  // padStart(2, '0') zajistí formát "01" místo "1" pro minuty a sekundy
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${deci}`
}
