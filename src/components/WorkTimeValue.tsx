import { Fragment } from 'react'
import { formatTime, timeParts } from '@/lib/formatTime'
import { useTimeNotation } from '@/hooks/useTimeNotation'
import { ValueUnit } from '@/components/ValueUnit'
import styles from './WorkTimeValue.module.css'

/** Props komponenty `WorkTimeValue`. */
interface WorkTimeValueProps {
  /** Čas v pracovních dnech (1 simulační sekunda = 1 pracovní den). */
  days: number
}

/**
 * Hodnota Total Time v pracovních týdnech a dnech (feat-027): číslo velké, slova malá, např. **37** weeks
 * **2.9** days. Plná slova se píšou vždy; jen když se nevejdou do dlaždice, ukáže se zkratka `37w 2.9d`.
 * Každá dlaždice se rozhoduje podle svého místa (hook `useTimeNotation`). Text je jedním řetězcem včetně
 * mezer, plný text je i v `aria-label`, aby ho přečetly čtečky obrazovky a nezáleželo na zkratce.
 *
 * @param props - Čas v pracovních dnech
 * @returns Blokový prvek s hodnotou, který patří do dlaždice (`StatTile`, dlaždice v Compare)
 */
export function WorkTimeValue({ days }: WorkTimeValueProps) {
  const fullText = formatTime(days)
  const [ref, notation] = useTimeNotation<HTMLSpanElement>(fullText)
  const parts = timeParts(days, notation)

  return (
    // role="img" + aria-label: čtečka přečte celý čas jedním názvem, bez ohledu na to, jestli jsou vidět slova nebo zkratky
    <span ref={ref} className={styles.root} data-testid="work-time-value" role="img" aria-label={fullText}>
      <span className={styles.parts}>
        {parts.map((part, index) => (
          <Fragment key={part.unit.trim()}>
            {/* Mezera mezi týdny a dny je v textu (kvůli čtečkám a testům), ve flexu se nevykreslí */}
            {index > 0 && ' '}
            <span>
              <span>{part.value}</span>
              <ValueUnit tight={notation === 'short'}>{part.unit}</ValueUnit>
            </span>
          </Fragment>
        ))}
      </span>
    </span>
  )
}
