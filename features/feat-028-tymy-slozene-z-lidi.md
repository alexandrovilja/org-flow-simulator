# Feature: Týmy složené z lidí — inkrement 1: mandáty a tok práce

## Status
in-progress

*2026-11-12: celá feature „Týmy složené z lidí“ (spec schválený 2026-11-11) se podle INVEST a SPIDR rozdělila na 9 inkrementů, viz „Plán inkrementů“. Tento spec popisuje jen inkrement 1; zúžený spec i jeho testy jsou schválené (2026-11-12) a implementace inkrementu 1 je hotová, čeká na review. Research, mockup v9 a testovací analýza zůstávají společné pro všechny inkrementy.*

## Plán inkrementů
Každý inkrement přidá kouči jednu schopnost, kterou může ukázat na workshopu. Inkrementy 2–9 závisí jen na inkrementu 1, mezi sebou ne, takže jejich pořadí jde měnit.

| # | Spec | Co kouč nově ukáže | SPIDR |
|---|---|---|---|
| 1 | **feat-028** (tento) | Výchozí organizace 3 × 4 lidé. Změní mandáty, spustí běh a porovná cycle time, WIP a celkový čas s předchozím během. | Paths (jen Reduce WIP), Data (pevná organizace, skilly, oblasti a backlog) |
| 2 | [feat-029 Proč práce čeká](feat-029-proc-prace-ceka.md) | Waiting, žlutý idle, Idle Time, kdo na čem dělá, filtr, skok na featuru, detail backlogu s mandáty | Interfaces, Rules |
| 3 | [feat-030 Úpravy týmů a lidí](feat-030-upravy-tymu-a-lidi.md) | Vlastní týmy a lidé se skilly, kontrola chybějících skillů, velká organizace | Data, Rules |
| 4 | [feat-031 Nastavení backlogu](feat-031-nastaveni-backlogu-organizace.md) | Velikost backlogu, posuvníky min–max, Generate new backlog | Data |
| 5 | [feat-032 Min units po týmech](feat-032-min-units-po-tymech.md) | Druhé pravidlo výběru práce | Paths |
| 6 | [feat-033 Výnosy](feat-033-vynosy-organizace.md) | Výnos featur, profil křivky, Revenue (time-matched) | Rules, Data |
| 7 | [feat-034 Timeline hotové featury](feat-034-timeline-hotove-featury.md) | Průběh zpracování po oblastech a týmech | Interfaces |
| 8 | [feat-035 AI na skillech lidí](feat-035-ai-na-skillech-lidi.md) | Zrychlení u dvojice člověk + skill | Data |
| 9 | [feat-036 Vlastní skilly a oblasti](feat-036-vlastni-skilly-a-oblasti.md) | Editory skillů a oblastí, povinné skilly (Req.), fáze 1–10 ve všech módech | Data, Rules |

Spike není potřeba: nejistotu vyřešily research, mockup a testovací analýza. Rozdělení všech 107 scénářů do inkrementů je v [`docs/feat-028-test-analysis.md`](../docs/feat-028-test-analysis.md), sekce „Rozdělení do inkrementů“.

## Problem
„Chceme simulovat opravdu komplexní situaci a zkoumat, jak se změny mandátů budou projevovat na výsledcích.“

Dnes je pracovní jednotkou simulátoru buď člověk (Advanced, Cash Flow), nebo celý tým s kapacitou jednoho úkolu (Compare), nikdy obojí zároveň. Skill navíc říká, co jednotka umí, i to, na čem smí pracovat. Kouč proto nemůže ukázat situaci, kterou management řeší nejčastěji: organizaci z několika týmů lidí, kde člověk práci umí, ale jeho tým na ni nemá mandát. Nejde ani ukázat, co se stane s tokem práce celé organizace, když se mandáty týmů změní a lidé a backlog zůstanou stejní.

Nový mód **Organization** to řeší:
- organizace se skládá z týmů a týmy z lidí,
- **skill** (co člověk umí) patří člověku,
- **mandát** (do kterých oblastí produktu nebo systému smí tým zasahovat) patří týmu,
- featura zasahuje do jedné nebo více oblastí a v každé oblasti má úkoly pro konkrétní skilly.

Inkrement 1 je nejtenčí průchod celou user story: kouč změní mandáty ve výchozí organizaci, spustí běh a uvidí rozdíl proti předchozímu běhu.

## User Story
Celá feature: Jako agilní kouč na workshopu s managementem chci postavit organizaci z několika týmů lidí s konkrétními skilly a měnit, do kterých oblastí (produktů nebo systémů) smí jednotlivé týmy zasahovat, abych ukázal, jak se změna mandátů projeví na cycle time a toku práce celé organizace.

Inkrement 1: Jako agilní kouč chci ve výchozí organizaci přidat nebo odebrat týmům mandáty a porovnat běh s předchozím během, abych ukázal, jak samotná změna mandátů při stejných lidech a stejném backlogu změní cycle time a tok práce.

## Prior Art
Research: hluboký (2026-11-10) — [`docs/feat-028-research.md`](../docs/feat-028-research.md)

| Produkt | Jak to řeší | Co si bereme / nebereme | Zdroj (URL, datum) |
|---|---|---|---|
| Virtual Design Team / SimVision (Stanford) | Simulace projektu, která drží zvlášť schopnost, odpovědnost a rozhodovací pravomoc; měří trvání projektu, ne cycle time položek | Bereme oddělení „umí“ a „smí“. Nebereme rozhodovací pravomoc, eskalace ani pravděpodobnostní matice | https://purl.stanford.edu/zv021dk0355 (2026-11-10) |
| GlassFrog / Team API (Team Topologies) | Mandát jako vlastnictví pojmenované domény nebo věci, kterou tým vlastní | Bereme mandát jako oblast produktu nebo systému přidělenou týmu. Nebereme governance procesy | https://www.holacracy.org/blog/holacracy-basics-understanding-domains/ (2026-11-10) |
| Runn, TeamForm | Člověk má jeden domovský tým, kapacita týmu je součet lidí, tým je rozbalitelná skupina se souhrnem | Bereme jeden domovský tým, kapacitu jako součet lidí a rozbalitelný řádek týmu. Nebereme částečné alokace (FTE, %) | https://help.runn.io/en/articles/4293043-people-planner-overview (2026-11-10) |
| Hry „component vs. feature teams“ (LeSS), getKanban | Mezi koly se změní jedno pravidlo organizace při stejném backlogu a výsledky se srovnají | Bereme experiment „stejný backlog i lidé, jiný mandát“ a srovnání s předchozím během. Nebereme změny za běhu | https://less.works/blog/2024/12/15/less-simulation-create-a-city-guide (2026-11-10) |
| Businessmap Kanban Flow Simulator | Tým jako tabulka rolí, „nesmí“ vyjádřené chybějící rolí nebo 0 % | Nebereme slučování skillu a mandátu, ani matici osoba × oblast jako hlavní ovládání | https://businessmap.io/kanban-simulation/ (2026-11-10) |

## UI / Design
UI kontrakt je schválený návrh [`docs/feat-028-ui-mockup.html`](../docs/feat-028-ui-mockup.html) (verze 9). Ukazuje cílový stav všech inkrementů; inkrement 1 z něj bere jen části popsané níže. Všechny texty v UI jsou anglicky, desetinná tečka, písmo a barvy z design systému (feat-021 až feat-023).

### Mód a ovládání běhu
- Nová záložka **Organization** v liště za Cash Flow.
- Ovládání běhu je stejné jako v ostatních módech: `?`, `↺ Reset`, rychlost `0.5× / 1× / 10×`, `▶ Run`.
- Run je neaktivní, dokud panel organizace ukazuje varování; tooltip neaktivního tlačítka je `Fix the warnings in the Organization panel first`.
- Ikona zpětné vazby (feat-024) je v liště i v tomto módu. Otevření dialogu pozastaví běh stejně jako Pause a dialog dostane název módu `Organization`.
- Rozložení má tři sloupce jako Cash Flow:
  - vlevo **Backlog**,
  - uprostřed **In progress** a **Organization**,
  - vpravo **Metrics** a **Done**.
- Sekce Settings v inkrementu 1 není (přibude s inkrementy 4, 5, 6 a 9).

### Výchozí stav (pevný v inkrementu 1)
- **Oblasti:** BIL Billing, MOB Mobile app, WEB Web portal.
- **Skilly:** Product (fáze 1), Java (2), Frontend (2), QA (3).
- **Organizace:** 3 týmy po 4 lidech, každý s mandátem na jednu oblast:
  - Team Billing (BIL): Ada Product, Ben Java, Cyril Frontend, Chen QA,
  - Team Mobile (MOB): Dani Product, Emil Java, Eli Frontend, Fae QA,
  - Team Web (WEB): Gus Product, Hugo Java, Hana Frontend, Ivo QA.
- **Backlog:** 100 featur vygenerovaných při otevření módu: 1–3 různé oblasti na featuru, v každé 1–3 různé skilly (každý skill je jeden úkol), pracnost 1–5 celých dní.
- Organizace se neukládá mezi načteními stránky.

### Označení featur
Featura se na obrazovce píše jako v ostatních módech, `F-001 Login flow`. Příklady níže používají kvůli čitelnosti zkrácený zápis `F-1`.

### Backlog (levý sloupec)
- Hlavička `Backlog` s počtem. Položky jsou seřazené podle priority.
- Položka ukazuje číslo a název featury, štítky oblastí a pruh pracnosti z barevných segmentů úkolů seskupených po oblastech. Šířka pruhu je poměrná k největší featuře.

### In progress (prostřední sloupec)
- Řádek featury má číslo, název a štítky oblastí; hotová oblast je zelená `✓ BIL`.
- Pod řádkem je pruh postupu přes celou šířku (hotová práce / celková práce).
- Prázdné stavy: `Nothing in flight.` / `All features are done.`

### Organization (prostřední sloupec)
Hlavička `Organization` s počtem `3 teams · 12 people`.

**Před během** (sloupce Team | People | Mandate):
- Řádek týmu: šipka pro rozbalení lidí, název, tečky skillů lidí, počet `4 people`, štítky mandátů `BIL ×` v pořadí oblastí (title = název oblasti) a tlačítko `+` s nabídkou zbývajících oblastí (`BIL Billing`). Když má tým všechny oblasti, `+` chybí. Tým bez mandátu ukazuje červené `No mandate`.
- Rozbalený tým ukáže lidi jen ke čtení: jméno a čipy skillů.
- Varování `Run is disabled` (role alert) se seznamem `No team has a mandate for WEB`, seřazeným podle oblastí.

**Za běhu** (jen ke čtení): řádek týmu s názvem, štítky mandátů a pruhem lidí `2/3` (pracuje / celkem). Hlavička ukazuje za běhu `Skills, AI and mandates are locked during the run` a po doběhnutí `Reset to change the organization`.

### Metrics a Done (pravý sloupec)
- Metrics ve formátu Cash Flow (`StatTile`):
  - `Total Time` (čítač `1 week 4.0 days`, zkratka `1w 4.0d` jen když se nevejde; po doběhnutí zelený `✓ Complete`),
  - `Avg Cycle Time` (`6.9 days`),
  - `Avg WIP`.
- Se srovnáním má každá dlaždice řádek `↓ 21% vs prev run`. Barva podle toho, zda je změna dobrá; bez změny `→ 0.0%` šedě.
- Done má nejnovější featuru nahoře; řádek ukazuje číslo, název a cycle time `7.0 d`.

### Pravidla chování
Úplná pravidla R1–R13 a testovací data jsou v [`docs/feat-028-test-analysis.md`](../docs/feat-028-test-analysis.md). Inkrement 1 používá tato:
- **Kdo smí vzít úkol:** člověk, který má skill úkolu a jehož tým má mandát na oblast úkolu. Člověk pracuje na jednom úkolu najednou.
- **Pořadí přidělování v jednom okamžiku:**
  - týmy shora dolů a lidé v týmu shora dolů podle panelu organizace,
  - ve featuře úkoly v pořadí oblastí a úkolů,
  - vyšší priorita má přednost.
- **Fáze** platí v rámci oblasti: úkol fáze N začne, až jsou v téže oblasti téže featury hotové úkoly nižších fází. Engine zvládne fáze 1–10; v editoru je půjde nastavit až v inkrementu 9.
- **Výběr práce:** Reduce WIP — rozpracované featury mají přednost před backlogem (Min units přijde v inkrementu 5).
- **Kontrola před během:** oblast použitá v backlogu bez týmu s mandátem zablokuje Run. Kontrola reaguje hned na každou změnu.
- **Zamčení:** mandáty se mění jen před během. Od prvního Run (i v pauze a po doběhnutí) jsou zamčené až do Resetu.
- **Reset a srovnání:**
  - Reset vrátí backlog do stavu před během a organizaci nechá beze změny,
  - poslední doběhnutý běh se po Resetu stane „předchozím“ jako v Cash Flow,
  - delty Avg Cycle Time a Avg WIP jsou vidět už za běhu, delta Total Time až po doběhnutí.
- Koordinační režie (feat-016) v tomto módu není.

## Specification by Example
Příklady shrnují scénáře inkrementu 1 z testovací analýzy (39 scénářů). Testovací data:
- **ORG-T**:
  - Team Billing (BIL): Ada Product, Ben Java, Chen QA,
  - Team Mobile (MOB): Dani Product, Eli Frontend, Fae QA,
  - Team Web (WEB): Gus Java + Product, Hana Frontend, Ivo QA.
- **ORG-B**: jen Team Billing z ORG-T.

Zápis `F-1 (p1): BIL [Java 1] | WEB [Frontend 3]` znamená featuru s prioritou 1, v oblasti BIL úkol Java (1 den), v oblasti WEB úkol Frontend (3 dny). Čas je v pracovních dnech.

**Příklad 1: Otevření módu** *(A1, A2, A4, A5)*
- Given: aplikace v módu Compare
- When: kouč klikne na záložku Organization
- Then:
  - panel organizace ukazuje 3 týmy po 4 lidech s mandáty BIL, MOB, WEB,
  - backlog má 100 featur seřazených podle priority, každá s 1–3 oblastmi a 1–3 různými skilly v oblasti,
  - Total Time je `0.0 days`, Done `No completed features yet.`,
  - Run je aktivní, protože výchozí backlog nemá varování,
  - po obnovení stránky je organizace zase výchozí.

**Příklad 2: Přidání mandátu** *(B1, B2, B3)*
- Given: výchozí organizace, stav před během
- When: kouč klikne na `+` v řádku Team Mobile a vybere `WEB Web portal`
- Then:
  - tým má štítky `MOB ×` a `WEB ×` v pořadí oblastí,
  - tým se všemi oblastmi nemá tlačítko `+`.

**Příklad 3: Oblast bez mandátu blokuje Run** *(B4, C1, C2)*
- Given: Team Web má jen mandát WEB a backlog používá WEB
- When: kouč klikne na × u WEB
- Then: tým ukazuje červené `No mandate`, objeví se `No team has a mandate for WEB` a Run je neaktivní s tooltipem `Fix the warnings in the Organization panel first`
- When: kouč přidá Team Mobile mandát WEB
- Then: varování zmizí a Run je aktivní

**Příklad 4: Umí, ale nesmí** *(D1, D2)*
- Given: ORG-T; backlog `F-1 (p1): BIL [Java 1] | WEB [Frontend 3]`, `F-2 (p2): BIL [Java 1] | WEB [Frontend 3]`
- When: běh do konce
- Then:
  - Ben vezme F-1 Java (0.0–1.0) a F-2 Java (1.0–2.0); Hana F-1 Frontend (0.0–3.0) a F-2 Frontend (3.0–6.0),
  - Eli Frontend ve F-2 nevezme, protože Team Mobile nemá mandát na WEB,
  - F-1 cycle time 3.0 d, F-2 5.0 d; Total Time 6.0.

**Příklad 5: Stejná data, širší mandát** *(D3, D10)*
- Given: data z příkladu 4, Team Mobile má mandáty MOB a WEB
- When: běh do konce
- Then: Eli vezme F-1 Frontend a Hana F-2 Frontend, obě v 0.0–3.0; obě featury jsou hotové v 3.0; Total Time 3.0

**Příklad 6: Kapacita týmu jsou jeho lidé** *(D4, D5, D11, D14)*
- Given: ORG-T; backlog `F-1 (p1): WEB [Product 2]`, `F-2 (p2): WEB [Frontend 2]`, `F-3 (p3): WEB [QA 2]`
- When: běh do konce
- Then: Gus, Hana a Ivo pracují současně a vše je hotové v 2.0; Avg WIP 3.0
- Given: ORG-T; backlog `F-1 (p1): WEB [Product 2]`, `F-2 (p2): WEB [Java 2]`
- When: běh do konce
- Then: Gus zpracuje oba úkoly za sebou (Product 0.0–2.0, Java 2.0–4.0); Ben Javu nevezme, protože Team Billing nemá mandát na WEB

**Příklad 7: Fáze v rámci oblasti** *(D6, J11)*
- Given: ORG-T; backlog `F-1 (p1): BIL [Product 2 · Java 3 · QA 2] | MOB [Frontend 3 · QA 1]`
- When: běh do konce
- Then: BIL Ada 0.0–2.0, Ben 2.0–5.0, Chen 5.0–7.0; MOB Eli 0.0–3.0 (nečeká na Product v BIL), Fae 3.0–4.0; F-1 hotová v 7.0

**Příklad 8: Reduce WIP** *(D7, F1–F3)*
- Given: ORG-B; backlog `F-1 (p1): BIL [QA 3]`, `F-2 (p3): BIL [Java 1 · QA 1]`, `F-3 (p2): BIL [QA 1]`
- When: běh do konce
- Then:
  - v 3.0 Chen vybírá mezi rozpracovanou F-2 a F-3 z backlogu a vezme F-2,
  - cycle time F-1 3.0, F-2 4.0, F-3 1.0; Avg Cycle Time `2.7 days`; Total Time `1 week 0.0 days` s `✓ Complete`; Avg WIP 1.6.

**Příklad 9: Panel a featury za běhu** *(H5, H8, J2)*
- Given: data z příkladu 7, čas 2.5
- When: kouč se podívá na In progress
- Then: řádek F-1 má štítky BIL a MOB a pruh postupu 45 % (5.0 z 11.0); v čase 4.0 je MOB zelený `✓ MOB`
- Given: příklad 8, čas 0.5
- When: kouč se podívá na panel organizace
- Then: řádek Team Billing ukazuje mandát BIL a pruh `2/3` a nemá žádná tlačítka mandátů

**Příklad 10: Zamčení za běhu** *(I1, I2)*
- Given: výchozí organizace, kouč spustil Run
- When: běh probíhá, je pozastavený nebo doběhl
- Then: mandáty nejdou měnit; hlavička ukazuje `Skills, AI and mandates are locked during the run`, po doběhnutí `Reset to change the organization`

**Příklad 11: Srovnání s předchozím během** *(F6–F9, I3, I4)*
- Given:
  - předchozí běh: Total Time 12.0, Avg Cycle Time 8.7, Avg WIP 4.3,
  - nový běh doběhl: 9.0, 6.9, 4.6
- When: kouč se podívá na Metrics
- Then:
  - delty jsou `↓ 25%`, `↓ 21%` a `↑ 7.0%` (červeně) vs prev run,
  - první běh srovnání nemá,
  - za běhu je vidět delta Avg Cycle Time a Avg WIP, delta Total Time až po doběhnutí,
  - po Resetu, změně mandátu a druhém doběhnutém běhu mají srovnání všechny tři dlaždice.

**Příklad 12: Přepnutí módu, zpětná vazba a projektor** *(I6, I7, J9, J10)*
- Given: běh v módu Organization probíhá
- When: kouč přepne na Cash Flow a zpět, nebo otevře dialog zpětné vazby
- Then:
  - běh je pozastavený a stav zůstane zachovaný,
  - dialog dostane název módu `Organization`,
  - při 1024 × 768 je mód bez vodorovného rolování a nové prvky používají jen tokeny barev.

## Out of Scope
Přijde v dalších inkrementech (viz Plán inkrementů):
- Waiting, žlutý idle, Idle Time, lidé a štítky featur za běhu, filtr, skok na featuru, detail položky backlogu (feat-029).
- Přidávání, odebírání a přejmenování týmů, lidí a jejich skillů, kontrola chybějících skillů (feat-030).
- Settings → Backlog: velikost, posuvníky, Generate new backlog (feat-031).
- Min units (feat-032).
- Výnosy a dlaždice Revenue (time-matched) (feat-033).
- Timeline hotové featury (feat-034).
- AI na skillech lidí (feat-035).
- Editory skillů a oblastí, povinné skilly (Req.) a fáze 1–10 v editoru ve všech módech (feat-036).

Mimo celou feature:
- **Koordinační režie** (práce navíc, rework z feat-016).
- **Rozhodovací pravomoc a čekání na rozhodnutí.** Mandát znamená jen „kam smí tým zasahovat“.
- **Částečné alokace** (FTE, %) a člověk ve více týmech najednou.
- **Mandát pro jednotlivce** (výjimky z mandátu týmu).
- **Hierarchie** skillů a oblastí.
- **Změny organizace za běhu.**
- **Uložení organizace** mezi načteními, export nebo sdílení scénáře (Pro tier).
- **Preset velké organizace a import organizace nebo backlogu z Excelu** (dnešní formát nemá oblasti).
- **Dvě organizace vedle sebe** jako v Compare.
- **Seskupování týmů** (tribe, value stream) pro organizace nad ~15 týmů.
- **Krok v tutoriálu** pro nový mód (přidá se později).

## Technical Notes
- **Datový model** v `src/types/organization.ts`:
  - tým (id, název, mandáty, lidé), oblast (kód, název), člověk (id, jméno, skilly),
  - úkol s oblastí a úseky práce (od, do, člověk, tým), featura se začátkem a koncem,
  - stav běhu (backlog, rozpracované, hotové, čas, integrál WIP).
- **Engine jako samostatný čistý modul** `src/simulation/organizationEngine.ts`, aby se nerozbily existující módy:
  - `makeDefaultOrgSetup`, `makeOrgFeature`, `generateOrgBacklog` s výchozím nastavením `DEFAULT_ORG_BACKLOG_SETTINGS`,
  - `validateOrgSetup` (čistá funkce vrací seznam varování),
  - `makeOrgState`, `tickOrg` (Reduce WIP), `resetOrgState`, `orgMetrics`, `snapshotOrgRun`.
- **UI:**
  - nový `AppMode` a záložka v `TopBar`; lišta se čtyřmi záložkami musí projít pravidlem 1024 px z feat-021 (J9),
  - nová komponenta `OrganizationView` (celá plocha módu) nad stavem z enginu; znovu použít `StatTile`, `ResultsAside`, `formatTime`,
  - `Simulator.tsx` přidá smyčku běhu, Reset, předchozí běh a pozastavení při otevření zpětné vazby pro nový mód.
- **Další inkrementy** rozhraní rozšíří (Idle Time a stavy čekání, úpravy organizace, nastavení backlogu, Min units, výnosy, timeline, AI, editory).
- **Závislosti:** feat-027 (pracovní dny), sjednocené ovládání běhu, feat-024 (zpětná vazba), design system feat-021 / 022 / 023.
- **Kontrakty:**
  - UI: `docs/feat-028-ui-mockup.html` (verze 9, cílový stav),
  - testy: scénáře inkrementu 1 z `docs/feat-028-test-analysis.md`; koncept testů dalších inkrementů je v `docs/feat-028-test-drafts/`.

## Open Questions
—
