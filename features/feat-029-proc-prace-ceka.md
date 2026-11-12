# Feature: Proč práce čeká (mód Organization, inkrement 2)

## Status
ready

*Inkrement 2 z 9 módu Organization (Týmy složené z lidí). Vznikl rozdělením feat-028 podle INVEST a SPIDR 2026-11-12 a závisí jen na inkrementu 1 ([feat-028](feat-028-tymy-slozene-z-lidi.md), v main od PR #44). Spec je schválený 2026-11-12, včetně delty Idle Time až po doběhnutí (změna R12). UI kontrakt je mockup [`docs/feat-028-ui-mockup.html`](../docs/feat-028-ui-mockup.html) (verze 9), scénáře jsou v [`docs/feat-028-test-analysis.md`](../docs/feat-028-test-analysis.md) a koncept testů v [`docs/feat-028-test-drafts/`](../docs/feat-028-test-drafts/README.md).*

## Problem
Po inkrementu 1 kouč vidí, že se po změně mandátů změnil cycle time, ale nevidí proč. Neukáže úkol, který stojí, protože ho nikdo s mandátem nemůže vzít. Neukáže ani člověka, který nemá co dělat, přestože by práci uměl, protože leží v oblasti mimo mandát jeho týmu. Management tak vidí jen čísla, ne jejich příčinu.

## User Story
Jako agilní kouč chci za běhu vidět, které úkoly čekají, přestože lidé s potřebným skillem v jiném týmu nemají co dělat, a kolik času lidé v organizaci strávili bez úkolu, abych managementu ukázal, jak skilly a mandáty týmů ovlivňují cycle time.

## Prior Art
Research: hluboký (2026-11-10) — [`docs/feat-028-research.md`](../docs/feat-028-research.md), společný pro všechny inkrementy módu Organization. Pro tento inkrement nic dalšího.

## UI / Design
Všechny texty v UI jsou anglicky, desetinná tečka, písmo a barvy jen z tokenů design systému (feat-021 až feat-023). Featura se píše jako v ostatních módech, `F-001`; příklady níže používají kvůli čitelnosti zkrácený zápis `F-1`.

**Texty u čekání nezmiňují mandát:** úkol je „waiting“, člověk „idle“, dlaždice „Idle Time“. Rozdíl mezi obyčejným a „žlutým“ idle ukazuje jen barva a šrafa (rozhodnutí z mockupu v9).

### In progress (prostřední sloupec)
- **Hlavička:** vpravo text `Click a feature to see its tasks`. Když aspoň jedna rozpracovaná featura má čekající úkol, je vlevo od něj filtr `1 waiting` (počet featur s čekajícím úkolem, title `Show only features with waiting tasks`).
- **Filtr** je přepínač (aria-pressed): zapnutý ukáže jen featury s čekajícím úkolem, další klik ukáže všechny. Když už nic nečeká, filtr zmizí a vypne se sám.
- **Řádek featury** je tlačítko (title `Show or hide tasks`, aria-expanded), které rozbalí úkoly featury. Rozbalených může být víc najednou.
- **Štítky oblastí na řádku:** hotová oblast zelená `✓ BIL` (jako v inkrementu 1), oblast s čekajícím úkolem žlutá, ostatní obyčejné.
- **Zvýraznění** featury (po skoku z panelu organizace, viz níže) je obrys v barvě `--accent`.

**Rozbalená featura** ukáže pod řádkem jeden řádek na oblast: štítek oblasti (žlutý, když v ní něco čeká) a úkoly oblasti jako segmenty s šířkou podle pracnosti, v pořadí úkolů.

| Stav úkolu | Vzhled | Tooltip |
|---|---|---|
| done | plná výplň v barvě skillu a `✓` | `Java · done` |
| doing | světlý podklad, výplň podle postupu a první písmeno jména člověka | `Java · Ben (Team Billing)` |
| waiting | šrafa a čárkovaný obrys v barvě čekání | `Frontend · waiting · 1 idle person with this skill in Team Mobile` |
| to do | jen světlý podklad | `QA · to do` |

- Tooltip čekajícího úkolu uvádí počet idle lidí se skillem úkolu z týmů bez mandátu na oblast (`1 idle person`, `2 idle people`) a jejich týmy v pořadí panelu (`in Team Mobile, Team Web`).
- Pod řádky oblastí je poznámka v barvě čekání `Waiting · WEB` (víc oblastí `Waiting · BIL, WEB`), jen když něco čeká. Sbalený řádek poznámku nemá, čekání na něm ukazuje žlutý štítek.

### Organization za běhu (prostřední sloupec)
Panel je dál jen ke čtení. Sloupce jsou **Team | Mandate | People | Working on**.

- **Řádek týmu:**
  - šipka pro rozbalení lidí (aria-label `Show or hide people`, stejné rozbalení jako před během), název a štítky mandátů,
  - **pruh lidí** ze tří částí: pracující (tmavá), žlutý idle (šrafa) a obyčejný idle (prázdná); vedle text `1/3` (pracuje / celkem); title `1 working, 2 idle (1 while work for their skills waits in another area)` (závorka jen když je někdo ve žlutém idle),
  - **Working on:** štítky featur, na kterých lidé týmu pracují, seřazené podle čísla featury (`F-001`, `F-002 ×2`, kde `×2` znamená dva lidi z týmu); title štítku `F-001 Login flow · 2 from Team Web. Click to show the feature.`; za štítky text `2 idle` s počtem idle lidí týmu — v barvě čekání, když je mezi nimi někdo ve žlutém idle, jinak šedě. Když v týmu nikdo není idle, text chybí.
- **Skok na featuru:** klik na štítek featury vypne filtr, featuru v In progress rozbalí, zvýrazní a posune do viditelné části seznamu. Zvýrazněná je vždy jen poslední vybraná featura.
- **Rozbalený tým** ukáže lidi: jméno, čipy skillů (jen ke čtení) a stav:
  - pracuje: `F-001 · BIL · QA` a pruh postupu úkolu v barvě skillu,
  - obyčejný idle: šedé `Idle`,
  - žlutý idle: karta v barvě čekání, `Idle` s tooltipem `Idle while work for their skills waits in Web portal` (víc oblastí v pořadí oblastí: `… waits in Billing, Web portal`).
- **Hlavička:** za `3 teams · 12 people` počet idle lidí v celé organizaci, např. `7 idle` (barva podle stejného pravidla jako u týmu).
- **Po doběhnutí** (stav „Reset to change the organization“) ukazuje Working on u všech týmů `—` a hlavička počet idle lidí nemá.

### Metrics (pravý sloupec)
- Nová dlaždice **Idle Time** za Avg WIP: hodnota ve formátu Avg Cycle Time (`2.5 days`), hint `person-days without a task`, tooltip `Person-days that people spent without a task while work for their skills was still open in the organization.`
- Před během ukazuje `—`, od prvního Run číslo (i `0.0 days`).
- Srovnání `vs prev run` jako u Total Time: **až po doběhnutí**, nižší hodnota je lepší (zelená šipka dolů). Idle Time se za běhu sčítá, takže s celkem předchozího běhu jde poctivě srovnat až na konci; za běhu by delta vždy začínala na `↓ 100%`. Když měl předchozí běh Idle Time 0, delta se neukáže (stejně jako u ostatních dlaždic). *(Mění R12 z testovací analýzy, kde byla delta Idle Time vidět už za běhu.)*
- Dlaždice nemá žlutý tón. Mockup ji za běhu ukazuje žlutě, ale tón by se měnil s každým uvolněným člověkem a na projektoru by blikal.

### Backlog (levý sloupec)
- Položka backlogu je tlačítko (title `Show or hide details`, aria-expanded). Rozbalených může být víc najednou, i za běhu.
- **Rozbalená položka** místo pruhu pracnosti ukáže:
  - řádek `Priority 2 · 3 tasks · 8 days of work` (jednotné číslo `1 task`, `1 day of work`),
  - pro každou oblast featury: štítek oblasti, čipy úkolů v barvě skillu `Product · 2 d` a týmy s mandátem `Mandate: Team Billing` (víc týmů v pořadí panelu: `Mandate: Team Mobile, Team Web`), nebo červeně `No team has a mandate for this area`.
- Detail se před během mění hned se změnou mandátů.
- Výnos v detailu (`€280/week`) přibude s feat-033.

### Reset
Reset vypne filtr, zruší zvýraznění a sbalí featury v In progress. Rozbalené týmy a položky backlogu zůstanou, jsou to jen pohledy.

## Pravidla chování
Vychází z pravidel R1 a R2 v [`docs/feat-028-test-analysis.md`](../docs/feat-028-test-analysis.md) (schválená se specem 2026-11-11). Přidělování práce, fáze, Reduce WIP, zamčení a Reset zůstávají jako v inkrementu 1.

- **Idle člověk** je člověk, který právě nepracuje na žádném úkolu.
- **R1 Idle Time:** člověku roste idle čas, dokud je idle a kdekoli v backlogu nebo v rozpracovaných featurách existuje nepřidělený úkol s některým z jeho skillů, **bez ohledu na fázi a mandát**. Člověk bez skillů idle čas nemá. Dlaždice Idle Time je součet přes všechny lidi v person-days. Stejné pravidlo jako dnešní počítání idle v ostatních módech.
- **R2 Waiting:** úkol je *waiting*, když zároveň:
  - je nepřidělený (to do) a jeho featura je rozpracovaná,
  - jeho fáze v oblasti je odemčená (nižší fáze v téže oblasti téže featury jsou hotové),
  - existuje idle člověk se skillem úkolu, jehož tým nemá mandát na oblast úkolu.

  Úkol, který čeká jen na nižší fázi, je obyčejné „to do“. Úkol featury v backlogu není nikdy waiting.
- **R2 Žlutý idle:** idle člověk je ve žlutém idle, když existuje nepřidělený úkol s jeho skillem a s odemčenou fází v oblasti mimo mandát jeho týmu, v backlogu i v rozpracovaných featurách. Oblasti takových úkolů jsou v tooltipu jeho karty. Ostatní idle lidé mají obyčejný (šedý) idle.
- Waiting, žlutý idle a počty idle lidí se počítají ze stavu běhu v okamžiku zobrazení, neukládají se.
- **Srovnání:** snapshot předchozího běhu nese i Idle Time; delta Idle Time se ukáže až po doběhnutí (jako Total Time). Reset vynuluje idle čas všech lidí.

## Specification by Example
Příklady shrnují scénáře inkrementu 2 z testovací analýzy (B5, E1–E5, H1–H4, H6, H7, J1) a části scénářů inkrementu 1 o Idle Time (D2, D3, D5, D10, D11, F6–F9). Všechna čísla ověřila simulace pravidel inkrementu 1 a R1–R2 (krok 0.01 dne).

Testovací data jsou z analýzy:
- **ORG-T**:
  - Team Billing (BIL): Ada Product, Ben Java, Chen QA,
  - Team Mobile (MOB): Dani Product, Eli Frontend, Fae QA,
  - Team Web (WEB): Gus Java + Product, Hana Frontend, Ivo QA.
- **ORG-B**: jen Team Billing z ORG-T.
- **ORG-DEF**: výchozí organizace 3 × 4 lidé (feat-028).
- **Data D2**: ORG-T; backlog `F-1 (p1): BIL [Java 1] | WEB [Frontend 3]`, `F-2 (p2): BIL [Java 1] | WEB [Frontend 3]`. Ben dělá Javu ve F-1 (0.0–1.0) a ve F-2 (1.0–2.0), Hana Frontend ve F-1 (0.0–3.0) a ve F-2 (3.0–6.0).
- **Data D6**: ORG-T; backlog `F-1 (p1): BIL [Product 2 · Java 3 · QA 2] | MOB [Frontend 3 · QA 1]`.
- **Data D7**: ORG-B; backlog `F-1 (p1): BIL [QA 3]`, `F-2 (p3): BIL [Java 1 · QA 1]`, `F-3 (p2): BIL [QA 1]`.

Zápis `BIL [Java 1]` znamená úkol Java s pracností 1 den v oblasti BIL. Čas je v pracovních dnech.

**Příklad 1: Waiting a žlutý idle** *(E1)*
- Given: data D2, čas 1.5
- When: kouč se podívá na In progress
- Then:
  - F-1 má štítky `✓ BIL` a obyčejný `WEB`, pruh postupu 63 % (2.5 ze 4 dní),
  - F-2 má obyčejný `BIL` a žlutý `WEB`, pruh postupu 13 % (0.5 ze 4 dní),
  - v hlavičce je filtr `1 waiting`
- When: rozbalí F-2
- Then: Java v BIL je rozpracovaná s písmenem `B` a výplní 50 %; Frontend ve WEB je waiting s tooltipem `Frontend · waiting · 1 idle person with this skill in Team Mobile`; pod oblastmi je `Waiting · WEB`
- When: podívá se na panel organizace a rozbalí týmy
- Then:
  - Eli má žlutou kartu `Idle` s tooltipem `Idle while work for their skills waits in Web portal`; Ada, Chen, Dani, Fae, Gus a Ivo mají šedé `Idle`,
  - Team Mobile: `0/3`, pruh 0 pracuje / 1 šrafa / 2 prázdné, text `3 idle` v barvě čekání,
  - Team Billing: `1/3`, štítek `F-002`, šedé `2 idle`; Team Web: `1/3`, štítek `F-001`, šedé `2 idle`,
  - hlavička `7 idle`,
  - v Metrics je Idle Time `2.5 days` (Eli 1.5, Gus 1.0)
- When: čas 4.0
- Then: nic nečeká, filtr zmizel, Eli má šedé `Idle`, Idle Time `4.0 days`

**Příklad 2: Úkol zamčený fází není waiting** *(E2)*
- Given: data D6, čas 1.0 (Ada dělá Product v BIL, Eli Frontend v MOB)
- When: kouč rozbalí F-1
- Then: Java a QA v BIL i QA v MOB jsou „to do“ (bez šrafy), filtr `waiting` není vidět a Ben, Gus, Chen, Fae i Ivo mají šedé `Idle`. Gus by Javu v BIL uměl, ale ta čeká na Product, takže není waiting a Gus nemá žlutý idle.

**Příklad 3: Výpočet Idle Time** *(E3, E4)*
- Given: data D6
- When: běh do konce
- Then: Idle Time `18.0 days`:

| Člověk | Idle | Proč |
|---|---|---|
| Ben | 2.0 | 0.0–2.0 existuje Java v BIL (zamčená fází) |
| Gus | 2.0 | 0.0–2.0 existuje Java v BIL (Team Web nemá mandát) |
| Chen | 5.0 | 0.0–5.0 existuje QA v BIL (fáze) |
| Fae | 4.0 | 0.0–3.0 existuje QA v MOB (fáze); 4.0–5.0 QA v BIL (fáze, Team Mobile nemá mandát) |
| Ivo | 5.0 | 0.0–5.0 existuje QA (Team Web nemá mandát) |
| ostatní | 0.0 | žádný nepřidělený úkol s jejich skillem |

- Given: ORG-T; backlog `F-1 (p1): WEB [Frontend 3]`
- When: běh do konce
- Then: Eli je celou dobu bez úkolu, ale jeho idle čas je 0.0, protože Frontend od začátku dělá Hana

**Příklad 4: Žlutý idle i kvůli práci v backlogu** *(E5)*
- Given: ORG-T, Team Mobile má mandáty MOB a WEB; backlog `F-1 (p1): WEB [Frontend 2]`, `F-2 (p2): MOB [Frontend 2]`; čas 1.0
- When: kouč se podívá na obrazovku
- Then: Hana má žlutý `Idle` s tooltipem `… waits in Mobile app` (F-2 v backlogu potřebuje Frontend v MOB); In progress ukazuje jen F-1 a filtr `waiting` není vidět; Idle Time `1.0 days`

**Příklad 5: Idle Time v příkladech inkrementu 1** *(D2, D3, D5, D10, D11)*
- Given / When: běh do konce
- Then:

| Data | Idle Time | Kdo |
|---|---|---|
| D2 (Umí, ale nesmí) | 4.0 | Eli 3.0 (Frontend ve F-2 čeká na Hanu), Gus 1.0 (Java ve F-2 čeká na Bena) |
| D3 (D2, Team Mobile má i WEB) | 1.0 | Gus 1.0 |
| D5 `WEB [Product 2]`, `WEB [Java 2]` | 2.0 | Ben 2.0 (Java čeká v backlogu, Team Billing nemá mandát na WEB) |
| D10 (Team Mobile má i WEB) `WEB [Frontend 2]`, `MOB [Frontend 2]` | 2.0 | Hana 2.0 |
| D11 (Hugo Frontend za Hanou) `WEB [Frontend 2]` | 0.0 | — |

**Příklad 6: Řádek týmu a lidé za běhu** *(H1, H2, H4)*
- Given: data D7, čas 0.5
- When: kouč se podívá na panel organizace
- Then: Team Billing ukazuje mandát `BIL`, `2/3`, štítky `F-001` a `F-002` v tomto pořadí a šedé `1 idle`
- Given: ORG-T; backlog `F-1 (p1): WEB [Java 2 · Frontend 2]`, čas 1.0
- When: kouč se podívá na Team Web
- Then: štítek `F-001 ×2` (Gus a Hana)
- Given: data D7, čas 1.0, Team Billing rozbalený
- When: kouč se podívá na lidi
- Then: Chen `F-001 · BIL · QA` s pruhem 33 %; Ada a Ben šedé `Idle` (Ben má Javu hotovou)
- When: běh doběhne
- Then: Working on ukazuje `—` a hlavička nemá počet idle lidí

**Příklad 7: Filtr čekajících featur** *(H6)*
- Given: data D2, čas 1.5
- When: kouč klikne na `1 waiting`
- Then: In progress ukazuje jen F-2; další klik ukáže F-1 i F-2
- Given: filtr je zapnutý v čase 1.5
- When: čas 3.5 (Hana už dělá Frontend ve F-2)
- Then: nic nečeká, filtr zmizel a vypnul se; In progress ukazuje F-2

**Příklad 8: Skok na featuru** *(H3)*
- Given: data D2, čas 1.5; filtr `1 waiting` je zapnutý, takže F-1 není vidět
- When: kouč klikne na štítek `F-001` v řádku Team Web (Hana na F-1 pracuje)
- Then: filtr se vypne a F-1 je v In progress rozbalená, zvýrazněná a posunutá do viditelné části
- When: klikne na štítek `F-002` v řádku Team Billing
- Then: zvýrazněná je jen F-2 a F-1 zůstane rozbalená
- When: běh doběhne, kouč klikne na Reset a spustí nový běh
- Then: filtr je vypnutý a žádná featura není rozbalená ani zvýrazněná

**Příklad 9: Detail položky backlogu** *(H7, B5)*
- Given: ORG-DEF, stav před během; položka `F-2 (p2): BIL [Product 2 · Java 3] | WEB [QA 3]`
- When: kouč na ni klikne
- Then:
  - `Priority 2 · 3 tasks · 8 days of work`,
  - BIL: `Product · 2 d`, `Java · 3 d`, `Mandate: Team Billing`,
  - WEB: `QA · 3 d`, `Mandate: Team Web`
- When: odebere Team Web mandát WEB
- Then: u WEB je červeně `No team has a mandate for this area`
- Given: ORG-DEF; položka `F-1 (p1): WEB [QA 3]`
- When: kouč přidá Team Mobile mandát WEB a položku rozbalí
- Then: u WEB je `Mandate: Team Mobile, Team Web`

**Příklad 10: Srovnání Idle Time s předchozím během** *(F6–F9, I3)*
- Given: první běh s daty D2 doběhl (Idle Time 4.0)
- When: kouč se podívá na Metrics
- Then: Idle Time `4.0 days` bez řádku `vs prev run`
- When: klikne na Reset
- Then: Idle Time ukazuje `—`
- When: přidá Team Mobile mandát WEB a spustí Run
- Then: za běhu Idle Time řádek `vs prev run` nemá (Avg Cycle Time a Avg WIP ho mají jako v inkrementu 1)
- When: běh doběhne
- Then: Idle Time `1.0 days` a `↓ 75% vs prev run` zeleně

**Příklad 11: Jeden tým se vším** *(J1)*
- Given: jeden tým s mandáty BIL, MOB, WEB a lidmi se všemi čtyřmi skilly; výchozí backlog (seed 42)
- When: běh do konce
- Then: žádný úkol není nikdy waiting a nikdo nemá žlutý idle (žádný idle člověk nemá práci mimo mandát svého týmu)

## Out of Scope
Přijde v dalších inkrementech:
- Tým bez lidí za běhu (`0/0`, scénář E6), `Expand all` / `Collapse all` a úpravy týmů a lidí (feat-030).
- Výnos v řádku featury, v detailu backlogu a hlavička `sorted by revenue` (feat-033).
- Timeline hotové featury po kliknutí v Done (feat-034).
- Odznaky AI na čipech lidí a u rozpracovaného úkolu (feat-035).

Mimo tento inkrement:
- **Idle čas jednotlivých lidí v UI.** Engine ho vede po lidech, obrazovka ukazuje jen součet.
- **Žlutý tón dlaždice Idle Time** z mockupu (viz UI / Design).
- **Označení čekání na volného kolegu ve vlastním týmu.** Takový úkol je „to do“; doba čekání úkolu přijde s timeline (feat-034).
- Všechno, co je mimo celou feature podle feat-028 (koordinační režie, rozhodovací pravomoc, změny za běhu …).

## Technical Notes
- **Engine** (`src/simulation/organizationEngine.ts`, typy v `src/types/organization.ts`):
  - `OrgSimState.idleByPerson: Record<number, number>`, idle čas po lidech. Roste v `tickOrg` po přidělení práce (R1); `makeOrgState` a `resetOrgState` ho vynulují.
  - `OrgMetrics.idleTime` (součet) a `OrgRunSnapshot.idleTime`.
  - `orgTaskStatus(state, feature, task)` → `'done' | 'doing' | 'todo' | 'waiting'` (R2).
  - `orgPersonStatus(state, personId)` → `{ kind: 'working', featureId, taskId } | { kind: 'idle' } | { kind: 'blocked', areas }` (`blocked` = žlutý idle, `areas` v pořadí oblastí).
  - Stavy se počítají, neukládají. Pro vykreslení jednoho snímku je vhodné spočítat jednou množinu idle lidí a dvojice (skill, oblast) nepřidělených úkolů s odemčenou fází, aby výpočet zůstal rychlý i pro velkou organizaci z feat-030 (J3).
  - Doporučení: přidělit práci i na konci kroku `tickOrg`, po dokončení úkolů. Čísla se nezmění (přidělení na začátku dalšího kroku pak nic nového nenajde), ale zobrazený stav nikdy neukáže člověka uvolněného na hranici úkolu jako idle a jeho další úkol jako waiting. Bez toho by žlutá na projektoru na jeden snímek problikla při každém dokončeném úkolu.
- **UI** (`src/components/OrganizationView.tsx` a `OrganizationView.module.css`):
  - rozbalitelný řádek featury s úkoly po oblastech, filtr, zvýraznění a posun (`scrollIntoView` v seznamu In progress),
  - řádek týmu za běhu s šipkou, třídílným pruhem lidí, sloupcem Working on a kartami lidí,
  - rozbalitelná položka backlogu (memoizovaný `BacklogPanel` musí reagovat i na změnu mandátů),
  - dlaždice Idle Time přes `StatTile` a `percentChange` jako Avg Cycle Time.
  - Stav zobrazení (rozbalené featury, položky a týmy, filtr, zvýraznění) patří komponentě, ne enginu.
  - Barvy jen z tokenů: `--wait`, `--wait-soft`, `--done`, `--accent`; šrafa přes `repeating-linear-gradient` s tokeny (J10).
  - Pravidlo 1024 px z feat-021 (J9) musí platit i pro pohled za běhu se sloupcem Working on.
- **`Simulator.tsx`:** snapshot přes `snapshotOrgRun` ponese Idle Time sám, jiná změna se nečeká.
- **Testy (fáze TDD):** vezmou se z `docs/feat-028-test-drafts/` bloky E1–E5, H1–H4, H6, H7, B5, J1 a části D2, D3, D5, D10, D11, I3 a F6–F9 o Idle Time a upraví se na současný kód. Úpravy oproti konceptu:
  - poznámka `Waiting · WEB` jen v rozbalené featuře,
  - H3 a H6 rozšířené podle příkladů 7 a 8,
  - po doběhnutí `—` ve Working on,
  - delta Idle Time až po doběhnutí (F9),
  - props `OrganizationView` bez nastavení backlogu a výnosů (přijdou s feat-031 a feat-033).
- **Závislosti:** jen feat-028 (inkrement 1).

## Open Questions
—
