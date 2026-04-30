/** Jedna ze šesti specializací, které může mít člen týmu.
 *  Každý úkol (Task) vyžaduje právě jednu roli — člen může úkol
 *  zpracovat jen pokud tuto roli má. */
export type Role = 'FE' | 'BE' | 'DSGN' | 'QA' | 'OPS' | 'DATA'

/** Konfigurace jedné specializace — zobrazovaná metadata i pravidla pro simulaci.
 *  Uložena v Record<Role, RoleMeta> v engine (výchozí) i v komponentě Simulator (uživatelská). */
export interface RoleMeta {
  /** Zobrazované jméno specializace v UI (editovatelné uživatelem). */
  label: string
  /** Barva specializace v oklch prostoru — slouží k vizuálnímu rozlišení v UI. */
  color: string
  /**
   * Fáze specializace — určuje pořadí fází v rámci jedné feature.
   * Nižší číslo = dřívější fáze. Level 1 = první fáze (začíná jako první).
   * Příklad: Design (level 1) → FE+BE (level 2) → QA (level 3).
   * Úkoly na stejné úrovni mohou probíhat paralelně.
   * Výchozí hodnota 1 = všechny role ve stejné fázi (chování jako dosud).
   */
  level: number
  /**
   * Pokud true, každá vygenerovaná feature musí obsahovat alespoň jeden úkol
   * této specializace — bez ohledu na nastavení roleVar.
   */
  required: boolean
}

/** Stav jednoho úkolu v průběhu jeho zpracování. */
export type TaskStatus = 'todo' | 'doing' | 'done'

/** Stav celé feature — kde se právě nachází v procesu. */
export type FeatureStatus = 'backlog' | 'in-progress' | 'done'

/** Jeden atomický pracovní úkol uvnitř feature.
 *  Feature se skládá z více úkolů různých rolí — všechny musí být
 *  dokončeny, aby byla feature hotova. */
export interface Task {
  /** Unikátní identifikátor úkolu napříč celou simulací. */
  id: number
  /** Role, kterou musí mít člen týmu, aby mohl tento úkol zpracovat. */
  role: Role
  /** Celkové množství práce potřebné k dokončení úkolu (v simulačních sekundách). */
  work: number
  /** Kolik práce již bylo odvedeno. Úkol je hotov, když progress >= work. */
  progress: number
  status: TaskStatus
  /** ID člena týmu, který úkol právě zpracovává. Null pokud nikdo. */
  assignee: number | null
}

/** Jedna feature (položka backlogu) procházející vývojovým procesem.
 *  Sledujeme časy vytvoření, zahájení a dokončení, abychom mohli
 *  měřit Lead Time (čas od vytvoření do dodání). */
export interface Feature {
  /** Unikátní identifikátor feature napříč celou simulací. */
  id: number
  /** Zobrazovaný název, např. "F-001 Login flow". */
  name: string
  /** Odstín barvy (hue) pro vizuální rozlišení feature v UI (0–360). */
  hue: number
  /** Seznam všech úkolů, které je potřeba dokončit. */
  tasks: Task[]
  /** Simulační čas, kdy byla feature přidána do backlogu. */
  createdAt: number
  /** Simulační čas, kdy tým začal na feature pracovat. Null dokud nezačala. */
  startedAt: number | null
  /** Simulační čas, kdy byla feature dokončena. Null dokud není hotova. */
  finishedAt: number | null
  status: FeatureStatus
  /** Priorita přiřazená při vytvoření — platí po celou dobu simulace bez ohledu
   *  na to, jestli je feature v backlogu nebo inProgress.
   *  Nižší číslo = vyšší priorita (1 = nejdůležitější).
   *  Členové týmu vždy pracují na nejvíce prioritní feature, na které mohou přispět. */
  priority: number
}

/** Jeden člen vývojového týmu.
 *  Člen může mít více specializací (rolí) a v každém okamžiku
 *  zpracovává nejvýše jeden úkol. */
export interface Member {
  /** Unikátní identifikátor člena. */
  id: number
  name: string
  /** Seznam specializací, které člen má — určuje, jaké úkoly může zpracovat. */
  roles: Role[]
  /** Odkaz na úkol, který člen právě zpracovává. Null pokud je idle. */
  currentTask: { featureId: number; taskId: number } | null
  /**
   * Kumulovaný idle čas v simulačních sekundách.
   * Narůstá každý tick, kdy má člen alespoň jednu roli ale žádný úkol.
   * Člen bez rolí idle čas neakumuluje — nemůže pracovat ze strukturálních důvodů.
   */
  idleSec: number
}

/** Jeden záznam o době dokončení feature (Lead Time).
 *  Ukládáme historii, abychom mohli počítat statistiky jako průměr a percentily. */
export interface LeadTimeEntry {
  /** ID dokončené feature. */
  id: number
  /** Délka Lead Time v simulačních sekundách (finishedAt - createdAt). */
  ms: number
  /** Simulační čas, kdy byla feature dokončena — slouží pro výpočet throughput. */
  finishedAt: number
  /** Počet předání mezi jednotkami: kolikrát bylo nutné předat práci jinému členu
   *  při přechodu mezi fázemi. Závisí na konfiguraci fází (level) a cross-funkčnosti týmu. */
  handoffs: number
}

/** Celý stav simulace v jednom okamžiku.
 *  Tento objekt je mutován přímo při každém volání tick() místo
 *  vytváření nové kopie — důvod je výkon (60 snímků za sekundu). */
export interface SimState {
  /** Features čekající na zpracování. */
  backlog: Feature[]
  /** Kopie počátečního backlogu uložená při spuštění.
   *  Slouží k resetu simulace do původního stavu bez nutnosti regenerace. */
  backlogSnapshot: Feature[]
  /** Features, na kterých tým právě pracuje. */
  inProgress: Feature[]
  /** Posledních 40 dokončených features (starší se zahazují kvůli paměti). */
  done: Feature[]
  team: Member[]
  /** Historie Lead Time pro výpočet statistik. Ukládáme max. 200 záznamů. */
  leadTimes: LeadTimeEntry[]
  /** Uplynulý simulační čas v sekundách od spuštění. */
  simTime: number
  /** Průběžný součet WIP × čas — slouží k výpočtu průměrného WIP (Little's Law).
   *  Každý tick přičteme: počet features v inProgress × délka ticku. */
  wipIntegral: number
  /** Simulační čas posledního automatického doplnění backlogu (nepoužívá se v MVP). */
  lastGenAt: number
  /** Simulační čas, kdy simulace poprvé začala — null dokud uživatel neklikne Start. */
  startedAt: number | null
  /** True pokud byly zpracovány všechny položky backlogu.
   *  Po nastavení na true se simulace automaticky zastaví a tlačítko Start
   *  se deaktivuje — simulaci lze obnovit pouze resetem nebo novým backlogem. */
  finished: boolean
}

/** Uživatelsky nastavitelné parametry simulace.
 *  Ovlivňují, jak se generuje backlog a jak tým pracuje. */
export interface SimSettings {
  /** Minimální počet features v backlogu — engine automaticky doplní pokud klesne pod tuto hodnotu.
   *  V MVP nastaveno na 0, takže backlog se nedoplňuje automaticky. */
  minBacklog: number
  /** Maximální počet features zpracovávaných současně (Work In Progress limit).
   *  Aktuálně nevyužíváno přímo enginem — WIP roste přirozeně podle kapacity týmu. */
  wipLimit: number
  /** Variabilita velikosti features (0–1).
   *  0 = všechny features mají stejný počet úkolů, 1 = velký rozptyl (1 až 6 úkolů). */
  sizeVar: number
  /** Variabilita rolí požadovaných na features (0–1).
   *  0 = každá feature vyžaduje stejné 2 role, 1 = náhodný mix 1 až 6 rolí. */
  roleVar: number
  /** Počet features vygenerovaných na začátku simulace. */
  initialBacklog: number
  /**
   * Minimální počet různých specializací, které musí každá feature obsahovat.
   * Hodnota 1 = výchozí (žádný vynucený minimum), hodnota 6 = každá feature vyžaduje všechny role.
   * Platí při generování nového backlogu nebo inicializaci.
   */
  minSpecializations: number
}

/** Vypočtené statistiky z historie Lead Time.
 *  Slouží k zobrazení v grafu a StatTile komponentách. */
export interface SimStats {
  /** Počet dokončených features, ze kterých jsou statistiky počítány. */
  count: number
  /** Průměrná Lead Time (aritmetický průměr). */
  avg: number
  /** Nejkratší Lead Time. */
  min: number
  /** Nejdelší Lead Time. */
  max: number
  /** Medián — 50 % features bylo dokončeno rychleji než tato hodnota. */
  p50: number
  /** 85. percentil — 85 % features bylo dokončeno rychleji.
   *  Používá se jako "výstražná hranice" v Lead Time grafu. */
  p85: number
  /** Histogram hodnot Lead Time rozdělený do buckets pro zobrazení v grafu. */
  buckets: number[]
  /** Šířka jednoho bucketu v grafu (v simulačních sekundách). */
  bucketSize: number
  /** Maximální hodnota osy Y histogramu. */
  maxBucket: number
  /** Průměrný počet předání mezi jednotkami na feature.
   *  Odráží míru koordinační zátěže — nižší = efektivnější tok práce. */
  avgHandoffs: number
}

/** Režim přiřazování úkolů z hlediska kontinuity — zda člen preferuje vlastní feature.
 *  'priority'   = vždy nejvýše prioritní dostupná feature (výchozí)
 *  'continuity' = preferuje feature, na které již pracoval; snižuje počet předání */
export type FocusMode = 'priority' | 'continuity'

/** Režim přiřazování úkolů z hlediska WIP — zda člen preferuje rozběhnuté features.
 *  'priority'    = žádné rozlišení mezi backlogem a in-progress (výchozí)
 *  'reduce-wip'  = in-progress features jsou preferovány před backlogovými */
export type WipMode = 'priority' | 'reduce-wip'
