interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  format?: (value: number) => string
  /** Nápověda zobrazená jako odznak ⓘ vedle popisku — při hoveru jako title. */
  tooltip?: string
}

export function Slider({ label, value, min, max, step, onChange, format, tooltip }: SliderProps) {
  return (
    <div title={tooltip} style={{ display: 'flex', flexDirection: 'column', gap: 4, cursor: tooltip ? 'help' : undefined }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--ink-2)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {label}
          {tooltip && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 11, height: 11, borderRadius: '50%',
              background: 'var(--line)', color: 'var(--ink-3)',
              fontSize: 8, fontWeight: 700, flexShrink: 0,
            }}>?</span>
          )}
        </span>
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink)', fontWeight: 600 }}>
          {format ? format(value) : value}
        </span>
      </div>
      <input
        type="range"
        value={value}
        min={min} max={max} step={step}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ accentColor: 'var(--ink)', width: '100%' }}
      />
    </div>
  )
}
