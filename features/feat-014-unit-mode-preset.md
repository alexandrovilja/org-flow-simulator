# feat-014 — Unit Presets: Teams / People

## Stav
`draft`

## Kontext
Simulátor momentálně zobrazuje jednotky vždy jako osoby (Ada, Ben, Chen…) a specializace jsou zaměřené na tech stack (React, Java, QA…). Agile coaches potřebují simulátor použít ve dvou různých kontextech:

1. **Teams** — simulace organizační struktury, kde jednotky jsou celé týmy a práce prochází mezi nimi
2. **People** — simulace složení jednoho scrum/feature týmu (kdo je specialista, kdo je cross-funkční)

## Cíl
Nahradit stávající výchozí stav konfigurovatelným systémem **presetů**. Každý preset definuje:
- Jména jednotek
- Sadu specializací (klíče, labely, barvy)
- Výchozí přiřazení specializací ke každé jednotce

Kliknutí na preset okamžitě přepíše aktuální tým a specializace hodnotami z presetu.

## Presetová data

### Preset „Teams" *(výchozí při prvním načtení)*

**Specializace:**

| Klíč | Label | Barva (oklch) |
|---|---|---|
| `DSGN` | Design | oklch(72% 0.13 25) — oranžová |
| `ACQ` | Client Acquisition | oklch(70% 0.14 160) — zelená |
| `PAY` | Payments | oklch(70% 0.14 250) — modrá |
| `PLAT` | Platform | oklch(66% 0.14 285) — fialová |
| `CRM` | CRM | oklch(68% 0.13 75) — žlutá |
| `ITST` | Integration Testing | oklch(68% 0.13 145) — smaragdová |

**Jednotky a jejich výchozí specializace:**

| Jméno | Specializace |
|---|---|
| Team A | Design |
| Team B | Client Acquisition |
| Team C | Payments |
| Team D | Platform |
| Team E | CRM |
| Team F | Integration Testing |

### Preset „People"

**Specializace:** stávající tech-stack sada, s generickými labely (ne tech-specifické):

| Klíč (Role) | Label | Barva (oklch) |
|---|---|---|
| `FE`   | Frontend | oklch(70% 0.14 250) — modrá |
| `BE`   | Backend  | oklch(66% 0.14 285) — fialová |
| `DSGN` | Design   | oklch(72% 0.13 25)  — oranžová |
| `QA`   | Testing  | oklch(68% 0.13 145) — smaragdová |
| `OPS`  | DevOps   | oklch(68% 0.13 75)  — žlutá |
| `DATA` | Data     | oklch(64% 0.14 320) — růžová |

**Jednotky a jejich výchozí specializace:**

| Jméno | Specializace |
|---|---|
| Ada  | Frontend |
| Ben  | Backend |
| Chen | Design |
| Dani | Testing |
| Eli  | DevOps |
| Fae  | Data |

> *Výchozí stav obou presetů je záměrně silosový (1 specializace / jednotka) — coach pak přidáváním specializací ukazuje efekt cross-funkčnosti.*

## Chování při kliknutí na preset

### Stav „custom" (uživatel ručně upravil tým nebo specializace)

Před přepsáním se zobrazí potvrzovací dialog:

```
┌─────────────────────────────────────────┐
│  Apply "Teams" preset?                  │
│                                         │
│  Your current team and specializations  │
│  will be replaced. This cannot be       │
│  undone.                                │
│                                         │
│         [ Cancel ]  [ Apply preset ]    │
└─────────────────────────────────────────┘
```

- „Cancel" — dialog se zavře, nic se nemění
- „Apply preset" — pokračuje standardním přepsáním (viz níže)

### Stav „preset aktivní" (žádné ruční změny)

Dialog se nezobrazuje — přepsání proběhne okamžitě.

### Přepsání — ze stavu „preset aktivní" (žádný dialog)

1. Aktuální seznam jednotek se nahradí jednotkami z presetu
2. Aktuální sada specializací se nahradí specializacemi z presetu
3. Simulační stav se resetuje (paused, t = 0) — backlog zůstane, **nový se negeneruje**
4. Vybraný preset se uloží do localStorage

### Přepsání — ze stavu „custom" (po potvrzení dialogu)

1. Aktuální seznam jednotek se nahradí jednotkami z presetu
2. Aktuální sada specializací se nahradí specializacemi z presetu
3. Simulační stav se resetuje (paused, t = 0)
4. **Vygeneruje se nový backlog** (ekvivalent „Generate new backlog")
5. Vybraný preset se uloží do localStorage

## Chování při prvním načtení

Pokud v localStorage není žádný uložený stav, aplikace načte **Teams preset** jako výchozí.

## UI

Tlačítka presetů jsou umístěna v panelu **Settings**, jako první (vždy viditelná) sekce nad accordion položkami:

```
┌─ Settings ─────────────────────────────────┐
│  Unit preset                                │
│  [ Teams ]  [ People ]                     │
│  ─────────────────────────────────────      │
│  ♻ Backlog                   (accordion)   │
│  ⚙ Specializations           (accordion)   │
│  ...                                        │
└─────────────────────────────────────────────┘
```

Team panel zůstává beze změny — preset tlačítka se v něm **nezobrazují**. Mění se pouze tlačítko přidání jednotky:

```
┌─ Team ─────────────────────────────────────┐
│  Team A   [Design]              [×]         │
│  Team B   [Client Acquisition]  [×]         │
│  ...                                        │
│  [ + Add team ]   ← text závisí na presetu │
└─────────────────────────────────────────────┘
```

- Aktivní preset má vizuálně odlišený styl (filled/selected)
- Pokud uživatel ručně upraví tým nebo specializace, žádné tlačítko není zvýrazněno (stav „custom")
- Tlačítko „+ Add team" / „+ Add member" v Team panelu kopíruje terminologii aktivního presetu

## Technický dopad

### Nový typ v `src/types/simulation.ts`

```ts
/** Jeden preset definující výchozí sestavu týmu a specializací.
 *  Kliknutím na preset se přepíše aktuální konfigurace týmu i specializací. */
export interface UnitPreset {
  /** Identifikátor presetu — používá se jako klíč v localStorage. */
  id: 'teams' | 'people'
  /** Zobrazovaný název tlačítka v UI. */
  label: string
  /** Text pro tlačítko přidání nové jednotky v daném presetu. */
  addLabel: string
  /** Definice specializací platných pro tento preset. */
  roles: Role[]
  roleMeta: Record<Role, RoleMeta>
  /** Výchozí sestavení týmu — jméno jednotky + přiřazené specializace. */
  members: Array<{ name: string; roles: Role[] }>
}
```

### Nová data v `src/simulation/engine.ts`

- Nahradit stávající `ROLES` a `ROLE_META` exportem `PRESETS: UnitPreset[]`
- Zachovat `MEMBER_NAMES` a `TEAM_NAMES` jako pomocné konstanty pro generování jmen při ručním přidávání

### Soubory k úpravě

- `src/types/simulation.ts` — nový typ `UnitPreset`
- `src/simulation/engine.ts` — nové konstanty `PRESETS`, `TEAM_NAMES`; odstranit staré `ROLES`/`ROLE_META`
- `src/components/Simulator.tsx` — tlačítka presetů, aplikace presetu, podmíněný add-label, potvrzovací dialog
- `src/lib/storage.ts` — persistovat `activePresetId: 'teams' | 'people' | 'custom'`

### Potvrzovací dialog

Jednoduchý inline React state (`confirmingPreset: UnitPreset | null`) — pokud je hodnota non-null, dialog je viditelný. Není třeba externí knihovna. Dialog blokuje interakci s ostatním UI (modal overlay).

Název presetu v textu dialogu je dynamický: *Apply "[preset.label]" preset?*

## Akceptační kritéria

1. Na prvním načtení (bez localStorage) je aktivní Teams preset se 6 týmy a 6 specializacemi
2. Kliknutí na „People" přepíše tým na Ada–Fae se stejnými 6 specializacemi
3. Kliknutí na „Teams" přepíše tým na Team A–F se stejnými 6 specializacemi
4. Po přepnutí presetu se resetuje i simulace (backlog, stav)
5. Tlačítko přidání nové jednotky říká „+ Add team" resp. „+ Add member" podle aktivního presetu
6. Aktivní preset je vizuálně zvýrazněn; po ruční úpravě žádné tlačítko není selected
7. Kliknutí na preset ve stavu „custom" zobrazí potvrzovací dialog s názvem presetu
8. „Cancel" v dialogu nezpůsobí žádnou změnu
9. „Apply preset" v dialogu provede přepsání, reset simulace **a vygeneruje nový backlog**
10. Přepínání mezi presetami bez custom úprav negeneruje nový backlog
11. Zvolený preset přežije reload stránky
12. Stávající editace specializací (panel Specializations) funguje nezměněně i po aplikaci presetu
