import { memo, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { PanelHeader } from '@/components/PanelHeader'
import { EmptyNote } from '@/components/EmptyNote'
import { StatTile } from '@/components/StatTile'
import { ResultsAside } from '@/components/ResultsAside'
import { DoneRow } from '@/components/DoneRow'
import { RoleChip } from '@/components/RoleChip'
import { WorkTimeValue } from '@/components/WorkTimeValue'
import { formatDaysValue } from '@/lib/formatTime'
import { orgFeatureHue, orgMetrics, validateOrgSetup } from '@/simulation/organizationEngine'
import { addMandate, removeMandate } from '@/simulation/organizationSetup'
import type { CssVariables } from '@/types/css'
import type { Role, RoleMeta } from '@/types/simulation'
import type { OrgArea, OrgFeature, OrgRunSnapshot, OrgSetup, OrgSimState, OrgTeam } from '@/types/organization'
import styles from './OrganizationView.module.css'
import tone from './FeatureTone.module.css'

/** Props celé plochy módu Organization (feat-028). */
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

/** Props štítku oblasti. */
interface AreaTagProps {
  /** Kód oblasti, např. „BIL“. */
  code: string
  /** Celý název oblasti do tooltipu. */
  name: string | undefined
  /** Stav oblasti u rozpracované featury; bez něj je štítek neutrální (backlog). */
  state?: 'open' | 'done'
}

/**
 * Obrysový štítek oblasti. U rozpracované featury hotová oblast zezelená a dostane „✓“.
 *
 * @param props - Kód, název a volitelný stav oblasti
 * @returns Vykreslený štítek
 */
function AreaTag({ code, name, state }: AreaTagProps) {
  const done = state === 'done'
  return (
    <span
      data-testid={state ? 'org-area-tag' : undefined}
      data-state={state}
      title={name}
      className={done ? `${styles.areaTag} ${styles.areaTagDone}` : styles.areaTag}
    >
      {done ? `✓ ${code}` : code}
    </span>
  )
}

/** Props položky backlogu. */
interface BacklogItemProps {
  feature: OrgFeature
  roleConfig: Record<Role, RoleMeta>
  /** Pracnost největší featury — šířka pruhu pracnosti je k ní poměrná. */
  maxWork: number
  areaNames: AreaNames
}

/**
 * Položka backlogu: číslo a název featury, štítky oblastí a pruh pracnosti z barevných segmentů úkolů
 * seskupených po oblastech.
 *
 * @param props - Featura, skilly, největší pracnost a názvy oblastí
 * @returns Vykreslená položka
 */
function BacklogItem({ feature, roleConfig, maxWork, areaNames }: BacklogItemProps) {
  const work = featureWork(feature)
  const groups = featureAreas(feature).map(area => ({ area, tasks: feature.tasks.filter(t => t.area === area) }))
  return (
    <div data-testid="org-backlog-item" className={styles.backlogItem}>
      <div className={styles.itemTop}>
        <FeatureName name={feature.name} />
        <span className={styles.tags}>
          {groups.map(g => <AreaTag key={g.area} code={g.area} name={areaNames[g.area]} />)}
        </span>
      </div>
      {/* Šířka pruhu = pracnost featury vůči největší featuře backlogu */}
      <div className={styles.effort} style={{ width: `${(work / maxWork) * 100}%` }} title={`${work} days of work`}>
        {groups.map(g => (
          <span key={g.area} className={styles.effortGroup} style={{ flexGrow: g.tasks.reduce((s, t) => s + t.work, 0) }}>
            {g.tasks.map(t => {
              const segmentStyle: CssVariables = { flexGrow: t.work, '--role': roleConfig[t.role]?.color ?? 'var(--ink-4)' }
              return <span key={t.id} className={styles.effortSegment} style={segmentStyle} />
            })}
          </span>
        ))}
      </div>
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
}

/**
 * Levý sloupec: backlog seřazený podle priority. Je memoizovaný — engine vytvoří nové pole backlogu jen
 * když featura začne, takže se 100 položek nepřekresluje v každém snímku běhu.
 */
const BacklogPanel = memo(function BacklogPanel({ backlog, snapshot, roleConfig, areaNames }: BacklogPanelProps) {
  const sorted = useMemo(() => [...backlog].sort((a, b) => a.priority - b.priority), [backlog])
  const maxWork = useMemo(() => snapshot.reduce((max, f) => Math.max(max, featureWork(f)), 1), [snapshot])
  return (
    <section aria-label="Backlog" className={styles.side}>
      <PanelHeader title="Backlog" count={backlog.length} />
      <div className={styles.backlogList}>
        {sorted.length === 0 && <EmptyNote>Backlog is empty.</EmptyNote>}
        {sorted.map(f => <BacklogItem key={f.id} feature={f} roleConfig={roleConfig} maxWork={maxWork} areaNames={areaNames} />)}
      </div>
    </section>
  )
})

/**
 * Řádek rozpracované featury: číslo, název a štítky oblastí (hotová oblast zelená), pod ním pruh postupu
 * (hotová práce / celková práce). Tón řádku je podle odstínu featury jako v ostatních módech.
 *
 * @param props - Featura a názvy oblastí
 * @returns Vykreslený řádek
 */
function FeatureRow({ feature, areaNames }: { feature: OrgFeature; areaNames: AreaNames }) {
  const total = featureWork(feature)
  const doneWork = feature.tasks.reduce((sum, t) => sum + Math.min(t.progress, t.work), 0)
  const pct = total > 0 ? Math.round((doneWork / total) * 100) : 0
  const hueStyle: CssVariables = { '--hue': orgFeatureHue(feature.id) }
  return (
    <div data-testid="org-feature-row" data-feature-id={feature.id} className={`${styles.featureRow} ${tone.tone}`} style={hueStyle}>
      <div className={styles.itemTop}>
        <span className={`${styles.swatch} ${tone.swatch}`} aria-hidden="true" />
        <FeatureName name={feature.name} />
        <span className={styles.tags}>
          {featureAreas(feature).map(area => {
            const areaDone = feature.tasks.every(t => t.area !== area || t.status === 'done')
            return <AreaTag key={area} code={area} name={areaNames[area]} state={areaDone ? 'done' : 'open'} />
          })}
        </span>
      </div>
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

/**
 * Řádek týmu za běhu (sloupce Team | Mandate | People), jen ke čtení: název, štítky mandátů a pruh lidí
 * „pracuje / celkem“.
 *
 * @param props - Tým, názvy oblastí a id lidí, kteří právě pracují
 * @returns Vykreslený řádek
 */
function RunTeamRow({ team, areaNames, working }: { team: OrgTeam; areaNames: AreaNames; working: ReadonlySet<number> }) {
  const total = team.people.length
  const busy = team.people.filter(p => working.has(p.id)).length
  return (
    <div data-testid="org-team-row" className={styles.teamRow}>
      <div className={styles.runLine}>
        <span className={styles.teamCell}>
          <span className={styles.teamName}>{team.name}</span>
        </span>
        <span className={styles.mandates}>
          {team.mandates.map(code => <span key={code} className={styles.mandateTag} title={areaNames[code]}>{code}</span>)}
          {team.mandates.length === 0 && <span className={styles.none}>none</span>}
        </span>
        <span data-testid="org-people-bar" className={styles.peopleCell} title={`${busy} working, ${total - busy} idle`}>
          <span className={styles.peopleBar} aria-hidden="true">
            <span className={styles.peopleWorking} style={{ flexGrow: busy }} />
            <span className={styles.peopleIdle} style={{ flexGrow: total - busy }} />
          </span>
          <span className={styles.peopleCount}>{busy}/{total}</span>
        </span>
      </div>
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
}

/**
 * Panel organizace: hlavička se souhrnem, varování kontroly před během a řádky týmů. Před během jde měnit
 * mandáty, za běhu je panel jen ke čtení a ukazuje vytížení lidí.
 *
 * @param props - Organizace, callback úprav, stav běhu, zamčení a varování
 * @returns Vykreslený panel
 */
function OrganizationPanel({ setup, onSetupChange, state, locked, warnings }: OrganizationPanelProps) {
  // Rozbalené týmy a otevřená nabídka mandátů jsou jen stav zobrazení, do organizace nepatří
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

  // Lidé, kteří právě pracují na nějakém úkolu
  const working = new Set<number>()
  for (const f of state.inProgress) {
    for (const t of f.tasks) if (t.status === 'doing' && t.assignee !== null) working.add(t.assignee)
  }

  const toggleTeam = (id: number) => setOpenTeams(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })

  return (
    <section aria-label="Organization" className={styles.org}>
      <PanelHeader title="Organization" count={summary} />
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
        {locked ? <><span>Team</span><span>Mandate</span><span>People</span></> : <><span>Team</span><span>People</span><span>Mandate</span></>}
      </div>

      <div className={styles.teams}>
        {setup.teams.map(team => (locked
          ? <RunTeamRow key={team.id} team={team} areaNames={areaNames} working={working} />
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
 * Celá plocha módu Organization (feat-028, inkrement 1) ve třech sloupcích: vlevo Backlog, uprostřed
 * In progress a Organization, vpravo Metrics a Done. Komponenta jen zobrazuje stav z enginu; úpravy
 * organizace posílá rodiči přes `onSetupChange`. Vrací tři sourozence, které rozloží mřížka Simulatoru.
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

  // Delty proti předchozímu běhu jako v Cash Flow: Total Time až po doběhnutí, ostatní hned, jak mají hodnotu
  const timeDelta = previousRun && state.finished ? percentChange(metrics.totalTime, previousRun.totalTime) : undefined
  const cycleDelta = previousRun ? percentChange(metrics.avgCycleTime, previousRun.avgCycleTime) : undefined
  const wipDelta = previousRun ? percentChange(metrics.avgWip, previousRun.avgWip) : undefined

  return (
    <>
      <BacklogPanel backlog={state.backlog} snapshot={state.backlogSnapshot} roleConfig={state.setup.roleConfig} areaNames={areaNames} />

      <div className={styles.center}>
        <section aria-label="In progress" className={styles.inProgress}>
          <PanelHeader title="In progress" count={state.inProgress.length} />
          <div className={styles.featureList}>
            {state.inProgress.length === 0 && (
              <EmptyNote gridColumn="1 / -1">{state.finished ? 'All features are done.' : 'Nothing in flight.'}</EmptyNote>
            )}
            {state.inProgress.map(f => <FeatureRow key={f.id} feature={f} areaNames={areaNames} />)}
          </div>
        </section>

        <OrganizationPanel setup={setup} onSetupChange={onSetupChange} state={state} locked={locked} warnings={warnings} />
      </div>

      <ResultsAside
        sampleCount={metrics.doneCount}
        doneCount={metrics.doneCount}
        isEmpty={state.done.length === 0}
        tiles={<>
          <StatTile label="Total Time" value={<WorkTimeValue days={metrics.totalTime} />} variant="timer" finished={state.finished} wide tooltip="Elapsed time in working days (5 working days = 1 week)." delta={timeDelta} />
          <StatTile label="Avg Cycle Time" value={metrics.avgCycleTime !== null ? formatDaysValue(metrics.avgCycleTime) : '—'} unit={metrics.avgCycleTime !== null ? 'days' : undefined} tooltip="Mean cycle time in working days across all completed features (from work start to delivery)." delta={cycleDelta} />
          <StatTile label="Avg WIP" value={metrics.avgWip !== null ? metrics.avgWip.toFixed(1) : '—'} tooltip="Average Work In Progress — lower usually means lower cycle time (Little's Law)." delta={wipDelta} />
        </>}
      >
        <DoneRows done={state.done} />
      </ResultsAside>
    </>
  )
}
