import { MEMBER_NAMES, mulberry32, makeInitialState, ROLE_META } from '@/simulation/engine'
import type { Member, Role, SimSettings, SimState } from '@/types/simulation'

/**
 * The six roles used in Compare mode, in ring order.
 * Ring order means adjacent-role teams pair consecutive entries:
 * index 0+1, 1+2, 2+3, 3+4, 4+5, 5+0 (wrapping).
 */
export const COMPARE_ROLES: Role[] = ['DSGN', 'FE', 'BE', 'DATA', 'QA', 'OPS']

/**
 * The three pre-defined team configurations available in Compare mode.
 * 'single' = 1 role per member, 'double' = 2 adjacent roles, 'multi' = 3 adjacent roles.
 */
export type TeamType = 'single' | 'double' | 'multi'

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

/** Number of adjacent roles assigned to each member for each team type. */
const ROLES_PER_TYPE: Record<TeamType, number> = { single: 1, double: 2, multi: 3 }

/**
 * Builds 6 team members for a given team type using a ring (wrap-around) pattern.
 * Member at index i gets roles at positions i, i+1, i+2, … (mod COMPARE_ROLES.length).
 * IDs start at idOffset so two calls with different offsets never collide.
 *
 * @param type     - Team configuration: 'single' (1 role), 'double' (2), 'multi' (3).
 * @param idOffset - First member ID; subsequent members get idOffset+1, idOffset+2, …
 * @returns Array of 6 Member objects ready for use in a SimState.
 */
export function makeTeamByType(type: TeamType, idOffset: number): Member[] {
  const count = ROLES_PER_TYPE[type]
  return COMPARE_ROLES.map((_, i) => ({
    id: idOffset + i,
    name: MEMBER_NAMES[i] ?? `Unit ${i + 1}`,
    // Slice `count` consecutive roles starting at position i, wrapping around.
    roles: Array.from({ length: count }, (_, k) => COMPARE_ROLES[(i + k) % COMPARE_ROLES.length]),
    currentTask: null,
    idleSec: 0,
  }))
}

/**
 * Builds the pre-configured team members for Compare mode.
 *
 * Defaults to Single-skill (Team A, IDs 1–6) vs Double-skill (Team B, IDs 7–12).
 * Any combination of TeamType values is supported.
 *
 * @param typeA - Team type for the left column (default 'single').
 * @param typeB - Team type for the right column (default 'double').
 * @returns Object with teamA and teamB arrays, each containing 6 Members.
 */
export function makeCompareTeams(typeA: TeamType = 'single', typeB: TeamType = 'double'): { teamA: Member[]; teamB: Member[] } {
  return {
    teamA: makeTeamByType(typeA, 1),
    teamB: makeTeamByType(typeB, 7),
  }
}

/**
 * Creates two independent SimState instances with identical backlog content.
 * Both RNGs start from COMPARE_SEED so makeInitialState generates the same
 * feature list for each team. Teams are then replaced with the chosen configurations.
 *
 * @param typeA    - Team type for state A (default 'single').
 * @param typeB    - Team type for state B (default 'double').
 * @param settings - Backlog generation settings (shared between both teams).
 * @returns Two SimStates and their corresponding RNGs ready for ticking.
 */
export function makeCompareStates(
  typeA: TeamType = 'single',
  typeB: TeamType = 'double',
  settings: SimSettings = COMPARE_SETTINGS,
): {
  stateA: SimState; rngA: () => number
  stateB: SimState; rngB: () => number
} {
  const { teamA, teamB } = makeCompareTeams(typeA, typeB)

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
