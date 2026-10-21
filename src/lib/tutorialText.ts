import type { TutorialTextPart } from '@/types/tutorial'

/**
 * A link written as `[label](https://…)`. Only `https://` addresses count — anything else
 * (http, javascript:, an unfinished link) is left as plain text, so a tutorial card can never
 * render an unsafe link by mistake. The address ends at the first space or closing parenthesis.
 */
const LINK = /\[([^\]]+)\]\((https:\/\/[^\s)]+)\)/g

/**
 * Splits a tutorial text into plain text and links (feat-025).
 * Why: step texts are static data (src/lib/tutorialSteps.ts) and must stay free of JSX, yet the
 * welcome card needs real links. The overlay renders the parts this function returns.
 *
 * @param text - Step description or bullet, possibly containing `[label](https://…)` links
 * @returns Parts in reading order; empty text parts are left out
 */
export function splitTutorialText(text: string): TutorialTextPart[] {
  const parts: TutorialTextPart[] = []
  // Index right after the previous link — the plain text between links starts here
  let rest = 0
  for (const match of text.matchAll(LINK)) {
    const start = match.index ?? 0
    if (start > rest) parts.push({ kind: 'text', text: text.slice(rest, start) })
    parts.push({ kind: 'link', label: match[1], href: match[2] })
    rest = start + match[0].length
  }
  if (rest < text.length) parts.push({ kind: 'text', text: text.slice(rest) })
  return parts
}
