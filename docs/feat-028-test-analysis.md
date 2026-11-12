# Testovací analýza: Týmy složené z lidí (feat-028)

## Účel
Tento dokument je Specification by Example pro mód **Organization** (feat-028 až feat-036, viz „Rozdělení do inkrementů“). Každý scénář má konkrétní data a čísla a pokryje ho jeden test (jedno `it`). Spec `features/feat-028-tymy-slozene-z-lidi.md` na scénáře odkazuje v sekci Specification by Example.

Podklady: rozhovor k feat-028, schválený návrh UI ([`docs/feat-028-ui-mockup.html`](feat-028-ui-mockup.html), verze 9) a research ([`docs/feat-028-research.md`](feat-028-research.md)).

Scénáře popisují jen pravidla chování lidí, týmů a zobrazení. Netvrdí nic o tom, jak se změní metriky skutečných organizací.

## Rozhodnutí, na kterých analýza stojí
Scénáře počítají s těmito pravidly. Body R1–R6 vyplynuly při sestavování analýzy a uživatel je schválil spolu se specem 2026-11-11; ostatní padly v rozhovoru.

| # | Pravidlo | Stav |
|---|---|---|
| R1 | **Idle time** roste člověku bez úkolu, dokud existuje nepřidělený úkol (todo) s jeho skillem kdekoli v backlogu nebo v rozpracovaných featurách, bez ohledu na fázi a mandát. Stejné pravidlo jako dnešní počítání idle v enginu. | rozhodnuto |
| R2 | **Waiting** (šrafa u úkolu) má úkol rozpracované featury, který je todo, jeho fáze v oblasti je odemčená a existuje idle člověk s jeho skillem, jehož tým nemá mandát na oblast úkolu. **Žlutý idle** má idle člověk, pro kterého existuje todo úkol s jeho skillem a odemčenou fází v oblasti mimo mandát jeho týmu (v backlogu i v rozpracovaných featurách). Úkol, který čeká jen na předchozí fázi, je obyčejný „to do“. | rozhodnuto |
| R3 | **Timeline:** čekání úkolu se počítá od začátku featury do začátku práce na úkolu, takže zahrnuje i čekání na předchozí fázi. Nadpis oblasti vypíše týmy, které v oblasti pracovaly, v pořadí prvního začátku práce; při shodě rozhoduje pořadí v panelu organizace. | rozhodnuto |
| R4 | **Výchozí organizace** má 3 týmy po 4 lidech (Product, Java, Frontend, QA), každý tým s mandátem na jednu oblast. Generátor může dát jakýkoli skill do jakékoli oblasti; s týmy po 3 lidech by výchozí backlog zablokoval Run. | rozhodnuto |
| R5 | **Generování backlogu** (Settings → Backlog; posuvníky se projeví po „Generate new backlog“ jako dnes): Backlog size 10–1000 (výchozí 100) a posuvníky min–max **Areas per feature** (1 až počet oblastí), **Skills per area** (1 až počet skillů) a **Effort per skill** (1–20 dní). Výchozí rozsahy 1–3, 1–3 a 1–5. Oblasti ve featuře jsou různé, skilly v oblasti jsou různé (každý skill v oblasti je jeden úkol) a pracnost je celé číslo dní. Když počet oblastí nebo skillů klesne pod nastavenou mez, mez se stáhne. **Req.** = každá featura obsahuje aspoň jeden úkol s tímto skillem; povinné skilly zaberou místa v oblasti jako první a oblast kvůli nim může horní mez překročit. Priorita a výnos jako Cash Flow, stejný seed dává stejný backlog. | rozhodnuto |
| R6 | **Názvy týmů:** okolní mezery se ořežou, prázdný název se neuloží (vrátí se původní), shodné názvy jsou povolené. Prázdný backlog zablokuje Run s textem „Backlog is empty“. | rozhodnuto |
| R7 | Oblast použitá v backlogu bez týmu s mandátem, nebo bez člověka s potřebným skillem v týmech s mandátem, zablokuje Run a ukáže varování. | rozhodnuto |
| R8 | Fáze skillů platí **v rámci oblasti**: úkol fáze N v oblasti začne, až jsou hotové všechny úkoly nižší fáze v téže oblasti téže featury. Fáze jsou 1–10 **ve všech módech**: editor skillů je sdílený, takže limit se zvedne i v Advanced a Cash Flow (feat-005 dnes uvádí 1–5). | rozhodnuto |
| R9 | Koordinační režie z feat-016 v tomto módu není. | rozhodnuto |
| R10 | Výběr práce řídí přepínač **Reduce WIP / Min units** jako v Cash Flow. U Min units je jednotkou **tým**: člověk dá přednost featuře, na které už pracoval někdo z jeho týmu, potom featuře, na které nepracoval nikdo z jiného týmu, a nakonec rozhoduje priorita. Kolega ze stejného týmu se nepočítá jako jiná jednotka, takže s jediným týmem vybírá Min units stejně jako Reduce WIP. Skill, mandát a fáze platí v obou režimech. | rozhodnuto |
| R11 | Skilly, AI, mandáty, oblasti, lidé a názvy týmů se mění jen před během. Od prvního spuštění (i v pauze a po doběhnutí) je vše zamčené až do Resetu. | rozhodnuto |
| R12 | Srovnání s předchozím během funguje jako v Cash Flow: předchozí běh je poslední doběhnutý běh, který se stane „předchozím“ po Resetu nebo vygenerování nového backlogu. Delty cycle time, WIP a Idle time jsou vidět už za běhu, delta Total time až po doběhnutí, výnos podle feat-018. | rozhodnuto |
| R13 | Organizace se neukládá mezi načteními stránky (stejně jako týmy v ostatních módech). | rozhodnuto |

## Konvence
- **Čas** je v pracovních dnech, 1 simulační sekunda = 1 pracovní den (feat-027). Scénáře uvádějí spojitý čas: člověk uvolněný v čase t bere další úkol v čase t.
- **Testy enginu** krokují s `dt = 0.01` a porovnávají s tolerancí ±0.05 dne (`toBeCloseTo(x, 1)`).
- **Začátek featury** je okamžik přidělení jejího prvního úkolu; **cycle time** = dokončení − začátek.
- **Pořadí přidělování v jednom okamžiku:**
  - týmy shora dolů a lidé v týmu shora dolů, jak jsou v panelu organizace,
  - ve featuře úkoly v pořadí oblastí a v oblasti v pořadí úkolů,
  - nižší číslo priority znamená vyšší prioritu.
- **Zápis featury:** `F-1 (p1, €300/week): BIL [Product 2 · Java 3] | MOB [Frontend 3]` znamená prioritu 1 a výnos €300 týdně. V oblasti BIL jsou úkoly Product (práce 2 dny) a Java (3 dny), v oblasti MOB úkol Frontend (3 dny).
- **Označení v UI:** featura F-1 se na obrazovce píše jako ve zbytku aplikace „F-001“ (štítky „F-001 ×2“, řádek „F-001 · BIL · QA“); scénáře používají kvůli čitelnosti zkrácený zápis.
- **V oblasti featury je každý skill nejvýš jednou**; každý skill v oblasti je jeden úkol.
- **Výchozí stav, pokud scénář neříká jinak:** bez AI, Reduce WIP, profil výnosu Flat.
- **Názvy dlaždic** jsou jako v Cash Flow: Total Time, Avg Cycle Time, Avg WIP, Revenue (time-matched), Idle Time.
- **Úroveň testu:**
  - **E** = unit test enginu (Vitest, čistý TypeScript),
  - **U** = unit test komponenty (Vitest + Testing Library),
  - **E2E** = Playwright.
- **Typ scénáře:** **H** = hlavní, **O** = okrajový.

## Testovací data

### Skilly (SK)
| Skill | Fáze | Req. |
|---|---|---|
| Product | 1 | ne |
| Java | 2 | ne |
| Frontend | 2 | ne |
| QA | 3 | ne |

### Oblasti (AR)
| Kód | Název |
|---|---|
| BIL | Billing |
| MOB | Mobile app |
| WEB | Web portal |

### ORG-DEF – výchozí organizace (R4)
| # | Tým | Mandát | Lidé (skill) |
|---|---|---|---|
| 1 | Team Billing | BIL | Ada (Product), Ben (Java), Cyril (Frontend), Chen (QA) |
| 2 | Team Mobile | MOB | Dani (Product), Emil (Java), Eli (Frontend), Fae (QA) |
| 3 | Team Web | WEB | Gus (Product), Hugo (Java), Hana (Frontend), Ivo (QA) |

### ORG-T – testovací organizace pro pravidla běhu
| # | Tým | Mandát | Lidé (skill) |
|---|---|---|---|
| 1 | Team Billing | BIL | Ada (Product), Ben (Java), Chen (QA) |
| 2 | Team Mobile | MOB | Dani (Product), Eli (Frontend), Fae (QA) |
| 3 | Team Web | WEB | Gus (Java, Product), Hana (Frontend), Ivo (QA) |

### ORG-B a ORG-B2 – jeden tým
- **ORG-B:** jen Team Billing z ORG-T (Ada – Product, Ben – Java, Chen – QA), mandát BIL.
- **ORG-B2:** Team Billing s mandátem BIL: Ada (Product), Ben (Java, Frontend), Bara (Java, Frontend), Chen (QA).

---

## A. Výchozí stav a backlog

#### A1 · Otevření módu — H · U, E2E
- **Given:** aplikace v módu Compare
- **When:** kouč klikne na záložku **Organization**
- **Then:**
  - záložka je aktivní; panel organizace ukazuje 3 řádky ORG-DEF, každý „4 people“ a jeden štítek mandátu (BIL, MOB, WEB)
  - Settings → Skills obsahuje Product 1, Java 2, Frontend 2, QA 3; Settings → Areas obsahuje BIL Billing, MOB Mobile app, WEB Web portal
  - backlog má 100 featur seřazených podle priority, hlavička „sorted by revenue“
  - Total time „0.0 days“, Revenue (time-matched) „€0“, Done „No completed features yet.“, tlačítko Run je aktivní

#### A2 · Invarianty generovaného backlogu — H · E
- **Given:** SK, AR, ORG-DEF, seed 42, výchozí Settings → Backlog (100 items, Areas per feature 1–3, Skills per area 1–3, Effort per skill 1–5)
- **When:** vygeneruje se backlog
- **Then:**
  - je 100 featur s prioritami 1–100, každá priorita právě jednou
  - každá featura má 1–3 různé oblasti z AR a v každé oblasti 1–3 různé skilly ze SK
  - pracnost každého úkolu je celé číslo 1–5
  - výnos za týden klesá s prioritou (featura s prioritou 1 má nejvyšší)
  - druhé generování se seedem 42 dá úplně stejný backlog

#### A3 · Req. v generování — O · E
- **Given:** SK, u QA je zaškrtnuté Req., seed 7
- **When:** kouč klikne na „Generate new backlog“
- **Then:** každá ze 100 featur má aspoň jeden úkol QA (v kterékoli své oblasti)

#### A4 · Výchozí backlog nezablokuje Run — O · E
- **Given:** ORG-DEF a výchozí backlog (seed 42)
- **When:** proběhne kontrola před během
- **Then:** žádné varování, Run je aktivní

#### A5 · Žádné ukládání mezi načteními — O · E2E
- **Given:** kouč přidal Team Mobile mandát WEB a přejmenoval Team Web na „Portal“
- **When:** obnoví stránku
- **Then:** mód Organization ukazuje znovu ORG-DEF (R13)

#### A6 · Posuvníky backlogu a jejich meze — H · U
- **Given:** ORG-DEF (3 oblasti, 4 skilly), Settings → Backlog
- **When:** kouč se podívá na nastavení
- **Then:**
  - Backlog size „100 items“ (rozsah 10–1000)
  - Areas per feature „1–3 areas“ (rozsah posuvníku 1–3)
  - Skills per area „1–3 skills“ (rozsah 1–4)
  - Effort per skill „1–5 days“ (rozsah 1–20)
- **When:** kouč přidá oblast OPS
- **Then:** rozsah Areas per feature je 1–4, hodnota zůstane „1–3 areas“
- **When:** nastaví Areas per feature na 2–4 a pak smaže oblasti WEB a OPS
- **Then:** rozsah je 1–2 a hodnota se stáhne na „2 areas“
- **When:** smaže i oblast MOB (zbude jediná oblast)
- **Then:** posuvník Areas per feature je neaktivní s hodnotou „1 area“
- Stejně se chová Skills per area při přidání a mazání skillů.

#### A7 · Jezdci se nepřekříží — O · U
- **Given:** Effort per skill „1–5 days“
- **When:** kouč táhne levý jezdec (minimum) na 8
- **Then:** minimum se zastaví na 5 a posuvník ukazuje „5 days“
- **When:** táhne pravý jezdec (maximum) na 3
- **Then:** maximum se zastaví na 5, hodnota zůstává „5 days“

#### A8 · Generování podle posuvníků — H · E
- **Given:** SK, AR; Backlog size 50, Areas per feature 2–2, Skills per area 1–1, Effort per skill 5–5; seed 3
- **When:** kouč klikne na „Generate new backlog“
- **Then:** backlog má 50 featur; každá má právě 2 různé oblasti, v každé jeden úkol s pracností 5; každá featura tak má 10 dní práce

#### A9 · Všechny skilly v oblasti, každý jednou — O · E
- **Given:** SK (4 skilly), AR; Areas per feature 1–1, Skills per area 4–4, Effort per skill 1–20; seed 5
- **When:** kouč klikne na „Generate new backlog“
- **Then:** každá featura má jednu oblast s úkoly Product, Java, Frontend a QA, každý právě jednou; všechny pracnosti jsou celá čísla 1–20

#### A10 · Req. má přednost před horní mezí — O · E
- **Given:** SK, u Product a QA je Req.; Areas per feature 1–1, Skills per area 1–1; seed 9
- **When:** kouč klikne na „Generate new backlog“
- **Then:** každá featura má jednu oblast právě s úkoly Product a QA; oblast má 2 úkoly místo 1 jen kvůli povinným skillům a žádný volitelný skill se nepřidá

#### A11 · Posuvníky se projeví až po vygenerování — O · U
- **Given:** backlog vygenerovaný s Effort per skill 1–5
- **When:** kouč nastaví Effort per skill na 10–10 a nic dalšího neudělá
- **Then:** backlog se nezmění
- **When:** klikne na „Generate new backlog“
- **Then:** všechny úkoly v backlogu mají pracnost 10 dní; posuvníky a „Generate new backlog“ jinak fungují stejně jako v Cash Flow

---

## B. Nastavení organizace před během

#### B1 · Přidání mandátu — H · U
- **Given:** ORG-DEF, stav před během
- **When:** kouč klikne na **+** v řádku Team Mobile
- **Then:**
  - otevře se nabídka „BIL Billing“, „WEB Web portal“ (v pořadí oblastí), MOB v ní není
  - po výběru WEB má tým štítky „MOB ×“ a „WEB ×“ a nabídka se zavře

#### B2 · Pořadí mandátů — O · U
- **Given:** Team Web má mandát WEB
- **When:** kouč přidá BIL
- **Then:** štítky jsou v pořadí oblastí: „BIL“, „WEB“

#### B3 · Všechny oblasti přidělené — O · U
- **Given:** Team Web má mandáty BIL, MOB, WEB
- **When:** kouč se podívá na řádek týmu
- **Then:** tlačítko + v řádku není

#### B4 · Odebrání mandátu a „No mandate“ — H · U
- **Given:** Team Web má jen mandát WEB
- **When:** kouč klikne na **×** u WEB
- **Then:** místo štítků je červené „No mandate“; Run je neaktivní, protože backlog používá WEB (C1)

#### B5 · Stejná oblast pro více týmů — O · U, E
- **Given:** ORG-DEF
- **When:** kouč přidá Team Mobile mandát WEB
- **Then:** WEB mají Team Mobile i Team Web; rozbalená položka backlogu s oblastí WEB ukazuje „Mandate: Team Mobile, Team Web“

#### B6 · Přejmenování týmu — H · U
- **Given:** ORG-DEF, stav před během
- **When:** kouč klikne do názvu „Team Mobile“, přepíše ho na „  Mobile Apple “ a stiskne Enter
- **Then:**
  - název je „Mobile Apple“ (bez okolních mezer)
  - nový název je v řádku týmu, v pohledu za běhu, v detailu backlogu („Mandate: Mobile Apple“) i v timeline („done by Mobile Apple“)

#### B7 · Prázdný a shodný název týmu — O · U
- **Given:** ORG-DEF
- **When:** kouč smaže název „Team Web“ a potvrdí
- **Then:** název zůstane „Team Web“
- **When:** kouč přejmenuje Team Web na „Team Mobile“
- **Then:** název se uloží; oba týmy se jmenují „Team Mobile“ (R6)

#### B8 · Přidání a odebrání týmu — H · U
- **Given:** ORG-DEF
- **When:** kouč klikne na „+ Add team“
- **Then:** přibude rozbalený řádek „Team 4“ s 0 lidmi a „No mandate“; Run zůstane aktivní (backlog je pokrytý)
- **When:** kouč klikne na × u Team Web a potvrdí „Remove Team Web? 4 people will be removed.“
- **Then:** Team Web zmizí i s lidmi; objeví se varování „No team has a mandate for WEB“ a Run je neaktivní

#### B9 · Přidání a odebrání člověka — H · U
- **Given:** ORG-DEF, Team Web rozbalený
- **When:** kouč klikne na „+ Add person“
- **Then:** přibude člověk bez skillů (karta má jen tlačítko +); počet je „5 people“
- **When:** kouč u nového člověka zvolí v nabídce ⋯ „Remove person“
- **Then:** člověk zmizí, Team Web má „4 people“

#### B10 · Přidání a odebrání skillu člověku — H · U
- **Given:** ORG-DEF, Hana (Frontend)
- **When:** kouč klikne na + na kartě Hany
- **Then:** nabídka obsahuje Product, Java, QA (pořadí skillů), Frontend v ní není
- **When:** vybere Java
- **Then:** Hana má čipy „Frontend AI ×“ a „Java AI ×“
- **When:** klikne na × u Java
- **Then:** Hana má jen Frontend

#### B11 · Přesun člověka do jiného týmu — H · U, E
- **Given:** ORG-T, Eli má Frontend s AI 2×
- **When:** kouč v nabídce ⋯ u Eli zvolí „Move to“ → Team Web
- **Then:**
  - Eli je posledním členem Team Web se skillem Frontend a AI 2×
  - Team Mobile má „2 people“
  - za běhu se na Eli vztahuje mandát WEB (J8)

#### B12 · AI na skillu člověka — H · U
- **Given:** ORG-DEF, Ben má Java bez AI (čip ukazuje průhledné „AI“)
- **When:** kouč klikne na AI na čipu Java třikrát
- **Then:**
  - po 1. kliknutí 2× (odznak „⚡2×“, tooltip „AI speed-up for Java: 2× – click for 5×“)
  - po 2. kliknutí 5× („⚡5×“, tooltip „… – click to turn off“)
  - po 3. kliknutí 1× („AI“)
  - když má Ben AI 2× nebo 5×, ukazuje řádek Team Billing souhrn „⚡1“

#### B13 · AI patří dvojici člověk + skill — O · U
- **Given:** Gus (ORG-T) má Java a Product
- **When:** kouč nastaví AI 5× jen u Java
- **Then:** čip Product ukazuje „AI“ (1×); po odebrání a znovupřidání Java je Java zpět na 1×

#### B14 · Přidání skillu v editoru — H · U
- **Given:** Settings → Skills se 4 skilly
- **When:** kouč zvolí barvu Slate, napíše „Security“ a klikne na Add
- **Then:** přibude řádek Security s fází 1 a bez Req.; Security je v nabídce + u lidí
- **When:** napíše „java“ a klikne na Add
- **Then:** chyba „"java" already exists“, nic nepřibude
- **When:** nechá pole prázdné a klikne na Add
- **Then:** chyba „Name is required“

#### B15 · Přejmenování, barva a fáze skillu — H · U
- **Given:** Settings → Skills
- **When:** kouč přejmenuje QA na „QA automation“
- **Then:** nový název je na všech čipech lidí, v nabídkách a v timeline; prázdné přejmenování ponechá původní název
- **When:** u Java klikne na − ve fázi
- **Then:** fáze je 1; − u fáze 1 je neaktivní
- **When:** u QA klikne na + sedmkrát (fáze 3 → 10)
- **Then:** fáze je 10 a + je neaktivní
- **When:** změní barvu Frontend na Teal
- **Then:** čipy, segmenty úkolů a pruhy v backlogu mají barvu Teal

#### B15b · Limit 10 fází i v ostatních módech — O · U
- **Given:** mód Advanced (a stejně Cash Flow), Settings → Skills, skill Testing ve fázi 1
- **When:** kouč klikne na + u fáze devětkrát
- **Then:** fáze je 10 a + je neaktivní; backlog se generuje a běh probíhá s fázemi až do 10 stejně jako dnes s 1–5

#### B16 · Smazání skillu — H · U, E
- **Given:** ORG-DEF, výchozí backlog
- **When:** kouč klikne na × u QA
- **Then:** potvrzení „Delete QA? 3 people lose it and tasks requiring it will be removed.“ s tlačítky Delete a Cancel
- **When:** klikne na Delete
- **Then:**
  - QA zmizí ze skillů, z lidí (Chen, Fae, Ivo) i s jejich AI a ze všech úkolů backlogu
  - featura, které nezbude žádný úkol, z backlogu zmizí

#### B17 · Poslední skill nejde smazat — O · U
- **Given:** v editoru zbývá jediný skill
- **When:** kouč se podívá na jeho řádek
- **Then:** tlačítko × v řádku není

#### B18 · Přidání a přejmenování oblasti — H · U
- **Given:** Settings → Areas s BIL, MOB, WEB
- **When:** kouč zadá kód „ops“ a název „Operations“ a klikne na Add
- **Then:** přibude „OPS Operations“ (kód velkými písmeny); OPS je v nabídce + u týmů
- **When:** zadá kód „O“
- **Then:** chyba „Code must be 2–3 letters.“
- **When:** zadá kód „BIL“
- **Then:** chyba „BIL already exists.“
- **When:** zadá kód „DAT“ bez názvu
- **Then:** chyba „Enter a name.“
- **When:** přejmenuje „Web portal“ na „Customer portal“
- **Then:** tooltip štítku WEB i nabídka mandátů ukazují „Customer portal“; kód zůstává WEB

#### B19 · Smazání oblasti — H · U, E
- **Given:** ORG-DEF, výchozí backlog
- **When:** kouč smaže oblast WEB a potvrdí „Delete Web portal? 1 team loses the mandate and tasks in this area will be removed.“
- **Then:**
  - WEB zmizí z oblastí a Team Web má „No mandate“
  - z featur zmizí úkoly v oblasti WEB a featura jen s oblastí WEB zmizí z backlogu

#### B20 · Poslední oblast nejde smazat — O · U
- **Given:** zbývá jediná oblast
- **When:** kouč se podívá na její řádek
- **Then:** tlačítko × v řádku není

#### B21 · Přepínač výběru práce — H · U
- **Given:** Settings → Backlog
- **When:** kouč přepne WIP z Reduce WIP na Min units
- **Then:**
  - hint je „WIP: people stay on features their team already knows and avoid features other teams are working on.“
  - u Reduce WIP je hint „WIP: people finish in-progress features before pulling new ones.“

#### B22 · Sbalení a rozbalení týmů — O · U
- **Given:** ORG-DEF, všechny týmy sbalené
- **When:** kouč klikne na „Expand all“
- **Then:** všechny týmy ukážou lidi a odkaz se změní na „Collapse all“; šipka u týmu přepíná jen ten tým

---

## C. Kontrola před během

#### C1 · Oblast bez mandátu — H · E, U
- **Given:** ORG-T bez mandátu WEB u Team Web; backlog `F-1 (p1): WEB [Frontend 3]`
- **When:** proběhne kontrola před během
- **Then:** panel organizace ukazuje „No team has a mandate for WEB“; Run je neaktivní

#### C2 · Oprava zruší varování — H · E, U
- **Given:** stav z C1
- **When:** kouč přidá Team Mobile mandát WEB (Eli má Frontend)
- **Then:** varování zmizí a Run je aktivní

#### C3 · Chybí skill v týmech s mandátem — H · E, U
- **Given:** ORG-T; Chen nemá QA; backlog `F-1 (p1): BIL [QA 2]`
- **When:** proběhne kontrola před během
- **Then:** varování „No one with QA can work in BIL“; Run je neaktivní, přestože QA mají Fae a Ivo v týmech bez mandátu na BIL

#### C4 · Skill, který nemá nikdo — O · E
- **Given:** ORG-T; backlog `F-1 (p1): BIL [Data 2]` (skill Data existuje, nikdo ho nemá)
- **When:** proběhne kontrola před během
- **Then:** varování „No one with Data can work in BIL“; Run je neaktivní

#### C5 · Více problémů najednou — O · U
- **Given:** stavy C1 a C3 zároveň; backlog `F-1: BIL [QA 2]`, `F-2: WEB [Frontend 3]`
- **When:** proběhne kontrola před během
- **Then:** dvě varování v pořadí oblastí: „No one with QA can work in BIL“, „No team has a mandate for WEB“

#### C6 · Nepoužitá oblast nevadí — O · E
- **Given:** ORG-DEF; přidaná oblast OPS bez mandátu; žádný úkol v backlogu nepoužívá OPS
- **When:** proběhne kontrola před během
- **Then:** žádné varování, Run je aktivní

#### C7 · Tým bez mandátu a bez lidí nevadí — O · E
- **Given:** ORG-DEF a navíc prázdný „Team 4“ bez mandátu
- **When:** proběhne kontrola před během
- **Then:** žádné varování; Team 4 ukazuje „No mandate“

#### C8 · Prázdný backlog — O · U
- **Given:** backlog nemá žádnou featuru (všechny zmizely po smazání oblastí)
- **When:** kouč se podívá na ovládání běhu
- **Then:** backlog ukazuje „Backlog is empty“ a Run je neaktivní (R6)

#### C9 · Kontrola reaguje hned — O · U
- **Given:** ORG-DEF, Run aktivní
- **When:** kouč odebere Chenovi skill QA a backlog obsahuje úkol QA v BIL
- **Then:** varování „No one with QA can work in BIL“ se objeví hned, bez dalšího kliknutí

#### C10 · Chybějící skilly jedné oblasti v jednom řádku — O · E, U
- **Given:** ORG-T; Chen nemá QA; backlog `F-1 (p1): BIL [Frontend 2 · QA 2]`
- **When:** proběhne kontrola před během
- **Then:** jediné varování „No one with Frontend or QA can work in BIL“ (skilly v pořadí editoru); tři a více skillů se spojí jako „Frontend, Data or DevOps“

#### C11 · Kontrola po vygenerování backlogu — O · E, U
- **Given:** ORG-T (Team Mobile nemá nikoho s Java); Skills per area 4–4, Areas per feature 1–3; seed 11
- **When:** kouč klikne na „Generate new backlog“
- **Then:** mezi varováními je „No one with Java can work in MOB“ a Run je neaktivní

---

## D. Přidělování práce za běhu

#### D1 · Skill a mandát — H · E
- **Given:** ORG-T; backlog `F-1 (p1): WEB [Frontend 3]`
- **When:** běh do konce
- **Then:**
  - Hana zpracuje Frontend v čase 0.0–3.0; Eli nedostane úkol
  - F-1 je hotová v 3.0, cycle time 3.0 d; Idle time 0.0

#### D2 · Umí, ale nesmí — H · E
- **Given:** ORG-T; backlog `F-1 (p1): BIL [Java 1] | WEB [Frontend 3]`, `F-2 (p2): BIL [Java 1] | WEB [Frontend 3]`
- **When:** běh do konce
- **Then:**
  - 0.0: Ben vezme F-1 Java (0.0–1.0), Hana F-1 Frontend (0.0–3.0)
  - 1.0: Ben vezme F-2 Java (1.0–2.0); F-2 začne v 1.0
  - Frontend ve F-2 čeká na Hanu; Eli ho nevezme, protože Team Mobile nemá mandát na WEB
  - 3.0: Hana vezme F-2 Frontend (3.0–6.0)
  - F-1 hotová v 3.0 (cycle time 3.0 d), F-2 v 6.0 (cycle time 5.0 d); Total time 6.0
  - Idle time 4.0 person-days: Eli 3.0 (0.0–3.0 čeká Frontend ve F-2), Gus 1.0 (0.0–1.0 čeká Java ve F-2)

#### D3 · Stejná data, širší mandát — H · E
- **Given:** data z D2; Team Mobile má mandáty MOB a WEB
- **When:** běh do konce
- **Then:**
  - 0.0: Ben vezme F-1 Java; Eli (Team Mobile je v panelu před Team Web) F-1 Frontend (0.0–3.0); Hana F-2 Frontend (0.0–3.0), F-2 začne v 0.0
  - 1.0: Ben vezme F-2 Java (1.0–2.0)
  - F-1 i F-2 hotové v 3.0 (cycle time 3.0 d obě); Total time 3.0
  - Idle time 1.0 (Gus 0.0–1.0)

#### D4 · Kapacita týmu jsou jeho lidé — H · E
- **Given:** ORG-T; backlog `F-1 (p1): WEB [Product 2]`, `F-2 (p2): WEB [Frontend 2]`, `F-3 (p3): WEB [QA 2]`
- **When:** běh do konce
- **Then:**
  - v čase 0.0 pracují současně Gus (F-1 Product), Hana (F-2 Frontend) a Ivo (F-3 QA)
  - QA ve F-3 začne hned, protože v oblasti nemá nižší fázi
  - všechny tři úkoly hotové v 2.0; Total time 2.0; Avg WIP 3.0; Idle time 0.0

#### D5 · Jeden člověk, jeden úkol — H · E
- **Given:** ORG-T; backlog `F-1 (p1): WEB [Product 2]`, `F-2 (p2): WEB [Java 2]`
- **When:** běh do konce
- **Then:**
  - Gus zpracuje F-1 Product v čase 0.0–2.0 a teprve potom F-2 Java v čase 2.0–4.0
  - F-2 začne v 2.0, cycle time 2.0 d; Total time 4.0
  - Idle time 2.0 (Ben 0.0–2.0: Java čeká v backlogu, ale Team Billing nemá mandát na WEB)

#### D6 · Fáze v rámci oblasti — H · E
- **Given:** ORG-T; backlog `F-1 (p1): BIL [Product 2 · Java 3 · QA 2] | MOB [Frontend 3 · QA 1]`
- **When:** běh do konce
- **Then:**
  - BIL: Ada Product 0.0–2.0, Ben Java 2.0–5.0, Chen QA 5.0–7.0
  - MOB: Eli Frontend 0.0–3.0 (nečeká na Product v BIL), Fae QA 3.0–4.0 (čeká jen na Frontend v MOB)
  - F-1 je hotová v 7.0, cycle time 7.0 d

#### D7 · Reduce WIP — H · E
- **Given:** ORG-B, Reduce WIP; backlog `F-1 (p1): BIL [QA 3]`, `F-2 (p3): BIL [Java 1 · QA 1]`, `F-3 (p2): BIL [QA 1]`
- **When:** běh do konce
- **Then:**
  - 0.0: Ben vezme F-2 Java (0.0–1.0); Chen vezme F-1 QA (0.0–3.0), protože QA ve F-2 je zamčené fází
  - 3.0: Chen vybírá mezi rozpracovanou F-2 (p3) a F-3 z backlogu (p2) a vezme F-2 QA (3.0–4.0)
  - 4.0: Chen vezme F-3 QA (4.0–5.0)
  - cycle time: F-1 3.0, F-2 4.0, F-3 1.0; Avg cycle time „2.7 days“; Total time 5.0; Avg WIP 1.6

#### D8 · Min units počítá týmy, ne lidi — H · E
- **Given:** data z D7 (jediný tým), Min units
- **When:** běh do konce
- **Then:**
  - 0.0: stejně jako v D7 (Ben F-2 Java, Chen F-1 QA)
  - 3.0: Chen vezme F-2 QA (3.0–4.0), protože na F-2 pracoval Ben z jeho týmu; F-3 QA až 4.0–5.0
  - průběh i čísla jsou stejné jako v D7: cycle time F-1 3.0, F-2 4.0, F-3 1.0; Avg cycle time „2.7 days“; Total time 5.0; Avg WIP 1.6

#### D9 · Min units drží člověka u featury jeho týmu — H · E
- **Given:** ORG-T; Team Mobile má mandáty MOB a WEB; backlog `F-1 (p1): WEB [Java 2 · QA 1]`, `F-2 (p2): MOB [Frontend 2 · QA 1]`
- **When:** běh do konce v obou režimech
- **Then:**
  - 0.0 v obou režimech: Eli vezme F-2 Frontend (0.0–2.0), Gus F-1 Java (0.0–2.0); QA v obou featurách čeká na fázi 2

| Režim | 2.0 | Cycle time F-1 / F-2 | Total time |
|---|---|---|---|
| Reduce WIP | Fae vezme F-1 QA (2.0–3.0), protože obě featury jsou rozpracované a F-1 má vyšší prioritu; Ivo nedostane nic (QA ve F-2 je v MOB); Fae potom F-2 QA (3.0–4.0) | 3.0 / 4.0 | 4.0 |
| Min units | Fae vezme F-2 QA (2.0–3.0), protože na F-2 pracuje Eli z jejího týmu; F-1 QA vezme Ivo (2.0–3.0), protože F-1 zná Team Web | 3.0 / 3.0 | 3.0 |

#### D10 · Tým s více mandáty bere podle priority — H · E
- **Given:** ORG-T; Team Mobile má mandáty MOB a WEB; backlog `F-1 (p1): WEB [Frontend 2]`, `F-2 (p2): MOB [Frontend 2]`
- **When:** běh do konce
- **Then:**
  - 0.0: Eli vezme F-1 (vyšší priorita); Hana nedostane nic, protože Team Web nemá mandát na MOB
  - 2.0: Eli vezme F-2 (2.0–4.0); F-2 cycle time 2.0 d; Total time 4.0
  - Idle time 2.0 (Hana 0.0–2.0)

#### D11 · Dva stejní lidé, jeden úkol — O · E
- **Given:** ORG-T a v Team Web za Hanou Hugo (Frontend); backlog `F-1 (p1): WEB [Frontend 2]`
- **When:** běh do konce
- **Then:** úkol vezme Hana (je v panelu dřív); Hugo nedostane nic; Idle time 0.0

#### D12 · AI zrychlí práci na skillu — H · E
- **Given:** ORG-T; backlog `F-1 (p1): BIL [Java 3]`
- **When:** běh do konce s AI u Bena na Java
- **Then:** s 2× je F-1 hotová v 1.5, s 5× v 0.6
- **Given:** ORG-T; Gus má Java 5× a Product 1×; backlog `F-1 (p1): WEB [Product 2 · Java 5]`
- **When:** běh do konce
- **Then:** Gus Product 0.0–2.0 (1×), Java 2.0–3.0 (5×); F-1 hotová v 3.0

#### D13 · Člověk bez skillů — O · E
- **Given:** ORG-T a v Team Web člověk Petr bez skillů; backlog `F-1 (p1): WEB [Frontend 3]`
- **When:** běh do konce
- **Then:** Petr nedostane úkol a jeho Idle time zůstane 0.0

#### D14 · Úkoly stejné fáze běží souběžně — O · E
- **Given:** ORG-T; backlog `F-1 (p1): WEB [Java 2 · Frontend 2]` (Java i Frontend mají fázi 2)
- **When:** běh do konce
- **Then:** Gus (Java) a Hana (Frontend) pracují oba v čase 0.0–2.0; F-1 hotová v 2.0

#### D15 · Min units se vyhne featuře jiného týmu — H · E
- **Given:** ORG-T; Team Mobile má mandáty MOB a WEB; backlog `F-1 (p1): WEB [Java 2 · QA 1]`, `F-2 (p2): MOB [QA 2]`, `F-3 (p3): MOB [QA 1]`
- **When:** běh do konce v obou režimech
- **Then:**
  - 0.0 v obou režimech: Fae vezme F-2 QA (0.0–2.0), protože QA ve F-1 čeká na Java; Gus F-1 Java (0.0–2.0)

| Režim | 2.0 | Cycle time F-1 / F-2 / F-3 | Total time |
|---|---|---|---|
| Reduce WIP | Fae vezme rozpracovanou F-1 QA (2.0–3.0) a F-3 QA až 3.0–4.0; Ivo nedostane nic | 3.0 / 2.0 / 1.0 | 4.0 |
| Min units | Fae vezme F-3 QA z backlogu (2.0–3.0), protože na F-1 pracuje Team Web; F-1 QA vezme Ivo (2.0–3.0) | 3.0 / 2.0 / 1.0 | 3.0 |

---

## E. Waiting a Idle

#### E1 · Waiting a žlutý idle — H · E, U
- **Given:** data z D2, čas 1.5
- **When:** kouč se podívá na obrazovku
- **Then:**
  - **In progress:**
    - F-1: štítek BIL zelený „✓ BIL“, WEB běžný; pruh postupu 63 % (2.5 ze 4 dní)
    - F-2: štítek WEB žlutý, pruh postupu 13 % (0.5 ze 4 dní), poznámka „Waiting · WEB“
    - po rozbalení F-2: Java v BIL s iniciálou Bena a výplní 50 %; Frontend ve WEB je Waiting (šrafa) s tooltipem „Frontend · waiting · 1 idle person with this skill in Team Mobile“
    - nad seznamem filtr „1 waiting“
  - **Organizace:**
    - Eli má žlutou kartu „Idle“ s tooltipem „Idle while work for their skills waits in Web portal“; Dani, Fae a Gus mají šedé „Idle“
    - řádek Team Mobile: „0/3“, pruh 0 pracuje / 1 šrafa / 2 prázdné, text „3 idle“ v barvě čekání
    - hlavička „7 idle“
  - **Metriky:** Idle time „2.5 days“ (Eli 1.5, Gus 1.0)
- **When:** čas 4.0
- **Then:** žádný úkol není Waiting, filtr zmizí, Eli má šedé „Idle“, Idle time zůstává „4.0 days“

#### E2 · Úkol zamčený fází není Waiting — H · E
- **Given:** data z D6, čas 1.0
- **When:** kouč se podívá na F-1
- **Then:** Java a QA v BIL i QA v MOB jsou „to do“ (světlé, bez šrafy); filtr „waiting“ není vidět; Ben, Gus, Chen, Fae i Ivo mají šedé „Idle“

#### E3 · Výpočet Idle time — H · E
- **Given:** data z D6
- **When:** běh do konce
- **Then:** Idle time 18.0 person-days (R1):

| Člověk | Idle | Proč |
|---|---|---|
| Ben | 2.0 | 0.0–2.0 čeká Java v BIL (zamčená fází) |
| Gus | 2.0 | 0.0–2.0 čeká Java v BIL (Team Web nemá mandát) |
| Chen | 5.0 | 0.0–5.0 čeká QA v BIL (fáze) |
| Fae | 4.0 | 0.0–3.0 čeká QA v MOB (fáze); 4.0–5.0 čeká QA v BIL (Team Mobile nemá mandát) |
| Ivo | 5.0 | 0.0–5.0 existuje QA úkol, Team Web nemá mandát |
| ostatní | 0.0 | žádný nepřidělený úkol s jejich skillem |

#### E4 · Idle bez odpovídající práce se nepočítá — O · E
- **Given:** data z D1
- **When:** běh do konce
- **Then:** Eli je celou dobu bez úkolu, ale Idle time je 0.0, protože úkol Frontend byl od začátku přidělený Haně

#### E5 · Žlutý idle i kvůli práci v backlogu — O · E, U
- **Given:** data z D10, čas 1.0
- **When:** kouč se podívá na obrazovku
- **Then:** Hana má žlutou kartu „Idle“ (F-2 v backlogu čeká na Frontend v MOB); In progress ukazuje jen F-1 a filtr „waiting“ není vidět; Idle time „1.0 days“

#### E6 · Tým bez lidí za běhu — O · U
- **Given:** ORG-DEF a prázdný „Team 4“ s mandátem BIL
- **When:** běh probíhá
- **Then:** řádek Team 4 ukazuje „0/0“, prázdný pruh a ve sloupci Working on „—“

---

## F. Metriky a výnosy

#### F1 · Cycle time a Avg cycle time — H · E
- **Given:** data z D7
- **When:** běh doběhne
- **Then:** Done list ukazuje F-1 „3.0 d“, F-2 „4.0 d“, F-3 „1.0 d“; dlaždice Avg cycle time „2.7 days“

#### F2 · Total time — H · E, U
- **Given:** data z D7
- **When:** běh doběhne
- **Then:** dlaždice Total Time „1 week 0.0 days“ (5.0 pracovních dní; zkratka „1w 0.0d“ jen když se nevejde, feat-027), dlaždice je zelená s „✓ Complete“

#### F3 · Avg WIP — H · E
- **Given:** data z D7 a z D15
- **When:** běh doběhne
- **Then:**
  - D7: Avg WIP 1.6 (2 featury v 0.0–3.0, 1 v 3.0–5.0)
  - D15 Reduce WIP: Avg WIP 1.5 (2 v 0.0–2.0, 1 v 2.0–4.0)
  - D15 Min units: Avg WIP 2.0 (2 v 0.0–3.0)

#### F4 · Výnos hotové featury — H · E, U
- **Given:** ORG-B; backlog `F-1 (p1, €300/week): BIL [Java 1]`, `F-2 (p2, €200/week): BIL [Java 12]`
- **When:** běh do konce (Ben F-1 0.0–1.0, F-2 1.0–13.0)
- **Then:**
  - F-1 připíše €300 v čase 6.0 a 11.0
  - v čase 7.0 ukazuje Revenue (time-matched) „€300“ s hintem „live total“
  - po doběhnutí (Total time 13.0) je Revenue „€600“ a Details ukazuje „Total €600 in 2 weeks 3.0 days“
  - Done list (nejnovější nahoře): F-2 „€200/week · 12.0 d“ s výnosem „€0“; F-1 „€300/week · 1.0 d“ s výnosem „€600“
- **When:** čas 8.5
- **Then:** odpočet u F-1 je na 50 % ((8.5 − 1.0) mod 5 = 2.5 dne z 5)

#### F5 · Formát částek — O · U
- **Given:** výnosy €480, €1 240, €2 000 a €15 300
- **When:** zobrazí se
- **Then:** „€480“, „€1.2k“, „€2k“, „€15.3k“ (stejně jako formatEuro)

#### F6 · Srovnání s předchozím během — H · U
- **Given:**
  - předchozí doběhnutý běh: Total time 12.0, Avg cycle time 8.7, Avg WIP 4.3, Idle time 17.0, výnos v čase 9.0 €300, celkem €600
  - nový běh doběhl: Total time 9.0, Avg cycle time 6.9, Avg WIP 4.6, Idle time 3.0, výnos €450
- **When:** kouč se podívá na Metrics
- **Then:**

| Dlaždice | Hodnota | Řádek pod hodnotou |
|---|---|---|
| Total Time (✓ Complete) | 1 week 4.0 days | ↓ 25% vs prev run (zeleně) |
| Avg Cycle Time | 6.9 days | ↓ 21% vs prev run (zeleně) |
| Avg WIP | 4.6 | ↑ 7.0% vs prev run (červeně) |
| Revenue (time-matched) | €450, hint „@ 1 week 4.0 days“ | ↑ 50% vs prev run (zeleně) |
| Idle Time | 3.0 days | ↓ 82% vs prev run (zeleně) |

  - Details u výnosu: „Total €450 in 1 week 4.0 days“, „Previous run @ 1 week 4.0 days: €300“, „Previous total €600 in 2 weeks 2.0 days“

#### F7 · Beze změny — O · U
- **Given:** předchozí i nový běh mají Avg WIP 4.3
- **When:** kouč se podívá na dlaždici
- **Then:** „→ 0.0% vs prev run“ šedě

#### F8 · První běh bez srovnání — O · U
- **Given:** žádný předchozí doběhnutý běh
- **When:** běh doběhne
- **Then:** žádná dlaždice nemá řádek „vs prev run“

#### F9 · Kdy se srovnání ukáže — O · U
- **Given:** první běh doběhl, kouč klikl na Reset a spustil druhý běh
- **When:** druhý běh probíhá (čas 3.0, už 2 hotové featury)
- **Then:** Avg cycle time, Avg WIP a Idle time ukazují „vs prev run“; Total time ho ukáže až po doběhnutí (R12)

---

## G. Timeline hotové featury

#### G1 · Záznam zpracování — H · E, U
- **Given:** data z D6; F-1 hotová
- **When:** kouč klikne na F-1 v Done
- **Then:**
  - **hlavička:** „Started day 0.0 · done day 7.0 · cycle time 7.0 d“
  - **„BIL done by Team Billing“:**
    - Product: práce 0.0–2.0 (Ada)
    - Java: čekání 0.0–2.0, práce 2.0–5.0 (Ben)
    - QA: čekání 0.0–5.0, práce 5.0–7.0 (Chen)
  - **„MOB done by Team Mobile“:**
    - Frontend: práce 0.0–3.0 (Eli)
    - QA: čekání 0.0–3.0, práce 3.0–4.0 (Fae)
  - **osa:** „d0.0“, „d3.5“, „d7.0“
  - **součty:** „Task time: work 11.0 d · waiting 10.0 d“
  - **týmy:** „Teams: Team Billing → Team Mobile“ (oba začali v 0.0, rozhoduje pořadí v panelu organizace, R3)

#### G2 · Čekání na volného člověka — H · E
- **Given:** data z D2; F-2 hotová
- **When:** kouč rozbalí timeline F-2
- **Then:**
  - „Started day 1.0 · done day 6.0 · cycle time 5.0 d“
  - „BIL done by Team Billing“: Java práce 1.0–2.0 (Ben)
  - „WEB done by Team Web“: Frontend čekání 1.0–3.0, práce 3.0–6.0 (Hana)
  - součty „work 4.0 d · waiting 2.0 d“; „Teams: Team Billing → Team Web“

#### G3 · Oblast zpracovaná více týmy — O · E
- **Given:** ORG-T; Team Mobile má mandáty MOB a WEB; backlog `F-1 (p1): WEB [Java 2 · Frontend 3]`
- **When:** běh do konce a kouč rozbalí timeline F-1
- **Then:**
  - v 0.0 vezme Eli Frontend (0.0–3.0) a Gus Java (0.0–2.0); F-1 hotová v 3.0
  - nadpis „WEB done by Team Mobile, Team Web“ (oba začali v 0.0, rozhoduje pořadí v panelu)
  - řádky Java práce 0.0–2.0 (Gus) a Frontend práce 0.0–3.0 (Eli); „work 5.0 d · waiting 0.0 d“; „Teams: Team Mobile → Team Web“

#### G4 · AI zkrátí úsek práce — O · E
- **Given:** data z D6; Ben má Java 2×
- **When:** běh do konce a kouč rozbalí timeline F-1
- **Then:**
  - Java práce 2.0–3.5; QA v BIL čekání 0.0–3.5, práce 3.5–5.5; MOB beze změny
  - F-1 hotová v 5.5; součty „work 9.5 d · waiting 8.5 d“

#### G5 · Tooltips úseků — O · U
- **Given:** timeline z G1
- **When:** kouč najede na úsek práce Java a na úsek čekání QA v BIL
- **Then:** tooltipy „Java · Ben, Team Billing · day 2.0–5.0“ a „QA · waiting 5.0 d“

#### G6 · Rozbalování v Done — O · U
- **Given:** Done list se 3 hotovými featurami
- **When:** kouč klikne na F-1, pak na F-2, pak znovu na F-1
- **Then:** timeline F-1 se otevře a zase zavře, timeline F-2 zůstane otevřená; rozpracované featury v In progress timeline nemají (rozbalují úkoly)

---

## H. Zobrazení za běhu

#### H1 · Řádek týmu za běhu — H · U
- **Given:** data z D7, čas 0.5
- **When:** kouč se podívá na panel organizace
- **Then:** řádek Team Billing: mandát „BIL“, pruh „2/3“, ve sloupci Working on štítky „F-1“ a „F-2“ (podle čísla) a šedé „1 idle“

#### H2 · Více lidí na jedné featuře — H · U
- **Given:** data z D14, čas 1.0
- **When:** kouč se podívá na řádek Team Web
- **Then:** štítek „F-1 ×2“ (Gus a Hana)

#### H3 · Skok na featuru — H · U
- **Given:** data z D2, čas 1.5; filtr „1 waiting“ je zapnutý a F-1 v něm není
- **When:** kouč klikne na štítek „F-1“ v řádku Team Web (Hana na F-1 pracuje)
- **Then:** filtr se vypne a F-1 v In progress je rozbalená, zvýrazněná a posunutá do viditelné části

#### H4 · Lidé v rozbaleném týmu — H · U
- **Given:** data z D7, čas 1.0; Team Billing rozbalený
- **When:** kouč se podívá na lidi
- **Then:** Chen „F-1 · BIL · QA“ s pruhem 33 %; Ada šedé „Idle“; Ben šedé „Idle“ (Java hotová v 1.0)

#### H5 · Řádek rozpracované featury — H · U
- **Given:** data z D6, výnos F-1 €280/week
- **When:** čas 2.5
- **Then:** řádek F-1 ukazuje „€280/week“, štítky BIL a MOB a pruh postupu 45 % (hotová práce 5.0 z 11.0)
- **When:** čas 4.0
- **Then:** štítek MOB je zelený „✓ MOB“

#### H6 · Filtr čekajících featur — O · U
- **Given:** data z D2, čas 1.5
- **When:** kouč klikne na „1 waiting“
- **Then:** In progress ukazuje jen F-2; další kliknutí ukáže F-1 i F-2

#### H7 · Detail položky backlogu — H · U
- **Given:** ORG-DEF; položka `F-2 (p2, €280/week): BIL [Product 2 · Java 3] | WEB [QA 3]`
- **When:** kouč na ni klikne
- **Then:**
  - řádek „Priority 2 · €280/week · 3 tasks · 8 days of work“
  - BIL: „Product · 2 d“, „Java · 3 d“, „Mandate: Team Billing“
  - WEB: „QA · 3 d“, „Mandate: Team Web“
- **When:** před během kouč odebere Team Web mandát WEB
- **Then:** u WEB je červeně „No team has a mandate for this area“

#### H8 · Pořadí backlogu a Done — O · U
- **Given:** backlog s prioritami 1–5 a výnosy €500, €450, €400, €350, €300
- **When:** kouč se podívá na backlog
- **Then:** položky jsou v pořadí priorit a výnos klesá shora dolů; Done list má nejnověji dokončenou featuru nahoře

---

## I. Zamčení, Reset a další běh

#### I1 · Zamčení za běhu — H · U, E2E
- **Given:** ORG-DEF, kouč spustil Run
- **When:** běh probíhá nebo je pozastavený
- **Then:**
  - editory Skills a Areas jsou neaktivní a ukazují „… locked during the run. Reset to change them.“
  - název týmu nejde přepsat
  - u týmů nejsou tlačítka + a × mandátů, „+ Add team“ ani „+ Add person“
  - čipy lidí nemají tlačítko AI ani ×
  - hlavička organizace ukazuje „Skills, AI and mandates are locked during the run“

#### I2 · Po doběhnutí bez Resetu — O · U
- **Given:** běh doběhl
- **When:** kouč se podívá na panel organizace
- **Then:** vše zůstává zamčené, hlavička ukazuje „Reset to change the organization“

#### I3 · Reset — H · E, U
- **Given:** běh doběhl
- **When:** kouč klikne na Reset
- **Then:**
  - organizace zůstane beze změny (týmy, názvy, lidé, skilly, AI, mandáty, oblasti)
  - backlog se vrátí do stavu před během (stejné featury, priority a výnosy)
  - Done je prázdný, metriky jsou na začátku
  - doběhnutý běh se stane předchozím pro srovnání; nastavení jde měnit

#### I4 · Srovnání po změně mandátu — H · E2E
- **Given:** ORG-DEF, výchozí backlog; první běh doběhl
- **When:** kouč klikne na Reset, přidá Team Mobile mandát WEB, spustí Run a nechá ho doběhnout
- **Then:** všechny dlaždice Metrics mají řádek „vs prev run“ ve formátu z F6

#### I5 · Nový backlog — O · U
- **Given:** běh doběhl
- **When:** kouč klikne na „Generate new backlog“
- **Then:** stejně jako v Cash Flow se doběhnutý běh stane předchozím a organizace zůstane beze změny

#### I6 · Přepnutí módu a zpět — O · E2E
- **Given:** běh v módu Organization probíhá
- **When:** kouč přepne na Cash Flow a zpět
- **Then:** běh je pozastavený a organizace i stav běhu jsou zachované

#### I7 · Zpětná vazba pozastaví běh — O · U
- **Given:** běh v módu Organization probíhá
- **When:** kouč otevře dialog zpětné vazby (ikona bubliny v liště, feat-024)
- **Then:** běh se pozastaví stejně jako po Pause (tlačítko ukáže „▶ Run“) a dialog dostane název módu „Organization“; po zavření dialogu běh pokračuje od stejného bodu až po kliknutí na Run

---

## J. Okrajové a nefunkční scénáře

#### J1 · Jeden tým se vším — O · E
- **Given:** jeden tým se všemi oblastmi v mandátu a se všemi skilly; výchozí backlog
- **When:** běh do konce
- **Then:** žádný úkol není nikdy Waiting a žádný člověk nemá žlutý idle

#### J2 · Jeden člověk se všemi skilly — O · E
- **Given:** jeden tým s jedním člověkem (Product, Java, QA), mandát BIL; backlog `F-1 (p1): BIL [Product 2 · Java 3 · QA 2]`
- **When:** běh do konce
- **Then:** úkoly jdou za sebou 0.0–2.0, 2.0–5.0, 5.0–7.0; Total time 7.0

#### J3 · Velká organizace — O · E
- **Given:** 15 týmů po 6 lidech, 8 oblastí, 100 featur, seed 1
- **When:** headless běh enginu do konce s `dt = 0.1`
- **Then:** běh doběhne do 2 s strojového času (práh se ověří a případně upraví ve fázi TDD) a výsledek je při stejném seedu pokaždé stejný

#### J4 · Dlouhé názvy — O · U
- **Given:** tým „Customer Experience and Onboarding Squad“ (40 znaků) a oblast s 40znakovým názvem
- **When:** kouč se podívá na panel organizace a nabídku mandátů
- **Then:** názvy se zkrátí výpustkou s plným názvem v tooltipu; panel nemá vodorovné rolování

#### J5 · Smazání oblasti odebere featuru — O · E
- **Given:** backlog `F-1: BIL [Java 2] | WEB [QA 1]`, `F-2: WEB [Frontend 3]`
- **When:** kouč smaže oblast WEB
- **Then:** F-1 má jen `BIL [Java 2]`, F-2 z backlogu zmizí; backlog má o 1 featuru méně

#### J6 · Smazání skillu odebere featuru — O · E
- **Given:** backlog `F-1: BIL [QA 2]`, `F-2: BIL [Java 1 · QA 1]`
- **When:** kouč smaže skill QA
- **Then:** F-1 zmizí, F-2 má jen `BIL [Java 1]`

#### J7 · Featura s jedním úkolem — O · E
- **Given:** ORG-T; backlog `F-1 (p1): MOB [QA 2]`
- **When:** běh do konce a kouč rozbalí timeline
- **Then:** jeden řádek „MOB done by Team Mobile“ / QA práce 0.0–2.0 (Fae); „work 2.0 d · waiting 0.0 d“

#### J8 · Přesunutý člověk bere práci podle nového týmu — O · E
- **Given:** data z D2; před během se Eli přesune do Team Web (B11)
- **When:** běh do konce
- **Then:** v 0.0 vezme Hana F-1 Frontend a Eli F-2 Frontend (oba 0.0–3.0), Ben F-1 Java a v 1.0 F-2 Java; obě featury hotové v 3.0; Idle time 1.0 (Gus 0.0–1.0)

#### J9 · Projektor 1024 × 768 — O · E2E
- **Given:** okno 1024 × 768
- **When:** kouč otevře mód Organization před během i za běhu
- **Then:** lišta, tři sloupce a ovládání jsou použitelné bez vodorovného rolování stránky (stejné pravidlo jako feat-021)

#### J10 · Tmavé téma — O · U
- **Given:** tmavé téma
- **When:** kouč otevře mód Organization
- **Then:** nové prvky (štítky oblastí, Waiting, žlutý idle, timeline) používají jen tokeny z `globals.css`; kontrast hlídají stávající testy tokenů (feat-021)

#### J11 · Nejvyšší fáze a mezery ve fázích — O · E
- **Given:** ORG-B; Product má fázi 1, QA fázi 10, žádný skill nemá fáze 2–9; backlog `F-1 (p1): BIL [Product 2 · QA 1]`
- **When:** běh do konce
- **Then:** Ada Product 0.0–2.0, Chen QA 2.0–3.0 (fáze 10 čeká na fázi 1, mezera nevadí); F-1 hotová v 3.0

---

## Rozdělení do inkrementů
Feature se 2026-11-12 rozdělila na 9 inkrementů (INVEST, SPIDR). Analýza zůstává společná; každý scénář patří právě jednomu inkrementu. Části scénářů, které závisí na pozdějším inkrementu (Idle Time, výnos), se ověří až s ním.

| Inkrement | Spec | Scénáře | Počet |
|---|---|---|---|
| 1 | feat-028 Mandáty a tok práce | A1, A2, A4, A5, B1–B4, C1, C2, D1–D7, D10, D11, D14, F1–F3, F6–F9, H5, H8, I1–I4, I6, I7, J2, J9–J11 | 39 |
| 2 | feat-029 Proč práce čeká | B5, E1–E5, H1–H4, H6, H7, J1 | 13 |
| 3 | feat-030 Úpravy týmů a lidí | B6–B11, B22, C3, C5, C7, C9, C10, D13, E6, J3, J4, J8 | 17 |
| 4 | feat-031 Nastavení backlogu | A6–A9, A11, C11, I5 | 7 |
| 5 | feat-032 Min units po týmech | B21, D8, D9, D15 | 4 |
| 6 | feat-033 Výnosy | F4, F5 | 2 |
| 7 | feat-034 Timeline hotové featury | G1–G3, G5, G6, J7 | 6 |
| 8 | feat-035 AI na skillech lidí | B12, B13, D12, G4 | 4 |
| 9 | feat-036 Vlastní skilly a oblasti | A3, A10, B14–B20, B15b, C4, C6, C8, J5, J6 | 15 |
| | | **Celkem** | **107** |

Části scénářů z inkrementu 1, které se ověří později:
- **Idle Time** v D2, D3, D5, D10, D11 a v F6–F9 → feat-029,
- **výnos** v A1 (Revenue „€0“), A2, F6, H5, H8 („sorted by revenue“) a ve snapshotu běhu v I3 → feat-033,
- **D15** ve F3 → feat-032,
- **Settings → Skills a Areas** v A1 a editory v I1 → feat-036,
- **název týmu, + Add team, + Add person a × u skillů** v I1 → feat-030, **tlačítko AI** v I1 → feat-035,
- **pohled za běhu:** inkrement 1 ukazuje v řádku týmu jen mandáty a pruh lidí (část H1); celý H1 se štítky featur a „1 idle“ je ve feat-029.

## Pokrytí příkladů ze specu feat-028 (inkrement 1)
| Příklad ve specu | Scénáře |
|---|---|
| Př. 1 Otevření módu | A1, A2, A4, A5 |
| Př. 2 Přidání mandátu | B1, B2, B3 |
| Př. 3 Oblast bez mandátu blokuje Run | B4, C1, C2 |
| Př. 4 Umí, ale nesmí | D1, D2 |
| Př. 5 Stejná data, širší mandát | D3, D10 |
| Př. 6 Kapacita týmu jsou jeho lidé | D4, D5, D11, D14 |
| Př. 7 Fáze v rámci oblasti | D6, J11 |
| Př. 8 Reduce WIP | D7, F1, F2, F3 |
| Př. 9 Panel a featury za běhu | H5, H8 |
| Př. 10 Zamčení za běhu | I1, I2 |
| Př. 11 Srovnání s předchozím během | F6, F7, F8, F9, I3, I4 |
| Př. 12 Přepnutí módu, zpětná vazba a projektor | I6, I7, J9, J10 |
| bez příkladu | J2 |

Inkrementy 2–9 mají svoje scénáře vyjmenované v sekci Specification by Example vlastního specu.

## Souhrn
| Skupina | Hlavní | Okrajové | Celkem |
|---|---|---|---|
| A. Výchozí stav a backlog | 4 | 7 | 11 |
| B. Nastavení organizace | 14 | 9 | 23 |
| C. Kontrola před během | 3 | 8 | 11 |
| D. Přidělování práce | 12 | 3 | 15 |
| E. Waiting a Idle | 3 | 3 | 6 |
| F. Metriky a výnosy | 5 | 4 | 9 |
| G. Timeline | 2 | 4 | 6 |
| H. Zobrazení za běhu | 6 | 2 | 8 |
| I. Zamčení, Reset, další běh | 3 | 4 | 7 |
| J. Okrajové a nefunkční | 0 | 11 | 11 |
| **Celkem** | **52** | **55** | **107** |

Podle úrovně: unit testy enginu pokrývají hlavně skupiny A, C, D, E, F a G; unit testy komponent skupiny B, H a I; E2E jen A1, A5, I1, I4, I6 a J9, aby zůstaly rychlé.

## Testy (fáze TDD)
- **Inkrement 1 (feat-028):** 72 testů v `tests/`: unit `feat-028-org-backlog`, `-org-validation`, `-org-engine`, `-organization-view`, `-simulator-integration`, `-tokens` a data `feat028Fixtures.ts`; E2E `feat-028-organizace.spec.ts` a rozšířený `feat-021-design-system.spec.ts` (lišta se čtyřmi záložkami).
- **Inkrementy 2–9:** koncept testů pro celou feature (185 testů z 2026-11-11) je v [`docs/feat-028-test-drafts/`](feat-028-test-drafts/README.md) a vezme se do `tests/` v TDD fázi příslušného inkrementu.
