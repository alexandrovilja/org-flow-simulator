import { useState } from 'react'

/** One choice of a segmented control */
interface SegmentedOption<T extends string> {
  /** Value passed to onChange when this option is picked */
  value: T
  /** Text shown on the segment */
  label: string
}

/** Props for a two- or three-option segmented control */
interface SegmentedControlProps<T extends string> {
  /** The two or three options to display */
  options: [SegmentedOption<T>, SegmentedOption<T>] | [SegmentedOption<T>, SegmentedOption<T>, SegmentedOption<T>]
  /** Currently active value */
  value: T
  /** Called when the user picks a different option */
  onChange: (value: T) => void
  /** Tooltip text shown on hover as a floating panel */
  hint?: string
  /** When true, the control is dimmed and clicks are ignored (e.g. setting locked until Reset) */
  disabled?: boolean
}

/**
 * iOS-style segmented control with a sliding white pill.
 * All options are always visible; the active one gets a raised pill background.
 * Animates smoothly on toggle. Shows an optional floating hint tooltip on hover.
 *
 * @param options - two or three choices, each with a value and display label
 * @param value   - the currently selected value
 * @param onChange - callback fired with the newly selected value
 * @param hint    - optional description shown as a floating tooltip on hover
 * @param disabled - optional; dims the control and ignores clicks
 */
export function SegmentedControl<T extends string>({ options, value, onChange, hint, disabled = false }: SegmentedControlProps<T>) {
  // Unknown value falls back to the first segment (previously: anything but the first = second)
  const activeIndex = Math.max(0, options.findIndex(o => o.value === value))
  const count = options.length
  const [visible, setVisible] = useState(false)

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => hint && setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {/* Track — grid ensures all segments are always exactly equal width */}
      <div
        role="group"
        aria-label={options.map(o => o.label).join(' / ')}
        style={{
          position: 'relative',
          display: 'inline-grid',
          gridTemplateColumns: `repeat(${count}, 1fr)`,
          background: 'var(--bg)',
          borderRadius: 7,
          padding: 2,
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {/* Sliding pill — sits behind the labels, moves via left transition */}
        <div style={{
          position: 'absolute',
          top: 2,
          bottom: 2,
          // Each segment is exactly 1/count of the inner width (track minus 2px padding on both sides);
          // the pill shifts by one segment width per index. For two options this equals the former
          // 50 % layout (left 2px / 50 %, width 50 % - 2px).
          left: `calc(2px + ${activeIndex} * (100% - 4px) / ${count})`,
          width: `calc((100% - 4px) / ${count})`,
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
            disabled={disabled}
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
              cursor: disabled ? 'not-allowed' : 'pointer',
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
          // Long hints wrap instead of running past the 320px settings sidebar (max-content keeps
          // short hints on one line; 260px keeps the tooltip inside the sidebar)
          width: 'max-content',
          maxWidth: 260,
          whiteSpace: 'normal',
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
