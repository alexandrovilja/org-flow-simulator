# Feature: Nastavení chování přiřazování úkolů

## Status
done

*Revize: WIP mód „Priority“ byl odstraněn — jednotky vždy dotahují rozběhnutou práci (dřívější „Reduce WIP“) a samostatný přepínač WIP v této featuře už není. Přepínač WIP se vrací ve feat-016 jako `Reduce WIP | Min units`. Původní pojetí níže je upraveno; dřívější textace Priority módu se nepoužívá.*

## Problem
Agilní koučové potřebují živě demonstrovat, jak různé organizační politiky ovlivňují průtok a počet předání — aniž by museli měnit složení týmu. Dvě klíčové politiky, které kouči vysvětlují na workshopech:

1. **Kontinuita vs. priorita**: má člen dokončit rozdělanou práci, nebo vždy skočit na nejdůležitější nový úkol?
2. **Snižování WIP**: tým nejprve dotahuje rozběhnuté features a nové začíná, až když na rozběhnuté práci nemá co dělat. Tato politika je od této revize pevně zapnutá (dříve šlo přepnout na „Priority“, který nové featury z backlogu preferoval).

Dopad Kontinuity na Lead Time a počet předání je výrazný. Bez přepínače musí kouč tuto politiku pouze popisovat slovně.

## User Story
Jako agilní kouč chci mít v panelu Units přepínač kontinuity, abych mohl živě ukázat, jak ovlivňuje průtok, WIP a počet předání, a to i za běhu simulace.

## UI / Design

### Umístění
Pod nadpisem "Units N" v dolním levém panelu, nad mřížkou MemberCard — přepínač Focus s hintem.

### Přepínač Focus (kontinuita)
**`Priority | Continuity`**

- **`Priority`** (výchozí) — člen vybere úkol z nejvýše prioritní feature, na které může přispět; rozběhnuté features mají vždy přednost před backlogem (viz „WIP“ níže), priorita rozhoduje mezi features stejné skupiny
- **`Continuity`** — člen preferuje feature, na které již pracoval; minimalizuje předání

Hint pod přepínačem (mění se):
- Priority → `"Units finish in-progress features first, then pick the highest-priority one."`
- Continuity → `"Units prefer to finish what they started — reduces handoffs in cross-functional teams."`

### WIP (bez přepínače)
Rozběhnuté (in-progress) features jsou vždy preferovány před backlogovými; nové features se nezahajují, dokud existuje rozběhnutá práce, na které člen může pracovat. Volba WIP módu (`Reduce WIP | Min units`) přichází až ve feat-016.

### Vizuální styl
Kompaktní pill-toggle (`Option A | Option B`), šířka ~160 px. Aktivní volba: solidní pozadí `var(--ink)`, text `var(--surface)`. Neaktivní: průhledné, text `var(--ink-3)`. Hint: `font-size: 11px`, `color: var(--ink-3)`.

### Chování při resetu
Přepínač se neresetuje — je nastavením stylu práce týmu, ne simulace.

## Definice řazení kandidátů

Při výběru úkolu pro volného člena M se kandidáti řadí dle **třístupňového klíče** (stupeň 2 je aktivní jen při Continuity):

```
1. WIP (vždy):               in-progress feature před backlogovou (backlogIdx === -1 → 0, jinak → 1)
2. Focus (pokud Continuity): feature kde M již pracoval (má done task) → 0, jinak → 1
3. Priorita (vždy):          feature.priority (nižší číslo = vyšší důležitost)
```

Přepínač Focus dává 2 režimy:

| Focus            | Pořadí                                                       |
|------------------|--------------------------------------------------------------|
| **Priority**     | Dotáhnout rozběhnuté features, pak nové dle priority         |
| **Continuity**   | Rozběhnuté → vlastní → prio (nejméně předání + nízký WIP)    |

## Specification by Example

**Příklad 1: Focus=Priority (výchozí)**
- Given: Ben (FE+BE). Volné: BE na F-001 inProgress (priority 3), FE na F-002 backlog (priority 1)
- When: Engine přiřazuje Benovi úkol
- Then: Ben dostane BE z F-001 (inProgress > backlog, bez ohledu na prioritu)

**Příklad 2: Focus=Continuity**
- Given: Ben dokončil FE na F-001 (inProgress, priority 3). Volné: BE na F-001 (inProgress), BE na F-004 (inProgress, priority 2), FE na F-002 (backlog, priority 1)
- When: Engine přiřazuje Benovi úkol
- Then: Ben dostane BE z F-001 (kontinuita > priorita mezi rozběhnutými)

**Příklad 3: Focus=Continuity, vlastní vs. cizí rozběhnutá feature**
- Given: Ben dokončil FE na F-001 (inProgress, priority 3). Volné: BE na F-001 (inProgress), FE na F-002 (backlog, priority 1), BE na F-004 (inProgress, priority 2)
- When: Engine přiřazuje Benovi úkol
- Then: Ben dostane BE z F-001 (WIP filtr: obě inProgress; pak kontinuita: F-001 je Benova)

**Příklad 4: Fallback na backlog pokud žádná inProgress dostupná**
- Given: Na inProgress features není žádný dostupný úkol pro Adu. Backlog: FE na F-005 (priority 2), FE na F-006 (priority 1)
- When: Engine přiřazuje Adě úkol
- Then: Ada dostane FE z F-006 (fallback na backlog dle priority)

**Příklad 5: Přepnutí za běhu simulace**
- Given: Simulace běží s Focus=Priority
- When: Uživatel přepne Focus na `Continuity`
- Then: Od příštího ticku engine preferuje vlastní features; aktuálně přiřazené tasky se nedotýká

## Out of Scope
- Různé nastavení pro různé členy týmu (přepínač platí globálně)
- Třetí volba v rámci jednoho přepínače
- Ukládání nastavení do localStorage
- WIP limit jako tvrdý strop (to je separátní feature)

## Technical Notes

### Nové typy
```typescript
// lokálně v Simulator.tsx (není potřeba v simulation.ts)
type FocusMode = 'priority' | 'continuity'
```

State v `Simulator.tsx`:
```typescript
const [focusMode, setFocusMode] = useState<FocusMode>('priority')
```

### Engine (`src/simulation/engine.ts`) — funkce `tick()`

Rozšířit signaturu:
```typescript
export function tick(
  state: SimState,
  dtSim: number,
  settings: SimSettings,
  rng: () => number,
  roleConfig: Record<Role, RoleMeta> = ROLE_META,
  focusMode: FocusMode = 'priority',
): SimState
```

Nové řazení kandidátů v přiřazovacím loopu:
```typescript
candidates.sort((a, b) => {
  // Stupeň 1: WIP — in-progress features před backlogovými
  const wipDiff = (a.backlogIdx === -1 ? 0 : 1) - (b.backlogIdx === -1 ? 0 : 1)
  if (wipDiff !== 0) return wipDiff
  // Stupeň 2: Continuity — vlastní features před cizími
  if (focusMode === 'continuity') {
    const workedOn = (f: Feature) => f.tasks.some(t => t.assignee === m.id && t.status === 'done')
    const contDiff = (workedOn(a.f) ? 0 : 1) - (workedOn(b.f) ? 0 : 1)
    if (contDiff !== 0) return contDiff
  }
  // Stupeň 3: Priorita (vždy jako finální tiebreaker)
  return a.f.priority - b.f.priority
})
```

### UI (`src/components/Simulator.tsx`)
- Přidat `focusMode` state
- Předat do `tick()` volání v RAF smyčce
- Přidat toggle do záhlaví Units sekce s hintem
- Přepínač neovlivňuje `resetFromSnapshot` ani `regenerate`

### Závislosti
- feat-007 (Počet předání) — Continuity režim snižuje Avg Handoffs; efekt je viditelný na nové metrice
- feat-016 (Coordination Overhead) — v Cash Flow módu s přepínačem On Continuity režim zároveň snižuje koordinační overhead (méně předání = méně tax a reworku)

## Open Questions
—
