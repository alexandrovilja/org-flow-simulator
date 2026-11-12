import { memo, useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useScrollIntoView } from '@/hooks/useScrollIntoView'
import { PanelHeader } from '@/components/PanelHeader'
import { EmptyNote } from '@/components/EmptyNote'
import { StatTile } from '@/components/StatTile'
import { ResultsAside } from '@/components/ResultsAside'
import { DoneRow } from '@/components/DoneRow'
import { RoleChip } from '@/components/RoleChip'
import { WorkTimeValue } from '@/components/WorkTimeValue'
import { formatDaysValue } from '@/lib/formatTime'
import { orgFeatureHue, orgFlowView, orgMetrics, validateOrgSetup } from '@/simulation/organizationEngine'
import { addMandate, removeMandate } from '@/simulation/organizationSetup'
import type { CssVariables } from '@/types/css'
import type { Role, RoleMeta } from '@/types/simulation'
import type {
  OrgArea, OrgFeature, OrgFlowView, OrgIdleMember, OrgPerson, OrgPersonStatus, OrgRunSnapshot, OrgSetup, OrgSimState,
  OrgTask, OrgTaskStatus, OrgTeam,
} from '@/types/organization'
import styles from './OrganizationView.module.css'
import tone from './FeatureTone.module.css'

/** Props celé plochy módu Organization (feat-028, feat-029). */
export interface OrganizationViewProps {
  /** Organizace, kterou panel zobrazuje (a před během upravuje). */
  setup: OrgSetup
  /** Úprava organizace před během: dostane novou organizaci, vstup se nemění. */
  onSetupChange: (next: OrgSetup) => void
  /** Stav běhu z enginu (backlog, rozpracované, hotové, čas). */
  state: OrgSimState
  /** Běh začal (i v pauze a po doběhnutí): panel organizace je jen ke čtení až do Resetu. */
  locked: boolean
  /** Poslední doběhnutý běh před Resetem; `null` = srovnání není s čím (první běh). */
  previousRun: OrgRunSnapshot | null
}

/** Názvy oblastí podle kódu — pro tooltipy štítků. */
type AreaNames = Record<string, string>

/** Člověk s týmem podle id člověka — pro jméno a tým v tooltipech rozpracovaných úkolů. */
type PeopleIndex = ReadonlyMap<number, OrgIdleMember>

/** Stav toku práce mimo běh (před prvním krokem a po doběhnutí): nikdo nepracuje, nic nečeká. */
const NO_FLOW: OrgFlowView = { people: new Map(), waiting: new Map() }

/** Text v tooltipu dlaždice Idle Time (spec feat-029, Metrics). */
const IDLE_TOOLTIP = 'Person-days that people spent without a task while work for their skills was still open in the organization.'

/**
 * Kódy oblastí featury v pořadí, v jakém se poprvé objeví mezi úkoly.
 *
 * @param f - Featura
 * @returns Kódy oblastí bez duplicit
 */
function featureAreas(f: OrgFeature): string[] {
  return [...new Set(f.tasks.map(t => t.area))]
}

/**
 * Celková pracnost featury v pracovních dnech.
 *
 * @param f - Featura
 * @returns Součet pracnosti všech úkolů
 */
function featureWork(f: OrgFeature): number {
  return f.tasks.reduce((sum, t) => sum + t.work, 0)
}

// Název featury „F-001 Login flow“: číslo a zbytek názvu
const FEATURE_NAME_RE = /^(F-\d+)\s+(.*)$/

/**
 * Číslo featury z jejího názvu, např. „F-001“ z „F-001 Login flow“ — pro štítky a řádky lidí.
 *
 * @param name - Celý název featury
 * @returns Číslo featury (celý název, když nemá obvyklý tvar)
 */
function featureCode(name: string): string {
  return FEATURE_NAME_RE.exec(name)?.[1] ?? name
}

/**
 * Název featury, ve kterém se v úzkém sloupci zkrátí jen slovní část: číslo featury zůstane vždy celé,
 * aby šla featura na projektoru poznat. Celý název je v tooltipu.
 *
 * @param props - Celý název featury, např. „F-001 Login flow“
 * @returns Vykreslený název
 */
function FeatureName({ name }: { name: string }) {
  const match = FEATURE_NAME_RE.exec(name)
  if (!match) return <span className={styles.featureName} title={name}><span className={styles.featureTitle}>{name}</span></span>
  return (
    <span className={styles.featureName} title={name}>
      <span className={styles.featureCode}>{match[1]}</span>{' '}<span className={styles.featureTitle}>{match[2]}</span>
    </span>
  )
}

/**
 * Procentuální změna proti předchozímu běhu pro delty dlaždic (stejný výpočet jako v Cash Flow).
 *
 * @param current - Hodnota tohoto běhu (`null` = ještě není)
 * @param previous - Hodnota předchozího běhu (`null` = nebyla)
 * @returns Změna v procentech, nebo `undefined`, když srovnání nedává smysl (chybí hodnota, předchozí je 0)
 */
function percentChange(current: number | null, previous: number | null): number | undefined {
  if (current === null || previous === null || previous === 0) return undefined
  return ((current - previous) / previous) * 100
}

/**
 * Text s počtem, např. „3 teams“ nebo „1 person“.
 *
 * @param n - Počet
 * @param one - Tvar pro jednu položku
 * @param many - Tvar pro více položek
 * @returns Počet s tvarem slova
 */
function counted(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

/**
 * Stav úkolu pro zobrazení: uložený stav, u nepřiděleného úkolu „waiting“, když ho stav toku práce vede mezi
 * čekajícími (feat-029, R2).
 *
 * @param task - Úkol
 * @param flow - Stav toku práce v tomto snímku
 * @returns Stav úkolu
 */
function taskStatusOf(task: OrgTask, flow: OrgFlowView): OrgTaskStatus {
  if (task.status !== 'todo') return task.status
  return flow.waiting.has(task) ? 'waiting' : 'todo'
}

/**
 * Lidé organizace s týmy podle id.
 *
 * @param setup - Organizace
 * @returns Id člověka → člověk a tým
 */
function indexPeople(setup: OrgSetup): PeopleIndex {
  return new Map(setup.teams.flatMap(team => team.people.map(person => [person.id, { person, team }] as const)))
}

/** Props štítku oblasti. */
interface AreaTagProps {
  /** Kód oblasti, např. „BIL“. */
  code: string
  /** Celý název oblasti do tooltipu. */
  name: string | undefined
  /** Stav oblasti u rozpracované featury; bez něj je štítek neutrální (backlog). */
  state?: 'open' | 'done' | 'waiting'
  /** Štítek v rozbalených úkolech: stejný vzhled, ale bez `data-testid` a `data-state` řádku featury. */
  plain?: boolean
}

/**
 * Obrysový štítek oblasti. U rozpracované featury hotová oblast zezelená a dostane „✓“, oblast s čekajícím
 * úkolem zežloutne (feat-029).
 *
 * @param props - Kód, název a volitelný stav oblasti
 * @returns Vykreslený štítek
 */
function AreaTag({ code, name, state, plain }: AreaTagProps) {
  const done = state === 'done'
  const stateClass = done ? styles.areaTagDone : state === 'waiting' ? styles.areaTagWait : ''
  return (
    <span
      data-testid={state && !plain ? 'org-area-tag' : undefined}
      data-state={plain ? undefined : state}
      title={name}
      className={`${styles.areaTag} ${stateClass}`}
    >
      {done ? `✓ ${code}` : code}
    </span>
  )
}

/** Props detailu položky backlogu. */
interface BacklogDetailProps {
  feature: OrgFeature
  roleConfig: Record<Role, RoleMeta>
  /** Týmy organizace (s mandáty, které kouč právě nastavil). */
  teams: OrgTeam[]
  areaNames: AreaNames
}

/**
 * Detail rozbalené položky backlogu (feat-029): priorita, počet úkolů a práce, po oblastech čipy úkolů a týmy
 * s mandátem, nebo červené upozornění, že oblast nemá žádný tým.
 *
 * @param props - Featura, skilly, týmy a názvy oblastí
 * @returns Vykreslený detail
 */
function BacklogDetail({ feature, roleConfig, teams, areaNames }: BacklogDetailProps) {
  const work = featureWork(feature)
  return (
    <div className={styles.backlogDetail}>
      <div className={styles.detailMeta}>
        {`Priority ${feature.priority} · ${counted(feature.tasks.length, 'task', 'tasks')} · ${counted(work, 'day of work', 'days of work')}`}
      </div>
      {featureAreas(feature).map(area => {
        const owners = teams.filter(t => t.mandates.includes(area)).map(t => t.name)
        return (
          <div key={area} className={styles.detailArea}>
            <AreaTag code={area} name={areaNames[area]} />
            {feature.tasks.filter(t => t.area === area).map(t => (
              <RoleChip
                key={t.id}
                role={t.role}
                color={roleConfig[t.role]?.color ?? 'var(--ink-4)'}
                label={`${roleConfig[t.role]?.label ?? t.role} · ${t.work} d`}
              />
            ))}
            {owners.length > 0
              ? <span className={styles.detailMandate}>{`Mandate: ${owners.join(', ')}`}</span>
              : <span className={styles.detailNoMandate}>No team has a mandate for this area</span>}
          </div>
        )
      })}
    </div>
  )
}

/** Props položky backlogu. */
interface BacklogItemProps {
  feature: OrgFeature
  roleConfig: Record<Role, RoleMeta>
  /** Pracnost největší featury — šířka pruhu pracnosti je k ní poměrná. */
  maxWork: number
  areaNames: AreaNames
  teams: OrgTeam[]
  /** Položka je rozbalená (detail místo pruhu pracnosti). */
  open: boolean
  onToggle: (featureId: number) => void
}

/**
 * Položka backlogu: číslo a název featury, štítky oblastí a pruh pracnosti z barevných segmentů úkolů
 * seskupených po oblastech. Kliknutím se rozbalí na detail s úkoly a mandáty (feat-029).
 *
 * @param props - Featura, skilly, největší pracnost, názvy oblastí, týmy a stav rozbalení
 * @returns Vykreslená položka
 */
function BacklogItem({ feature, roleConfig, maxWork, areaNames, teams, open, onToggle }: BacklogItemProps) {
  const work = featureWork(feature)
  const groups = featureAreas(feature).map(area => ({ area, tasks: feature.tasks.filter(t => t.area === area) }))
  return (
    <div data-testid="org-backlog-item" className={styles.backlogItem}>
      <button type="button" className={styles.itemButton} aria-expanded={open} title="Show or hide details" onClick={() => onToggle(feature.id)}>
        <span className={styles.itemTop}>
          <FeatureName name={feature.name} />
          <span className={styles.tags}>
            {groups.map(g => <AreaTag key={g.area} code={g.area} name={areaNames[g.area]} />)}
          </span>
        </span>
        {/* Šířka pruhu = pracnost featury vůči největší featuře backlogu */}
        {!open && (
          <span className={styles.effort} style={{ width: `${(work / maxWork) * 100}%` }} title={`${work} days of work`}>
            {groups.map(g => (
              <span key={g.area} className={styles.effortGroup} style={{ flexGrow: g.tasks.reduce((s, t) => s + t.work, 0) }}>
                {g.tasks.map(t => {
                  const segmentStyle: CssVariables = { flexGrow: t.work, '--role': roleConfig[t.role]?.color ?? 'var(--ink-4)' }
                  return <span key={t.id} className={styles.effortSegment} style={segmentStyle} />
                })}
              </span>
            ))}
          </span>
        )}
      </button>
      {open && <BacklogDetail feature={feature} roleConfig={roleConfig} teams={teams} areaNames={areaNames} />}
    </div>
  )
}

/** Props levého sloupce. */
interface BacklogPanelProps {
  backlog: OrgFeature[]
  /** Backlog před během — z něj se bere největší pracnost, aby se pruhy za běhu nepřeměřovaly. */
  snapshot: OrgFeature[]
  roleConfig: Record<Role, RoleMeta>
  areaNames: AreaNames
  /** Týmy z organizace, kterou panel upravuje — detail položky z nich bere mandáty. */
  teams: OrgTeam[]
}

/**
 * Levý sloupec: backlog seřazený podle priority. Je memoizovaný — engine vytvoří nové pole backlogu jen
 * když featura začne a týmy se mění jen s mandáty, takže se 100 položek nepřekresluje v každém snímku běhu.
 * Rozbalené položky jsou jen pohled; Reset je nezavře.
 */
const BacklogPanel = memo(function BacklogPanel({ backlog, snapshot, roleConfig, areaNames, teams }: BacklogPanelProps) {
  const sorted = useMemo(() => [...backlog].sort((a, b) => a.priority - b.priority), [backlog])
  const maxWork = useMemo(() => snapshot.reduce((max, f) => Math.max(max, featureWork(f)), 1), [snapshot])
  const [openItems, setOpenItems] = useState<ReadonlySet<number>>(() => new Set())
  const toggleItem = useCallback((id: number) => setOpenItems(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }), [])
  return (
    <section aria-label="Backlog" className={styles.side}>
      <PanelHeader title="Backlog" count={backlog.length} />
      <div className={styles.backlogList}>
        {sorted.length === 0 && <EmptyNote>Backlog is empty.</EmptyNote>}
        {sorted.map(f => (
          <BacklogItem
            key={f.id}
            feature={f}
            roleConfig={roleConfig}
            maxWork={maxWork}
            areaNames={areaNames}
            teams={teams}
            open={openItems.has(f.id)}
            onToggle={toggleItem}
          />
        ))}
      </div>
    </section>
  )
})

/** Props segmentu úkolu v rozbalené featuře. */
interface TaskSegmentProps {
  task: OrgTask
  status: OrgTaskStatus
  roleConfig: Record<Role, RoleMeta>
  people: PeopleIndex
  /** U čekajícího úkolu idle lidé z týmů bez mandátu, kteří by ho uměli. */
  blocked: OrgIdleMember[] | undefined
}

/**
 * Segment úkolu s šířkou podle pracnosti (feat-029): hotový plný s „✓“, rozpracovaný s výplní podle postupu
 * a prvním písmenem jména člověka, čekající šrafovaný, „to do“ jen světlý. Tooltip říká skill a stav.
 *
 * @param props - Úkol, jeho stav, skilly, lidé a idle lidé bez mandátu
 * @returns Vykreslený segment
 */
function TaskSegment({ task, status, roleConfig, people, blocked }: TaskSegmentProps) {
  const label = roleConfig[task.role]?.label ?? task.role
  const segmentStyle: CssVariables = { flexGrow: task.work, '--role': roleConfig[task.role]?.color ?? 'var(--ink-4)' }
  let title = `${label} · to do`
  let fill = 0
  let mark = ''
  let progress: number | undefined
  if (status === 'done') {
    title = `${label} · done`
    fill = 100
    mark = '✓'
  } else if (status === 'doing') {
    const worker = task.assignee !== null ? people.get(task.assignee) : undefined
    progress = task.work > 0 ? Math.round((task.progress / task.work) * 100) : 0
    fill = progress
    title = worker ? `${label} · ${worker.person.name} (${worker.team.name})` : `${label} · in progress`
    mark = worker?.person.name.charAt(0) ?? ''
  } else if (status === 'waiting') {
    const list = blocked ?? []
    // Týmy idle lidí bez duplicit, v pořadí panelu (seznam lidí je v pořadí panelu)
    const teams = [...new Set(list.map(m => m.team.name))]
    title = `${label} · waiting · ${counted(list.length, 'idle person', 'idle people')} with this skill in ${teams.join(', ')}`
  }
  const statusClass = status === 'waiting' ? styles.taskWaiting : status === 'done' ? styles.taskDone : ''
  return (
    <span data-testid="org-task" data-status={status} data-progress={progress} title={title} className={`${styles.task} ${statusClass}`} style={segmentStyle}>
      {fill > 0 && <span className={styles.taskFill} style={{ width: `${fill}%` }} />}
      {mark && <span className={styles.taskMark}>{mark}</span>}
    </span>
  )
}

/** Props řádku rozpracované featury. */
interface FeatureRowProps {
  feature: OrgFeature
  areaNames: AreaNames
  roleConfig: Record<Role, RoleMeta>
  flow: OrgFlowView
  people: PeopleIndex
  /** Úkoly featury jsou rozbalené. */
  open: boolean
  onToggle: (featureId: number) => void
  /** Featura je zvýrazněná po skoku z panelu organizace. */
  highlighted: boolean
  /** Předá prvek řádku rodiči, aby ho po skoku mohl posunout do viditelné části. */
  registerRow: (featureId: number, el: HTMLElement | null) => void
}

/**
 * Řádek rozpracované featury: číslo, název a štítky oblastí (hotová zelená, čekající žlutá), pod ním pruh postupu
 * (hotová práce / celková práce). Kliknutím se rozbalí úkoly po oblastech a poznámka „Waiting · WEB“ (feat-029).
 * Tón řádku je podle odstínu featury jako v ostatních módech.
 *
 * @param props - Featura, názvy oblastí, skilly, stav toku práce, lidé, rozbalení a zvýraznění
 * @returns Vykreslený řádek
 */
function FeatureRow({ feature, areaNames, roleConfig, flow, people, open, onToggle, highlighted, registerRow }: FeatureRowProps) {
  const total = featureWork(feature)
  const doneWork = feature.tasks.reduce((sum, t) => sum + Math.min(t.progress, t.work), 0)
  const pct = total > 0 ? Math.round((doneWork / total) * 100) : 0
  const hueStyle: CssVariables = { '--hue': orgFeatureHue(feature.id) }
  const areas = featureAreas(feature).map(area => {
    const tasks = feature.tasks.filter(t => t.area === area)
    const statuses = tasks.map(t => taskStatusOf(t, flow))
    const state: 'done' | 'waiting' | 'open' = statuses.every(s => s === 'done') ? 'done' : statuses.includes('waiting') ? 'waiting' : 'open'
    return { area, tasks, statuses, state }
  })
  const waitingAreas = areas.filter(a => a.state === 'waiting').map(a => a.area)
  const rowClass = `${styles.featureRow} ${tone.tone}${highlighted ? ` ${styles.highlighted}` : ''}`
  // Stabilní ref callback: nová funkce v každém snímku by řádek v každém snímku odregistrovala a znovu registrovala
  const featureId = feature.id
  const rowRef = useCallback((el: HTMLDivElement | null) => registerRow(featureId, el), [registerRow, featureId])
  return (
    <div
      ref={rowRef}
      data-testid="org-feature-row"
      data-feature-id={feature.id}
      data-highlighted={highlighted ? 'true' : undefined}
      className={rowClass}
      style={hueStyle}
    >
      <button type="button" className={styles.featureToggle} aria-expanded={open} title="Show or hide tasks" onClick={() => onToggle(feature.id)}>
        <span className={`${styles.swatch} ${tone.swatch}`} aria-hidden="true" />
        <FeatureName name={feature.name} />
        <span className={styles.tags}>
          {areas.map(a => <AreaTag key={a.area} code={a.area} name={areaNames[a.area]} state={a.state} />)}
        </span>
      </button>
      {open && (
        <div className={styles.taskDetail}>
          {areas.map(a => (
            <div key={a.area} className={styles.taskArea}>
              <AreaTag code={a.area} name={areaNames[a.area]} state={a.state === 'waiting' ? 'waiting' : undefined} plain />
              <span className={styles.taskTrack}>
                {a.tasks.map((t, i) => (
                  <TaskSegment key={t.id} task={t} status={a.statuses[i]} roleConfig={roleConfig} people={people} blocked={flow.waiting.get(t)} />
                ))}
              </span>
            </div>
          ))}
          {waitingAreas.length > 0 && <div className={styles.waitNote}>{`Waiting · ${waitingAreas.join(', ')}`}</div>}
        </div>
      )}
      <div
        role="progressbar"
        aria-label={`${feature.name} progress`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        title={`${pct} % of the work is done`}
        className={styles.progress}
      >
        <span className={`${styles.progressFill} ${tone.fill}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/** Props řádku týmu před během. */
interface SetupTeamRowProps {
  team: OrgTeam
  areas: OrgArea[]
  roleConfig: Record<Role, RoleMeta>
  /** Lidé týmu jsou rozbalení. */
  open: boolean
  onToggle: () => void
  /** Nabídka přidání mandátu je otevřená. */
  menuOpen: boolean
  onToggleMenu: () => void
  onCloseMenu: () => void
  onAddMandate: (code: string) => void
  onRemoveMandate: (code: string) => void
}

/**
 * Řádek týmu před během (sloupce Team | People | Mandate): šipka pro rozbalení lidí, název, tečky skillů,
 * počet lidí a štítky mandátů s × a tlačítkem + pro přidání. Rozbalený tým ukáže lidi jen ke čtení.
 *
 * @param props - Tým, oblasti, skilly, stav rozbalení a nabídky a callbacky úprav mandátů
 * @returns Vykreslený řádek (včetně nabídky a lidí)
 */
function SetupTeamRow({
  team, areas, roleConfig, open, onToggle, menuOpen, onToggleMenu, onCloseMenu, onAddMandate, onRemoveMandate,
}: SetupTeamRowProps) {
  const areaNames = Object.fromEntries(areas.map(a => [a.code, a.name]))
  // Oblasti, na které tým mandát ještě nemá, v pořadí oblastí
  const free = areas.filter(a => !team.mandates.includes(a.code))
  // Tečky skillů: každý skill, který v týmu někdo umí, jednou a v pořadí konfigurace
  const teamSkills = Object.keys(roleConfig).filter(k => team.people.some(p => p.skills.includes(k)))
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Po otevření nabídky přejde fokus na první oblast, aby šla nabídka ovládat klávesnicí
  useEffect(() => {
    if (menuOpen) menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
  }, [menuOpen])

  /**
   * Klávesy v nabídce: šipky přesouvají fokus mezi oblastmi (dokola), Esc nabídku zavře a vrátí fokus na +.
   *
   * @param e - Stisk klávesy uvnitř nabídky
   */
  const handleMenuKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCloseMenu()
      addButtonRef.current?.focus()
      return
    }
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0
    if (step === 0 || !menuRef.current) return
    e.preventDefault()
    const items = Array.from(menuRef.current.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
    const current = items.findIndex(item => item === document.activeElement)
    items[(current + step + items.length) % items.length]?.focus()
  }

  return (
    <div data-testid="org-team-row" className={styles.teamRow}>
      <div className={styles.setupLine}>
        <span className={styles.teamCell}>
          <button type="button" className={styles.chevron} aria-expanded={open} aria-label="Show or hide people" onClick={onToggle}>
            {open ? '▾' : '▸'}
          </button>
          <span className={styles.teamName}>{team.name}</span>
          <span className={styles.skillDots}>
            {teamSkills.map(k => {
              const dotStyle: CssVariables = { '--role': roleConfig[k].color }
              return <span key={k} className={styles.skillDot} style={dotStyle} title={roleConfig[k].label} />
            })}
          </span>
        </span>
        <span className={styles.peopleCount}>{team.people.length} people</span>
        <span className={styles.mandates}>
          {team.mandates.map(code => (
            <span key={code} className={styles.mandateTag} title={areaNames[code]}>
              {code}
              <button type="button" className={styles.mandateRemove} aria-label={`Remove mandate ${code}`} onClick={() => onRemoveMandate(code)}>×</button>
            </span>
          ))}
          {team.mandates.length === 0 && <span className={styles.noMandate}>No mandate</span>}
          {free.length > 0 && (
            <button ref={addButtonRef} type="button" className={styles.addMandate} aria-label="Add mandate" title="Add mandate" aria-haspopup="menu" aria-expanded={menuOpen} onClick={onToggleMenu}>+</button>
          )}
        </span>
      </div>

      {menuOpen && free.length > 0 && (
        // Esc a šipky obsluhuje handleMenuKeyDown; výběr oblasti nabídku zavře (řeší rodič)
        <div className={styles.picker} onKeyDown={handleMenuKeyDown}>
          <div ref={menuRef} role="menu" aria-label={`Add mandate to ${team.name}`} className={styles.pickerItems}>
            {free.map(a => (
              <button key={a.code} type="button" role="menuitem" className={styles.pickerItem} onClick={() => onAddMandate(a.code)}>
                <span className={styles.pickerCode}>{a.code}</span>{' '}<span className={styles.pickerName}>{a.name}</span>
              </button>
            ))}
          </div>
          <button type="button" className={styles.pickerClose} aria-label="Close" onClick={onCloseMenu}>×</button>
        </div>
      )}

      {open && (
        <div className={styles.people}>
          {team.people.map(p => (
            <div key={p.id} data-testid="org-person" className={styles.person}>
              <span className={styles.personName}>{p.name}</span>
              <span className={styles.personSkills}>
                {p.skills.map(k => <RoleChip key={k} role={k} color={roleConfig[k]?.color ?? 'var(--ink-4)'} label={roleConfig[k]?.label} />)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** Props karty člověka za běhu. */
interface RunPersonCardProps {
  person: OrgPerson
  status: OrgPersonStatus
  roleConfig: Record<Role, RoleMeta>
  /** Rozpracované featury podle čísla — pro úkol, na kterém člověk pracuje. */
  features: ReadonlyMap<number, OrgFeature>
  areaNames: AreaNames
}

/**
 * Karta člověka za běhu (feat-029), jen ke čtení: jméno, čipy skillů a stav — úkol „F-001 · BIL · QA“ s pruhem
 * postupu, šedé „Idle“, nebo žlutá karta s „Idle“ a tooltipem, ve kterých oblastech jeho práce čeká mimo mandát.
 *
 * @param props - Člověk, jeho stav, skilly, rozpracované featury a názvy oblastí
 * @returns Vykreslená karta
 */
function RunPersonCard({ person, status, roleConfig, features, areaNames }: RunPersonCardProps) {
  let state = <span data-tone="idle" className={styles.idleText}>Idle</span>
  if (status.kind === 'working') {
    const feature = features.get(status.featureId)
    const task = feature?.tasks.find(t => t.id === status.taskId)
    if (feature && task) {
      const pct = task.work > 0 ? Math.round((task.progress / task.work) * 100) : 0
      const barStyle: CssVariables = { '--role': roleConfig[task.role]?.color ?? 'var(--ink-4)' }
      state = (
        <>
          <span className={styles.personTask}>{`${featureCode(feature.name)} · ${task.area} · ${roleConfig[task.role]?.label ?? task.role}`}</span>
          <span
            role="progressbar"
            aria-label={`${person.name} task progress`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            className={styles.personProgress}
            style={barStyle}
          >
            <span className={styles.personProgressFill} style={{ width: `${pct}%` }} />
          </span>
        </>
      )
    }
  } else if (status.kind === 'blocked') {
    const where = status.areas.map(code => areaNames[code] ?? code).join(', ')
    state = <span data-tone="blocked" className={styles.idleText} title={`Idle while work for their skills waits in ${where}`}>Idle</span>
  }
  return (
    <div data-testid="org-person" className={status.kind === 'blocked' ? `${styles.person} ${styles.personBlocked}` : styles.person}>
      <span className={styles.personName}>{person.name}</span>
      <span className={styles.personSkills}>
        {person.skills.map(k => <RoleChip key={k} role={k} color={roleConfig[k]?.color ?? 'var(--ink-4)'} label={roleConfig[k]?.label} />)}
      </span>
      <span className={styles.personState}>{state}</span>
    </div>
  )
}

/** Props řádku týmu za běhu. */
interface RunTeamRowProps {
  team: OrgTeam
  areaNames: AreaNames
  roleConfig: Record<Role, RoleMeta>
  flow: OrgFlowView
  /** Rozpracované featury podle čísla. */
  features: ReadonlyMap<number, OrgFeature>
  /** Běh doběhl: Working on ukazuje „—“. */
  finished: boolean
  /** Počítat idle lidi (jen za běhu: od prvního kroku do doběhnutí). */
  countIdle: boolean
  /** Lidé týmu jsou rozbalení. */
  open: boolean
  onToggle: () => void
  /** Skok na featuru v In progress. */
  onJump: (featureId: number) => void
}

/**
 * Řádek týmu za běhu (sloupce Team | Mandate | People | Working on), jen ke čtení: šipka pro rozbalení lidí,
 * název, štítky mandátů, pruh lidí (pracuje / žlutý idle / idle) s „pracuje / celkem“ a štítky featur, na kterých
 * lidé týmu pracují, s počtem idle lidí (feat-029).
 *
 * @param props - Tým, oblasti, skilly, stav toku práce, rozpracované featury, doběhnutí, počítání idle, rozbalení a skok
 * @returns Vykreslený řádek
 */
function RunTeamRow({ team, areaNames, roleConfig, flow, features, finished, countIdle, open, onToggle, onJump }: RunTeamRowProps) {
  const statuses = team.people.map(p => flow.people.get(p.id) ?? { kind: 'idle' as const })
  const working = statuses.filter(s => s.kind === 'working').length
  const blocked = statuses.filter(s => s.kind === 'blocked').length
  const idle = team.people.length - working - blocked
  // Featury, na kterých lidé týmu pracují: číslo featury → počet lidí, seřazené podle čísla
  const onFeature = new Map<number, number>()
  for (const s of statuses) if (s.kind === 'working') onFeature.set(s.featureId, (onFeature.get(s.featureId) ?? 0) + 1)
  const chips = [...onFeature].sort((a, b) => a[0] - b[0])
  const idleTotal = blocked + idle
  const barTitle = `${working} working, ${idleTotal} idle${blocked > 0 ? ` (${blocked} while work for their skills waits in another area)` : ''}`

  return (
    <div data-testid="org-team-row" className={styles.teamRow}>
      <div className={styles.runLine}>
        <span className={styles.teamCell}>
          <button type="button" className={styles.chevron} aria-expanded={open} aria-label="Show or hide people" onClick={onToggle}>
            {open ? '▾' : '▸'}
          </button>
          <span className={styles.teamName}>{team.name}</span>
        </span>
        <span className={styles.mandates}>
          {team.mandates.map(code => <span key={code} className={styles.mandateTag} title={areaNames[code]}>{code}</span>)}
          {team.mandates.length === 0 && <span className={styles.none}>none</span>}
        </span>
        <span data-testid="org-people-bar" data-working={working} data-blocked={blocked} data-idle={idle} className={styles.peopleCell} title={barTitle}>
          <span className={styles.peopleBar} aria-hidden="true">
            <span className={styles.peopleWorking} style={{ flexGrow: working }} />
            <span className={styles.peopleBlocked} style={{ flexGrow: blocked }} />
            <span className={styles.peopleIdle} style={{ flexGrow: idle }} />
          </span>
          <span className={styles.peopleCount}>{working}/{team.people.length}</span>
        </span>
        <span className={styles.workingOn}>
          {finished ? <span className={styles.none}>—</span> : (
            <>
              {chips.map(([featureId, count]) => {
                const feature = features.get(featureId)
                const name = feature?.name ?? `F-${featureId}`
                const hueStyle: CssVariables = { '--hue': orgFeatureHue(featureId) }
                return (
                  <button
                    key={featureId}
                    type="button"
                    className={styles.workChip}
                    style={hueStyle}
                    title={`${name} · ${count} from ${team.name}. Click to show the feature.`}
                    onClick={() => onJump(featureId)}
                  >
                    <span className={`${styles.chipSwatch} ${tone.swatch}`} aria-hidden="true" />
                    {featureCode(name)}
                    {count > 1 && <>{' '}<em className={styles.chipCount}>{`×${count}`}</em></>}
                  </button>
                )
              })}
              {countIdle && idleTotal > 0 && <span data-tone={blocked > 0 ? 'blocked' : 'idle'} className={styles.idleCount}>{`${idleTotal} idle`}</span>}
            </>
          )}
        </span>
      </div>
      {open && (
        <div className={styles.people}>
          {team.people.map((p, i) => (
            <RunPersonCard key={p.id} person={p} status={statuses[i]} roleConfig={roleConfig} features={features} areaNames={areaNames} />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Řádky seznamu Done, nejnověji dokončená featura nahoře. Memoizované: engine vytvoří nové pole Done jen
 * při dokončení featury, takže se seznam (až 100 řádků) nepřekresluje v každém snímku běhu.
 */
const DoneRows = memo(function DoneRows({ done }: { done: OrgFeature[] }) {
  return (
    <>
      {[...done].reverse().map(f => (
        <div key={f.id} data-testid="org-done-row">
          <DoneRow
            hue={orgFeatureHue(f.id)}
            name={f.name}
            detail={featureAreas(f).join(' · ')}
            value={`${formatDaysValue((f.finishedAt ?? 0) - (f.startedAt ?? 0))} d`}
          />
        </div>
      ))}
    </>
  )
})

/** Props panelu organizace. */
interface OrganizationPanelProps {
  setup: OrgSetup
  onSetupChange: (next: OrgSetup) => void
  state: OrgSimState
  locked: boolean
  warnings: string[]
  flow: OrgFlowView
  /** Rozpracované featury podle čísla. */
  features: ReadonlyMap<number, OrgFeature>
  /** Skok na featuru v In progress (klik na štítek featury u týmu). */
  onJump: (featureId: number) => void
  /** Běh probíhá (od prvního kroku do doběhnutí, i v pauze): jen tehdy se počítají idle lidé. */
  running: boolean
}

/**
 * Panel organizace: hlavička se souhrnem, varování kontroly před během a řádky týmů. Před během jde měnit
 * mandáty, za běhu je panel jen ke čtení a ukazuje, kdo na čem pracuje a kdo je idle (feat-029).
 *
 * @param props - Organizace, callback úprav, stav běhu, zamčení, varování, stav toku práce, skok na featuru a běh
 * @returns Vykreslený panel
 */
function OrganizationPanel({ setup, onSetupChange, state, locked, warnings, flow, features, onJump, running }: OrganizationPanelProps) {
  // Rozbalené týmy a otevřená nabídka mandátů jsou jen stav zobrazení, do organizace nepatří.
  // Rozbalení platí před během i za běhu
  const [openTeams, setOpenTeams] = useState<ReadonlySet<number>>(() => new Set())
  const [menuTeamId, setMenuTeamId] = useState<number | null>(null)
  // Otevřená nabídka mandátů se zamčením zavře, jinak by se po Resetu znovu sama ukázala. Úprava stavu
  // přímo při vykreslení (místo efektu) ji zavře hned v tomtéž překreslení
  if (locked && menuTeamId !== null) setMenuTeamId(null)

  const people = setup.teams.reduce((n, t) => n + t.people.length, 0)
  const summary = `${counted(setup.teams.length, 'team', 'teams')} · ${counted(people, 'person', 'people')}`
  const note = !locked
    ? 'Click + to add a mandate'
    : state.finished ? 'Reset to change the organization' : 'Skills, AI and mandates are locked during the run'
  const areaNames: AreaNames = Object.fromEntries(setup.areas.map(a => [a.code, a.name]))

  // Idle lidé v celé organizaci jen za běhu (ne před prvním krokem ani po doběhnutí); žlutá, když je mezi nimi
  // žlutý idle
  const allPeople = setup.teams.flatMap(t => t.people)
  const idleStatuses = running
    ? allPeople.map(p => flow.people.get(p.id) ?? { kind: 'idle' as const }).filter(s => s.kind !== 'working')
    : []
  const anyBlocked = idleStatuses.some(s => s.kind === 'blocked')

  const toggleTeam = (id: number) => setOpenTeams(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  return (
    <section aria-label="Organization" className={styles.org}>
      <PanelHeader title="Organization" count={summary}>
        {idleStatuses.length > 0 && (
          <span data-tone={anyBlocked ? 'blocked' : 'idle'} className={styles.headIdle}>{`${idleStatuses.length} idle`}</span>
        )}
      </PanelHeader>
      <p className={styles.note}>{note}</p>

      {warnings.length > 0 && (
        <div role="alert" className={styles.warn}>
          <div className={styles.warnTitle}>Run is disabled</div>
          <ul className={styles.warnList}>
            {warnings.map(w => <li key={w}>{w}</li>)}
          </ul>
        </div>
      )}

      <div className={locked ? `${styles.columns} ${styles.runLine}` : `${styles.columns} ${styles.setupLine}`} aria-hidden="true">
        {locked
          ? <><span>Team</span><span>Mandate</span><span>People</span><span>Working on</span></>
          : <><span>Team</span><span>People</span><span>Mandate</span></>}
      </div>

      <div className={styles.teams}>
        {setup.teams.map(team => (locked
          ? (
            <RunTeamRow
              key={team.id}
              team={team}
              areaNames={areaNames}
              roleConfig={setup.roleConfig}
              flow={flow}
              features={features}
              finished={state.finished}
              countIdle={running}
              open={openTeams.has(team.id)}
              onToggle={() => toggleTeam(team.id)}
              onJump={onJump}
            />
          )
          : (
            <SetupTeamRow
              key={team.id}
              team={team}
              areas={setup.areas}
              roleConfig={setup.roleConfig}
              open={openTeams.has(team.id)}
              onToggle={() => toggleTeam(team.id)}
              menuOpen={menuTeamId === team.id}
              onToggleMenu={() => setMenuTeamId(id => (id === team.id ? null : team.id))}
              onCloseMenu={() => setMenuTeamId(null)}
              onAddMandate={code => { setMenuTeamId(null); onSetupChange(addMandate(setup, team.id, code)) }}
              onRemoveMandate={code => onSetupChange(removeMandate(setup, team.id, code))}
            />
          )))}
      </div>
    </section>
  )
}

/**
 * Celá plocha módu Organization (feat-028, feat-029) ve třech sloupcích: vlevo Backlog, uprostřed
 * In progress a Organization, vpravo Metrics a Done. Komponenta jen zobrazuje stav z enginu; úpravy
 * organizace posílá rodiči přes `onSetupChange`. Vrací tři sourozence, které rozloží mřížka Simulatoru.
 *
 * Stav zobrazení (rozbalené featury, filtr čekajících featur a zvýraznění po skoku) drží komponenta; když se běh
 * vrátí na začátek (Reset), vrátí se na začátek i zobrazení.
 *
 * @param props - Organizace, callback úprav, stav běhu, zamčení a předchozí běh pro srovnání
 * @returns Tři sloupce módu
 */
export function OrganizationView({ setup, onSetupChange, state, locked, previousRun }: OrganizationViewProps) {
  const metrics = orgMetrics(state)
  // Kontrola před během; za běhu se organizace nemění, takže varování nejsou potřeba
  const warnings = useMemo(
    () => (locked ? [] : validateOrgSetup(setup, state.backlogSnapshot)),
    [locked, setup, state.backlogSnapshot],
  )
  const areaNames = useMemo<AreaNames>(() => Object.fromEntries(setup.areas.map(a => [a.code, a.name])), [setup.areas])
  const peopleIndex = useMemo(() => indexPeople(state.setup), [state.setup])
  // Běh probíhá od prvního kroku do doběhnutí (i v pauze); jen tehdy má smysl, kdo pracuje, kdo je idle a co čeká
  const running = locked && state.simTime > 0 && !state.finished
  // Engine mění stav na místě, proto se stav toku práce za běhu počítá v každém snímku znovu (jeden průchod)
  const flow = running ? orgFlowView(state) : NO_FLOW
  const features = new Map(state.inProgress.map(f => [f.id, f]))
  const waitingIds = new Set(state.inProgress.filter(f => f.tasks.some(t => flow.waiting.has(t))).map(f => f.id))

  const [openFeatures, setOpenFeatures] = useState<ReadonlySet<number>>(() => new Set())
  const [waitingOnly, setWaitingOnly] = useState(false)
  // Poslední skok na featuru (`key` = číslo featury); `seq` dělá z každého kliku nový objekt, aby se featura znovu
  // posunula do viditelné části i při opakovaném kliku
  const [jump, setJump] = useState<{ key: number; seq: number } | null>(null)
  // Běh se vrátil na začátek (engine ho při Resetu i u nového stavu vede jako nezačatý): zobrazení In progress se
  // vrátí na začátek. Signál bere ze stavu běhu, ne ze zamčení panelu. Úprava stavu při vykreslení místo efektu
  const pristine = state.startedAt === null
  const [wasPristine, setWasPristine] = useState(pristine)
  if (wasPristine !== pristine) {
    setWasPristine(pristine)
    if (pristine) {
      setOpenFeatures(new Set())
      setWaitingOnly(false)
      setJump(null)
    }
  }
  // Když už nic nečeká, filtr zmizí a vypne se, aby se při dalším čekání neukázal sám zapnutý
  if (waitingOnly && waitingIds.size === 0) setWaitingOnly(false)
  const filterOn = waitingOnly && waitingIds.size > 0
  const shown = filterOn ? state.inProgress.filter(f => waitingIds.has(f.id)) : state.inProgress

  const toggleFeature = useCallback((id: number) => setOpenFeatures(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }), [])

  // Po skoku se zvýrazněný řádek posune do viditelné části seznamu (až po vykreslení, řádek mohl být skrytý filtrem)
  const registerRow = useScrollIntoView(jump)

  /**
   * Skok na featuru z panelu organizace: vypne filtr, featuru rozbalí a zvýrazní; posun obstará useScrollIntoView.
   *
   * @param id - Číslo featury
   */
  const handleJump = useCallback((id: number) => {
    setWaitingOnly(false)
    setOpenFeatures(prev => (prev.has(id) ? prev : new Set(prev).add(id)))
    setJump(prev => ({ key: id, seq: (prev?.seq ?? 0) + 1 }))
  }, [])

  // Delty proti předchozímu běhu jako v Cash Flow: Total Time a Idle Time (oba se za běhu sčítají) až po doběhnutí,
  // průměry hned, jak mají hodnotu
  const timeDelta = previousRun && state.finished ? percentChange(metrics.totalTime, previousRun.totalTime) : undefined
  const cycleDelta = previousRun ? percentChange(metrics.avgCycleTime, previousRun.avgCycleTime) : undefined
  const wipDelta = previousRun ? percentChange(metrics.avgWip, previousRun.avgWip) : undefined
  const idleDelta = previousRun && state.finished ? percentChange(metrics.idleTime, previousRun.idleTime) : undefined
  // Před během Idle Time „—“, od prvního kroku číslo (i 0.0)
  const started = state.simTime > 0

  const filterChip = waitingIds.size > 0 ? (
    <button type="button" className={styles.waitFilter} aria-pressed={filterOn} title="Show only features with waiting tasks" onClick={() => setWaitingOnly(!filterOn)}>
      {`${waitingIds.size} waiting`}
    </button>
  ) : null

  return (
    <>
      <BacklogPanel backlog={state.backlog} snapshot={state.backlogSnapshot} roleConfig={state.setup.roleConfig} areaNames={areaNames} teams={setup.teams} />

      <div className={styles.center}>
        <section aria-label="In progress" className={styles.inProgress}>
          <PanelHeader title="In progress" count={state.inProgress.length} hint="Click a feature to see its tasks" actions={filterChip} />
          <div className={styles.featureList}>
            {state.inProgress.length === 0 && (
              <EmptyNote gridColumn="1 / -1">{state.finished ? 'All features are done.' : 'Nothing in flight.'}</EmptyNote>
            )}
            {shown.map(f => (
              <FeatureRow
                key={f.id}
                feature={f}
                areaNames={areaNames}
                roleConfig={state.setup.roleConfig}
                flow={flow}
                people={peopleIndex}
                open={openFeatures.has(f.id)}
                onToggle={toggleFeature}
                highlighted={jump?.key === f.id}
                registerRow={registerRow}
              />
            ))}
          </div>
        </section>

        <OrganizationPanel
          setup={setup}
          onSetupChange={onSetupChange}
          state={state}
          locked={locked}
          warnings={warnings}
          flow={flow}
          features={features}
          onJump={handleJump}
          running={running}
        />
      </div>

      <ResultsAside
        sampleCount={metrics.doneCount}
        doneCount={metrics.doneCount}
        isEmpty={state.done.length === 0}
        tiles={<>
          <StatTile label="Total Time" value={<WorkTimeValue days={metrics.totalTime} />} variant="timer" finished={state.finished} wide tooltip="Elapsed time in working days (5 working days = 1 week)." delta={timeDelta} />
          <StatTile label="Avg Cycle Time" value={metrics.avgCycleTime !== null ? formatDaysValue(metrics.avgCycleTime) : '—'} unit={metrics.avgCycleTime !== null ? 'days' : undefined} tooltip="Mean cycle time in working days across all completed features (from work start to delivery)." delta={cycleDelta} />
          <StatTile label="Avg WIP" value={metrics.avgWip !== null ? metrics.avgWip.toFixed(1) : '—'} tooltip="Average Work In Progress — lower usually means lower cycle time (Little's Law)." delta={wipDelta} />
          <StatTile label="Idle Time" value={started ? formatDaysValue(metrics.idleTime) : '—'} unit={started ? 'days' : undefined} hint="person-days without a task" tooltip={IDLE_TOOLTIP} delta={idleDelta} />
        </>}
      >
        <DoneRows done={state.done} />
      </ResultsAside>
    </>
  )
}
