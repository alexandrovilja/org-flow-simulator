const SPEEDS = [0.5, 1, 2, 10]

interface SpeedControlProps {
  speed: number
  paused: boolean
  hasStarted: boolean
  onSpeedChange: (speed: number) => void
  onTogglePause: () => void
  onReset: () => void
}

export function SpeedControl({ speed, paused, hasStarted, onSpeedChange, onTogglePause, onReset }: SpeedControlProps) {
  const label = !hasStarted ? '▶ Start' : (paused ? '▶ Resume' : '❙❙ Pause')
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <button onClick={onTogglePause} style={{
        background: paused ? 'var(--accent)' : 'var(--ink)',
        color: 'white', border: 'none', borderRadius: 4,
        padding: '6px 10px', fontWeight: 600, fontSize: 12,
        display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
      }}>
        {label}
      </button>
      <div style={{ display: 'flex', border: '1px solid var(--line)', borderRadius: 4, overflow: 'hidden' }}>
        {SPEEDS.map(s => (
          <button key={s} onClick={() => onSpeedChange(s)} style={{
            background: speed === s ? 'var(--ink)' : 'var(--panel)',
            color: speed === s ? 'white' : 'var(--ink-2)',
            border: 'none',
            padding: '6px 10px',
            fontSize: 11, fontWeight: 600,
            borderRight: s !== SPEEDS[SPEEDS.length - 1] ? '1px solid var(--line)' : 'none',
            cursor: 'pointer',
          }} className="mono">
            {s}×
          </button>
        ))}
      </div>
      <button onClick={onReset} title="Restore the initial backlog and clear in-progress / done" style={{
        background: 'var(--panel)',
        border: '1px solid var(--line)', borderRadius: 4,
        padding: '6px 10px', fontSize: 11, color: 'var(--ink-2)', cursor: 'pointer',
      }}>↺ Reset backlog</button>
    </div>
  )
}
