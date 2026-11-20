# Feature: Úpravy týmů a lidí (mód Organization, inkrement 3)

## Status
done

*Inkrement 3 z 9 módu Organization (Týmy složené z lidí). Vznikl rozdělením feat-028 podle INVEST a SPIDR 2026-11-12 a závisí jen na inkrementu 1 ([feat-028](feat-028-tymy-slozene-z-lidi.md), v main od PR #44). Inkrement 2 ([feat-029](feat-029-proc-prace-ceka.md)) je v main od PR #46; tento spec s jeho pohledem za běhu počítá. Spec je schválený 2026-11-13 včetně rozhodnutí o jménech `Person N` a `Team N`, odebrání týmu bez lidí bez potvrzení, Esc v názvu týmu, pořadí skillů a Expand all za běhu. Inkrement je hotový: implementace je v main (PR #48) a smoke test produkce prošel. UI kontrakt je mockup [`docs/feat-028-ui-mockup.html`](../docs/feat-028-ui-mockup.html) (verze 9), scénáře jsou v [`docs/feat-028-test-analysis.md`](../docs/feat-028-test-analysis.md) a koncept testů v [`docs/feat-028-test-drafts/`](../docs/feat-028-test-drafts/README.md).*

## Problem
V inkrementech 1 a 2 je organizace pevná: tři týmy po čtyřech lidech a kouč mění jen mandáty. Nemůže postavit organizaci podobnou té klientově (jiný počet týmů, jiní lidé, jiné skilly), přesunout člověka do jiného týmu ani ukázat, co se stane, když týmu s mandátem chybí skill. Engine už dnes počítá s libovolnými týmy a lidmi, chybí jen úpravy v panelu a kontrola, která pozná chybějící skill dřív, než se běh zasekne.

## User Story
Jako agilní kouč chci přidávat, odebírat a přejmenovávat týmy, přidávat a odebírat lidi, měnit jejich skilly a přesouvat je mezi týmy, abych na workshopu postavil organizaci podobnou té klientově a ukázal, jak její skilly a mandáty ovlivní tok práce.

## Prior Art
Research: hluboký (2026-11-10) — [`docs/feat-028-research.md`](../docs/feat-028-research.md), společný pro všechny inkrementy módu Organization. Pro tento inkrement platí hlavně Runn a TeamForm: člověk má jeden domovský tým a tým je rozbalitelná skupina lidí. Nic dalšího.

## UI / Design
Všechny texty v UI jsou anglicky, desetinná tečka, písmo a barvy jen z tokenů design systému (feat-021 až feat-023). Úpravy jsou jen v panelu **Organization** (prostřední sloupec). Ostatní sloupce se mění jen tím, že ukazují nové názvy týmů (detail backlogu `Mandate: Mobile Apple`, tooltipy z feat-029).

### Panel organizace před během
Sloupce **Team | People | Mandate** zůstávají jako v inkrementu 1.

**Hlavička:**
- vlevo `Organization` a počet `3 teams · 12 people` (jednotné číslo `1 team`, `1 person`),
- vpravo odkaz `Expand all` / `Collapse all` (viz níže),
- pod hlavičkou poznámka `Click + to add a mandate or a skill` (dnes `Click + to add a mandate`).

**Řádek týmu:**
- šipka pro rozbalení lidí jako dnes,
- **název je pole** `Team name` (aria-label), které vypadá jako text a při najetí ukáže rámeček (mockup v9, `.tname`):
  - Enter nebo opuštění pole název uloží,
  - okolní mezery se ořežou,
  - prázdný název (i jen z mezer) se neuloží a pole ukáže původní název,
  - shodné názvy více týmů jsou povolené,
  - Esc zruší rozepsanou změnu a vrátí původní název,
- tečky skillů, počet lidí `4 people` (`1 person`, `0 people`) a mandáty jako v inkrementu 1,
- **× na konci řádku** (aria-label `Remove Team Web`, title `Remove team`).

**Odebrání týmu:**
- Tým s lidmi: pod řádkem se objeví potvrzení `Remove Team Web? 4 people will be removed.` (`1 person will be removed.`) s tlačítky `Remove` a `Cancel`, ve stejném stylu jako potvrzení smazání skillu v Settings (`RoleSettings`). Fokus přejde na `Cancel` a Esc znamená Cancel. `Remove` odebere tým i s jeho lidmi.
- Tým bez lidí se odebere hned, bez potvrzení.
- Odebrat jde i poslední tým. Panel pak ukáže `0 teams · 0 people`, varování a `+ Add team`.

**`+ Add team`** je čárkované tlačítko přes šířku panelu pod posledním týmem (mockup v9, `.addteam`):
- na konec přidá tým `Team 4` bez lidí a bez mandátu (červené `No mandate`), rozbalený,
- fokus přejde do pole názvu nového týmu s označeným textem, takže kouč může rovnou psát nový název.

**Rozbalený tým** ukáže karty lidí k úpravě (mockup v9, `personCard` před během):
- **karta člověka:**
  - nahoře jméno a vpravo `⋯` (aria-label `Person actions`, title `Move to another team or remove`),
  - pod jménem čipy skillů v pořadí, v jakém je člověk dostal; každý čip má × (aria-label `Remove skill Java`, title `Remove skill`),
  - za čipy `+` (aria-label a title `Add skill`); člověk bez skillů má jen `+`,
- **`+ Add person`** je čárkované tlačítko pod kartami. Přidá na konec týmu člověka bez skillů (jméno viz Pravidla).

**Nabídky:**
- **Add skill** se otevře pod kartou. Ukáže skilly, které člověku chybí, jako barevné čipy v pořadí editoru skillů (`Product`, `Java`, `QA`). Výběr přidá skill na konec čipů člověka a nabídku zavře. Když nic nechybí, nabídka ukáže jen text `Has every skill`. Zavírá se tlačítkem `×` (aria-label `Close`).
- **Person actions** má položky `Move to Team Billing`, `Move to Team Web` (ostatní týmy v pořadí panelu) a `Remove person`. S jediným týmem má jen `Remove person`.
- Všechny nabídky panelu (mandát, skill, akce člověka) se ovládají jako nabídka mandátů z inkrementu 1 (role menu):
  - po otevření je fokus na první položce,
  - šipky přesouvají fokus dokola,
  - Esc nabídku zavře a vrátí fokus na tlačítko, které ji otevřelo.
- V panelu je otevřená nejvýš jedna nabídka nebo jedno potvrzení. Otevření další předchozí zavře.

### Expand all / Collapse all
- Odkaz v hlavičce panelu ukazuje `Expand all`, když je aspoň jeden tým sbalený, jinak `Collapse all`. Klik rozbalí nebo sbalí všechny týmy.
- Šipka u týmu přepíná jen svůj tým.
- Odkaz funguje před během, za běhu i po doběhnutí, protože je to jen pohled. Bez týmů se neukazuje.
- Po otevření módu jsou týmy sbalené jako dnes; nově přidaný tým je rozbalený.

### Panel organizace za běhu a po doběhnutí
- Název týmu je text, ne pole.
- Chybí `×` u týmu, `+ Add team`, `+ Add person`, `⋯`, `+` a `×` u skillů. Otevřená nabídka nebo potvrzení se po kliknutí na Run zavře (I1).
- **Tým bez lidí** (E6) ukazuje `0/0`, prázdný pruh lidí a ve sloupci Working on `—`.
- **Člověk bez skillů** má za běhu šedé `Idle` a nemá čipy.
- Hlavička a ostatní zobrazení zůstávají jako ve feat-029.

### Dlouhé názvy (J4)
- Název týmu (v poli před během i jako text za běhu), názvy týmů v položkách `Move to …` a názvy oblastí v nabídce mandátů se zkracují výpustkou.
- Plný název je v `title`, jen když je text opravdu zkrácený (`useIsTruncated`, stejně jako feat-023).
- Panel organizace nemá vodorovné rolování.

## Pravidla chování
Vychází z pravidel R6, R7, R11 a R13 v [`docs/feat-028-test-analysis.md`](../docs/feat-028-test-analysis.md). Přidělování práce, fáze, Reduce WIP, Idle Time, waiting, Reset a srovnání s předchozím během zůstávají jako v inkrementech 1 a 2.

**Týmy a lidé:**
- **Pořadí v panelu je pořadí přidělování** (týmy shora dolů, lidé v týmu shora dolů). Nový tým je dole, nový člověk na konci svého týmu a přesunutý člověk na konci cílového týmu. V okamžiku, kdy je volných víc lidí, proto dostanou práci jako poslední.
- **Název týmu (R6):** okolní mezery se ořežou, prázdný název se neuloží, shodné názvy jsou povolené. Délka není omezená, zobrazení řeší výpustka.
- **Nový tým** se jmenuje `Team N`, kde N je počet týmů po přidání. Když už tým s tímto názvem existuje, N se zvyšuje, dokud není název volný. Nemá lidi ani mandát.
- **Nový člověk** se jmenuje `Person N`, kde N je počet lidí v celé organizaci po přidání. Při shodě s existujícím jménem se N zvyšuje stejně jako u týmu. Nemá skilly. Ve výchozí organizaci s 12 lidmi je první přidaný `Person 13`.
- **Člověk patří právě jednomu týmu.** Přesun ho přesune i se skilly a od té chvíle pro něj platí mandáty nového týmu (B11, J8).
- **Odebraný tým** zmizí i se svými lidmi. Odebraný člověk zmizí z organizace.
- **Skilly člověka:** každý skill má člověk nejvýš jednou. Nový skill se přidá na konec čipů. Člověk může zůstat bez skillů.
- **Člověk bez skillů** nikdy nedostane úkol a jeho idle čas zůstane 0 (R1 počítá idle jen lidem se skillem, D13).
- **Tým bez lidí** nikdy nedostane práci. Run nezablokuje, pokud jeho oblasti pokryjí jiné týmy (C7, E6).

**Kontrola před během (R7, rozšířená):**
- Pro každou oblast použitou v backlogu, v pořadí oblastí, je nejvýš jedno varování:
  - žádný tým nemá mandát na oblast: `No team has a mandate for WEB` (jako v inkrementu 1),
  - jinak: skilly, které úkoly v oblasti potřebují a které v týmech s mandátem na oblast nemá nikdo: `No one with QA can work in BIL`.
- Víc chybějících skillů jedné oblasti je v jednom řádku, v pořadí editoru skillů a s jejich aktuálními názvy:
  - dva skilly: `No one with Frontend or QA can work in BIL`,
  - tři a víc: `No one with Java, Frontend or QA can work in BIL`.
- Skill u člověka v týmu bez mandátu na oblast se nepočítá (C3).
- Varování nevyvolá oblast, kterou backlog nepoužívá, ani tým bez mandátu a bez lidí (C7).
- Kontrola reaguje hned na každou úpravu: mandát, skill, člověk, tým (C9).
- **Proč to stačí:** když kontrola projde, má každý úkol backlogu aspoň jednoho člověka, který ho smí vzít. Fáze se v oblasti odemykají postupně, takže běh vždy doběhne. Engine proto nepotřebuje detekci zaseknutí.

**Zamčení, Reset a ukládání:**
- **R11:** názvy týmů, týmy, lidé a jejich skilly se mění jen před během, stejně jako mandáty. Od prvního Run (i v pauze a po doběhnutí) jsou zamčené až do Resetu.
- **Reset** vrátí backlog a nechá organizaci se všemi úpravami. Srovnání `vs prev run` funguje po úpravách týmů a lidí stejně jako po změně mandátů.
- **R13:** organizace se neukládá mezi načteními stránky. Po obnovení je zase výchozí.

## Specification by Example
Příklady pokrývají všech 17 scénářů inkrementu 3 z testovací analýzy (B6–B11, B22, C3, C5, C7, C9, C10, D13, E6, J3, J4, J8). Čísla běhu ověřila simulace pravidel inkrementů 1 a 2 (krok 0.01 dne). Varování nad výchozím backlogem ověřil prototyp rozšířené kontroly nad skutečným generátorem (seed 42). J3 se změřil na skutečném enginu.

Testovací data jsou z analýzy:
- **ORG-DEF**: výchozí organizace 3 × 4 lidé (feat-028):
  - Team Billing (BIL): Ada Product, Ben Java, Cyril Frontend, Chen QA,
  - Team Mobile (MOB): Dani Product, Emil Java, Eli Frontend, Fae QA,
  - Team Web (WEB): Gus Product, Hugo Java, Hana Frontend, Ivo QA.
- **ORG-T**:
  - Team Billing (BIL): Ada Product, Ben Java, Chen QA,
  - Team Mobile (MOB): Dani Product, Eli Frontend, Fae QA,
  - Team Web (WEB): Gus Java + Product, Hana Frontend, Ivo QA.
- **Výchozí backlog** (seed 42) používá ve všech třech oblastech všechny čtyři skilly.

Zápis `F-1 (p1): BIL [Java 1] | WEB [Frontend 3]` znamená featuru s prioritou 1, v oblasti BIL úkol Java (1 den) a v oblasti WEB úkol Frontend (3 dny). Featura se na obrazovce píše `F-001`. Čas je v pracovních dnech.

**Příklad 1: Přejmenování týmu** *(B6, B7)*
- Given: ORG-DEF, stav před během
- When: kouč klikne do názvu `Team Mobile`, přepíše ho na `  Mobile Apple ` a stiskne Enter
- Then:
  - tým se jmenuje `Mobile Apple`,
  - rozbalená položka backlogu s oblastí MOB ukazuje `Mandate: Mobile Apple`,
  - po Run je v řádku týmu za běhu `Mobile Apple`
- When: kouč smaže název `Team Web` a opustí pole
- Then: tým se dál jmenuje `Team Web`
- When: přejmenuje Team Web na `Team Mobile`
- Then: název se uloží a v panelu jsou dva týmy `Team Mobile`
- When: v poli rozepíše `Portal` a stiskne Esc
- Then: pole ukazuje zase `Team Mobile`

**Příklad 2: Přidání a odebrání týmu** *(B8, C7)*
- Given: ORG-DEF, výchozí backlog, stav před během
- When: kouč klikne na `+ Add team`
- Then:
  - na konci je rozbalený tým `Team 4` s `0 people` a červeným `No mandate`,
  - fokus je v poli jeho názvu s označeným textem,
  - hlavička ukazuje `4 teams · 12 people`,
  - žádné varování, Run zůstane aktivní
- When: klikne na × u Team 4
- Then: Team 4 zmizí hned, bez potvrzení
- When: klikne na × u Team Web
- Then: pod řádkem je `Remove Team Web? 4 people will be removed.` s tlačítky `Remove` a `Cancel`
- When: klikne na `Cancel`
- Then: Team Web zůstane
- When: znovu klikne na × u Team Web a potvrdí `Remove`
- Then:
  - Team Web zmizí i s lidmi, hlavička ukazuje `2 teams · 8 people`,
  - varování `No team has a mandate for WEB`,
  - Run je neaktivní

**Příklad 3: Přidání a odebrání člověka** *(B9)*
- Given: ORG-DEF, Team Web rozbalený
- When: kouč klikne na `+ Add person`
- Then: na konci Team Web je `Person 13` bez čipů, jen s `+`; řádek týmu ukazuje `5 people`
- When: u Person 13 otevře `⋯` a zvolí `Remove person`
- Then: Person 13 zmizí a Team Web má `4 people`

**Příklad 4: Skilly člověka a okamžitá kontrola** *(B10, C9)*
- Given: ORG-DEF, Team Web rozbalený
- When: kouč klikne na `+` na kartě Hany
- Then: nabídka ukáže `Product`, `Java`, `QA`
- When: vybere `Java`
- Then: Hana má čipy `Frontend` a `Java` v tomto pořadí
- When: přidá Haně i `Product` a `QA` a znovu klikne na `+`
- Then: nabídka ukáže jen `Has every skill`
- When: klikne na × u `Java`
- Then: Hana nemá Javu, ostatní skilly jí zůstanou
- Given: ORG-DEF, výchozí backlog, Run aktivní
- When: kouč u Chena klikne na × u `QA`
- Then: hned se objeví varování `No one with QA can work in BIL` a Run je neaktivní, přestože QA mají Fae a Ivo

**Příklad 5: Přesun člověka** *(B11)*
- Given: ORG-DEF, výchozí backlog, Team Mobile a Team Web rozbalené
- When: kouč u Eli otevře `⋯`
- Then: nabídka má `Move to Team Billing`, `Move to Team Web` a `Remove person`
- When: zvolí `Move to Team Web`
- Then:
  - Eli je posledním člověkem Team Web (Gus, Hugo, Hana, Ivo, Eli) a má dál čip `Frontend`,
  - Team Mobile ukazuje `3 people`, Team Web `5 people`,
  - varování `No one with Frontend can work in MOB` a Run je neaktivní

**Příklad 6: Přesunutý člověk bere práci podle nového týmu** *(J8)*
- Given: ORG-T, Eli se před během přesune do Team Web (na konec, za Ivo); backlog `F-1 (p1): BIL [Java 1] | WEB [Frontend 3]`, `F-2 (p2): BIL [Java 1] | WEB [Frontend 3]` (data D2 z feat-028, Př. 4)
- When: běh do konce
- Then:
  - 0.0: Ben vezme F-1 Java (0.0–1.0), Hana F-1 Frontend (0.0–3.0) a Eli F-2 Frontend (0.0–3.0); F-2 začne v 0.0,
  - 1.0: Ben vezme F-2 Java (1.0–2.0),
  - F-1 i F-2 jsou hotové v 3.0, cycle time obou 3.0 d,
  - Total Time `3.0 days`, Avg Cycle Time `3.0 days`, Avg WIP `2.0`, Idle Time `1.0 days` (Gus 0.0–1.0, Java ve F-2 čeká na Bena)

**Příklad 7: Člověk bez skillů** *(D13)*
- Given: ORG-T a v Team Web na konci Petr bez skillů; backlog `F-1 (p1): WEB [Frontend 3]`
- When: kouč se před během podívá na rozbalený Team Web
- Then: Petrova karta má jen `+`; tečky skillů týmu se nezmění
- When: běh do konce
- Then:
  - Hana zpracuje Frontend 0.0–3.0, Petr nedostane úkol,
  - za běhu má Petr šedé `Idle`,
  - Idle Time `0.0 days` (Petr nemá skill, Eli nemá otevřený úkol se svým skillem)

**Příklad 8: Chybí skill v týmech s mandátem** *(C3, C5, C10)*
- Given: ORG-T, Chen nemá QA
- When: backlog je `F-1 (p1): BIL [QA 2]`
- Then: jediné varování `No one with QA can work in BIL`, přestože QA mají Fae a Ivo v týmech bez mandátu na BIL; Run je neaktivní
- When: backlog je `F-1 (p1): BIL [Frontend 2 · QA 2]`
- Then: jediné varování `No one with Frontend or QA can work in BIL`
- When: navíc Team Web nemá mandát WEB a backlog je `F-1: WEB [Frontend 3]`, `F-2: BIL [QA 2]`
- Then: dvě varování v pořadí oblastí, ne backlogu: `No one with QA can work in BIL`, `No team has a mandate for WEB`
- Given: ORG-DEF, výchozí backlog
- When: kouč odebere z Team Billing Bena, Cyrila a Chena (zůstane Ada)
- Then: jediné varování `No one with Java, Frontend or QA can work in BIL`

**Příklad 9: Tým bez lidí za běhu** *(E6, C7)*
- Given: ORG-DEF a navíc `Team 4` bez lidí s mandátem BIL; backlog `F-1 (p1): BIL [Java 2]`
- When: proběhne kontrola před během
- Then: žádné varování, Run je aktivní (BIL pokrývá Team Billing)
- When: čas 0.5
- Then:
  - řádek Team 4 ukazuje `0/0`, prázdný pruh lidí a ve Working on `—`,
  - Team Billing ukazuje `1/4` a štítek `F-001` (Ben),
  - F-1 je hotová v 2.0

**Příklad 10: Sbalení a rozbalení týmů** *(B22)*
- Given: ORG-DEF, všechny týmy sbalené
- When: kouč klikne na `Expand all`
- Then: všechny týmy ukážou lidi a odkaz ukazuje `Collapse all`
- When: klikne na šipku u Team Mobile
- Then: sbalí se jen Team Mobile, Team Billing a Team Web zůstanou rozbalené a odkaz ukazuje `Expand all`
- When: spustí Run a klikne na `Expand all`
- Then: za běhu se rozbalí všechny týmy (pohled nepatří k zamčení)

**Příklad 11: Zamčení úprav** *(část I1 z feat-028)*
- Given: ORG-DEF, u Hany je otevřená nabídka `Add skill`
- When: kouč klikne na Run
- Then:
  - nabídka se zavře,
  - názvy týmů jsou text, ne pole,
  - nejsou vidět `+ Add team`, `+ Add person`, `×` u týmů, `⋯` ani `+` a `×` u skillů,
  - stejně v pauze a po doběhnutí, až do Resetu
- When: běh doběhne a kouč klikne na Reset
- Then: úpravy jdou zase dělat a organizace je stejná jako před během

**Příklad 12: Dlouhé názvy** *(J4)*
- Given: tým `Customer Experience and Onboarding Squad` (40 znaků) a oblast s 40znakovým názvem
- When: kouč se podívá na panel organizace před během, na nabídku mandátů, na `⋯` u člověka z jiného týmu a na panel za běhu
- Then: dlouhé názvy jsou zkrácené výpustkou s plným názvem v `title`; krátké názvy (`Team Billing`) `title` nemají; panel nemá vodorovné rolování

**Příklad 13: Velká organizace** *(J3)*
- Given: 15 týmů po 6 lidech (skilly Product, Java, Frontend, QA, Java, QA), 8 oblastí, prvních 8 týmů s mandátem na jednu oblast, dalších 7 na dvě; 100 featur, seed 1
- When: headless běh enginu do konce s `dt = 0.1`
- Then: kontrola nemá varování, všech 100 featur je hotových, běh doběhne do 2 s strojového času a dva běhy se stejným seedem dají stejné metriky

## Out of Scope
Přijde v dalších inkrementech:
- **AI na skillech lidí** (feat-035): tlačítko AI na čipu, souhrn ⚡ v řádku týmu a části B10 a B11 o AI (čip `Frontend AI ×`, přesun i s AI 2×).
- **Vlastní skilly a oblasti** (feat-036): editory, smazání skillu nebo oblasti a varování `Backlog is empty`. V tomto inkrementu jsou skilly a oblasti pevné.
- **Timeline** (feat-034): nový název týmu v `done by Mobile Apple` z B6.
- **Settings → Backlog** (feat-031) a **Min units** (feat-032).

Mimo tento inkrement:
- **Přejmenování lidí.** Nový člověk dostane jméno `Person N`. Mockup jméno člověka upravovat nenabízí a pro strukturu organizace není potřeba.
- **Změna pořadí týmů a lidí** (přetahování). Přesun jde jen na konec jiného týmu.
- **Avatar s iniciálou** na kartě člověka z mockupu. Karty zůstanou jako v inkrementech 1 a 2.
- **Duplikace týmu, hromadné úpravy a vrácení odebrání** (undo).
- **Limit počtu týmů a lidí.** Výkon je ověřený pro 15 týmů po 6 lidech (J3).
- Všechno, co je mimo celou feature podle feat-028: uložení organizace, preset velké organizace, import z Excelu, seskupování týmů, změny za běhu, částečné alokace.

## Technical Notes
- **Čisté úpravy organizace** v `src/simulation/organizationSetup.ts` (vedle `addMandate` a `removeMandate`). Každá vrací novou organizaci a vstup nemění:
  - `renameTeam(setup, teamId, name)`: ořízne mezery, prázdný název nechá původní,
  - `addTeam(setup)` → nová organizace a id nového týmu (UI ho rozbalí a dá fokus do názvu). Id je největší id týmu + 1, název `Team N`,
  - `removeTeam(setup, teamId)`,
  - `addPerson(setup, teamId)`: id je největší id člověka v organizaci + 1, jméno `Person N`, bez skillů,
  - `removePerson(setup, personId)`,
  - `movePerson(setup, personId, toTeamId)`: na konec cílového týmu; přesun do vlastního týmu nic nemění,
  - `addPersonSkill(setup, personId, role)` (na konec, bez duplicit) a `removePersonSkill(setup, personId, role)`.
- **Kontrola** `validateOrgSetup` v `organizationEngine.ts`: po oblastech jako v mockupu v9 (`validate()`), skilly v pořadí klíčů `roleConfig` a s `label`. Pokryje každou dvojici oblast + skill z backlogu, takže poznámka z review inkrementu 1 (běh, který se nikdy nezastaví) je vyřešená bez detekce zaseknutí v enginu.
- **Engine běhu** se nemění: člověk bez skillů, tým bez lidí i libovolný počet týmů už fungují (D13 a E6 ověřené simulací). Typy v `src/types/organization.ts` se nemění (pole pro AI přidá feat-035).
- **Výkon (J3):** dnešní engine na scénáři J3 doběhl za 62–93 ms (`dt = 0.1`, 300 kroků) a za ~200 ms (`dt = 0.01`). Krok s `orgFlowView` při 1× trvá ~75 µs (měřeno 2026-11-13 na vývojovém počítači). Indexace hledání práce podle skillu a oblasti proto není potřeba. Práh 2 s v testu zůstává jako pojistka.
- **UI** (`src/components/OrganizationView.tsx` a `OrganizationView.module.css`):
  - `SetupTeamRow`: pole názvu, × týmu a vložené potvrzení, karty lidí s čipy (×) a `+`, `⋯`, `+ Add person`,
  - `OrganizationPanel`: `Expand all` / `Collapse all` v `PanelHeader` (actions), `+ Add team` a jeden stav otevřené nabídky nebo potvrzení pro celý panel (druh + id) místo dnešního `menuTeamId`. Stejně jako dnes se při zamčení zavře,
  - nabídky sdílí jedno ovládání klávesnicí. Vhodné je vytáhnout dnešní nabídku mandátů do malé komponenty, kterou použijí všechny tři,
  - po `addTeam` přidat nový tým do rozbalených a fokus s označeným textem dát do jeho pole. Id odebraných týmů z rozbalených odebrat,
  - čip skillu s × (dnešní `RoleChip` je jen ke čtení, potřebuje variantu s tlačítkem nebo obal),
  - `RunTeamRow`: `—` ve Working on i pro tým bez lidí,
  - zkracování přes `useIsTruncated` (pole názvu měří `value`),
  - barvy jen z tokenů (J10), pravidlo 1024 px z feat-021 (J9) platí i pro delší seznam týmů (panel roluje svisle).
- **`Simulator.tsx`:** `handleOrgSetupChange` už novou organizaci propíše do stavu, který ještě nezačal. Jiná změna se nečeká.
- **Testy (fáze TDD):** z `docs/feat-028-test-drafts/` se vezmou bloky B6–B11, B22, C3, C5, C7, C9, C10, D13, E6, J3, J4, J8 a v I1 části o názvu týmu, `+ Add team`, `+ Add person` a × u skillů. Upraví se na současný kód:
  - bez AI v B10, B11 a `movePerson` (`aiBySkill` přijde s feat-035),
  - bez timeline v B6,
  - C4, C8 a C11 zůstanou pro feat-036 a feat-031,
  - `generateOrgBacklog` se třemi argumenty (bez profilu výnosu),
  - props `OrganizationView` bez nastavení backlogu a výnosů,
  - klíče skillů v aplikaci jsou `PRODUCT`, `JAVA`, … (fixtures používají názvy),
  - nově: Esc v názvu týmu, odebrání týmu bez lidí bez potvrzení, `Person 13`, fokus po `+ Add team`, `Has every skill`, jediná otevřená nabídka, Expand all za běhu.
- **Závislosti:** feat-028 (inkrement 1). S feat-029 počítá jen pohled za běhu (`0/0`, šedé `Idle` člověka bez skillů).

## Open Questions
—
