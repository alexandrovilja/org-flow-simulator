# Feature: Revize tutoriálu

## Status
in-progress

*Obsah prohlídek prošel s uživatelem krok po kroku 2026-10-21 (texty, pořadí, vzhled karty). Spec, UI návrh i testy schváleny 2026-10-21. Implementace (fáze 5) a opravy z review (fáze 6, 6 nálezů) hotové na větvi `feat/025-revize-tutorialu`: 1053/1053 unit, 70/70 E2E, typecheck a lint čisté.*

## Problem
Tutoriál (feat-013) ukazuje, *kde* co na obrazovce je, ale skoro nevysvětluje, *jak to číst*. Nikde neřekne, co znamenají barevné úseky na kartě featury, proč práce čeká, ani k čemu jsou jednotlivé módy. Uživatel se nedozví, že existují Advanced a Cash Flow, dokud na ně neklikne.

Další problémy:
- Několik textů neodpovídá současnému UI: „Team A is Single-skill“ (typ týmu jde přepnout, feat-011), „Winner banner“ (dnes rámeček výsledku, feat-021), u Done v Advanced „cycle time“ (ve skutečnosti lead time).
- Věta „same backlog, different structure“ zazní čtyřikrát a kroky týmu B kopírují kroky týmu A.
- Prohlídka Advanced vynechává hlavní páky: úpravy jednotek, AI, výchozí sestavy, pravidla práce a srovnání s předchozím během.
- Cash Flow nemá prohlídku ani tlačítko „?“.
- Karta nemá nadpis, nejde se vrátit o krok a z „8 / 14“ není poznat, v jaké části prohlídky uživatel je.

## User Story
Jako agilní kouč nebo manažer, který simulátor otevírá poprvé, chci krátkou prohlídku, která mi řekne, k čemu nástroj je, co dělají jednotlivé módy a jak číst, co se na obrazovce děje, abych ho dokázal používat bez vysvětlování od autora.

## UI / Design

*Schválený UI návrh (fáze 3, 2026-10-21): maketa [`docs/feat-025-ui-mockup.html`](../docs/feat-025-ui-mockup.html). Jediná odchylka v implementaci: značka nové záložky u odkazů je malá SVG ikona šipky, ne znak ↗ (ten hlídač emoji z feat-022 nepovoluje); vypadá stejně.*

### Karta tutoriálu
- **Hlavička:** vlevo ukazatel postupu ve tvaru `ČÁST · n / N` (např. „COMPARE · 8 / 14“). Název části je velkými písmeny, pořadí je celkové za celou prohlídku. Vpravo zůstává „Skip tutorial“.
- **Nadpis kroku:** krátký tučný nadpis nad textem.
- **Text:** jeden odstavec jako dnes.
- **Tlačítka:** „← Back“ vlevo od „Next →“ / „Finish“. Na prvním kroku se „← Back“ nezobrazuje. Zpět vrátí předchozí krok včetně jeho zvýraznění.
- **Rámeček zvýraznění:** pulzující rámeček kolem zvýrazněného prvku má **ostré rohy** (bez zaoblení), aby ladil s hranatými panely a tlačítky. Barva, šířka a pulzování zůstávají.
- Styl karty a ztmavení zůstávají podle feat-021. **Karta tutoriálu zůstává zaoblená** (12 px); ostré rohy dostane jen rámeček zvýraznění.

### Úvodní karta (krok 1 prohlídky Compare)
Nemá co zvýraznit, takže je **uprostřed obrazovky** (vodorovně i svisle) a **širší** než ostatní karty (cca 560 px). Kromě odstavce má odrážky. Odkazy se otevírají v nové záložce a prohlídku nezavřou ani neposunou.

> **Welcome to Org Flow Simulator**
> A tool for understanding how different ways of setting up an organization affect flow and key metrics. Inspired by a [traffic simulator](https://traffic-simulation.de/) and the multi-learning game by [Robert Batůšek](https://www.batusek.cz/en/).
>
> - It's a simplification of reality — many aspects of real organizations are left out.
> - It's still in development, so I'd really appreciate your feedback. It helps me steer the tool where it's most useful.
> - To learn more about organizational design, I recommend [Org Topologies](https://www.orgtopologies.com).

### Prohlídka Compare (14 kroků)
Spouští se automaticky při první návštěvě a přes „?“ v Compare. Vždy začíná úvodní kartou.

| # | Část | Zvýrazní | Nadpis | Text |
|---|---|---|---|---|
| 1 | WELCOME | nic (úvodní karta, viz výše) | Welcome to Org Flow Simulator | viz výše |
| 2 | TOP BAR | záložka Compare | Compare | Two teams work through the same backlog side by side. Only the team structure differs — that's the variable you're testing. We'll go through it in detail in a moment. |
| 3 | TOP BAR | záložka Advanced | Advanced | Organization, fully in your hands: add units, give them skills and mandates, speed some up with AI and shape the backlog. Use it to model your own organization and try what-ifs. |
| 4 | TOP BAR | záložka Cash Flow | Cash Flow | Like Advanced, but every finished feature starts earning money. Use it to see what cycle time and work in progress mean for revenue. |
| 5 | TOP BAR | ikona bubliny (zpětná vazba) | Feedback | Got an idea, found a bug, or something unclear? Click the speech-bubble icon any time to write to the author. |
| 6 | COMPARE | hlavička týmu A s přepínačem Single / Double / Multi | Team type | How many roles can one person cover? Single = one, Double = two, Multi = three. Team A starts as Single — pure specialists. Switching the type restarts both runs. |
| 7 | COMPARE | složení týmu A | Who's on the team | Six people and the roles they can do. During the run, each card shows what that person is working on — or IDLE when they have nothing to do. |
| 8 | COMPARE | první karta featury v To Do týmu A (když je To Do prázdné, celý sloupec To Do) | A feature | Each colored segment is work for one role — the wider the segment, the more work. A feature is done when every segment is filled. |
| 9 | COMPARE | sloupec In Progress týmu A | In Progress | During the run, features being worked on sit here. The filled part of a segment is work done; a pale segment waits for someone free with that role. |
| 10 | COMPARE | sloupec Done týmu A | Done | Finished features land here. The number under each one is its lead time: from entering the backlog to done. |
| 11 | COMPARE | výsledky týmu A | Results | Total Time: until the last feature is done. Avg Cycle Time: from work start to done. Avg WIP: features in progress at once. Lower is better — each tile shows the gap to the other team. |
| 12 | COMPARE | celý panel týmu B | Team B | Team B starts as Double: the same six people, each covering two roles. Everything else is identical, so you read it just like Team A. |
| 13 | COMPARE | ovládání („?“, Reset, rychlost) | Controls | Change the speed (0.5×, 1×, 10×) at any time, even mid-run. ↺ Reset starts over with the default Single vs Double teams. ? brings this tour back. |
| 14 | COMPARE | tlačítko ▶ Run | Run it | Click ▶ Run to start both teams. When both finish, a result box shows which team was faster and why. |

Kroky 6–11 zvýrazňují část týmu A a zbytek jeho panelu ztlumí méně než okolí (dvojí ztmavení jako dnes).

### Prohlídka Advanced (15 kroků)
Spouští se automaticky při prvním přepnutí do Advanced a přes „?“ v Advanced. Krok se zpětnou vazbou v ní už není.

| # | Část | Zvýrazní | Nadpis | Text |
|---|---|---|---|---|
| 1 | INTRO | záložka Advanced | Your organization | Here you build and tune one organization. Left: backlog and settings. Middle: work in progress and your units. Right: results. |
| 2 | ORGANIZATION | mřížka Units | Units | Each card is one unit — a team or a person. Its colored chips are its skills and mandates: a unit can only work on segments in matching colors. |
| 3 | ORGANIZATION | první karta jednotky | Shape your units | + adds a skill, × on a chip removes it. Click the name to rename the unit, × in its corner removes it. The button under the grid adds a new unit. |
| 4 | ORGANIZATION | tlačítko AI na první kartě jednotky | AI speed-up | Click AI to make this unit work faster: 1× → 2× → 5× → off. Only this unit speeds up; everything else stays the same. |
| 5 | ORGANIZATION | přepínač Unit preset (Teams / People) | Starting point | Pick a ready-made setup: Teams — six component teams (Payments, CRM, …); People — six individual specialists. Switching replaces your units and skills. |
| 6 | BACKLOG & RULES | seznam Backlog | Backlog | Features waiting for work, most important at the top. A free unit picks the most important work matching its skills, following the rule set under Team. |
| 7 | BACKLOG & RULES | hlavička sekce Backlog | Backlog settings | Open it to generate a new backlog or import your own from Excel (↓ Template shows the format). Sliders set size and variability; they apply on Generate new backlog. |
| 8 | BACKLOG & RULES | hlavička sekce Specializations | Specializations | Define the skills and mandates units can have: add, rename or recolor them. Phase sets the order — a later phase starts only when earlier phases of that feature are done. |
| 9 | BACKLOG & RULES | hlavička sekce Team | Work rules | Open Team to choose how a free unit picks work. Reduce WIP: finish started features first. Min units: stick to features it knows and avoid those others work on. |
| 10 | RUN & RESULTS | In Progress | In Progress | Features being worked on. A framed card has work going on right now. A letter on a segment shows which unit is on it; ✓ marks a finished segment. |
| 11 | RUN & RESULTS | mřížka Units | Unit states | During the run, each unit shows what it works on. idle — no work for its skills. waiting… (highlighted) — work exists, but an earlier phase of that feature isn't done. |
| 12 | RUN & RESULTS | Done | Done | Finished features, with the number of tasks and the lead time of each: from entering the backlog to done. |
| 13 | RUN & RESULTS | Metrics | Metrics | Hover ? on a tile for its definition. Total Wait and Avg Handoffs stay at zero until you give skills different phases under Specializations. |
| 14 | CONTROLS | ovládání („?“, Reset, rychlost) | Controls | Change the speed (0.5×, 1×, 10×) at any time. ↺ Reset puts the same backlog back to the start and keeps your units. ? brings this tour back. |
| 15 | CONTROLS | tlačítko ▶ Run | Run it | Click ▶ Run. When the run finishes, change one thing — a unit, a skill or a rule — press ↺ Reset and run again. Each tile then shows the change against the previous run. |

### Prohlídka Cash Flow (8 kroků, nová)
Spouští se automaticky při prvním přepnutí do Cash Flow a přes nové tlačítko „?“ v ovládání Cash Flow. Ovládání má pak ve všech třech módech stejné pořadí: `? · ↺ Reset · rychlost · ▶ Run`. Prohlídka ukazuje jen to, co je oproti Advanced nové.

| # | Část | Zvýrazní | Nadpis | Text |
|---|---|---|---|---|
| 1 | INTRO | záložka Cash Flow | Flow meets money | The same setup as Advanced, but every finished feature starts earning money. Units, AI and settings work just like there; this tour covers what's new. |
| 2 | REVENUE | seznam Backlog | Value per feature | Each feature shows what it earns per tick — every 3 s of simulation time — once delivered. The most valuable features sit at the top, as the highest priority. |
| 3 | REVENUE | hlavička sekce Backlog | Revenue curve | Open Backlog to pick how revenue ramps up after delivery. Flat: full amount at once. J-curve: low at first, then above flat. S-curve: slow start, levels off at flat. |
| 4 | REVENUE | Done | Earnings | Each delivered feature earns every tick. The big number is its total so far, +€ flashes on each payment and the bar counts down to the next one. |
| 5 | REVENUE | dlaždice Revenue (time-matched) | Revenue (time-matched) | Compares this run with the previous one at the same moment, so a longer run can't win just by running longer. Details shows the full totals. |
| 6 | COORDINATION | hlavička sekce Team | Coordination overhead | Turn it on under Team: each extra unit that joins a feature pays 25 % extra work and may cause rework (20 % chance). Cards then show ⇄ joins and ↺ rework. |
| 7 | CONTROLS | ovládání („?“, Reset, rychlost) | Controls | Change the speed (0.5×, 1×, 10×) at any time. ↺ Reset puts the same backlog back to the start and keeps your units. ? brings this tour back. |
| 8 | CONTROLS | tlačítko ▶ Run | Run it | Click ▶ Run. When the run finishes, change one thing — a unit, the curve or a rule — press ↺ Reset and run again. The revenue tile then shows the difference. |

### Rozbalovací sekce
Kroky o sekcích Backlog, Specializations a Team zvýrazní jen **hlavičku** sekce. Tutoriál sekci sám nerozbaluje ani nesbaluje; zůstává, jak ji uživatel nechal.

### Rámeček výsledku v Compare
Popisek nad výsledkem se mění z „Result · avg lead time“ na **„Result · avg cycle time“**. Rámeček počítá průměrný cycle time (stejné číslo jako dlaždice Avg Cycle Time), takže dosavadní popisek nesouhlasil s tím, co ukazuje.

## Specification by Example

**Příklad 1: První návštěva otevře úvodní kartu**
- Given: localStorage neobsahuje `tutorial-completed` ani žádný viděný mód
- When: uživatel otevře aplikaci
- Then: zobrazí se tutoriál s úvodní kartou uprostřed obrazovky bez zvýraznění; hlavička „WELCOME · 1 / 14“, nadpis „Welcome to Org Flow Simulator“, odstavec s odkazy na traffic-simulation.de a batusek.cz, tři odrážky (poslední s odkazem na Org Topologies), tlačítka „Next →“ a „Skip tutorial“, bez „← Back“

**Příklad 2: Odkaz na úvodní kartě**
- Given: tutoriál je na úvodní kartě
- When: uživatel klikne na odkaz „Org Topologies“
- Then: odkaz se otevře v nové záložce (`target="_blank"`, `rel="noopener noreferrer"`); tutoriál zůstane na kroku 1

**Příklad 3: Název části v hlavičce**
- Given: tutoriál Compare je na kroku 1
- When: uživatel klikne na „Next →“
- Then: zvýrazněná je záložka Compare, hlavička ukazuje „TOP BAR · 2 / 14“ a nadpis „Compare“

**Příklad 4: Návrat o krok**
- Given: tutoriál Compare je na kroku 3 (záložka Advanced)
- When: uživatel klikne na „← Back“
- Then: tutoriál je na kroku 2, zvýrazněná je záložka Compare, hlavička ukazuje „TOP BAR · 2 / 14“; na kroku 1 tlačítko „← Back“ není

**Příklad 5: Obsah tří prohlídek**
- Given: konfigurace kroků tutoriálu
- When: se přečte prohlídka Compare, Advanced a Cash Flow
- Then: mají 14, 15 a 8 kroků; každý krok má část, nadpis, text a cíl zvýraznění přesně podle tabulek v UI / Design, ve stejném pořadí

**Příklad 6: Zpětná vazba je v úvodu Compare**
- Given: tutoriál Compare
- When: uživatel dojde na krok 5
- Then: zvýrazněná je ikona bubliny v horní liště (`feedback-button`) s nadpisem „Feedback“; prohlídky Advanced a Cash Flow krok se zpětnou vazbou nemají

**Příklad 7: Krok „A feature“ při plném a prázdném To Do**
- Given: To Do týmu A obsahuje featury
- When: tutoriál dojde na krok 8
- Then: zvýrazněná je první karta featury v To Do týmu A
- Given: běh Compare doběhl a To Do týmu A je prázdné, uživatel spustil tutoriál přes „?“
- When: tutoriál dojde na krok 8
- Then: zvýrazněný je celý sloupec To Do týmu A; text kroku je stejný

**Příklad 8: První přepnutí do Cash Flow spustí prohlídku**
- Given: uživatel prošel nebo přeskočil prohlídku Compare a Cash Flow ještě neviděl
- When: přepne do Cash Flow
- Then: spustí se prohlídka Cash Flow na kroku 1: zvýrazněná je záložka Cash Flow, hlavička „INTRO · 1 / 8“, nadpis „Flow meets money“

**Příklad 9: Druhé přepnutí do Cash Flow prohlídku nespustí**
- Given: uživatel prohlídku Cash Flow dokončil nebo přeskočil
- When: znovu přepne do Cash Flow
- Then: prohlídka se nespustí

**Příklad 10: Tlačítko „?“ v Cash Flow**
- Given: uživatel je v Cash Flow a prohlídku už viděl
- When: klikne na „?“ v ovládání
- Then: spustí se prohlídka Cash Flow od kroku 1; ovládání Cash Flow má pořadí `? · ↺ Reset · 0.5× · 1× · 10× · ▶ Run`

**Příklad 11: „?“ v Compare začíná úvodní kartou**
- Given: uživatel prohlídku Compare už dokončil
- When: klikne na „?“ v Compare
- Then: prohlídka začne úvodní kartou „WELCOME · 1 / 14“

**Příklad 12: Rozbalovací sekce zůstává, jak byla**
- Given: sekce Team v Advanced je sbalená
- When: tutoriál dojde na krok 9 („Work rules“)
- Then: zvýrazněná je hlavička sekce Team a sekce zůstane sbalená; když byla rozbalená, zůstane rozbalená

**Příklad 13: Přeskočení a dokončení u všech tří prohlídek**
- Given: běží libovolná ze tří prohlídek
- When: uživatel klikne na „Skip tutorial“, nebo na posledním kroku na „Finish“
- Then: tutoriál zmizí, uloží se `tutorial-completed` a mód prohlídky se označí jako viděný (`compare`, `experiment` nebo `cashflow`)

**Příklad 14: První přepnutí do Advanced zvýrazní záložku**
- Given: uživatel prošel prohlídku Compare a Advanced ještě neviděl
- When: přepne do Advanced
- Then: prohlídka Advanced začne krokem 1 se zvýrazněnou záložkou Advanced, hlavička „INTRO · 1 / 15“

**Příklad 15: Nejdelší karta se vejde**
- Given: okno 1024 × 768 px
- When: tutoriál Compare zobrazí krok 11 („Results“) a úvodní kartu
- Then: obě karty jsou celé uvnitř okna, žádný text ani tlačítko nejsou oříznuté

**Příklad 16: Popisek rámečku výsledku**
- Given: oba běhy v Compare doběhly
- When: zobrazí se rámeček výsledku
- Then: popisek nad titulkem je „Result · avg cycle time“

**Příklad 17: Ostré rohy rámečku zvýraznění**
- Given: tutoriál je na libovolném kroku, který něco zvýrazňuje
- When: zobrazí se pulzující rámeček kolem zvýrazněného prvku
- Then: rámeček má ostré rohy (zaoblení 0 px); barva, šířka a pulzování jsou stejné jako dřív

## Out of Scope
- Interaktivní kroky: tutoriál nečeká na akci uživatele, sám nic nerozbaluje, nepřepíná ani nespouští.
- Nápověda po skončení běhu (např. upozornění na rámeček výsledku).
- Jiné jazyky než angličtina.
- Přejmenování „Specializations“ v UI na „skills and mandates“. V detailních krocích Compare zůstává slovo „roles“.
- Výchozí fáze specializací a chování dlaždic Total Wait a Avg Handoffs (ve výchozí sestavě jsou nulové). Tutoriál to jen vysvětlí.
- Změna metrik nebo toho, co ukazují čísla v Done. Mění se jen popisek rámečku výsledku.
- Klávesové zkratky v tutoriálu a úpravy pro mobilní šířky nad rámec dnešního chování.
- Analytika průchodu tutoriálem.

## Technical Notes
- **Typy (`src/types/tutorial.ts`):** `TutorialMode` dostane `'cashflow'`. `TutorialStep` dostane povinné `title` a `chapter` a nepovinné `bullets?: string[]` (odrážky úvodní karty) a `fallbackTargetId?: string` (cíl, když `targetId` v DOM není, Příklad 7).
- **Odkazy:** text a odrážky mohou obsahovat odkazy ve tvaru `[popisek](https://…)`. Overlay je vykreslí jako `<a target="_blank" rel="noopener noreferrer">`. Povolené jsou jen adresy `https://`. Konfigurace kroků tak zůstává čistá data bez JSX.
- **Konfigurace (`src/lib/tutorialSteps.ts`):** tři prohlídky podle tabulek. Pomocná funkce `feedbackStep` se použije jen pro Compare (krok 5).
- **Overlay (`src/components/TutorialOverlay.tsx`):**
  - hlavička `${chapter} · ${n} / ${N}`, nadpis, tlačítko „← Back“ (skryté na kroku 1),
  - krok bez cíle (úvodní karta) je uprostřed obrazovky a širší, s odrážkami,
  - měření cíle zkusí `targetId`, pak `fallbackTargetId`,
  - výpočet pozice karty dnes počítá s pevnou výškou `CARD_H = 240`. S nadpisem a delšími texty by měl použít skutečnou výšku karty (změřenou přes ref), jinak hrozí oříznutí (Příklad 15).
- **Nové cíle `data-tutorial-target`:**
  - `ComparePanel`: sloupce `${prefix}-todo`, `${prefix}-in-progress`, `${prefix}-done` (prop pro `KanbanColumn`) a první karta To Do `${prefix}-first-feature`;
  - `InProgressTeamPanel` / `MemberCard`: první jednotka `${prefix}-first-unit` a její tlačítko AI `${prefix}-first-unit-ai`;
  - `BacklogSettingsPanel`: přepínač presetu `${prefix}-unit-preset` a hlavičky sekcí `${prefix}-backlog-accordion`, `${prefix}-specializations-accordion`, `${prefix}-team-accordion`;
  - Cash Flow: `tutorialTargets` pro `ResultsAside` v `CashFlowPanel` (`cashflow-results`, `cashflow-done`), dlaždice výnosu `cashflow-revenue` a obal ovládání `cashflow-controls` v `Simulator.tsx`.
  - Cíle, které po revizi nic nepoužívá (např. `compare-team-a-kanban`, dílčí cíle týmu B, `experiment-settings`, `experiment-chart`), se mohou odstranit.
- **`Simulator.tsx`:** při přepnutí do Cash Flow spustit prohlídku, když `!hasSeenMode('cashflow')` (stejně jako Advanced). `SpeedControl` v Cash Flow dostane `onRestartTutorial={() => handleTutorialRelaunch('cashflow')}`. Overlay se musí vykreslit i v Cash Flow větvi renderu.
- **Advanced, krok 1:** při ručním procházení se jednou stalo, že po prvním automatickém přepnutí do Advanced nebyla záložka zvýrazněná (karta dole, celé ztmavení). Napodruhé se to nezopakovalo. Příklad 14 to hlídá.
- **`WinnerBanner.tsx`:** popisek „Result · avg cycle time“.
- **Rámeček zvýraznění (`TutorialOverlay.module.css`, `.pulseRing`):** `border-radius: 15px` → `var(--radius-none)`. Komentář o „panel radius 12px“ se odstraní, protože už neplatí.
- **Dotčené testy:**
  - `feat-013-zprehledneni-aplikace.test.ts`: počty a pořadí kroků Compare a Advanced,
  - `feat-024-zpetna-vazba-tutorial.test.tsx`: pozice kroku se zpětnou vazbou, Cash Flow tutoriál nově má,
  - `feat-021-run-controls.test.tsx`: Cash Flow nově má „?“, texty kroků o ovládání,
  - E2E `tests/e2e/helpers.ts` (`skipTutorial` musí označit jako viděný i `cashflow`, jinak by prohlídka blokovala E2E testy Cash Flow),
  - E2E `feat-022-sjednoceni-designu.spec.ts` a `feat-023-jednotne-pismo.spec.ts`, které rámeček výsledku hledají podle textu „Result · avg lead time“,
  - případně další testy, které hledají odstraněné cíle.
- **Nové testy:** `tests/unit/feat-025-*.test.ts(x)` nad konfigurací kroků (Příklad 5, 6), overlayem (hlavička, nadpis, Back, úvodní karta a odkazy, záložní cíl; Příklady 1–4, 7, 12) a integrací v `Simulator` (Cash Flow automaticky a přes „?“, Advanced krok 1; Příklady 8–11, 13, 14). Příklady 15 a 17 jako E2E v Playwright (velikost karty a vypočtené `border-radius` rámečku, které jsdom nespočítá).

### Kontrakt testů (fáze 4)
Testy jsou kontrakt pro implementaci. Kromě tabulek v UI / Design z nich plyne:
- **`src/lib/tutorialText.ts`** exportuje `splitTutorialText(text)` → pole částí `{ kind: 'text', text }` a `{ kind: 'link', label, href }`. Odkazem se stane jen `https://…`, jinak zůstane text beze změny; prázdné textové části se nevracejí.
- **Rodiče v Advanced:** krok 3 má rodiče `experiment-team-composition`, krok 4 `experiment-first-unit` (jako v maketě).
- **Karta (DOM):**
  - hlavička je jeden text `ČÁST · n / N`;
  - nadpis má roli heading;
  - tlačítko se jmenuje přesně „← Back“;
  - odrážky jsou seznam (`ul`/`li`);
  - odkaz má přístupný název jen z popisku a uvnitř dekorativní `svg[aria-hidden="true"]`;
  - text karty je v jediném `<p>` (E2E feat-023 kontroluje jeho oříznutí);
  - karta si ponechá třídu `card`;
  - rámeček zvýraznění má `data-testid="tutorial-ring"`.
- **Cíle:** každý cíl kroku je v DOM svého módu právě jednou. Cíl rozbalovací sekce je její tlačítko (nebo ho obsahuje). `compare-team-a-first-feature` je uvnitř `compare-team-a-todo`.
- **Spuštění Cash Flow:** prohlídka se spustí při přepnutí do Cash Flow, jen když `cashflow` není mezi viděnými módy (stejně jako Advanced, nezávisle na `tutorial-completed`).
- **Doplněno při implementaci:**
  - Overlay má v `Simulator.tsx` `key={tutorialMode}`. Bez něj React při rychlém přeskočení Advanced a přepnutí do Cash Flow znovu použil kartu i s jejím krokem a Cash Flow začal krokem 4. Hlídá to regresní test v `feat-025-simulator-integration.test.tsx`.
  - Cíl se poprvé měří hned po vykreslení (`useLayoutEffect`), ne až v dalším snímku. Snímky může zdržet karta prohlížeče na pozadí a to byla pravděpodobná příčina chybějícího zvýraznění v Příkladu 14.
- **Opravy z review (fáze 6):**
  - „?“ zastaví běžící simulaci aktivního módu, stejně jako dialog zpětné vazby. Za běhu by se cíle pod zvýrazněním posouvaly.
  - Před měřením se cíl posune do viditelné oblasti (`scrollIntoView`, `block/inline: 'nearest'`), např. odscrollovaný sloupec To Do.
  - Karta se vykresluje na jediném místě: `withTutorial` v `Simulator.tsx` pro všechny tři módy, s `key={tutorialMode}`.
  - Karta se nepřekresluje od nuly mezi krokem bez a se zvýrazněním a fokus po kliknutí zůstává na tlačítku. Když „← Back“ zmizí (krok 1), fokus se přesune na „Next →“.
  - Šířka i výška karty se měří i při změně velikosti okna.
  - Pomocné funkce pro ovládání v liště jsou ve sdíleném `tests/unit/simulation/topBarControls.ts`.
- **Soubory testů:**
  - nové: `tests/unit/simulation/feat-025-tutorial-steps.test.ts`, `feat-025-tutorial-text.test.ts`, `feat-025-tutorial-overlay.test.tsx`, `feat-025-simulator-integration.test.tsx` a `tests/e2e/feat-025-revize-tutorialu.spec.ts`;
  - upravené: `feat-013-zprehledneni-aplikace.test.ts` (počty, hlavičky; pořadí kroků už hlídá feat-025), `feat-024-zpetna-vazba-tutorial.test.tsx`, `feat-021-run-controls.test.tsx`;
  - testy, které otevírají Cash Flow, mají mezi viděnými módy i `cashflow`;
  - E2E: `helpers.ts`, `smoke.spec.ts`, `feat-015-cash-flow-mod.spec.ts`, `feat-022`, `feat-023` (popisek rámečku; Příklad 11 nově i pro Cash Flow).

## Open Questions
- Přesný název hry Roberta Batůška. Zatím „multi-learning game“, uživatel může upřesnit. Neblokuje implementaci.

## Related Features
- **feat-013-zprehledneni-aplikace:** základ tutoriálu. Feat-025 nahrazuje obsah a pořadí kroků obou prohlídek, přidává třetí prohlídku a rozšiřuje kartu (nadpis, část, Back, úvodní karta).
- **feat-024-zpetna-vazba-uzivatelu:** krok se zpětnou vazbou se přesouvá z předposledního místa na krok 5 prohlídky Compare a z prohlídky Advanced mizí (mění Příklad 14).
- **feat-021-prevod-design-system-org-flow:** „?“ v ovládání je nově i v Cash Flow (Příklad 14 feat-021 uváděl jen Compare a Advanced); mění se popisek rámečku výsledku; karta zůstává ve stylu design systému.
- **feat-009-dva-mody-ui, feat-015-cash-flow-mod:** uzavírá otevřený bod „Cash Flow nemá tutoriál“.
- **feat-011-compare-team-picker:** tutoriál nově zmiňuje přepínač typu týmu (krok 6 Compare), jak feat-011 požadoval.
- **feat-016, feat-017, feat-018, feat-019:** texty prohlídek popisují coordination overhead, křivky výnosu, time-matched výnos a AI. Když se jejich chování změní, je potřeba upravit i texty.
