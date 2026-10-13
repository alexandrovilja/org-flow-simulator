# Feature: Time-matched revenue

## Status
in-progress

## Problem
V Cash Flow módu ukazuje velká dlaždice Total Revenue kumulativní součet na konci vlastního běhu. Rychlejší tým, jehož běh skončí dřív, tak má na dlaždici **nižší** číslo než pomalejší tým (běh přestane sbírat tiky, jakmile je hotový backlog). Příklad (seed 42, 20 featur, Flat): všichni umí všechno 9 549 € (běh 16,5 s) vs. specializované týmy 15 692 € (běh 24,6 s), přestože první tým dodává featury dřív a ve společném čase 16,5 s vydělá o 31,6 % víc. Delta badge (feat-015, Příklad 7) správně ukazuje +31,6 %, ale velké číslo vedle ní jí vizuálně odporuje. Kouč na workshopu ukazuje, že lepší struktura týmu zvedá výnos, a dlaždice tvrdí opak.

Zvažovali jsme průměrný výnos za vteřinu, ale zavrhli jsme ho: ve stejném horizontu dává stejný poměr jako kumulativní výnos, takže delta se nezmění, a absolutní číslo v €/s závisí na délce horizontu (výnos roste zhruba s druhou mocninou času, kratší horizont má větší podíl rozjezdu), takže se nedá porovnávat mezi různými páry běhů. Správné je porovnávat **kumulativní výnos ve společném čase** — a právě ten ukázat jako velké číslo.

## User Story
*Jako agilní kouč, který na workshopu porovnává dva běhy Cash Flow simulace, chci vidět výnos obou běhů ve stejném časovém horizontu, abych neukazoval vedení, že pomalejší tým vydělává víc jen proto, že jeho běh trval déle.*

## UI / Design
Změna se týká jen dlaždice výnosu v pravém sloupci Metrics v Cash Flow módu (`CashFlowPanel`). Compare a Advanced mód výnos nemají a zůstávají beze změny. Všechny texty UI jsou anglicky.

- **Dlaždice „Total Revenue“ se přejmenuje na „Revenue (time-matched)“.** Zůstává jedna dlaždice, na stejném místě.
- **Hodnota dlaždice:**
  - během běhu, nebo když neexistuje předchozí doběhnutý běh: kumulativní výnos aktuálního běhu v € (živě roste, jako dnes), bez delta badge; za běhu (simTime > 0, ještě nedoběhl) s hintem „live total“, aby bylo jasné, že číslo se po doběhnutí přepočítá na společný čas;
  - po doběhnutí aktuálního běhu **a** existenci předchozího běhu: výnos v € ve společném čase `T_compare = min(Total Time aktuálního, Total Time předchozího)`, s delta badge (vyšší = lepší, zelená při nárůstu) a hintem `@ mm:ss.s` (jako dnes). Výnos strany, jejíž vlastní běh byl delší než `T_compare`, se dopočte zpětně přes `computeRevenueAsOf`.
- **Rozbalení detailu:** dlaždice je klikací (tlačítko s `aria-expanded`, přístupné z klávesnice, Enter/Space). Po rozbalení ukáže:
  - `Total €X in mm:ss.s` — celkový výnos aktuálního běhu za celý jeho čas;
  - jen po srovnání: `Previous run @ mm:ss.s: €Y` (předchozí běh ve společném čase) a `Previous total €Z in mm:ss.s` (jeho celkový výnos za jeho čas).
- Rozbalení se sbalí při Resetu (simulační čas se vrátí zpět, i uprostřed běhu); samotný start běhu detail nesbalí. Nic se nepersistuje.
- Delta badge ukazuje pod 10 % jedno desetinné místo (např. „↑ 0.4%“), od 10 % celé číslo (sdílené pravidlo `formatPercent`, stejné jako u Coordination overhead), aby malé rozdíly nevypadaly jako „0 %“. Změna zaokrouhlená na 0.0 % se zobrazí neutrálně (šedě) jako „→ 0.0%“, ne jako zlepšení či zhoršení (platí pro všechny dlaždice s deltou).
- Delta badge a hint zůstávají na dlaždici, procentuální hodnota se oproti feat-015 nemění.

## Specification by Example
Čísla jsou ze seedu 42, Flat: A = specializované týmy (Total Time 24,6 s, celkem €15 692), B = všichni umí všechno (Total Time 16,5 s, celkem €9 549).

**Příklad 1: Živý běh bez předchozího běhu**
- Given: Cash Flow běh, neexistuje předchozí doběhnutý běh; v simTime 10 s je kumulativní výnos €3 000
- When: dlaždice se vykreslí
- Then: dlaždice „Revenue (time-matched)“ ukazuje €3 000, bez delta badge, s hintem „live total“ (běh běží); po rozkliknutí ukáže „Total €3 000 in 00:10.0“; po doběhnutí bez předchozího běhu hint zmizí

**Příklad 2: Aktuální běh je kratší než předchozí**
- Given: předchozí běh A (Total Time 24,6 s), aktuální běh B doběhl za 16,5 s
- When: aktuální běh skončí
- Then: dlaždice ukazuje €9 549 (výnos B ve 16,5 s), delta badge +31,6 % a hint „@ 00:16.5“; po rozkliknutí „Total €9 549 in 00:16.5“, „Previous run @ 00:16.5: €7 259“ a „Previous total €15 692 in 00:24.6“

**Příklad 3: Aktuální běh je delší než předchozí**
- Given: předchozí běh B (Total Time 16,5 s, celkem €9 549), aktuální běh A doběhl za 24,6 s
- When: aktuální běh skončí
- Then: dlaždice ukazuje €7 259 (výnos A dopočtený k 16,5 s, **ne** jeho celkových €15 692), delta badge −24,0 % a hint „@ 00:16.5“; po rozkliknutí „Total €15 692 in 00:24.6“, „Previous run @ 00:16.5: €9 549“ a „Previous total €9 549 in 00:16.5“

**Příklad 4: Předchozí běh nevydělal nic ve společném čase**
- Given: výnos předchozího běhu v `T_compare` je €0 (např. `T_compare` nastane před jeho prvním revenue tikem)
- When: aktuální běh doběhne
- Then: dlaždice ukazuje výnos aktuálního běhu v `T_compare`, ale bez delta badge (dělení nulou) a bez hintu — stejné degenerované chování jako v feat-015, Příklad 7

**Příklad 5: Reset sbalí detail**
- Given: rozbalený detail dlaždice po doběhnutém běhu (nebo uprostřed běhu)
- When: uživatel klikne na Reset
- Then: nový běh začíná s dlaždicí ve sbaleném stavu, ukazuje živý kumulativní výnos aktuálního běhu a delta badge zmizí do doběhnutí
- Note: samotné spuštění běhu (Start) rozbalený detail nesbalí

**Příklad 6: Malý rozdíl je vidět**
- Given: výnos aktuálního běhu ve společném čase je o 0,4 % vyšší než u předchozího
- When: aktuální běh doběhne
- Then: delta badge ukazuje „↑ 0.4%“, ne „↑ 0%“

## Out of Scope
- Žádná změna výpočtu výnosu v enginu (tiky, profily z feat-017, `revenuePerTick`) ani `computeRevenueAsOf`; mění se jen zobrazení a hodnota dlaždice.
- Žádný průměrný výnos za vteřinu a žádný výnos na jednu featuru.
- Žádná historie ani graf výnosu v čase (ukládání kumulativního výnosu po tikách); `computeRevenueAsOf` spočítá stejné hodnoty přesně z `finishedAt` a `revenuePerTick` bez uložené historie.
- Seznam Done (kumulativní výnos u featur, pulse „+€“) se nemění.
- Srovnání zůstává jen s nejbližším předchozím doběhnutým během (žádný výběr libovolného běhu, více běhů najednou).
- Advanced a Compare mód se nemění.
- Žádná perzistence stavu rozbalení.

## Technical Notes
- **Výpočet** žije v `Simulator.tsx` (blok `cfRevenueDelta`, okolo řádků 632–653). Stávající `compareTime`, `computeRevenueAsOf` a `calcDelta` se znovu použijí. Přibydou hodnoty pro dlaždici: výnos aktuálního běhu v horizontu (`computeRevenueAsOf([...cfState.done, ...cfState.doneOverflow], compareTime)`), výnos předchozího běhu v horizontu, celkový výnos aktuálního běhu a jeho `simTime`, celkový výnos předchozího běhu a jeho `totalTime` (už ve snapshotu: `totalRevenue`, `totalTime`).
- **`CashFlowPanel.tsx`:** props `revenueDelta`/`revenueDeltaHint` se rozšíří o data pro hodnotu a detail dlaždice (např. jediný objekt `revenueComparison`); dlaždice se přejmenuje na „Revenue (time-matched)“, tooltip řekne, že jde o výnos ve společném čase obou běhů a že celkový výnos je v rozbalení.
- **`StatTile.tsx`:** nově podporuje rozbalitelný detail (např. nepovinná prop `details?: ReactNode`; při jejím zadání se dlaždice chová jako tlačítko s `aria-expanded`, Enter/Space přepíná). Obecné řešení, ne specifické pro revenue; ostatní dlaždice se nemění.
- **Data-testid** dlaždice se změní z `stat-tile-Total Revenue` na `stat-tile-Revenue (time-matched)`; testy, které na něj odkazují, je potřeba přepsat.
- **Dotčené specy:** feat-015 (Metriky panel, Příklad 6 a 7 — tvrzení, že velké číslo je vždy finální výnos běhu, přestává platit), feat-016 (zmínka o dlaždici „pod Total Revenue“), feat-017 (tvrzení „Panel metrik se nemění“).
- Částky se v UI formátují stávající `formatEuro` (např. €9.5k, €15.7k, €7.3k); přesné hodnoty v příkladech výše jsou pro srozumitelnost. Časy se formátují `formatTime`.
- Čistá logika srovnání je v novém modulu `src/lib/revenueComparison.ts` (`computeRevenueComparison`), aby šla testovat mimo `Simulator.tsx`; `Simulator.tsx` ji jen volá a výsledek předává do `CashFlowPanel` jako `revenueComparison`. Výsledek nese `value`, `currentTotal` a nepovinný objekt `comparison` (`compareTime`, `delta?`, `previous`), který existuje jen při srovnání.
- Když je společný čas konec vlastního běhu (aktuálního i předchozího), použije se jeho skutečný `totalRevenue` (ne uzavřený dopočet), aby „Total“ v detailu sedělo s velkým číslem a identické běhy daly delta přesně 0 bez float šumu. Pole featur se v `Simulator.tsx` skládá jen po doběhnutí.
- `src/lib/formatPercent.ts` je sdílený formátovač procent (dříve lokální `fmtPct` v `CashFlowPanel`), používá ho `StatTile` pro deltu i panel pro Coordination overhead.
- Před implementací ověřit, zda nějaký existující test přímo kontroluje text „Total Revenue“.

## Open Questions
—

## Related Features
- **feat-015-cash-flow-mod:** tato feature mění zobrazení Total Revenue dlaždice a upravuje Příklad 7 (velké číslo už není vždy finální výnos).
- **feat-016-coordination-overhead:** dlaždice Coordination overhead se nově nachází pod dlaždicí „Revenue (time-matched)“.
- **feat-017-rozlozeni-vynosu-v-case:** porovnání funguje i mezi různými profily výnosu; tato feature jen mění, co dlaždice ukazuje.
