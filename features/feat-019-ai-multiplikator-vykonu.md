# Feature: AI multiplikátor výkonu

## Status
in-progress

*Revize (2026-11-03): AI se už nenastavuje na celou jednotku, ale na **jednotlivý skill jednotky**. Člověk (nebo tým) může použít AI při vývoji, ale ne při code review nebo UAT. Přepsáno Problem, User Story, UI / Design, příklady, Out of Scope, Technical Notes a Open Questions. Dřívější změna z 2026-10-20 (přepínání kliknutím 1× → 2× → 5× → 1×) zůstává v platnosti, jen se děje na chipu skillu.*

## Problem
Manažeři dnes často věří, že nasazení AI automaticky zrychlí dodávku: „dáme lidem AI a budeme 5× rychlejší“. V praxi (z workshopů a rozhovorů) se ale AI nepoužívá na všechno, co člověk dělá. Jeden člověk ji může využít při vývoji, ale při code review nebo UAT testování ji použít nemůže. Zrychlení celé jednotky jedním číslem proto neodpovídá skutečnosti a kouč s ním nemůže ukázat to, co potřebuje: AI zrychlí jen ty druhy práce, kde ji lze použít, a práce, kam AI nesahá, zůstane stejně pomalá. Většinu Lead Time navíc často netvoří samotná práce, ale čekání, předávky a úzká hrdla. Bez nastavení AI po skillech zůstává argument jen v teoretické rovině.

## User Story
*Jako agilní kouč na manažerském workshopu chci u jednotlivých skillů jednotky nastavit, že se u nich používá AI 2× nebo 5× rychleji, abych účastníkům ukázal, že AI jde použít jen u některých druhů práce (např. vývoj, ne code review nebo UAT) a co to dělá s tokem práce v celé organizaci.*

## Prior Art
Research: rychlý (2026-11-03). Nic z něj nepřebíráme jako funkci ani UI vzor. Research potvrdil jen to, že příběh „AI zrychlí vývoj, ale ne review a UAT“ je v praxi běžný argument. Simulátor ani hru s AI nastavenou po skillech uvnitř týmu jsem nenašel. Ovládání na chipu je naše vlastní. Zdroje jsem většinou četl jen z výsledků vyhledávání, původní zprávy Faros a DORA se otevřít nepodařilo.

| Produkt | Jak to řeší | Co si bereme / nebereme | Zdroj (URL, datum přístupu) |
|---|---|---|---|
| Text „Theory of constraints, AI, and code review“ | Blogový argument, že AI zrychluje jeden krok (psaní kódu) a omezením zůstává review. Není to nástroj ani simulace. | Nebereme | https://swizec.com/blog/theory-of-constraints-ai-and-code-review, 2026-11-03 |
| Studie „The Productivity-Reliability Paradox“ (arXiv) | Stejné pojetí: zrychlení kroku, který není úzkým hrdlem, nezvýší průtok. Text, ne nástroj. | Nebereme | https://arxiv.org/pdf/2605.01160, 2026-11-03 |
| Telemetrie Faros AI (sekundární zdroj) | Měří a porovnává jednotlivé kroky toku (vývoj vs. review). Není to simulátor. | Nebereme | https://www.metacto.com/blogs/code-review-bottleneck-ai-development, 2026-11-03 |
| Kanban Pizza Game (agile42), Pizza KATA | Koučovské hry o toku s rolemi a WIP limity. Variantu s AI jsem nenašel. | Nebereme | https://www.agile42.com/en/kanban-pizza-game/, 2026-11-03 |
| What-if simulace v plánovacích nástrojích (Project Insight) | Scénáře „co když zdroj chybí“. Násobič výkonu u jednotlivé aktivity jsem nenašel. | Nebereme | https://projectinsight.com/features/what-if-simulations-forecasting, 2026-11-03 |

## UI / Design
Změna se týká jen karty jednotky (`MemberCard`) a chipů skillů na ní, v režimech **Experimentování** (Advanced) a **Cash Flow**. Oba režimy kartu sdílejí přes `InProgressTeamPanel`. Režim **Srovnání** se nemění (žádné tlačítko AI ani odznak). Texty UI jsou anglicky.

- **Tlačítko „AI“ na chipu skillu:** každý chip skillu na kartě má malé tlačítko „AI“ mezi názvem skillu a křížkem pro odebrání skillu. Je vysoké 14 px v chipu vysokém 18 px (křížek skillu zůstává 12 px), má tenký světlý rámeček a text „AI“ v plné bílé na barvě role. **Z horního řádku karty tlačítko AI mizí**, zůstává tam avatar, jméno a křížek jednotky.
- **Přepínání kliknutím:** každé kliknutí na tlačítko nastaví další hodnotu v pořadí **1× (bez AI) → 2× → 5× → 1×**. Žádné menu se neotevírá. Jedno kliknutí je jedna změna, která hned platí. Po 5× se AI u skillu vypne do výchozího stavu.
- **Vybraný stav:** se zapnutým AI je tlačítko **bílý odznak** s **bleskem v barvě `--accent`** a hodnotou v tmavém textu, např. „⚡ 2×“ nebo „⚡ 5×“. Bílá je zvolená proto, že chipy mají barvy rolí (včetně fialové) a odznak musí být čitelný na každé z nich. V tmavém tématu je blesk v barvě textu (tmavý), protože světle fialová `--accent` by na bílém odznaku splynula.
- **Výchozí stav:** každý skill každé jednotky má 1× (bez AI) a chip ukazuje průhledné „AI“.
- **Značka u rozpracovaného úkolu:** v řádku úkolu na kartě (název featury a skill) se vedle názvu skillu ukáže malý odznak „⚡ 5×“, **jen když skill, na kterém jednotka právě pracuje, má AI zapnuté**. Bez AI se nezobrazí nic. Kouč tak při běhu vidí, že tento konkrétní úkol jede zrychleně. Odznak je v barvě `--accent` s textem `--on-accent`, vysoký 12 px. Výška řádku úkolu se nemění, aby karta při přechodu mezi idle a prací neskákala.
- **Zkracování v úzké kartě:** zkracuje se jen název skillu (na chipu i v řádku úkolu) výpustkou. AI, × i značka u úkolu se nikdy nezkracují. Název featury v řádku úkolu má minimální šířku 6 znaků. Dnes se název skillu v řádku úkolu nezkracuje, takže dlouhý název vytlačí z řádku název featury úplně; tahle oprava je součástí feature, jinak by se značka nevešla.
- **Fokus:** tlačítko AI má při ovládání klávesnicí standardní prstenec design systému (`--shadow-focus`), který je čitelný na každé barvě role i na bílém odznaku.
- **Tooltip** říká, co udělá další kliknutí, a obsahuje název skillu: „AI speed-up for Development – click for 2×“, „AI speed-up for Development: 2× – click for 5×“, „AI speed-up for Development: 5× – click to turn off“.
- **Za běhu:** nastavení lze měnit před startem i během simulace. Změna platí okamžitě, i pro právě rozpracovaný úkol toho skillu. Progress bar úkolu se u skillu s AI plní úměrně rychleji.
- **Přístupnost:** přístupný název tlačítka je „AI speed-up for Development“, se zapnutým AI „AI speed-up for Development: 5×“. Viditelná hodnota je součástí názvu a název skillu rozliší tlačítka na různých chipech. Tlačítko jde ovládat klávesnicí (Enter / mezerník) a fokus na něm po kliknutí zůstává, takže se dá přepínat opakovaně.
- Každé kliknutí je skutečná změna týmu, preset se proto přepne na „custom“ (i když se kolečkem vrátí na 1×).
- Ikona blesku odlišuje AI multiplikátor od přepínače rychlosti simulace (0.5× / 1× / 10×), který používá stejný zápis „N×“.
- **Tooltip dlaždice Coordination overhead** (Cash Flow, feat-016) dostane na konec větu: „Skills using AI process this extra work faster, so the share can be higher than the time it actually took.“ Výpočet dlaždice se nemění (viz Open Questions, varianta A).
- **Tutoriál (feat-025):** krok „AI speed-up“ zůstává. Text vysvětluje, že AI se zapíná u jednotlivých skillů, a zvýrazňuje AI na prvním chipu první jednotky.
- **Schválený UI návrh (fáze 3, 2026-11-03):** mockup `docs/feat-019-ui-mockup.html` (varianta A, bílý odznak, AI vysoké 14 px). Mockup ověřil světlé i tmavé téma, všech osm barev rolí, šířky karty 145 / 175 / 240 px a ovládání klikem i klávesnicí. Dřívější mockup s menu je tím nahrazen.

### Chování jednotky s AI (pravidla modelu)
- **Nastavení patří dvojici jednotka + skill.** Dvě jednotky se stejným skillem mohou mít AI každá jinak. Nastavení není vlastnost skillu v seznamu skillů.
- **Rychlost práce:** jednotka odvede za 1 s simulačního času tolik sekund práce, kolik je multiplikátor skillu úkolu (2 / 5 s práce při 2× / 5×). Skill bez AI (1×) pracuje jako dnes.
- **Rozhoduje skill úkolu:** jednotka s více skilly pracuje na každém úkolu rychlostí skillu, kterého se úkol týká. AI u Development nezrychluje její úkoly Code Review ani UAT.
- **Celý úkol skillu:** zrychlení platí pro každý úkol daného skillu, který jednotka převezme, včetně přirážky za připojení (join tax) a dohánění progresu po reworku (feat-016).
- **Stejná pravidla přiřazení:** jednotka si úkoly bere podle stejných pravidel jako ostatní (priorita, fáze `level`, WIP režim, Min units). AI nemění, *které* úkoly si jednotka vezme, jen jak rychle je zpracuje.
- **Dřívější uvolnění:** protože úkol dokončí dřív, uvolní se dřív a převezme další dostupný úkol.
- **Čekání:** když pro ni žádný úkol není dostupný (např. čeká na dokončení dřívější fáze jinou jednotkou), čeká a roste jí idle čas stejně jako jednotce bez AI.
- **Jen vlastní práce:** AI nezrychluje práci ostatních jednotek ani čekání na ně.
- **Okamžitá změna:** změna nastavení za běhu platí od dalšího ticku. Rozpracovaný úkol si odvedenou práci ponechá. Změna AI u skillu, na kterém jednotka právě nepracuje, rozpracovaný úkol neovlivní.
- **Odebrání skillu:** po odebrání skillu jednotce (křížek na chipu, nebo smazání skillu ze seznamu skillů) se jeho nastavení AI zapomene. Když se skill později přidá znovu, má 1×.

## Specification by Example

**Příklad 1: Výchozí stav bez AI**
- Given: do jednotky se přidají skilly Development a Code Review
- When: uživatel nic nenastaví
- Then: oba chipy ukazují průhledné „AI“ a úkol s prací 10 s dokončí jednotka za 10 s simulačního času u obou skillů (stejně jako dnes)

**Příklad 2: Zrychlení 2× u skillu**
- Given: jednotka má u skillu Development nastaveno AI 2× a převezme úkol Development s prací 10 s
- When: simulace běží
- Then: úkol je hotový po 5 s simulačního času

**Příklad 3: Zrychlení 5× u skillu**
- Given: jednotka má u skillu Development nastaveno AI 5× a převezme úkol Development s prací 10 s
- When: simulace běží
- Then: úkol je hotový po 2 s simulačního času

**Příklad 4: AI jen u jednoho skillu jednotky**
- Given: Anna má skilly Development (AI 5×) a Code Review (bez AI); zpracuje úkol Development s prací 10 s a poté úkol Code Review s prací 10 s
- When: simulace běží
- Then: úkol Development je hotový po 2 s, úkol Code Review po dalších 10 s (celkem 12 s)

**Příklad 5: AI patří dvojici jednotka + skill**
- Given: Anna i Petr mají skill Development; AI 5× je nastaveno jen u Anny
- When: oba zpracovávají úkol Development s prací 10 s
- Then: Anna je hotová po 2 s, Petr po 10 s

**Příklad 6: Změna za běhu u skillu, na kterém jednotka pracuje**
- Given: jednotka pracuje na úkolu Development s prací 10 s, odvedeno je 4 s, Development má 1×
- When: uživatel za běhu přepne Development na 5×
- Then: rozpracovanost se neztratí (progress zůstane 4 s) a zbývajících 6 s práce je hotových za 1,2 s simulačního času

**Příklad 7: Změna AI u jiného skillu rozpracovaný úkol neovlivní**
- Given: jednotka pracuje na úkolu Development s prací 10 s, odvedeno je 4 s, a má také skill Code Review
- When: uživatel za běhu nastaví AI 5× u skillu Code Review
- Then: úkol Development běží dál 1× (zbývajících 6 s práce je hotových za 6 s)

**Příklad 8: Přepínání AI kliknutím na chipu**
- Given: jednotka „Anna“ v Team panelu (Experimentování nebo Cash Flow) se skilly Development, Code Review a UAT bez AI; na každém chipu je průhledné „AI“ a v horním řádku karty žádné tlačítko AI
- When: uživatel klikne třikrát po sobě na „AI“ na chipu Development
- Then: po 1. kliknutí má Development 2× a chip ukazuje bílý odznak „⚡ 2×“; po 2. kliknutí 5× a „⚡ 5×“; po 3. kliknutí 1× a chip je zpět s průhledným „AI“. Žádné menu se neotevře a chipy Code Review a UAT i ostatní jednotky zůstanou beze změny

**Příklad 9: Odebrání a znovu přidání skillu zapomene AI**
- Given: Anna má u skillu Development AI 5×
- When: uživatel skill Development odebere křížkem na chipu a pak ho přidá znovu
- Then: Development má 1× a chip ukazuje průhledné „AI“

**Příklad 10: Reset a nový backlog zachovají nastavení AI**
- Given: jednotka má u skillu Development AI 5× a simulace doběhla
- When: uživatel klikne na Reset, nebo na „Generate new backlog“
- Then: Development má stále AI 5×, protože nastavení patří k týmu, ne ke stavu běhu ani k backlogu

**Příklad 11: Přepnutí presetu vrátí AI na 1×**
- Given: v týmu mají jednotky AI 2× a 5× u některých skillů
- When: uživatel přepne preset (Teams ↔ People) a potvrdí dialog
- Then: všechny skilly všech jednotek nového týmu mají AI 1×

**Příklad 12: Skill s AI dřív dokončí a jednotka převezme další práci**
- Given: jednotka s AI 5× u skillu Development a v backlogu featura se dvěma úkoly Development, každý s prací 10 s
- When: simulace běží
- Then: první úkol je hotový po 2 s, jednotka si převezme druhý a i ten zpracuje 5× rychleji (oba hotové po 4 s simulačního času)

**Příklad 13: Jednotka s AI čeká stejně jako ostatní a ostatní nezrychluje**
- Given: fáze Design (level 1) → Frontend (level 2); jednotka Design bez AI pracuje na úkolu s prací 10 s, volná jednotka Frontend s AI 5× u skillu Frontend čeká na svůj úkol (práce 10 s) ve stejné featuře
- When: simulace běží
- Then: jednotka Frontend čeká (roste jí idle čas) stejně jako jednotka bez AI. Jednotka Design pracuje dál 1× a svůj úkol dokončí po 10 s; teprve potom Frontend převezme svůj úkol a dokončí ho za 2 s

**Příklad 14: Značka u rozpracovaného úkolu**
- Given: Anna má Development s AI 5× a Code Review bez AI a pracuje na úkolu Development
- When: uživatel se podívá na její kartu a pak Anna převezme úkol Code Review
- Then: v řádku úkolu je u skillu Development odznak „⚡ 5×“; po převzetí úkolu Code Review je řádek úkolu bez odznaku. Odznak „⚡ 5×“ na chipu Development zůstává

**Příklad 15: Tooltip a klávesnice**
- Given: jednotka se skillem Development bez AI, fokus na tlačítku AI na chipu Development
- When: uživatel třikrát stiskne Enter
- Then: hodnota se mění stejně jako kliknutím (2×, 5×, 1×) a fokus zůstává na tlačítku. Přístupný název je postupně „AI speed-up for Development: 2×“, „AI speed-up for Development: 5×“, „AI speed-up for Development“ a tooltip „AI speed-up for Development: 2× – click for 5×“, „AI speed-up for Development: 5× – click to turn off“, „AI speed-up for Development – click for 2×“

## Out of Scope
- Režim Srovnání se nemění, nemá tlačítko AI ani odznak.
- Jiné hodnoty než 2× a 5×: žádný vlastní multiplikátor ani slider.
- Hromadné nastavení AI jedním kliknutím, a to ani pro všechny skilly jedné jednotky, ani pro daný skill napříč jednotkami. Nastavuje se vždy u jednoho chipu.
- AI jako vlastnost skillu v seznamu skillů (globálně pro všechny jednotky se skillem): nastavení patří dvojici jednotka + skill.
- Zákaz AI u skillů, kde ji nelze použít: simulátor nezakazuje AI u žádného skillu a žádný příznak „AI nelze použít“ neexistuje. Kouč sám rozhodne, že ji u Code Review nebo UAT nezapne.
- Pamatování AI po odebrání skillu: po odebrání a opětovném přidání skillu je AI 1×.
- Náklady na AI (licence, cena za jednotku) se do Cash Flow nepromítají.
- Negativní efekty AI (více chyb a reworku, doba zaučení): AI je v této verzi čisté zrychlení práce.
- Ukládání nastavení AI do localStorage: složení týmu se dnes také neukládá, takže po obnovení stránky jsou všechny skilly zpět na 1×.
- Nová metrika „vliv AI“ (porovnání před a po): dopad je vidět jen přes stávající metriky (Cycle Time, throughput, Cash Flow).
- Sloupec s AI multiplikátorem v XLS importu (feat-012): importovaný tým má vždy 1×.

## Technical Notes
- **Datový model (`src/types/simulation.ts`):**
  - Typ `AiMultiplier = 1 | 2 | 5` zůstává (s JSDoc komentářem).
  - Pole `Member.aiMultiplier?: AiMultiplier` se **nahrazuje** volitelným `Member.aiBySkill?: Partial<Record<Role, AiMultiplier>>`. Chybějící klíč = 1×, takže stávající kód, testy, presety i XLS import (feat-012) fungují beze změny.
  - Ukládají se jen hodnoty 2× a 5×. Nastavení na 1× klíč smaže a prázdný objekt se změní na `undefined`. Díky tomu stačí na hlídání „má někdo AI?“ v ticku test `m.aiBySkill !== undefined`.
  - Nastavení se nikam neukládá, takže migrace dat není potřeba.
- **Engine (`src/simulation/engine.ts`):**
  - V bloku „Postup práce“ ve funkci `tick()` se dnes volá `t.progress += dtSim × speed`, kde `speed` je jedno číslo jednotky (ř. ~1038). Nově `speed = assignee.aiBySkill?.[t.role] ?? 1`. Úkol svůj skill (`t.role`) už nese, nic dalšího se do něj nepřidává.
  - Jednotku k tasku `tick()` hledá jen tehdy, když má někdo v týmu AI zapnuté (`team.some(m => m.aiBySkill !== undefined)`). Bez AI (výchozí stav, Compare) horká smyčka nedělá žádné hledání navíc.
  - Sdílený helper `setMemberAiMultiplier(state, memberId, role, value)` dostane parametr `role`. Vrací `true` jen při skutečné změně a `false`, pokud jednotka ten skill nemá. Zápis **vytváří vždy nový objekt** `aiBySkill`, nemutuje ho. „Generate new backlog“ kopíruje členy přes `{ ...m }` (mělká kopie) a sdílený vnořený objekt by byl past.
  - Helper pro zapomenutí nastavení při odebrání skillu (např. `clearMemberSkillAi(member, role)`), aby se logika nekopírovala.
  - Ostatní logika se nemění: přiřazování tasků, idle čas (`idleSec`), výpočet Cycle Time a výnosů. Engine zůstává čistý TypeScript bez Reactu.
- **Odebrání skillu (Příklad 9):** AI se musí zapomenout na třech místech, všude přes sdílený helper:
  - `handleRemoveRole` v `src/components/Simulator.tsx`,
  - stejný handler v `src/hooks/useCashFlowSimSetup.ts`,
  - `deleteRole` v `src/simulation/roleManagement.ts` (smazání skillu ze seznamu skillů, u všech jednotek).
- **Coordination overhead (feat-016) – rozhodnuto (varianta A):** multiplikátor zrychluje **celou práci tasku včetně join taxu**, protože tax je součástí `task.work`. Ztracený progres z reworku jednotka s AI dohání také zrychleně. Varianta B (join tax vždy 1×) je kandidát na navazující feature.
- **UI:**
  - `src/components/RoleChip.tsx`: dostane volitelné props pro AI (hodnota, přístupný název, tooltip, handler). `ComparePanel` ho používá bez nich, takže se tam nic nezmění. Logika další hodnoty (konstanta `NEXT_AI: Record<AiMultiplier, AiMultiplier> = { 1: 2, 2: 5, 5: 1 }`) zůstává v `MemberCard`, chip jen zobrazuje.
  - **Rozložení chipu:** dnes je `display: inline-block` s textem s výpustkou a absolutně umístěným ×. Pro AI se musí přestavět na flex (název s výpustkou + AI + ×). Ref pro tooltip při zkrácení textu (`useIsTruncated`, feat-023) se přesune na prvek s názvem. Rozměry × zůstávají CSS proměnné (feat-023).
  - Styly tlačítka a odznaku (`.aiButton*`) se přesunou z `MemberCard.module.css` do `RoleChip.module.css`. Z horního řádku karty tlačítko AI mizí. Rozměry a barvy podle mockupu: tlačítko 14 px, odznak bílý (`--ink-inverse`) s tmavým textem, fokus `box-shadow: var(--shadow-focus)` bez `outline`.
  - **Blesk v odznaku:** ve světlém tématu `--accent`, v tmavém barva textu. V CSS Modulu to jde přes nový token (např. `--ai-bolt` v `globals.css`: světlé `#7a3bf0`, tmavé `#121212`) nebo přes `:global([data-theme="dark"])`; token je nutné ověřit proti testu `feat-021-design-tokens.test.ts`.
  - **Řádek úkolu (`MemberCard.module.css`):** `.taskRole` dostane `flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis` místo `flex-shrink: 0`, `.taskName` dostane `min-width: 6ch`. Značka AI je `flex-shrink: 0`.
  - `src/components/MemberCard.tsx`: `onSetAiMultiplier(memberId, role, value)` dostane navíc `role`. Řádek úkolu (`taskLine`) zobrazí odznak „⚡ N×“ podle `member.aiBySkill?.[currentTask.role]`, jen když je hodnota větší než 1; odznak má `flex-shrink: 0`, aby ho zkrácený název featury nevytlačil, a výška řádku se nemění.
  - Rozhraní s novým parametrem `role` projde přes `src/components/InProgressTeamPanel.tsx`, `src/components/Simulator.tsx` (Experimentování) a `src/hooks/useCashFlowSimSetup.ts` (Cash Flow). Handlery volají `setMemberAiMultiplier` a jen při skutečné změně přepnou preset na „custom“ (`markCustom`) a překreslí UI (`forceUpdate`).
  - `src/components/CashFlowPanel.tsx`: doplnit větu do tooltipu dlaždice Coordination overhead.
- **Tutoriál (feat-025):** v `src/lib/tutorialSteps.ts` se kroku `experiment-ai` změní text a cíl `experiment-first-unit-ai` se přesune na AI prvního chipu první jednotky. Přidá se `fallbackTargetId: 'experiment-first-unit'` (karta jednotky), takže když jednotka žádný chip nemá, krok se zobrazí a zvýrazní kartu. `TutorialOverlay` už `fallbackTargetId` podporuje.
- **Chování, které vyplývá z kódu:**
  - Reset (`resetFromSnapshot`) nuluje jen `currentTask` a `idleSec` členů, tým i AI zachová (Příklad 10).
  - „Generate new backlog“ kopíruje tým přes `{ ...m }`, takže AI zachová (Příklad 10).
  - Přepnutí presetu (`applyPreset`) vytvoří nový tým bez AI (Příklad 11).
  - Experimentování a Cash Flow mají každý vlastní tým (vlastní `stateRef`), takže nastavení AI v jednom režimu se nepřenáší do druhého.
  - Režim Srovnání (`ComparePanel`, `makeCompareStates`) se nemění a jeho týmy mají vždy 1×.
  - AI multiplikátor (rychlost práce v simulačním čase) je nezávislý na přepínači rychlosti simulace (počet volání `tick()` za reálnou sekundu).
  - Při velkém `dtSim` a 5× může task v jednom ticku „přestřelit“ `work`; zbytek ticku propadne stejně jako dnes (progress se ořízne na `work`).
- **Testy:**
  - Přepsat `tests/unit/simulation/feat-019-ai-multiplikator.test.ts` (engine: Příklady 1–7 a 10–13), `feat-019-member-card.test.tsx` (chip a odznak: Příklady 8, 14, 15; styly přes třídy z CSS Modulu) a `feat-019-simulator-integration.test.tsx` (presety a `markCustom`, Reset a Generate new backlog, odebrání skillu — Příklad 9, Cash Flow, Srovnání, tooltip dlaždice).
  - Upravit testy tutoriálu feat-025, které míří na starý cíl nebo text kroku: `feat-025-tutorial-steps.test.ts` (řádek kroku „AI speed-up“) a `feat-025-simulator-integration.test.tsx` (cíl `experiment-first-unit-ai`).
  - Testy feat-015, feat-022, feat-023 a feat-026 předávají `MemberCard` jen `onSetAiMultiplier={vi.fn()}`, po změně signatury je potřeba zkontrolovat typy.
  - Testy ověřují jen chování jednotek, ne dopad na metriky týmu.
- **Závislosti:** feat-002 (konfigurace týmu, `MemberCard`), feat-005 a feat-007 (skilly a jejich správa, `deleteRole`), feat-014 (presety, `markCustom`), feat-015 (Cash Flow, sdílený Team panel), feat-016 (coordination overhead, join tax), feat-023 (zkracování chipů), feat-025 (tutoriál), feat-026 (název „Skill“).

## Open Questions
- Rozhodnuto (přeneseno): zrychlení platí včetně join taxu (varianta A). Slovo „off“ zůstává jen v tooltipu („click to turn off“), po 5× následuje 1× s průhledným „AI“.
- Rozhodnuto (přeneseno): spec netvrdí nic o dopadu AI na metriky týmu (Cycle Time, Total Time, WIP, výnos), popisuje jen chování jednotek. Co z toho plyne, ukazuje simulace, ne spec.
- Rozhodnuto (přeneseno): **dlaždice Coordination overhead (feat-016) s AI → varianta A.** Výpočet zůstává v sekundách práce, jen se doplní tooltip („Skills using AI …“). Přepočet na čas dělením multiplikátorem je kandidát na navazující feature spolu s „join tax vždy 1×“.
- Rozhodnuto (revize 2026-11-03): AI patří dvojici jednotka + skill; po odebrání skillu se zapomene; simulátor AI u žádného skillu nezakazuje.
- Rozhodnuto (revize 2026-11-03): tutoriál zachovává krok o AI (cíl první chip, záloha karta jednotky). Rozhodl uživatel.
- Rozhodnuto (revize 2026-11-03): rozpracovaný úkol na kartě ukazuje odznak „⚡ N×“, když jeho skill má AI. Rozhodl uživatel.
- Rozhodnuto (fáze 3, 2026-11-03): odznak na chipu je bílý (varianta A), AI vysoké 14 px. Zkracuje se jen název skillu, AI a × zůstávají vždy vidět (ověřeno v mockupu na šířkách karty 145–240 px).

## Related Features
- **feat-001-simulace-prubehu-vyvoje:** rychlost postupu práce už není pro všechny úkoly stejná (1 s simulace = 1 s práce); jednotka odvede za 1 s simulace 2 nebo 5 s práce, pokud skill úkolu má AI 2× nebo 5×.
- **feat-002-konfigurace-tymu:** chipy skillů na `MemberCard` dostávají tlačítko „AI“ (přepíná hodnoty kliknutím); nová vlastnost jednotky `aiBySkill`.
- **feat-005-konfigurace-specializaci / feat-007-sprava-specializaci:** smazání skillu ze seznamu skillů zapomene jeho nastavení AI u všech jednotek.
- **feat-009-dva-mody-ui:** režim Srovnání zůstává beze změny (bez AI).
- **feat-012-xls-import:** importovaný tým má AI 1× u všech skillů; sloupec pro AI není součástí této feature.
- **feat-014-unit-mode-preset:** změna AI přepne preset na „custom“; aplikace presetu vrací AI na 1×.
- **feat-015-cash-flow-mod:** AI je dostupné i v Cash Flow (sdílený `InProgressTeamPanel`); výpočet výnosu se nemění.
- **feat-016-coordination-overhead:** AI zrychluje i join tax (varianta A); rework jednotka s AI dohání zrychleně, vždy podle skillu úkolu.
- **feat-021-prevod-design-system-org-flow:** blesk v odznaku AI zůstává v barvě `--accent` (nově fialová `#7a3bf0`); odznak je nově bílý na chipu skillu a v barvě `--accent` s textem `on-accent` v řádku úkolu.
- **feat-023-jednotne-pismo-textu:** chip skillu s AI a × se zkracuje výpustkou stejně jako dnes (plný název v `title` jen u zkráceného textu).
- **feat-025-revize-tutorialu:** krok „AI speed-up“ míří na AI prvního chipu první jednotky a vysvětluje, že AI se zapíná u skillů.
- **feat-027-cas-simulace-pracovni-dny:** rychlost práce se čte „za 1 pracovní den jednotka odvede 2 nebo 5 dnů práce“ (dříve sekund); matematika beze změny. Tooltip Coordination overhead: „work-seconds“ → „man-days of work“.
- **feat-035-ai-na-skillech-lidi (draft, mód Organization):** AI po skillech bude i na kartách lidí v panelu organizace (klik cyklí 1× → 2× → 5× → 1×). Nastavuje se jen před během a při přesunu člověka do jiného týmu (feat-030) se přenáší.
