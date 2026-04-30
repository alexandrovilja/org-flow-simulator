import type {
  Role, RoleMeta, Feature, Task, Member,
  SimState, SimSettings, SimStats, LeadTimeEntry,
  FocusMode, WipMode,
} from '@/types/simulation'

/** Všechny dostupné specializace v systému — pořadí odpovídá výchozímu týmu. */
export const ROLES: Role[] = ['FE', 'BE', 'DSGN', 'QA', 'OPS', 'DATA']

/** Výchozí konfigurace všech specializací — slouží jako výchozí hodnota pro uživatelský stav.
 *  Všechny role mají level 1 (paralelní zpracování) a required false — zachovává stávající chování.
 *  Uživatel může konfiguraci změnit v panelu Specializations. */
export const ROLE_META: Record<Role, RoleMeta> = {
  FE:   { label: 'Frontend', color: 'oklch(70% 0.14 250)', level: 1, required: false },
  BE:   { label: 'Backend',  color: 'oklch(66% 0.14 285)', level: 1, required: false },
  DSGN: { label: 'Design',   color: 'oklch(72% 0.13 25)',  level: 1, required: false },
  QA:   { label: 'QA',       color: 'oklch(68% 0.13 145)', level: 1, required: false },
  OPS:  { label: 'DevOps',   color: 'oklch(68% 0.13 75)',  level: 1, required: false },
  DATA: { label: 'Data',     color: 'oklch(64% 0.14 320)', level: 1, required: false },
}

/** Paleta 9 barevných odstínů pro vizuální rozlišení features v UI.
 *  Features cyklují přes tyto odstíny podle svého ID. */
const FEATURE_HUES = [12, 45, 90, 140, 180, 215, 260, 300, 335]

/** 30 realistických názvů features — cyklují se podle ID featury.
 *  Záměrně nejsou generovány náhodně, aby bylo snazší features identifikovat
 *  ve workshopu ("podívejte se na Login flow"). */
const FEATURE_NAMES = [
  'Login flow', 'Search filters', 'Export CSV', 'Dark mode', 'Onboarding',
  'Notifications', 'API rate limits', 'Audit log', 'Billing portal', 'SSO',
  'Bulk actions', 'Webhooks', 'Mobile nav', 'Empty states', 'Settings page',
  'Activity feed', 'Permissions', 'Inline editing', 'Drag & drop', 'Comments',
  'Reactions', '2FA', 'Profile page', 'Charts', 'Keyboard shortcuts',
  'File upload', 'Sharing', 'Tags', 'Saved views', 'Reports',
]

/** Jména členů týmu přiřazovaná v pořadí při inicializaci.
 *  Kratší jména záměrně — lépe se vejdou do karet v UI.
 *  Exportováno, aby Simulator mohl přiřadit jméno nové jednotce přidané za běhu. */
export const MEMBER_NAMES = ['Ada', 'Ben', 'Chen', 'Dani', 'Eli', 'Fae', 'Gus', 'Hari']

/**
 * Vytvoří deterministický generátor náhodných čísel (PRNG) s daným seedem.
 * Stejný seed vždy vygeneruje stejnou sekvenci čísel — proto je reset
 * simulace reprodukovatelný: backlog se obnoví do přesně stejného stavu.
 *
 * Algoritmus mulberry32 je rychlý a kvalitní 32-bit PRNG vhodný pro hry a simulace.
 *
 * @param seed - Počáteční hodnota generátoru (celé číslo)
 * @returns Funkce bez argumentů, která při každém zavolání vrátí číslo v [0, 1)
 */
export function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0
    seed = (seed + 0x6D2B79F5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Globální čítače — resetují se při každém volání makeInitialState,
// aby ID a priority začínaly od 1 při každé nové simulaci.
let nextFeatureId = 1
let nextTaskId = 1
/** Čítač priority — první vygenerovaná feature dostane prioritu 1 (nejvyšší).
 *  Priorita se nemění po celou dobu simulace, i když feature přejde do inProgress. */
let nextPriority = 1

/**
 * Vytvoří novou feature s náhodným počtem úkolů a rolí.
 * Variabilita je řízena parametry sizeVar a roleVar ze settings.
 * Povinné role (roleConfig[r].required === true) jsou vždy zahrnuty.
 *
 * @param rng        - Seeded random number generator pro determinismus
 * @param now        - Aktuální simulační čas (stane se createdAt featury)
 * @param settings   - Nastavení simulace (sizeVar, roleVar)
 * @param roleConfig - Konfigurace specializací (level, required, label)
 * @returns Nová feature připravená k vložení do backlogu
 */
function makeFeature(
  rng: () => number,
  now: number,
  settings: SimSettings,
  roleConfig: Record<Role, RoleMeta>,
): Feature {
  const id = nextFeatureId++
  // Priorita se přiřadí jednou při vytvoření a platí po celou dobu simulace.
  // Čím nižší číslo, tím vyšší priorita — první vygenerovaná feature je nejdůležitější.
  const priority = nextPriority++

  // Barva a název se odvozují z ID, ne z RNG — jsou tedy předvídatelné
  const hue = FEATURE_HUES[(id - 1) % FEATURE_HUES.length]
  const name = FEATURE_NAMES[(id - 1) % FEATURE_NAMES.length]

  // Výpočet počtu úkolů: základní hodnota 3 ± rozptyl daný sizeVar
  const baseSize = 3
  const spread = Math.round(settings.sizeVar * 3)
  const minSize = Math.max(1, baseSize - spread)
  const maxSize = baseSize + spread
  const taskCount = minSize + Math.floor(rng() * (maxSize - minSize + 1))

  // Výpočet počtu různých rolí: základní hodnota 2 ± rozptyl daný roleVar.
  // Uživatelské minSpecializations tvoří spodní hranici — nelze klesnout pod ni.
  const baseRoles = 2
  const roleSpread = Math.round(settings.roleVar * 4)
  const computedMin = Math.max(1, baseRoles - Math.floor(roleSpread / 2))
  const minRoles = Math.min(ROLES.length, Math.max(computedMin, settings.minSpecializations ?? 1))
  const maxRoles = Math.min(ROLES.length, Math.max(minRoles, baseRoles + roleSpread))
  const roleCount = minRoles + Math.floor(rng() * (maxRoles - minRoles + 1))

  // Povinné role jsou vždy zahrnuty bez ohledu na roleVar
  const requiredRoles = ROLES.filter(r => roleConfig[r].required)
  // Volitelné role jsou náhodně zamíchány a přidány do celkového počtu
  const optionalRoles = ROLES.filter(r => !roleConfig[r].required)
  const shuffledOptional = [...optionalRoles].sort(() => rng() - 0.5)
  // Celkový počet rolí musí pokrýt alespoň všechny povinné role
  const totalRoleCount = Math.max(requiredRoles.length, roleCount)
  const additionalCount = totalRoleCount - requiredRoles.length
  const chosenRoles = [...requiredRoles, ...shuffledOptional.slice(0, additionalCount)]

  // Rozdělíme úkoly mezi vybrané role.
  // Required role dostanou vždy přesně 1 úkol — extra úkoly jdou pouze volitelným rolím.
  // Pokud je i volitelných rolí víc než zbývající taskCount, rozšíříme efektivní počet.
  const requiredCount = requiredRoles.length
  const optionalInChosen = chosenRoles.length - requiredCount
  const effectiveTaskCount = Math.max(taskCount, chosenRoles.length)
  const counts = new Array(chosenRoles.length).fill(1) as number[]
  let remaining = effectiveTaskCount - chosenRoles.length
  // Extra tasky jdou jen volitelným rolím (indexy requiredCount … chosenRoles.length-1)
  while (remaining > 0 && optionalInChosen > 0) {
    counts[requiredCount + Math.floor(rng() * optionalInChosen)]++
    remaining--
  }

  // Seřadíme vybrané role vzestupně podle fáze, aby tasky v UI odpovídaly pořadí zpracování.
  // Stable sort: stejná fáze zachovává původní pořadí (required role jsou vždy první).
  const sortedRoles = chosenRoles
    .map((role, i) => ({ role, count: counts[i], level: roleConfig[role].level }))
    .sort((a, b) => a.level - b.level)

  // Vytvoříme jednotlivé úkoly s náhodnou pracností 0.8–2.2 simulačních sekund
  const tasks: Task[] = []
  for (const { role, count } of sortedRoles) {
    for (let i = 0; i < count; i++) {
      const work = 0.8 + rng() * 1.4
      tasks.push({
        id: nextTaskId++,
        role,
        work,
        progress: 0,
        status: 'todo',
        assignee: null,
      })
    }
  }

  return {
    id,
    name: `F-${String(id).padStart(3, '0')} ${name}`,
    hue,
    priority,
    tasks,
    createdAt: now,
    startedAt: null,
    finishedAt: null,
    status: 'backlog',
  }
}

/**
 * Vytvoří jednoho člena týmu se zadanou specializací.
 *
 * @param i    - Index v týmu, určuje ID a jméno
 * @param role - Počáteční specializace člena
 * @returns Nový člen týmu
 */
function makeMember(i: number, role: Role): Member {
  return {
    id: i,
    name: MEMBER_NAMES[i] ?? `P${i + 1}`,
    roles: [role],
    currentTask: null,
    idleSec: 0,
  }
}

/**
 * Vytvoří výchozí tým se 6 členy — jeden za každou specializaci.
 * Tím je zaručeno, že každý typ úkolu má alespoň jednoho zpracovatele.
 *
 * @returns Pole 6 členů týmu
 */
function defaultTeam(): Member[] {
  const defaults: Role[] = ['FE', 'BE', 'DSGN', 'QA', 'OPS', 'DATA']
  return defaults.map((r, i) => makeMember(i, r))
}

/**
 * Vytvoří čistou kopii featury ve stavu "backlog".
 * Používá se při resetování simulace — obnovíme původní featury,
 * ale s vynulovaným průběhem (jako kdyby nikdo nezačal pracovat).
 *
 * @param f - Původní featura (zpravidla ze snapshoту)
 * @returns Nová featura se stejnými vlastnostmi, ale čistým stavem
 */
function cloneFeatureFresh(f: Feature): Feature {
  return {
    ...f,
    status: 'backlog',
    startedAt: null,
    finishedAt: null,
    tasks: f.tasks.map(t => ({
      ...t,
      status: 'todo',
      progress: 0,
      assignee: null,
    })),
  }
}

/**
 * Vytvoří počáteční stav simulace s nově vygenerovaným backlogem.
 * Také uloží snapshot backlogu pro pozdější reset.
 *
 * @param rng        - Seeded RNG — stejný seed vždy vygeneruje stejný backlog
 * @param settings   - Nastavení simulace (počet features, variabilita)
 * @param roleConfig - Konfigurace specializací; výchozí = ROLE_META (zachovává stávající chování)
 * @returns Nový SimState připravený ke spuštění
 */
export function makeInitialState(
  rng: () => number,
  settings: SimSettings,
  roleConfig: Record<Role, RoleMeta> = ROLE_META,
): SimState {
  // Reset globálních čítačů zajistí, že ID a priority začínají od 1 při každé nové simulaci
  nextFeatureId = 1
  nextTaskId = 1
  nextPriority = 1

  const state: SimState = {
    backlog: [],
    backlogSnapshot: [],
    inProgress: [],
    done: [],
    team: defaultTeam(),
    leadTimes: [],
    simTime: 0,
    wipIntegral: 0,
    lastGenAt: 0,
    startedAt: null,
    finished: false,
  }

  const seedCount = settings.initialBacklog ?? 20
  for (let i = 0; i < seedCount; i++) {
    state.backlog.push(makeFeature(rng, 0, settings, roleConfig))
  }

  // Uložíme kopii backlogu jako snapshot — slouží k resetu bez regenerace
  state.backlogSnapshot = state.backlog.map(cloneFeatureFresh)

  return state
}

/**
 * Obnoví simulaci do počátečního stavu ze snapshotu.
 * Tým zůstane zachován (stejní členové, stejné role),
 * ale všechna přiřazení úkolů se zruší.
 * Rychlejší než regenerace — zaručuje identický backlog.
 *
 * @param state - Stav simulace, který bude resetován (mutován in-place)
 * @returns Stejný objekt state po resetu
 */
export function resetFromSnapshot(state: SimState): SimState {
  state.backlog = state.backlogSnapshot.map(cloneFeatureFresh)
  state.inProgress = []
  state.done = []
  state.leadTimes = []
  state.simTime = 0
  state.wipIntegral = 0
  state.lastGenAt = 0
  state.startedAt = null
  state.finished = false

  // Uvolníme všechna přiřazení a vynulujeme idle čas pro nový běh
  for (const m of state.team) {
    m.currentTask = null
    m.idleSec = 0
  }
  return state
}

/**
 * Vygeneruje nový simulační stav s novým náhodným seedem.
 * Na rozdíl od resetFromSnapshot vytvoří zcela jiný backlog.
 *
 * @param settings   - Nastavení pro generování nového backlogu
 * @param roleConfig - Konfigurace specializací; výchozí = ROLE_META
 * @returns Nový SimState a nový RNG (oba jsou třeba pro další tick volání)
 */
export function regenerate(
  settings: SimSettings,
  roleConfig: Record<Role, RoleMeta> = ROLE_META,
): { state: SimState; rng: () => number } {
  const rng = mulberry32(Math.floor(Math.random() * 1e9))
  const state = makeInitialState(rng, settings, roleConfig)
  return { state, rng }
}

/**
 * Spočítá počet předání mezi jednotkami pro jednu dokončenou feature.
 *
 * Předání nastane při přechodu fáze N → N+1, pokud člen který dokončil task
 * ve fázi N není mezi členy pracujícími ve fázi N+1.
 * Konkrétně: pro každý task fáze N, jehož assignee není v množině assignee fáze N+1,
 * přičteme 1 předání.
 *
 * @param feature    - Dokončená feature (všechny tasky mají assignee)
 * @param roleConfig - Konfigurace specializací; určuje level (fázi) každé role
 * @returns Počet předání (nezáporné celé číslo)
 */
export function computeHandoffs(feature: Feature, roleConfig: Record<Role, RoleMeta>): number {
  // Seskupíme tasky dle fáze (level) — každý level je jedna fáze zpracování
  const byLevel = new Map<number, typeof feature.tasks>()
  for (const t of feature.tasks) {
    const level = roleConfig[t.role].level
    const group = byLevel.get(level)
    if (group) group.push(t)
    else byLevel.set(level, [t])
  }

  // Seřadíme unikátní levely vzestupně pro procházení po sobě jdoucích přechodů
  const levels = [...byLevel.keys()].sort((a, b) => a - b)

  let handoffs = 0
  for (let i = 0; i < levels.length - 1; i++) {
    const current = byLevel.get(levels[i])!
    const next    = byLevel.get(levels[i + 1])!
    // Množina assignee ve fázi N+1 — pro rychlé vyhledávání
    const nextAssignees = new Set(next.map(t => t.assignee))
    // Každý task fáze N, jehož assignee v N+1 chybí, generuje 1 předání
    for (const t of current) {
      if (!nextAssignees.has(t.assignee)) handoffs++
    }
  }
  return handoffs
}

/**
 * Posune simulaci o jeden časový krok (jeden snímek animace).
 * Tato funkce je volána 60× za sekundu z requestAnimationFrame.
 *
 * Mutuje state in-place místo vrácení nové kopie — důvod je výkon:
 * vytváření nového objektu 60× za sekundu by zbytečně zatěžovalo garbage collector.
 *
 * Pořadí operací:
 * 1. Posuneme simulační čas
 * 2. Přiřadíme volné členy týmu k dostupným úkolům (s respektováním úrovní)
 * 3. Necháme přiřazené členy pokračovat v práci
 * 4. Dokončíme featury, kde jsou všechny úkoly hotovy
 * 5. Zkontrolujeme, zda je simulace u konce
 *
 * @param state      - Aktuální stav simulace (mutován in-place)
 * @param dtSim      - Délka tohoto ticku v simulačních sekundách
 * @param settings   - Konfigurace simulace
 * @param rng        - Seeded RNG pro případné doplnění backlogu
 * @param roleConfig - Konfigurace specializací (level, required); výchozí = ROLE_META
 * @param focusMode  - Zda členové preferují vlastní feature ('continuity') nebo nejvyšší prioritu ('priority')
 * @param wipMode    - Zda členové preferují in-progress features ('reduce-wip') nebo vybírají dle priority ('priority')
 * @returns Stejný objekt state po aktualizaci
 */
export function tick(
  state: SimState,
  dtSim: number,
  settings: SimSettings,
  rng: () => number,
  roleConfig: Record<Role, RoleMeta> = ROLE_META,
  focusMode: FocusMode = 'priority',
  wipMode: WipMode = 'priority',
): SimState {
  state.simTime += dtSim

  // Průběžně akumulujeme WIP × čas pro výpočet průměrného WIP (Little's Law)
  state.wipIntegral += state.inProgress.length * dtSim

  // Zaznamenáme čas prvního ticku jako startedAt simulace
  if (state.startedAt === null) state.startedAt = state.simTime

  // Doplníme backlog pokud klesl pod minimum.
  // V MVP je settings.minBacklog = 0, takže while podmínka nikdy není splněna
  // a backlog se automaticky nedoplňuje — zpracujeme jen to, co bylo vygenerováno na začátku.
  const minBacklog = settings.minBacklog
  while (state.backlog.length < minBacklog) {
    state.backlog.push(makeFeature(rng, state.simTime, settings, roleConfig))
  }

  // --- Přiřazování úkolů ---
  // Každý volný člen týmu dostane úkol z nejvíce prioritní dostupné feature.
  // Priorita platí po celou dobu simulace — člen si vybere to nejdůležitější,
  // bez ohledu na to, jestli feature leží v backlogu nebo je již rozběhnutá.
  //
  // Uvnitř každé feature platí pořadí fází: úkol fáze N lze začít až poté,
  // co jsou všechny úkoly nižší fáze (< N) v téže feature dokončeny.
  // Úkoly na stejné fázi mohou probíhat paralelně.
  for (const m of state.team) {
    if (m.currentTask) continue    // člen již pracuje
    if (m.roles.length === 0) continue // člen bez specializace nemůže pracovat

    /**
     * Zjistí, zda je konkrétní úkol dostupný pro aktuálního člena.
     * Úkol je dostupný, když:
     *  1. Je ve stavu 'todo'
     *  2. Člen má potřebnou roli
     *  3. Všechny úkoly nižší fáze v téže feature jsou hotovy
     */
    const isAvailable = (t: Task, f: Feature): boolean => {
      if (t.status !== 'todo') return false
      if (!m.roles.includes(t.role)) return false
      const taskLevel = roleConfig[t.role].level
      // Úkol fáze N může začít až poté, co jsou hotovy všechny úkoly fáze < N
      return f.tasks.every(
        other => roleConfig[other.role].level >= taskLevel || other.status === 'done'
      )
    }

    // Typ pro kandidátský úkol: feature + konkrétní task + pozice v backlogu (nebo -1)
    type Candidate = { f: Feature; t: Task; backlogIdx: number }
    const candidates: Candidate[] = []

    // Sbíráme kandidáty z backlogu — zapamatujeme si index, abychom feature mohli přesunout
    for (let i = 0; i < state.backlog.length; i++) {
      const f = state.backlog[i]
      const t = f.tasks.find(t => isAvailable(t, f))
      if (t) candidates.push({ f, t, backlogIdx: i })
    }

    // Sbíráme kandidáty z rozběhnutých features (backlogIdx = -1 = není v backlogu)
    for (const f of state.inProgress) {
      const t = f.tasks.find(t => isAvailable(t, f))
      if (t) candidates.push({ f, t, backlogIdx: -1 })
    }

    if (candidates.length === 0) continue

    // Třístupňové řazení — každý stupeň se uplatní jen pokud je příslušný režim aktivní:
    // 1. Reduce WIP: in-progress features před backlogovými
    // 2. Continuity: features kde člen již pracoval (má done task) před ostatními
    // 3. Priorita: vždy jako finální tiebreaker
    //
    // workedFeatureIds se předpočítá jednou před sort() — predikát závisí jen na f.id
    // a m.id, ne na argumentech comparatoru, takže je zbytečné ho počítat O(N log N)×.
    const workedFeatureIds = focusMode === 'continuity'
      ? new Set(candidates.filter(c => c.f.tasks.some(t => t.assignee === m.id && t.status === 'done')).map(c => c.f.id))
      : null
    candidates.sort((a, b) => {
      if (wipMode === 'reduce-wip') {
        // backlogIdx === -1 znamená feature je již v inProgress
        const wipDiff = (a.backlogIdx === -1 ? 0 : 1) - (b.backlogIdx === -1 ? 0 : 1)
        if (wipDiff !== 0) return wipDiff
      }
      if (workedFeatureIds) {
        const contDiff = (workedFeatureIds.has(a.f.id) ? 0 : 1) - (workedFeatureIds.has(b.f.id) ? 0 : 1)
        if (contDiff !== 0) return contDiff
      }
      return a.f.priority - b.f.priority
    })
    const best = candidates[0]

    // Pokud je nejvíce prioritní feature ještě v backlogu, přesuneme ji do inProgress
    if (best.backlogIdx >= 0) {
      state.backlog.splice(best.backlogIdx, 1)
      best.f.status = 'in-progress'
      best.f.startedAt = state.simTime
      state.inProgress.push(best.f)
    }

    best.t.status = 'doing'
    best.t.assignee = m.id
    m.currentTask = { featureId: best.f.id, taskId: best.t.id }
  }

  // Akumulujeme idle čas pro každého člena, který má role ale žádný úkol —
  // ale pouze pokud pro jeho roli ještě existuje práce (todo nebo doing).
  // Záměrně až PO přiřazovacím loopu — člen, který právě dostal úkol, idle čas nedostane.
  //
  // Podmínka "má práci pro svou roli":
  //   ∃ feature v backlogu nebo inProgress, která obsahuje task se stavem != 'done'
  //   a roli, kterou člen má.
  // Pokud taková práce neexistuje, člen není "blokován" — práce prostě skončila.
  // Idle čas pak nedává smysl počítat (workshop by ukazoval nesmyslné čekání
  // i po dokončení celé simulace nebo v teamech, kde daná role vůbec není potřeba).
  for (const m of state.team) {
    if (m.roles.length === 0 || m.currentTask !== null) continue
    // Dva oddělené .some() místo [...a, ...b].some() — vyhýbáme se zbytečné
    // alokaci dočasného pole, které by vznikalo 60× za sekundu × počet idle členů.
    const hasMatchingWork =
      state.backlog.some(f => f.tasks.some(t => t.status !== 'done' && m.roles.includes(t.role))) ||
      state.inProgress.some(f => f.tasks.some(t => t.status !== 'done' && m.roles.includes(t.role)))
    if (hasMatchingWork) m.idleSec += dtSim
  }

  // --- Postup práce ---
  // Každý rozpracovaný úkol se posune o dtSim; pokud dosáhne work, je hotov
  for (const f of state.inProgress) {
    for (const t of f.tasks) {
      if (t.status === 'doing') {
        t.progress += dtSim
        if (t.progress >= t.work) {
          // Zaokrouhlíme na přesnou hodnotu aby nevznikaly floating-point odchylky
          t.progress = t.work
          t.status = 'done'
          // Uvolníme člena týmu pro další úkol
          const m = state.team.find(m => m.id === t.assignee)
          if (m) m.currentTask = null
        }
      }
    }
  }

  // --- Dokončování features ---
  // Procházíme pozpátku, aby splice() nenarušil indexy zbývajících prvků
  for (let i = state.inProgress.length - 1; i >= 0; i--) {
    const f = state.inProgress[i]
    if (f.tasks.every(t => t.status === 'done')) {
      f.status = 'done'
      f.finishedAt = state.simTime

      // Uložíme Lead Time záznam pro statistiky; handoffs se počítají z aktuálního roleConfig
      const lt: LeadTimeEntry = {
        id: f.id,
        ms: f.finishedAt - f.createdAt,
        finishedAt: f.finishedAt,
        handoffs: computeHandoffs(f, roleConfig),
      }
      state.leadTimes.push(lt)

      // Omezíme historii na 200 záznamů aby nezabírala příliš paměti
      if (state.leadTimes.length > 200) state.leadTimes.shift()

      // Přidáme na začátek Done listu (nejnovější nahoře) a omezíme na 40 zobrazených
      state.done.unshift(f)
      if (state.done.length > 40) state.done.length = 40

      state.inProgress.splice(i, 1)
    }
  }

  // --- Detekce konce simulace ---
  // Simulace je dokončena, když není co dělat (backlog i inProgress jsou prázdné)
  if (state.backlog.length === 0 && state.inProgress.length === 0) {
    state.finished = true
  }

  return state
}

/**
 * Spočítá statistiky z historie Lead Time.
 * Výsledek se zobrazuje v StatTile komponentách a Lead Time grafu.
 *
 * @param leadTimes - Historie dokončených features s jejich Lead Time
 * @returns Objekt se statistikami (průměr, percentily, histogram)
 */
export function computeStats(leadTimes: LeadTimeEntry[]): SimStats {
  if (leadTimes.length === 0) {
    return { count: 0, avg: 0, min: 0, max: 0, p50: 0, p85: 0, buckets: [], bucketSize: 0, maxBucket: 0, avgHandoffs: 0 }
  }

  const vals = leadTimes.map(l => l.ms)
  const sorted = [...vals].sort((a, b) => a - b)
  const sum = vals.reduce((a, b) => a + b, 0)
  const avg = sum / vals.length

  // Percentilová funkce: vrátí hodnotu na pozici p (0–1) v seřazeném poli
  const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
  const min = sorted[0]
  const max = sorted[sorted.length - 1]

  // Histogram rozdělí hodnoty do 12 sloupců pro zobrazení v grafu
  const maxBucket = Math.max(20, Math.ceil(max / 5) * 5)
  const bucketCount = 12
  const bucketSize = maxBucket / bucketCount
  const buckets = new Array(bucketCount).fill(0) as number[]
  for (const v of vals) {
    // Zařadíme hodnotu do příslušného sloupce; poslední sloupec zachytí i outliers
    const idx = Math.min(bucketCount - 1, Math.floor(v / bucketSize))
    buckets[idx]++
  }

  const avgHandoffs = leadTimes.reduce((s, l) => s + l.handoffs, 0) / leadTimes.length

  return { count: vals.length, avg, min, max, p50: pct(0.5), p85: pct(0.85), buckets, bucketSize, maxBucket, avgHandoffs }
}
