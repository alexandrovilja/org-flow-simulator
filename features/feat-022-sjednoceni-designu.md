# Feature: Sjednocení designu v celém nástroji

## Status
done

*Hotovo 2026-10-20 v jednom PR (#26, 30f17a7), včetně code review (9 nálezů opraveno). Smoke test produkce prošel: písma a velikosti ve všech módech, akordeony bez emoji, čísla v Done v mono, 404 z tokenů.*

*Poznámka 2026-10-22 (feat-026): sekce „Specializations“ se v UI jmenuje „Skills“. Sloupce importu jsou nově anglicky (Feature, Skill, Unit, Size), takže bod o ponechání českých sloupců v Out of Scope už neplatí; v Příkladu 12 platí „units“ místo „team members“ a „invalid Size“ místo „invalid Velikost“.*

## Problem
Převod na design system Org Flow (feat-021) přestyloval komponenty design systému, ale části obrazovky, které žádnou komponentou nejsou, zůstaly ve starém stylu. Vedle nového vzhledu jsou proto vidět zbytky starého a nástroj nepůsobí jednotně:

- **Stará písma a velikosti mimo typovou škálu.** Nadpisy „Units“ a „Metrics“ jsou v proporcionálním Archivo 12 px, kdežto „Backlog“, „In Progress“ a „Done“ vedle nich v mono verzálkách. Poznámky „Click + to add a specialty“ (11 px) a „N features sampled“ (10 px) mají jinou velikost než „auto-scaled“ (12 px). Čísla v seznamu Done („€299/tick“, „3 tasks“, „12.4s“) jsou v proporcionálním písmu, ačkoli design system chce čísla vždy v mono. Názvy týmů v Compare mají 16 px místo stylu `heading` (20 px).
- **Emoji v nastavení.** Akordeony „♻ Backlog“, „⚙ Specializations“, „👥 Team“, tlačítko „♻ Generate new backlog“, poznámka „🔒 Takes effect after Reset“ a koš 🗑 u specializací. Design system emoji v UI zakazuje (záložky a rám výsledku je už nemají).
- **Česky uprostřed anglického UI.** Tlačítko „↓ Šablona“ vedle „↑ Import XLS“, česká zpráva po importu („Importováno: …“) a chyby („Soubor neobsahuje žádná data.“) pod ním a česky pojmenovaný stahovaný soubor `org-flow-sablona.xlsx`.
- **Stránka 404** má systémové písmo a staré barvy (`#16161a`, `#8a8a92`, starou modrou) a v tmavém tématu nefunguje.
- **Další nastavení natvrdo.** Rozložení obrazovek, mezery, rádiusy a písmo v `Simulator.tsx`, `CashFlowPanel.tsx` a `InProgressTeamPanel.tsx` jsou zapsané jako inline hodnoty (`320px 1fr 280px`, `borderRadius: 12`, `fontSize: 10`…) místo tokenů. Tlačítko „+ Add unit“ je vlastní čárkovaný prvek s rádiusem 4 px, ne tlačítko design systému.

## User Story
*Jako agilní kouč, který simulátor promítá na workshopu, chci, aby celý nástroj vypadal podle jednoho design systému bez zbytků starého vzhledu, aby působil jako hotový profesionální produkt a publikum nerozptylovaly nesourodé detaily.*

## UI / Design
Rozložení obrazovek, texty (kromě „Šablona“) a chování zůstávají stejné. Mění se vzhled zbylých míst podle design systému Org Flow (artefakt https://claude.ai/artifact/EvHZ56JjHa9D9etc85fy3Q) a schválené makety `docs/design-system-mockup.html`, která už tyto části v novém stylu ukazuje (třídy `of-panel-head`, `acc-head`, `add-unit`, `done-row`).

- **Nadpisy panelů:** „Units“ a „Metrics“ dostanou stejnou hlavičku jako ostatní panely (PanelHeader): nadpisek `eyebrow` (JetBrains Mono 11 px, verzálky), počet vedle něj, poznámka vpravo v `body-sm` (Archivo 12 px, `ink-3`).
- **Akordeony nastavení:** hlavičky „Backlog“, „Specializations“, „Team“ bez emoji, ve stylu `eyebrow`, se šipkou vpravo (▸ zavřeno, ▾ otevřeno), jako v maketě.
- **Bez emoji:** „Generate new backlog“ bez ikony, „Takes effect after Reset“ bez zámku, smazání specializace a zavření výběru role glyfem „×“, chybová zpráva importu „×“ místo „✗“.
- **Texty anglicky:** „↓ Šablona“ → „↓ Template“, soubor šablony `org-flow-template.xlsx`, zprávy po importu a chyby importu anglicky.
- **Čísla v mono:** počet tasků, lead time, výnos za tick, celkový výnos a přírůstek v seznamu Done a rozpad coordination overhead v JetBrains Mono.
- **Tlačítko „+ Add unit“ / „+ Add member“ / „+ Add team“** (podle presetu): hranaté tlačítko design systému přes celou šířku, čárkovaný obrys `line-control`, text `ink-3`.
- **Typová škála i v Compare:** názvy týmů ve stylu `heading` (20 px), písmeno vítěze v rámu výsledku 20 px místo 24 px.
- **Stránka 404:** písma a barvy z tokenů, „404“ ve stylu `display-xl`, odkaz zpět v `accent`; funguje ve světlém i tmavém tématu.
- **Rozměry z tokenů:** postranní sloupce `--size-sidebar` a `--size-aside`, sloupce Compare `--radius-lg` s mezerou `--space-12`, mezery a rádiusy přes `--space-*` a `--radius-*`. Vizuálně se tím téměř nic nemění, ale hodnoty mají jeden zdroj.

## Specification by Example

**Příklad 1: Nadpisy Units a Metrics jako ostatní panely**
- Given: Advanced nebo Cash Flow
- When: se vykreslí střední a pravý sloupec
- Then: nadpisy „Units“ a „Metrics“ mají stejné písmo, velikost, řez a verzálky jako „Backlog“, „In Progress“ a „Done“ (JetBrains Mono 11 px); počet jednotek stojí vedle nadpisu ve stejném stylu jako počet u Backlogu; poznámky „Click + to add a specialty“ a „N features sampled“ mají Archivo 12 px v `ink-3` jako „auto-scaled“

**Příklad 2: Akordeony nastavení**
- Given: postranní panel nastavení v Advanced nebo Cash Flow
- When: se vykreslí hlavičky akordeonů a kouč na ně klikne
- Then: hlavičky mají texty „Backlog“, „Specializations“ a „Team“ bez emoji, ve stylu `eyebrow` (JetBrains Mono 11 px, verzálky), vpravo ▸ u zavřeného a ▾ u otevřeného; kliknutí je dál otevírá a zavírá a `aria-expanded` odpovídá stavu

**Příklad 3: Ovládání bez emoji**
- Given: nastavení se všemi akordeony otevřenými, Cash Flow s coordination overhead zamčeným během běhu a import XLS, který skončil chybou
- When: se vykreslí tlačítka a poznámky
- Then: tlačítko zní „Generate new backlog“, poznámka „Takes effect after Reset“, smazání specializace ukazuje „×“ s přístupným názvem „Delete <název role>“, chybová zpráva importu začíná „×“ a zavírací tlačítko výběru role na kartě jednotky je „×“

**Příklad 4: Žádné emoji ve zdrojích UI**
- Given: soubory `.tsx` v `src/components/` a `src/app/`
- When: se z nich vezmou texty mimo komentáře
- Then: neobsahují žádné emoji; povolené jsou jen typografické glyfy design systému (▶ ❙ ↺ ⇄ ✓ × ↑ ↓ → ▸ ▾ ▴ a ⚡ v AI odznaku)

**Příklad 5: Šablona importu anglicky**
- Given: otevřený akordeon Backlog
- When: se vykreslí tlačítka importu
- Then: vedle „↑ Import XLS“ je „↓ Template“ (žádné „Šablona“) a kliknutí stáhne soubor `org-flow-template.xlsx` se stejným obsahem jako dřív

**Příklad 6: Čísla v seznamu Done v mono**
- Given: Advanced i Cash Flow (se zapnutým coordination overhead) po dokončení několika features
- When: se vykreslí seznam Done a dlaždice Coordination overhead
- Then: počet tasků („3 tasks“), lead time („12.4s“), výnos za tick („€299/tick“), celkový výnos, přírůstek („+€299“) i rozpad „handoff N % · rework N %“ jsou v JetBrains Mono

**Příklad 7: Tlačítko přidání jednotky**
- Given: Advanced a Cash Flow
- When: se vykreslí tlačítko pod kartami jednotek („+ Add unit“, „+ Add member“ nebo „+ Add team“ podle presetu)
- Then: je to tlačítko design systému přes celou šířku: rádius 0, Archivo 800 verzálkami, čárkovaný obrys a text `ink-3`; kliknutí přidá jednotku jako dřív

**Příklad 8: Typová škála v Compare**
- Given: Compare, obě simulace doběhly
- When: se vykreslí hlavičky týmů a rám výsledku
- Then: názvy týmů („Single-skill specialists team“) mají styl `heading` (Archivo 800, 20 px, verzálky) a písmeno vítěze v odznaku rámu má 20 px

**Příklad 9: Písma a velikosti v celé aplikaci**
- Given: Compare, Advanced i Cash Flow po spuštění simulace, se všemi akordeony nastavení otevřenými
- When: se projdou všechny viditelné textové prvky
- Then: každý má písmo Archivo, JetBrains Mono nebo Kalam, velikost z typové škály design systému (10, 11, 12, 13, 15, 20, 28, 36 nebo 56 px) a žádný neobsahuje emoji

**Příklad 10: Stránka 404**
- Given: neexistující adresa (např. `/neexistuje`) ve světlém i v tmavém tématu
- When: se stránka načte
- Then: text má písmo Archivo, „404“ je ve stylu `display-xl` (Archivo 800, 56 px), barva textu odpovídá `--ink` a pozadí `--surface-page` aktuálního tématu a odkaz „← Back to simulator“ má barvu `--accent`

**Příklad 11: Inline styly jen pro vypočítané hodnoty**
- Given: všechny soubory `.tsx` v `src/`
- When: se projdou objekty stylů, i ty, které se do `style` dostávají přes proměnnou nebo podmínku (např. `const s: CssVariables | undefined = x ? { … } : undefined`)
- Then: žádný nenastavuje písmo (`fontSize`, `fontFamily`, `fontWeight`, `letterSpacing`, `lineHeight`, `textTransform`), mezery (`padding*`, `margin*`, `gap`), rádiusy (`borderRadius`) ani mřížku (`gridTemplateColumns`); inline zůstávají jen vypočítané hodnoty (šířky a výšky barů, pozice tutoriálu, `--hue`, `--role`, barva vybrané role)

**Příklad 12: Import XLS anglicky**
- Given: kouč importuje soubor XLS (platný, s přeskočenými řádky, nebo vadný)
- When: se pod tlačítky importu ukáže zpráva
- Then: úspěch zní „Imported 8 features, 18 tasks, 2 team members.“ (jednotné číslo „1 feature, 1 task, 1 team member“), varování „2 rows skipped (invalid Velikost).“ a chyby „The file contains no data.“, „The file has no 'Feature' column. Check the header row.“, „Backlog too large (max 200 features). The file contains more than 200 unique features.“, „Too many team members (max 50). The file contains more than 50 unique values in the Tym column.“, „The file contains no valid data.“; obecné selhání čtení „Could not read the file.“ / „Could not load the file.“; názvy sloupců v souboru (Feature, Specializace, Tym, Velikost) se nemění, aby fungovaly soubory, které už uživatelé mají

**Příklad 13: Přírůstek výnosu při omezeném pohybu**
- Given: systém má zapnuté omezení pohybu (`prefers-reduced-motion: reduce`) i vypnuté, Cash Flow s hotovými features
- When: výnos tikne a pod celkovým výnosem se ukáže přírůstek „+€X“
- Then: animace přírůstku v obou režimech končí průhledná (poslední krok má `opacity: 0`), takže přírůstek po chvíli zmizí a nezůstane trvale vidět; při omezeném pohybu se přírůstek neposouvá (jen vybledne)

**Příklad 14: Nápověda přepínače**
- Given: Advanced, otevřený akordeon Team
- When: kouč najede na volbu „Min units“ a zobrazí se dlouhá nápověda
- Then: nápověda je široká nejvýš 260 px, text se zalamuje (`white-space: normal`) a pravidla šířky a zalomení jsou v CSS modulu, ne inline

## Out of Scope
- **TeamMap** (mapa týmu z design systému) — potřebuje vlastní spec, jak rozhodla feat-021.
- **Nativní prvky prohlížeče** (checkbox „Req.“, posuvníky) zůstávají nativní; barvy jim už dává `color-scheme` z feat-021.
- **Úpravy textů** mimo „Šablona“, odstranění emoji a překlad zpráv a názvu souboru při importu.
- **Názvy sloupců šablony XLS** (Feature, Specializace, Tym, Velikost) zůstávají česky: jsou součástí formátu souborů, které už uživatelé mají, a jejich přejmenování by import rozbilo.
- **Změny rozložení a chování** — žádný panel se nepřesouvá, nic nového nepřibývá.

## Technical Notes
- **Jedno PR** na větvi `feat/022-sjednoceni-designu` z `main`.
- **Nové CSS moduly** pro dosud inline stylované části: `Simulator.module.css` (mřížky tří módů, sloupce Compare, pravý panel Advanced), `CashFlowPanel.module.css` (pravý panel, rozpadový pruh), `InProgressTeamPanel.module.css` (In progress, Units, „+ Add unit“), `SpeedControl.module.css` a `src/app/not-found.module.css`. Statický kořenový flex v `ComparePanel.tsx` se přesune do jeho modulu. Šířka a zalomení plovoucí nápovědy v `SegmentedControl.tsx` se také přesunou do modulu; schválený test feat-016 (Příklad 17) se upraví, aby místo inline `style.maxWidth` ověřoval pravidlo v CSS modulu (import `?raw`), protože jsdom styly z modulů nepočítá. `LeadTimeChart.tsx` předá okraje grafu (konstanty sdílené s pozicemi os) jako CSS proměnné místo inline `paddingLeft`/`paddingRight`.
- **PanelHeader:** `count` bude volitelný, aby ho mohla použít hlavička „Metrics“ (má jen poznámku „N features sampled“). Pravý panel Advanced a Cash Flow tak sdílí stejnou hlavičku.
- **Akordeon:** v `BacklogSettingsPanel` dostane šipku ▸/▾ jako samostatný `aria-hidden` prvek, aby přístupný název tlačítka zůstal jen „Backlog“, „Specializations“, „Team“.
- **„+ Add unit“** použije komponentu `Button` s novou variantou (čárkovaný obrys, průhledné pozadí, `ink-3`), ne vlastní styl.
- **DoneRow:** `detail` a `aside` v JetBrains Mono (`detail` styl `micro`, hodnota v `aside` styl `code` s řezem 600, přírůstek „+€X“ styl `micro`). Inline `fontSize` u hodnot v `Simulator.tsx` a `CashFlowPanel.tsx` zmizí.
- **Společný pravý panel:** nová komponenta `ResultsAside` (+ `ResultsAside.module.css`) nese rozložení pravého sloupce (Metrics nahoře, Done dole) pro Advanced i Cash Flow; Simulator a CashFlowPanel jí předají dlaždice a řádky Done. Odpadají duplicitní CSS třídy v `Simulator.module.css` a `CashFlowPanel.module.css`.
- **SpeedControl** vrací fragment místo vlastního flex obalu (rozložení drží `controls` v liště), takže odpadá `SpeedControl.module.css`.
- **Import:** zprávy a chyby v `xlsImport.ts` anglicky, nová exportovaná `formatImportSummary(result)` skládá zprávu o úspěchu pro Advanced i Cash Flow (dnes je zkopírovaná v `Simulator.tsx` a `useCashFlowSimSetup.ts`); šablona se stahuje jako `org-flow-template.xlsx`. Test feat-012 (`/přeskočen/i`) se změní na `/skipped/i`.
- **Reduced motion:** `.delta` v `DoneRow.module.css` místo `animation: none` použije jen opacity (keyframes `revenue-fade`), takže přírůstek po 1,6 s zmizí.
- **LeadTimeChart** (komponenta design systému, dnes nikde nevykreslená) se nemaže; dostane test vykreslení a CSS proměnných okrajů.
- **E2E:** společné pomocné funkce (`BASE`, `groupWith`, `runButton`, přeskočení tutoriálu) v `tests/e2e/helpers.ts`, používají feat-021 i feat-022; hlídač inline stylů čte celý soubor `.tsx`, ne jen literály `style={{…}}`.
- **Testy:** příklady 4 a 11 jako Vitest testy, které čtou zdroje v `src/` (podobně jako test starých názvů tokenů ve feat-021); příklady 1–3, 5–7 jako testy komponent (Testing Library, `getComputedStyle` jen tam, kde jsou styly z CSS modulů dostupné, jinak třída nebo role); příklady 8–10 jako Playwright E2E (skutečně vypočtené písmo a velikosti).
- **Stávající testy:** 6 testovacích souborů (feat-001, feat-015, feat-017, feat-018, feat-019) hledá akordeony podle textu s emoji („♻ Backlog“, „⚙ Specializations“, „👥 Team“); selektory se přepíšou na nové texty, chování testů se nemění.
- **Dotčené soubory:** `Simulator.tsx`, `CashFlowPanel.tsx`, `InProgressTeamPanel.tsx`, `BacklogSettingsPanel.tsx`/`.module.css`, `RoleSettings.tsx`/`.module.css`, `MemberCard.tsx`, `PanelHeader.tsx`, `DoneRow.module.css`, `ComparePanel.tsx`/`.module.css`, `WinnerBanner.module.css`, `SpeedControl.tsx`, `Button.tsx`/`.module.css`, `LeadTimeChart.tsx`/`.module.css`, `src/app/not-found.tsx` a nové moduly výše.

## Open Questions
—

## Related Features
- **feat-023-jednotne-pismo-textu:** od feat-023 se nepoužívá Archivo ani Kalam, celá aplikace je v JetBrains Mono. Zmínky o Archivo v tomto specu (např. nadpisy a poznámky v příkladech 1, 7, 8, 9 a 10) popisují stav po feat-022; příslušné E2E testy už čekají mono. (Poznámka je v Related Features, aby se nedotkla bloku Status, který mění docs PR se statusem done.)
- **feat-021-prevod-design-system-org-flow:** tato feature dotahuje převod do míst, která feat-021 nepokryla.
- **feat-001, feat-015, feat-018:** hlavičky a seznam Done v pravém panelu.
- **feat-007-sprava-specializaci:** tlačítko smazání specializace („×“ místo 🗑).
- **feat-012-xls-import:** tlačítko „↓ Template“, soubor `org-flow-template.xlsx` a anglické zprávy po importu (v testu se mění jediná shoda `/přeskočen/i` → `/skipped/i`).
- **feat-016-coordination-overhead:** poznámka o zamčení, rozpad handoff / rework a test nápovědy přepínače (Příklad 17 čte pravidlo z CSS modulu místo inline stylu).
- **feat-017-rozlozeni-vynosu-v-case, feat-019-ai-multiplikator-vykonu:** testy hledající akordeony podle textu.
