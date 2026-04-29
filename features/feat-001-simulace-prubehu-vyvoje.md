# Feature: Simulace průběhu vývoje

## Status
implemented

## Problem
Agilní koučové potřebují živou, přesvědčivou demonstraci toho, jak práce skutečně protéká týmem — ne statický diagram nebo slidy. Bez spustitelné simulace nemohou klientům ukázat dopad různých rozhodnutí (velikost WIP, specializace, počet lidí) v reálném čase během workshopu.

## User Story
Jako agilní kouč chci spustit animovanou simulaci průtoku backlogu týmem, abych klientům živě ukázal, jak se features pohybují od backlogu přes in-progress až do done.

## UI / Design
- Hlavní layout se třemi sloupci: **Backlog** (vlevo), **In-Progress + Tým** (uprostřed), **Done + Lead Time** (vpravo)
- Horní lišta obsahuje ovládání simulace:
  - Tlačítko **Play/Pause** — spustí nebo pozastaví simulaci; deaktivuje se (disabled), jakmile je zpracována poslední položka backlogu (stav `finished`)
  - Volba rychlosti: **0.5×, 1×, 2×, 10×** — zrychlí simulační čas (zobrazena jako skupina tlačítek)
  - Tlačítko **Reset backlog** — vrátí backlog a tým do původního stavu (bez regenerace) a zároveň vyčistí stav `finished`, čímž se Play znovu aktivuje
- Každá feature je zobrazena jako karta s progress barem rozdělením na segmenty dle úkolů (FE, BE, DSGN, QA…)
- Přiřazení pracovníka k úkolu je viditelné jako iniciála v segmentu karty
- Hotové features se průběžně přesouvají do pravého panelu (Done)

## Specification by Example

**Příklad 1: Spuštění simulace**
- Given: Aplikace je načtena s výchozím týmem a backlogem
- When: Kouč klikne na tlačítko Play
- Then: Features se začnou pohybovat — členové týmu přebírají úkoly z backlogu, progress bary se plní, hotové features přecházejí do Done

**Příklad 2: Pauza a pokračování**
- Given: Simulace běží
- When: Kouč klikne na Pause
- Then: Animace se zastaví, stav se zachová; kliknutím na Play simulace pokračuje od stejného bodu

**Příklad 3: Zrychlení simulace**
- Given: Simulace běží rychlostí 1×
- When: Kouč klikne na 10×
- Then: Simulační čas plyne 10× rychleji, features se dokončují rychleji, statistiky se rychleji naplňují

**Příklad 4: Reset backlogu**
- Given: Simulace běžela a v Done panelu je několik hotových features
- When: Kouč klikne na "Reset backlog"
- Then: Stav se vrátí na snapshot z počátku (stejné features, stejné úkoly), statistiky se vyčistí; seed zůstane stejný — regenerace nenastane

**Příklad 5: Automatické zastavení po zpracování posledního itemu**
- Given: Simulace běží, v backlogu a in-progress zbývá jen jedna poslední feature
- When: Poslední feature přejde do Done
- Then: Simulace se automaticky zastaví; tlačítko Play se deaktivuje; kouč nemůže simulaci znovu spustit bez resetu nebo generování nového backlogu

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

## Open Questions
—
