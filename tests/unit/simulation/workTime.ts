import { screen } from '@testing-library/react'

// Pomocník testů feat-027 (čas simulace v pracovních dnech): čtení a rozpoznání zápisu času z obrazovky.
// Čas se ukazuje jako „2 weeks 4.3 days“ (dřív „MM:SS.d“), proto testy, které čtou čítač Total Time jako
// hodinky (rozdíl před/po pauze, Resetu, rychlost), potřebují společný převod zpět na dny.

/** Počet pracovních dnů v týdnu; stejná hodnota jako `WORKING_DAYS_PER_WEEK` v enginu (feat-027). */
const DAYS_PER_WEEK = 5

/**
 * Zdroj regulárního výrazu pro čas v plných slovech: `4.3 days`, `1 week 0.0 days`, `37 weeks 2.9 days`.
 * Určený ke skládání do větších výrazů, např. `new RegExp(`^@ ${WORK_TIME_PATTERN}$`)`.
 */
export const WORK_TIME_PATTERN = String.raw`(?:\d+ weeks? )?\d+\.\d days`

/**
 * Převede zobrazený čas zpět na pracovní dny.
 *
 * @param text - Čas v plných slovech (`2 weeks 4.3 days`) nebo ve zkratce (`2w 4.3d`)
 * @returns Počet pracovních dnů (týden = 5 dnů)
 * @throws Error, když text není zápis času podle feat-027
 */
export function parseWorkDays(text: string): number {
  const match = /^(?:(\d+)\s*(?:weeks?|w)\s+)?(\d+)\.(\d)\s*(?:days?|d)$/.exec(text.trim())
  if (!match) throw new Error(`Not a working-time text: "${text}"`)
  const [, weeks, wholeDays, tenths] = match
  return Number(weeks ?? 0) * DAYS_PER_WEEK + Number(wholeDays) + Number(tenths) / 10
}

/**
 * Hodnoty Total Time na obrazovce (komponenta `WorkTimeValue`, `data-testid="work-time-value"`).
 * V Compare je před prvním spuštěním Total Time „—“, takže seznam je prázdný.
 *
 * @returns Prvky s časem v pořadí, jak jsou v dokumentu (v Compare první je tým A)
 */
export function workTimeValues(): HTMLElement[] {
  return screen.queryAllByTestId('work-time-value')
}

/**
 * Simulační čas z prvního čítače Total Time na obrazovce (v Compare tým A, jinde Total Time).
 *
 * @returns Čas v pracovních dnech
 */
export function simDays(): number {
  const [first] = screen.getAllByTestId('work-time-value')
  return parseWorkDays(first.textContent ?? '')
}
