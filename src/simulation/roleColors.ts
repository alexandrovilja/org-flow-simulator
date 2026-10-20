/**
 * Barvy rolí (specializací) podle slotů design systému Org Flow (feat-021).
 *
 * Role nemají vlastní odstíny, ale sloty 1–8 s pevnou barvou. Hodnota je odkaz na CSS token
 * (`var(--role-…)` z globals.css), takže engine dál pracuje jen s řetězci a nezná React ani
 * konkrétní hex hodnoty. Všech osm výplní drží s bílým textem čipu kontrast aspoň 5:1.
 */

/** Jeden slot barvy role: lidský název (pro tooltip výběru barvy) a hodnota pro CSS. */
export interface RoleColorSlot {
  /** Název barvy, např. „Rose“ — zobrazí se jako tooltip ve výběru barvy. */
  name: string
  /** Hodnota pro CSS — odkaz na token, např. `var(--role-rose)`. */
  color: string
}

/**
 * Osm slotů v pořadí. Presety Teams i People přiřazují role do slotů 1–6 podle svého pořadí
 * (Design, Frontend/Payments, Backend/Platform, Testing, DevOps/CRM, Data/Client Acquisition);
 * sloty 7 a 8 jsou pro vlastní specializace. Fialová je až v 7. slotu, protože tónem splývá
 * s barvou výběru (`accent`).
 */
export const ROLE_COLOR_SLOTS: RoleColorSlot[] = [
  { name: 'Rose', color: 'var(--role-rose)' },
  { name: 'Blue', color: 'var(--role-blue)' },
  { name: 'Brick', color: 'var(--role-brick)' },
  { name: 'Green', color: 'var(--role-green)' },
  { name: 'Ochre', color: 'var(--role-ochre)' },
  { name: 'Teal', color: 'var(--role-teal)' },
  { name: 'Violet', color: 'var(--role-violet)' },
  { name: 'Slate', color: 'var(--role-slate)' },
]

/**
 * Barva role podle pořadí (0 = první role). Nad osm rolí se sloty opakují od začátku —
 * dvě role pak mají stejnou barvu a liší se jen textem čipu (rozhodnutí ve feat-021).
 *
 * @param index - Pořadí role, od 0
 * @returns Hodnota barvy pro CSS
 */
export function roleColorForIndex(index: number): string {
  return ROLE_COLOR_SLOTS[index % ROLE_COLOR_SLOTS.length].color
}
