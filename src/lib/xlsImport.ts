import * as XLSX from 'xlsx'
import type { Feature, Member, Role, RoleMeta, Task, TaskStatus, FeatureStatus } from '@/types/simulation'

/** Výsledek parsování XLS souboru — připravená data pro přímé vložení do SimState. */
export interface ImportResult {
  /** Vygenerovaný backlog — každá unikátní Feature hodnota = jedna položka. */
  features: Feature[]
  /** Vygenerovaný tým — každá unikátní Tym hodnota = jeden člen. */
  team: Member[]
  /** Konfigurace rolí — každá unikátní Specializace = jedna položka. */
  roleConfig: Record<Role, RoleMeta>
  /** Varování o přeskočených řádcích (neblokující). Prázdné pokud vše proběhlo v pořádku. */
  warnings: string[]
}

/** Meziprodukt — task před sestavením finálního Task objektu. */
interface RawTask {
  id: number
  role: string
  work: number
}

/** Výchozí sada hue hodnot pro nové role — cykluje se při překročení délky pole. */
const ROLE_HUES = [250, 285, 25, 145, 75, 320, 200, 350, 110, 180]

/** Výchozí sada hue hodnot pro features — stejná logika jako v engine.ts. */
const FEATURE_HUES = [12, 45, 90, 140, 180, 215, 260, 300, 335]

/**
 * Parsuje pole plain objektů (řádky z XLS) a vrátí ImportResult.
 * Tato funkce obsahuje veškerou logiku validace a transformace —
 * je oddělena od SheetJS, aby ji bylo možné testovat bez binárních souborů.
 *
 * @param rawRows - Pole objektů; klíče jsou názvy sloupců (case-insensitive, trimované)
 * @returns ImportResult s features, team, roleConfig a warnings
 * @throws Error s popisnou hláškou pokud chybí povinný sloupec, soubor je prázdný, nebo jsou překročeny limity
 */
export function parseRows(rawRows: Record<string, unknown>[]): ImportResult {
  // Přeskočíme zcela prázdné řádky (všechny hodnoty undefined/null/prázdný string)
  const rows = rawRows.filter(r =>
    Object.values(r).some(v => v !== undefined && v !== null && v !== ''),
  )

  if (rows.length === 0) {
    throw new Error('Soubor neobsahuje žádná data.')
  }

  // Normalizujeme klíče prvního řádku na lowercase+trim, abychom zjistili přítomnost sloupců
  const normalizeKey = (k: string) => k.trim().toLowerCase()
  const firstRowKeys = Object.keys(rows[0]).map(normalizeKey)

  const REQUIRED_COLUMNS = ['feature', 'specializace', 'tym', 'velikost'] as const
  for (const col of REQUIRED_COLUMNS) {
    if (!firstRowKeys.includes(col)) {
      const display = col.charAt(0).toUpperCase() + col.slice(1)
      throw new Error(`Soubor neobsahuje sloupec '${display}'. Zkontrolujte záhlaví.`)
    }
  }

  /**
   * Najde hodnotu sloupce v řádku nezávisle na velikosti písmen a mezerách.
   * Vrátí undefined pokud sloupec neexistuje.
   */
  function getCell(row: Record<string, unknown>, colName: string): unknown {
    for (const [k, v] of Object.entries(row)) {
      if (normalizeKey(k) === colName) return v
    }
    return undefined
  }

  // ── Průchod řádky — sbíráme data, validujeme a kontrolujeme limity inkrementálně ──

  /** Klíč pro detekci duplikátů: "Feature\0Specializace\0Tym" */
  const seen = new Set<string>()

  /** feature name → pole tasků (tasks přidáváme inkrementálně) */
  const featureTasksMap = new Map<string, { tasks: RawTask[]; hue: number }>()

  /** tym name → Set rolí */
  const tymRolesMap = new Map<string, Set<string>>()

  /** role key (uppercase) → pořadové číslo pro přiřazení barvy */
  const roleHueIndex = new Map<string, number>()

  let skippedCount = 0
  let featureCounter = 0
  let taskIdCounter = 1

  for (const row of rows) {
    const featureName = String(getCell(row, 'feature') ?? '').trim()
    const specializaceRaw = String(getCell(row, 'specializace') ?? '').trim()
    const tymRaw = String(getCell(row, 'tym') ?? '').trim()
    const velikostRaw = getCell(row, 'velikost')

    // Přeskočíme řádky bez hodnot v klíčových sloupcích
    if (!featureName || !specializaceRaw || !tymRaw) continue

    // Specializace → uppercase role key
    const role = specializaceRaw.toUpperCase()

    // Duplicate check — tiché přeskočení
    const dedupKey = `${featureName}\0${role}\0${tymRaw}`
    if (seen.has(dedupKey)) continue
    seen.add(dedupKey)

    // Velikost validace
    const velikost = Number(velikostRaw)
    if (!Number.isFinite(velikost) || velikost <= 0 || velikost > 999) {
      skippedCount++
      continue
    }

    // Feature inicializace + inline limit check
    if (!featureTasksMap.has(featureName)) {
      if (featureTasksMap.size >= 200) {
        throw new Error(`Příliš velký backlog (max. 200 features). Soubor obsahuje více než 200 unikátních features.`)
      }
      const hue = FEATURE_HUES[featureCounter % FEATURE_HUES.length]
      featureTasksMap.set(featureName, { tasks: [], hue })
      featureCounter++
    }

    featureTasksMap.get(featureName)!.tasks.push({ id: taskIdCounter++, role, work: velikost })

    // Tym → role mapping + inline limit check
    if (!tymRolesMap.has(tymRaw)) {
      if (tymRolesMap.size >= 50) {
        throw new Error(`Příliš mnoho členů týmu (max. 50). Soubor obsahuje více než 50 unikátních hodnot Tym.`)
      }
      tymRolesMap.set(tymRaw, new Set())
    }
    tymRolesMap.get(tymRaw)!.add(role)

    // Zaregistrujeme roli pokud ještě není
    if (!roleHueIndex.has(role)) {
      roleHueIndex.set(role, roleHueIndex.size)
    }
  }

  if (featureTasksMap.size === 0) {
    throw new Error('Soubor neobsahuje žádná platná data.')
  }

  // ── Sestavení výsledků ────────────────────────────────────────────────────

  const roleConfig: Record<Role, RoleMeta> = {}
  for (const [role, index] of roleHueIndex.entries()) {
    const hue = ROLE_HUES[index % ROLE_HUES.length]
    roleConfig[role] = {
      label: role,
      color: `oklch(68% 0.13 ${hue})`,
      level: 1,
      required: false,
    }
  }

  let featureId = 1
  const features: Feature[] = []
  for (const [name, { tasks: rawTasks, hue }] of featureTasksMap.entries()) {
    const fId = featureId++
    const tasks: Task[] = rawTasks.map(t => ({
      id: t.id,
      role: t.role,
      work: t.work,
      progress: 0,
      status: 'todo' as TaskStatus,
      assignee: null,
    }))
    features.push({
      id: fId,
      name,
      hue,
      tasks,
      createdAt: 0,
      startedAt: null,
      finishedAt: null,
      status: 'backlog' as FeatureStatus,
      priority: fId,
    })
  }

  let memberId = 1
  const team: Member[] = []
  for (const [name, rolesSet] of tymRolesMap.entries()) {
    team.push({
      id: memberId++,
      name,
      roles: Array.from(rolesSet),
      currentTask: null,
      idleSec: 0,
    })
  }

  const warnings: string[] = []
  if (skippedCount > 0) {
    warnings.push(`${skippedCount} řádků bylo přeskočeno (neplatná Velikost).`)
  }

  return { features, team, roleConfig, warnings }
}

/**
 * Parsuje ArrayBuffer XLS/XLSX souboru a vrátí ImportResult.
 * Tenký wrapper kolem parseRows — SheetJS převede binární data na plain objekty.
 *
 * @param buffer - Obsah souboru jako ArrayBuffer (čtený z File API)
 * @returns ImportResult — viz parseRows
 * @throws Error pokud soubor nelze přečíst nebo data nejsou validní
 */
export function parseXlsFile(buffer: ArrayBuffer): ImportResult {
  const workbook = XLSX.read(buffer, { type: 'array' })
  // Vždy použijeme první list
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error('Soubor neobsahuje žádná data.')

  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',   // prázdné buňky jako prázdný string, ne undefined
    raw: false,  // všechny hodnoty jako stringy — převádíme sami
  })

  return parseRows(rows)
}

/**
 * Vygeneruje prázdnou XLSX šablonu se správným záhlavím a příkladovými řádky.
 * Šablona se generuje čistě na klientu a stáhne se jako soubor.
 * Příkladové řádky jsou záměrně realistické — pomáhají koučovi pochopit formát.
 */
export function downloadTemplate(): void {
  const exampleRows = [
    { Feature: 'Login flow',       Specializace: 'FE',  Tym: 'Squad A', Velikost: 3 },
    { Feature: 'Login flow',       Specializace: 'BE',  Tym: 'Squad A', Velikost: 5 },
    { Feature: 'Login flow',       Specializace: 'QA',  Tym: 'Squad B', Velikost: 2 },
    { Feature: 'Dashboard',        Specializace: 'FE',  Tym: 'Squad A', Velikost: 4 },
    { Feature: 'Dashboard',        Specializace: 'BE',  Tym: 'Squad B', Velikost: 6 },
    { Feature: 'Payment gateway',  Specializace: 'BE',  Tym: 'Squad A', Velikost: 8 },
    { Feature: 'Payment gateway',  Specializace: 'QA',  Tym: 'Squad B', Velikost: 3 },
  ]

  const ws = XLSX.utils.json_to_sheet(exampleRows)

  // Nastavíme šířku sloupců pro lepší čitelnost
  ws['!cols'] = [
    { wch: 20 }, // Feature
    { wch: 14 }, // Specializace
    { wch: 14 }, // Tym
    { wch: 10 }, // Velikost
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Backlog')
  XLSX.writeFile(wb, 'org-flow-sablona.xlsx')
}
