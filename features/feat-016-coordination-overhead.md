# Feature: Coordination Overhead

## Status
approved

*Revize 2026-10-09: (1) přidán **determinismus**, (2) **nová definice koordinace** — tax za každou další jednotku na featuře a rozpor odhalený při převzetí nebo při dokončení (původní „předání po hotové práci“ měřilo časování, ne počet lidí), (3) třetí WIP režim **Min units**, (4) sekce **Zdroje a oprávněnost konstant**. Původní rozsah (verze 1) je hotový a v produkci (PR #10); revize čeká na schválení.*

## Problem
Koučové chtějí ukázat, jak různé mandáty lidí a týmů ovlivňují koordinaci. Dnes engine předání mezi jednotkami jen zpětně spočítá (`avgHandoffs`), ale nijak neovlivňují běh simulace — koordinace nic nestojí, a proto nelze ukázat, že úzce specializované (silo) týmy platí za předávání práce časem, opravami chyb a zpožděnými výnosy.

**Nalezené problémy verze 1 (revize):**
1. **Nedeterminismus.** Při zapnutém overheadu dávají dva běhy téhož backlogu a týmu různé výsledky. Příčiny: Reset nevrací RNG na začátek, takže kostky na rework navazují na minulý běh; Cash Flow startuje s náhodným seedem při každém načtení stránky (Advanced má pevný seed 42). Koučové potřebují před publikem zopakovat stejný běh a spolehlivě srovnávat týmy.
2. **Špatná definice koordinace.** Verze 1 počítala jen předání „po hotové práci“. Čím víc jednotek začalo na featuře naráz, tím víc „souběžných startů“ bylo zdarma, takže šest týmů vycházelo levněji než tři (prototyp: 3× multiskill 3,6 % vs. 6× multiskill 0,6 %). Neodpovídá to realitě: dva týmy mohou začít souběžně a na konci zjistit, že úkol pochopily nebo implementovaly jinak. Koordinace musí růst s počtem lidí na featuře, ne s tím, jestli někdo stihl něco dokončit.

## User Story
Jako agilní kouč chci kvantifikovat koordinační náklady a ukázat vliv různých mandátů na tyto náklady, abych mohl pomoct managementu pochopit, že multiskill má finanční výhody.

## UI / Design
- **Rozsah:** přepínač Coordination overhead, čipy a dlaždice jen v Cash Flow módu. **Třetí WIP režim „Min units“** je ve sdíleném přepínači WIP módu v Advanced i Cash Flow. Compare se nemění (má pevný Reduce WIP).
- **Přepínač WIP módu — tři volby:** `Priority | Reduce WIP | Min units`. Výchozí zůstává **Reduce WIP**. Hover hint pro Min units: „WIP: units stay on features they already know and avoid features others are working on.“
- **Přepínač "Coordination overhead" (Off / On):** v levém sloupci v Settings → Team settings, hned pod přepínačem WIP módu. Výchozí **Off** — při Off se Cash Flow chová stejně jako dnes (a stejně jako Advanced se stejnou konfigurací). Změna přepínače po zahájení běhu vyžaduje Reset (přepínač je neaktivní s hintem „změna platí až po Resetu“).
- **Dlaždice "Coordination overhead"** v panelu metrik Cash Flow (jen při On): velké číslo = celkový podíl koordinace na Lead Time v %, pod ním řádky s rozpadem „handoff X % · rework Y %“. Má delta badge vs. předchozí běh stejně jako ostatní dlaždice.
- **Karta featury (In Progress i Done, ne Backlog):** čipy `⇄ n` (počet jednotek, které se na featuru připojily po první) a `↺ n` (počet reworků, výraznější barva). Při vzniku události čip krátce (1–2 s) zapulsuje. Čipy jsou vidět jen při On.
- Značení na úrovni jednotlivých tasků není součástí této feature.

### Schválený UI návrh (fáze 3, mockup `docs/feat-016-ui-mockup.html`)
- **Přepínač:** stávající `SegmentedControl` (Off / On) s vlastním popiskem „Coordination overhead“ nad ním. Hover hint: „Each additional unit on a feature pays 25 % extra work and has a 20 % chance of causing rework.“ *(upraveno v revizi)* Po startu běhu zamčený (opacity 0.5, `cursor: not-allowed`) a pod ním text „🔒 Takes effect after Reset“ (UI je anglicky). `SegmentedControl` dostal prop `disabled`.
- **Čipy:** v hlavičce `FeatureCard` vlevo od počtu tasků („4t“). `⇄ n` je neutrální (`--ink-2`, šedý rámeček), tooltip „n unit(s) joined this feature“ *(upraveno v revizi)*; `↺ n` v teplé červené (`oklch(50% 0.17 30)` na `oklch(95% 0.04 30)`). Čip se zobrazí až od n ≥ 1. Při zvýšení počtu 1,4 s pulse (zvětšení + rozplývající se prstenec, restart přes `key={count}`). Při reworku navíc krátce problikne segment vráceného tasku.
- **Done list:** řádky v Cash Flow nejsou `FeatureCard`, ale vlastní markup v `CashFlowPanel.tsx` → čipy se přidají tam, do řádku s €/tick. Bez pulse.
- **Dlaždice:** stávající `StatTile` pod Total Revenue. Tooltip dlaždice výslovně říká, že čitatel jsou sekundy práce sečtené přes všechny jednotky, kdežto jmenovatel je wall-clock Cycle Time, takže vysoce paralelní týmy mohou ukazovat vysoké hodnoty *(upřesněno po review)*. Hodnota „18 % of cycle time“, tenký dělený pruh handoff/rework (barvy shodné s čipy), legenda „handoff X % · rework Y %“, delta badge (nižší = lepší, výchozí sémantika).

### Pravidla modelu (pevné konstanty, bez sliderů)
Pozn.: pole se jmenují `joinCount` (počet připojení), `joinTaxSec` (tax za připojení) a `Task.joinTax`; slovo „handoff“ zůstává jen v uživatelském textu (dlaždice, hinty) a ve feat-007 (`computeHandoffs`, `avgHandoffs`), kde znamená skutečné předání mezi fázemi. *(Přejmenováno po review, aby se dva významy nepletly.)*
- **Připojení:** jednotka se poprvé přiřadí k tasku featury, na které už pracuje nebo pracovala jiná jednotka — **bez ohledu na to, jestli už něco dokončila** (platí i pro souběžný start a i uvnitř jedné fáze). První jednotka na featuře je zdarma. Jednotka, která na featuře už někdy pracovala, se vrací zdarma (i po reworku, i po odebrání a návratu).
- **Tax za připojení:** první task připojené jednotky dostane navíc 25 % svého **původního** `work` (orientace v cizí práci). Počítá se z `work` bez dřívějších přirážek — task vrácený reworkem a převzatý další jednotkou tedy neplatí tax z už zdaněné práce.
- **Rozpor (rework):** každá připojená jednotka jednou hodí kostku (viz „Determinismus“); při hodnotě < 0.2 „chápe featuru jinak než ostatní“. Okamžik odhalení závisí na situaci:
  - **Při převzetí (sekvenční práce):** pokud v okamžiku připojení existuje hotový task jiné jednotky, rozpor se odhalí hned. Jeden takový hotový task (vybraný druhou kostkou) ztratí 50 % svého `work` z progresu a vrátí se do `todo` bez assignee (kdokoli s danou rolí ho vezme podle běžných pravidel).
  - **Při dokončení (souběžná práce):** pokud žádný hotový task jiné jednotky není, rozpor čeká. Ve chvíli, kdy by se dokončil poslední task featury, se feature **nedokončí**: za každou čekající jednotku se jeden hotový task té jednotky (jinak libovolný hotový task) vrátí do `todo` se ztrátou 50 % `work` z progresu. Čekající rozpory jsou tím vyřízené; feature se dokončí, až jsou vrácené tasky znovu hotové.
- Vrácený task může převzít nová jednotka (další připojení → další tax a další kostka); rework se tak může řetězit, omezeno pravděpodobností.
- Ztracená práce se počítá do `reworkSec`, tax do `joinTaxSec`.
- **Reset tasku za běhu** (kouč odebere jednotce roli nebo jednotku smaže): task se vrátí do `todo` s nulovým progresem a vrátí se mu i přirážka z taxu (`work` i `joinTaxSec`), aby se tax při dalším převzetí nenásobil. `joinCount` zůstává (připojení proběhlo). Zahozený progres se do overheadu nepočítá — nejde o koordinaci, ale o ruční zásah do týmu.

### Režim Min units (třetí volba WIP přepínače, Advanced i Cash Flow)
Cíl: ukázat, co se stane, když jednotka drží featuru „u sebe“ a minimalizuje počet jednotek na featuře. Volba tasku jednotkou probíhá v tomto pořadí (první rozhodující kritérium vyhrává):
1. feature, na které jednotka už pracovala (má na ní task v jakémkoli stavu přiřazený sobě),
2. feature, na které nepracuje žádná jiná jednotka (nikdo jiný na ní nemá přiřazený task),
3. nejvyšší priorita.

Režim **nezávisí na přepínači Coordination overhead** (funguje i v Advanced a při Off). Ostatní pravidla (fáze/level, dostupnost tasku) zůstávají.

### Determinismus (revize)
Cíl: stejný backlog + stejný tým + stejná nastavení = vždy identický běh. Náhoda se **předem rozdělí**, ale počty připojení se **nepředgenerují** — vznikají ze struktury týmu (jinak by silo a multiskill platily stejně).
- **Pevný seed Cash Flow:** po načtení stránky a po výběru presetu (Teams / People) vznikne vždy tentýž backlog (seed 42, stejně jako v Advanced). „Generate new backlog“ zůstává náhodný (nový seed) — to je záměrná cesta k jinému backlogu.
- **Kostky patří featuře:** při vytvoření backlogu dostane každá featura `coordSeed`. Výsledky určuje čistá funkce `coordinationRoll(coordSeed, index, slot)` v intervalu [0, 1):
  - slot 0 = kostka rozporu (< 0.2 → rozpor), `index` = pořadí připojení (`joinCount` před zvýšením),
  - slot 1 = výběr vraceného tasku při převzetí (`floor(kostka × počet kandidátů)`), `index` = pořadí připojení,
  - slot 2 = výběr vraceného tasku při dokončení, `index` = `reworkCount` (počet reworků featury do té doby).
- **Důsledky:** výsledek nezávisí na pořadí zpracování jiných featur, na týmu ani na WIP módu, jen na featuře a na tom, kolikáté je to její připojení. Žádný sdílený proud RNG — nic, co by se při Resetu muselo vracet zpět. Featura je „křehká“ ve všech srovnávaných bězích stejně.
- **Reset:** po Resetu stejný backlog a tým dají identický běh (časy, Cycle Time, `joinCount`, `reworkCount`, výnos).
- `index` se zvyšuje s každým připojením (`joinCount`), i když byl task později resetován za běhu; kostka se tak nikdy neopakuje.
- Platí jen pro Cash Flow. Advanced a Compare se kvůli determinismu nemění.

## Specification by Example

**Příklad 1: Přepínač Off = beze změny**
- Given: Cash Flow, přepínač Off, daný seed
- When: běh doběhne
- Then: časy jsou shodné s Advanced při stejné konfiguraci a seedu; dlaždice ani čipy nejsou vidět

**Příklad 2: Tax za připojení**
- Given: přepínač On, FE task featury F dokončila jednotka A, BE task má `work = 1.5`
- When: nová jednotka B (která na F dosud nepracovala) se přiřadí k BE tasku
- Then: `work` BE tasku je 1.875 (+25 %), `joinTaxSec` featury roste o 0.375, `joinCount` je 1

**Příklad 3: Žádné připojení, žádný overhead**
- Given: přepínač On, jedna jednotka s rolemi FE i BE zpracuje oba tasky featury
- When: feature doběhne
- Then: `work` beze změny, `joinTaxSec = 0`, `reworkSec = 0`, oba počty jsou 0

**Příklad 4: Rework při převzetí hotové práce** *(upraveno v revizi)*
- Given: přepínač On, feature má hotový task jiné jednotky (`work = 1.0`), kostka rozporu (slot 0) je < 0.2
- When: nová jednotka se připojí k dalšímu tasku featury
- Then: hotový task se vrátí do `todo` s `progress = 0.5`, `reworkSec` roste o 0.5, `reworkCount` je 1; při kostce ≥ 0.2 se nic nevrací

**Příklad 5: Souběžný start platí tax, rework čeká** *(nahrazuje „souběžný start není předání“)*
- Given: přepínač On, FE i BE jsou ve stejné fázi, jednotka A (FE) a jednotka B (BE) začnou na featuře ve stejném ticku, kostka rozporu pro B je < 0.2
- When: B se připojí (nic hotového ještě není)
- Then: B zaplatí tax (`work` jejího tasku ×1.25, `joinCount = 1`), ale rework se hned neodehraje (rozpor čeká na dokončení featury); jednotka, která se na featuru vrací (už na ní pracovala), nezaplatí nic

**Příklad 6: Dlaždice s rozpadem**
- Given: přepínač On, alespoň jedna dokončená feature
- When: panel metrik se přepočítá
- Then: dlaždice „Coordination overhead“ ukáže celkové % Lead Time a pod ním „handoff X % · rework Y %“; celkové % = Σ(`joinTaxSec` + `reworkSec`) / Σ cycle time

**Příklad 7: Dopad na výnos**
- Given: stejný seed a konfigurace, běh s přepínačem Off a pak On
- When: oba běhy doběhnou
- Then: u On je delší Cycle Time a nižší výnos **ve stejném čase** (porovnání k času kratšího běhu přes `computeRevenueAsOf`, stejně jako delta badge z feat-015). Konečné Total Revenue se nesrovnává — delší běh s On tiká déle, a proto na konci vychází vyšší.

**Příklad 8: Změna přepínače vyžaduje Reset**
- Given: běh už začal
- When: uživatel zkusí přepnout Coordination overhead
- Then: přepínač je neaktivní s hintem „změna platí až po Resetu“

**Příklad 9: Silo vs. multiskill v režimu Min units** *(upraveno v revizi)*
- Given: přepínač On, WIP mód Min units, stejný backlog a seed; tým A silo (6 jednotek, jedna role na jednotku), tým B multiskill (jednotky se všemi rolemi)
- When: oba běhy doběhnou
- Then: multiskill má nižší Coordination overhead a vyšší výnos ve stejném čase než silo (prototyp, průměr 12 seedů: multiskill 0,7–1,9 %, silo ~5 %; výnos do 15. s ~5 300 vs. ~2 000)

**Příklad 10: Čipy a pulse na kartě**
- Given: přepínač On, feature v In Progress
- When: nová jednotka se připojí k tasku featury, na které dosud nepracovala, resp. nastane rework
- Then: na kartě se objeví nebo zvýší čip `⇄ n`, resp. `↺ n`, a na 1–2 s zapulsuje; čipy zůstávají i v Done listu, v Backlogu nejsou

**Příklad 11: Reset reprodukuje běh**
- Given: Cash Flow, přepínač On, tým a backlog beze změny; běh doběhne
- When: uživatel klikne na Reset a spustí běh znovu
- Then: celkový čas, Cycle Time každé featury, `joinCount` a `reworkCount` každé featury i výnos jsou přesně shodné s prvním během

**Příklad 12: Pevný seed po načtení**
- Given: čerstvě načtený Cash Flow (nebo čerstvě vybraný preset)
- When: stránku načtu podruhé (resp. preset vyberu znovu)
- Then: backlog je identický (featury, tasky, role, `work`, výnos); „Generate new backlog“ vytvoří jiný backlog

**Příklad 13: Kostky patří featuře, ne pořadí**
- Given: přepínač On, stejný backlog; běh A s týmem silo, běh B s týmem multiskill (nebo jiný WIP mód)
- When: featura F zažije v obou bězích své k-té připojení
- Then: o rozporu rozhoduje v obou bězích táž kostka `coordinationRoll(coordSeed_F, k, 0)`; jiné featury výsledek F neovlivní

**Příklad 14: Rozpor se projeví při dokončení featury** *(nové v revizi)*
- Given: přepínač On, jednotky A a B pracují souběžně na featuře, kostka rozporu pro B je < 0.2 (rozpor čeká)
- When: je hotov poslední task featury
- Then: feature se **nedokončí** a zůstává In Progress; jeden hotový task jednotky B (`work = 1.0`) se vrátí do `todo` s `progress = 0.5`, `reworkCount = 1`, `reworkSec` roste o 0.5; po dokončení vráceného tasku se feature dokončí (bez dalších připojení už nic nečeká). Při kostce ≥ 0.2 se feature dokončí hned.

**Příklad 15: Víc jednotek na featuře = víc overheadu** *(nové v revizi)*
- Given: přepínač On, WIP mód Reduce WIP, stejný backlog a seed; týmy 2×, 3× a 6× multiskill
- When: běhy doběhnou
- Then: Coordination overhead roste s počtem jednotek (prototyp, průměr 12 seedů: ~13 %, ~26 %, ~39 %); šest týmů nevychází levněji než tři. Cycle Time i tak klesá s počtem jednotek (swarm koordinaci zaplatí, ale paralelismus se vyplatí).

**Příklad 16: Pravidlo režimu Min units** *(nové v revizi)*
- Given: WIP mód Min units; jednotka U už pracovala na featuře F a dokončila task; na F je dostupný další task a na featuře G (na které nikdo nepracuje) také
- When: U si vybírá další task
- Then: U vezme task na F; pokud na F žádný dostupný není, vybere featuru, na které nepracuje žádná jiná jednotka, před featurou, na které už někdo pracuje; mezi stejnými kandidáty rozhoduje priorita

**Příklad 17: Min units v Advanced a v přepínači** *(nové v revizi)*
- Given: Advanced mód, multiskill tým, přepínač WIP má tři volby
- When: uživatel zvolí Min units
- Then: jednotky se řídí pravidlem z příkladu 16 (i bez overheadu); průměrný počet různých jednotek na featuru je výrazně nižší než v Reduce WIP (prototyp: ~1,1 vs. ~3 pro 6× multiskill); Compare mód zůstává beze změny

## Out of Scope
- Delivery manager a kapacita koordinátorů (vynecháno úplně, ani jako parametr)
- Nastavitelné slidery pro procenta (tax, pravděpodobnost, ztráta progresu) — konstanty jsou pevné
- P&L a náklady v €, jen vliv na čas a zpožděné výnosy
- Overhead, čipy a dlaždice v Advanced a Compare módu — koordinace se projeví jen v Cash Flow (režim Min units je ale v Advanced dostupný)
- Min units v Compare módu (Compare má pevný Reduce WIP)
- Úprava `avgHandoffs` a `computeHandoffs` z feat-007 (zůstávají beze změny; nová definice připojení je širší)
- Značení na úrovni jednotlivých tasků (jen čipy a pulse na kartě featury)
- Zobrazení, ruční zadání nebo sdílení seedu v UI (determinismus je zatím jen „stejný backlog = stejný běh“)
- Úprava `focusMode: 'continuity'` z feat-008 (zůstává beze změny; Min units je samostatná volba WIP přepínače)
- Čekání před startem jednotky jako forma taxu (tax je práce navíc)

## Technical Notes
- **Engine (`src/simulation/engine.ts`):** živá detekce připojení v `tick()` při přiřazení jednotky k tasku. Tax `(task.work − task.joinTax) × 25 %` (z původního `work`), rozpor přes kostky z `coordinationRoll` (20 %, ztráta 50 % `work`, vrácený task do `todo`). Efekt se aplikuje jen při zapnutém `coordinationOverhead`. Engine zůstává bez React závislostí. Konstanty pojmenované (`JOIN_TAX_PCT`, `REWORK_PROBABILITY`, `REWORK_PROGRESS_LOSS_PCT`).
- **Odhalení rozporu:** `applyCoordinationOverhead` při připojení hodí kostku; je-li hotový task jiné jednotky, rework proběhne hned, jinak se jednotka zapíše do čekajících (`Feature.pendingDivergence: number[]`). V bloku dokončování featur v `tick()`: pokud jsou všechny tasky hotové a `pendingDivergence` není prázdné, provede se rework za každou čekající jednotku, pole se vyprázdní a feature se v tomto ticku nedokončí (`continue`).
- **Typy (`src/types/simulation.ts`):** `SimSettings.coordinationOverhead?: boolean` (volitelné, chybějící = Off); na `Feature` pole `joinCount`, `reworkCount`, `joinTaxSec`, `reworkSec`, `workedBy`, `pendingDivergence`, `coordSeed` (inicializace v `makeFeature`, `cloneFeatureFresh` i XLS importu; `cloneFeatureFresh` je exportovaná a musí zakládat nová pole, ne sdílet reference — používá ji i `useCashFlowSimSetup` pro `backlogSnapshot` po XLS importu; features doplněné přes `minBacklog` v `tick()` dostanou vlastní `coordSeed`); `Task.joinTax?` (přirážka obsažená ve `work`, kvůli vrácení při resetu tasku); `LeadTimeEntry.joinTaxSec?` / `reworkSec?` (volitelné kvůli zpětné kompatibilitě); `SimStats.joinTaxPct`, `reworkPct`, `coordinationPct` (procenta 0–100). `WipMode` se rozšiřuje na `'priority' | 'reduce-wip' | 'min-units'`.
- **RNG / determinismus:** overhead logika **nepoužívá** sdílený `rng` z `tick()` — `applyCoordinationOverhead` ztratí parametr `rng`. Místo toho exportovaný čistý `coordinationRoll(coordSeed: number, index: number, slot: 0 | 1 | 2): number` (např. `mulberry32` nad hashem trojice). Při Off se nevolá nic (parita s Advanced).
- **`coordSeed`:** `Feature.coordSeed: number`. V `makeInitialState` se generuje **až po** revenue batchi (stejný princip jako revenue — sekvence `rng` pro tasky, role, `work` a výnos zůstává nedotčená, takže stávající backlogy v Advanced i Compare se nemění), ukládá se do `backlogSnapshot` a `cloneFeatureFresh` ho zachovává. U featur z XLS importu se vygeneruje při importu. `makeFeature` ho inicializuje na 0.
- **Pevný seed (`useCashFlowSimSetup.ts`):** inicializace hooku a `doApplyPreset` použijí konstantu seedu (42) místo `Math.random()`; `handleRegenerate` zůstává náhodný.
- **ID jednotek (`useCashFlowSimSetup.ts`):** `handleAddMember` si pamatuje nejvyšší kdy přidělené ID (`lastMemberIdRef`), takže se po smazání jednotky s nejvyšším ID nepřidělí znovu. Jinak by nová jednotka zdědila `workedBy` / `pendingDivergence` a `assignee` smazané jednotky.
- **Tooltipy:** hover hint `SegmentedControl` se zalamuje (`max-content`, max 260 px), aby nepřetékal 320px postranní panel.
- **Min units (`tick()`):** nová větev řazení kandidátů pro `wipMode === 'min-units'`: (1) feature, na které jednotka už pracovala, (2) feature bez jiných jednotek, (3) priorita. „Pracovala“ = `feature.workedBy` obsahuje jednotku; „pracuje na ní někdo jiný“ = `workedBy` obsahuje jinou jednotku. `workedBy` se **vede vždy** (i při Off): `tick()` do něj při prvním přiřazení jednotky k featuře zapíše id až po vyhodnocení overheadu, který ho čte. Režim tak nezávisí na přepínači overheadu a po reworku (vrácenému tasku se nuluje `assignee`) historii neztratí.
- **UI:** přepínač Off/On v Team settings pod WIP módem přes volitelné props v `BacklogSettingsPanel.tsx` (stejný vzor jako `getRevenueBadge?`, předává jen Cash Flow); dlaždice s rozpadem v `CashFlowPanel.tsx`; čipy a pulse v `FeatureCard.tsx` přes volitelné props, čipy v Done listu v `CashFlowPanel.tsx`; prop `disabled` v `SegmentedControl.tsx`. Stav přepínače v `useCashFlowSimSetup.ts`; změna vyžaduje Reset.
- **`SegmentedControl` pro tři volby:** dnes je typově i layoutově pevně dvouhodnotový (`options: [a, b]`, posuvná „pilulka“ na 0 % / 50 %). Je potřeba ho zobecnit na 2–3 volby (pilulka šířky 100 %/N, posun podle indexu) a zachovat zpětnou kompatibilitu pro ostatní použití. Sdílený WIP přepínač v `BacklogSettingsPanel.tsx` dostane třetí volbu a hint pro každou z nich.
- **Tutorial:** zkontrolovat `tutorialSteps.ts` / `TutorialOverlay.tsx`, zda text o přepínači WIP (pokud existuje) nezmiňuje „dvě možnosti“.
- **Rozdíl oproti feat-007:** nová definice připojení je širší (počítá i souběžný start a připojení uvnitř jedné fáze), proto je to samostatná logika; `computeHandoffs` a `avgHandoffs` se nemění.
- **Testy:** `tests/unit/simulation/feat-016-coordination-overhead.test.ts` — parita při Off, tax, rework při převzetí, rozpor při dokončení, souhrnná procenta. Testy, které dnes řídí kostky vstřikovaným `rng` (`always(0.1)`), se přepíšou na řízení přes `Feature.coordSeed`: test najde seed s požadovanou hodnotou `coordinationRoll(seed, k, slot)` (< 0.2 resp. ≥ 0.2) a nastaví ho featuře. Nové testy: čistota a rozsah `coordinationRoll`; Reset reprodukuje běh (příklad 11); pevný seed Cash Flow (příklad 12, na úrovni hooku/inicializace); nezávislost na týmu a WIP módu (příklad 13); rozpor při dokončení (příklad 14); monotónnost overheadu v počtu jednotek, agregováno přes seedy (příklad 15); pravidlo Min units a jeho funkčnost bez overheadu (příklady 16, 17); nezměněný backlog v Advanced/Compare pro stejný seed (regrese). Původní test „souběžný start není předání“ se obrací.
- **Závislosti:** feat-015 (Cash Flow, metriky, Total Revenue), feat-007 (předání), feat-008 (continuity — nezávislé), feat-009 (módy).
- **Vztah k feat-017 (profil výnosu):** křivka výnosu se měří od `finishedAt`, takže koordinační zpoždění dokončení (tax, rework) posune start křivky a příklady 7 a 9 (nižší výnos ve stejném čase při On) platí pro všechny profily. Přepínač Coordination overhead a přepínač Revenue curve jsou na sobě nezávislé.

## Zdroje a oprávněnost konstant
Model je **pedagogický, ne prediktivní**. Konstanty (25 % / 20 % / 50 %) jsou pevné předpoklady řádově v souladu s literaturou — nejsou z ní kalibrované a nikde se netvrdí opak.

| Konstanta | Opora ve studiích | Síla opory |
|---|---|---|
| **20 % šance na rozpor** (na každou připojenou jednotku) | **Souběžná práce:** Brindescu a kol. (Empirical Software Engineering, 2019) — 19,32 % z 36 122 merge commitů ve 143 open-source projektech skončilo konfliktem ([PDF](https://www.ics.uci.edu/~iftekha/pdf/J4.pdf)); Brun a kol. — zhruba 1 z 6 merge commitů (3 562 merge v 9 projektech; podle shrnutí v [studii VUB](https://soft.vub.ac.be/~wmuylaer/repository/2017msr.pdf)); Ghiotto a kol. (ICSE 2019) cituje dřívější odhady 10–20 % merge pokusů ([ICSE](https://2019.icse-conferences.org/details/icse-2019-Journal-First-Paper/45/On-the-Nature-of-Merge-Conflicts-a-Study-of-2-731-Open-Source-Java-Projects-Hosted-)). **Sekvenční předání:** DORA „change failure rate“ — elitní týmy 0–15 %, ostatní zhruba 16–30 % (pásma pro střední skupiny se mezi zdroji liší: [DevLake](https://devlake.apache.org/docs/v0.20/Metrics/CFR), [CloudBees](https://docs.cloudbees.com/docs/cloudbees-saas-platform/latest/analytics/dora-metrics); definice metriky: [dora.dev](https://dora.dev/guides/dora-metrics/)). | střední až dobrá |
| **+25 % tax** (práce navíc při připojení) | Přímé číslo „+25 % na nováčka“ jsem nenašel. Nepřímo: Herbsleb a Mockus (2003) — práce napříč lokalitami trvala zhruba 2,5× déle, hlavně proto, že se jí účastnilo víc lidí, a počet lidí silně souvisel s dobou dokončení ([PDF](https://www.st.cs.uni-saarland.de/edu/empirical-se/2006/PDFs/herbsleb03.pdf)); Scholtes a kol. (Empirical Software Engineering, 2016; DOI 10.1007/s10664-015-9406-4) — u všech 58 sledovaných open-source projektů (580 000+ commitů, 30 000+ vývojářů) klesá průměrná produktivita vývojáře s velikostí týmu ([arXiv](https://arxiv.org/pdf/1608.03608)); Poppendieckovi odhadují, že každé předání zahodí zhruba polovinu znalostí — autorský odhad bez měření ([DZone](https://dzone.com/articles/waste-4-handoffs), [eWeek](https://www.eweek.com/development/what-it-means-to-be-lean/)). | slabá až střední |
| **50 % ztráty `work`** při reworku | Přímý zdroj neexistuje — předpoklad. Kontext: Boehm a Basili (IEEE Computer, 2001) — současné projekty tráví zhruba 40–50 % úsilí zbytečným reworkem ([shrnutí](https://umiacs.umd.edu/node/12156)); jde o podíl úsilí projektu, ne ztrátu jednoho tasku. | slabá |

- **Kontrola řádu:** výsledný overhead v modelu vychází zhruba 1–39 % Cycle Time podle struktury týmu a WIP režimu, tedy pod hodnotou 40–50 % zbytečného reworku (a taxu) uváděnou Boehmem a Basilim.
- **Nenalezeno:** seriózní měření ztráty produktivity stávajících členů při příchodu nováčka (jen praktické články a nepojmenovaný průzkum o rozjezdu 3–9 měsíců).
- **Důležité upozornění:** čísla pocházejí ze shrnutí ve výsledcích vyhledávání. Primární zdroje nešlo vždy načíst (PDF Boehma a Basiliho binární, server Herbslebova článku odmítl spojení, Nokia 403, stránka DORA nepodává hranice pásem). **Před veřejnou citací** (README, prezentace, UI) ověřit v originálech zejména Brindescu a kol., Herbsleb a Mockus a Boehm a Basili.
- **Rozptyl DORA pásem:** sekundární zdroje uvádějí High jako 16–20 % nebo 16–30 % a Medium jako 21–45 % nebo 31–45 %. Spec proto cituje jen to, na čem se shodují (elita 0–15 %, ostatní zhruba 16–30 %).

## Open Questions
- **Jmenovatel overhead %:** čitatel jsou sekundy práce sečtené přes všechny jednotky (person-seconds), jmenovatel wall-clock Cycle Time featury, takže u swarmu poměr roste s paralelismem a u jednotlivé featury může přesáhnout 100 %. Pro teď zůstává vzorec ze specu (a schválené testy), jen tooltip dlaždice to výslovně říká. Alternativa: jmenovatel = celková práce featury (součet `work` tasků + `reworkSec`), tedy „podíl práce, která šla na koordinaci“ — neměnila by pořadí týmů, ale změnila by čísla (swarm by klesl z ~39 % níže) a vyžádala by si nové pole v `LeadTimeEntry`.
- Doladit výchozí hodnoty procent (25 % / 20 % / 50 %) po vyzkoušení v prohlížeči. Zejména: swarm (6× multiskill v Reduce WIP) vychází v prototypu s overheadem ~39 %, což může působit hodně.
- Prototyp testoval jen role v jedné fázi (všechny `level: 1`, jako výchozí presety). Chování s víc fázemi (`level` 2, 3) ověřit při implementaci.
- V režimu Priority (WIP) nebyl nový model prototypem ověřen (původní model v něm dával multiskill vyšší overhead než silo).
- Asymetrie výběru vraceného tasku: při převzetí se vrací task jiné jednotky („nováček objevil chybu v cizí práci“), při dokončení task jednotky s rozporem („dělala to jinak“). Potvrdit, že je to záměr.
- ~~XLS import: odkud bere seed pro `coordSeed`~~ → `parseRows` už používal pevný seed 42 pro výnos; `coordSeed` se generuje ze stejného deterministického proudu až po výnosu, takže stejný soubor dává vždy stejný backlog i běh.
- **Pozorování z implementace:** Min units u silo týmů se chová podobně jako Priority (jednotka s jedinou rolí na své featuře zůstat nemůže, bere si novou) — Avg WIP při 100 featurách ~40 (Priority ~47, Reduce WIP ~7), u multiskill ~6. Je to důsledek pravidla „feature bez jiných jednotek“, ne chyba; v Advanced může vysoké WIP u silo týmu překvapit.
- ~~Řetězení reworku~~ → ano, omezeno pravděpodobností. ~~Tax jako práce navíc, nebo čekání?~~ → práce navíc.
