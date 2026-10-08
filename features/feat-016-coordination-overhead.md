# Feature: Coordination Overhead

## Status
approved

## Problem
Koučové chtějí ukázat, jak různé mandáty lidí a týmů ovlivňují koordinaci. Dnes engine předání mezi jednotkami jen zpětně spočítá (`avgHandoffs`), ale nijak neovlivňují běh simulace — koordinace nic nestojí, a proto nelze ukázat, že úzce specializované (silo) týmy platí za předávání práce časem, opravami chyb a zpožděnými výnosy.

## User Story
Jako agilní kouč chci kvantifikovat koordinační náklady a ukázat vliv různých mandátů na tyto náklady, abych mohl pomoct managementu pochopit, že multiskill má finanční výhody.

## UI / Design
- **Rozsah:** jen Cash Flow mód. Advanced a Compare se nemění a nemají přepínač.
- **Přepínač "Coordination overhead" (Off / On):** v levém sloupci v Settings → Team settings, hned pod přepínačem WIP módu. Výchozí **Off** — při Off se Cash Flow chová stejně jako dnes (a stejně jako Advanced se stejnou konfigurací). Změna přepínače po zahájení běhu vyžaduje Reset (přepínač je neaktivní s hintem „změna platí až po Resetu“).
- **Dlaždice "Coordination overhead"** v panelu metrik Cash Flow (jen při On): velké číslo = celkový podíl koordinace na Lead Time v %, pod ním řádky s rozpadem „handoff X % · rework Y %“. Má delta badge vs. předchozí běh stejně jako ostatní dlaždice.
- **Karta featury (In Progress i Done, ne Backlog):** čipy `⇄ n` (počet předání) a `↺ n` (počet reworků, výraznější barva). Při vzniku události čip krátce (1–2 s) zapulsuje. Čipy jsou vidět jen při On.
- Značení na úrovni jednotlivých tasků není součástí této feature.

### Schválený UI návrh (fáze 3, mockup `docs/feat-016-ui-mockup.html`)
- **Přepínač:** stávající `SegmentedControl` (Off / On) s vlastním popiskem „Coordination overhead“ nad ním. Hover hint: „Handoffs between units add 25 % extra work; 20 % chance of rework.“ Po startu běhu zamčený (opacity 0.5, `cursor: not-allowed`) a pod ním text „🔒 Takes effect after Reset“ (UI je anglicky). `SegmentedControl` dostane nový volitelný prop `disabled`.
- **Čipy:** v hlavičce `FeatureCard` vlevo od počtu tasků („4t“). `⇄ n` je neutrální (`--ink-2`, šedý rámeček), `↺ n` v teplé červené (`oklch(50% 0.17 30)` na `oklch(95% 0.04 30)`). Čip se zobrazí až od n ≥ 1. Při zvýšení počtu 1,4 s pulse (zvětšení + rozplývající se prstenec, restart přes `key={count}`). Při reworku navíc krátce problikne segment vráceného tasku.
- **Done list:** řádky v Cash Flow nejsou `FeatureCard`, ale vlastní markup v `CashFlowPanel.tsx` → čipy se přidají tam, do řádku s €/tick. Bez pulse.
- **Dlaždice:** stávající `StatTile` pod Total Revenue. Hodnota „18 % of cycle time“, tenký dělený pruh handoff/rework (barvy shodné s čipy), legenda „handoff X % · rework Y %“, delta badge (nižší = lepší, výchozí sémantika).

### Pravidla modelu (pevné konstanty, bez sliderů)
- **Předání:** jednotka se přiřadí k tasku featury, na které dosud nepracovala, a jiná jednotka už na téže featuře **dokončila** aspoň jeden task (platí i uvnitř jedné fáze). Souběžný start více jednotek na featuře (swarming bez hotové práce) předání není. Jednotka, která na featuře už někdy pracovala (i když její task byl reworkem vrácen), předání znovu nevyvolá. *(Upřesněno po prototypu: s původní definicí „kdokoli další na featuře“ vycházel multiskill tým v Reduce WIP s 31 % overheadu oproti 9 % u sila, protože se jednotky sbíhají na jednu featuru.)*
- **Handoff tax:** přebíraný task dostane navíc 25 % svého `work` (práce navíc na straně přebírajícího).
- **Rework:** při každém předání se hodí `rng`; při hodnotě < 0.2 se náhodně (druhým voláním `rng`) vybere jeden již hotový task téže featury, který dělala jiná jednotka než přebírající. Task ztratí 50 % svého `work` z progresu, vrátí se do `todo` bez assignee (kdokoli s danou rolí ho vezme podle běžných pravidel). Díky definici předání takový task vždy existuje. Vrácený task může vyvolat další předání a řetězit rework (omezeno pravděpodobností).
- Ztracená práce se počítá do `reworkSec`, tax do `handoffSec`.
- **Reset tasku za běhu** (kouč odebere jednotce roli nebo jednotku smaže): task se vrátí do `todo` s nulovým progresem a vrátí se mu i přirážka z taxu (`work` i `handoffSec`), aby se tax při dalším převzetí nenásobil. `handoffCount` zůstává (předání proběhlo). Zahozený progres se do overheadu nepočítá — nejde o koordinaci, ale o ruční zásah do týmu. *(Doplněno po review.)*

## Specification by Example

**Příklad 1: Přepínač Off = beze změny**
- Given: Cash Flow, přepínač Off, daný seed
- When: běh doběhne
- Then: časy jsou shodné s Advanced při stejné konfiguraci a seedu; dlaždice ani čipy nejsou vidět

**Příklad 2: Handoff tax**
- Given: přepínač On, FE task featury F dokončila jednotka A, BE task má `work = 1.5`
- When: nová jednotka B (která na F dosud nepracovala) se přiřadí k BE tasku
- Then: `work` BE tasku je 1.875 (+25 %), `handoffSec` featury roste o 0.375, `handoffCount` je 1

**Příklad 3: Žádné předání, žádný overhead**
- Given: přepínač On, jedna jednotka s rolemi FE i BE zpracuje oba tasky featury
- When: feature doběhne
- Then: `work` beze změny, `handoffSec = 0`, `reworkSec = 0`, oba počty jsou 0

**Příklad 4: Rework**
- Given: přepínač On, feature má hotový task od jiné jednotky (`work = 1.0`), `rng` vrátí hodnotu < 0.2
- When: nová jednotka se přiřadí k dalšímu tasku featury (předání)
- Then: hotový task se vrátí do `todo` s `progress = 0.5`, `reworkSec` roste o 0.5, `reworkCount` je 1; při `rng ≥ 0.2` se nic nevrací

**Příklad 5: Souběžný start není předání** *(nahrazuje původní „Rework bez hotové práce“, který s upřesněnou definicí předání nemůže nastat)*
- Given: přepínač On, FE i BE jsou ve stejné fázi, jednotka A (FE) a jednotka B (BE) začnou na featuře ve stejném ticku
- When: obě jednotky pracují
- Then: `handoffCount = 0`, `work` beze změny; stejně tak jednotka, která se na featuru vrací (už na ní pracovala), předání nevyvolá

**Příklad 6: Dlaždice s rozpadem**
- Given: přepínač On, alespoň jedna dokončená feature
- When: panel metrik se přepočítá
- Then: dlaždice „Coordination overhead“ ukáže celkové % Lead Time a pod ním „handoff X % · rework Y %“; celkové % = Σ(`handoffSec` + `reworkSec`) / Σ cycle time

**Příklad 7: Dopad na výnos**
- Given: stejný seed a konfigurace, běh s přepínačem Off a pak On
- When: oba běhy doběhnou
- Then: u On je delší Cycle Time a nižší výnos **ve stejném čase** (porovnání k času kratšího běhu přes `computeRevenueAsOf`, stejně jako delta badge z feat-015). Konečné Total Revenue se nesrovnává — delší běh s On tiká déle, a proto na konci vychází vyšší.

**Příklad 8: Změna přepínače vyžaduje Reset**
- Given: běh už začal
- When: uživatel zkusí přepnout Coordination overhead
- Then: přepínač je neaktivní s hintem „změna platí až po Resetu“

**Příklad 9: Silo vs. multiskill**
- Given: přepínač On, WIP mód Reduce WIP, stejný backlog a seed; tým A silo (jedna role na jednotku), tým B multiskill (jednotky se všemi rolemi)
- When: oba běhy doběhnou
- Then: silo má vyšší Coordination overhead a nižší výnos ve stejném čase; multiskill je blízko 0 % (prototyp: ~1 % vs. ~7 %)

**Příklad 10: Čipy a pulse na kartě**
- Given: přepínač On, feature v In Progress
- When: nová jednotka se přiřadí k tasku featury, na které dosud nepracovala (předání), resp. nastane rework
- Then: na kartě se objeví nebo zvýší čip `⇄ n`, resp. `↺ n`, a na 1–2 s zapulsuje; čipy zůstávají i v Done listu, v Backlogu nejsou

## Out of Scope
- Delivery manager a kapacita koordinátorů (vynecháno úplně, ani jako parametr)
- Nastavitelné slidery pro procenta (tax, pravděpodobnost, ztráta progresu) — konstanty jsou pevné
- P&L a náklady v €, jen vliv na čas a zpožděné výnosy
- Advanced a Compare mód — koordinace se projeví jen v Cash Flow
- Úprava `avgHandoffs` a `computeHandoffs` z feat-007 (zůstávají beze změny; nová definice předání je širší)
- Značení na úrovni jednotlivých tasků (jen čipy a pulse na kartě featury)
- Nový režim přiřazování „Min units“ (jednotka zůstává na své featuře a vyhýbá se featurám, na kterých pracují jiní) — samostatná feature, nejspíš rozšíření feat-008 (`focusMode: 'continuity'`). Mění chování Advanced i Cash Flow.

## Technical Notes
- **Engine (`src/simulation/engine.ts`):** živá detekce předání v `tick()` při přiřazení jednotky k tasku. Tax `task.work × 25 %`, rework přes seedovaný `rng` (20 %, ztráta 50 % `work`, vrácený task do `todo`). Efekt se aplikuje jen při zapnutém `coordinationOverhead`. Engine zůstává bez React závislostí. Konstanty pojmenované (`HANDOFF_TAX_PCT`, `REWORK_PROBABILITY`, `REWORK_PROGRESS_LOSS_PCT`).
- **Typy (`src/types/simulation.ts`):** `SimSettings.coordinationOverhead?: boolean` (volitelné, chybějící = Off); na `Feature` pole `handoffCount`, `reworkCount`, `handoffSec`, `reworkSec` (inicializace 0 v `makeFeature` i `cloneFeatureFresh`) a interní historie jednotek, které na featuře pracovaly (kvůli vracejícím se jednotkám po reworku); `LeadTimeEntry.handoffSec?` / `reworkSec?` (volitelné kvůli zpětné kompatibilitě); `SimStats.handoffPct`, `reworkPct`, `coordinationPct` (procenta 0–100).
- **RNG:** při Off se `rng` v nové logice nesmí volat (parita s Advanced). Při On: 1. volání = hod na rework, 2. volání (jen při reworku) = výběr tasku `floor(rng() × počet kandidátů)`.
- **UI:** přepínač Off/On v Team settings pod WIP módem přes volitelné props v `BacklogSettingsPanel.tsx` (stejný vzor jako `getRevenueBadge?`, předává jen Cash Flow); dlaždice s rozpadem v `CashFlowPanel.tsx`; čipy a pulse v `FeatureCard.tsx` přes volitelné props, čipy v Done listu v `CashFlowPanel.tsx`; prop `disabled` v `SegmentedControl.tsx`. Stav přepínače v `useCashFlowSimSetup.ts`; změna vyžaduje Reset.
- **Rozdíl oproti feat-007:** nová definice předání je širší (počítá i předání uvnitř jedné fáze), proto je to samostatná logika; `computeHandoffs` a `avgHandoffs` se nemění.
- **Testy:** `tests/unit/simulation/feat-016-coordination-overhead.test.ts` se seedovaným `rng` — parita při Off, tax, rework (nastane / nenastane / není co vracet), souhrnná procenta.
- **Závislosti:** feat-015 (Cash Flow, metriky, Total Revenue), feat-007 (předání), feat-009 (módy).

## Open Questions
- Doladit výchozí hodnoty procent (25 % / 20 % / 50 %) po vyzkoušení v prohlížeči.
- ~~Řetězení reworku~~ → ano, omezeno pravděpodobností. ~~Tax jako práce navíc, nebo čekání?~~ → práce navíc.
- V režimu Priority (WIP) vychází multiskill v prototypu s vyšším overheadem než silo (7,4 % vs. 4,9 %). Pro workshop doporučit Reduce WIP; případně řešit v rámci „Min units“.
