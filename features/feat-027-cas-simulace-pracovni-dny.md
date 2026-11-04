# Feature: Čas simulace v pracovních dnech

## Status
ready

## Problem
Simulátor dnes měří čas v „sekundách“: Total Time je čítač `MM:SS.d` (např. `02:43.0`), Avg Cycle Time ukazuje `9.1s`, lead time featury `12.4s`, Total Wait `117s`. Pro kouče, který běh ukazuje managementu, jsou to bezrozměrné hodinky: nikdo na workshopu si z „2:43“ nepřeloží, jak dlouho by práce trvala v jeho organizaci, a kouč musí pokaždé vysvětlovat, co sekundy znamenají. Organizace přitom plánují, slibují a měří v pracovních dnech a týdnech.

Cíl: čas v simulaci se čte jako reálný pracovní čas. **1 simulační sekunda = 1 pracovní den, 1 pracovní týden = 5 pracovních dnů.** Feature mění jednotku a zobrazení. Chování enginu (jak jednotky pracují, kdy si berou práci, jak se předává) se nemění.

## User Story
Jako agilní kouč na manažerském workshopu chci, aby simulace ukazovala čas v pracovních týdnech a dnech, abych mohl říct „tahle organizace doručí celý backlog za 37 týdnů a 3 dny“ a manažeři si to přeložili do své reality, místo abych vysvětloval, co jsou simulační sekundy.

## Prior Art
Research: hluboký (2026-11-04) — `docs/feat-027-research.md`. Tabulka příkladů zde není (rozhodnutí uživatele), shrnutí a odkazy jsou v research souboru.

—

## UI / Design

### Jednotka
- **1 simulační sekunda = 1 pracovní den, 1 pracovní týden = 5 pracovních dnů.** Číselné hodnoty enginu se nemění; mění se, jak se čtou a jak se jmenují.
- **Rychlost:** přepínač `0.5× / 1× / 10×` zůstává beze změny. Nově má plovoucí popisek (prop `hint` u `SegmentedControl`, stejný vzhled jako u přepínače typu týmu), který říká `1× = 1 working day per second`. Délka běhu v reálném čase se nemění.

### Total Time: týdny a dny
- Dlaždice **Total Time** ve všech třech módech (Compare, Advanced, Cash Flow) místo `MM:SS.d` ukazuje týdny a dny, např. `2 weeks 4.3 days`.
- Pravidla formátu:
  - týdny = celá část `dny / 5`, dny = zbytek;
  - dny se **zkracují (floor) na desetinu**, nikdy nezaokrouhlují. Hodnota 4.96 se zobrazí jako `4.9 days` a čítač tak nikdy neukáže `5.0 days` ani hodnotu, které ještě nebylo dosaženo (stejný princip jako dnešní `formatTime`);
  - část s týdny se vynechá, když jsou týdny 0 (`4.3 days`); část se dny se zobrazuje vždy, i `0.0 days`, aby čítač neměnil tvar při přechodu přes celý týden;
  - `week` je v jednotném čísle jen pro přesně jeden týden (`1 week 0.0 days`, `2 weeks 0.0 days`); `days` je vždy ve množném čísle.
- **Vzhled hodnoty:** čísla jsou velká a slova malá, jako jednotka ve `StatTile`: **37** weeks **2.9** days. Text hodnoty je přesto jedním řetězcem `37 weeks 2.9 days` (mezery jsou v textu), aby ho přečetly čtečky obrazovky a testy. Hodnota je na jednom řádku, nezalamuje se.
- **Zkrácení při nedostatku místa:** plná slova se píšou vždy; jen když se nevejdou do dlaždice, ukáže se `w` a `d`, např. `37w 2.9d` (týdny se vynechají jako dřív, `4.3d`). Každá dlaždice se rozhoduje podle svého změřeného místa, takže v Compare může jeden tým ukazovat slova a druhý zkratku. Rozhodnutí se přepočítá při změně velikosti dlaždice i hodnoty. Přístupný název zůstává plný text (`37 weeks 2.9 days`). Prostředí bez rozměrů (testy v jsdom) vždy ukáže plná slova.
- **Rozložení Compare se nemění:** řada tří dlaždic zůstává `1fr 1fr 1fr`. Dlaždice Compare dostává stejný vzor „číslo velké, jednotka malá“ jako `StatTile`.
- Stejný formát mají všechny časové hodnoty „v bodě běhu“ v Cash Flow: hint `@ …` pod dlaždicí **Revenue (time-matched)** a řádky v jejím detailu (`Total €X in …`, `Previous run @ …: €Y`, `Previous total €Z in …`).
- Před spuštěním ukazuje Total Time stejné hodnoty jako dnes: v Compare `—`, v Advanced a Cash Flow `0.0 days` (dříve `00:00.0`). Po doběhnutí čítač zamrzne a dlaždice zůstává ve stavu `✓ Complete` (beze změny).

### Doby trvání: dny
Délky jednotlivých featur a součty se ukazují v prostých dnech s jednou desetinou, ne v týdnech:
- **Avg Cycle Time:** hodnota `9.1`, jednotka `days` (Advanced, Cash Flow), v Compare `24.1 days`. Bez dokončených featur `—` (beze změny).
- **Lead time v Done listu:** `12.4 days` (dříve `12.4s`) všude, kde se dnes zobrazuje.
- **Total Wait:** hodnota s jednotkou `man-days`, např. `117.3 man-days`. Je to součet přes všechny jednotky: čekání jedné jednotky po dobu jednoho pracovního dne je 1 man-day, proto může být větší než Total Time. Tooltip to vysvětluje. Nulová hodnota zůstává `—`.
- **Zaokrouhlení:** doby trvání se zaokrouhlují na desetinu jako dnes (`toFixed(1)`), na rozdíl od Total Time, který se zkracuje (floor). `days` je vždy ve množném čísle (`1.0 days`).
- **Delty (↓/↑ N % vs prev run), WinnerBanner, Avg WIP:** bezrozměrné, beze změny.

### Revenue tik: týden
- **Tik výnosu je 1 pracovní týden = 5 pracovních dnů** (dříve 3 s). Každá hotová featura vydělá výnos za týden po každých 5 pracovních dnech od svého dokončení; hodiny každé featury dál běží nezávisle od jejího dokončení (feat-015).
- Badge `€400/tick` se mění na `€400/week` (karta v Backlogu, řádek v Done listu v Cash Flow). Ustálený výnos J-curve je `€800/week`.
- Náhled křivky pod přepínačem profilu výnosu: popisek `Revenue per week after delivery · 0–16 weeks · plateau 2× Flat` (dříve `tick`/`ticks`). Osa X zůstává 0–16 jednotek, tedy 16 týdnů.
- Pulse „+€X“ a odpočítávací proužek do dalšího výnosu u hotové featury zůstávají; perioda je nově 5 pracovních dnů.
- Konstanty křivek J a S (feat-017) se nemění: jsou počítané v tiků, tedy nově v týdnech.

### XLS import: Size = man-days
- Sloupec zůstává `Size`, protože jeho přejmenování by rozbilo existující soubory (feat-026). Mapování zůstává 1:1: `Size = 3` znamená úkol o práci 3 pracovních dnů.
- U importu v panelu Backlog (Advanced i Cash Flow) se objeví nápověda `Size = effort in working days (man-days)`. Je to jeden řádek v 11 px ve stylu hintu dlaždic přímo pod tlačítky Import XLS a Template, nad hláškou o výsledku importu; zůstává vidět i po importu.
- Desetinná čísla zůstávají povolená (`0.5` = půl dne), 0 a záporné hodnoty jsou chybou, maximum zůstává 999.

### Texty
- **Tooltipy** u dlaždic mluví o dnech; tooltip Coordination overhead místo „work-seconds“ říká „man-days of work“.
- **Tutoriál** (Compare, Advanced, Cash Flow): texty o Total Time, lead time, rychlosti a „every 3 s of simulation time“ se přepíšou na pracovní dny a týdny (konkrétně kroky v `tutorialSteps.ts`, viz Technical Notes). Přesné znění je v tabulce kroků v testu `feat-025-tutorial-steps.test.ts` (schvaluje se s testy): kroky s ovládáním říkají „1× is one working day per second“, krok Results „working weeks and days“, lead time „in working days“, výnos „per week — every 5 working days (1 week)“ a „earns every week“.
- **Popis profilu Flat** (hover nad přepínačem křivky): „Every feature earns the same amount per week from the moment it is delivered.“ (dřív „per tick“), aby po změně na `€/week` v UI nezůstalo slovo tick.
- UI zůstává anglicky, desetinná tečka.

## Specification by Example

**Příklad 1: Délka pod týden**
- Given: čas 4.3 pracovních dnů
- When: se naformátuje jako Total Time
- Then: `4.3 days`; čas 0 dává `0.0 days`

**Příklad 2: Týdny a dny**
- Given: časy 14.3, 5, 10 a 187.9 pracovních dnů
- When: se formátují jako Total Time
- Then: `2 weeks 4.3 days`, `1 week 0.0 days`, `2 weeks 0.0 days`, `37 weeks 2.9 days`

**Příklad 3: Zkrácení místo zaokrouhlení**
- Given: časy 4.96, 4.999 a 9.99 pracovních dnů
- When: se formátují
- Then: `4.9 days`, `4.9 days` a `1 week 4.9 days`; zbytek po odečtení týdnů se nikdy nezobrazí jako `5.0 days`; hodnota zadaná jako 4.3 se zobrazí `4.3 days` i po odečtení týdnů (bez chyby plovoucí desetinné čárky)

**Příklad 4: Total Time živě v Advanced**
- Given: Advanced před prvním Run
- When: kouč klikne na Run při rychlosti 1×
- Then: Total Time ukazuje `0.0 days` a roste o jeden pracovní den za reálnou sekundu (po pěti sekundách přibližně `1 week 0.0 days`); při 10× roste desetkrát rychleji; po doběhnutí backlogu čítač zamrzne (např. `37 weeks 2.9 days`) a dlaždice ukáže `✓ Complete`

**Příklad 5: Total Time v Compare**
- Given: Compare před Run
- When: kouč spustí běh a oba týmy doběhnou
- Then: před Run oba týmy ukazují `—`; za běhu a po doběhnutí každý tým svůj čas v týdnech a dnech (např. `37 weeks 2.9 days` a `32 weeks 4.9 days`); rozdíl v procentech (delta) se počítá z týchž hodnot jako dnes

**Příklad 6: Dlaždice Avg Cycle Time**
- Given: dokončené featury s průměrným Cycle Time 9.1 pracovních dnů
- When: se vykreslí dlaždice v Advanced nebo Cash Flow
- Then: hodnota `9.1` a jednotka `days` (dříve `s`); v Compare `24.1 days`; bez dokončených featur `—`

**Příklad 7: Lead time v Done listu**
- Given: dokončená featura s lead time 12.4 pracovních dnů
- When: se vykreslí její řádek v Done
- Then: hodnota `12.4 days` (dříve `12.4s`)

**Příklad 8: Total Wait v man-days**
- Given: součet čekání všech jednotek 117.3 pracovních dnů, Total Time 23 týdnů
- When: se vykreslí dlaždice Total Wait
- Then: `117.3 man-days`; tooltip vysvětluje, že jde o součet přes jednotky; při nulovém čekání `—`

**Příklad 9: Delta beze změny**
- Given: předchozí běh měl Avg Cycle Time 8.4 days, nový běh 6.1 days
- When: nový běh doběhne
- Then: pod hodnotou je `↓ 27%` zeleně, stejně jako dnes (delta je poměr, jednotka se nepromítá)

**Příklad 10: Tik výnosu je týden**
- Given: Cash Flow, featura dokončena v čase 12 pracovních dnů s výnosem €400/week
- When: simulační čas dosáhne 16.9 dne, pak 17.0 a pak 22.0
- Then: v 16.9 featura ještě nic nevydělala; v 17.0 dostane první tik (+€400); ve 22.0 druhý (+€400, celkem €800); odpočítávací proužek při 14.5 dne ukazuje 50 %

**Příklad 11: Badge €/week**
- Given: Cash Flow, featura s ustáleným výnosem €400/week (Flat) a jiná s J-curve a základem €400
- When: se vykreslí karta v Backlogu a řádek v Done
- Then: badge ukazuje `€400/week`, respektive `€800/week`; text `/tick` nikde nezůstane

**Příklad 12: Time-matched výnos s časem v týdnech**
- Given: předchozí běh Cash Flow měl Total Time 187.9 dne, aktuální doběhl za 164.9 dne
- When: aktuální běh doběhne
- Then: hint pod dlaždicí je `@ 32 weeks 4.9 days`; detail ukazuje `Total €X in 32 weeks 4.9 days`, `Previous run @ 32 weeks 4.9 days: €Y` a `Previous total €Z in 37 weeks 2.9 days`; společný čas (kratší z obou) se počítá jako dnes

**Příklad 13: Náhled křivky výnosu**
- Given: Cash Flow, nastavení Backlog, profil J-curve
- When: se zobrazí náhled křivky
- Then: popisek je `Revenue per week after delivery · 0–16 weeks · plateau 2× Flat`

**Příklad 14: Size v XLS importu**
- Given: soubor s řádkem `Feature = Login flow, Skill = BE, Unit = Squad A, Size = 5` a řádkem se `Size = 0.5`
- When: kouč soubor naimportuje
- Then: úkol má práci 5, respektive 0.5 pracovního dne (mapování 1:1 jako dnes); řádek se `Size = 0` nebo záporným je přeskočen s hláškou beze změny; u importu je vidět nápověda `Size = effort in working days (man-days)`

**Příklad 15: Rychlost a její popisek**
- Given: jakýkoli mód s přepínačem rychlosti
- When: kouč najede na přepínač 0.5× / 1× / 10×
- Then: popisek říká `1× = 1 working day per second`; volba rychlosti nemění výsledek běhu, jen jak rychle běží (beze změny)

**Příklad 16: Tutoriál bez sekund**
- Given: tutoriál Compare, Advanced nebo Cash Flow
- When: kouč projde kroky s dlaždicemi výsledků, lead time featur a výnosem featur
- Then: žádný krok nemluví o sekundách ani o formátu `MM:SS`; Total Time se vysvětluje jako pracovní čas ve dnech a týdnech a výnos jako „every 5 working days (1 week)“

**Příklad 17: Engine se nemění**
- Given: stejný seed, stejné nastavení a stejný tým jako před touto feature
- When: běh doběhne
- Then: `simTime`, Cycle Time featur, `idleSec` a pořadí dokončování jsou číselně shodné s dnešními (liší se jen text, v němž se zobrazují); jediná změna chování enginu je interval tiku výnosu (3 → 5)

**Příklad 18: Zkrácení na w a d při nedostatku místa**
- Given: dvě dlaždice Total Time s hodnotou 187.9 pracovního dne; jedna je tak úzká, že se `37 weeks 2.9 days` nevejde (např. Compare při šířce okna 1024 px), druhá dost široká (např. pravý sloupec Advanced)
- When: se obě vykreslí
- Then: úzká ukáže `37w 2.9d`, široká `37 weeks 2.9 days`; obě mají přístupný název `37 weeks 2.9 days`
- When: se úzká dlaždice zvětší tak, že se plná slova vejdou (nebo se hodnota zmenší, např. na 14.3 dne)
- Then: úzká dlaždice ukáže zase plná slova; v prostředí bez rozměrů (testy) se vždy ukážou plná slova

## Out of Scope
- **Měsíce a roky.** Zatím jen týdny a dny.
- **Kalendářní čas:** víkendy, svátky, dovolené, absence, kapacita (focus factor). Simulace počítá jen pracovní dny a nic mezi nimi. Je to vědomá odchylka od nástrojů, které počítají v kalendářních dnech (ActionableAgile, Planview, Businessmap); viz `docs/feat-027-research.md`.
- **Konvence +1 u Cycle Time** (konec − začátek + 1, minimum 1 den; používají ji ActionableAgile a Planview, Businessmap jako volbu). Předpokládá celodenní data, náš čas je spojitý. Odloženo.
- **Nastavitelná délka týdne a dne** (Jira, MS Project). Týden má pevně 5 pracovních dnů.
- **Změna chování enginu:** práce po celých dnech, předání až další den, dělení dne na hodiny. Čas zůstává spojitý, úkol může skončit uprostřed dne.
- **Velikost práce.** Generátor úkolů (`work` 0,8–2,2, tedy dnes průměrně 1,5 dne na úkol) a výchozí backlogy se nemění; čísla ve dnech jsou dnešní „sekundy“ 1:1. Úkoly se dnes zpracovávají příliš rychle, to se přepracuje v samostatné navazující feature (číslo se určí při jejím zadání).
- **Týdny a dny u jednotlivých featur.** Cycle Time, lead time a Total Wait zůstávají v prostých dnech.
- **Nové metriky,** např. throughput za týden.
- **Přejmenování sloupce `Size`** v XLS importu a jednotka přímo v souboru šablony (jen nápověda v UI).
- **Přejmenování interních názvů** (`simTime`, `idleSec`, `joinTaxSec`, `LeadTimeEntry.ms`, `leadTimes`): zůstávají jako u feat-010; upraví se jen jejich JSDoc.
- **Změna konstant křivek výnosu** (feat-017). Jsou v tiků, nově týdnech.
- **Zobrazení `LeadTimeChart.tsx`:** nepoužívá ho žádná komponenta a nezobrazuje se. Jen se u něj (po review) přepsaly jednotky na dny, aby nezůstaly sekundy.
- **Persistence:** v `localStorage` se žádný čas neukládá, migrace není potřeba.
- **Změna poměru sloupců řady metrik v Compare** (zkoušel se `1.5fr 1fr 1fr`). S automatickým zkrácením není potřeba.
- **Sjednocení zápisu (slova × zkratka) mezi oběma týmy v Compare.** Každá dlaždice se rozhoduje sama.

## Technical Notes
- **Engine (`src/simulation/engine.ts`):** logika `tick()`, `computeStats()` ani `computeRevenueAsOf()` se nemění. Jediná změna kódu je hodnota tiku výnosu 3 → 5 a nová konstanta `WORKING_DAYS_PER_WEEK = 5`, ze které se tik odvodí (tik = 1 týden). `computeRevenueAsOf` a `doneOverflow` převezmou novou hodnotu samy. Generování náhodných čísel interval tiku nepoužívá, takže determinismus (seed 42, snapshoty, `coordSeed`) zůstává.
- **JSDoc:** komentáře „simulační sekundy“ se přepíšou na „pracovní dny“ u `SimState.simTime`, `Task.work`, `Member.idleSec`, `LeadTimeEntry.ms`, `Feature.createdAt/startedAt/finishedAt`, `revenuePerTick`, `REVENUE_TICK_INTERVAL_SEC` a u `dtSim` v `tick()` a v `docs/conventions.md`.
- **Formátování (`src/lib/formatTime.ts`):** `formatTime(days)` nově vrací týdny a dny (`2 weeks 4.3 days`) a přibude `formatDays(days)` pro prosté dny (`9.1 days`). Název funkce a soubor zůstávají, takže volající komponenty jen změní příslušné řádky. Počítat v celých desetinách dne a týdny odvozovat z nich, ať zbytek po odečtení týdnů nevyjde o desetinu nižší kvůli plovoucí desetinné čárce. Přibude i zkrácený zápis (`2w 4.3d`) pro automatické zkrácení.
- **Zkracování (nová komponenta, např. `src/components/WorkTimeValue.tsx`, a hook v `src/hooks/`):** vykreslí číslo a jednotku jako samostatné prvky a změří, jestli se plná slova vejdou do dlaždice (`scrollWidth` × `clientWidth`, `ResizeObserver` při změně velikosti), podobně jako `useIsTruncated`. Když ne, ukáže zkratku `w`/`d`; plný text zůstane v `aria-label`. Měří se kořenový prvek komponenty (`data-testid="work-time-value"`): při vykreslení plných slov je jeho `scrollWidth` šířka, kterou slova potřebují, a `clientWidth` místo, které má; při změně velikosti nebo hodnoty se plná slova vykreslí znovu a změří, takže se po zvětšení vrátí. Volbu zápisu podle změřených šířek udělá čistá funkce `chooseTimeNotation(fullWidth, availableWidth)` v `src/lib/chooseTimeNotation.ts`, aby šla testovat bez prohlížeče; komponenta se testuje s nasimulovanými rozměry (jsdom je nemá, takže bez simulace se vždy ukáže plný zápis). Dlaždice musí hodnotu přijmout jako `ReactNode`: `StatTile` dnes bere `value: string` a `MetricTile` v `ComparePanel.tsx` skládá řetězec.
- **Naměřeno** (mockup s písmem JetBrains Mono, 2026-11-04): plná slova potřebují 121 px (`2 weeks 4.3 days`) až 145 px (`104 weeks 0.4 days`) při 20px písmu v Compare. K dispozici je tam 125 / 167 / 194 px při šířce okna 1024 / 1280 / 1440 px, takže se při 1024 px zkracuje od 10 týdnů. V pravém sloupci Advanced a Cash Flow je k dispozici 221 px a plná slova potřebují nejvýš 171 px (28px písmo), takže se tam nezkracuje. Zkrácený zápis zabere kolem 83 px.
- **Komponenty (čísla řádků k dnešnímu stavu):**
  - `Simulator.tsx`: Total Time (`:643`, `:665`), jednotky `s` u Avg Cycle Time a Total Wait (`:1124`, `:1126`), lead time v Done (`:1138`), badge `/tick` (`:1021`), tooltip Total Wait.
  - `ComparePanel.tsx`: `:160`, `:176`, `:184`.
  - `CashFlowPanel.tsx`: hint `@` (`:77`), detail výnosu (`:102–106`), jednotka Avg Cycle Time (`:89`), `/tick` (`:147`), tooltip Coordination overhead (`:117`).
  - `RevenueCurvePreview.tsx`: popisek a komentář `MAX_TICK` (`:17`, `:79`).
  - `SpeedControl.tsx`: popisek rychlosti přes prop `hint` u `SegmentedControl`.
  - `BacklogSettingsPanel.tsx`: nápověda `Size = …` pod tlačítky importu (viz mockup).
  - `xlsImport.ts`: jen JSDoc a komentáře, žádná logika.
  - `tutorialSteps.ts`: řádky `36`, `153`, `162`, `182`, `310`, `351`.
- **Testy, které se nutně změní** (ověřeno na kopii projektu se změněným tikem; kopie nebyla v repu):
  - Při tiku 5 padá **13 z 1132 testů**: feat-015 (1: „sums multiple features…“), feat-016 (4: regresní otisky běhů bez overheadu s pevnými součty výnosů), feat-017 (4: příklady 10, 11, 16) a feat-018 (4: příklady 2 a 3). Všechny mají napevno zapsaná čísla pro tik 3 s.
  - Formát času: `feat-004-total-time.test.ts` (testy `formatTime` se přesouvají do `feat-027-format-time.test.ts`), `feat-021-run-controls.test.tsx`, `feat-024-zpetna-vazba-dialog.test.tsx`, `feat-025-simulator-integration.test.tsx` (čtou Total Time jako hodinky), `feat-017-simulator-integration.test.tsx` a `feat-018-simulator-integration.test.tsx` (hint `@ …` a detail výnosu), `feat-018-revenue-tile.test.tsx` a dva další soubory s `totalTimeDisplay`. Čtyři z nich čtou čítač jako hodinky (rozdíl před/po pauze nebo Resetu, rychlost), takže mají společný pomocník `tests/unit/simulation/workTime.ts`, který převede `N weeks D days` zpět na dny.
  - Texty: `feat-025-tutorial-steps.test.ts` (tabulka kroků tutoriálu) a `feat-021-run-controls.test.tsx` (texty kroků s ovládáním), `feat-017-revenue-curve-ui.test.tsx` (popisek náhledu a popis profilu Flat), `feat-019-simulator-integration.test.tsx` (tooltip Coordination overhead).
  - E2E: `smoke.spec.ts` a `feat-015-cash-flow-mod.spec.ts` porovnávají s `00:00.0` (nová výchozí hodnota Advanced a Cash Flow je `0.0 days`), `feat-015-cash-flow-mod.spec.ts` hledá badge `€X/tick` a `feat-022-sjednoceni-designu.spec.ts` kontroluje písmo řádku s lead time (`12.4s`) a výnosu (`/tick`).
  - Testy enginu k času, determinismu a rychlosti zůstávají beze změny.
- **Total Wait ve výchozím nastavení:** v Advanced je Total Wait po běhu s výchozími jednotkami `—` (nikdo nečeká); nenulový je, až když jednotka čeká na dřívější fázi. Test proto u skillů nastaví pozdější fázi (tlačítko „+“ u Phase), aby ověřil jednotku `man-days`. Příklad `117s` v části Problem tedy pochází ze složitějšího nastavení.
- **Důsledek tiku 5 pro výnosy** (výchozí Cash Flow běh, seed 42, People, silo, 100 featur; tik 3 → tik 5): Flat €396k → €234k, J-curve €634k → €313k, S-curve €340k → €179k. Absolutní součty výnosů klesají (za běh je méně tiků), poměry a delty se nemění. Čísla ve specech feat-015 až 018 jsou v původních jednotkách.
- **Horizont křivky J** (feat-017, Open Questions): J-curve dohání Flat po 11 tiků, což je nově 11 týdnů (55 pracovních dnů) místo 33 s.
- **Tabulka křivek** (`REVENUE_CURVE_TABLE_TICKS = 60`) pokryje 60 týdnů, což zůstává dostatečné, protože výnos je tam už na plató.
- **Pozor na `formatEuro`:** při tiku 5 jsou součty pod milionem, takže přípona „M“ není potřeba. Kdyby se tik v budoucnu zkrátil, přibyla by (`formatEuro` zná jen „k“).
- **Prahy `simTime > 0.5`** u Avg WIP (`Simulator.tsx`, `ComparePanel.tsx`) znamenají půl pracovního dne; zůstávají, jen se to zdokumentuje komentářem.
- **Navazující feature (velikost práce):** zvětšení `work` prodlouží Total Time a při 1× se prodlouží i reálná délka běhu (1 den = 1 s), takže tam bude potřeba posoudit rychlosti přepínače a velikost výchozího backlogu.

## Open Questions
- ~~Pojmenování velikosti~~ → rozhodnuto 2026-11-04: **Size = „man-days“** (známý a zavedený pojem; research nabídl neutrální „person-days“, uživatel zůstává u „man-days“). Rozhodnuto 2026-11-04: **stejný pojem „man-days“ platí i pro Total Wait a tooltip Coordination overhead** (původní návrh „unit-days“ se ruší, byl to nový výraz bez zavedeného významu). Total Wait je čekací protějšek práce zadané ve `Size`, takže má smysl měřit obojí stejnou jednotkou. Nepřesnost u presetu Teams (jednotka je tým, ne člověk) je u obou stejná a tooltip vysvětluje, že se počítá po jednotkách.
- **Název konstanty** `REVENUE_TICK_INTERVAL_SEC` obsahuje „SEC“. Návrh: ponechat (interní názvy se nepřejmenovávají, viz feat-010) a opravit JSDoc.
- ~~Šířka dlaždic~~ → rozhodnuto 2026-11-04 (fáze 3): plná slova, zkratka `w`/`d` jen když se nevejdou, bez změny sloupců Compare (`1.5fr 1fr 1fr` se zkoušelo a nepotřebuje se). Mockup: `docs/feat-027-ui-mockup.html`.
- ~~Popisek rychlosti~~ → rozhodnuto (fáze 3): plovoucí `hint` u `SegmentedControl`.
- **Sjednocení zápisu v Compare:** zatím se každá dlaždice rozhoduje sama, takže tým A může ukazovat zkratku a tým B slova. Sjednotit podle delšího z obou? Nízká priorita.
- **Pořadí s navazující featurou o velikosti práce:** po jejím nasazení se změní délka běhů (a tím i čísla v tutoriálu a příkladech); rozhodnout, zda se přepíše i rychlost přepínače.
