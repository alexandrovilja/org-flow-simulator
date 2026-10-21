'use client'

import { Fragment, useLayoutEffect, useRef, useState } from 'react'
import { TUTORIAL_STEPS } from '@/lib/tutorialSteps'
import { splitTutorialText } from '@/lib/tutorialText'
import type { TutorialMode } from '@/types/tutorial'
import { Button } from '@/components/Button'
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

/**
 * Card size used for placement until the real card has been measured: the width of a step card
 * (`.card` in TutorialOverlay.module.css) and a generous height (title + four lines of text + buttons),
 * so an unmeasured card never clips the viewport edge.
 */
const CARD_SIZE_FALLBACK: CardSize = { width: 400, height: 240 }
/** Gap between the spotlighted element and the tutorial card. */
const GAP = 20
/** Minimum distance from any viewport edge. */
const EDGE = 16

/** Measured size of the tutorial card in px (it changes with the step's text and the window width). */
interface CardSize {
  width: number
  height: number
}

/**
 * Calculates where to place the tutorial card so it sits adjacent to the spotlight.
 * Tries positions in priority order: right → left → below → above → inside fallback.
 *
 * @param s - Bounding rect of the spotlighted element plus current viewport size.
 * @param card - Size of the card (measured, or the fallback before the first measurement).
 * @returns top/left pixel values for `position: fixed` placement.
 */
function calcCardPos(s: SpotlightState, card: CardSize): { top: number; left: number } {
  const { top, left, width, height, vw, vh } = s
  const { width: cardW, height: cardH } = card

  // Clamp helpers — keep the card fully within the viewport.
  const clampTop  = (t: number) => Math.max(EDGE, Math.min(vh - cardH - EDGE, t))
  const clampLeft = (l: number) => Math.max(EDGE, Math.min(vw - cardW - EDGE, l))

  // Vertically centred alongside the target.
  const vcenter = top + height / 2 - cardH / 2

  // Right of the spotlight.
  if (left + width + GAP + cardW <= vw - EDGE) {
    return { left: left + width + GAP, top: clampTop(vcenter) }
  }

  // Left of the spotlight.
  if (left - GAP - cardW >= EDGE) {
    return { left: left - GAP - cardW, top: clampTop(vcenter) }
  }

  // Below the spotlight (horizontally centred).
  const hcenter = left + width / 2 - cardW / 2
  if (top + height + GAP + cardH <= vh - EDGE) {
    return { top: top + height + GAP, left: clampLeft(hcenter) }
  }

  // Above the spotlight.
  if (top - GAP - cardH >= EDGE) {
    return { top: top - GAP - cardH, left: clampLeft(hcenter) }
  }

  // Fallback: overlay the spotlight (top-left corner, with margin).
  return { top: clampTop(top + GAP), left: clampLeft(left + GAP) }
}

/**
 * Finds the element with the given `data-tutorial-target`.
 *
 * @param targetId - Value of the `data-tutorial-target` attribute
 * @returns The element, or null when it is not in the DOM
 */
function findTarget(targetId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-tutorial-target="${targetId}"]`)
}

/**
 * Measures the element with the given `data-tutorial-target`, or returns null when it is not in the DOM.
 *
 * @param targetId - Value of the `data-tutorial-target` attribute
 * @returns The element's rect plus the viewport size, or null
 */
function measureTarget(targetId: string): SpotlightState | null {
  const el = findTarget(targetId)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height, vw: window.innerWidth, vh: window.innerHeight }
}

/**
 * Small "opens in a new tab" arrow after a link (feat-025). An SVG rather than the ↗ character,
 * which Unicode lists as a pictograph — the design system allows no emoji-like glyphs (feat-022).
 * Decorative only: hidden from screen readers, so the link's name stays just its label.
 */
function ExternalIcon() {
  return (
    <svg width={8} height={8} viewBox="0 0 8 8" aria-hidden="true" focusable="false" className={styles.externalIcon}>
      <path d="M2 1h5v5M7 1 1 7" fill="none" stroke="currentColor" strokeWidth={1.2} />
    </svg>
  )
}

/**
 * Renders a tutorial text: plain text as is, `[label](https://…)` as a link that opens in a new tab.
 *
 * @param text - Step description or bullet
 * @returns Text and link nodes in reading order
 */
function renderTutorialText(text: string) {
  return splitTutorialText(text).map((part, i) =>
    part.kind === 'text' ? (
      <Fragment key={i}>{part.text}</Fragment>
    ) : (
      <a key={i} href={part.href} target="_blank" rel="noopener noreferrer" className={styles.link}>
        {part.label}
        <ExternalIcon />
      </a>
    ),
  )
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
 * The card shows the part of the tour and the step ("TOP BAR · 2 / 14"), a title, the text and
 * "← Back" / "Next →" (feat-025). A step without a target (the welcome card) is centred on the screen.
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
  // Real size of the card — texts differ in length and the card narrows in a small window.
  const [cardSize, setCardSize] = useState<CardSize>(CARD_SIZE_FALLBACK)
  const cardRef = useRef<HTMLDivElement>(null)
  // Main action (Next → / Finish) — gets the focus back when „← Back“ disappears on step 1.
  const primaryRef = useRef<HTMLButtonElement>(null)
  // Set by „← Back“ when the card had keyboard focus; checked after the new step is rendered.
  const restoreFocusRef = useRef(false)

  const steps       = TUTORIAL_STEPS[mode]
  const currentStep = steps[stepIndex]
  const isLastStep  = stepIndex === steps.length - 1
  // The welcome card has no target on purpose — it is centred, not placed next to an element.
  const isIntro     = currentStep.targetId === ''

  // Measure the target element (and optional parent) whenever the active step changes.
  // The first measurement happens right after the DOM update (layout effect), so the spotlight does
  // not depend on the next animation frame — a background tab may delay frames. A second measurement
  // in requestAnimationFrame catches late layout changes; resizing the window measures again.
  useLayoutEffect(() => {
    // Always reset first so the previous step's spotlight doesn't flash on the new step.
    setSpotlight(null)
    setParentSpotlight(null)

    // Empty targetId = intentional "no spotlight" step (welcome card).
    if (!currentStep.targetId) return

    const { targetId, fallbackTargetId, parentTargetId } = currentStep
    // Bring the target into view first: the first To Do card may sit above a scrolled column, and the
    // ring would then frame an invisible card over the header. jsdom has no scrollIntoView, hence `?.`.
    const element = findTarget(targetId) ?? (fallbackTargetId ? findTarget(fallbackTargetId) : null)
    element?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })

    function measure() {
      // The fallback target stands in when the target is missing (e.g. an empty To Do column).
      const target = measureTarget(targetId) ?? (fallbackTargetId ? measureTarget(fallbackTargetId) : null)
      setSpotlight(target)
      // Measure parent panel when specified — enables the two-level overlay.
      setParentSpotlight(target && parentTargetId ? measureTarget(parentTargetId) : null)
    }

    measure()
    const raf = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
    }
  }, [currentStep])

  // Measure the card's real size whenever the step (and so its text) changes and when the window is
  // resized (a narrow window narrows the card and re-wraps the text). Keeping the previous object when
  // nothing changed lets React skip the extra render.
  useLayoutEffect(() => {
    function measureCard() {
      const el = cardRef.current
      if (!el || el.offsetWidth === 0 || el.offsetHeight === 0) return
      const next = { width: el.offsetWidth, height: el.offsetHeight }
      setCardSize(prev => (prev.width === next.width && prev.height === next.height ? prev : next))
    }
    measureCard()
    window.addEventListener('resize', measureCard)
    return () => window.removeEventListener('resize', measureCard)
  }, [currentStep])

  // „← Back“ on step 2 removes the button it was pressed on (step 1 has none). Keep a keyboard user
  // inside the card: when the focus fell out of it, move it to the main action.
  useLayoutEffect(() => {
    if (!restoreFocusRef.current) return
    restoreFocusRef.current = false
    if (!cardRef.current?.contains(document.activeElement)) primaryRef.current?.focus()
  }, [stepIndex])

  /** Moves to the next step (or completes the tutorial on the last step). */
  function handleNext() {
    if (isLastStep) {
      onComplete()
    } else {
      setStepIndex(i => i + 1)
    }
  }

  /** Moves one step back (the button is not shown on the first step). */
  function handleBack() {
    restoreFocusRef.current = cardRef.current?.contains(document.activeElement) ?? false
    setStepIndex(i => Math.max(0, i - 1))
  }

  // Card is always positioned relative to the child spotlight (the specific sub-element).
  const cardPos = spotlight ? calcCardPos(spotlight, cardSize) : null

  // Position of the card: next to the spotlight; centred for the welcome card; otherwise (target not
  // found) at the bottom centre, as before.
  const placement = cardPos
    ? { top: cardPos.top, left: cardPos.left, transform: 'none', bottom: 'auto' }
    : isIntro
      ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
      : { bottom: 40, left: '50%', transform: 'translateX(-50%)' }

  // Shared card content — same regardless of backdrop style.
  const card = (
    <div
      ref={cardRef}
      className={[styles.card, isIntro && styles.welcome].filter(Boolean).join(' ')}
      style={{ position: 'fixed', ...placement, pointerEvents: 'auto' }}
    >
      <div className={styles.topRow}>
        <span className={styles.progress}>{`${currentStep.chapter} · ${stepIndex + 1} / ${steps.length}`}</span>
        <button className={styles.skipButton} onClick={onComplete}>
          Skip tutorial
        </button>
      </div>
      <div className={styles.body}>
        <h2 className={styles.title}>{currentStep.title}</h2>
        <p className={styles.description}>{renderTutorialText(currentStep.description)}</p>
      </div>
      {currentStep.bullets && (
        <ul className={styles.bullets}>
          {currentStep.bullets.map(bullet => <li key={bullet}>{renderTutorialText(bullet)}</li>)}
        </ul>
      )}
      <div className={styles.actions}>
        {stepIndex > 0 && (
          <Button variant="secondary" onBar onClick={handleBack}>← Back</Button>
        )}
        {isLastStep ? (
          <Button ref={primaryRef} variant="light" onClick={onComplete}>Finish</Button>
        ) : (
          <Button ref={primaryRef} variant="light" onClick={handleNext}>Next →</Button>
        )}
      </div>
    </div>
  )

  // One wrapper for both states (full backdrop / spotlight), with the card always as its last child:
  // the card is never re-mounted between steps, so keyboard focus on its buttons survives a step change.
  return (
    <div data-testid="tutorial-overlay" className={spotlight ? styles.layer : styles.backdrop}>
      {spotlight && renderSpotlight(spotlight, parentSpotlight)}
      {card}
    </div>
  )
}

/**
 * Dimmed backdrop pieces around the spotlight and the pulse ring.
 *
 * Two-level dimming (when a step has a parent panel): the outer, darker pieces cover everything outside
 * the parent panel; the inner, lighter pieces cover the rest of the parent panel.
 *
 * @param spotlight - Measured rect of the spotlighted sub-element
 * @param parentSpotlight - Measured rect of the parent panel, or null when the step has none
 * @returns The backdrop pieces and the ring
 */
function renderSpotlight(spotlight: SpotlightState, parentSpotlight: SpotlightState | null) {
  // Outer cutout is based on the parent panel (if present) or the child element.
  // Everything outside this rect gets the darker `dim` backdrop.
  const outer = parentSpotlight ?? spotlight

  const { top: ot, left: ol, width: ow, height: oh, vw, vh } = outer
  const { top: ct, left: cl, width: cw, height: ch } = spotlight

  return (
    <>
      {/* ── Outer backdrop (dim) — covers everything outside the outer spotlight ── */}

      {ot > 0 && (
        <div className={styles.dim} style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: ot,
        }} />
      )}

      {ot + oh < vh && (
        <div className={styles.dim} style={{
          position: 'fixed', top: ot + oh, left: 0, right: 0, bottom: 0,
        }} />
      )}

      {ol > 0 && (
        <div className={styles.dim} style={{
          position: 'fixed', top: ot, left: 0, width: ol, height: oh,
        }} />
      )}

      {ol + ow < vw && (
        <div className={styles.dim} style={{
          position: 'fixed', top: ot, left: ol + ow, right: 0, height: oh,
        }} />
      )}

      {/* ── Inner backdrop (dimInner) — covers the rest of the parent panel ──
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
              <div className={styles.dimInner} style={{
                position: 'fixed', top: ot, left: ol, width: ow, height: topH,
              }} />
            )}
            {/* Below child within parent */}
            {bottomH > 0 && (
              <div className={styles.dimInner} style={{
                position: 'fixed', top: ct + ch, left: ol, width: ow, height: bottomH,
              }} />
            )}
            {/* Left of child within parent (same vertical band as child) */}
            {leftW > 0 && (
              <div className={styles.dimInner} style={{
                position: 'fixed', top: ct, left: ol, width: leftW, height: ch,
              }} />
            )}
            {/* Right of child within parent (same vertical band as child) */}
            {rightW > 0 && (
              <div className={styles.dimInner} style={{
                position: 'fixed', top: ct, left: cl + cw, width: rightW, height: ch,
              }} />
            )}
          </>
        )
      })()}

      {/* Pulse ring — animated frame 5 px around the spotlighted sub-element (square corners, feat-025). */}
      <div
        data-testid="tutorial-ring"
        className={styles.pulseRing}
        style={{
          top:    ct - 5,
          left:   cl - 5,
          width:  cw + 10,
          height: ch + 10,
        }}
      />
    </>
  )
}
