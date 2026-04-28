interface PanelHeaderProps {
  title: string
  count: number
  hint?: string
}

export function PanelHeader({ title, count, hint }: PanelHeaderProps) {
  return (
    <div style={{
      padding: '12px 16px 8px',
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      borderBottom: '1px solid transparent',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--ink-2)' }}>
          {title}
        </h3>
        <span className="mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>{count}</span>
      </div>
      {hint && <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>{hint}</span>}
    </div>
  )
}
