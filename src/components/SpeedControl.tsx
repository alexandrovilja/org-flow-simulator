import { Button } from '@/components/Button'
import { SegmentedControl } from '@/components/SegmentedControl'

/** Rychlosti simulace, které nabízí přepínač (násobek reálného času). */
const SPEEDS = [0.5, 1, 2, 10]

/** Props ovládání běhu v horní liště Advanced a Cash Flow. */
interface SpeedControlProps {
  /** Aktuální rychlost simulace (jedna z SPEEDS). */
  speed: number
  /** Simulace je pozastavená (nebo ještě nezačala). */
  paused: boolean
  /** Simulace už aspoň jednou běžela — rozlišuje „Start“ a „Resume“. */
  hasStarted: boolean
  /** Celý backlog je zpracovaný — tlačítko ukáže „✓ Done“ a vypne se. */
  finished: boolean
  /** Změna rychlosti. */
  onSpeedChange: (speed: number) => void
  /** Start / Pause / Resume. */
  onTogglePause: () => void
  /** Obnoví výchozí backlog a vyčistí In progress a Done. */
  onReset: () => void
  /** Optional data-tutorial-target value for the run/pause button (used by tutorial overlay). */
  runButtonTarget?: string
}

/**
 * Ovládání běhu simulace v horní liště (feat-021): tlačítko Run / Pause / Done, přepínač rychlosti
 * a Reset backlog, vždy v tomto pořadí. Rychlost používá stejný SegmentedControl jako zbytek
 * aplikace (Příklad 8), tlačítka sdílený Button.
 *
 * @param props - Stav běhu (`speed`, `paused`, `hasStarted`, `finished`), callbacky a cíl tutoriálu
 * @returns Skupina ovládacích prvků pro antracitovou lištu
 */
export function SpeedControl({ speed, paused, hasStarted, finished, onSpeedChange, onTogglePause, onReset, runButtonTarget }: SpeedControlProps) {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-8)', alignItems: 'center' }}>
      {finished ? (
        <Button variant="done" disabled data-tutorial-target={runButtonTarget}>✓ Done</Button>
      ) : paused ? (
        // Před prvním spuštěním „Start“ s pulzem, po pauze „Resume“
        <Button variant="primary" pulse={!hasStarted} onClick={onTogglePause} data-tutorial-target={runButtonTarget}>
          {hasStarted ? '▶ Resume' : '▶ Start'}
        </Button>
      ) : (
        <Button variant="running" onClick={onTogglePause} data-tutorial-target={runButtonTarget}>❙❙ Pause</Button>
      )}
      <SegmentedControl
        tone="bar"
        options={SPEEDS.map(s => ({ value: String(s), label: `${s}×` }))}
        value={String(speed)}
        onChange={v => onSpeedChange(Number(v))}
      />
      <Button onBar onClick={onReset} title="Restore the initial backlog and clear in-progress / done">↺ Reset backlog</Button>
    </div>
  )
}
