import { useState } from 'react'

/** Props for a two-option segmented control */
interface SegmentedControlProps<T extends string> {
  /** The two options to display */
  options: [{ value: T; label: string }, { value: T; label: string }]
  /** Currently active value */
  value: T
  /** Called when the user picks a different option */
  onChange: (value: T) => void
  /** Tooltip text shown on hover as a floating panel */
  hint?: string
}

/**
 * iOS-style segmented control with a sliding white pill.
 * Both options are always visible; the active one gets a raised pill background.
 * Animates smoothly on toggle. Shows an optional floating hint tooltip on hover.
 *
 * @param options - exactly two choices, each with a value and display label
 * @param value   - the currently selected value
 * @param onChange - callback fired with the newly selected value
 * @param hint    - optional description shown as a floating tooltip on hover
 */
export function SegmentedControl<T extends string>({ options, value, onChange, hint }: SegmentedControlProps<T>) {
  const activeIndex = options[0].value === value ? 0 : 1
  const [visible, setVisible] = useState(false)

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => hint && setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {/* Track — grid ensures both segments are always exactly equal width */}
      <div
        role="group"
        aria-label={options.map(o => o.label).join(' / ')}
        style={{
          position: 'relative',
          display: 'inline-grid',
          gridTemplateColumns: '1fr 1fr',
          background: 'var(--bg)',
          borderRadius: 7,
          padding: 2,
        }}
      >
        {/* Sliding pill — sits behind the labels, moves via left transition */}
        <div style={{
          position: 'absolute',
          top: 2,
          bottom: 2,
          // Each segment is exactly 50% of the grid; pill shifts one segment width on toggle
          left: activeIndex === 0 ? 2 : 'calc(50%)',
          width: 'calc(50% - 2px)',
          borderRadius: 5,
          background: 'var(--panel)',
          boxShadow: '0 1px 2px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.06)',
          transition: 'left 0.2s ease',
          pointerEvents: 'none',
        }} />

        {options.map((opt, i) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              position: 'relative',
              zIndex: 1,
              padding: '4px 14px',
              fontSize: 10,
              fontFamily: 'inherit',
              fontWeight: 500,
              letterSpacing: 0.2,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              borderRadius: 5,
              color: i === activeIndex ? 'var(--ink)' : 'var(--ink-3)',
              transition: 'color 0.15s ease',
              whiteSpace: 'nowrap',
              // Explicit flex centering so text is centered both axes
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Floating hint tooltip — appears below the control on hover */}
      {hint && visible && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          zIndex: 100,
          background: 'var(--ink)',
          color: 'var(--panel)',
          fontSize: 10,
          lineHeight: 1.5,
          padding: '6px 10px',
          borderRadius: 6,
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          pointerEvents: 'none',
        }}>
          {hint}
          {/* Small arrow pointing up toward the control */}
          <div style={{
            position: 'absolute',
            top: -4,
            left: 12,
            width: 8,
            height: 8,
            background: 'var(--ink)',
            transform: 'rotate(45deg)',
            borderRadius: 1,
          }} />
        </div>
      )}
    </div>
  )
}
