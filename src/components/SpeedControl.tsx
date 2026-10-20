import { Button } from '@/components/Button'
import { SegmentedControl } from '@/components/SegmentedControl'
import type { SimSpeed } from '@/types/simulation'

/** Rychlosti simulace, které nabízí přepínač, v pořadí zleva doprava. Jediné místo, kde jsou vyjmenované. */
const SPEEDS: readonly SimSpeed[] = [0.5, 1, 10]

/** Props ovládání běhu v horní liště (ve všech třech módech stejné, feat-021 Příklad 14). */
interface SpeedControlProps {
  /** Aktuální rychlost simulace (jedna z SPEEDS). */
  speed: SimSpeed
  /** Simulace je pozastavená (nebo ještě nezačala). */
  paused: boolean
  /** Simulace už aspoň jednou běžela — tlačítko Run přestane pulzovat. */
  hasStarted: boolean
  /** Celý backlog je zpracovaný — tlačítko ukáže „✓ Done“ a vypne se. */
  finished: boolean
  /** Změna rychlosti. */
  onSpeedChange: (speed: SimSpeed) => void
  /** Run / Pause. */
  onTogglePause: () => void
  /** Obnoví výchozí stav a vyčistí In progress a Done (co přesně, určuje mód). */
  onReset: () => void
  /** Optional data-tutorial-target value for the run/pause button (used by tutorial overlay). */
  runButtonTarget?: string
  /** Znovu spustí tutoriál módu. Bez něj se tlačítko „?“ nevykreslí (Cash Flow tutoriál nemá). */
  onRestartTutorial?: () => void
  /** Tooltip tlačítka Reset; bez něj tlačítko tooltip nemá. */
  resetTitle?: string
}

/**
 * Ovládání běhu simulace v horní liště (feat-021): volitelné „?“ (tutoriál), Reset, přepínač rychlosti
 * a tlačítko Run / Pause / Done, vždy v tomto pořadí. Používají ho všechny tři módy, aby se ovládání
 * nikde nelišilo. Rychlost používá stejný SegmentedControl jako zbytek aplikace (Příklad 8),
 * tlačítka sdílený Button.
 *
 * @param props - Stav běhu (`speed`, `paused`, `hasStarted`, `finished`), callbacky a cíl tutoriálu
 * @returns Ovládací prvky jako fragment: řadí je rodič (kontejner `controls` v liště, nebo obal
 *   s cílem tutoriálu), takže komponenta nemá vlastní flex obal
 */
export function SpeedControl({
  speed, paused, hasStarted, finished, onSpeedChange, onTogglePause, onReset, runButtonTarget, onRestartTutorial, resetTitle,
}: SpeedControlProps) {
  return (
    <>
      {onRestartTutorial && (
        <Button onBar iconOnly onClick={onRestartTutorial} title="Restart tutorial" aria-label="Restart tutorial">?</Button>
      )}
      <Button onBar onClick={onReset} title={resetTitle}>↺ Reset</Button>
      <SegmentedControl
        tone="bar"
        options={SPEEDS.map(s => ({ value: String(s), label: `${s}×` }))}
        value={String(speed)}
        onChange={v => {
          // Přepínač vrací text segmentu; zpět na číslo ho převedeme přes seznam nabízených rychlostí
          const next = SPEEDS.find(s => String(s) === v)
          if (next !== undefined) onSpeedChange(next)
        }}
      />
      {finished ? (
        <Button variant="done" disabled data-tutorial-target={runButtonTarget}>✓ Done</Button>
      ) : paused ? (
        // „Run“ i po pauze (bez „Resume“); pulzuje jen před prvním spuštěním
        <Button variant="primary" pulse={!hasStarted} onClick={onTogglePause} data-tutorial-target={runButtonTarget}>▶ Run</Button>
      ) : (
        <Button variant="running" onClick={onTogglePause} data-tutorial-target={runButtonTarget}>❙❙ Pause</Button>
      )}
    </>
  )
}
