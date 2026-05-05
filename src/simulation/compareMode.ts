import { MEMBER_NAMES, mulberry32, makeInitialState, ROLE_META } from '@/simulation/engine'
import type { Member, Role, SimSettings, SimState } from '@/types/simulation'

/**
 * The six roles used in Compare mode, in ring order.
 * Ring order means Team B members pair adjacent roles:
 * index 0+1, 1+2, 2+3, 3+4, 4+5, 5+0.
 */
export const COMPARE_ROLES: Role[] = ['DSGN', 'FE', 'BE', 'DATA', 'QA', 'OPS']

/**
 * Fixed numeric seed used to generate identical backlogs for both teams in
 * Compare mode. Both RNG instances are initialised with this value so they
 * produce the same sequence, giving each team the same features to process.
 */
export const COMPARE_SEED = 42

/**
 * Default backlog settings for Compare mode.
 * Uses a medium backlog with moderate variability so the difference between
 * specialist and cross-functional teams is clearly visible in a workshop.
 */
export const COMPARE_SETTINGS: SimSettings = {
  minBacklog: 0,
  wipLimit: 6,
  sizeVar: 1,
  roleVar: 1,
  initialBacklog: 100,
  minSpecializations: 4,
  minTasks: 4,
  maxTasks: 8,
}

/**
 * Builds the pre-configured team members for Compare mode.
 *
 * Team A — Specialists: each of the 6 members has exactly one role.
 * Team B — Cross-functional: each member has two adjacent roles (ring pattern),
 * e.g. DSGN+FE, FE+BE, BE+DATA, DATA+QA, QA+OPS, OPS+DSGN.
 *
 * IDs are non-overlapping (Team A: 1–6, Team B: 7–12) so both teams can be
 * rendered in the same React tree without key collisions.
 *
 * @returns Object with teamA and teamB arrays, each containing 6 Members.
 */
export function makeCompareTeams(): { teamA: Member[]; teamB: Member[] } {
  const teamA: Member[] = COMPARE_ROLES.map((role, i) => ({
    id: i + 1,
    name: MEMBER_NAMES[i] ?? `Unit ${i + 1}`,
    roles: [role],
    currentTask: null,
    idleSec: 0,
  }))

  // Each Team B member gets two adjacent roles — wraps around at the end.
  const teamB: Member[] = COMPARE_ROLES.map((role, i) => ({
    id: i + 7,
    name: MEMBER_NAMES[i] ?? `Unit ${i + 1}`,
    roles: [role, COMPARE_ROLES[(i + 1) % COMPARE_ROLES.length]],
    currentTask: null,
    idleSec: 0,
  }))

  return { teamA, teamB }
}

/**
 * Creates two independent SimState instances with identical backlog content.
 * Both RNGs start from COMPARE_SEED so makeInitialState generates the same
 * feature list for each team. Teams are then replaced with the pre-configured
 * specialist (A) and cross-functional (B) compositions.
 *
 * @param settings - Backlog generation settings (shared between both teams).
 * @returns Two SimStates and their corresponding RNGs ready for ticking.
 */
export function makeCompareStates(settings: SimSettings = COMPARE_SETTINGS): {
  stateA: SimState; rngA: () => number
  stateB: SimState; rngB: () => number
} {
  const { teamA, teamB } = makeCompareTeams()

  const rngA = mulberry32(COMPARE_SEED)
  const stateA = makeInitialState(rngA, settings, ROLE_META)
  stateA.team = teamA

  // Identical seed → identical backlog content, independent processing.
  const rngB = mulberry32(COMPARE_SEED)
  const stateB = makeInitialState(rngB, settings, ROLE_META)
  stateB.team = teamB

  return { stateA, rngA, stateB, rngB }
}

/**
 * Calculates the percentage change from Team A's value to Team B's value.
 * A negative result means Team B is better (lower is better for Lead Time,
 * WIP, wait time). A positive result means Team B is worse.
 *
 * Returns undefined when either value is unavailable or when Team A's value
 * is zero (division by zero guard).
 *
 * @param valueA - Team A's metric value, or null if not yet available.
 * @param valueB - Team B's metric value, or null if not yet available.
 * @returns Percentage change (B relative to A), or undefined.
 */
export function calcCompareDelta(valueA: number | null, valueB: number | null): number | undefined {
  if (valueA === null || valueB === null || valueA === 0) return undefined
  return ((valueB - valueA) / valueA) * 100
}
