# Feature: Cash Flow mód

## Status
done

## Problem
Manažeři nevidí přímou souvislost mezi tím, jak dlouho trvá dokončit feature (cycle time) a kolik WIP mají rozpracovaného, a mezi reálným finančním dopadem — penězi, které firma ztrácí tím, že hodnotné featury leží v backlogu nebo se zpomalí kvůli přetíženému týmu. Existující módy ukazují cycle time a WIP jako abstraktní čísla, ne v penězích.

## User Story
Jako agilní kouč chci v Cash Flow módu ukázat manažerům, že když více týmů/lidí může pracovat na nejprioritnějších featurach současně (místo úzké specializace a sériového zpracování), výnosy z backlogu rostou výrazně rychleji — abych jim demonstroval finanční hodnotu cross-funkčnosti a nízkého WIP.

## UI / Design
- Nový tab **💰 Cash Flow** v hlavním přepínači módů, za ⚖️ Compare a 🔬 Advanced
- Cash Flow je samostatný, nezávislý mód s vlastním backlogem/SimState (analogicky k Compare a Advanced) — **plná funkční parita s Advanced módem**: stejný Settings panel (velikost/variabilita backlogu, XLS import, "Generate new backlog"), editor specializací (add/remove/level/required), správa týmu (presety Teams/People, add/remove role, přejmenování, add/remove jednotka), WIP mód přepínač. Konfigurace je nezávislá na Advanced — úprava týmu/backlogu v jednom módu neovlivní druhý.
- **Karta featury v backlogu**: revenue badge s výnosem/tick, např. `€400/tick`, zobrazený v hlavičce karty vedle/pod názvem. V **In Progress** sloupci se revenue badge nezobrazuje (jen v Backlogu) — dokud feature není Done, revenue/tick není pro daný pohled relevantní.
- **In Progress: zvýraznění a řazení aktivních features** (platí pro sdílený `InProgressTeamPanel`, tedy Advanced i Cash Flow; Compare se nemění). *Důvod: při velkém běhu (stovky rozpracovaných features, např. backlog 1000 položek na 6 jednotkách) není poznat, na které feature se právě pracuje — feature, kterou zpracovává jednotka, působí jako by v panelu chyběla.*
  - **Aktivní feature** = alespoň jeden její task má stav `doing`; ostatní rozpracované features jsou „čekající“.
  - **Zvýraznění:** aktivní karta má výrazný rámeček v barvě `var(--ink)` (2 px místo 1 px, bez změny rozměrů karty — přes `box-shadow`/`outline`, aby se mřížka nehýbala). Čekající karty zůstávají beze změny (žádné tlumení, žádná tečka, žádný počet aktivních v záhlaví).
  - **Řazení:** aktivní karty jsou nahoře, uvnitř skupin podle `priority` vzestupně (tiebreak `id`). Řazení je jen v zobrazení — `state.inProgress` se nemění; aktivita se odvozuje ze stavu bez nového pole ve stavu simulace. Karty se mohou přesouvat mezi skupinami, když jednotka dokončí task a nevezme si hned další task téže featury; React key zůstává `feature.id`.
- **Done tab**: u každé dokončené položky navíc: kumulativní celkový výnos (trvale viditelný, roste s časem, např. `€1.4k`), krátký "pulse" indikátor posledního ticku (např. `+€300`), který se na 1–2s zvýrazní po revenue ticku TÉTO featury a pak zmizí/zešedne, a **tenký progress bar** ukazující odpočet do dalšího ticku (0→100 % během 3s od posledního ticku, pak se vynuluje) — každá feature má vlastní nezávislý cyklus (viz Příklad 1)
- **Metriky panel**: 4 dlaždice (StatTile): Total Time, Avg Cycle Time, Avg WIP, Total Revenue — nahrazuje Avg Handoffs a Total Wait (jen v Cash Flow módu; Compare a Advanced si ponechávají svých 5 dlaždic beze změny). Všechny 4 dlaždice zobrazují delta badge (`↓/↑ % vs prev run`) vůči poslednímu dokončenému běhu — u Total Revenue je barevná sémantika obrácená (vyšší = zelená, nižší = červená). Velké číslo na Total Revenue dlaždici je vždy skutečný finální výnos běhu, ale delta badge se počítá **time-matched** k dřívějšímu ze dvou celkových časů obou běhů (viz Příklad 7) — pod dlaždicí se proto zobrazuje hint (`@ 00:50.0`), který jasně říká, ke kterému okamžiku se srovnání vztahuje
- Simulace se **automaticky zapauzuje** okamžitě poté, co je celý backlog zpracovaný (`state.finished`) — bezpodmínečně, stejně jako Advanced mód, žádná výjimka ani prodlužování
- Měna: pevně € (euro), bez konverze/nastavení

## Specification by Example

**Příklad 1: Výnos se připočítává periodicky u dokončené featury, nezávisle pro každou featuru**
- Given: uživatel je v Cash Flow módu, featura A dokončena v simTime=0 s výnosem €300/tick, featura B dokončena o 1,5 s později (simTime=1,5) s výnosem €150/tick
- When: simulace doběhne na simTime=3,0 s
- Then: featura A dostane svůj první tick (+€300, celkem €300), featura B ještě netiká (od jejího dokončení uplynulo jen 1,5 s) — progress bar u B ukazuje 50 % odpočtu
- When: simulace pokračuje na simTime=4,5 s
- Then: featura B dostane svůj první tick (+€150, celkem €150, protože 4,5 − 1,5 = 3,0 s od jejího dokončení), featura A stále čeká na druhý tick (od jejího posledního ticku uplynulo jen 1,5 s) — metrika Total Revenue v panelu metrik po obou přechodech odráží součet obou features

**Příklad 2: Generování výnosů podle Gaussova rozdělení**
- Given: nová Cash Flow simulace se seeduje se 100 features v backlogu (výchozí `initialBacklog`, stejně jako Advanced mód)
- When: engine vygeneruje výnos/tick pro každou featuru vzorkováním z Gaussova rozdělení (mean=140, stddev=100, ořezáno na minimum 15) a seřadí hodnoty sestupně podle priority
- Then: feature #1 (nejvyšší priorita) má revenue ≈ €400/tick, features uprostřed pořadí (#45–#55) mají revenue zhruba €125–155/tick, posledních ~10 features má revenue na minimu €15/tick (ořez spodního konce rozdělení)
- Note (revize 2026-10-13): výchozí velikost backlogu Cash Flow byla původně 20 features. Změněno na 100, aby Cash Flow začínal se stejně velkým backlogem jako Advanced a běh byl dost dlouhý na to, aby se rozdíl ve výnosu mezi strukturami týmů projevil. Slider „Backlog size“ (10–1000) dál funguje beze změny.

**Příklad 3: Přepnutí do Cash Flow módu**
- Given: uživatel je v libovolném jiném módu (Compare nebo Advanced)
- When: uživatel klikne na tab "💰 Cash Flow"
- Then: zobrazí se nová, nezávislá simulace se svým vlastním backlogem (100 features s přiřazeným revenue/tick podle Gaussova rozdělení), karty v backlogu zobrazí revenue badge, Done tab zobrazí u každé položky kumulovaný výnos a poslední tick, panel metrik ukáže 4 dlaždice včetně Total Revenue

**Příklad 4: Výnosy se sbírají jen za běhu simulace**
- Given: Cash Flow simulace je zapauzovaná, existuje alespoň jedna Done feature
- When: uplyne 3+ vteřiny reálného času (simulace stojí)
- Then: žádný nový výnos se nepřipočítá, dokud uživatel simulaci znovu nespustí

**Příklad 4b: Simulace se automaticky zastaví po zpracování celého backlogu**
- Given: Cash Flow simulace běží, backlog i In Progress se právě vyprázdnily (poslední feature přešla do Done)
- When: engine detekuje `state.finished`
- Then: simulace se okamžitě automaticky zapauzuje, tlačítko Run/Pause zobrazí "✓ Done" a je neaktivní; revenue, které Done features do té doby nasbíraly, zůstává zachováno a dál neroste, dokud uživatel neklikne „↺ Reset“ (popisky tlačítek změněny 2026-10-20, viz feat-021 Příklad 14)
- Note: toto platí bezpodmínečně, bez ohledu na to, jestli existuje předchozí běh k porovnání (`cashFlowPrevStats`) — obě simulace vždy doběhnou přirozeně do konce, žádné čekání ani prodlužování. Fér porovnání Total Revenue běhů různé délky se řeší jinak — retroaktivním dopočtem při zobrazení delta badge, viz Příklad 7

**Příklad 5: Výnosy jsou nezávislé na rychlosti simulace**
- Given: dvě identické Cash Flow simulace se stejným seedem, jedna běží 1×, druhá 10×
- When: obě simulace doběhnou na stejný simulační čas (např. simTime = 30s)
- Then: obě simulace mají identický Total Revenue — rychlost ovlivňuje jen to, jak rychle simulace tohoto simTime dosáhne v reálném čase, ne kumulovaný výnos

**Příklad 6: Porovnání s předchozím dokončeným během (stejný mechanismus jako Advanced mód)**
- Given: uživatel nechal doběhnout první běh s Total Time 00:45.0, Avg Cycle Time 8.2s, Avg WIP 3.1 a Total Revenue €3.2k
- When: uživatel klikne "Generate new backlog" (nebo Reset)
- Then: hodnoty doběhlého běhu se zachytí jako `cashFlowPrevStats` (přesně stejný `lastFinishedRef`/`prevStats` vzorec jako Advanced mód), včetně minimálních per-feature dat potřebných pro zpětný dopočet revenue (viz Příklad 7), a nový běh začíná s prázdnou historií
- When: druhý běh doběhne přirozeně do konce (`state.finished`, celý backlog zpracovaný)
- Then: všechny 4 dlaždice (Total Time, Avg Cycle Time, Avg WIP, Total Revenue) zobrazí delta badge (`↓/↑ X % vs prev run`) — u Total Time/Avg Cycle Time/Avg WIP jde o přímé porovnání finálních hodnot obou běhů, u Total Revenue jde o time-matched porovnání (Příklad 7), ne o přímé porovnání finálních totalů. Barevná sémantika: u Total Revenue nárůst = zelená, u ostatních 3 dlaždic pokles = zelená (konvence "níž = lepší"), stejně jako v Advanced módu
- Note: velké číslo na Total Revenue dlaždici je vždy skutečný finální výnos tohoto běhu — time-matched dopočet se použije jen pro samotnou deltu, ne pro zobrazenou hodnotu

**Příklad 7: Time-matched porovnání Total Revenue (fér porovnání i při různě dlouhých bězích)**
- Given: existuje předchozí dokončený běh s Total Time = 50 s a Total Revenue = €300 (`cashFlowPrevStats`, uloženo včetně per-feature `finishedAt`/`revenuePerTick` každé Done featury)
- Given: obě simulace vždy doběhnou přirozeně až do konce (celý backlog zpracovaný) — žádné čekání, capování ani prodlužování; auto-pauza je vždy okamžitá (Příklad 4b)

*Aktuální běh trvá DÉLE než předchozí:*
- When: nový běh doběhne přirozeně do konce v čase 60 s, s reálným Total Revenue €315
- Then: dlaždice Total Revenue zobrazí velké číslo €315 (skutečný finální výnos, nezkreslený)
- Then: delta badge ALE porovnává hodnoty ve stejném, DŘÍVĚJŠÍM čase = 50 s (kratší ze dvou celkových časů): revenue předchozího běhu v 50 s (€300, jeho vlastní finální hodnota) vs. revenue AKTUÁLNÍHO běhu dopočítané zpětně přesně k 50. sekundě (ne k jeho finálním 60 s) — dopočet vychází z toho, kdy jednotlivé featury aktuálního běhu skutečně skončily (`finishedAt`) a kolik vydělávají za tick, ne z live sledování během běhu
- Then: pod deltou se zobrazí hint `@ 00:50.0`, aby bylo jasně vidět, k jakému času se srovnání vztahuje — ne k finálním 60 s

*Aktuální běh skončí DŘÍV než předchozí:*
- When: nový běh doběhne přirozeně do konce v čase 30 s (rychlejší/lepší tým)
- Then: dlaždice Total Revenue zobrazí skutečný finální výnos aktuálního běhu (k jeho vlastním 30 s)
- Then: delta badge porovnává obě strany ve stejném, DŘÍVĚJŠÍM čase = 30 s (tentokrát je to čas aktuálního běhu): revenue aktuálního běhu v 30 s (jeho finální hodnota) vs. revenue PŘEDCHOZÍHO běhu dopočítané zpětně k 30. sekundě (i když předchozí běh sám doběhl až v 50 s) — použije se uložená per-feature data předchozího běhu
- Then: hint pod deltou zobrazí `@ 00:30.0`

- Note: obecné pravidlo je symetrické: `T_compare = min(totalTime aktuálního běhu, totalTime předchozího běhu)`. Strana, jejíž vlastní celkový čas je DELŠÍ než `T_compare`, se dopočítává zpětně z uložených per-feature dat (`finishedAt` + `revenuePerTick` každé Done featury) — nikdy se nic za běhu nezastavuje ani neprodlužuje, dopočet probíhá až při zobrazení delty.
- Note: pokud je `T_compare` tak brzy, že ani jedna strana ještě neměla žádný revenue tick (velmi rychlý tým), delta badge (a hint) se nezobrazí vůbec — jde o degenerovaný okrajový případ, ne o chybu.

**Příklad 8: In Progress — aktivní karty jsou zvýrazněné a nahoře**
- Given: In Progress obsahuje F-801 (priorita 1, čeká), F-850 (priorita 50, čeká), F-799 (priorita 3, Team A pracuje na jejím tasku), F-812 (priorita 12, Team B pracuje na jejím tasku)
- When: panel se vykreslí
- Then: pořadí je F-799, F-812, F-801, F-850; F-799 a F-812 mají zvýrazněný rámeček, ostatní ne
- Given: před spuštěním simulace nebo po jejím konci (žádný task `doing`)
- Then: žádná karta není zvýrazněná a pořadí je podle priority
- Then: pořadí `state.inProgress` zůstává ve všech případech beze změny (řazení jen v zobrazení)

## Out of Scope
- Sdílení konfigurace s Advanced (společný backlog/tým) — Cash Flow má vlastní nezávislou konfiguraci, jen sdílí UI komponenty a logiku (viz Technical Notes)
- Konverze měn ani nastavitelná měna — pevně €
- Historie/graf výnosů v čase (jen aktuální kumulativní číslo + poslední tick)
- Náklady/cost — jen revenue, ne P&L (zisk/ztráta) — bude řešeno později
- Features bez přiřazeného revenue nemohou existovat — každá vygenerovaná feature musí mít revenuePerTick > 0

## Technical Notes

### Types (`src/types/simulation.ts`)
- `Feature`: nová pole `revenuePerTick: number`, `totalRevenue: number` (kumulativní, default 0), `lastTickRevenue: number | null` (pro pulse indikátor, null = žádný nedávný tick), `lastRevenueTickAt: number` (simulační čas posledního revenue ticku TÉTO featury — nastaví se na `finishedAt` při dokončení, pak se posouvá o `REVENUE_TICK_INTERVAL_SEC` s každým dalším tickem; slouží i k výpočtu progress baru)
- `SimState`: `totalRevenueAllTime: number` (pro metriku Total Revenue); `doneOverflow: { finishedAt: number; revenuePerTick: number; lastRevenueTickAt: number }[]` (fix code review nálezu — lehký záznam pro features vytěsněné z `done` displaye, viz Engine sekce níže)
- Nová konstanta `REVENUE_TICK_INTERVAL_SEC = 3`

### Engine (`src/simulation/engine.ts`)
- `makeFeature()`: při seedování backlogu vygenerovat `revenuePerTick` Gaussovým vzorkováním (Box-Muller transform), hodnoty pro celý seed batch seřadit sestupně a přiřadit podle priority (feature #1 = nejvyšší) — batch se generuje AŽ PO vytvoření všech features v seedu, aby nedošlo k posunu RNG sekvence task/role generování
- `tick()`, blok dokončování features: při přechodu do `done` nastavit `f.lastRevenueTickAt = state.simTime` — vlastní hodiny featury začínají běžet přesně v okamžiku dokončení
- `tick()`, revenue-accrual blok (po detekci dokončení): pro KAŽDOU featuru v `state.done` nezávisle `while (state.simTime - f.lastRevenueTickAt >= REVENUE_TICK_INTERVAL_SEC)` připočítat `revenuePerTick` k `totalRevenue`, nastavit `lastTickRevenue`, posunout `lastRevenueTickAt` o interval, připočítat k `state.totalRevenueAllTime`
  - Žádný globální accumulator — každá feature tiká podle svého vlastního `lastRevenueTickAt`, ne podle společného cyklu (revize původního návrhu; viz Příklad 1)
  - Accrual se děje jen když je `tick()` volána, což se přirozeně děje jen za běhu simulace (RAF smyčka se při pauze nevolá) → Příklad 4 je tímto pokryt bez dalšího kódu
  - Speed-invariance (Příklad 5) plyne z toho, že `speed` multiplier mění jen počet volání `tick()` za reálnou sekundu, ne `dtSim` v jednom volání — mechanismus je řízen simulačním časem (`state.simTime`), ne wall-clock
- **Nová exportovaná čistá funkce `computeRevenueAsOf(features, simTime)`** (feat-015 rozšíření, Příklad 7): spočítá, kolik revenue by dané featury vydělaly do zadaného `simTime`, aniž by bylo nutné simulaci k tomuto času skutečně dotáhnout — matematicky ekvivalentní iterativní `while` smyčce výše, spuštěné od `finishedAt` do `simTime` (`Math.floor((simTime - finishedAt) / REVENUE_TICK_INTERVAL_SEC) * revenuePerTick`, 0 pokud featura ještě není Done nebo `finishedAt > simTime`). Parametr `features` přijímá `Pick<Feature, 'finishedAt' | 'revenuePerTick'>[]`, takže funkci lze volat jak s živým `state.done`, tak s uloženým zjednodušeným snapshotem předchozího běhu (viz UI sekce níže). Na rozdíl od `tick()` je čistá — nic nemutuje, `tick()` samotná se nijak neupravuje (žádný nový parametr, žádný cutoff). Používá se výhradně pro time-matched porovnání běhů (Příklad 7), ne pro živý přírůstek revenue.
- **`doneOverflow` (fix code review nálezu, engine.ts)**: `state.done` je capované na 40 zobrazených položek — starší se z něj vytěsňují, ale NEmizí beze stopy. Vytěsněná feature se přesune do `state.doneOverflow: { finishedAt, revenuePerTick, lastRevenueTickAt }[]` (lehký záznam, ne celý Feature objekt), kde stejná while-smyčka jako pro `state.done` pokračuje v jejím tikání do `state.totalRevenueAllTime` navěky — revenue accrual tedy nikdy neskončí jen proto, že featura zmizí z displaye. `computeRevenueAsOf` i zachytávání `CashFlowRunSnapshot.doneFeatures` čtou obě pole (`state.done` + `state.doneOverflow`) společně, takže i time-matched delta (Příklad 7) zůstává přesná bez ohledu na velikost backlogu.

### UI (`src/components/`, `src/hooks/`)
- `Simulator.tsx`: `AppMode` rozšířit o `'cashflow'`, nový tab "💰 Cash Flow" za Advanced tab
- `Simulator.tsx`: `CASHFLOW_SETTINGS` přebírá `initialBacklog: 100` z `DEFAULT_SETTINGS` (revize 2026-10-13, dříve přepsáno na 20). Pojmenovaná konstanta `CASHFLOW_SETTINGS = { ...DEFAULT_SETTINGS }` zůstává jako místo pro případné budoucí výchozí hodnoty specifické pro Cash Flow; přepis `initialBacklog: 20` a komentář, který ho zdůvodňuje, se odstraní.
- Test: `tests/unit/simulation/feat-015-cash-flow-default-backlog.test.tsx` renderuje `Simulator` a ověřuje, co vidí uživatel: po přepnutí do Cash Flow ukazuje panel Backlog 100 featur, slider „Backlog size“ ukazuje „100 items“ a „Generate new backlog“ znovu vygeneruje 100 featur. `CASHFLOW_SETTINGS` se kvůli testu neexportuje.
- Integrační testy feat-017 a feat-018 (`feat-01[78]-simulator-integration.test.tsx`) si v pomocné funkci `openCashFlowSettings()` nastaví backlog na 20 featur. Se 100 featurami by jeden běh do konce trval v testu zhruba 3 s místo 0,4 s a testy se dvěma běhy by nestihly výchozí 5s limit Vitestu. Tyto testy ověřují dlaždici výnosu a přepínač křivky, ne velikost backlogu.
- **`src/hooks/useCashFlowSimSetup.ts`** — hook zrcadlící veškerou Advanced-módovou stavovou logiku (settings, roleConfig, aktivní preset, confirm-preset dialog, show/hide toggly, XLS import, RAF-safe refs, forceUpdate) a handlery (`handleAssignRole`, `handleRemoveRole`, `handleXlsImport`, `handleRegenerate`, `handlePresetClick`, `handleConfirmPreset`, `handleRenameMember`, `handleRemoveMember`, `handleAddMember`, `handleRoleChange`, `handleAddRole`, `handleDeleteRole`) jako **zcela nezávislou instanci** — Cash Flow volá `useCashFlowSimSetup(CASHFLOW_SETTINGS)` jednou v `Simulator.tsx`, čímž dostane vlastní `SimState`/`rngRef`/tým/backlog oddělený od Advanced. Preset (`activePresetId`) se u Cash Flow drží jen v paměti (výchozí `'teams'`), nepersistuje se do sdíleného `localStorage` klíče jako u Advanced.
- **`src/components/BacklogSettingsPanel.tsx`** (levý sloupec, sdílený Advanced + Cash Flow) — Backlog list + Settings sekce (preset tlačítka, confirm dialog, XLS import, "Generate new backlog", slidery velikosti/variability backlogu, `RoleSettings` editor specializací, `SegmentedControl` pro WipMode). Volitelný prop `getRevenueBadge?: (feature: Feature) => string` — použije jen Cash Flow (`€400/tick` badge na kartách backlogu); Advanced ho nepředává, takže badge se tam nezobrazí. `tutorialTargetPrefix` prop odlišuje `data-tutorial-target` atributy mezi módy (`experiment` vs. `cashflow`).
- **`src/components/InProgressTeamPanel.tsx`** (střední sloupec, sdílený Advanced + Cash Flow) — In Progress karty (bez revenue badge, viz UI/Design) + Units grid s `MemberCard` (add/remove role, rename, remove, add member/team/unit dle presetu). Stejný `tutorialTargetPrefix` mechanismus. Zvýraznění/řazení aktivních features: čistá funkce `src/lib/inProgressOrder.ts` (aktivita + stabilní řazení) a volitelný prop `active?: boolean` na `FeatureCard` (výchozí `false`, ostatní použití beze změny).
- **`src/components/CashFlowPanel.tsx`** (pravý sloupec, jen Cash Flow) — Metriky (4 `StatTile`: Total Time, Avg Cycle Time, Avg WIP, Total Revenue, každá s `delta` propem) + Done list s `totalRevenue`, pulse `lastTickRevenue` (React key = `f.lastRevenueTickAt`, restartuje se nezávisle pro každou featuru) a progress barem odpočtu (`(state.simTime - f.lastRevenueTickAt) / REVENUE_TICK_INTERVAL_SEC`). Čistě prezentační — stav/statistiky počítá a předává `Simulator.tsx`.
- `StatTile.tsx`: nový prop `higherIsBetter?: boolean` (default `false`) — obrací barevnou sémantiku delta badge (kladná delta = zelená místo červené); použit jen na Total Revenue dlaždici, kde vyšší výnos je zlepšení (na rozdíl od Cycle Time/WIP/Time, kde je to naopak).
- Pomocná funkce pro formátování měny (`src/lib/formatCurrency.ts`): `€400`, `€1.4k` (k-notace)
- **Porovnání běhů** (`Simulator.tsx`) — stejný `lastFinishedRef`/`prevStats`/`calcDelta` vzorec jako Advanced mód: při kliknutí na Reset nebo "Generate new backlog" se hodnoty doběhlého běhu promotují z `cashFlowLastFinishedRef` do `cashFlowPrevStats` state. `CashFlowRunSnapshot` (typ pro obě proměnné) je rozšířený o `doneFeatures: Pick<Feature, 'finishedAt' | 'revenuePerTick'>[]` — zjednodušená projekce `state.done` zachycená v okamžiku, kdy běh přirozeně skončí (`state.finished`), potřebná pro zpětný dopočet revenue v Příkladu 7.
  - `cfTimeDelta`/`cfLtDelta`/`cfWipDelta` beze změny — přímé porovnání finálních hodnot (`calcDelta(current, previous)`), žádná time-matched logika, protože tyto 3 metriky nemají "kumulativní" bias problém, který má revenue.
  - `cfRevenueDelta` (feat-015 refinement): počítá se jen když `cashFlowPrevStats` existuje a aktuální běh `state.finished`. `compareTime = Math.min(cfState.simTime, cashFlowPrevStats.totalTime)`. `cfRevenueDelta = calcDelta(computeRevenueAsOf(cfState.done, compareTime), computeRevenueAsOf(cashFlowPrevStats.doneFeatures, compareTime))`. Zároveň se odvodí `cfRevenueDeltaHint = `@ ${formatTime(compareTime)}`` (jen když `cfRevenueDelta !== undefined`) — zobrazí se jako `hint` pod Total Revenue dlaždicí (`StatTile.tsx` má `hint` prop už implementovaný, jen se nově začíná používat).
  - Velké číslo na Total Revenue dlaždici zůstává vždy `formatEuro(cfState.totalRevenueAllTime)` — skutečný finální total, nedotčený time-matched logikou.
- **Auto-pause po dokončení backlogu** (`Simulator.tsx`, RAF smyčka) — bezpodmínečná a okamžitá ve všech případech, beze změny oproti Advanced módu: jakmile `tick()` nastaví `state.finished = true`, smyčka zavolá `setCashFlowPaused(true)` a přestane volat `tick()`. Žádné čekání na referenční běh, žádné prodlužování.

### Testy
- `tests/unit/simulation/feat-015-cash-flow-mod.test.ts` (umístění sjednoceno s ostatními `engine.ts` testy v `tests/unit/simulation/`):
  - test Gaussova vzorkování (rozsah hodnot, sestupné řazení podle priority)
  - test revenue accrual při dosažení 3s intervalu
  - **test nezávislosti tiků**: dvě features dokončené v různých simTime tikají každá podle svého vlastního `lastRevenueTickAt`, ne najednou
  - **test speed-invariance**: zavolat `tick()` se stejným celkovým simTime (např. 3s) ale různým krokováním (např. 180× dtSim=1/60s vs. 18× dtSim=1/6s) a ověřit identický `totalRevenue` bez ohledu na krokování
  - test že se výnos nepřipočítává, když `tick()` není volána (simulace pauznutá)
  - **`computeRevenueAsOf` — nová funkce (feat-015 refinement, Příklad 7):**
    - jedna feature, více celých ticků uplynulo → součet odpovídá počtu celých ticků × revenuePerTick
    - boundary/floor chování: `simTime` těsně před hranicí dalšího ticku → tick se ještě nepočítá (floor, ne round)
    - více features s různým `finishedAt`/`revenuePerTick` → součet je nezávislý na pořadí v poli
    - feature s `finishedAt: null` (ještě nedokončená) → přispívá 0
    - `simTime` dřív než `finishedAt` featury (přesně scénář "předchozí běh dopočítaný zpětně dřív, než sám přirozeně skončil") → přispívá 0
    - prázdné pole → 0
    - **ekvivalence s živou `tick()` smyčkou**: po odtikání state na `simTime` T musí `computeRevenueAsOf(state.done, T)` odpovídat `state.totalRevenueAllTime` a per-feature `computeRevenueAsOf([f], T) === f.totalRevenue`
    - **retroaktivní ekvivalence**: `computeRevenueAsOf(state.done, T)` pro dřívější `T` musí odpovídat tomu, co `state.totalRevenueAllTime` bylo v okamžiku, kdy simulace poprvé dosáhla `simTime = T` (zachyceno mid-run, pak porovnáno se zpětným dopočtem po dalším tikání)
- `tests/e2e/feat-015-cash-flow-mod.spec.ts` — Playwright test ověřující UI flow (tab, revenue badge, Start tlačítko) proti plné Advanced-parity DOM struktuře (Settings panel, Units grid)
- Porovnání běhů (`cashFlowPrevStats`/`calcDelta`/`cfRevenueDelta`/`cfRevenueDeltaHint`) nemá dedikované unit testy — jde o komponentovou/UI logiku v `Simulator.tsx`, stejně jako existující `prevStats`/`calcDelta` mechanismus v Advanced módu, který také není unit testovaný (drží se stávající konvence projektu). Ověřeno manuálně v prohlížeči. Jedinou testovatelnou logikou je čistá funkce `computeRevenueAsOf`, pokrytá výše.

### Závislosti / Related Features
- **feat-009-dva-mody-ui**: Cash Flow rozšiřuje `AppMode` pattern zavedený touto feature o třetí hodnotu. Nad rámec původní feature-009 nyní Cash Flow sdílí s Advanced i konkrétní Settings/Team UI (`BacklogSettingsPanel`, `InProgressTeamPanel`) přes samostatnou stavovou instanci (`useCashFlowSimSetup`) — Advanced mód samotný zůstal funkčně beze změny, jen jeho JSX bylo přesunuto do sdílených komponent.
- **feat-010-cycle-time**: Cash Flow používá stejný Cycle Time výpočet (`finishedAt − startedAt`) pro dlaždici Avg Cycle Time — jen závislost, feat-010 se nemění.
- **feat-007-pocet-predani**: Beze změny — Avg Handoffs zůstává v Compare/Advanced. Cash Flow panel handoffs nezobrazuje, ale nejde o konflikt, jen o odlišný metrik-set ve třetím módu.
- **feat-016-coordination-overhead**: Rozšiřuje Cash Flow o volitelný přepínač „Coordination overhead“ (výchozí Off, Team settings pod WIP módem) a při On o pátou dlaždici v panelu metrik (celkové % Lead Time + rozpad handoff/rework) a čipy předání/reworku na kartách In Progress a Done. Při Off se Cash Flow chová přesně podle této specifikace. Při On zahrnuje Avg Cycle Time a Total Time koordinační zpoždění a výnosy tikají později.

- **feat-017-rozlozeni-vynosu-v-case**: Rozšiřuje revenue accrual o volitelný profil výnosu (Flat / J‑curve / S‑curve, přepínač v Settings u backlogu). Při Flat (výchozí) se Cash Flow chová přesně podle této specifikace. Při J‑curve a S‑curve tik č. *k* od dokončení vydělá `revenuePerTick × m(profil, k)` místo konstanty, takže příklady 1 a 5 (konstantní výnos za tik) platí pro Flat. `computeRevenueAsOf` dostává volitelný `revenueProfile` (chybějící = Flat, stávající volání a testy se nemění) a `doneOverflow` i `CashFlowRunSnapshot.doneFeatures` nesou profil a čítač ticků. Time‑matched porovnání (příklad 7) funguje i mezi různými profily. Out of Scope „Historie/graf výnosů v čase“ zůstává: mini‑graf z feat-017 ukazuje tvar modelu, ne historii běhu.

## Open Questions
—

## Related Features
- **feat-021-prevod-design-system-org-flow:** tab „💰 Cash Flow“ ztrácí emoji („Cash Flow“); barva výnosu (`--done`) zůstává.
- **feat-024-zpetna-vazba-uzivatelu (rozpracováno):** ikona zpětné vazby je v horní liště i v Cash Flow; otevření dialogu pozastaví Cash Flow simulaci stejně jako „❙❙ Pause“. Cash Flow tutoriál nemá, takže krok o zpětné vazbě se ho netýká.
- **feat-025-revize-tutorialu (draft):** Cash Flow dostane vlastní prohlídku (8 kroků: výnos featur, křivka výnosu, Done, Revenue (time-matched), coordination overhead, ovládání, Run) a tlačítko „?“ v ovládání. Prohlídka se spustí při první návštěvě Cash Flow.
