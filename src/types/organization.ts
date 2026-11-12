import type { FeatureStatus, Role, RoleMeta, TaskStatus } from '@/types/simulation'

// Datový model módu Organization (feat-028, inkrement 1: mandáty a tok práce; feat-029: idle a čekání).
// Organizace se skládá z týmů a týmy z lidí. Skill (co člověk umí) patří člověku, mandát (do kterých
// oblastí smí tým zasahovat) patří týmu. Featura zasahuje do jedné nebo více oblastí a v každé oblasti
// má úkoly pro konkrétní skilly. Typy jsou oddělené od ostatních módů, aby se jejich engine nezměnil.

/**
 * Oblast produktu nebo systému (např. BIL Billing), do které může tým s mandátem zasahovat.
 * Kód je krátký a jedinečný — v UI je na štítcích, název je v tooltipu a v nabídce mandátů.
 */
export interface OrgArea {
  /** Krátký kód oblasti, např. „BIL“. */
  code: string
  /** Celý název oblasti, např. „Billing“. */
  name: string
}

/**
 * Člověk v týmu. Pracuje vždy jen na jednom úkolu a smí vzít jen úkol, jehož skill má.
 */
export interface OrgPerson {
  /** Jedinečné id člověka napříč celou organizací. */
  id: number
  /** Jméno zobrazené v panelu organizace. */
  name: string
  /** Klíče skillů z `OrgSetup.roleConfig`, které člověk umí. */
  skills: Role[]
}

/**
 * Tým lidí. Kapacita týmu jsou jeho lidé; mandáty určují, do kterých oblastí smí lidé týmu zasahovat.
 */
export interface OrgTeam {
  /** Jedinečné id týmu. */
  id: number
  /** Název týmu, např. „Team Billing“. */
  name: string
  /** Kódy oblastí, na které má tým mandát, vždy v pořadí oblastí v organizaci. */
  mandates: string[]
  /** Lidé týmu v pořadí panelu (shora dolů) — v tomto pořadí dostávají práci. */
  people: OrgPerson[]
}

/**
 * Celá organizace, kterou kouč nastavuje před během: týmy, oblasti a skilly s fázemi.
 */
export interface OrgSetup {
  /** Týmy v pořadí panelu (shora dolů) — v tomto pořadí dostávají práci. */
  teams: OrgTeam[]
  /** Oblasti v pořadí, ve kterém se zobrazují a řadí mandáty i varování. */
  areas: OrgArea[]
  /** Skilly: název, barva a fáze (stejný tvar jako specializace v ostatních módech). */
  roleConfig: Record<Role, RoleMeta>
}

/**
 * Jeden úsek práce na úkolu: kdo na něm pracoval a od kdy do kdy. Úsek si pamatuje i tým člověka,
 * aby šlo později ukázat, které týmy se na featuře podílely (timeline přijde s feat-034).
 */
export interface WorkSegment {
  /** Čas začátku v pracovních dnech. */
  from: number
  /** Čas konce v pracovních dnech; `null`, dokud práce běží. */
  to: number | null
  /** Id člověka, který na úkolu pracoval. */
  personId: number
  /** Id týmu, ve kterém člověk v tu chvíli byl. */
  teamId: number
}

/**
 * Úkol featury v jedné oblasti pro jeden skill. Ve stejné oblasti featury je každý skill nejvýš jednou.
 */
export interface OrgTask {
  /** Číslo úkolu v rámci featury (1, 2, 3…); jedinečné je až spolu s id featury. */
  id: number
  /** Kód oblasti, do které úkol patří. */
  area: string
  /** Klíč skillu, který člověk potřebuje, aby úkol mohl vzít. */
  role: Role
  /** Pracnost v pracovních dnech jednoho člověka. */
  work: number
  /** Kolik práce už je odvedeno; úkol je hotový, když `progress` dosáhne `work`. */
  progress: number
  /** Stav úkolu: čeká, rozpracovaný, hotový. */
  status: TaskStatus
  /** Id člověka, který na úkolu právě pracuje; `null`, když nikdo. */
  assignee: number | null
  /** Úseky práce v pořadí, jak vznikly. */
  segments: WorkSegment[]
}

/**
 * Featura (položka backlogu) módu Organization. Cycle time je čas od prvního přidělení práce
 * (`startedAt`) do dokončení posledního úkolu (`finishedAt`).
 */
export interface OrgFeature {
  /** Číslo featury (F-1 → 1). */
  id: number
  /** Zobrazený název jako v ostatních módech, např. „F-001 Login flow“. */
  name: string
  /** Priorita: nižší číslo má přednost. */
  priority: number
  /** Úkoly v pořadí oblastí featury a v rámci oblasti v pořadí fází. */
  tasks: OrgTask[]
  /** Kde featura je: backlog, rozpracovaná, hotová. */
  status: FeatureStatus
  /** Čas prvního přidělení práce; `null`, dokud nezačala. */
  startedAt: number | null
  /** Čas dokončení; `null`, dokud není hotová. */
  finishedAt: number | null
}

/**
 * Stav jednoho běhu simulace módu Organization. Engine ho za běhu mění na místě.
 */
export interface OrgSimState {
  /** Organizace, se kterou běh pracuje (za běhu se nemění). */
  setup: OrgSetup
  /** Featury, které ještě nezačaly, v původním pořadí (řadí se až při výběru práce). */
  backlog: OrgFeature[]
  /** Hluboká kopie backlogu před během — z ní Reset backlog obnoví. */
  backlogSnapshot: OrgFeature[]
  /** Rozpracované featury v pořadí, jak začaly. */
  inProgress: OrgFeature[]
  /** Hotové featury; nejnověji dokončená je poslední (UI ji ukáže nahoře). */
  done: OrgFeature[]
  /** Uplynulý čas běhu v pracovních dnech. */
  simTime: number
  /** Integrál počtu rozpracovaných featur v čase — z něj se počítá Avg WIP. */
  wipIntegral: number
  /**
   * Idle čas po lidech (id člověka → pracovní dny, feat-029, pravidlo R1). Roste člověku bez úkolu, dokud kdekoli
   * v backlogu nebo v rozpracovaných featurách čeká nepřidělený úkol s některým z jeho skillů. Chybějící klíč = 0.
   */
  idleByPerson: Record<number, number>
  /** Čas prvního kroku běhu; `null` před během. */
  startedAt: number | null
  /** Backlog i rozpracované featury jsou prázdné, běh doběhl. */
  finished: boolean
}

/**
 * Nastavení generátoru backlogu: počet featur a rozsahy min–max. V inkrementu 1 je pevné
 * (`DEFAULT_ORG_BACKLOG_SETTINGS`); posuvníky přijdou s feat-031.
 */
export interface OrgBacklogSettings {
  /** Počet featur v backlogu. */
  size: number
  /** Kolik různých oblastí má jedna featura (min, max). */
  areasPerFeature: [number, number]
  /** Kolik různých skillů (úkolů) má featura v jedné oblasti (min, max). */
  skillsPerArea: [number, number]
  /** Pracnost jednoho úkolu v celých pracovních dnech (min, max). */
  effortPerSkill: [number, number]
}

/**
 * Zápis featury pro `makeOrgFeature`: oblasti a v nich úkoly (skill a pracnost). Používají ho
 * generátor backlogu i testy.
 */
export interface OrgFeatureSpec {
  /** Číslo featury. */
  id: number
  /** Název bez čísla; bez něj se vezme název podle čísla jako v ostatních módech. */
  name?: string
  /** Priorita: nižší číslo má přednost. */
  priority: number
  /** Oblasti featury v pořadí a jejich úkoly v pořadí. */
  areas: Array<{ area: string; tasks: Array<{ role: Role; work: number }> }>
}

/**
 * Metriky běhu pro panel Metrics.
 */
export interface OrgMetrics {
  /** Uplynulý čas běhu v pracovních dnech. */
  totalTime: number
  /** Průměrný cycle time hotových featur; `null`, dokud žádná není hotová. */
  avgCycleTime: number | null
  /** Průměrný počet rozpracovaných featur; `null` v čase 0. */
  avgWip: number | null
  /** Idle Time: součet idle času všech lidí v person-days (feat-029). */
  idleTime: number
  /** Počet hotových featur. */
  doneCount: number
}

/**
 * Doběhnutý běh uložený pro srovnání s dalším během (delty „vs prev run“).
 */
export interface OrgRunSnapshot {
  /** Celkový čas běhu v pracovních dnech. */
  totalTime: number
  /** Průměrný cycle time; `null`, když nebyla hotová žádná featura. */
  avgCycleTime: number | null
  /** Průměrný WIP; `null`, když běh neměl žádný čas. */
  avgWip: number | null
  /** Idle Time doběhnutého běhu v person-days (feat-029). */
  idleTime: number
}

/**
 * Stav úkolu pro zobrazení (feat-029). K uloženým stavům „todo / doing / done“ přidává „waiting“: nepřidělený úkol
 * rozpracované featury s odemčenou fází, který by mohl vzít idle člověk se skillem úkolu, ale jeho tým nemá mandát
 * na oblast úkolu (pravidlo R2). Počítá se ze stavu běhu, neukládá se.
 */
export type OrgTaskStatus = 'todo' | 'doing' | 'done' | 'waiting'

/**
 * Stav člověka za běhu (feat-029):
 *  - `working` — pracuje na úkolu `taskId` featury `featureId`,
 *  - `idle` — nemá úkol (obyčejný, šedý idle),
 *  - `blocked` — „žlutý idle“: nemá úkol, ale nepřidělená práce s jeho skillem a odemčenou fází čeká v oblastech
 *    mimo mandát jeho týmu (`areas`, v pořadí oblastí organizace; pravidlo R2).
 */
export type OrgPersonStatus =
  | { kind: 'working'; featureId: number; taskId: number }
  | { kind: 'idle' }
  | { kind: 'blocked'; areas: string[] }

/**
 * Idle člověk spolu se svým týmem — pro tooltip čekajícího úkolu („1 idle person with this skill in Team Mobile“).
 */
export interface OrgIdleMember {
  /** Idle člověk. */
  person: OrgPerson
  /** Tým, do kterého člověk patří. */
  team: OrgTeam
}

/**
 * Stav toku práce v jednom okamžiku pro vykreslení jednoho snímku (feat-029). Spočítá se jednou za snímek
 * (`orgFlowView`), aby se waiting a žlutý idle nepočítaly zvlášť pro každý úkol a každého člověka.
 */
export interface OrgFlowView {
  /** Stav každého člověka organizace podle id. */
  people: Map<number, OrgPersonStatus>
  /** Čekající (waiting) úkoly a idle lidé z týmů bez mandátu, kteří by je uměli; lidé v pořadí panelu. */
  waiting: Map<OrgTask, OrgIdleMember[]>
}
