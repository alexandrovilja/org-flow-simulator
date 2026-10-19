import { useState } from 'react'
import styles from './SegmentedControl.module.css'

/** One choice of a segmented control */
interface SegmentedOption<T extends string> {
  /** Value passed to onChange when this option is picked */
  value: T
  /** Text shown on the segment */
  label: string
  /** Optional native tooltip for this one segment (e.g. what a team type means) */
  title?: string
}

/** Props for a segmented control with two to four options */
interface SegmentedControlProps<T extends string> {
  /** The two to four options to display, left to right */
  options: SegmentedOption<T>[]
  /** Currently active value */
  value: T
  /** Called when the user picks a different option */
  onChange: (value: T) => void
  /** Tooltip text shown on hover as a floating panel */
  hint?: string
  /** When true, the control is dimmed and clicks are ignored (e.g. setting locked until Reset) */
  disabled?: boolean
  /** `bar` = the control sits on the anthracite top bar and uses the bar's colors */
  tone?: 'default' | 'bar'
}

/**
 * The one segmented control of the Org Flow design system (feat-021): team type, unit preset,
 * revenue curve and simulation speed all use it, so they look and behave the same.
 * Square segments in the mono `label` style inside a `line-control` frame; the active segment is a
 * solid `ink` fill. Each segment is a button with `aria-pressed`, the whole control a labelled group.
 *
 * @param options - two to four choices, each with a value, display label and optional title
 * @param value   - the currently selected value
 * @param onChange - callback fired with the newly selected value
 * @param hint    - optional description shown as a floating tooltip on hover
 * @param disabled - optional; dims the control and ignores clicks
 * @param tone    - optional; `bar` for the dark top bar
 */
export function SegmentedControl<T extends string>({ options, value, onChange, hint, disabled = false, tone = 'default' }: SegmentedControlProps<T>) {
  // Unknown value falls back to the first segment, so exactly one segment is always pressed
  const activeIndex = Math.max(0, options.findIndex(o => o.value === value))
  const [visible, setVisible] = useState(false)

  return (
    <div
      className={[styles.root, tone === 'bar' && styles.bar].filter(Boolean).join(' ')}
      onMouseEnter={() => hint && setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <div
        role="group"
        aria-label={options.map(o => o.label).join(' / ')}
        className={[styles.track, disabled && styles.disabled].filter(Boolean).join(' ')}
      >
        {options.map((opt, i) => (
          <button
            key={opt.value}
            type="button"
            className={styles.segment}
            aria-pressed={i === activeIndex}
            title={opt.title}
            onClick={() => onChange(opt.value)}
            disabled={disabled}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Floating hint below the control. Width and wrapping stay inline: long hints must wrap
          inside the 320px settings sidebar (max-content keeps short hints on one line) */}
      {hint && visible && (
        <div className={styles.hint} style={{ width: 'max-content', maxWidth: 260, whiteSpace: 'normal' }}>
          {hint}
        </div>
      )}
    </div>
  )
}
