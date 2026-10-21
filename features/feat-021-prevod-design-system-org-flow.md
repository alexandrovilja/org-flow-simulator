# Feature: Převod na design system Org Flow

## Status
done

*Poznámka (feat-023, 2026-10-20): písma Archivo i Kalam se od feat-023 nepoužívají, celá aplikace je v JetBrains Mono (včetně titulků, záložek a tlačítek). Zmínky o Archivo a Kalam níže, zejména část „UI / Design: Písmo“, příklad 10 a Technical Notes „Písma“, popisují stav po feat-021 a jsou nahrazené specem feat-023.*

*Hotovo 2026-10-20 v pěti PR: tokeny a písma (#19), horní lišta a ovládání (#20), Kanban (#21), tým a metriky (#22), overlaye, tmavé téma a nastavení (#23); oprava horní lišty pro projektor 1024 px.*

*Oprava chyby (2026-10-20): vybraná volba segmentového přepínače byla pod kurzorem nečitelná (text v barvě výplně), viz Příklad 12 a 13.*

*Změna (2026-10-20): ovládání běhu v horní liště je ve všech třech módech stejné jako v Compare — pořadí „?“, „↺ Reset“, rychlost 0.5× / 1× / 10×, „▶ Run“. V Advanced a Cash Flow mizí „Start“, „Resume“, „Reset backlog“ a rychlost 2×. Upraveno UI / Design (Horní lišta, nový bod Ovládání běhu), Příklad 13 a Technical Notes, nové Příklady 14–17.*

## Problem
Aplikace se promítá na workshopech, ale její vzhled na to není stavěný:

- **Špatná čitelnost na plátně.** Popisky mají 8–9,5 px. Tlumený text (`--ink-3`, 72 použití) má kontrast jen 3,1:1, bílý text na role čipech 2,6–3,6:1, barvy Done 3,5:1 a čekání (`--warn`) 2,8:1. Z druhé řady místnosti se to nedá přečíst.
- **Nejednotné ovládání.** Tři různé styly přepínačů (typ týmu, rychlost v Compare, rychlost v Advanced), sedm různých rádiusů a barvy rozeseté jako inline hodnoty po komponentách. Každá nová feature si vzhled vymýšlí znovu.
- **Chybí tmavé téma** pro zatemněné místnosti a slabé projektory.
- **Bezbarvá identita.** Generický vzhled s emoji v záložkách nepůsobí jako nástroj, který kouč s jistotou ukáže vedení.

Design system Org Flow (paleta Antracit a elektrická modř) tohle řeší jedním zdrojem pravdy pro barvy, písmo a komponenty. Aplikace ho ale zatím nepoužívá.

## User Story
*Jako agilní kouč, který simulátor promítá na workshopu, chci, aby aplikace byla čitelná z celé místnosti a vypadala jako jednotný, profesionální nástroj (i v zatemněné místnosti), abych mohl rozdíl ve struktuře týmu ukázat vedení bez vysvětlování, co na obrazovce vlastně je.*

## UI / Design
Rozložení obrazovek a chování zůstávají stejné, mění se vzhled podle design systému Org Flow (artefakt https://claude.ai/artifact/EvHZ56JjHa9D9etc85fy3Q). Schválený UI návrh (fáze 3): maketa `docs/design-system-mockup.html`. Texty UI zůstávají anglicky.

- **Horní lišta:** antracitová (`surface-bar`), 56 px. Vlevo značka (glyf tří uzlů) a název ORG FLOW SIMULATOR se žlutým heslem. Uprostřed záložky Compare / Advanced / Cash Flow bez emoji, aktivní má žlutou linku (`highlight`). Vpravo „?“, Reset, přepínač rychlosti a tlačítko **Run** v elektrické modři (`action`), které před prvním spuštěním pulzuje. Za běhu je to fialové **Pause** (`accent`), po doběhnutí zelené **✓ Done** (`done`). Na užší obrazovce (projektor 1024 × 768) zůstane vlevo jen glyf značky a název s heslem se schová (pro čtečky obrazovky zůstává), aby se značka, záložky a ovládání nepřekrývaly.
- **Ovládání běhu je ve všech módech stejné (změna 2026-10-20):** Advanced a Cash Flow přebírají ovládání z Compare. Vpravo za přepínačem tématu je vždy v tomto pořadí:
  1. **„?“** — znovu spustí tutoriál módu. Má ho Compare a Advanced; Cash Flow tutoriál nemá, proto tam „?“ chybí a ostatní prvky zůstávají ve stejném pořadí.
  2. **„↺ Reset“** — stejný popisek ve všech módech (v Advanced a Cash Flow dřív „↺ Reset backlog“). Co Reset vrací, se nemění: Compare vrátí oba týmy na Single / Double se stejným backlogem, Advanced a Cash Flow obnoví výchozí backlog (feat-001, Příklad 4; v Cash Flow navíc doběhnutý běh poslouží jako předchozí pro delta badge, feat-015). V Advanced a Cash Flow zůstává tooltip „Restore the initial backlog and clear in-progress / done“.
  3. **Rychlost 0.5× / 1× / 10×**, výchozí 1×. Volba 2× v Advanced a Cash Flow mizí. Každý mód si dál drží vlastní rychlost.
  4. **Tlačítko běhu:** „▶ Run“ (`action`, před prvním spuštěním pulzuje), za běhu „❙❙ Pause“ (`accent`), po pauze znovu „▶ Run“ bez pulzu a simulace pokračuje od stejného bodu, po zpracování celého backlogu „✓ Done“ (`done`), vypnuté. Popisky „▶ Start“ a „▶ Resume“ mizí. Po Resetu je tlačítko znovu pulzující „▶ Run“.
- **Písmo:** Archivo místo Inter (titulky 800 verzálkami), JetBrains Mono pro popisky a čísla, Kalam jen pro poznámku kouče. Nic menšího než 10 px.
- **Barvy podle tokenů:** neutrální šedé plochy, fialová pro In progress a výběr. Stavy Done (zelená), čekání (okr) a rework (červená). Role čipy s bílým textem v osmi slotech: Design `role-rose`, Frontend/Payments `role-blue`, Backend/Platform `role-brick`, Testing/Integration Testing `role-green`, DevOps/CRM `role-ochre`, Data/Client Acquisition `role-teal`, vlastní specializace `role-violet` a `role-slate`.
- **Jednotné komponenty:** jeden segmentový přepínač pro typ týmu, preset, křivku výnosu i rychlost. Vybraná volba vypadá pod kurzorem stejně jako bez něj; najetí myší zvýrazní jen nevybrané volby. Hranatá tlačítka. Karty features, jednotek a dlaždice metrik podle design systému. Tooltipy nápovědy na antracitu.
- **Výsledek v Compare:** rám s písmenem vítězného týmu, titulkem „Team B was 42% faster“, větou proč a ručně psanou poznámkou kouče. Bez emoji; týmy se nerozlišují barvou.
- **Tmavé téma Workshop dark:** nové tlačítko ☾/☀ v horní liště vedle „?“. Výchozí stav se řídí nastavením systému (`prefers-color-scheme`), volba uživatele se pamatuje.

## Specification by Example

**Příklad 1: Tokeny v globals.css**
- Given: aplikace načtená ve světlém tématu
- When: se přečtou CSS proměnné na `:root`
- Then: `--surface-bar` je `#121212`, `--action` `#2b59ff`, `--accent` `#7a3bf0`, `--highlight` `#ffe14d` a staré názvy (`--bg`, `--panel`, `--warn`, `--rework-ink`) už neexistují

**Příklad 2: Kontrast textu v obou tématech**
- Given: tokeny světlého i tmavého tématu v `globals.css`
- When: se spočítá kontrast textových párů z design systému (např. `ink-3` na `surface-page`, `on-action` na `action`)
- Then: každý textový pár má aspoň 4,5:1 a obrysy ovládacích prvků aspoň 3:1

**Příklad 3: Stavy tlačítka Run**
- Given: Compare před prvním spuštěním
- When: kouč klikne na Run, pak oba běhy doběhnou
- Then: nejdřív je „Run“ ve výplni `action` a pulzuje, za běhu „Pause“ ve výplni `accent`, po doběhnutí obou běhů „✓ Done“ ve výplni `done` a tlačítko je vypnuté

**Příklad 4: Záložky bez emoji**
- Given: libovolný mód
- When: se vykreslí horní lišta
- Then: záložky mají texty „Compare“, „Advanced“, „Cash Flow“ bez emoji a aktivní záložka má `aria-selected="true"`

**Příklad 5: Přepínač tématu**
- Given: žádná uložená volba a systém preferuje tmavý režim
- When: se aplikace načte, kouč klikne na ☀ a stránku znovu načte
- Then: po načtení je na `<html>` `data-theme="dark"`, po kliknutí `light` a volba přežije znovunačtení

**Příklad 6: Minimální velikost písma**
- Given: Compare, Advanced i Cash Flow po spuštění simulace
- When: se projdou viditelné textové prvky
- Then: žádný nemá vypočtenou velikost písma pod 10 px

**Příklad 7: Barvy rolí podle slotů**
- Given: preset People
- When: se vykreslí karty jednotek
- Then: Design má výplň `role-rose`, Frontend `role-blue`, Backend `role-brick`, Testing `role-green`, DevOps `role-ochre`, Data `role-teal`, vždy s bílým textem

**Příklad 8: Jednotný přepínač**
- Given: Compare a Advanced
- When: se vykreslí volba typu týmu a rychlosti
- Then: obě jsou stejná komponenta SegmentedControl (`role="group"`, tlačítka s `aria-pressed`); aktivní segment má v panelu výplň `ink`, na antracitové liště (rychlost) výplň `ink-on-bar`, protože `ink` by na liště stejné barvy nebyl vidět

**Příklad 9: Rám výsledku**
- Given: obě simulace v Compare doběhly a Team B má nižší průměrný lead time
- When: se zobrazí výsledek
- Then: rám obsahuje písmeno „B“, titulek „Team B was N% faster“ a větu proč, bez emoji a bez barvy podle týmu

**Příklad 10: Písma**
- Given: libovolná stránka aplikace
- When: se načte layout
- Then: `body` má písmo Archivo (font-family obsahuje „Archivo“), mono prvky JetBrains Mono a stránka nestahuje písma z `fonts.googleapis.com` (jsou přibalená přes `next/font`)

**Příklad 11: Horní lišta na projektoru 1024 px**
- Given: okno široké 1024 px (běžný projektor), resp. 1280 px
- When: se v módu Compare, Advanced i Cash Flow vykreslí horní lišta
- Then: viditelná značka končí před záložkami, záložky končí před ovládáním vpravo a stránka se vodorovně neroluje; při 1280 px je vidět celý název ORG FLOW SIMULATOR

**Příklad 12: Vybraná volba přepínače pod kurzorem zůstane čitelná**
- Given: Compare, Advanced i Cash Flow s otevřenými akordeony nastavení, ve světlém i tmavém tématu
- When: kouč najede myší na vybranou volbu každého přepínače (rychlost na liště, typ týmu v obou sloupcích Compare, preset jednotek, křivka výnosu, režim WIP, Coordination overhead)
- Then: výplň i barva textu zůstanou stejné jako bez najetí (v panelu `ink` a `surface-panel`, na liště `ink-on-bar` a `surface-bar`) a kontrast textu proti výplni je aspoň 4,5:1

**Příklad 13: Nevybraná volba na najetí reaguje jako dřív**
- Given: světlé téma; v Advanced vybraný preset Teams a rychlost 1×
- When: kouč najede myší na „People“ a pak na „10×“
- Then: text „People“ změní barvu z `ink-3` na `ink`, text „10×“ z `ink-on-bar` na `ink-inverse`; výplň obou zůstane průhledná
- Note: dřív se příklad ověřoval na rychlosti „2×“, ta byla změnou 2026-10-20 zrušena

**Příklad 14: Stejné ovládání běhu ve všech třech módech (změna 2026-10-20)**
- Given: Compare, Advanced i Cash Flow před prvním spuštěním
- When: se vykreslí ovládání v pravé části horní lišty
- Then: za přepínačem tématu je v tomto pořadí „?“ (jen Compare a Advanced), „↺ Reset“, přepínač rychlosti s volbami „0.5×“, „1×“, „10×“ (vybraná „1×“) a pulzující „▶ Run“; v žádném módu není tlačítko „Start“, „Resume“ ani „Reset backlog“ a žádná volba „2×“

**Příklad 15: Stavy tlačítka běhu v Advanced a Cash Flow**
- Given: Advanced před prvním spuštěním (v Cash Flow totéž)
- When: kouč klikne na „▶ Run“, pak na „❙❙ Pause“, pak znovu na „▶ Run“ a nechá simulaci doběhnout
- Then: nejdřív je „▶ Run“ ve výplni `action` a pulzuje; za běhu „❙❙ Pause“ ve výplni `accent`; po pauze znovu „▶ Run“, už bez pulzu, a simulační čas od pauzy neběží; po dalším kliknutí pokračuje od stejného bodu; po zpracování celého backlogu „✓ Done“ ve výplni `done` a tlačítko je vypnuté

**Příklad 16: Reset vrátí tlačítko běhu na začátek**
- Given: Advanced po doběhnutí simulace, tlačítko ukazuje „✓ Done“ (v Cash Flow totéž)
- When: kouč klikne na „↺ Reset“
- Then: tlačítko je znovu pulzující „▶ Run“ a backlog je obnovený jako dřív (feat-001, Příklad 4)

**Příklad 17: Tutoriál Advanced popisuje nové ovládání**
- Given: tutoriál módu Advanced
- When: dojde na krok ovládání (`experiment-controls`) a na poslední krok (`experiment-run`)
- Then: zvýrazněná oblast kroku ovládání obsahuje „?“, „↺ Reset“, rychlost i tlačítko běhu (stejně jako `compare-controls` v Compare); text kroku ovládání je „Simulation controls: choose speed (0.5×, 1×, or 10×) or reset the run to restore the original backlog and start fresh.“ a text posledního kroku „Click ▶ Run to start the simulation. Adjust the team, reset, and re-run as many times as you like.“

## Out of Scope
—

## Technical Notes
- **Postup v pěti PR** (jedna spec, status `in-progress`, dokud nejsou hotové všechny; každé PR se zelenými testy):
  1. tokeny a písma (`globals.css`, `layout.tsx`),
  2. horní lišta, tlačítka, SegmentedControl a SpeedControl,
  3. Kanban (PanelHeader, FeatureCard, CoordinationChips),
  4. tým a metriky (RoleChip, MemberCard, StatTile, LeadTimeChart, RevenueCurvePreview, WinnerBanner),
  5. overlaye (TutorialOverlay, ConfirmOverlay, HelpIcon) a tmavé téma s přepínačem.
- **Tokeny:** `src/app/globals.css` dostane celou sadu z design systému (`project/tokens.json` v artefaktu) pod novými názvy (`--bg` → `--surface-page`, `--panel` → `--surface-panel`, `--warn` → `--wait`, `--rework-ink` → `--rework`…; úplný převod je v sekci Mapování design systému) a tmavé hodnoty pod `[data-theme="dark"]`. Staré názvy se nenechávají jako aliasy.
- **Písma (rozhodnuto):** `src/app/layout.tsx` načte Archivo (400–800), JetBrains Mono (400–700) a Kalam (700) přes `next/font/google` místo `<link>` na Google Fonts. Je součástí Next.js (žádná nová npm závislost), písma se přibalí při buildu, takže fungují i na workshopu bez internetu a neproblikne písmo. Rodiny se zpřístupní jako CSS proměnné, na které odkazují `--font-display`, `--font-sans`, `--font-mono` a `--font-hand`.
- **Styly komponent:** statické inline styly se přesunou do `.module.css` vedle komponent (podle CLAUDE.md), inline zůstanou jen vypočítané hodnoty (`--hue` feature, `--role` čipu, šířky barů). Výchozím bodem jsou třídy `of-*` z `project/components/bundle.css` v artefaktu a maketa `docs/design-system-mockup.html`.
- **Role:** `ROLE_META` a `PRESETS` v `src/simulation/engine.ts` dostanou barvy `var(--role-…)` podle slotů. Engine zůstává bez Reactu, mění se jen řetězce barev. Výběr barvy pro vlastní specializace (`COLOR_PRESETS` v `src/components/RoleSettings.tsx`, dnes 16 odstínů) se zúží na 8 role tokenů, protože bílý text na dnešních pastelech neprojde kontrastem. `ROLE_HUES` v `src/lib/xlsImport.ts` se nahradí sloty 1–8 v pořadí výskytu role v souboru a pak znovu od 1 (import nahrazuje celou sadu rolí, proto začíná prvním slotem).
- **Víc než 8 specializací (rozhodnuto):** sloty se opakují od začátku; dvě role pak mají stejnou barvu a liší se textem čipu.
- **Tmavé téma:** volba se ukládá přes `src/lib/storage.ts`; nová komponenta `ThemeToggle`; `data-theme` na `<html>`.
- **Bez probliknutí tématu (rozhodnuto):** malý inline skript v `<head>` v `layout.tsx` nastaví `data-theme` z uložené volby (nebo `prefers-color-scheme`) ještě před vykreslením. Je to jediná vědomá výjimka z pravidla „localStorage jen přes `storage.ts`“; skript musí mít komentář s odůvodněním a používat stejný klíč jako `storage.ts`.
- **Testy:** kontrast (příklad 2) jako Vitest test, který čte hodnoty z `globals.css` a počítá poměr podle WCAG (vlastní malá funkce, bez knihovny). Velikost písma (příklad 6) a téma (příklad 5) jako Playwright E2E. Existující testy v `tests/unit/simulation/` používají barvy rolí jen jako data (`oklch(…)`), takže by měly projít beze změny.
- **Dotčené soubory:** `globals.css`, `layout.tsx`, `engine.ts`, `xlsImport.ts`, `storage.ts`, `Simulator.tsx` a prakticky všechny komponenty v `src/components/` a jejich `.module.css`.
- **Oprava přepínače pod kurzorem (Příklad 12 a 13):** v `src/components/SegmentedControl.module.css` má pravidlo pro najetí `.segment:hover:not(:disabled)` specificitu (0,3,0) a přebije vybranou volbu `.segment[aria-pressed='true']` (0,2,0); na liště totéž (`.bar …:hover` 0,4,0 proti 0,3,0). Vybraná volba tak pod kurzorem dostala barvu textu pro nevybranou: kontrast 1:1 v panelu (obě témata), 1,35:1 na liště. Oprava: pravidla pro najetí omezit na `[aria-pressed='false']`; bez `!important` a bez nového tokenu, mění se jen tento CSS modul. Artefakt design systému chybu nemá (`.of-seg button:hover` a `[aria-pressed="true"]` mají stejnou specificitu a vybraná volba je v kaskádě později), chyba vznikla až přidáním `:not(:disabled)` při převodu. Testy jako Playwright E2E v `tests/e2e/feat-021-design-system.spec.ts` (jsdom nepočítá styly z CSS modulů ani `:hover`), barvy číst až po doběhnutí přechodu (0,2 s) přes `getAnimations()` (hned po najetí je barva ještě výchozí a chyba by se neprojevila; `expect.poll` by tak prošel dřív, než se barva změní), kontrast počítá nový pomocník `contrastRatio` v `tests/e2e/helpers.ts`. Audit najetím na všech 288 stavů tlačítek (3 módy × 2 témata) našel tuto chybu jen u přepínačů.
- **Jednotné ovládání běhu (Příklad 14–17, změna 2026-10-20):**
  - Jedna komponenta pro všechny tři módy: `SpeedControl` (`src/components/SpeedControl.tsx`) vykreslí prvky v pořadí Compare — „?“, „↺ Reset“, rychlost, tlačítko běhu. „?“ jen když dostane nový nepovinný prop `onRestartTutorial` (Cash Flow ho nepředá). Nepovinný prop `resetTitle` nese tooltip Resetu (Advanced a Cash Flow ho předají, Compare ne). Komponenta dál vrací fragment.
  - Rychlosti na jednom místě: `SPEEDS` v `SpeedControl.tsx` = `[0.5, 1, 10]` a typ `SimSpeed = 0.5 | 1 | 10` v `src/types/simulation.ts` (sdílený typ nepatří do souboru komponenty, viz `docs/conventions.md`). Konstanta `COMPARE_SPEEDS` v `Simulator.tsx` zmizí.
  - Tlačítko běhu: popisek „▶ Run“ před startem i po pauze (`pulse` jen dokud `hasStarted` je `false`), „❙❙ Pause“ za běhu, „✓ Done“ vypnuté, když je `finished`. Prop `hasStarted` dál řídí jen pulz.
  - Compare přestane skládat vlastní tlačítka (`compareRunButton` a ruční `SegmentedControl` v `Simulator.tsx`) a použije `SpeedControl` s `finished` = oba běhy doběhly. Rychlost drží ve všech třech módech stejný hook `useSimSpeed` (`src/hooks/useSimSpeed.ts`): vrací `speed` (pro přepínač), `speedRef` (čte ho smyčka RAF) a `setSpeed`, který přepíše ref hned a stav při překreslení. Dřív Compare přepisoval ref ručně a Advanced s Cash Flow ho synchronizovaly až v `useEffect` po překreslení; teď platí nová rychlost ve všech módech od dalšího snímku.
  - Obal `controls` s cílem tutoriálu dál vykresluje `Simulator.tsx`: `compare-controls` beze změny, `experiment-controls` nově obaluje celé ovládání včetně „?“ (dnes jen Run, rychlost a Reset), Cash Flow obal bez cíle. Cíle tlačítka běhu (`compare-run-button`, `experiment-run-button`, `cashflow-run-button`) zůstávají.
  - Handlery běhu a Resetu v `Simulator.tsx` se nemění; mění se jen pořadí, popisky a sada rychlostí.
  - Texty tutoriálu v `src/lib/tutorialSteps.ts`: kroky `experiment-controls` a `experiment-run` podle Příkladu 17. Text Compare (`compare-controls`) už rychlosti 0.5×, 1×, 10× uvádí.
  - Testy: Vitest + RTL nad `SpeedControl` (pořadí, popisky, rychlosti, „?“ jen s callbackem, tooltip Resetu, cíl tutoriálu ve stavech Run / Pause / Done), nad `useSimSpeed` (ref se přepíše hned, stabilní setter, nezávislé módy) a integrační test `Simulator` po módech (Příklad 14–16); texty tutoriálu jako unit test nad `TUTORIAL_STEPS`. Existující testy, které klikají na „Start“ / „Resume“ / „Reset backlog“ nebo vybírají rychlost „2×“, se přepíšou na „Run“ / „Reset“ / „10×“: unit `feat-001-done-count-panels`, `feat-017-simulator-integration`, `feat-018-simulator-integration`, `feat-019-simulator-integration`; E2E `helpers.ts` (`runButton` bez „Start“), `feat-015-cash-flow-mod`, `feat-021-design-system` (Příklad 13 na „10×“), `feat-022-sjednoceni-designu`, `feat-023-jednotne-pismo`.

## Open Questions
—

## Related Features
- **feat-002, feat-014-unit-mode-preset:** barvy rolí v presetech nahradí role tokeny podle slotů.
- **feat-007-sprava-specializaci, feat-007b-color-picker-panel:** předvolby barev pro specializace se zúží na 8 role tokenů.
- **feat-008-preference-kontinuity, feat-011-compare-team-picker, feat-016, feat-017:** všechny přepínače používají jednotný `SegmentedControl`.
- **feat-009-dva-mody-ui, feat-015-cash-flow-mod:** záložky bez emoji; winner banner se mění na rám výsledku.
- **feat-012-xls-import:** importované role dostanou barvy slotů 1–8 v pořadí výskytu.
- **feat-013-zprehledneni-aplikace:** přestyluje se `HelpIcon` a karta tutoriálu.
- **feat-016-coordination-overhead:** tokeny reworku se přejmenují (`--rework-ink` → `--rework`, `--rework-bg` → `--rework-soft`).
- **feat-019-ai-multiplikator-vykonu:** AI odznak bude fialový (`--accent`).
- **feat-001-simulace-prubehu-vyvoje, feat-003-konfigurace-backlogu, feat-004-analyza-lead-time, feat-015-cash-flow-mod (změna 2026-10-20):** ovládání běhu v Advanced a Cash Flow je stejné jako v Compare („▶ Run“ místo „Start“ / „Resume“, „↺ Reset“ místo „Reset backlog“, rychlosti 0.5× / 1× / 10×); popisky v jejich příkladech jsou upravené.
- **feat-013-zprehledneni-aplikace (změna 2026-10-20):** texty kroků tutoriálu Advanced o ovládání a tlačítku běhu (Příklad 17).
- **feat-024-zpetna-vazba-uzivatelu (rozpracováno):** horní lišta dostane ikonu bubliny („Send feedback“) vlevo od přepínače tématu ve všech módech; lišta se musí dál vejít na 1024 px (Příklad 11). Dialog zpětné vazby vychází ze vzoru `ConfirmOverlay`. Ovládání běhu (Příklady 14–17) se nemění.
- **feat-025-revize-tutorialu (draft):** „?“ v ovládání bude i v Cash Flow (Příklad 14 zde uvádí jen Compare a Advanced); popisek rámečku výsledku se mění z „Result · avg lead time“ na „Result · avg cycle time“; karta tutoriálu dostane nadpis, název části v hlavičce a „← Back“ ve stylu design systému; pulzující rámeček zvýraznění bude mít ostré rohy místo zaoblení 15 px.
