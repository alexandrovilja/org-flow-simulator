# Feature: Dva módy UI — Srovnání + Experimentování

## Status
ready

## Problem
Současné UI zobrazuje vše najednou: backlog, nastavení, tým, statistiky, grafy. Pro nového uživatele
(manažer, člen týmu na workshopu) je orientace obtížná — i zkušený kouč musí UI vysvětlovat.
Chybí jednoduchý způsob, jak ukázat hlavní sdělení aplikace: "Změň složení týmu → sleduj dopad
na Lead Time." Chybí také přímé vizuální srovnání dvou organizačních struktur (specialisté vs.
cross-functional) se stejným backlogem.

## User Story
As a **coach running a workshop**, I want to show two team structures running the same backlog
side by side so that participants immediately see the impact of specialization on lead time
without needing an explanation.

As an **advanced user or coach preparing a session**, I want full access to all controls and
settings so that I can configure and experiment with different scenarios.

## UI / Design

### Přepínač módů
- V hlavním headeru jsou dvě záložky: **⚖️ Srovnání** a **🔬 Experimentování**
- Přepínač je viditelný vždy, bez ohledu na aktivní mód
- Výchozí mód při prvním načtení: **Srovnání**

---

### Mód 1 — Srovnání

Obrazovka je rozdělena do dvou sloupců: **Tým A** (vlevo) a **Tým B** (vpravo).
Oba týmy sdílí jeden backlog (stejný seed) a simulace běží paralelně.

**Header každého sloupce:**
- Badge (TÝM A / TÝM B) + název struktury ("Specialisté" / "Cross-functional")
- Pill s aktuálním Avg Lead Time

**Obsah každého sloupce:**
- Složení týmu (member cards s rolemi, editovatelné)
- 4 metriky: Celkový čas, Avg WIP, Čekání, Handoffs — s delta % oproti druhému týmu
- Live flow: progress bary probíhajících features

**Winner banner** (zobrazí se po doběhu obou simulací):
- Zvýrazní vítězný tým a procentuální rozdíl v Lead Time
- Stručné vysvětlení příčiny ("méně čekání, méně předávání")

**Sdílené ovládací prvky (header):**
- Tlačítko ▶ Spustit (spustí obě simulace zároveň)
- Tlačítko ↺ Reset (resetuje obě)
- Přepínač rychlosti (1×, 2×, 5×)

---

### Mód 2 — Experimentování

Rozložení totožné s dnešním UI (3 sloupce: backlog+controls / in-progress+team / stats+done).
Přidány:
- Tooltip nápověda u každého nastavení (existuje již dnes)
- Popisky u segmented controls (existují již dnes)
- Přepínač módu v headeru

---

### Identical backlog indicator
- Each team processes its **own independent backlog**, but both contain **identical items**:
  same features, same sizes, same distribution of roles required per item
- This ensures a fair comparison — the only variable is the team structure
- The full backlog list is **not shown** — it would add noise
- A small **"Identical backlog · N items"** badge is displayed between the two column headers,
  making the equal-conditions immediately visible at a glance
- Backlog settings (size, variability) are shared — one setting applies to both backlogs

### Pre-configured teams
Both teams have **6 members** with the same roles: Design, React, Java, Database, QA, Ops.

| Member | Team A — Specialists | Team B — Cross-functional |
|--------|---------------------|--------------------------|
| 1 | Design only | Design + React |
| 2 | React only | React + Java |
| 3 | Java only | Java + Database |
| 4 | Database only | Database + QA |
| 5 | QA only | QA + Ops |
| 6 | Ops only | Ops + Design |

Teams are pre-configured on load; the user can edit roles freely before running.

### Language
All UI text is in **English** only.

---

## Specification by Example

**Example 1: Default state on load**
- Given: user opens the app for the first time
- When: page loads
- Then: Compare mode is active; Team A has 6 members with 1 role each; Team B has 6 members with 2 roles each; a "Shared backlog · 100 items" badge is visible between the columns; the ▶ Run button is the most prominent element

**Example 2: Running parallel simulations**
- Given: Compare mode, both simulations are stopped
- When: user clicks ▶ Run
- Then: both simulations start simultaneously; progress bars fill in real time in both columns; metrics update live

**Example 3: Winner banner appears**
- Given: Compare mode, both simulations are running
- When: the last feature is completed in both simulations
- Then: a winner banner appears above the columns naming the faster team, the % lead time difference, and a one-line explanation

**Example 4: Switching to Experiment mode**
- Given: Compare mode, simulation may be running
- When: user clicks the 🔬 Experiment tab
- Then: full UI is shown (backlog + controls / in-progress + team / stats + done); simulation state from Experiment mode is preserved independently

**Example 5: Switching back to Compare**
- Given: Experiment mode, simulation running
- When: user clicks ⚖️ Compare tab
- Then: both Compare simulations reset to initial pre-configured state; any in-progress run in Experiment mode is paused

**Example 6: Editing a team in Compare mode**
- Given: Compare mode, simulations are stopped
- When: user adds a role to a member in Team A
- Then: change takes effect immediately; next run uses the updated configuration

**Example 7: Delta metrics**
- Given: Compare mode, both simulations have results (at least 1 feature done)
- When: Team B has lower Avg Lead Time than Team A
- Then: Team B metrics show a green ↓ delta; Team A metrics show a red ↑ delta relative to each other

## Out of Scope
- Srovnání více než 2 týmů najednou
- Ukládání konfigurací týmů do localStorage (to je jiná feature)
- Graf Lead Time v módu Srovnání (LeadTimeChart zůstává jen v Experimentování)
- Pojmenování týmů uživatelem (název je fixní: Tým A / Tým B)
- Sdílení odkazu s konfigurací

## Technical Notes

### Architektura dvou simulací
- V módu Srovnání budou existovat dvě nezávislé instance `SimState` a dvou `rngRef`
- Oba `rngRef` se inicializují ze stejného seedu (deterministický backlog)
- RAF smyčka v `Simulator.tsx` bude volat `tick()` pro oba stavy při každém framu
- Komponenta `Simulator.tsx` pravděpodobně bude refaktorována — logika dvou simulací
  může být extrahována do custom hooku `useSimulation(settings, roleConfig)`, který
  vrací `{ state, paused, start, reset, ... }`

### Nové soubory / změny
- `src/components/Simulator.tsx` — hlavní refaktor (přidání mode switcher, double sim)
- `src/components/ComparePanel.tsx` — nová komponenta pro jeden sloupec srovnání
- `src/components/WinnerBanner.tsx` — nová komponenta pro výsledkový banner
- `src/hooks/useSimulation.ts` — nový custom hook (extrakce RAF logiky)
- `src/types/simulation.ts` — případné nové typy pro mód srovnání

### Zachování stávající funkcionality
- Mód Experimentování musí fungovat identicky jako dnešní UI
- Všechny existující testy musí procházet beze změny

## Design principles
- **Clarity first:** generous whitespace, strong visual hierarchy, no decorative elements
- **One primary action:** the ▶ Run button is always the most visually prominent interactive element
- **No jargon without context:** every metric label has a short tooltip explaining what it means
- Switching to Comparison mode always resets both simulations (clean state, no leftover numbers)

## Related Features
- **feat-013-zprehledneni-aplikace** — implements the `?` icon + tooltip system referenced in the
  design principle "No jargon without context". The tooltip component (`HelpIcon`) is owned by
  feat-013; feat-009 depends on it for metric label tooltips.
- **feat-013-zprehledneni-aplikace** — the spotlight tutorial is mode-aware: switching between
  Compare and Experiment modes may trigger a per-mode tutorial prompt. The mode switcher in
  `Simulator.tsx` must call the tutorial context when a mode is entered for the first time.

## Open Questions
~~All resolved.~~
