'use client'

import { useState, useEffect, useId } from 'react'
import styles from './HelpIcon.module.css'

/** Props for the HelpIcon component. */
interface HelpIconProps {
  /** The help text to display inside the tooltip when the user clicks the ? button. */
  text: string
}

/**
 * A small circular ? button that toggles a tooltip with contextual help text.
 * Placed next to UI elements that may not be self-explanatory to new users.
 *
 * Clicking opens the tooltip; clicking again closes it (toggle behaviour).
 * Pressing Escape while the tooltip is open also closes it.
 * The tooltip is linked to the button via `aria-describedby` so screen readers
 * announce the text when the button receives focus.
 *
 * @param text - The help explanation to show in the tooltip.
 */
export function HelpIcon({ text }: HelpIconProps) {
  // Controls whether the tooltip is currently visible.
  const [open, setOpen] = useState(false)
  // Stable ID used to associate the button with its tooltip for screen readers.
  const tooltipId = useId()

  // Close the tooltip when the user presses Escape.
  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <div className={styles.root}>
      <button
        className={styles.button}
        aria-label="help"
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onClick={() => setOpen(o => !o)}
      >
        ?
      </button>

      {/* Tooltip — only rendered when open, so it is fully absent from the DOM when hidden */}
      {open && (
        <div id={tooltipId} className={styles.tooltip} role="tooltip">
          {text}
        </div>
      )}
    </div>
  )
}
