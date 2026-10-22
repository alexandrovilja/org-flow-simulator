# Feature: Přejmenování „Specialization“ na „Skill“ a anglický import z Excelu

## Status
in-progress

*Otevřené otázky z prvního návrhu rozhodl uživatel 2026-10-22: „specialist(s)“ a věta „Deep specialisation…“ zůstávají; import z Excelu se celý převede do angličtiny a staré soubory s českými sloupci fungovat nemusí. Upravený spec schválen 2026-10-22. Testy schváleny 2026-10-22. Po review (fáze 6) uživatel 2026-10-22 rozšířil rozsah o posuvníky v sekci Backlog, které dál mluvily o „roles“ (řádky tabulky níže, Příklad 16). Implementace (fáze 5) hotová na větvi `feat/026-specialization-na-skill`. Review (fáze 6) bez blockeru; jediný návrh (posuvníky v sekci Backlog říkaly „roles“) uživatel přijal a je doplněný jako Příklad 16. Po opravě 1107/1107 unit, 76/76 E2E, typecheck a lint (src, tests) čisté, ověřeno v prohlížeči.*

## Problem
Aplikace používá pro to, co jednotka umí, dvě slova. Nastavení, tlačítka a tutoriál mluví o „specializations“ (a jednou o „specialty“), zatímco texty tutoriálu a výchozích sestav už říkají „skills“ („units and skills“, „matching its skills“, „Define the skills and mandates…“). Uživatel tak vidí dva názvy pro jednu věc. Slovo „specialization“ navíc navádí k představě úzkého specialisty, přestože jednotka může mít skillů víc a právě o tom simulace je.

Import z Excelu má jako jediná část aplikace české názvy sloupců (Specializace, Tym, Velikost). Šablona ↓ Template je tak v jinak anglickém nástroji česky a chybové hlášky míchají angličtinu s češtinou („invalid Velikost“, „in the Tym column“).

Feat-025 přejmenování z rozsahu vyřadilo, feat-022 ponechalo české sloupce kvůli starým souborům. Tato feature dělá obojí a podporu starých souborů vědomě ruší.

## User Story
Jako agilní kouč chci, aby aplikace i šablona pro import všude mluvily anglicky a o „skills“, abych na workshopu nemusel vysvětlovat, že „specialization“ a „skill“ znamenají totéž, a mohl šablonu rovnou dát klientovi.

## UI / Design
Mění se jen texty a názvy sloupců. Rozvržení, barvy, pořadí prvků a chování zůstávají.

### Texty v aplikaci

| Místo | Dnes | Nově |
|---|---|---|
| Hlavička rozbalovací sekce v nastavení (Advanced i Cash Flow) | Specializations | Skills |
| Posuvník v sekci Backlog | Min. specializations per item | Min. skills per item |
| Nápověda (?) u posuvníku | Minimum number of different specializations each backlog item must require. | Minimum number of different skills each backlog item must require. |
| Hodnota posuvníku Min. skills per item (od 2 výš; u 1 zůstává „no minimum“) | ≥ 3 roles | ≥ 3 skills |
| Posuvník v sekci Backlog | Role-mix variability | Skill-mix variability |
| Krajní hodnoty posuvníku Skill-mix variability („low“ a „high“ uprostřed zůstávají) | 2 roles / 1–6 roles | 2 skills / 1–6 skills |
| Nápověda (?) u posuvníku Skill-mix variability | How many different roles each item requires. | How many different skills each item requires. |
| Potvrzení při přepnutí výchozí sestavy | Your current team and specializations will be replaced. This cannot be undone. | Your current team and skills will be replaced. This cannot be undone. |
| Popisek formuláře pro novou položku v sekci Skills | Add specialization | Add skill |
| Tlačítko „+“ na kartě jednotky (přístupný název) | Add specialization | Add skill |
| Nápověda v hlavičce panelu Units (Advanced i Cash Flow) | Click + to add a specialty | Click + to add a skill |
| Vstup názvu položky v sekci Skills (přístupný název) | Specialization name | Skill name |
| Tutoriál Advanced, krok 8 – nadpis | Specializations | Skills |
| Tutoriál Advanced, krok 13 – konec textu | …different phases under Specializations. | …different phases under Skills. |

Text kroku 8 („Define the skills and mandates units can have: add, rename or recolor them. …“) zůstává, pod nadpisem „Skills“ dává smysl beze změny.

Hlavička sekce je v množném čísle („Skills“), stejně jako dnes „Specializations“.

### Import z Excelu a šablona ↓ Template

Sloupce souboru (pořadí v šabloně zůstává):

| Dnes | Nově | Význam (beze změny) |
|---|---|---|
| Feature | Feature | název featury |
| Specializace | Skill | skill potřebný pro task |
| Tym | Unit | jednotka, která task dělá (tým, squad nebo člověk); v aplikaci se jmenuje „unit“ |
| Velikost | Size | pracnost tasku |

Názvy sloupců se dál hledají bez ohledu na velikost písmen a mezery okolo. Staré české názvy se nepřijímají.

Hlášky importu:

| Situace | Dnes | Nově |
|---|---|---|
| Chybí sloupec | The file has no 'Specializace' column. Check the header row. (obdobně Tym, Velikost) | The file has no 'Skill' column. Check the header row. (obdobně Unit, Size) |
| Neplatná velikost | 2 rows skipped (invalid Velikost). | 2 rows skipped (invalid Size). |
| Víc než 50 jednotek | Too many team members (max 50). The file contains more than 50 unique values in the Tym column. | Too many units (max 50). The file contains more than 50 unique values in the Unit column. |
| Úspěšný import | Imported 8 features, 18 tasks, 2 team members. | Imported 8 features, 18 tasks, 2 units. |

„Team members“ se mění na „units“, aby hláška odpovídala sloupci „Unit“ a panelu „Units“. Ostatní hlášky („The file contains no data.“, „Backlog too large (max 200 features). …“ apod.), název listu „Backlog“, název souboru `org-flow-template.xlsx` a ukázkové hodnoty šablony (Login flow, FE, Squad A, 3 …) zůstávají.

## Specification by Example

**Příklad 1: Hlavička sekce v Advanced**
- Given: uživatel je v Advanced
- When: podívá se na rozbalovací sekce v nastavení
- Then: sekce se jmenují „Backlog“, „Skills“ a „Team“; tlačítko hlavičky má přístupný název „Skills“

**Příklad 2: Hlavička sekce v Cash Flow**
- Given: uživatel je v Cash Flow
- When: podívá se na rozbalovací sekce v nastavení
- Then: sekce se jmenují „Backlog“, „Skills“ a „Team“

**Příklad 3: Posuvník minimálního počtu**
- Given: rozbalená sekce Backlog v Advanced
- When: uživatel najede na posuvník a jeho „?“
- Then: posuvník má popisek a přístupný název „Min. skills per item“; nápověda zní „Minimum number of different skills each backlog item must require.“

**Příklad 4: Potvrzení výchozí sestavy**
- Given: uživatel je v Advanced
- When: přepne výchozí sestavu (Teams / People) a zobrazí se potvrzovací dialog
- Then: text dialogu je „Your current team and skills will be replaced. This cannot be undone.“

**Příklad 5: Přidání nového skillu**
- Given: rozbalená sekce Skills
- When: uživatel se podívá na formulář pod seznamem a na vstupy s názvy
- Then: formulář má popisek „Add skill“; každý vstup s názvem má přístupný název „Skill name“; přidání, přejmenování, změna barvy i smazání fungují jako dřív

**Příklad 6: Přidání skillu jednotce**
- Given: jednotka v Advanced, která ještě nemá všechny skilly
- When: uživatel se podívá na tlačítko „+“ za jejími chipy a na hlavičku panelu Units
- Then: tlačítko má přístupný název „Add skill“ a po kliknutí nabídne skilly jako dřív; nápověda v hlavičce panelu zní „Click + to add a skill“ (stejně v Cash Flow)

**Příklad 7: Tutoriál Advanced**
- Given: běží prohlídka Advanced
- When: dojde na krok 8 a krok 13
- Then: krok 8 má nadpis „Skills“ a zvýrazní hlavičku sekce Skills; text kroku 13 končí „…different phases under Skills.“

**Příklad 8: Slovo „specialization“ v UI nezůstane**
- Given: libovolný mód (Compare, Advanced, Cash Flow) se všemi sekcemi rozbalenými a prohlídky tutoriálu
- When: projdu viditelné texty, přístupné názvy, nápovědy a texty kroků tutoriálu
- Then: slova „specialization(s)“ a „specialty“ (bez ohledu na velikost písmen) se nikde nevyskytují; „specialist(s)“ a „specialisation“ ve větě rámečku výsledku zůstávají (viz Out of Scope)

**Příklad 9: Šablona má anglické sloupce**
- Given: uživatel je v Advanced nebo Cash Flow s rozbalenou sekcí Backlog
- When: klikne na „↓ Template“
- Then: stáhne se `org-flow-template.xlsx` s listem „Backlog“ a sloupci v pořadí Feature, Skill, Unit, Size; ukázkové řádky jsou stejné jako dřív

**Příklad 10: Import souboru s anglickými sloupci**
- Given: soubor se sloupci Feature, Skill, Unit, Size a řádky Login/FE/Squad A/3, Login/BE/Squad B/2, Search/FE/Squad A/4, Search/QA/Squad B/1
- When: uživatel ho importuje
- Then: backlog má featury Login a Search, jednotky Squad A (FE) a Squad B (BE, QA), skilly FE, BE a QA; zpráva zní „Imported 2 features, 4 tasks, 2 units.“

**Příklad 11: Názvy sloupců bez ohledu na velikost písmen**
- Given: soubor se záhlavím „ feature “, „SKILL“, „unit“, „Size “
- When: uživatel ho importuje
- Then: import proběhne stejně jako s přesnými názvy

**Příklad 12: Starý soubor s českými sloupci**
- Given: soubor se sloupci Feature, Specializace, Tym, Velikost
- When: uživatel ho importuje
- Then: import se zastaví s hláškou „The file has no 'Skill' column. Check the header row.“ a backlog, jednotky ani skilly se nezmění

**Příklad 13: Chybějící sloupec**
- Given: soubor, kterému chybí jeden ze sloupců Feature, Skill, Unit, Size
- When: uživatel ho importuje
- Then: hláška zní „The file has no '<sloupec>' column. Check the header row.“ s anglickým názvem chybějícího sloupce

**Příklad 14: Neplatná velikost a limit jednotek**
- Given: soubor, kde 2 řádky mají v Size text místo čísla; jiný soubor s 51 různými hodnotami v Unit
- When: uživatel je importuje
- Then: u prvního se za zprávou o úspěchu objeví „2 rows skipped (invalid Size).“ (u jednoho řádku „1 row skipped (invalid Size).“); druhý se zastaví s hláškou „Too many units (max 50). The file contains more than 50 unique values in the Unit column.“

**Příklad 15: Jednotné číslo ve zprávě o importu**
- Given: soubor s jediným řádkem Login/FE/Squad A/3
- When: uživatel ho importuje
- Then: zpráva zní „Imported 1 feature, 1 task, 1 unit.“

**Příklad 16: Posuvníky v sekci Backlog mluví o skills** *(doplněno po review 2026-10-22)*
- Given: rozbalená sekce Backlog v Advanced nebo Cash Flow
- When: Min. skills per item je na 3 a Skill-mix variability na minimu, potom na maximu
- Then: hodnota prvního posuvníku je „≥ 3 skills“ (na 1 „no minimum“); druhý posuvník má popisek a přístupný název „Skill-mix variability“, nápovědu „How many different skills each item requires.“ a hodnotu „2 skills“ na minimu a „1–6 skills“ na maximu; v sekci Backlog se slovo „role(s)“ nikde nevyskytuje

## Out of Scope
- **Slovo „specialist(s)“** pro lidi: typy týmu v Compare („Single-skill specialists — each member has 1 role“, „Single-skill specialists team“ atd.) a tutoriál („pure specialists“, „six individual specialists“). Popisuje člověka, ne nastavení. Rozhodnuto 2026-10-22.
- **Věta v rámečku výsledku** „Deep specialisation meant each person stayed fully loaded.“ Jde o pojem, ne o název nastavení. Rozhodnuto 2026-10-22.
- **Slovo „roles“** v detailních krocích Compare, v tooltipech typu týmu a v nápovědě dlaždice Total Wait (rozhodnutí z feat-025). Posuvníky v sekci Backlog se naopak mění (Příklad 16).
- **Podpora starých souborů** s českými sloupci (Specializace, Tym, Velikost) a jakékoli upozornění „tento soubor je ve starém formátu“. Rozhodnuto 2026-10-22.
- **Další pravidla importu:** limity (200 featur, 50 jednotek), povolený rozsah velikosti (0 < Size ≤ 999), tiché přeskakování duplicit a prázdných řádků, mapování na role a barvy zůstávají podle feat-012.
- **Vnitřní názvy v kódu:** `minSpecializations`, `RoleMeta`, id kroku `experiment-specializations`, cíle `data-tutorial-target` (`…-specializations-accordion`), názvy souborů a české komentáře. Uživatel je nevidí a nastavení se neukládá do localStorage, takže přejmenování by jen zvětšilo změnu.
- Staré makety v `docs/` (historické podklady).
- Jiné jazyky než angličtina.

## Technical Notes
- **Dotčené soubory:**
  - `src/components/BacklogSettingsPanel.tsx`: hlavička sekce, posuvníky Min. skills per item a Skill-mix variability (popisek, hodnoty, nápověda), text potvrzovacího dialogu,
  - `src/components/RoleSettings.tsx`: popisek „Add skill“, `aria-label="Skill name"` (a zmínka v JSDoc),
  - `src/components/MemberCard.tsx`: `aria-label="Add skill"`,
  - `src/components/InProgressTeamPanel.tsx`: `hint="Click + to add a skill"`,
  - `src/lib/tutorialSteps.ts`: nadpis kroku `experiment-specializations` a text kroku `experiment-metrics`,
  - `src/lib/xlsImport.ts`: `REQUIRED_COLUMNS = ['feature', 'skill', 'unit', 'size']`, čtení buněk, hlášky (invalid Size, Too many units … Unit column), `formatImportSummary` („unit“ místo „team member“), ukázkové řádky a komentáře šířek sloupců v `downloadTemplate`, JSDoc a komentáře s českými názvy sloupců (proměnné `specializaceRaw`, `tymRaw`, `velikost` se přejmenují na anglické, aby kód odpovídal formátu).
- **Dotčené testy (změní se očekávané texty a testovací řádky):**
  - unit, texty v UI: `feat-022-ui.test.tsx` (názvy sekcí, „Add specialization“, nápověda „Click + to add a specialty“), `feat-025-simulator-integration.test.tsx` (přístupný název hlavičky), `feat-025-tutorial-steps.test.ts` (krok 8 a 13), `feat-017-revenue-curve-ui.test.tsx` (text dialogu), `feat-023-truncation-title.test.tsx` („Specialization name“), `feat-003-slider-aria-label.test.tsx` (popisek posuvníku, pro jednotnost),
  - unit, import: `feat-012-xls-import.test.ts`, `feat-022-import-english.test.tsx` (sloupce, hlášky, souhrn „units“) a testy, které si soubor pro import skládají s českými sloupci: `feat-016-coordination-overhead.test.ts`, `feat-017-prepinac-profilu.test.ts`, `feat-017-rozlozeni-vynosu.test.ts`, `feat-021-role-colors.test.ts`,
  - E2E: `tests/e2e/helpers.ts` a `feat-022-sjednoceni-designu.spec.ts` (název sekce, nápověda panelu Units), `feat-023-jednotne-pismo.spec.ts` (název sekce, „Add specialization“, nápověda panelu Units a importovaný soubor s českými sloupci).
- **Nové testy:** `tests/unit/simulation/feat-026-skill-naming.test.tsx` pro Příklady 1–8 a 16 (hlídač Příkladu 8 vyrenderuje Advanced a Cash Flow s rozbalenými sekcemi a projde texty a atributy `aria-label`/`title`, plus texty všech kroků v `tutorialSteps.ts`) a `tests/unit/simulation/feat-026-xls-english.test.ts` pro Příklady 9–15 (šablona přes mock `XLSX.writeFile` jako ve feat-022). E2E `tests/e2e/feat-026-skill-naming.spec.ts` ověří v prohlížeči sekci „Skills“ a nápovědu panelu Units (Příklady 1, 2, 6), skutečné stažení šablony (Příklad 9) a nahrání anglického i starého českého souboru (Příklady 10, 12).

### Kontrakt testů (fáze 4)
- Hlídač Příkladu 8 hledá `/specialization|specialty/i` v `document.body.textContent` a v atributech `aria-label`, `title`, `placeholder` a `alt` po kliknutí na všechna sbalená tlačítka (`aria-expanded="false"`: sekce nastavení, „?“, detaily dlaždic), dále na kartě jednotky před kliknutím na „+“ i po něm, v potvrzovacím dialogu výchozí sestavy a v nadpisech, textech a odrážkách všech kroků tutoriálu.
- Ukázkové řádky šablony se porovnávají s řádky před feat-026 (stejné hodnoty, nové názvy sloupců); šablona jde bez úprav naimportovat („Imported 3 features, 7 tasks, 2 units.“).
- Příklad 16 se ověřuje na samostatně vykresleném panelu nastavení s nastavením `minSpecializations` 1 / 3 a `roleVar` 0 / 1; kontrola „bez role(s)“ hledá `/\brole/i` v textu a atributech `aria-label` a `title` rozbalené sekce Backlog (prvek, který obaluje její hlavičku i obsah).
- Příklad 12 v Cash Flow ověřuje, že se po neúspěšném importu nezmění backlog (názvy featur), jednotky (názvy a skilly) ani sada skillů.
- **Dotčené specy:** po schválení dostanou krátkou poznámku „od feat-026 …“ (bez přepisování historie):
  - feat-003, feat-005, feat-007, feat-014, feat-022, feat-023, feat-025: sekce se v UI jmenuje „Skills“,
  - feat-012: sloupce jsou Feature, Skill, Unit, Size a hlášky podle feat-026,
  - feat-022: bod o ponechání českých sloupců (Out of Scope) a Příklad 12 (souhrn „team members“, „invalid Velikost“) platí jen do feat-026,
  - feat-025: odstraní se bod z Out of Scope o přejmenování.
- Chování simulace, engine ani typy se nemění.

## Open Questions
Žádné.

## Related Features
- **feat-005-konfigurace-specializaci, feat-007-sprava-specializaci:** zavedly sekci „Specializations“ a formulář pro přidání; feat-026 mění jen jejich názvy.
- **feat-003-konfigurace-backlogu:** posuvník „Min. specializations“ → „Min. skills per item“.
- **feat-012-xls-import:** formát souboru (sloupce) a hlášky importu; pravidla importu zůstávají.
- **feat-014-unit-mode-preset:** text potvrzovacího dialogu.
- **feat-022-sjednoceni-designu:** převedla hlášky importu do angličtiny a české sloupce vědomě ponechala; feat-026 to mění. Příklady a testy zmiňují sekci „Specializations“.
- **feat-023-jednotne-pismo-textu:** příklady a testy zmiňují sekci „Specializations“ a import.
- **feat-025-revize-tutorialu:** kroky 8 a 13 prohlídky Advanced; uzavírá bod z jejího Out of Scope.
