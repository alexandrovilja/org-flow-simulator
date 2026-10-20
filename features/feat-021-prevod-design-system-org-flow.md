# Feature: Převod na design system Org Flow

## Status
done

*Poznámka (feat-023, 2026-10-20): písma Archivo i Kalam se od feat-023 nepoužívají, celá aplikace je v JetBrains Mono (včetně titulků, záložek a tlačítek). Zmínky o Archivo a Kalam níže, zejména část „UI / Design: Písmo“, příklad 10 a Technical Notes „Písma“, popisují stav po feat-021 a jsou nahrazené specem feat-023.*

*Hotovo 2026-10-20 v pěti PR: tokeny a písma (#19), horní lišta a ovládání (#20), Kanban (#21), tým a metriky (#22), overlaye, tmavé téma a nastavení (#23); oprava horní lišty pro projektor 1024 px.*

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
- **Písmo:** Archivo místo Inter (titulky 800 verzálkami), JetBrains Mono pro popisky a čísla, Kalam jen pro poznámku kouče. Nic menšího než 10 px.
- **Barvy podle tokenů:** neutrální šedé plochy, fialová pro In progress a výběr. Stavy Done (zelená), čekání (okr) a rework (červená). Role čipy s bílým textem v osmi slotech: Design `role-rose`, Frontend/Payments `role-blue`, Backend/Platform `role-brick`, Testing/Integration Testing `role-green`, DevOps/CRM `role-ochre`, Data/Client Acquisition `role-teal`, vlastní specializace `role-violet` a `role-slate`.
- **Jednotné komponenty:** jeden segmentový přepínač pro typ týmu, preset, křivku výnosu i rychlost. Hranatá tlačítka. Karty features, jednotek a dlaždice metrik podle design systému. Tooltipy nápovědy na antracitu.
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
