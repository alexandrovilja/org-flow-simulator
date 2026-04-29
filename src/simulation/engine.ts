import type {
  Role, RoleMeta, Feature, Task, Member,
  SimState, SimSettings, SimStats, LeadTimeEntry,
} from '@/types/simulation'

/** Všechny dostupné specializace v systému — pořadí odpovídá výchozímu týmu. */
export const ROLES: Role[] = ['FE', 'BE', 'DSGN', 'QA', 'OPS', 'DATA']

/** Vizuální metadata pro každou roli: popisek a barva pro UI.
 *  Barvy jsou definovány v oklch prostoru pro konzistentní vzhled. */
export const ROLE_META: Record<Role, RoleMeta> = {
  FE:   { label: 'Frontend', color: 'oklch(70% 0.14 250)' },
  BE:   { label: 'Backend',  color: 'oklch(66% 0.14 285)' },
  DSGN: { label: 'Design',   color: 'oklch(72% 0.13 25)'  },
  QA:   { label: 'QA',       color: 'oklch(68% 0.13 145)' },
  OPS:  { label: 'DevOps',   color: 'oklch(68% 0.13 75)'  },
  DATA: { label: 'Data',     color: 'oklch(64% 0.14 320)' },
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
 *  Kratší jména záměrně — lépe se vejdou do karet v UI. */
const MEMBER_NAMES = ['Ada', 'Ben', 'Chen', 'Dani', 'Eli', 'Fae', 'Gus', 'Hari']

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

// Globální čítače ID — resetují se při každém volání makeInitialState,
// aby ID začínala od 1 při každé nové simulaci.
let nextFeatureId = 1
let nextTaskId = 1

/**
 * Vytvoří novou feature s náhodným počtem úkolů a rolí.
 * Variabilita je řízena parametry sizeVar a roleVar ze settings.
 *
 * @param rng     - Seeded random number generator pro determinismus
 * @param now     - Aktuální simulační čas (stane se createdAt featury)
 * @param settings - Nastavení simulace (sizeVar, roleVar)
 * @returns Nová feature připravená k vložení do backlogu
 */
function makeFeature(rng: () => number, now: number, settings: SimSettings): Feature {
  const id = nextFeatureId++

  // Barva a název se odvozují z ID, ne z RNG — jsou tedy předvídatelné
  const hue = FEATURE_HUES[(id - 1) % FEATURE_HUES.length]
  const name = FEATURE_NAMES[(id - 1) % FEATURE_NAMES.length]

  // Výpočet počtu úkolů: základní hodnota 3 ± rozptyl daný sizeVar
  const baseSize = 3
  const spread = Math.round(settings.sizeVar * 3)
  const minSize = Math.max(1, baseSize - spread)
  const maxSize = baseSize + spread
  const taskCount = minSize + Math.floor(rng() * (maxSize - minSize + 1))

  // Výpočet počtu různých rolí: základní hodnota 2 ± rozptyl daný roleVar
  const baseRoles = 2
  const roleSpread = Math.round(settings.roleVar * 4)
  const minRoles = Math.max(1, baseRoles - Math.floor(roleSpread / 2))
  const maxRoles = Math.min(ROLES.length, baseRoles + roleSpread)
  const roleCount = minRoles + Math.floor(rng() * (maxRoles - minRoles + 1))

  // Náhodně promícháme role a vybereme požadovaný počet
  const shuffled = [...ROLES].sort(() => rng() - 0.5)
  const chosenRoles = shuffled.slice(0, roleCount)

  // Rozdělíme taskCount úkolů mezi vybrané role — každá role dostane alespoň 1
  const counts = new Array(chosenRoles.length).fill(1) as number[]
  let remaining = taskCount - chosenRoles.length
  while (remaining > 0) {
    counts[Math.floor(rng() * chosenRoles.length)]++
    remaining--
  }

  // Vytvoříme jednotlivé úkoly s náhodnou pracností 0.8–2.2 simulačních sekund
  const tasks: Task[] = []
  for (let r = 0; r < chosenRoles.length; r++) {
    for (let i = 0; i < counts[r]; i++) {
      const work = 0.8 + rng() * 1.4
      tasks.push({
        id: nextTaskId++,
        role: chosenRoles[r],
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
 * @param rng      - Seeded RNG — stejný seed vždy vygeneruje stejný backlog
 * @param settings - Nastavení simulace (počet features, variabilita)
 * @returns Nový SimState připravený ke spuštění
 */
export function makeInitialState(rng: () => number, settings: SimSettings): SimState {
  // Reset globálních čítačů zajistí, že ID začínají od 1 při každé nové simulaci
  nextFeatureId = 1
  nextTaskId = 1

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
    state.backlog.push(makeFeature(rng, 0, settings))
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

  // Uvolníme všechna přiřazení — žádný člen nebude mít rozpracovaný úkol
  for (const m of state.team) {
    m.currentTask = null
  }
  return state
}

/**
 * Vygeneruje nový simulační stav s novým náhodným seedem.
 * Na rozdíl od resetFromSnapshot vytvoří zcela jiný backlog.
 *
 * @param settings - Nastavení pro generování nového backlogu
 * @returns Nový SimState a nový RNG (oba jsou třeba pro další tick volání)
 */
export function regenerate(settings: SimSettings): { state: SimState; rng: () => number } {
  const rng = mulberry32(Math.floor(Math.random() * 1e9))
  const state = makeInitialState(rng, settings)
  return { state, rng }
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
 * 2. Přiřadíme volné členy týmu k dostupným úkolům
 * 3. Necháme přiřazené členy pokračovat v práci
 * 4. Dokončíme featury, kde jsou všechny úkoly hotovy
 * 5. Zkontrolujeme, zda je simulace u konce
 *
 * @param state    - Aktuální stav simulace (mutován in-place)
 * @param dtSim    - Délka tohoto ticku v simulačních sekundách
 * @param settings - Konfigurace simulace
 * @param rng      - Seeded RNG pro případné doplnění backlogu
 * @returns Stejný objekt state po aktualizaci
 */
export function tick(
  state: SimState,
  dtSim: number,
  settings: SimSettings,
  rng: () => number,
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
    state.backlog.push(makeFeature(rng, state.simTime, settings))
  }

  // --- Přiřazování úkolů ---
  // Každý volný člen týmu dostane úkol odpovídající jeho specializaci
  for (const m of state.team) {
    if (m.currentTask) continue   // člen již pracuje
    if (m.roles.length === 0) continue // člen bez specializace nemůže pracovat

    let chosen: { f: Feature; t: Task } | null = null

    // Priorita 1: nová feature z backlogu — člen preferuje začínat nové věci
    // (tím přirozeně roste WIP, což prodlužuje Lead Time — záměrné pro workshop)
    for (let i = 0; i < state.backlog.length; i++) {
      const f = state.backlog[i]
      const t = f.tasks.find(t => t.status === 'todo' && m.roles.includes(t.role))
      if (t) {
        // Přesuneme featuru z backlogu do inProgress
        state.backlog.splice(i, 1)
        f.status = 'in-progress'
        f.startedAt = state.simTime
        state.inProgress.push(f)
        chosen = { f, t }
        break
      }
    }

    // Priorita 2: zbývající úkol v rozběhnuté feature (jen pokud backlog nic nenabídl)
    if (!chosen) {
      for (const f of state.inProgress) {
        const t = f.tasks.find(t => t.status === 'todo' && m.roles.includes(t.role))
        if (t) { chosen = { f, t }; break }
      }
    }

    if (chosen) {
      chosen.t.status = 'doing'
      chosen.t.assignee = m.id
      m.currentTask = { featureId: chosen.f.id, taskId: chosen.t.id }
    }
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

      // Uložíme Lead Time záznam pro statistiky
      const lt: LeadTimeEntry = { id: f.id, ms: f.finishedAt - f.createdAt, finishedAt: f.finishedAt }
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
    return { count: 0, avg: 0, min: 0, max: 0, p50: 0, p85: 0, buckets: [], bucketSize: 0, maxBucket: 0 }
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

  return { count: vals.length, avg, min, max, p50: pct(0.5), p85: pct(0.85), buckets, bucketSize, maxBucket }
}
