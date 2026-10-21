# Feature: Simulace průběhu vývoje

## Status
implemented

*Změna (2026-10-20): ovládání běhu je ve všech módech stejné jako v Compare — pořadí „?“, „↺ Reset“, rychlost, „▶ Run“; tlačítko „Play“ (v UI „Start“ / „Resume“) je „▶ Run“, „Reset backlog“ je „↺ Reset“ a rychlost 2× se ruší. Upraveno UI / Design a Příklady 1, 2, 4 a 5; podrobnosti ve feat-021, Příklady 14–17.*

## Problem
Agilní koučové potřebují živou, přesvědčivou demonstraci toho, jak práce skutečně protéká týmem — ne statický diagram nebo slidy. Bez spustitelné simulace nemohou klientům ukázat dopad různých rozhodnutí (velikost WIP, specializace, počet lidí) v reálném čase během workshopu.

## User Story
Jako agilní kouč chci spustit animovanou simulaci průtoku backlogu týmem, abych klientům živě ukázal, jak se features pohybují od backlogu přes in-progress až do done.

## UI / Design
- Hlavní layout se třemi sloupci: **Backlog** (vlevo), **In-Progress + Tým** (uprostřed), **Done + Lead Time** (vpravo)
- Horní lišta obsahuje ovládání simulace, stejné ve všech třech módech a v tomto pořadí (změna 2026-10-20):
  - Tlačítko **?** — znovu spustí tutoriál módu (Compare a Advanced; Cash Flow tutoriál nemá, a tak ani „?“)
  - Tlačítko **↺ Reset** — vrátí backlog a tým do původního stavu (bez regenerace) a zároveň vyčistí stav `finished`, čímž se Run znovu aktivuje
  - Volba rychlosti: **0.5×, 1×, 10×** — zrychlí simulační čas (zobrazena jako skupina tlačítek)
  - Tlačítko **▶ Run / ❙❙ Pause** — spustí nebo pozastaví simulaci; před prvním spuštěním pulzuje; jakmile je zpracována poslední položka backlogu (stav `finished`), ukáže „✓ Done“ a je vypnuté (disabled)
- Každá feature je zobrazena jako karta s progress barem rozdělením na segmenty dle úkolů (FE, BE, DSGN, QA…)
- Přiřazení pracovníka k úkolu je viditelné jako iniciála v segmentu karty
- Hotové features se průběžně přesouvají do pravého panelu (Done)

## Specification by Example

**Příklad 1: Spuštění simulace**
- Given: Aplikace je načtena s výchozím týmem a backlogem
- When: Kouč klikne na tlačítko „▶ Run“
- Then: Features se začnou pohybovat — členové týmu přebírají úkoly z backlogu, progress bary se plní, hotové features přecházejí do Done

**Příklad 2: Pauza a pokračování**
- Given: Simulace běží
- When: Kouč klikne na „❙❙ Pause“
- Then: Animace se zastaví, stav se zachová a tlačítko ukáže znovu „▶ Run“; kliknutím na něj simulace pokračuje od stejného bodu

**Příklad 3: Zrychlení simulace**
- Given: Simulace běží rychlostí 1×
- When: Kouč klikne na 10×
- Then: Simulační čas plyne 10× rychleji, features se dokončují rychleji, statistiky se rychleji naplňují

**Příklad 4: Reset backlogu**
- Given: Simulace běžela a v Done panelu je několik hotových features
- When: Kouč klikne na „↺ Reset“
- Then: Stav se vrátí na snapshot z počátku (stejné features, stejné úkoly), statistiky se vyčistí; seed zůstane stejný — regenerace nenastane

**Příklad 5: Automatické zastavení po zpracování posledního itemu**
- Given: Simulace běží, v backlogu a in-progress zbývá jen jedna poslední feature
- When: Poslední feature přejde do Done
- Then: Simulace se automaticky zastaví; tlačítko běhu ukáže „✓ Done“ a je vypnuté; kouč nemůže simulaci znovu spustit bez resetu nebo generování nového backlogu

**Příklad 6: Počet v panelu Done odpovídá všem hotovým features (revize 2026-10-13)**
- Given: backlog má 100 features (výchozí velikost v Compare, Advanced i Cash Flow)
- When: simulace doběhne do konce (všech 100 features je hotových)
- Then: hlavička panelu Done ukazuje 100 — ve všech třech módech a v Compare u obou týmů. Seznam karet pod hlavičkou dál ukazuje jen 40 nejnovějších, starší se z displaye vytěsňují.
- Note: dřív hlavička ukazovala počet zobrazených karet, takže se zastavila na 40 a kouč viděl „Backlog 0, In Progress 0, Done 40“ u backlogu o 100 features.

## Out of Scope
- Krokové přehrávání (frame-by-frame)
- Uložení a načtení rozběhnuté simulace
- Sdílení živé simulace s dalšími uživateli
- Export animace jako video nebo GIF

## Technical Notes
- Engine: `src/simulation/engine.ts` — čistý TypeScript, bez závislosti na Reactu
- Hlavní smyčka: `requestAnimationFrame` v `src/components/Simulator.tsx` přes `useRef`
- Snapshot mechanika: `resetFromSnapshot()` obnoví stav bez nové randomizace
- Typy: `SimState`, `SimSettings` v `src/types/simulation.ts`
- Seedable RNG: `mulberry32` — stejný seed = stejný průběh
- **Přiřazování úkolů — priorita:** každá feature má pole `priority: number` přiřazené při vzniku (nižší číslo = vyšší priorita). Člen týmu vždy vezme úkol z dostupné feature s nejnižším číslem priority, bez ohledu na to, jestli je v backlogu nebo inProgress. Feature se přesouvá z backlogu do inProgress až ve chvíli, kdy na ni někdo začne pracovat.
- **Přiřazování úkolů — úrovně (level):** v rámci jedné feature musí být dokončeny všechny úkoly nižší úrovně (nižší číslo = dřívější fáze) dříve, než lze zahájit úkoly vyšší úrovně. Úkoly na stejné úrovni mohou probíhat paralelně. Konfigurace úrovní viz feat-005.
- Dotčené soubory: `src/simulation/engine.ts` (`tick`, `makeInitialState`), `src/types/simulation.ts` (`Feature.priority`)
- **Počet hotových features (Příklad 6):** `tick()` drží v `state.done` nejvýš 40 karet pro zobrazení a starší přesouvá do `state.doneOverflow` (viz feat-015). Nová exportovaná čistá funkce `doneCount(state)` v `src/simulation/engine.ts` vrací `state.done.length + state.doneOverflow.length`. Hlavičky panelu Done ji používají místo `done.length`: `ComparePanel.tsx` (Compare, oba týmy), `Simulator.tsx` (Advanced) a `CashFlowPanel.tsx` (Cash Flow). Prázdný stav („No completed features yet.“ / „None yet“) se dál řídí tím, jestli je seznam karet prázdný. Jedno místo výpočtu zaručí, že se módy nerozejdou.
- Test: `tests/unit/simulation/feat-001-done-count.test.ts` — `doneCount` po doběhnutí backlogu o 100 features vrátí 100 (zatímco `state.done` má 40); pro backlog pod 40 features se rovná `state.done.length`; pro nový stav vrátí 0.

## Open Questions
—

## Related Features
- **feat-024-zpetna-vazba-uzivatelu (rozpracováno):** otevření dialogu zpětné vazby pozastaví běžící simulaci stejně jako „❙❙ Pause“ (tlačítko ukáže „▶ Run“, simulace pak pokračuje od stejného bodu); chování tlačítka běhu se nemění.
