import { FEATURE_HUES, FEATURE_NAMES } from '@/simulation/engine'
import type { Role, RoleMeta, WipMode } from '@/types/simulation'
import type {
  OrgArea, OrgBacklogSettings, OrgFeature, OrgFeatureSpec, OrgFlowView, OrgIdleMember, OrgMetrics, OrgPerson,
  OrgPersonStatus, OrgRunSnapshot, OrgSetup, OrgSimState, OrgTask, OrgTaskStatus, OrgTeam,
} from '@/types/organization'

// Engine módu Organization (feat-028, inkrement 1: mandáty a tok práce).
// Čistý modul bez Reactu, oddělený od engine.ts, aby se existující módy nezměnily. Pravidla:
//  - úkol smí vzít člověk, který má skill úkolu a jehož tým má mandát na oblast úkolu,
//  - člověk pracuje na jednom úkolu najednou,
//  - práci dostávají týmy shora dolů a lidé v týmu shora dolů; ve featuře se úkoly berou v pořadí oblastí
//    a úkolů; vyšší priorita (nižší číslo) má přednost,
//  - fáze platí v rámci oblasti: úkol fáze N čeká jen na nižší fáze v téže oblasti téže featury,
//  - Reduce WIP: rozpracované featury mají přednost před backlogem.
// feat-029 (Proč práce čeká) přidává:
//  - Idle Time (R1): člověku bez úkolu roste idle čas, dokud kdekoli čeká nepřidělený úkol s jeho skillem,
//  - waiting a žlutý idle (R2): co čeká kvůli mandátu, se počítá ze stavu běhu v okamžiku zobrazení, neukládá se.

/** Výchozí nastavení backlogu (spec, Výchozí stav): 100 featur, 1–3 oblasti, 1–3 skilly v oblasti, 1–5 dní. */
export const DEFAULT_ORG_BACKLOG_SETTINGS: OrgBacklogSettings = {
  size: 100,
  areasPerFeature: [1, 3],
  skillsPerArea: [1, 3],
  effortPerSkill: [1, 5],
}

// Tolerance pro porovnání odvedené práce s pracností: součet mnoha kroků 0.01 se v plovoucí čárce
// může od celého čísla lišit o ~1e-15, úkol se ale musí dokončit přesně v kroku, kdy práci dosáhne
const WORK_EPSILON = 1e-9

/**
 * Skilly výchozí organizace: Product (fáze 1), Java a Frontend (fáze 2), QA (fáze 3), žádný povinný.
 * Barvy jsou sloty rolí z design systému.
 *
 * @returns Nová kopie konfigurace skillů
 */
function defaultRoleConfig(): Record<Role, RoleMeta> {
  return {
    PRODUCT: { label: 'Product', color: 'var(--role-rose)', level: 1, required: false },
    JAVA: { label: 'Java', color: 'var(--role-blue)', level: 2, required: false },
    FRONTEND: { label: 'Frontend', color: 'var(--role-brick)', level: 2, required: false },
    QA: { label: 'QA', color: 'var(--role-green)', level: 3, required: false },
  }
}

/** Oblasti výchozí organizace v pořadí panelu. */
const DEFAULT_AREAS: OrgArea[] = [
  { code: 'BIL', name: 'Billing' },
  { code: 'MOB', name: 'Mobile app' },
  { code: 'WEB', name: 'Web portal' },
]

/**
 * Týmy výchozí organizace: název, mandát a jména lidí v pořadí skillů Product, Java, Frontend, QA.
 * Každý tým umí všechny skilly, takže rozdíl mezi týmy dělá jen mandát.
 */
const DEFAULT_TEAMS: Array<{ name: string; mandate: string; people: [string, string, string, string] }> = [
  { name: 'Team Billing', mandate: 'BIL', people: ['Ada', 'Ben', 'Cyril', 'Chen'] },
  { name: 'Team Mobile', mandate: 'MOB', people: ['Dani', 'Emil', 'Eli', 'Fae'] },
  { name: 'Team Web', mandate: 'WEB', people: ['Gus', 'Hugo', 'Hana', 'Ivo'] },
]

/** Skill každého ze čtyř lidí výchozího týmu, ve stejném pořadí jako jména v `DEFAULT_TEAMS`. */
const DEFAULT_PERSON_SKILLS: Role[] = ['PRODUCT', 'JAVA', 'FRONTEND', 'QA']

/**
 * Vytvoří výchozí organizaci módu Organization: 3 týmy po 4 lidech, každý s mandátem na jednu oblast.
 * Kouč z ní na workshopu vychází a mění jen mandáty (inkrement 1).
 *
 * @returns Nová organizace (každé volání vrací nezávislé objekty, takže úpravy jedné neovlivní další)
 */
export function makeDefaultOrgSetup(): OrgSetup {
  let personId = 1
  const teams: OrgTeam[] = DEFAULT_TEAMS.map((t, i) => ({
    id: i + 1,
    name: t.name,
    mandates: [t.mandate],
    people: t.people.map((name, j): OrgPerson => ({ id: personId++, name, skills: [DEFAULT_PERSON_SKILLS[j]] })),
  }))
  return {
    teams,
    areas: DEFAULT_AREAS.map(a => ({ ...a })),
    roleConfig: defaultRoleConfig(),
  }
}

/**
 * Odstín featury (0–360) pro barevné odlišení v UI — stejná paleta a stejné pravidlo jako v ostatních módech.
 *
 * @param featureId - Číslo featury
 * @returns Odstín pro CSS proměnnou `--hue`
 */
export function orgFeatureHue(featureId: number): number {
  return FEATURE_HUES[(featureId - 1) % FEATURE_HUES.length]
}

/**
 * Vytvoří featuru ve stavu backlog ze zápisu oblastí a úkolů. Úkoly dostanou čísla 1, 2, 3… v pořadí
 * zápisu, takže stejný zápis dá vždy stejnou featuru.
 *
 * @param spec - Číslo, priorita, volitelný název a oblasti s úkoly
 * @returns Nová featura bez odvedené práce
 */
export function makeOrgFeature(spec: OrgFeatureSpec): OrgFeature {
  const name = spec.name ?? FEATURE_NAMES[(spec.id - 1) % FEATURE_NAMES.length]
  let taskNo = 1
  const tasks: OrgTask[] = spec.areas.flatMap(({ area, tasks: specTasks }) =>
    specTasks.map(({ role, work }) => ({
      id: taskNo++,
      area,
      role,
      work,
      progress: 0,
      status: 'todo' as const,
      assignee: null,
      segments: [],
    })))
  return {
    id: spec.id,
    // Stejný tvar názvu jako v ostatních módech: „F-001 Login flow“
    name: `F-${String(spec.id).padStart(3, '0')} ${name}`,
    priority: spec.priority,
    tasks,
    status: 'backlog',
    startedAt: null,
    finishedAt: null,
  }
}

/**
 * Náhodné celé číslo v rozsahu včetně obou mezí.
 *
 * @param rng - Generátor náhodných čísel v [0, 1)
 * @param min - Dolní mez
 * @param max - Horní mez (≥ min)
 * @returns Celé číslo min…max
 */
function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

/**
 * Vybere `count` různých prvků seznamu (částečné zamíchání Fisher–Yates) a vrátí je v původním pořadí
 * seznamu, aby oblasti i skilly featury šly vždy ve stejném pořadí jako v organizaci.
 *
 * @param rng - Generátor náhodných čísel
 * @param items - Seznam, ze kterého se vybírá
 * @param count - Kolik prvků vybrat (nejvýš délka seznamu)
 * @returns Vybrané prvky v pořadí seznamu
 */
function pickDistinct<T>(rng: () => number, items: T[], count: number): T[] {
  const indexes = items.map((_, i) => i)
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rng() * (indexes.length - i))
    ;[indexes[i], indexes[j]] = [indexes[j], indexes[i]]
  }
  return indexes.slice(0, count).sort((a, b) => a - b).map(i => items[i])
}

/**
 * Omezí rozsah min–max na počet dostupných možností (featura nemůže mít víc různých oblastí, než kolik
 * jich organizace má).
 *
 * @param range - Rozsah z nastavení
 * @param available - Počet dostupných možností
 * @returns Platný rozsah [min, max], kde 1 ≤ min ≤ max ≤ available
 */
function clampRange([min, max]: [number, number], available: number): [number, number] {
  const hi = Math.max(1, Math.min(max, available))
  return [Math.max(1, Math.min(min, hi)), hi]
}

/**
 * Vygeneruje backlog módu Organization. Každá featura má 1–N různých oblastí, v každé oblasti 1–M různých
 * skillů (každý skill je jeden úkol) seřazených podle fáze a celočíselnou pracnost. Priority jsou 1…size.
 * Stejný seed dá vždy stejný backlog.
 *
 * @param rng - Generátor náhodných čísel se seedem (`mulberry32`)
 * @param settings - Počet featur a rozsahy oblastí, skillů a pracnosti
 * @param setup - Organizace, ze které se berou oblasti a skilly
 * @returns Nové featury ve stavu backlog
 */
export function generateOrgBacklog(rng: () => number, settings: OrgBacklogSettings, setup: OrgSetup): OrgFeature[] {
  const codes = setup.areas.map(a => a.code)
  // Skilly seřazené podle fáze; stabilní řazení nechá skilly stejné fáze v pořadí konfigurace
  const skills = Object.keys(setup.roleConfig).sort((a, b) => setup.roleConfig[a].level - setup.roleConfig[b].level)
  const [areaMin, areaMax] = clampRange(settings.areasPerFeature, codes.length)
  const [skillMin, skillMax] = clampRange(settings.skillsPerArea, skills.length)
  // Pracnost aspoň 1 den a max nikdy pod min, jinak by vznikly úkoly s nulovou nebo zápornou prací
  const effortMin = Math.max(1, settings.effortPerSkill[0])
  const effortMax = Math.max(effortMin, settings.effortPerSkill[1])

  const backlog: OrgFeature[] = []
  for (let id = 1; id <= settings.size; id++) {
    const featureAreas = pickDistinct(rng, codes, randInt(rng, areaMin, areaMax))
    const areas = featureAreas.map(area => ({
      area,
      tasks: pickDistinct(rng, skills, randInt(rng, skillMin, skillMax))
        .map(role => ({ role, work: randInt(rng, effortMin, effortMax) })),
    }))
    backlog.push(makeOrgFeature({ id, priority: id, areas }))
  }
  return backlog
}

/**
 * Kontrola před během: najde problémy, kvůli kterým by se práce nemohla dokončit. V inkrementu 1 jen
 * oblasti použité v backlogu, na které žádný tým nemá mandát. Prázdný výsledek znamená, že Run je povolený.
 *
 * @param setup - Organizace
 * @param backlog - Featury, které se mají zpracovat
 * @returns Texty varování v pořadí oblastí, např. „No team has a mandate for WEB“
 */
export function validateOrgSetup(setup: OrgSetup, backlog: OrgFeature[]): string[] {
  const used = new Set(backlog.flatMap(f => f.tasks.map(t => t.area)))
  const covered = new Set(setup.teams.flatMap(t => t.mandates))
  return setup.areas
    .filter(a => used.has(a.code) && !covered.has(a.code))
    .map(a => `No team has a mandate for ${a.code}`)
}

/**
 * Hluboká kopie featury — Reset z ní obnoví backlog, i když engine původní featury za běhu změnil.
 *
 * @param f - Featura
 * @returns Nezávislá kopie včetně úkolů a úseků práce
 */
function cloneFeature(f: OrgFeature): OrgFeature {
  return { ...f, tasks: f.tasks.map(t => ({ ...t, segments: t.segments.map(s => ({ ...s })) })) }
}

/**
 * Vytvoří stav běhu před spuštěním (čas 0). Backlog si uloží i jako kopii pro Reset.
 *
 * @param setup - Organizace
 * @param backlog - Featury backlogu
 * @returns Nový stav běhu
 */
export function makeOrgState(setup: OrgSetup, backlog: OrgFeature[]): OrgSimState {
  return {
    setup,
    backlog,
    backlogSnapshot: backlog.map(cloneFeature),
    inProgress: [],
    done: [],
    simTime: 0,
    wipIntegral: 0,
    idleByPerson: {},
    startedAt: null,
    finished: false,
  }
}

/**
 * Smí úkol začít podle fází? Úkol fáze N čeká, dokud nejsou v téže oblasti téže featury hotové všechny
 * úkoly nižších fází. Jiné oblasti featury na fázi nemají vliv.
 *
 * @param feature - Featura úkolu
 * @param task - Posuzovaný úkol
 * @param roleConfig - Skilly s fázemi
 * @returns `true`, když úkol může začít
 */
function phaseReady(feature: OrgFeature, task: OrgTask, roleConfig: Record<Role, RoleMeta>): boolean {
  const level = roleConfig[task.role]?.level ?? 1
  return feature.tasks.every(t =>
    t.area !== task.area || t.status === 'done' || (roleConfig[t.role]?.level ?? 1) >= level)
}

/**
 * Přidělí práci volným lidem v jednom okamžiku. Lidé jdou v pořadí panelu (týmy shora dolů, lidé shora
 * dolů); každý vezme první vhodný úkol z featur seřazených podle režimu výběru práce.
 *
 * @param state - Stav běhu (mění se na místě)
 */
function assignWork(state: OrgSimState): void {
  // Kdo už pracuje: člověk má najednou jen jeden úkol
  const busy = new Set<number>()
  for (const f of state.inProgress) {
    for (const t of f.tasks) if (t.status === 'doing' && t.assignee !== null) busy.add(t.assignee)
  }
  const { roleConfig } = state.setup
  // Pořadí featur se spočítá až pro prvního volného člověka, ve většině kroků jsou všichni zaneprázdnění
  let candidates: OrgFeature[] | null = null

  for (const team of state.setup.teams) {
    const mandates = new Set(team.mandates)
    for (const person of team.people) {
      if (busy.has(person.id)) continue
      if (candidates === null) candidates = orderCandidates(state)
      const skills = new Set(person.skills)
      for (const feature of candidates) {
        const task = feature.tasks.find(t =>
          t.status === 'todo' && skills.has(t.role) && mandates.has(t.area) && phaseReady(feature, t, roleConfig))
        if (!task) continue
        startTask(state, feature, task, person.id, team.id)
        busy.add(person.id)
        // Featura právě přešla z backlogu mezi rozpracované: další lidé ji uvidí jako rozpracovanou
        candidates = orderCandidates(state)
        break
      }
    }
  }
}

/** Řazení featur podle priority: nižší číslo má přednost. */
const byPriority = (a: OrgFeature, b: OrgFeature) => a.priority - b.priority

// Backlog seřazený podle priority pro dané pole backlogu. Priority se za běhu nemění a pole backlogu
// vzniká znovu jen při začátku featury, takže se celý backlog seřadí jednou a pak se jen filtruje.
// WeakMap nechá staré pole i jeho seřazenou kopii uvolnit, jakmile na ně stav běhu přestane ukazovat.
const backlogByPriority = new WeakMap<OrgFeature[], OrgFeature[]>()

/**
 * Backlog seřazený podle priority (z mezipaměti, když už pro toto pole existuje).
 *
 * @param backlog - Pole backlogu ze stavu běhu
 * @returns Stejné featury seřazené podle priority
 */
function sortedBacklog(backlog: OrgFeature[]): OrgFeature[] {
  let sorted = backlogByPriority.get(backlog)
  if (!sorted) {
    sorted = [...backlog].sort(byPriority)
    backlogByPriority.set(backlog, sorted)
  }
  return sorted
}

/**
 * Pořadí featur, ze kterých se vybírá práce. Reduce WIP: nejdřív rozpracované, pak backlog; v obou
 * skupinách podle priority.
 *
 * @param state - Stav běhu
 * @returns Featury v pořadí, v jakém se z nich bere práce
 */
function orderCandidates(state: OrgSimState): OrgFeature[] {
  return [...[...state.inProgress].sort(byPriority), ...sortedBacklog(state.backlog)]
}

/**
 * Začne práci na úkolu: přidělí ho člověku, otevře úsek práce a featuru z backlogu přesune mezi rozpracované.
 *
 * @param state - Stav běhu (mění se na místě)
 * @param feature - Featura úkolu
 * @param task - Úkol, který člověk bere
 * @param personId - Id člověka
 * @param teamId - Id týmu člověka
 */
function startTask(state: OrgSimState, feature: OrgFeature, task: OrgTask, personId: number, teamId: number): void {
  task.status = 'doing'
  task.assignee = personId
  task.segments.push({ from: state.simTime, to: null, personId, teamId })
  if (feature.status === 'backlog') {
    feature.status = 'in-progress'
    feature.startedAt = state.simTime
    // Nové pole místo splice: memoizované zobrazení backlogu pozná změnu podle identity pole. Seřazená kopie
    // se pro nové pole odvodí ze staré bez nového řazení
    const sorted = backlogByPriority.get(state.backlog)
    state.backlog = state.backlog.filter(f => f !== feature)
    if (sorted) backlogByPriority.set(state.backlog, sorted.filter(f => f !== feature))
    state.inProgress.push(feature)
  }
}

/**
 * Posune běh o `dt` pracovních dní: na začátku kroku přidělí práci volným lidem, pak každý pracující
 * odvede `dt` práce; hotové úkoly uvolní lidi a featura se všemi úkoly hotovými přejde do Done.
 * Engine je deterministický (bez náhody) a stav mění na místě.
 *
 * @param state - Stav běhu
 * @param dt - Délka kroku v pracovních dnech
 * @param wipMode - Režim výběru práce. V inkrementu 1 má každý režim pořadí Reduce WIP: Min units po týmech
 *   přidá feat-032 a UI ho v tomto módu zatím nenabízí
 * @returns Stejný (změněný) stav pro pohodlné řetězení
 */
export function tickOrg(state: OrgSimState, dt: number, wipMode: WipMode): OrgSimState { // eslint-disable-line @typescript-eslint/no-unused-vars -- wipMode použije až feat-032
  if (state.finished) return state
  if (state.startedAt === null) state.startedAt = state.simTime

  assignWork(state)
  // WIP se počítá po přidělení: featura, která v tomto okamžiku začala, už je rozpracovaná
  state.wipIntegral += state.inProgress.length * dt
  // Idle čas taky po přidělení: člověk, který právě dostal úkol, idle není (R1)
  accrueIdle(state, dt)

  const end = state.simTime + dt
  // Dokončil se v tomto kroku nějaký úkol? Jen pak se může změnit, kdo co smí vzít
  let anyCompleted = false
  for (const f of state.inProgress) {
    for (const t of f.tasks) {
      if (t.status !== 'doing') continue
      t.progress += dt
      if (t.progress >= t.work - WORK_EPSILON) {
        t.progress = t.work
        t.status = 'done'
        t.assignee = null
        const open = t.segments[t.segments.length - 1]
        if (open) open.to = end
        anyCompleted = true
      }
    }
  }
  state.simTime = end

  // Featury se všemi úkoly hotovými přejdou do Done; nejnověji dokončená je na konci seznamu
  const stillOpen: OrgFeature[] = []
  const finishedNow: OrgFeature[] = []
  for (const f of state.inProgress) {
    if (f.tasks.every(t => t.status === 'done')) {
      f.status = 'done'
      f.finishedAt = end
      finishedNow.push(f)
    } else {
      stillOpen.push(f)
    }
  }
  state.inProgress = stillOpen
  // Nové pole Done jen při dokončení: memoizovaný seznam Done se pak nepřekresluje v každém snímku
  if (finishedNow.length > 0) state.done = [...state.done, ...finishedNow]

  // Uvolnění lidé dostanou další práci hned na konci kroku (ve stejném čase, jako by ji dostali na začátku
  // dalšího kroku, takže se čísla nemění). Zobrazený stav tak nikdy neukáže člověka uvolněného na hranici úkolu
  // jako idle a jeho další úkol jako waiting — žlutá by jinak na jeden snímek problikla (feat-029)
  if (anyCompleted) assignWork(state)

  if (state.backlog.length === 0 && state.inProgress.length === 0) state.finished = true
  return state
}

/**
 * Reset: vrátí backlog do stavu před během, vyprázdní rozpracované i hotové a vynuluje čas.
 * Organizace zůstane beze změny.
 *
 * @param state - Stav běhu (mění se na místě)
 * @returns Stejný stav po resetu
 */
export function resetOrgState(state: OrgSimState): OrgSimState {
  state.backlog = state.backlogSnapshot.map(cloneFeature)
  state.inProgress = []
  state.done = []
  state.simTime = 0
  state.wipIntegral = 0
  state.idleByPerson = {}
  state.startedAt = null
  state.finished = false
  return state
}

/**
 * Metriky běhu pro panel Metrics.
 *
 * @param state - Stav běhu
 * @returns Celkový čas, průměrný cycle time, průměrný WIP a počet hotových featur
 */
export function orgMetrics(state: OrgSimState): OrgMetrics {
  const cycles = state.done.map(f => (f.finishedAt ?? 0) - (f.startedAt ?? 0))
  return {
    totalTime: state.simTime,
    avgCycleTime: cycles.length > 0 ? cycles.reduce((sum, c) => sum + c, 0) / cycles.length : null,
    avgWip: state.simTime > 0 ? state.wipIntegral / state.simTime : null,
    idleTime: Object.values(state.idleByPerson).reduce((sum, d) => sum + d, 0),
    doneCount: state.done.length,
  }
}

/**
 * Uloží doběhnutý běh pro srovnání s dalším během (delty „vs prev run“ po Resetu).
 *
 * @param state - Doběhnutý stav běhu
 * @returns Celkový čas, průměrný cycle time, průměrný WIP a Idle Time
 */
export function snapshotOrgRun(state: OrgSimState): OrgRunSnapshot {
  const { totalTime, avgCycleTime, avgWip, idleTime } = orgMetrics(state)
  return { totalTime, avgCycleTime, avgWip, idleTime }
}

// ── Idle a čekání (feat-029) ────────────────────────────────────────────────

/**
 * Kdo právě na čem pracuje.
 *
 * @param state - Stav běhu
 * @returns Id člověka → featura a úkol, na kterém pracuje
 */
function workingPeople(state: OrgSimState): Map<number, { feature: OrgFeature; task: OrgTask }> {
  const working = new Map<number, { feature: OrgFeature; task: OrgTask }>()
  for (const feature of state.inProgress) {
    for (const task of feature.tasks) {
      if (task.status === 'doing' && task.assignee !== null) working.set(task.assignee, { feature, task })
    }
  }
  return working
}

/**
 * Idle lidé (bez úkolu) se svým týmem, v pořadí panelu organizace.
 *
 * @param state - Stav běhu
 * @param working - Kdo právě pracuje (z `workingPeople`)
 * @returns Idle lidé s týmy
 */
function idleMembers(state: OrgSimState, working: ReadonlyMap<number, unknown>): OrgIdleMember[] {
  return state.setup.teams.flatMap(team =>
    team.people.filter(person => !working.has(person.id)).map(person => ({ person, team })))
}

/**
 * Idle lidé, kteří by úkol uměli (mají jeho skill), ale jejich tým nemá mandát na oblast úkolu.
 *
 * @param idle - Idle lidé s týmy
 * @param task - Úkol
 * @returns Lidé s týmy v pořadí panelu
 */
function idleOutsideMandate(idle: OrgIdleMember[], task: OrgTask): OrgIdleMember[] {
  return idle.filter(({ person, team }) => person.skills.includes(task.role) && !team.mandates.includes(task.area))
}

/**
 * Pravidlo R2 pro jeden úkol: na koho čeká. Úkol čeká (waiting), když je nepřidělený, jeho featura je rozpracovaná,
 * jeho fáze v oblasti je odemčená a existuje idle člověk se skillem úkolu, jehož tým nemá mandát na oblast úkolu.
 * Jediné místo s tímto pravidlem — používají ho `orgTaskStatus` i `orgFlowView`.
 *
 * @param feature - Featura úkolu
 * @param task - Úkol
 * @param idle - Idle lidé s týmy
 * @param roleConfig - Skilly s fázemi
 * @returns Idle lidé z týmů bez mandátu, kteří by úkol uměli (prázdné = úkol nečeká)
 */
function waitingFor(feature: OrgFeature, task: OrgTask, idle: OrgIdleMember[], roleConfig: Record<Role, RoleMeta>): OrgIdleMember[] {
  if (task.status !== 'todo' || feature.status !== 'in-progress' || !phaseReady(feature, task, roleConfig)) return []
  return idleOutsideMandate(idle, task)
}

/**
 * Přičte idle čas za jeden krok (R1): každému člověku bez úkolu, který má aspoň jeden skill, pro který kdekoli
 * v backlogu nebo v rozpracovaných featurách čeká nepřidělený úkol — bez ohledu na fázi a mandát. Stejné pravidlo
 * jako počítání idle v ostatních módech (engine.ts).
 *
 * @param state - Stav běhu (mění se na místě)
 * @param dt - Délka kroku v pracovních dnech
 */
function accrueIdle(state: OrgSimState, dt: number): void {
  const busy = workingPeople(state)
  // Skilly nepřidělených úkolů se spočítají až pro prvního idle člověka se skilly — ve většině kroků všichni pracují
  let openRoles: Set<Role> | null = null
  for (const team of state.setup.teams) {
    for (const person of team.people) {
      if (busy.has(person.id) || person.skills.length === 0) continue
      if (openRoles === null) {
        openRoles = new Set<Role>()
        for (const f of state.inProgress) for (const t of f.tasks) if (t.status === 'todo') openRoles.add(t.role)
        for (const f of state.backlog) for (const t of f.tasks) if (t.status === 'todo') openRoles.add(t.role)
      }
      const roles = openRoles
      if (person.skills.some(k => roles.has(k))) {
        state.idleByPerson[person.id] = (state.idleByPerson[person.id] ?? 0) + dt
      }
    }
  }
}

/**
 * Stav úkolu pro zobrazení (R2). Hotový a rozpracovaný úkol vrátí svůj stav. Nepřidělený úkol je „waiting“, když
 * jeho featura je rozpracovaná, jeho fáze v oblasti je odemčená a existuje idle člověk se skillem úkolu, jehož tým
 * nemá mandát na oblast úkolu. Jinak je „todo“ (čeká jen na nižší fázi, na kolegu z vlastního týmu, nebo je v backlogu).
 *
 * @param state - Stav běhu
 * @param feature - Featura úkolu
 * @param task - Úkol
 * @returns Stav úkolu
 */
export function orgTaskStatus(state: OrgSimState, feature: OrgFeature, task: OrgTask): OrgTaskStatus {
  if (task.status !== 'todo') return task.status
  // Lehká cesta pro jeden úkol (bez průchodu celým backlogem jako orgFlowView); pravidlo je společné ve waitingFor
  return waitingFor(feature, task, idleMembers(state, workingPeople(state)), state.setup.roleConfig).length > 0 ? 'waiting' : 'todo'
}

/**
 * Stav člověka za běhu: pracuje (na které featuře a úkolu), obyčejný idle, nebo žlutý idle s oblastmi, kde jeho
 * práce čeká mimo mandát jeho týmu (R2). Bere ho z `orgFlowView`, aby pravidlo žlutého idle bylo jen na jednom místě.
 *
 * @param state - Stav běhu
 * @param personId - Id člověka
 * @returns Stav člověka (neznámé id → obyčejný idle)
 */
export function orgPersonStatus(state: OrgSimState, personId: number): OrgPersonStatus {
  return orgFlowView(state).people.get(personId) ?? { kind: 'idle' }
}

/**
 * Stav toku práce pro vykreslení jednoho snímku: stav každého člověka a čekající úkoly s idle lidmi, kteří by je
 * uměli, ale nesmí (R2). Jedním průchodem: čekání úkolu posoudí `waitingFor`, žlutý idle se hledá přes množinu
 * dvojic (skill, oblast) nepřidělených úkolů s odemčenou fází, takže zůstává rychlý i pro velkou organizaci.
 *
 * @param state - Stav běhu
 * @returns Stav lidí a čekajících úkolů
 */
export function orgFlowView(state: OrgSimState): OrgFlowView {
  const { roleConfig } = state.setup
  const working = workingPeople(state)
  const idle = idleMembers(state, working)

  const waiting = new Map<OrgTask, OrgIdleMember[]>()
  // Oblasti s odemčenou nepřidělenou prací podle skillu (v backlogu i v rozpracovaných featurách)
  const openAreas = new Map<Role, Set<string>>()
  for (const feature of [...state.inProgress, ...state.backlog]) {
    for (const task of feature.tasks) {
      if (task.status !== 'todo' || !phaseReady(feature, task, roleConfig)) continue
      let areas = openAreas.get(task.role)
      if (!areas) openAreas.set(task.role, (areas = new Set()))
      areas.add(task.area)
      const blocked = waitingFor(feature, task, idle, roleConfig)
      if (blocked.length > 0) waiting.set(task, blocked)
    }
  }

  const people = new Map<number, OrgPersonStatus>()
  for (const [personId, job] of working) people.set(personId, { kind: 'working', featureId: job.feature.id, taskId: job.task.id })
  const areaOrder = state.setup.areas.map(a => a.code)
  for (const { person, team } of idle) {
    const found = new Set(person.skills.flatMap(k => [...(openAreas.get(k) ?? [])]).filter(a => !team.mandates.includes(a)))
    const areas = areaOrder.filter(code => found.has(code))
    people.set(person.id, areas.length > 0 ? { kind: 'blocked', areas } : { kind: 'idle' })
  }
  return { people, waiting }
}
