import * as XLSX from 'xlsx'
import { mulberry32, generateRevenueBatch } from '@/simulation/engine'
import type { Feature, Member, Role, RoleMeta, Task, TaskStatus, FeatureStatus } from '@/types/simulation'
import { roleColorForIndex } from '@/simulation/roleColors'

/** Výsledek parsování XLS souboru — připravená data pro přímé vložení do SimState. */
export interface ImportResult {
  /** Vygenerovaný backlog — každá unikátní Feature hodnota = jedna položka. */
  features: Feature[]
  /** Vygenerovaný tým — každá unikátní hodnota ve sloupci Unit = jedna jednotka. */
  team: Member[]
  /** Konfigurace rolí (skillů) — každá unikátní hodnota ve sloupci Skill = jedna položka. */
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
    throw new Error('The file contains no data.')
  }

  // Normalizujeme klíče prvního řádku na lowercase+trim, abychom zjistili přítomnost sloupců
  const normalizeKey = (k: string) => k.trim().toLowerCase()
  const firstRowKeys = Object.keys(rows[0]).map(normalizeKey)

  // Názvy sloupců jsou od feat-026 anglicky; staré české názvy (Specializace, Tym, Velikost) se nepřijímají
  const REQUIRED_COLUMNS = ['feature', 'skill', 'unit', 'size'] as const
  for (const col of REQUIRED_COLUMNS) {
    if (!firstRowKeys.includes(col)) {
      const display = col.charAt(0).toUpperCase() + col.slice(1)
      throw new Error(`The file has no '${display}' column. Check the header row.`)
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

  /** Klíč pro detekci duplikátů: "Feature\0Skill\0Unit" */
  const seen = new Set<string>()

  /** feature name → pole tasků (tasks přidáváme inkrementálně) */
  const featureTasksMap = new Map<string, { tasks: RawTask[]; hue: number }>()

  /** název jednotky (sloupec Unit) → Set rolí */
  const unitRolesMap = new Map<string, Set<string>>()

  /** role key (uppercase) → pořadové číslo pro přiřazení barvy */
  const roleHueIndex = new Map<string, number>()

  let skippedCount = 0
  let featureCounter = 0
  let taskIdCounter = 1

  for (const row of rows) {
    const featureName = String(getCell(row, 'feature') ?? '').trim()
    const skillRaw = String(getCell(row, 'skill') ?? '').trim()
    const unitRaw = String(getCell(row, 'unit') ?? '').trim()
    const sizeRaw = getCell(row, 'size')

    // Přeskočíme řádky bez hodnot v klíčových sloupcích
    if (!featureName || !skillRaw || !unitRaw) continue

    // Skill → klíč role velkými písmeny
    const role = skillRaw.toUpperCase()

    // Duplicate check — tiché přeskočení
    const dedupKey = `${featureName}\0${role}\0${unitRaw}`
    if (seen.has(dedupKey)) continue
    seen.add(dedupKey)

    // Validace velikosti (sloupec Size): kladné číslo nejvýš 999
    const size = Number(sizeRaw)
    if (!Number.isFinite(size) || size <= 0 || size > 999) {
      skippedCount++
      continue
    }

    // Feature inicializace + inline limit check
    if (!featureTasksMap.has(featureName)) {
      if (featureTasksMap.size >= 200) {
        throw new Error('Backlog too large (max 200 features). The file contains more than 200 unique features.')
      }
      const hue = FEATURE_HUES[featureCounter % FEATURE_HUES.length]
      featureTasksMap.set(featureName, { tasks: [], hue })
      featureCounter++
    }

    featureTasksMap.get(featureName)!.tasks.push({ id: taskIdCounter++, role, work: size })

    // Unit → mapování rolí + průběžná kontrola limitu
    if (!unitRolesMap.has(unitRaw)) {
      if (unitRolesMap.size >= 50) {
        throw new Error('Too many units (max 50). The file contains more than 50 unique values in the Unit column.')
      }
      unitRolesMap.set(unitRaw, new Set())
    }
    unitRolesMap.get(unitRaw)!.add(role)

    // Zaregistrujeme roli pokud ještě není
    if (!roleHueIndex.has(role)) {
      roleHueIndex.set(role, roleHueIndex.size)
    }
  }

  if (featureTasksMap.size === 0) {
    throw new Error('The file contains no valid data.')
  }

  // ── Sestavení výsledků ────────────────────────────────────────────────────

  const roleConfig: Record<Role, RoleMeta> = {}
  for (const [role, index] of roleHueIndex.entries()) {
    roleConfig[role] = {
      label: role,
      // Import nahrazuje celou sadu rolí, proto sloty od prvního v pořadí výskytu (feat-021)
      color: roleColorForIndex(index),
      level: 1,
      required: false,
    }
  }

  // Stejné Gaussovo rozdělení jako u seedovaného backlogu (makeInitialState, feat-015
  // Příklad 2) — feature na pozici 0 (nejvyšší priorita = pořadí v souboru) dostane
  // nejvyšší výnos. Fixní seed udržuje parseRows() deterministickou (stejný soubor →
  // stejný výsledek), zatímco Cash Flow backlog je pro import stejně relevantní jako
  // pro Advanced, takže výnos nemůže být plochý.
  const importRng = mulberry32(42)
  const revenueBatch = generateRevenueBatch(importRng, featureTasksMap.size)
  // Seed kostek coordination overhead (feat-016) z téhož pevného proudu jako výnos, generovaný až
  // po něm — výnos se tím nemění a stejný soubor dá vždy stejný backlog i stejný běh.
  const coordSeeds = Array.from({ length: featureTasksMap.size }, () => Math.floor(importRng() * 2 ** 31))

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
      revenuePerTick: revenueBatch[fId - 1],
      totalRevenue: 0,
      lastTickRevenue: null,
      lastRevenueTickAt: 0,
      // Tvar výnosu (feat-017): import vždy začíná na Flat, aktuální volbu přepínače mu nastaví
      // hook Cash Flow (Advanced profil nepoužívá).
      revenueProfile: 'flat',
      revenueTickCount: 0,
      // Čítače coordination overhead (feat-016)
      joinCount: 0,
      reworkCount: 0,
      joinTaxSec: 0,
      reworkSec: 0,
      workedBy: [],
      pendingDivergence: [],
      coordSeed: coordSeeds[fId - 1],
    })
  }

  let memberId = 1
  const team: Member[] = []
  for (const [name, rolesSet] of unitRolesMap.entries()) {
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
    warnings.push(`${skippedCount} ${skippedCount === 1 ? 'row' : 'rows'} skipped (invalid Size).`)
  }

  return { features, team, roleConfig, warnings }
}

/**
 * Složí zprávu o výsledku importu, kterou kouč uvidí pod tlačítky importu: „Imported 8 features,
 * 18 tasks, 2 units.“ a případná varování (přeskočené řádky) za ní. Sdílí ji Advanced i
 * Cash Flow, aby oba módy říkaly totéž stejnými slovy.
 *
 * @param result - Výsledek úspěšného importu (viz parseRows)
 * @returns Anglická věta; počty v jednotném čísle u 1 („1 feature“)
 */
export function formatImportSummary(result: ImportResult): string {
  const taskCount = result.features.reduce((n, f) => n + f.tasks.length, 0)
  // Anglické množné číslo se liší jen koncovým „s“; u přesně jedné položky zůstává jednotné
  const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`
  const summary = `Imported ${count(result.features.length, 'feature')}, ${count(taskCount, 'task')}, ${count(result.team.length, 'unit')}.`
  return result.warnings.length > 0 ? `${summary} ${result.warnings.join(' ')}` : summary
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
  if (!sheetName) throw new Error('The file contains no data.')

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
    { Feature: 'Login flow',       Skill: 'FE',  Unit: 'Squad A', Size: 3 },
    { Feature: 'Login flow',       Skill: 'BE',  Unit: 'Squad A', Size: 5 },
    { Feature: 'Login flow',       Skill: 'QA',  Unit: 'Squad B', Size: 2 },
    { Feature: 'Dashboard',        Skill: 'FE',  Unit: 'Squad A', Size: 4 },
    { Feature: 'Dashboard',        Skill: 'BE',  Unit: 'Squad B', Size: 6 },
    { Feature: 'Payment gateway',  Skill: 'BE',  Unit: 'Squad A', Size: 8 },
    { Feature: 'Payment gateway',  Skill: 'QA',  Unit: 'Squad B', Size: 3 },
  ]

  const ws = XLSX.utils.json_to_sheet(exampleRows)

  // Nastavíme šířku sloupců pro lepší čitelnost
  ws['!cols'] = [
    { wch: 20 }, // Feature
    { wch: 14 }, // Skill
    { wch: 14 }, // Unit
    { wch: 10 }, // Size
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Backlog')
  XLSX.writeFile(wb, 'org-flow-template.xlsx')
}
