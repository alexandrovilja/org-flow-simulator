'use client'

import { useState, useEffect } from 'react'
import { TUTORIAL_STEPS } from '@/lib/tutorialSteps'
import type { TutorialMode } from '@/types/tutorial'
import styles from './TutorialOverlay.module.css'

/** Props for the TutorialOverlay component. */
interface TutorialOverlayProps {
  /**
   * Which mode's tutorial steps to show.
   * The parent (Simulator) decides which mode is active and passes it here.
   */
  mode: TutorialMode
  /**
   * Called when the user completes the final step ("Finish") or clicks "Skip tutorial".
   * The parent is responsible for saving the completed flag to localStorage and unmounting.
   */
  onComplete: () => void
}

/**
 * Bounding rect of the spotlighted element, plus the viewport dimensions
 * captured at the same moment (so rendering is consistent without re-reading window).
 */
interface SpotlightState {
  top: number
  left: number
  width: number
  height: number
  /** Viewport width at the time of measurement — used for right-edge calculations. */
  vw: number
  /** Viewport height at the time of measurement — used for bottom-edge calculations. */
  vh: number
}

/** Fixed card dimensions used for position calculations before the card is painted.
 *  CARD_H is intentionally generous (longest observed description ~3 lines ≈ 220px)
 *  so the card never clips the viewport edge on typical descriptions. */
const CARD_W = 400
const CARD_H = 240
/** Gap between the spotlighted element and the tutorial card. */
const GAP = 20
/** Minimum distance from any viewport edge. */
const EDGE = 16
/** Fully opaque dark colour for the outer backdrop — covers everything outside the focus. */
const DARK = 'rgba(10, 10, 16, 0.76)'
/**
 * Lighter dim colour for the inner backdrop — covers the rest of the parent panel
 * (when a parentTargetId is set), so the user retains context while focusing on the
 * specific sub-element. Noticeably lighter than DARK so the panel structure is visible.
 */
const INNER_DIM = 'rgba(10, 10, 16, 0.50)'

/**
 * Calculates where to place the tutorial card so it sits adjacent to the spotlight.
 * Tries positions in priority order: right → left → below → above → inside fallback.
 *
 * @param s - Bounding rect of the spotlighted element plus current viewport size.
 * @returns top/left pixel values for `position: fixed` placement.
 */
function calcCardPos(s: SpotlightState): { top: number; left: number } {
  const { top, left, width, height, vw, vh } = s

  // Clamp helpers — keep the card fully within the viewport.
  const clampTop  = (t: number) => Math.max(EDGE, Math.min(vh - CARD_H - EDGE, t))
  const clampLeft = (l: number) => Math.max(EDGE, Math.min(vw - CARD_W - EDGE, l))

  // Vertically centred alongside the target.
  const vcenter = top + height / 2 - CARD_H / 2

  // Right of the spotlight.
  if (left + width + GAP + CARD_W <= vw - EDGE) {
    return { left: left + width + GAP, top: clampTop(vcenter) }
  }

  // Left of the spotlight.
  if (left - GAP - CARD_W >= EDGE) {
    return { left: left - GAP - CARD_W, top: clampTop(vcenter) }
  }

  // Below the spotlight (horizontally centred).
  const hcenter = left + width / 2 - CARD_W / 2
  if (top + height + GAP + CARD_H <= vh - EDGE) {
    return { top: top + height + GAP, left: clampLeft(hcenter) }
  }

  // Above the spotlight.
  if (top - GAP - CARD_H >= EDGE) {
    return { top: top - GAP - CARD_H, left: clampLeft(hcenter) }
  }

  // Fallback: overlay the spotlight (top-left corner, with margin).
  return { top: clampTop(top + GAP), left: clampLeft(left + GAP) }
}

/**
 * Spotlight tutorial overlay.
 *
 * Renders dark backdrop panels that surround a single spotlighted element,
 * leaving that element clearly visible while dimming everything else.
 *
 * Two-level dimming (when a step has `parentTargetId`):
 *   1. Outer (dark)  — covers everything outside the parent panel.
 *   2. Inner (lighter) — covers the rest of the parent panel, so only the
 *      specific sub-element is fully visible. The user retains panel context
 *      ("I'm still inside Team A") while focusing on the highlighted detail.
 *
 * A floating tutorial card is positioned adjacent to the spotlighted sub-element.
 *
 * @param mode       - Which mode's steps to display.
 * @param onComplete - Callback fired when the tutorial is finished or skipped.
 */
export function TutorialOverlay({ mode, onComplete }: TutorialOverlayProps) {
  // 0-based index of the currently displayed step.
  const [stepIndex, setStepIndex] = useState(0)
  // Measured rect of the spotlighted sub-element (targetId). Null until first measurement.
  const [spotlight, setSpotlight] = useState<SpotlightState | null>(null)
  // Measured rect of the parent panel (parentTargetId). Null when step has no parent.
  const [parentSpotlight, setParentSpotlight] = useState<SpotlightState | null>(null)

  const steps       = TUTORIAL_STEPS[mode]
  const currentStep = steps[stepIndex]
  const isLastStep  = stepIndex === steps.length - 1

  // Measure the target element (and optional parent) whenever the active step changes.
  // We also re-measure on window resize to keep the overlay aligned.
  useEffect(() => {
    // Always reset first so the previous step's spotlight doesn't flash on the new step.
    setSpotlight(null)
    setParentSpotlight(null)

    // Empty targetId = intentional "no spotlight" step (e.g. intro overview).
    // Stay in full-backdrop mode — no measurement needed, no rAF, no resize listener.
    if (!currentStep.targetId) return

    function measure() {
      const el = document.querySelector<HTMLElement>(
        `[data-tutorial-target="${currentStep.targetId}"]`,
      )
      if (!el) return
      const r = el.getBoundingClientRect()
      setSpotlight({
        top: r.top, left: r.left,
        width: r.width, height: r.height,
        vw: window.innerWidth, vh: window.innerHeight,
      })

      // Measure parent panel when specified — enables the two-level overlay.
      if (currentStep.parentTargetId) {
        const parentEl = document.querySelector<HTMLElement>(
          `[data-tutorial-target="${currentStep.parentTargetId}"]`,
        )
        if (parentEl) {
          const pr = parentEl.getBoundingClientRect()
          setParentSpotlight({
            top: pr.top, left: pr.left,
            width: pr.width, height: pr.height,
            vw: window.innerWidth, vh: window.innerHeight,
          })
        } else {
          setParentSpotlight(null)
        }
      } else {
        setParentSpotlight(null)
      }
    }

    // Use rAF so the DOM has settled after any React re-renders before we measure.
    const raf = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
    }
  }, [currentStep.targetId, currentStep.parentTargetId])

  /** Moves to the next step (or completes the tutorial on the last step). */
  function handleNext() {
    if (isLastStep) {
      onComplete()
    } else {
      setStepIndex(i => i + 1)
    }
  }

  // Card is always positioned relative to the child spotlight (the specific sub-element).
  const cardPos = spotlight ? calcCardPos(spotlight) : null

  // Shared card content — same regardless of backdrop style.
  const card = (
    <div
      className={styles.card}
      style={{
        position: 'fixed',
        ...(cardPos
          ? { top: cardPos.top, left: cardPos.left, transform: 'none', bottom: 'auto' }
          : { bottom: 40, left: '50%', transform: 'translateX(-50%)' }),
        pointerEvents: 'auto',
      }}
    >
      <div className={styles.topRow}>
        <span className={styles.progress}>{stepIndex + 1} / {steps.length}</span>
        <button className={styles.skipButton} onClick={onComplete}>
          Skip tutorial
        </button>
      </div>
      <p className={styles.description}>{currentStep.description}</p>
      <div className={styles.actions}>
        {isLastStep ? (
          <button className={styles.nextButton} onClick={onComplete}>Finish</button>
        ) : (
          <button className={styles.nextButton} onClick={handleNext}>Next →</button>
        )}
      </div>
    </div>
  )

  // While we haven't measured the target yet, show a full-screen backdrop.
  if (!spotlight) {
    return (
      <div data-testid="tutorial-overlay" className={styles.backdrop}>
        {card}
      </div>
    )
  }

  // Outer cutout is based on the parent panel (if present) or the child element.
  // Everything outside this rect gets the fully opaque DARK backdrop.
  const outer = parentSpotlight ?? spotlight

  const { top: ot, left: ol, width: ow, height: oh, vw, vh } = outer
  const { top: ct, left: cl, width: cw, height: ch } = spotlight

  return (
    <div
      data-testid="tutorial-overlay"
      style={{ position: 'fixed', inset: 0, zIndex: 900, pointerEvents: 'auto' }}
    >
      {/* ── Outer backdrop (DARK) — covers everything outside the outer spotlight ── */}

      {ot > 0 && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: ot,
          background: DARK, pointerEvents: 'none',
        }} />
      )}

      {ot + oh < vh && (
        <div style={{
          position: 'fixed', top: ot + oh, left: 0, right: 0, bottom: 0,
          background: DARK, pointerEvents: 'none',
        }} />
      )}

      {ol > 0 && (
        <div style={{
          position: 'fixed', top: ot, left: 0, width: ol, height: oh,
          background: DARK, pointerEvents: 'none',
        }} />
      )}

      {ol + ow < vw && (
        <div style={{
          position: 'fixed', top: ot, left: ol + ow, right: 0, height: oh,
          background: DARK, pointerEvents: 'none',
        }} />
      )}

      {/* ── Inner backdrop (INNER_DIM) — covers the rest of the parent panel ──
          Only rendered when parentSpotlight is set (two-level steps).
          Fills the "donut" between parent panel and child spotlight so the user
          can see the panel structure exists but stays focused on the sub-element. */}
      {parentSpotlight && (() => {
        // Clamp dimensions to zero so negative values don't create artefacts.
        const topH    = Math.max(0, ct - ot)
        const bottomH = Math.max(0, (ot + oh) - (ct + ch))
        const leftW   = Math.max(0, cl - ol)
        const rightW  = Math.max(0, (ol + ow) - (cl + cw))
        return (
          <>
            {/* Above child within parent */}
            {topH > 0 && (
              <div style={{
                position: 'fixed', top: ot, left: ol, width: ow, height: topH,
                background: INNER_DIM, pointerEvents: 'none',
              }} />
            )}
            {/* Below child within parent */}
            {bottomH > 0 && (
              <div style={{
                position: 'fixed', top: ct + ch, left: ol, width: ow, height: bottomH,
                background: INNER_DIM, pointerEvents: 'none',
              }} />
            )}
            {/* Left of child within parent (same vertical band as child) */}
            {leftW > 0 && (
              <div style={{
                position: 'fixed', top: ct, left: ol, width: leftW, height: ch,
                background: INNER_DIM, pointerEvents: 'none',
              }} />
            )}
            {/* Right of child within parent (same vertical band as child) */}
            {rightW > 0 && (
              <div style={{
                position: 'fixed', top: ct, left: cl + cw, width: rightW, height: ch,
                background: INNER_DIM, pointerEvents: 'none',
              }} />
            )}
          </>
        )
      })()}

      {/* Pulse ring — animated frame around the spotlighted sub-element. */}
      <div
        className={styles.pulseRing}
        style={{
          top:    ct - 5,
          left:   cl - 5,
          width:  cw + 10,
          height: ch + 10,
        }}
      />

      {card}
    </div>
  )
}
