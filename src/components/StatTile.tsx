interface StatTileProps {
  label: string
  value: string
  unit?: string
  hint?: string
  tooltip?: string
}

export function StatTile({ label, value, unit, hint, tooltip }: StatTileProps) {
  return (
    <div title={tooltip} style={{
      background: 'var(--panel)',
      border: '1px solid var(--line)',
      borderRadius: 6,
      padding: '8px 10px',
      display: 'flex', flexDirection: 'column', gap: 2,
      minWidth: 0,
      cursor: tooltip ? 'help' : 'default',
    }}>
      <span style={{
        fontSize: 10, color: 'var(--ink-3)',
        textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 500,
        display: 'inline-flex', alignItems: 'center', gap: 4,
      }}>
        {label}
        {tooltip && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 11, height: 11, borderRadius: '50%',
            background: 'var(--line)', color: 'var(--ink-3)',
            fontSize: 8, fontWeight: 700,
          }}>?</span>
        )}
      </span>
      <span className="mono" style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.1 }}>
        {value}
        <span style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 2, fontWeight: 500 }}>{unit}</span>
      </span>
      {hint && <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{hint}</span>}
    </div>
  )
}
