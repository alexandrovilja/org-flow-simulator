# Feature: Nastavení chování přiřazování úkolů

## Status
draft

## Problem
Agilní koučové potřebují živě demonstrovat, jak různé organizační politiky ovlivňují průtok a počet předání — aniž by museli měnit složení týmu. Dvě klíčové politiky, které kouči vysvětlují na workshopech:

1. **Kontinuita vs. priorita**: má člen dokončit rozdělanou práci, nebo vždy skočit na nejdůležitější nový úkol?
2. **Snižování WIP vs. priorita**: má tým nejprve dotáhnout rozběhnuté features, nebo začínat nové podle priority?

Obě otázky jsou ortogonální — lze je kombinovat — a jejich dopad na Lead Time a počet předání je výrazný. Bez přepínačů musí kouč tyto politiky pouze popisovat slovně.

## User Story
Jako agilní kouč chci mít v panelu Units dva přepínače — jeden pro kontinuitu a jeden pro WIP — abych mohl živě ukázat, jak každá politika ovlivňuje průtok, WIP a počet předání, a to i za běhu simulace.

## UI / Design

### Umístění
Pod nadpisem "Units N" v dolním levém panelu, nad mřížkou MemberCard — dva přepínače pod sebou, každý s vlastním hintem.

### Přepínač 1 — Focus (kontinuita)
**`Priority | Continuity`**

- **`Priority`** (výchozí) — člen vždy vybere úkol z nejvýše prioritní feature, na které může přispět
- **`Continuity`** — člen preferuje feature, na které již pracoval; minimalizuje předání

Hint pod přepínačem (mění se):
- Priority → `"Units always pick the highest-priority feature available."`
- Continuity → `"Units prefer to finish what they started — reduces handoffs in cross-functional teams."`

### Přepínač 2 — WIP
**`Priority | Reduce WIP`**

- **`Priority`** (výchozí) — žádné rozlišení mezi backlogem a in-progress; vybírá se dle priority
- **`Reduce WIP`** — in-progress features jsou vždy preferovány před backlogovými; nové features se nezahajují, dokud existuje rozběhnutá práce

Hint pod přepínačem (mění se):
- Priority → `"Units can start new features freely based on priority."`
- Reduce WIP → `"Units finish in-progress features before pulling new ones — lowers average WIP."`

### Vizuální styl
Kompaktní pill-toggle (`Option A | Option B`), šířka ~160 px. Aktivní volba: solidní pozadí `var(--ink)`, text `var(--surface)`. Neaktivní: průhledné, text `var(--ink-3)`. Hint: `font-size: 11px`, `color: var(--ink-3)`.

### Chování při resetu
Oba přepínače se neresetují — jsou nastavením stylu práce týmu, ne simulace.

## Definice řazení kandidátů

Při výběru úkolu pro volného člena M se kandidáti řadí dle **třístupňového klíče** (každý stupeň je aktivní jen pokud je příslušný přepínač zapnut):

```
1. WIP (pokud Reduce WIP):   in-progress feature před backlogovou (backlogIdx === -1 → 0, jinak → 1)
2. Focus (pokud Continuity): feature kde M již pracoval (má done task) → 0, jinak → 1
3. Priorita (vždy):          feature.priority (nižší číslo = vyšší důležitost)
```

Kombinace přepínačů dává 4 odlišné režimy:

| Focus \ WIP      | Priority                          | Reduce WIP                                              |
|------------------|-----------------------------------|---------------------------------------------------------|
| **Priority**     | Současné chování                  | Dotáhnout rozběhné features, pak nové dle priority      |
| **Continuity**   | Vlastní features první, pak prio  | Rozběhné → vlastní → prio (nejméně předání + nízký WIP) |

## Specification by Example

**Příklad 1: Obě výchozí (Priority + Priority) — beze změny**
- Given: Ben (FE+BE). Volné: BE na F-001 inProgress (priority 3), FE na F-002 backlog (priority 1)
- When: Engine přiřazuje Benovi úkol
- Then: Ben dostane FE z F-002 (nižší priority číslo vyhraje)

**Příklad 2: Focus=Continuity, WIP=Priority**
- Given: Ben dokončil FE na F-001 (inProgress, priority 3). Volné: BE na F-001, FE na F-002 (backlog, priority 1)
- When: Engine přiřazuje Benovi úkol
- Then: Ben dostane BE z F-001 (kontinuita > priorita)

**Příklad 3: Focus=Priority, WIP=Reduce WIP**
- Given: Volné: FE na F-002 (backlog, priority 1), BE na F-003 (inProgress, priority 5)
- When: Engine přiřazuje Adě (FE+BE) úkol
- Then: Ada dostane BE z F-003 (inProgress > backlog, bez ohledu na prioritu)

**Příklad 4: Focus=Continuity, WIP=Reduce WIP**
- Given: Ben dokončil FE na F-001 (inProgress, priority 3). Volné: BE na F-001 (inProgress), FE na F-002 (backlog, priority 1), BE na F-004 (inProgress, priority 2)
- When: Engine přiřazuje Benovi úkol
- Then: Ben dostane BE z F-001 (WIP filtr: obě inProgress; pak kontinuita: F-001 je Benova)

**Příklad 5: Reduce WIP — fallback na backlog pokud žádná inProgress dostupná**
- Given: WIP=Reduce WIP. Na inProgress features není žádný dostupný úkol pro Adu. Backlog: FE na F-005 (priority 2), FE na F-006 (priority 1)
- When: Engine přiřazuje Adě úkol
- Then: Ada dostane FE z F-006 (fallback na backlog dle priority)

**Příklad 6: Přepnutí za běhu simulace**
- Given: Simulace běží s Focus=Priority, WIP=Priority
- When: Uživatel přepne WIP na `Reduce WIP`
- Then: Od příštího ticku engine preferuje in-progress features; aktuálně přiřazené tasky se nedotýká

## Out of Scope
- Různé nastavení pro různé členy týmu (přepínače platí globálně)
- Třetí volba v rámci jednoho přepínače
- Ukládání nastavení do localStorage
- WIP limit jako tvrdý strop (to je separátní feature)

## Technical Notes

### Nové typy
```typescript
// lokálně v Simulator.tsx (není potřeba v simulation.ts)
type FocusMode = 'priority' | 'continuity'
type WipMode   = 'priority' | 'reduce-wip'
```

State v `Simulator.tsx`:
```typescript
const [focusMode, setFocusMode] = useState<FocusMode>('priority')
const [wipMode,   setWipMode]   = useState<WipMode>('priority')
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
  wipMode: WipMode = 'priority',
): SimState
```

Nové řazení kandidátů v přiřazovacím loopu:
```typescript
candidates.sort((a, b) => {
  // Stupeň 1: Reduce WIP — in-progress features před backlogovými
  if (wipMode === 'reduce-wip') {
    const wipDiff = (a.backlogIdx === -1 ? 0 : 1) - (b.backlogIdx === -1 ? 0 : 1)
    if (wipDiff !== 0) return wipDiff
  }
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
- Přidat `focusMode` a `wipMode` state
- Předat do `tick()` volání v RAF smyčce
- Přidat oba toggle prvky do záhlaví Units sekce s příslušnými hinty
- Přepínače neovlivňují `resetFromSnapshot` ani `regenerate`

### Závislosti
- feat-007 (Počet předání) — Continuity režim snižuje Avg Handoffs; efekt je viditelný na nové metrice

## Open Questions
—
