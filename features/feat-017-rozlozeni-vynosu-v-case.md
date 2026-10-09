# Feature: Rozložení výnosu v čase (Revenue curve)

## Status
in-progress

*Stav 2026-10-09: spec, UI návrh a testy schváleny, implementace hotová na větvi `feat/017-revenue-curves` a prošla dvěma koly code review; čeká na commit a PR.*

*Přírůstek 1 ze záměrně postupného vývoje: nejdřív tři profily (Flat, J‑curve, S‑curve). Další profily (např. front‑loaded, mixed) se přidají jako samostatné přírůstky nad stejným mechanismem — viz Technical Notes → Rozšiřitelnost.*

## Problem
Ve feat-015 vydělává každá dokončená featura **navždy stejnou částku za tik**. Je to zjednodušení: nic z toho, co víme o tom, jak se nové funkce v čase vyplácejí, se v simulátoru nedá ukázat. Adopce chvíli trvá, přínos se někdy projeví se zpožděním a teprve pak naroste. Koučové proto nemohou manažerům ukázat, že o hodnotě rozhoduje nejen **výše** výnosu, ale i **tvar** návratnosti po dodání. Chybí přepínač, který by na **identickém backlogu a týmu** porovnal různé tvary a ukázal, kdy se rychlé dodání vyplatí a kdy ne.

## User Story
Jako agilní kouč chci v Cash Flow módu přepínat tvar, jakým featury po dodání vydělávají (Flat, J‑curve, S‑curve), abych na stejném backlogu a týmu ukázal manažerům, že hodnotu určuje nejen výše výnosu, ale i to, jak a kdy se po dodání projeví.

## UI / Design
- **Rozsah:** jen Cash Flow mód. Advanced a Compare se nemění (výnos tam neexistuje, resp. zůstává Flat).
- **Přepínač „Revenue curve“** (`SegmentedControl`, tři volby: `Flat | J-curve | S-curve`) v levém sloupci v **Settings → akordeon „♻ Backlog“**, pod tlačítkem „Generate new backlog“ a nad slidery (ne v Team settings — tvar výnosu je vlastnost backlogu, ne týmu). Výchozí je **Flat** = dnešní chování. Podrobnosti viz „Schválený UI návrh“ níže.
- **Náhled tvaru v nastavení:** pod přepínačem malý graf zvolené křivky (násobek základního výnosu po dobu 0–16 ticků, sdílená osa 0–2×, tečkovaná čára = úroveň Flat) s popiskem „Revenue per tick after delivery · 0–16 ticks · plateau N× Flat“. Je to jediné místo, kde se tvar křivky kreslí.
- **Hover hint** (UI je anglicky):
  - Flat: „Every feature earns the same amount per tick from the moment it is delivered.“
  - J-curve: „Earns little right after delivery, then grows past the flat level. Illustrative shape inspired by delayed returns to IT investment.“ *(po review: původní „after Brynjolfsson & Hitt“ připisovalo tvar studii, která měří jen návratnost za 1 rok vs 5–7 let, ne křivku v čase)*
  - S-curve: „Ramps up gradually after delivery and levels off at the flat amount. Bass adoption curve.“
- **Přepnutí zachová backlog.** Stejné featury, tasky, priority i základní výnos; mění se jen tvar křivky a simulace se resetuje (viz „Chování přepínače“).
- **Chování přepínače:**
  - před startem běhu se změna projeví hned;
  - **během běhu** (běh začal a ještě nedoběhl) vyskočí potvrzovací dialog „Changing the revenue curve resets the current run.“ (Cancel / Change and reset), stejný vzor jako potvrzení presetu; po zrušení se nic nezmění;
  - **po doběhlém běhu** se změna provede hned bez dialogu a výsledek běhu se uloží jako předchozí běh pro delta badge, přesně jako tlačítko Reset (feat-015, příklad 6).
- **Karta featury v Backlogu:** badge ukazuje **ustálený výnos** za tik (výnos, ke kterému křivka dospěje): Flat `€400/tick`, S‑curve `€400/tick`, J‑curve `€800/tick` (základ × 2). Karta se jinak nemění, **mini‑graf na kartě není** (všechny featury mají tentýž tvar, ukazuje ho jen náhled v nastavení).
- **Done list:** layout beze změny (kumulativní výnos, pulse „+€“ posledního ticku, progress bar do dalšího ticku). Řádek `€/tick` ukazuje stejný ustálený výnos jako badge v Backlogu; pulse ukazuje **skutečný** přírůstek posledního ticku, takže je vidět, jak výnos roste.
- **Panel metrik** se nemění. Total Revenue a delta badge fungují beze změny (time‑matched, i mezi různými profily).
- **Perzistence:** zvolený profil se drží v paměti (výchozí Flat po načtení stránky), stejně jako `activePresetId` v Cash Flow; do `localStorage` se neukládá.

### Schválený UI návrh (fáze 3, mockup `docs/feat-017-ui-mockup.html`)
- **Umístění:** uvnitř akordeonu „♻ Backlog“ (výchozí stav akordeonu zůstává zavřený), pořadí shora: Import XLS / Šablona, Generate new backlog, **Revenue curve** (popisek 10 px `--ink-3`, `SegmentedControl`, náhled tvaru), slidery.
- **Přepínač:** stávající `SegmentedControl` se třemi volbami, hover hint se zalamuje do 260 px (texty viz výše).
- **Náhled tvaru:** inline SVG, šířka přizpůsobená sloupci (max 250 px), výška cca 46 px, křivka v `var(--done)` (1,8 px), tečkovaná čára úrovně Flat v `var(--ink-3)` s popiskem „Flat level“, pod ním popisek 9,5 px `--ink-3`. Osa X = 0–16 ticků, osa Y = 0–2× základního výnosu. Mění se okamžitě se zvolenou volbou.
- **Karta v Backlogu:** jen badge s ustáleným výnosem (`€800/tick`), beze změny rozložení.
- **Potvrzovací dialog:** překryv přes oblast Settings (stejný vzor jako `confirmingPreset`), nadpis „Change revenue curve?“, text „Changing the revenue curve resets the current run. The backlog stays the same.“, tlačítka „Cancel“ / „Change and reset“. Zobrazí se jen během běhu. Dialog je sdílená komponenta `ConfirmOverlay` (používá ji i potvrzení presetu): `role="dialog"` s `aria-modal`, po otevření fokus na Cancel, Escape = Cancel, Tab cyklí jen mezi oběma tlačítky; klávesy se zachytávají na úrovni dokumentu, takže fungují i po kliknutí na ztmavenou plochu kolem karty. Zavře se i při Resetu, „Generate new backlog“, výběru presetu a XLS importu (už by se ptal na zahozený běh). Když běh doběhne, zatímco je dialog otevřený, „Change and reset“ ho uloží jako předchozí běh stejně jako tlačítko Reset.
- **Done list a metriky:** beze změny rozložení; Total Revenue dostane po doběhnutém běhu delta badge s hintem `@ mm:ss.s`.

## Pravidla modelu
- **Základ:** `Feature.revenuePerTick` zůstává jako dnes (Gauss, průměr 140, odchylka 100, minimum 15, seřazeno podle priority). Je to **úroveň Flat**. Mezi profily se proto nemění backlog ani jeho základní hodnoty.
- **Tik č. *k*** (k = 1, 2, 3, … je pořadí revenue ticku od dokončení; první tik přijde 3 s po dokončení) vydělá `revenuePerTick × m(profil, k)`.
- **Profily** (konstanty jsou pojmenované, ilustrativní a v jednotkách ticků; 1 tik = 3 s simulačního času):
  - **Flat:** `m(k) = 1`.
  - **S‑curve (rozjezd na plató):** kumulativní adopce Bassova modelu, `m(k) = (1 − e^(−(p+q)·k)) / (1 + (q/p)·e^(−(p+q)·k))`, `p = 0.05` (inovátoři), `q = 0.6` (napodobitelé). Roste od ≈0 k 1, **plató = 1** (stejné jako Flat), takže S‑curve nikdy nepřekročí Flat.
  - **J‑curve (zpoždění a vyšší plató, bez propadu):** `m(k) = 0.2 + 1.8 / (1 + e^(−0.9·(k − 6.5)))`. Začíná na ≈0.21 (nízký, ale kladný výnos), překročí úroveň Flat mezi 6. a 7. tikem a dospěje k **plató 2** (dvojnásobek Flat). Žádný záporný výnos.
- **Tabulka multiplikátorů** (zaokrouhleno, slouží jako referenční hodnoty testů):

| k | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|----|----|----|
| S | 0.066 | 0.170 | 0.317 | 0.489 | 0.656 | 0.788 | 0.878 | 0.933 | 0.964 | 0.981 | 0.990 | 0.995 |
| J | 0.213 | 0.231 | 0.274 | 0.372 | 0.571 | 0.901 | 1.299 | 1.629 | 1.828 | 1.926 | 1.969 | 1.987 |

- **Důsledky tvaru (pro kouče):** S‑curve je v kumulativním výnosu vždy pod Flat (platí za pomalou adopci). J‑curve začne pod Flat a v kumulativním výnosu ho dožene až po 11 tiku (33 s). Po 15 tikách (45 s) je kumulativní násobek základu Flat 15,0, S‑curve 11,2 a J‑curve 19,2.
- **Křivka se měří od dokončení featury** (`finishedAt`), takže se přirozeně posune, když koordinační overhead (feat-016) dokončení zpozdí.
- **Částky se při připisování nezaokrouhlují**, zaokrouhluje jen zobrazení (`formatEuro`).
- **Determinismus:** křivka nepoužívá žádný RNG. Profil je štítek na featuře a tvar je čistá funkce `(profil, k)`.

## Specification by Example

**Příklad 1: Flat = beze změny**
- Given: Cash Flow, přepínač Flat, daný seed
- When: běh doběhne
- Then: všechny výnosy, Total Revenue i delta badge jsou přesně shodné s chováním před touto feature (feat-015)

**Příklad 2: S‑curve — rozjezd na plató**
- Given: přepínač S‑curve, featura s `revenuePerTick = 400` je dokončena v čase 0
- When: proběhnou tiky v 3, 6, 9, 15 s (k = 1, 2, 3, 5)
- Then: tiky vydělají zhruba €26, €68, €127 a €262; výnos za tik roste monotónně a nikdy nepřekročí €400

**Příklad 3: J‑curve — pomalý start, překročení Flat, plató 2×**
- Given: přepínač J‑curve, featura s `revenuePerTick = 400` je dokončena v čase 0
- When: proběhnou tiky k = 1, 6, 7 a 12
- Then: tiky vydělají zhruba €85, €360, €520 a €795; výnos za tik se blíží €800 (2× Flat)

**Příklad 4: Žádný propad**
- Given: libovolný profil, libovolná featura
- When: proběhne libovolný revenue tik
- Then: přírůstek je kladný (> 0), Total Revenue nikdy neklesne

**Příklad 5: Přepnutí zachová backlog**
- Given: čerstvý Cash Flow backlog na Flat, nic se nespustilo
- When: uživatel přepne na J‑curve
- Then: featury, jejich tasky, priority a `revenuePerTick` jsou beze změny; všechny featury mají profil J‑curve; badge v Backlogu ukazují 2× základ

**Příklad 6: Přepnutí během běhu vyžaduje potvrzení**
- Given: běh začal a ještě nedoběhl
- When: uživatel klikne na jiný profil
- Then: zobrazí se potvrzovací dialog; po „Cancel“ se běh ani profil nezmění; po „Change and reset“ se profil změní a simulace se vrátí na začátek se stejným backlogem

**Příklad 7: Srovnání stejného backlogu napříč profily**
- Given: běh na Flat doběhl; uživatel přepne na S‑curve (bez dialogu, výsledek Flat běhu se uloží jako předchozí běh) a nový běh doběhne
- When: panel metrik spočítá delta badge u Total Revenue
- Then: porovnání je time‑matched k dřívějšímu z obou celkových časů (feat-015, příklad 7) a vyjde záporné (S‑curve je ve stejném čase pod Flat) s hintem `@ mm:ss.s`; Total Time, Avg Cycle Time a Avg WIP jsou shodné (stejný backlog a tým)

**Příklad 8: Badge v Backlogu a náhled tvaru v nastavení**
- Given: featura v Backlogu se `revenuePerTick = 400`, akordeon „♻ Backlog“ je otevřený
- When: uživatel přepíná Flat → J‑curve → S‑curve
- Then: badge na kartě ukáže `€400/tick`, `€800/tick`, `€400/tick`; náhled pod přepínačem změní tvar (vodorovná čára na úrovni Flat; rostoucí křivka dospívající na 2× nad čáru Flat; rostoucí křivka dospívající na čáru Flat) a popisek ukáže „plateau 1× / 2× / 1× Flat“; karty v Backlogu žádný mini‑graf nemají; pořadí featur se nemění

**Příklad 9: Done list ukazuje skutečný přírůstek**
- Given: přepínač S‑curve, featura v Done
- When: proběhnou po sobě tři revenue tiky
- Then: pulse „+€“ ukáže postupně rostoucí částky; řádek `€/tick` zůstává na ustáleném výnosu; kumulativní výnos je součet připsaných přírůstků

**Příklad 10: Uzavřený vzorec odpovídá živé smyčce**
- Given: libovolný profil, několik featur dokončených v různých časech
- When: simulace doběhne na simTime T
- Then: `computeRevenueAsOf(features, T)` se shoduje s `state.totalRevenueAllTime` (s tolerancí zaokrouhlení) a `computeRevenueAsOf([f], T)` s `f.totalRevenue`; totéž platí retroaktivně pro dřívější T

**Příklad 11: Rychlost simulace nic nemění**
- Given: dvě identické simulace se stejným seedem a profilem J‑curve, jedna na 1×, druhá na 10×
- When: obě dosáhnou stejného simTime
- Then: mají identický Total Revenue

**Příklad 12: Vytěsněné featury si drží tvar**
- Given: profil J‑curve, backlog větší než 40 featur (starší se přesouvají z `done` do `doneOverflow`)
- When: featura přejde do `doneOverflow` a simulace běží dál
- Then: její další tiky pokračují v tvaru křivky od správného k (nezačínají znovu od začátku křivky) a Total Revenue sedí se součtem všech featur

**Příklad 13: Profil přežije Generate, preset i import**
- Given: zvolen profil S‑curve
- When: uživatel klikne na „Generate new backlog“, vybere preset (Teams / People) nebo naimportuje XLS
- Then: nový backlog má všechny featury v profilu S‑curve a přepínač zůstává na S‑curve

**Příklad 14: Reset reprodukuje běh**
- Given: Cash Flow, profil J‑curve, stejný tým a backlog; běh doběhne
- When: uživatel klikne na Reset a spustí běh znovu
- Then: časy, Cycle Time featur a výnos (průběžný i konečný) jsou přesně shodné s prvním během

**Příklad 15: Ostatní módy beze změny**
- Given: Advanced a Compare mód; čerstvě načtený Cash Flow
- When: uživatel otevře kterýkoli z nich
- Then: Advanced a Compare se nezměnily (žádný přepínač, žádný mini‑graf); Cash Flow začíná na Flat

**Příklad 16: Kombinace s coordination overhead**
- Given: profil J‑curve, Coordination overhead zapnutý (feat-016), featura se zpožděním dokončena v čase 12 s
- When: proběhne její první revenue tik
- Then: přijde v čase 15 s a má multiplikátor k = 1 (křivka se měří od dokončení, ne od startu běhu)

## Out of Scope
- Další profily (front‑loaded / novelty, mixed apod.) — přijdou jako samostatné přírůstky; mechanismus je na to připravený
- Náhodný rozptyl tvaru mezi featurami (všechny featury mají tentýž tvar, liší se jen základním výnosem)
- Skutečný J‑propad pod nulu (záporný cash flow); vyžaduje nákladovou stranu (P&L, viz Out of Scope ve feat-015)
- Nastavitelné slidery pro parametry křivek (konstanty jsou pevné)
- Graf historie výnosů v čase (feat-015 ho vynechává; náhled v nastavení ukazuje *model křivky*, ne historii běhu)
- Mini‑graf (sparkline) na kartách featur v Backlogu — rozhodnuto ve fázi 3: tvar je pro všechny featury stejný, ukazuje se jen jedním náhledem v nastavení
- Projektovaný výnos po konci backlogu („what if horizon“); viz Open Questions
- Nákladová strana složitosti (Lehman, Eick: každá další featura je dražší) — samostatná budoucí feature
- Změny v Advanced a Compare módu

## Technical Notes
- **Typy (`src/types/simulation.ts`):** nový `type RevenueProfile = 'flat' | 'j-curve' | 's-curve'` (JSDoc nad typem). `Feature.revenueProfile: RevenueProfile` a `Feature.revenueTickCount: number` (kolik revenue ticků už bylo připsáno; příští tik má k = `revenueTickCount + 1`). `SimSettings.revenueProfile?: RevenueProfile` (volitelné, chybějící = `'flat'`, stejný vzor jako `coordinationOverhead`). `doneOverflow` záznam se rozšíří o `revenueProfile` a `revenueTickCount`. `CashFlowRunSnapshot.doneFeatures` dostane navíc volitelné `revenueProfile`.
- **Engine (`src/simulation/engine.ts`):**
  - nové exportované čisté funkce `revenueMultiplier(profile, k): number` a `cumulativeRevenueMultiplier(profile, n): number` (součet m(1..n)); tabulka multiplikátorů a prefixových součtů se předpočítá na úrovni modulu (např. do 60 ticků, dále plató), takže dotaz je O(1);
  - konstanty pojmenované (`BASS_P`, `BASS_Q`, `J_START`, `J_PLATEAU`, `J_MIDPOINT_TICK`, `J_STEEPNESS`) s komentářem co a proč;
  - accrual smyčka v `tick()` (stávající `while` blok, řádky kolem [engine.ts:987](src/simulation/engine.ts:987)) připíše `f.revenuePerTick × revenueMultiplier(f.revenueProfile, ++f.revenueTickCount)`; stejný princip pro `doneOverflow`;
  - `computeRevenueAsOf` ([engine.ts:170](src/simulation/engine.ts:170)) = `revenuePerTick × cumulativeRevenueMultiplier(profil, floor((simTime − finishedAt) / REVENUE_TICK_INTERVAL_SEC))`; parametr `Pick<Feature, 'finishedAt' | 'revenuePerTick'> & { revenueProfile?: RevenueProfile }`, chybějící profil = Flat, takže stávající volání a testy fungují beze změny;
  - `makeFeature`, `cloneFeatureFresh` a XLS import ([xlsImport.ts](src/lib/xlsImport.ts)) zakládají nová pole (`revenueProfile` z nastavení, `revenueTickCount: 0`); `cloneFeatureFresh` vrací čítač na 0;
  - profil se přiřazuje **bez RNG** po vytvoření featur, takže se nemění žádná stávající sekvence (task, role, výnos, `coordSeed`).
- **Přepnutí (`useCashFlowSimSetup.ts`):** přepsání profilu je čistá exportovaná funkce enginu `setRevenueProfile(state, profile)`: přepíše `revenueProfile` na featurách `backlog` i `backlogSnapshot`, zavolá `resetFromSnapshot` a vrátí tentýž `state` (žádná regenerace, funguje i pro XLS backlog). Hook ji volá a přepíše `settings.revenueProfile`; před resetem po doběhnutém běhu `Simulator.tsx` uloží běh jako předchozí (společný pomocník `promoteCashFlowFinishedRun`, který používá i Reset a Generate new backlog). Totéž dělá „Change and reset“ v dialogu, protože běh za překryvem může mezitím doběhnout. Pokrývá to `tests/unit/simulation/feat-017-simulator-integration.test.tsx` (falešný čas RAF). `handleRegenerate` a `doApplyPreset` už předávají `settingsRef.current` do `makeInitialState`, takže profil zachovají; XLS import profil přepíše podle nastavení. Potvrzovací dialog během běhu podle vzoru `confirmingPreset`.
- **UI:** volitelné props v `BacklogSettingsPanel.tsx` (stejný vzor jako `getRevenueBadge?` a `coordinationOverhead`), předává je jen Cash Flow. `getRevenueBadge` i řádek Done listu berou ustálený výnos z jediného pomocníka `plateauRevenuePerTick(feature)` v enginu (`revenuePerTick × plató profilu`), takže obě čísla se nemohou rozejít. Náhled tvaru jako malá komponenta `RevenueCurvePreview` (inline SVG, CSS Module), která čte stejnou funkci `revenueMultiplier` jako engine. Řádek `€/tick` v Done listu v `CashFlowPanel.tsx` ([CashFlowPanel.tsx:128](src/components/CashFlowPanel.tsx:128)) ukazuje stejné číslo. `SegmentedControl` už 3 volby podporuje (WIP přepínač). Přepínač a náhled jsou uvnitř akordeonu „♻ Backlog“ v `BacklogSettingsPanel.tsx`; `FeatureCard` se nemění (jen text badge přes `getRevenueBadge`).
- **Tutorial:** zkontrolovat `tutorialSteps.ts`, zda Cash Flow kroky nepopisují výnos jako konstantní.
- **Rozšiřitelnost:** nový profil = jeden člen unie `RevenueProfile`, jedna funkce `m(k)` + plató, volba v přepínači s hintem a řádek v Research Basis. Nic dalšího v accrual smyčce ani v `computeRevenueAsOf` se nemění.
- **Testy (fáze 4, napsané a červené):**
  - `tests/unit/simulation/feat-017-rozlozeni-vynosu.test.ts` — engine: hodnoty z tabulky multiplikátorů, monotónnost S, plató a kladnost J, Flat parita se stávajícími hodnotami, accrual v `tick()` (příklady 1–4, 16), ekvivalence živé smyčky a `computeRevenueAsOf` pro všechny profily (včetně retroaktivní, s `toBeCloseTo`), speed‑invariance, `doneOverflow`, generování backlogu (výchozí profil, žádný posun RNG, `regenerate`, XLS import), `setRevenueProfile`, celé běhy (Reset reprodukuje běh, profil nemění tok práce, S‑curve je pod Flat).
  - `tests/unit/simulation/feat-017-prepinac-profilu.test.ts` — hook `useCashFlowSimSetup`: dialog jen během běhu, Cancel / Change and reset, přepnutí po doběhnutém běhu, profil přežije Generate, preset i XLS import, dialog se zavře při nahrazení běhu, `settings.revenueProfile` se nikdy nerozejde s profilem featur.
  - `tests/unit/simulation/feat-017-revenue-curve-ui.test.tsx` — `RevenueCurvePreview` a přepínač s dialogem v `BacklogSettingsPanel` (umístění v akordeonu, hover hinty, žádný mini‑graf na kartách, žádný přepínač v Advanced) a přístupnost `ConfirmOverlay` (role, fokus, Escape, focus trap).
  - `tests/unit/simulation/feat-017-simulator-integration.test.tsx` — propojení v `Simulator.tsx` s falešným časem RAF: doběhnutý běh se při změně křivky uloží jako předchozí (delta badge), totéž při „Change and reset“ po doběhnutí za překryvem, Reset zavře dialog.
- **Kontrakty, které testy předpokládají** (implementace je musí dodržet):
  - `engine.ts` exportuje `revenueMultiplier(profile, k)`, `cumulativeRevenueMultiplier(profile, n)`, `revenuePlateau(profile)`, `setRevenueProfile(state, profile)`. Hodnoty profilů: `'flat' | 'j-curve' | 's-curve'`.
  - `Feature.revenueProfile` a `Feature.revenueTickCount`; `SimSettings.revenueProfile?`; záznam `doneOverflow` nese `revenueProfile` a `revenueTickCount`; `computeRevenueAsOf` přijímá záznam s volitelným `revenueProfile`.
  - `useCashFlowSimSetup` vrací `revenueProfile`, `confirmingRevenueProfile`, `setConfirmingRevenueProfile`, `handleRevenueProfileChange`, `handleConfirmRevenueProfile`. Dialog se otevře jen když `startedAt !== null && !finished`.
  - `BacklogSettingsPanel` má nové volitelné props `revenueProfile`, `onRevenueProfileChange`, `confirmingRevenueProfile`, `onConfirmRevenueProfile`, `onCancelRevenueProfile`. Přepínač (a náhled) se vykreslí jen s `onRevenueProfileChange`.
  - `RevenueCurvePreview({ profile })` v `src/components/RevenueCurvePreview.tsx`: kořen `role="img"` s `aria-label="Revenue curve preview: Flat | J-curve | S-curve"`, `polyline` s `data-testid="revenue-curve-line"` (17 bodů pro k = 0–16, osa Y dolů, sdílená škála 0–2×), `line` s `data-testid="flat-level-line"` (úroveň 1×, atribut `y1`), popisek `Revenue per tick after delivery · 0–16 ticks · plateau N× Flat`.
  - Hover hint přepínače odpovídá aktuálně zvolenému profilu (texty ve „UI / Design“).
  - Texty profilů (název a hint) jsou na jednom místě v `REVENUE_PROFILE_INFO` v čistém modulu `src/lib/revenueProfiles.ts` (mimo soubory komponent, aby jejich úprava nevyvolala plný reload; typově vyčerpávající `Record<RevenueProfile, …>`), stejně jako tabulka kumulativních součtů v enginu a body křivek v náhledu. Přepínač v panelu má volby uvedené ručně; test hlídá, že má tlačítko pro každý profil z `REVENUE_PROFILE_INFO`.
- **Povinná změna existujících fixtur:** `Feature` dostane dvě nová povinná pole (`revenueProfile`, `revenueTickCount`), takže je nutné doplnit ručně psané `Feature` literály v existujících testech (15 výskytů v 6 souborech: feat-002 waiting-time, feat-006, feat-007 × 2, feat-008, feat-015). Je to mechanická úprava (`revenueProfile: 'flat', revenueTickCount: 0`), stejně jako u polí z feat-016. Alternativa s opačným kompromisem: pole zavést jako volitelná (`?`, chybějící = flat / 0), pak se existující testy nemění, ale engine musí na třech místech psát `?? 'flat'`.
- Komponentový test přepínače `SegmentedControl` se třemi volbami už existuje (`feat-016-segmented-control.test.tsx`), v feat-017 se neduplikuje.
- **Závislosti:** feat-015 (Cash Flow, Total Revenue, `computeRevenueAsOf`, `doneOverflow`), feat-016 (křivka se měří od dokončení, kombinace s overheadem), feat-012 (XLS import zakládá featury), feat-014 (výběr presetu regeneruje backlog).

## Research Basis
Model je **pedagogický, ne prediktivní**. Tvar křivek vychází z literatury, ale **konstanty (p, q, délka zpoždění, plató 2×) nejsou z ní kalibrované** a UI ani prezentace to nesmí tvrdit. 1 tik = 3 s je jen zhuštění času pro demonstraci. Citace jsou z OpenAlex k 9. 10. 2026.

| Profil | Opora | Co studie říká | Ověření |
|---|---|---|---|
| **S‑curve** | Bass (1969), *A New Product Growth Model for Consumer Durables*, Management Science 15(5) — [DOI](https://doi.org/10.1287/mnsc.15.5.215), ~6 100 citací (+ ~2 400 u dotisku 2004, [DOI](https://doi.org/10.1287/mnsc.1040.0264)) | Růst kumulativní adopce je S‑křivka řízená inovátory a napodobiteli, ověřeno na 11 spotřebních výrobcích. | Abstrakt čten (z reprodukce), rovnice potvrzena |
| **S‑curve** | Bhattacherjee (2001), *Understanding Information Systems Continuance*, MIS Quarterly 25(3) — [DOI](https://doi.org/10.2307/3250921), ~8 700 citací | Pokračování v používání po adopci závisí na spokojenosti po prvním použití. Opora pro to, že hodnota přichází s užíváním, ne okamžitě po dodání. | Z paměti, nečteno |
| **J‑curve** | Brynjolfsson & Hitt (2003), *Computing Productivity: Firm‑Level Evidence*, Review of Economics and Statistics — [DOI](https://doi.org/10.1162/003465303772815736), ~1 460 citací | U 527 velkých firem (1987–1994) je přínos počítačů v ročních rozdílech „normální“, ale v rozdílech za 5–7 let **až 5× větší** (doplňkové organizační investice trvají dlouho). | Abstrakt čten |
| **J‑curve** | Brynjolfsson, Rock & Syverson (2021), *The Productivity J‑Curve*, AEJ: Macroeconomics — [DOI](https://doi.org/10.1257/mac.20180386), ~690 citací | Obecné technologie se zpočátku neprojeví v produktivitě, protože potřebují nehmotné doplňkové investice; pak výnos zrychlí. | Z paměti, nečteno |
| **J‑curve** | Jasperson, Carter & Zmud (2005), *A Comprehensive Conceptualization of Post‑Adoptive Behaviors…*, MIS Quarterly 29(3) — [DOI](https://doi.org/10.2307/25148694), ~950 citací | Po adopci se IT funkce dál rozšiřují a využívají jinak než zpočátku. | Rozlišení „feature extension“ neověřeno |

**Co se z literatury nepřenáší 1:1 (poctivé limity):**
- Brynjolfsson & Hitt měří produktivitu **firem** po investici do počítačů, ne výnos jedné softwarové featury. Dopad „až 5×“ je horní odhad za 5–7 let. Plató 2× je záměrně opatrnější pedagogická volba.
- J‑křivka v literatuře obsahuje **propad** (dočasně nižší nebo záporný výkon). Tato feature ho vynechává (výnos musí zůstat > 0, viz feat-015), takže je to „zpoždění + vyšší plató“.
- Bass popisuje **kumulativní adopci**. Použít ji jako multiplikátor výnosu za tik předpokládá, že výnos je úměrný počtu adoptujících (předplatné, používání featury); u jednorázových prodejů by byl výnos „kopec“.
- **Před veřejnou citací** (README, prezentace, UI) ověřit v originálech zejména Bhattacherjeeho, Brynjolfssona a kol. (2021) a Jaspersona a kol.

**Pro budoucí přírůstky (zatím neimplementováno):**
- Front‑loaded / novelty (hodnota je největší hned po dodání a klesá): Thompson, Hamilton & Rust (2005), *Feature Fatigue*, JMR — [DOI](https://doi.org/10.1509/jmkr.2005.42.4.431); Kohavi a kol. (2012), *Trustworthy online controlled experiments*, KDD — [DOI](https://doi.org/10.1145/2339530.2339653); Hohnhold, O'Brien & Tang (2015), *Focusing on the Long‑term*, KDD — [DOI](https://doi.org/10.1145/2783258.2788583) (krátkodobý efekt není vždy prediktorem dlouhodobého, abstrakt čten).
- Nákladová strana (každá další featura je dražší): Lehman (1980), [DOI](https://doi.org/10.1109/proc.1980.11805); Eick a kol. (2001), *Does Code Decay?*, IEEE TSE, [DOI](https://doi.org/10.1109/32.895984) (abstrakt čten); Neamtiu a kol. (2011), [DOI](https://doi.org/10.1002/smr.564).

## Open Questions
- **Horizont běhu.** J‑curve dožene Flat v kumulativním výnosu až po 11 tiku (33 s). Příklady ve feat-015 mají běhy 30–60 s, takže při kratším běhu může J‑curve na konci vycházet pod Flat, a S‑curve je pod Flat vždy. Řešení: (a) ponechat (je to pedagogický bod: pozdní návratnost potřebuje čas), (b) zrychlit J‑curve (menší `J_MIDPOINT_TICK`), (c) přidat „Projected revenue @ +N ticků“, které `computeRevenueAsOf` umožňuje bez běhu simulace, ale vyžádalo by si úpravu feat-015.
- **Konstanty** (p = 0.05, q = 0.6; J: start 0.2, plató 2.0, střed 6.5, strmost 0.9) jsou ilustrativní výchozí hodnoty; doladit po vyzkoušení v prohlížeči.
- ~~Mini‑graf na kartě~~ → rozhodnuto ve fázi 3: tvar se ukazuje jen jedním náhledem pod přepínačem v nastavení, na kartách není.
- **Chování po dokončení:** přepnutí po doběhnutém běhu proběhne bez dialogu a uloží běh jako předchozí; potvrdit, že tato asymetrie (dialog jen během běhu) je žádoucí.
