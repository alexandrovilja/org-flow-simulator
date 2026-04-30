import type { SimState, RoleMeta } from '@/types/simulation'

/**
 * Přidá novou specializaci do konfigurace rolí.
 * Vrací nový (imutabilní) objekt roleConfig s přidanou rolí — původní zůstane nezměněn.
 * Nové role dostávají ID ve tvaru `CUSTOM_<timestamp_ms>` — unikátní, stabilní, neměnný.
 *
 * @param roleConfig - Stávající konfigurace specializací
 * @param label      - Zobrazovaný název nové specializace (nesmí být prázdný ani duplicitní)
 * @param color      - Barva v oklch formátu (např. "oklch(70% 0.14 220)")
 * @returns Nový roleConfig s přidanou rolí a vygenerované ID nové role
 * @throws Error pokud je label prázdný nebo duplicitní (case-insensitive)
 */
export function addRole(
  roleConfig: Record<string, RoleMeta>,
  label: string,
  color: string,
): { roleConfig: Record<string, RoleMeta>; id: string } {
  const trimmed = label.trim()
  if (!trimmed) throw new Error('Label must not be empty')

  // Duplicita se kontroluje case-insensitive — "Frontend" a "frontend" jsou stejná role
  const existingLabels = Object.values(roleConfig).map(m => m.label.toLowerCase())
  if (existingLabels.includes(trimmed.toLowerCase())) {
    throw new Error(`Role with label "${trimmed}" already exists`)
  }

  // Timestamp zajišťuje unikátnost i při rychlém opakovaném volání v testech.
  // Suffix náhodného čísla eliminuje kolize při stejném ms (v testech volaných synchronně).
  const id = `CUSTOM_${Date.now()}_${Math.floor(Math.random() * 1e6)}`

  return {
    roleConfig: {
      ...roleConfig,
      [id]: { label: trimmed, color, level: 1, required: false },
    },
    id,
  }
}

/**
 * Smaže specializaci z konfigurace rolí a vyčistí závislosti v SimState.
 *
 * Efekty na SimState (mutuje in-place):
 * - Členové aktivně pracující na tasku smazané role → currentTask = null, task → todo
 * - Tasky smazané role se odstraní ze všech features v backlogu a inProgress
 * - Features, které ztratí všechny tasky, se odstraní z backlogu/inProgress
 * - Smazaná role se odebere ze seznamu rolí každého člena týmu
 *
 * @param state      - Stav simulace (mutován in-place)
 * @param roleConfig - Stávající konfigurace specializací
 * @param roleId     - ID role k odstranění
 * @returns Nový roleConfig bez smazané role (původní zůstane nezměněn)
 */
export function deleteRole(
  state: SimState,
  roleConfig: Record<string, RoleMeta>,
  roleId: string,
): { roleConfig: Record<string, RoleMeta> } {
  // 1. Uvolnit členy aktivně pracující na tasku smazané role.
  //    Task vrátíme do stavu 'todo' — bude vyčištěn v dalším kroku.
  for (const member of state.team) {
    if (!member.currentTask) continue
    const feature = state.inProgress.find(f => f.id === member.currentTask!.featureId)
    const task = feature?.tasks.find(t => t.id === member.currentTask!.taskId)
    if (task && task.role === roleId) {
      task.status = 'todo'
      task.assignee = null
      task.progress = 0
      member.currentTask = null
    }
  }

  // 2. Odstranit tasky smazané role z backlogu; features bez tasků zahodit.
  for (const feature of state.backlog) {
    feature.tasks = feature.tasks.filter(t => t.role !== roleId)
  }
  state.backlog = state.backlog.filter(f => f.tasks.length > 0)

  // 3. Stejné čištění pro inProgress.
  for (const feature of state.inProgress) {
    feature.tasks = feature.tasks.filter(t => t.role !== roleId)
  }
  state.inProgress = state.inProgress.filter(f => f.tasks.length > 0)

  // 4. Odebrat roli ze seznamu rolí každého člena.
  for (const member of state.team) {
    member.roles = member.roles.filter(r => r !== roleId)
  }

  // 5. Vrátit nový roleConfig bez smazaného klíče (imutabilní — původní cfg zůstane).
  const { [roleId]: _removed, ...rest } = roleConfig
  return { roleConfig: rest }
}
