import type { OrgSetup } from '@/types/organization'

// Úpravy organizace před během (feat-028). Každá funkce vrací novou organizaci a vstup nemění, aby React
// poznal změnu a aby se úprava nikdy nepropsala do běhu, který už začal. Inkrement 1 mění jen mandáty;
// úpravy týmů, lidí a skillů přijdou s feat-030.

/**
 * Vrátí organizaci, ve které má daný tým zadané mandáty.
 *
 * @param setup - Původní organizace (nemění se)
 * @param teamId - Id týmu
 * @param mandates - Nové mandáty týmu
 * @returns Nová organizace
 */
function withMandates(setup: OrgSetup, teamId: number, mandates: string[]): OrgSetup {
  return { ...setup, teams: setup.teams.map(t => (t.id === teamId ? { ...t, mandates } : t)) }
}

/**
 * Přidá týmu mandát na oblast. Mandáty zůstanou v pořadí oblastí v organizaci a bez duplicit,
 * takže štítky v panelu mají vždy stejné pořadí.
 *
 * @param setup - Původní organizace (nemění se)
 * @param teamId - Id týmu
 * @param code - Kód oblasti, např. „WEB“
 * @returns Nová organizace s přidaným mandátem
 */
export function addMandate(setup: OrgSetup, teamId: number, code: string): OrgSetup {
  const team = setup.teams.find(t => t.id === teamId)
  if (!team) return setup
  const wanted = new Set([...team.mandates, code])
  return withMandates(setup, teamId, setup.areas.map(a => a.code).filter(c => wanted.has(c)))
}

/**
 * Odebere týmu mandát na oblast.
 *
 * @param setup - Původní organizace (nemění se)
 * @param teamId - Id týmu
 * @param code - Kód oblasti, např. „WEB“
 * @returns Nová organizace bez daného mandátu
 */
export function removeMandate(setup: OrgSetup, teamId: number, code: string): OrgSetup {
  const team = setup.teams.find(t => t.id === teamId)
  if (!team) return setup
  return withMandates(setup, teamId, team.mandates.filter(c => c !== code))
}
