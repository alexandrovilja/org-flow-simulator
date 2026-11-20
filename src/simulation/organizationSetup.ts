import type { OrgPerson, OrgSetup, OrgTeam } from '@/types/organization'
import type { Role } from '@/types/simulation'

// Úpravy organizace před během (feat-028 mandáty, feat-030 týmy, lidé a skilly). Každá funkce vrací novou
// organizaci a vstup nemění, aby React poznal změnu a aby se úprava nikdy nepropsala do běhu, který už začal.
// Pořadí týmů a lidí je zároveň pořadí, ve kterém dostávají práci, proto nový tým i nový nebo přesunutý člověk
// jde vždy na konec.

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

// ── Týmy a lidé (feat-030) ──────────────────────────────────────────────────

/**
 * Najde volný název „<prefix> N“: začne číslem `start` a zvyšuje ho, dokud název nikdo nemá. Díky tomu nový tým
 * ani nový člověk nedostane stejný název jako existující, i když kouč mezitím jiné odebral nebo přejmenoval.
 *
 * @param prefix - Začátek názvu, např. „Team“
 * @param start - První zkoušené číslo (počet týmů nebo lidí po přidání)
 * @param taken - Názvy, které už někdo má
 * @returns Volný název, např. „Team 4“
 */
function freeName(prefix: string, start: number, taken: ReadonlySet<string>): string {
  let n = start
  while (taken.has(`${prefix} ${n}`)) n++
  return `${prefix} ${n}`
}

/**
 * Všichni lidé organizace v pořadí panelu.
 *
 * @param setup - Organizace
 * @returns Lidé ze všech týmů
 */
function allPeople(setup: OrgSetup): OrgPerson[] {
  return setup.teams.flatMap(t => t.people)
}

/**
 * Vrátí organizaci, ve které se jednomu člověku změní skilly (ostatní týmy a lidé zůstanou stejné objekty).
 *
 * @param setup - Původní organizace (nemění se)
 * @param personId - Id člověka
 * @param skills - Nové skilly člověka
 * @returns Nová organizace
 */
function withSkills(setup: OrgSetup, personId: number, skills: Role[]): OrgSetup {
  return {
    ...setup,
    teams: setup.teams.map(t => (t.people.some(p => p.id === personId)
      ? { ...t, people: t.people.map(p => (p.id === personId ? { ...p, skills } : p)) }
      : t)),
  }
}

/**
 * Přejmenuje tým (pravidlo R6): okolní mezery se ořežou, prázdný název se neuloží a shodné názvy více týmů jsou
 * povolené.
 *
 * @param setup - Původní organizace (nemění se)
 * @param teamId - Id týmu
 * @param name - Nový název, jak ho kouč napsal
 * @returns Nová organizace; při prázdném nebo stejném názvu původní organizace
 */
export function renameTeam(setup: OrgSetup, teamId: number, name: string): OrgSetup {
  const trimmed = name.trim()
  const team = setup.teams.find(t => t.id === teamId)
  if (!team || trimmed === '' || trimmed === team.name) return setup
  return { ...setup, teams: setup.teams.map(t => (t.id === teamId ? { ...t, name: trimmed } : t)) }
}

/**
 * Přidá na konec organizace nový tým „Team N“ bez lidí a bez mandátu. N je počet týmů po přidání; když už tým
 * s tímto názvem existuje, N se zvyšuje. Id je největší id týmu + 1, aby bylo jedinečné i po odebrání týmů.
 *
 * @param setup - Původní organizace (nemění se)
 * @returns Nová organizace a id nového týmu (panel ho podle id rozbalí a dá fokus do jeho názvu)
 */
export function addTeam(setup: OrgSetup): { setup: OrgSetup; teamId: number } {
  const teamId = setup.teams.reduce((max, t) => Math.max(max, t.id), 0) + 1
  const name = freeName('Team', setup.teams.length + 1, new Set(setup.teams.map(t => t.name)))
  const team: OrgTeam = { id: teamId, name, mandates: [], people: [] }
  return { setup: { ...setup, teams: [...setup.teams, team] }, teamId }
}

/**
 * Odebere tým i s jeho lidmi. Odebrat jde i poslední tým; Run pak zablokuje kontrola před během.
 *
 * @param setup - Původní organizace (nemění se)
 * @param teamId - Id týmu
 * @returns Nová organizace bez týmu
 */
export function removeTeam(setup: OrgSetup, teamId: number): OrgSetup {
  return { ...setup, teams: setup.teams.filter(t => t.id !== teamId) }
}

/**
 * Přidá na konec týmu nového člověka „Person N“ bez skillů. N je počet lidí v celé organizaci po přidání; při shodě
 * se jménem existujícího člověka se N zvyšuje. Id je největší id člověka v organizaci + 1, protože engine podle id
 * pozná, kdo na čem pracuje, a id musí být jedinečné napříč týmy.
 *
 * @param setup - Původní organizace (nemění se)
 * @param teamId - Id týmu, do kterého člověk přibude
 * @returns Nová organizace s přidaným člověkem
 */
export function addPerson(setup: OrgSetup, teamId: number): OrgSetup {
  if (!setup.teams.some(t => t.id === teamId)) return setup
  const everyone = allPeople(setup)
  const person: OrgPerson = {
    id: everyone.reduce((max, p) => Math.max(max, p.id), 0) + 1,
    name: freeName('Person', everyone.length + 1, new Set(everyone.map(p => p.name))),
    skills: [],
  }
  return { ...setup, teams: setup.teams.map(t => (t.id === teamId ? { ...t, people: [...t.people, person] } : t)) }
}

/**
 * Odebere člověka z organizace.
 *
 * @param setup - Původní organizace (nemění se)
 * @param personId - Id člověka
 * @returns Nová organizace bez člověka
 */
export function removePerson(setup: OrgSetup, personId: number): OrgSetup {
  return {
    ...setup,
    teams: setup.teams.map(t => (t.people.some(p => p.id === personId)
      ? { ...t, people: t.people.filter(p => p.id !== personId) }
      : t)),
  }
}

/**
 * Přesune člověka na konec jiného týmu i s jeho skilly. Od té chvíle pro něj platí mandáty nového týmu (B11, J8).
 * Přesun do vlastního týmu nic nemění, aby se člověk omylem nepřesunul na konec a nezměnilo se pořadí přidělování.
 *
 * @param setup - Původní organizace (nemění se)
 * @param personId - Id člověka
 * @param toTeamId - Id cílového týmu
 * @returns Nová organizace s přesunutým člověkem
 */
export function movePerson(setup: OrgSetup, personId: number, toTeamId: number): OrgSetup {
  const from = setup.teams.find(t => t.people.some(p => p.id === personId))
  const target = setup.teams.find(t => t.id === toTeamId)
  if (!from || !target || from.id === toTeamId) return setup
  const person = from.people.find(p => p.id === personId)
  if (!person) return setup
  return {
    ...setup,
    teams: setup.teams.map(t => {
      if (t.id === from.id) return { ...t, people: t.people.filter(p => p.id !== personId) }
      if (t.id === toTeamId) return { ...t, people: [...t.people, person] }
      return t
    }),
  }
}

/**
 * Přidá člověku skill na konec jeho čipů (v pořadí, v jakém je dostal). Skill, který už má, se nepřidá podruhé.
 *
 * @param setup - Původní organizace (nemění se)
 * @param personId - Id člověka
 * @param role - Klíč skillu z `roleConfig`
 * @returns Nová organizace; když člověk skill už má nebo neexistuje, původní organizace
 */
export function addPersonSkill(setup: OrgSetup, personId: number, role: Role): OrgSetup {
  const person = allPeople(setup).find(p => p.id === personId)
  if (!person || person.skills.includes(role)) return setup
  return withSkills(setup, personId, [...person.skills, role])
}

/**
 * Odebere člověku skill. Člověk může zůstat bez skillů; pak nikdy nedostane úkol (D13).
 *
 * @param setup - Původní organizace (nemění se)
 * @param personId - Id člověka
 * @param role - Klíč skillu z `roleConfig`
 * @returns Nová organizace bez skillu u člověka
 */
export function removePersonSkill(setup: OrgSetup, personId: number, role: Role): OrgSetup {
  const person = allPeople(setup).find(p => p.id === personId)
  if (!person || !person.skills.includes(role)) return setup
  return withSkills(setup, personId, person.skills.filter(k => k !== role))
}
