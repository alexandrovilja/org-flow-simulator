interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
  format?: (value: number) => string
}

export function Slider({ label, value, min, max, step, onChange, format }: SliderProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--ink-2)', fontWeight: 500 }}>{label}</span>
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
