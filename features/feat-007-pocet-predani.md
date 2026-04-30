# Feature: Počet předání mezi jednotkami

## Status
draft

## Problem
Agilní koučové potřebují ukázat klientům přímou spojitost mezi specializací týmu a koordinačními náklady. Každé předání feature mezi rolemi znamená čekání ve frontě — člen musí počkat, až bude dotyčný specialista volný. Bez vizualizace počtu těchto předání klienti nevidí, proč cross-funkční tým dokončuje features rychleji: zkrátka méně předávání = méně čekání. Aktuálně tato metrika v UI chybí.

## User Story
Jako agilní kouč chci vidět průměrný počet předání na feature (handoffs), abych klientům demonstroval, že specializovaný tým generuje výrazně víc koordinačních nákladů než cross-funkční tým se stejným počtem lidí.

## Definice předání (handoff)

Předání nastane, když **zároveň** platí obě podmínky:
1. Dochází k přechodu mezi fázemi (task fáze N → fáze N+1)
2. Změna fáze znamená i změnu **jednotky (assignee)** — stejný člen v obou fázích předání nevytváří

**Algoritmus pro jednu feature:**
```
pro každý přechod fáze N → N+1:
  assignees_next = množina assignee všech tasků ve fázi N+1
  pro každý task T ve fázi N:
    pokud T.assignee ∉ assignees_next → +1 předání
```

**Příklady (specializovaný tým, různí lidé ve všech fázích):**

| Fáze 1 | Fáze 2 | Fáze 3 | Předání |
|--------|--------|--------|---------|
| DSGN/Ada | FE/Ben + BE/Chen | QA/Dana | 1 + 2 = **3** |
| DSGN/Ada | FE/Ben | — | **1** |
| FE/Ada + BE/Ben | QA/Chen | — | **2** |
| FE/Ada | — | — | **0** (jedna fáze) |

**Příklady (cross-funkční člen — stejná osoba ve více fázích):**

| Fáze 1 | Fáze 2 | Fáze 3 | Předání | Poznámka |
|--------|--------|--------|---------|----------|
| DSGN/Ada | FE/Ben + BE/**Ada** | QA/Chen | 0 + 2 = **2** | Ada nepředává (sama je ve fázi 2) |
| DSGN/Ada | FE/**Ada** | QA/Ben | 0 + 1 = **1** | Ada nepředává do fáze 2; fáze 2→3 Ada ≠ Ben |
| FE/Ada + BE/Ben | QA/**Ada** | — | **1** | Ada nepředává, Ben předává |

## UI / Design

- Nová StatTile **Avg Handoffs** přibude do analytické sekce v pravém panelu
- Umístění: za dlaždici **Total Wait** (jako čtvrtá/pátá dlaždice)
- Zobrazí průměrný počet předání na feature, zaokrouhlený na 1 desetinné místo (např. `2.4`)
- Delta indikátor jako ostatní metriky: po druhém a dalším dokončeném běhu zobrazí `↓ X%  vs prev run` (zelená = méně předání, lepší) nebo `↑ X%  vs prev run` (červená = víc předání, horší)
- Před dokončením první feature zobrazí pomlčku `—` (žádná data)

## Specification by Example

**Příklad 1: Specializovaný tým — Design → FE+BE → QA (různí lidé)**
- Given: DSGN/Ada (level 1), FE/Ben (level 2), BE/Chen (level 2), QA/Dana (level 3)
- When: `computeHandoffs(feature, roleConfig)` je zavolána
- Then: Vrátí `3` (fáze 1→2: Ada ∉ {Ben, Chen} = 1; fáze 2→3: Ben ∉ {Dana} = 1, Chen ∉ {Dana} = 1)

**Příklad 2: Cross-funkční člen překlenuje fáze 1 a 2**
- Given: DSGN/Ada (level 1), FE/Ben (level 2), BE/Ada (level 2), QA/Chen (level 3)
- When: `computeHandoffs(feature, roleConfig)` je zavolána
- Then: Vrátí `2` (fáze 1→2: Ada ∈ {Ben, Ada} = 0; fáze 2→3: Ben ∉ {Chen} = 1, Ada ∉ {Chen} = 1)

**Příklad 3: Dvě fáze, jeden cross-funkční člen pokrývá obě**
- Given: FE/Ada (level 1), QA/Ada (level 2)
- When: `computeHandoffs(feature, roleConfig)` je zavolána
- Then: Vrátí `0` (Ada ∈ {Ada}, žádné předání)

**Příklad 4: Jedna fáze — žádný přechod**
- Given: FE/Ada (level 1), BE/Ben (level 1), žádná další fáze
- When: `computeHandoffs(feature, roleConfig)` je zavolána
- Then: Vrátí `0`

**Příklad 5: Průměr přes více features**
- Given: Done list obsahuje 3 features s předáními 3, 0, 3
- When: UI zobrazí dlaždici Avg Handoffs
- Then: Zobrazí se `2.0`

**Příklad 6: Žádná dokončená feature**
- Given: Simulace běží, done list je prázdný
- When: UI zobrazí dlaždici Avg Handoffs
- Then: Zobrazí se `—`

**Příklad 7: Delta po druhém běhu (zlepšení)**
- Given: První běh skončil s avg handoffs 3.2 (specializovaný tým)
- When: Druhý běh skončí s avg handoffs 1.8 (cross-funkční tým)
- Then: Delta zobrazí `↓ 44%  vs prev run` (zelená)

## Out of Scope
- Vizualizace předání na úrovni konkrétní feature (graf toku)
- Handoff matrix (kdo komu předává nejčastěji)
- Handoff time (jak dlouho čekal task než ho někdo převzal)
- Konfigurace prahu pro "červenou" hodnotu předání

## Technical Notes

### Engine (`src/simulation/engine.ts`)
- Přidat pomocnou funkci `computeHandoffs(feature: Feature, roleConfig: Record<Role, RoleMeta>): number`
  - Seskupí tasky dle `roleConfig[task.role].level`
  - Seřadí unikátní levely vzestupně
  - Pro každý po sobě jdoucí pár levelů (N → N+1):
    - Sestaví množinu assignee fáze N+1
    - Pro každý task fáze N: pokud `task.assignee ∉ assignees_next` → +1
  - Funkce musí být čistá (pure) a bez vedlejších efektů
- `LeadTimeEntry` rozšířit o pole `handoffs: number` — ukládáme při dokončení feature v `tick()`
- `SimStats` rozšířit o `avgHandoffs: number` — počítáno v `computeStats()`

### Types (`src/types/simulation.ts`)
- `LeadTimeEntry`: přidat `handoffs: number`
- `SimStats`: přidat `avgHandoffs: number`

### UI
- `RunSnapshot` (v Simulator komponentě): přidat `avgHandoffs: number` pro delta srovnání
- `StatTile` komponenta: beze změny — již podporuje generické hodnoty + delta
- Přidat novou dlaždici do analytické sekce v `src/components/Simulator.tsx` nebo příslušné analytické komponentě

### Závislosti
- feat-004 (Lead Time analýza) — sdílí `StatTile`, `RunSnapshot`, delta mechanismus

## Open Questions
—
