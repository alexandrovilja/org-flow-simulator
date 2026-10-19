# Feature: AI multiplikátor výkonu

## Status
done

## Problem
Manažeři dnes často věří, že nasazení AI automaticky zrychlí dodávku: „dáme lidem AI a budeme 5× rychlejší“. Kouč teď v simulátoru nemá jak ukázat, co se stane, když AI zrychlí jen některé jednotky. Většinu Lead Time totiž často netvoří samotná práce, ale čekání, předávky a úzká hrdla. Zrychlení jedné jednotky se pak do celkového Lead Time ani Cash Flow nepromítne úměrně, nebo vůbec. Bez této možnosti zůstává argument jen v teoretické rovině.

## User Story
*Jako agilní kouč na manažerském workshopu chci u jednotlivých jednotek nastavit, že pracují s AI 2× nebo 5× rychleji, abych účastníkům ukázal, že zrychlení jednotlivců nemusí znamenat úměrně kratší Lead Time ani vyšší výnos, protože tok práce brzdí úzká hrdla a předávky.*

## UI / Design
Změna se týká jen karty jednotky (`MemberCard`) v Team panelu v režimech **Experimentování** (Advanced) a **Cash Flow** — oba režimy kartu sdílejí přes `InProgressTeamPanel`. Režim **Srovnání** se nemění (žádné tlačítko AI ani odznak). Texty UI jsou anglicky.

- **Tlačítko „AI“:** malé průhledné tlačítko v horním řádku karty, hned vlevo od křížku pro odebrání jednotky. Vysoké jako křížek (16 px), tenký rámeček (`--line`), tlumený text „AI“ (`--ink-3`). Tooltip „AI speed-up“. **Křížek se nemění** — zůstává malý jako dnes.
- **Menu voleb:** kliknutím na „AI“ se otevře menu se dvěma volbami **2×** a **5×** (malé čtverečky stejné výšky). Pokud má jednotka AI zapnuté, je v menu navíc volba **„off“** (návrat na 1×). Menu je vložené přímo do karty pod horní řádek, zarovnané doprava — stejný princip jako dnešní výběr specializací přes „+“ (karta má oříznutý obsah, plovoucí bublina by se usekla). Po výběru volby se menu zavře; opětovné kliknutí na tlačítko menu zavře bez změny.
- **Vybraný stav:** po výběru 2× nebo 5× se tlačítko „AI“ změní na **plně modrý odznak** (barva `--accent`) s **bílou ikonou blesku a hodnotou**, např. „⚡ 5×“. Odznak má stejnou výšku jako křížek, jen je širší. Kliknutím na odznak se menu otevře znovu (změna hodnoty nebo „off“). Aktuálně vybraná volba je v menu také modrá.
- **Výchozí stav:** každá jednotka má 1× (bez AI) — tlačítko je průhledné s textem „AI“.
- **Za běhu:** nastavení lze měnit před startem i během simulace; změna platí okamžitě, i pro právě rozpracovaný úkol. Progress bar úkolu se u jednotky s AI plní úměrně rychleji.
- **Přístupnost (z review):** přístupný název tlačítka je „AI speed-up“, se zapnutým AI „AI speed-up: 5×“ — viditelná hodnota je součástí názvu, aby ji čtečka ohlásila. Tlačítko má `aria-expanded` a `aria-controls` na menu. Po výběru volby se fokus vrátí na tlačítko AI; **Escape** (v tlačítku i ve volbách) menu zavře bez změny.
- **Menu patří jednotce:** když se tým vymění (preset, nová jednotka se stejným ID), otevřené menu se zavře a „nepřeskočí“ na jinou jednotku.
- Výběr hodnoty, kterou jednotka už má, není změna týmu — preset se nepřepne na „custom“.
- Ikona blesku odlišuje AI multiplikátor od přepínače rychlosti simulace (0.5× / 1× / 2× / 10×), který používá stejný zápis „N×“.
- **Tooltip dlaždice Coordination overhead** (Cash Flow, feat-016) dostane na konec větu: „Units using AI process this extra work faster, so the share can be higher than the time it actually took.“ Výpočet dlaždice se nemění (viz Open Questions, varianta A).
- Schválený UI návrh (fáze 3): mockup `docs/feat-019-ui-mockup.html`.

### Chování jednotky s AI (pravidla modelu)
- **Rychlost práce:** jednotka s AI 2× / 5× odvede za 1 s simulačního času 2 / 5 s práce na úkolu, který právě zpracovává. Jednotka bez AI (1×) pracuje jako dnes.
- **Celá jednotka:** zrychlení platí pro všechny specializace jednotky a pro každý úkol, který převezme, včetně přirážky za připojení (join tax) a dohánění progresu po reworku (feat-016).
- **Stejná pravidla přiřazení:** jednotka s AI si úkoly bere podle stejných pravidel jako ostatní (priorita, fáze `level`, WIP režim, Min units). AI nemění, *které* úkoly si jednotka vezme, jen jak rychle je zpracuje.
- **Dřívější uvolnění:** protože úkol dokončí dřív, uvolní se dřív a převezme další dostupný úkol své specializace.
- **Čekání:** když pro ni žádný úkol není dostupný (např. čeká na dokončení dřívější fáze jinou jednotkou), čeká a roste jí idle čas stejně jako jednotce bez AI.
- **Jen vlastní práce:** AI nezrychluje práci ostatních jednotek ani čekání na ně.
- **Okamžitá změna:** změna nastavení za běhu platí od dalšího ticku; rozpracovaný úkol si odvedenou práci ponechá.

## Specification by Example

**Příklad 1: Výchozí stav bez AI**
- Given: do týmu se přidá nová jednotka
- When: uživatel nic nenastaví
- Then: jednotka má AI 1×, tlačítko je průhledné s textem „AI“ a úkol s prací 10 s dokončí za 10 s simulačního času (stejně jako dnes)

**Příklad 2: Zrychlení 2×**
- Given: jednotka má nastaveno AI 2× a převezme úkol s prací 10 s
- When: simulace běží
- Then: úkol je hotový po 5 s simulačního času

**Příklad 3: Zrychlení 5×**
- Given: jednotka má nastaveno AI 5× a převezme úkol s prací 10 s
- When: simulace běží
- Then: úkol je hotový po 2 s simulačního času

**Příklad 4: Změna za běhu**
- Given: jednotka s AI 1× pracuje na úkolu s prací 10 s, odvedeno je 4 s
- When: uživatel za běhu přepne jednotku na 5×
- Then: rozpracovanost se neztratí (progress zůstane 4 s) a zbývajících 6 s práce je hotových za 1,2 s simulačního času

**Příklad 5: Indikace AI na kartě**
- Given: jednotka „Backend“ v Team panelu (Experimentování nebo Cash Flow) bez AI, vedle křížku je průhledné tlačítko „AI“
- When: uživatel klikne na „AI“ a zvolí 5×
- Then: tlačítko se změní na plně modrý odznak s bílým bleskem a textem „5×“; po opětovném kliknutí a volbě „off“ se vrátí do průhledného stavu s textem „AI“

**Příklad 6: Reset a nový backlog zachovají nastavení AI**
- Given: jednotka má AI 5× a simulace doběhla
- When: uživatel klikne na Reset, nebo na „Generate new backlog“
- Then: jednotka má stále AI 5×, protože nastavení patří k týmu, ne ke stavu běhu ani k backlogu

**Příklad 7: Přepnutí presetu vrátí AI na 1×**
- Given: v týmu jsou jednotky s AI 2× a 5×
- When: uživatel přepne preset (Teams ↔ People) a potvrdí dialog
- Then: všechny jednotky nového týmu mají AI 1×

**Příklad 8: Jednotka s AI dřív dokončí a převezme další práci**
- Given: jednotka s AI 5× a v backlogu featura se dvěma úkoly její specializace, každý s prací 10 s
- When: simulace běží
- Then: první úkol je hotový po 2 s, jednotka si převezme druhý a i ten zpracuje 5× rychleji (oba hotové po 4 s simulačního času)

**Příklad 9: Jednotka s AI čeká stejně jako ostatní a ostatní nezrychluje**
- Given: fáze Design (level 1) → Frontend (level 2); jednotka Design bez AI pracuje na úkolu s prací 10 s, volná jednotka Frontend s AI 5× čeká na svůj úkol (práce 10 s) ve stejné featuře
- When: simulace běží
- Then: jednotka Frontend čeká (roste jí idle čas) stejně jako jednotka bez AI; jednotka Design pracuje dál 1× a svůj úkol dokončí po 10 s; teprve potom Frontend převezme svůj úkol a dokončí ho za 2 s

## Out of Scope
- Režim Srovnání se nemění, nemá tlačítko AI ani odznak.
- Jiné hodnoty než 2× a 5×: žádný vlastní multiplikátor ani slider.
- Hromadné nastavení AI pro celý tým jedním kliknutím — nastavuje se vždy po jednotkách.
- Zrychlení jen pro jednu specializaci jednotky — multiplikátor platí pro celou jednotku, tedy pro všechny její role.
- Náklady na AI (licence, cena za jednotku) se do Cash Flow nepromítají.
- Negativní efekty AI (více chyb a reworku, doba zaučení) — AI je v této verzi čisté zrychlení práce.
- Ukládání nastavení AI do localStorage — složení týmu se dnes také neukládá, takže po obnovení stránky jsou všechny jednotky zpět na 1×.
- Nová metrika „vliv AI“ (porovnání před a po) — dopad je vidět jen přes stávající metriky (Cycle Time, throughput, Cash Flow).
- Sloupec s AI multiplikátorem v XLS importu (feat-012) — importovaný tým má vždy 1×.

## Technical Notes
- **Datový model (`src/types/simulation.ts`):**
  - Nový typ `AiMultiplier = 1 | 2 | 5` (s JSDoc komentářem).
  - Nové volitelné pole `Member.aiMultiplier?: AiMultiplier`. Chybějící hodnota = 1×, takže stávající kód, testy, presety i XLS import (feat-012) fungují beze změny.
- **Engine (`src/simulation/engine.ts`):**
  - V bloku „Postup práce“ ve funkci `tick()` se dnes volá `t.progress += dtSim`. Nově `t.progress += dtSim × multiplikátor jednotky, která task zpracovává (assignee)`.
  - Multiplikátor se čte v každém ticku, takže změna za běhu platí okamžitě a rozpracovanost se nezahodí (Příklad 4).
  - Jednotku k tasku `tick()` hledá jen tehdy, když má někdo v týmu AI zapnuté; bez AI (výchozí stav, Compare) horká smyčka nedělá žádné hledání navíc.
  - Sdílený helper `setMemberAiMultiplier(state, memberId, value)` zapíše hodnotu a vrátí `true` jen při skutečné změně. Používá ho Advanced i Cash Flow.
  - Ostatní logika se nemění: přiřazování tasků, idle čas (`idleSec`), výpočet Cycle Time a výnosů.
  - Engine zůstává čistý TypeScript bez Reactu.
- **Coordination overhead (feat-016) — rozhodnuto (varianta A):** multiplikátor zrychluje **celou práci tasku včetně join taxu**, protože tax je součástí `task.work`. Ztracený progres z reworku jednotka s AI dohání také zrychleně. Varianta B (join tax vždy 1×, AI nezrychlí domlouvání) je kandidát na navazující feature.
- **UI:**
  - `src/components/MemberCard.tsx`: tlačítko „AI“ vedle křížku, inline menu 2× / 5× / off (stejný princip jako picker specializací) a modrý odznak s bleskem (`--accent`). Nová prop `onSetAiMultiplier`. Statické styly tlačítka, odznaku a menu jsou v `src/components/MemberCard.module.css` (konvence CLAUDE.md); zbytek karty zůstává inline jako dosud. Stav otevřeného menu si pamatuje objekt jednotky, takže se po výměně týmu zavře sám.
  - `src/components/InProgressTeamPanel.tsx`: předá kartě nový handler.
  - `src/components/Simulator.tsx` (Experimentování) a `src/hooks/useCashFlowSimSetup.ts` (Cash Flow): handler `handleSetAiMultiplier(memberId, value)` zavolá `setMemberAiMultiplier` a jen při skutečné změně přepne preset na „custom“ (`markCustom`) a překreslí UI (`forceUpdate`).
  - Změna AI se počítá jako ruční úprava týmu, takže preset přejde na „custom“. Při přepnutí presetu se pak zobrazí potvrzovací dialog.
  - `src/components/CashFlowPanel.tsx`: doplnit větu do tooltipu dlaždice Coordination overhead (viz UI / Design).
- **Chování, které vyplývá z kódu:**
  - Reset (`resetFromSnapshot`) nuluje jen `currentTask` a `idleSec` členů, tým i jeho AI nastavení zachová (Příklad 6).
  - „Generate new backlog“ (`handleRegenerate` v Advanced i Cash Flow) kopíruje tým přes `{ ...m }`, takže AI nastavení také zachová (Příklad 6).
  - Přepnutí presetu (`applyPreset`) vytvoří nový tým, kde mají všechny jednotky 1× (Příklad 7).
  - Experimentování a Cash Flow mají každý vlastní tým (vlastní `stateRef`), takže nastavení AI v jednom režimu se nepřenáší do druhého.
  - Režim Srovnání (`ComparePanel`, `makeCompareStates`) se nemění a jeho týmy mají vždy 1×.
  - AI multiplikátor (rychlost práce v simulačním čase) je nezávislý na přepínači rychlosti simulace (počet volání `tick()` za reálnou sekundu, feat-001 / feat-015 Příklad 5).
  - Při velkém `dtSim` a 5× může task v jednom ticku „přestřelit“ `work`; zbytek ticku propadne stejně jako dnes (progress se ořízne na `work`). Při 60 fps je odchylka zanedbatelná.
- **Testy:** Příklady 1–4 a 6–9 jako unit testy enginu (`tests/unit/simulation/feat-019-ai-multiplikator.test.ts`), Příklad 5 jako test komponenty (`feat-019-member-card.test.tsx`, styly ověřuje přes třídy z CSS Modulu), napojení na Simulator (presety a `markCustom`, Reset a Generate new backlog, zachování progresu při změně za běhu, Cash Flow, Srovnání, tooltip) v `feat-019-simulator-integration.test.tsx`. Testy ověřují jen chování jednotek, ne dopad na metriky týmu.
- **Závislosti:** feat-002 (konfigurace týmu, `MemberCard`), feat-014 (presety, `markCustom`), feat-015 (Cash Flow, sdílený Team panel), feat-016 (coordination overhead — join tax).

## Open Questions
- Rozhodnuto: 1 = varianta A (zrychlení včetně join taxu); 2 = popisek „off“ zůstává.
- Rozhodnuto (fáze 4): spec netvrdí nic o dopadu AI na metriky týmu (Cycle Time, Total Time, WIP, výnos) — popisuje jen chování jednotek. Původní Příklad 8 („Cycle Time se zkrátí méně než 5×“) je odstraněn; měření ukázalo, že výsledek závisí na struktuře týmu a WIP režimu (Total Time se při AI jen u jedné jednotky nemusí změnit, v Reduce WIP může Cycle Time i vzrůst). Co z toho plyne, ukazuje simulace, ne spec.
- Rozhodnuto (z analýzy dopadu): **dlaždice Coordination overhead (feat-016) s AI → varianta A.** `joinTaxPct` = Σ `joinTaxSec` / Σ Cycle Time, kde `joinTaxSec` jsou sekundy **práce**; jednotka s AI 5× nad taxem stráví jen 1/5 tohoto času, takže dlaždice u týmu s AI ukáže vyšší podíl, než kolik koordinace reálně zabrala. Výpočet zůstává v sekundách práce, jen se doplní tooltip (viz UI / Design). Zamítnutá varianta B (přepočet na čas dělením multiplikátorem) je kandidát na navazující feature spolu s „join tax vždy 1×“.

## Related Features
- **feat-001-simulace-prubehu-vyvoje:** rychlost postupu práce už není pro všechny jednotky stejná (1 s simulace = 1 s práce); jednotka s AI odvede za 1 s simulace 2 nebo 5 s práce.
- **feat-002-konfigurace-tymu:** `MemberCard` dostává tlačítko „AI“ a menu; nová vlastnost jednotky `aiMultiplier`.
- **feat-009-dva-mody-ui:** režim Srovnání zůstává beze změny (bez AI).
- **feat-012-xls-import:** importovaný tým má AI 1×; sloupec pro AI není součástí této feature.
- **feat-014-unit-mode-preset:** změna AI přepne preset na „custom“; aplikace presetu vrací AI na 1×.
- **feat-015-cash-flow-mod:** AI je dostupné i v Cash Flow (sdílený `InProgressTeamPanel`); výpočet výnosu se nemění.
- **feat-016-coordination-overhead:** AI zrychluje i join tax (varianta A); rework jednotka s AI dohání zrychleně.
- **feat-021-prevod-design-system-org-flow:** AI odznak zůstává ve výplni `--accent`, ta je ale nově fialová (`#7a3bf0`) s textem `on-accent`; „modrý odznak“ výše je historický.
