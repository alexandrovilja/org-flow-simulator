import { WORKING_DAYS_PER_WEEK } from '@/simulation/engine'
import type { TimeNotation, TimePart } from '@/types/workTime'

/**
 * Rozloží čas v pracovních dnech na části „týdny“ a „dny“ připravené k zobrazení.
 *
 * Dny se ZKRACUJÍ na desetinu (floor), nikdy nezaokrouhlují — čítač tak nikdy neukáže hodnotu, které
 * ještě nebylo dosaženo (4.96 je `4.9 days`, ne `5.0 days`). Počítá se v celých desetinách dne a týdny se
 * odvozují z nich, aby zbytek po odečtení týdnů nevyšel o desetinu nižší kvůli plovoucí desetinné čárce.
 * Část s týdny se vynechá při 0 týdnech, část se dny je vždy (i `0.0 days`), aby čítač neměnil tvar.
 *
 * @param days - Čas v pracovních dnech (1 simulační sekunda = 1 pracovní den)
 * @param notation - `full` pro plná slova, `short` pro zkratky „w“ a „d“
 * @returns Jedna nebo dvě části (týdny, dny) s číslem a jednotkou
 */
export function timeParts(days: number, notation: TimeNotation): TimePart[] {
  // Malá přídavná konstanta vyrovná chybu plovoucí čárky: 6.3 × 10 dává 62.99999999999999, ale má být 63
  const tenthsOfDay = Math.floor(Math.max(0, days) * 10 + 1e-6)
  const tenthsPerWeek = WORKING_DAYS_PER_WEEK * 10
  const weeks = Math.floor(tenthsOfDay / tenthsPerWeek)
  const restTenths = tenthsOfDay - weeks * tenthsPerWeek
  // Celé dny a desetina dne ze zbytku (zbytek je vždy 0–49 desetin, tedy nikdy „5.0“)
  const rest = `${Math.floor(restTenths / 10)}.${restTenths % 10}`

  const full = notation === 'full'
  const dayPart: TimePart = { value: rest, unit: full ? ' days' : 'd' }
  if (weeks === 0) return [dayPart]
  return [{ value: String(weeks), unit: full ? (weeks === 1 ? ' week' : ' weeks') : 'w' }, dayPart]
}

/**
 * Spojí části času do jednoho řetězce („37 weeks 2.9 days“, „37w 2.9d“); části se oddělují mezerou.
 *
 * @param parts - Části času z `timeParts`
 * @returns Text času
 */
function joinParts(parts: TimePart[]): string {
  return parts.map(part => `${part.value}${part.unit}`).join(' ')
}

/**
 * Formátuje celkový čas simulace (Total Time) v pracovních týdnech a dnech, např. `2 weeks 4.3 days`.
 * `week` je v jednotném čísle jen pro přesně jeden týden, `days` je vždy množné. Dny se zkracují, ne zaokrouhlují.
 *
 * @param days - Uplynulý čas v pracovních dnech (nezáporné číslo)
 * @returns Čas ve formátu „2 weeks 4.3 days“, „1 week 0.0 days“ nebo „4.3 days“ (pod týden)
 */
export function formatTime(days: number): string {
  return joinParts(timeParts(days, 'full'))
}

/**
 * Zkrácený zápis času pro dlaždice, kam se plná slova nevejdou: `2w 4.3d` (pod týden jen `4.3d`).
 * Má stejná čísla jako `formatTime`, jen slova nahrazuje zkratkami.
 *
 * @param days - Uplynulý čas v pracovních dnech (nezáporné číslo)
 * @returns Čas ve formátu „2w 4.3d“
 */
export function formatTimeShort(days: number): string {
  return joinParts(timeParts(days, 'short'))
}

/**
 * Číslo doby trvání v pracovních dnech s jednou desetinou bez jednotky, např. `9.1`. Je to jediné místo s pravidlem
 * zaokrouhlení dob trvání (stejně jako dřívější `toFixed(1)`: doby trvání se oproti sekundám nemění, mění se jen
 * jednotka), pro dlaždice, které si jednotku (`days`, `man-days`) kreslí zvlášť malým písmem.
 *
 * @param days - Doba trvání v pracovních dnech
 * @returns Číslo ve formátu „9.1“
 */
export function formatDaysValue(days: number): string {
  return days.toFixed(1)
}

/**
 * Formátuje dobu trvání v prostých pracovních dnech s jednou desetinou, např. `9.1 days` (lead time v Done
 * listu). `days` je vždy ve množném čísle (`1.0 days`).
 *
 * @param days - Doba trvání v pracovních dnech
 * @returns Text ve formátu „9.1 days“
 */
export function formatDays(days: number): string {
  return `${formatDaysValue(days)} days`
}
