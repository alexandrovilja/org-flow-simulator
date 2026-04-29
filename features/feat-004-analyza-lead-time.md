# Feature: Analýza Lead Time

## Status
implemented

## Problem
Agilní koučové potřebují konkrétní čísla, která potvrdí nebo vyvrátí intuici klientů o výkonu týmu. Bez měření lead time a celkové doby zpracování backlogu je diskuse o zlepšení jen spekulativní. Kouč potřebuje ukázat nejen výsledný čas, ale také přímé srovnání s předchozím nastavením — aby klienti viděli dopad změny týmu nebo konfigurace v reálném čase.

## User Story
Jako agilní kouč chci vidět živý čítač celkové doby zpracování backlogu a po každém dalším běhu simulace porovnání s předchozím výsledkem, abych klientům ukázal měřitelný rozdíl způsobený změnou struktury týmu nebo konfigurace.

## UI / Design
- Analytická sekce je v pravém panelu, nad historií hotových features
- **Záhlaví sekce:** nadpis "Lead Time" + text `N features sampled` vpravo
- **4 statistické dlaždice** (StatTile komponenty), zobrazeny jako jeden sloupec:
  - **Total Time** — živý čítač ve formátu `MM:SS.d`; po dokončení simulace zmrazí hodnotu a zobrazí `✓ Complete` se zeleným rámečkem
  - **Avg Lead Time** — průměrná lead time hotových features v sekundách; po druhém a dalším běhu zobrazí delta indikátor (viz níže)
  - **Avg WIP** — průměrný počet features v in-progress (Little's Law); po druhém a dalším běhu zobrazí delta indikátor
  - **Total Wait** — součet idle sekund všech členů s rolemi, kteří čekají na dostupnou práci; delta se zobrazí jen po dokončení běhu
- **Delta indikátor** (zobrazí se automaticky po dokončení druhého běhu):
  - `↓ 23%  vs prev run` — zelená, metrika se zlepšila (snížila)
  - `↑ 15%  vs prev run` — červená, metrika se zhoršila (zvýšila)
  - Reference se nastaví automaticky při dokončení simulace (`state.finished = true`); žádné ruční tlačítko
- Po zpracování poslední položky backlogu:
  - Simulace se automaticky zastaví
  - Tlačítko Play se deaktivuje
  - Čítač zamrzne na výsledném čase
  - Dlaždice Total Time přepne do stavu "Complete" (zelený rámeček, text `✓ Complete`)

## Specification by Example

**Příklad 1: Živý čítač během simulace**
- Given: Simulace je spuštěna, backlog obsahuje 20 features
- When: Simulace běží
- Then: Dlaždice "Total Time" zobrazuje živý čítač `01:23.4`; tiká plynule s každým tickem

**Příklad 2: Automatické zastavení a zmrazení čítače**
- Given: V backlogu i in-progress zbývá poslední feature
- When: Poslední feature přejde do Done
- Then: Simulace se automaticky zastaví; čítač zamrzne (např. `04:17.8`); dlaždice přepne do zeleného stavu `✓ Complete`; Play se deaktivuje

**Příklad 3: Delta srovnání po druhém běhu**
- Given: První běh dokončen, výsledný Avg Lead Time byl 8.4 s, Avg WIP byl 4.2, Total Wait 120 s
- When: Kouč resetuje nebo vygeneruje nový backlog, změní tým a dokončí druhý běh s Avg Lead Time 6.1 s, Avg WIP 3.0, Total Wait 80 s
- Then: Pod hodnotami se zobrazí `↓ 27%  vs prev run` (zelená) pro Avg Lead Time, `↓ 29%` pro Avg WIP a `↓ 33%` pro Total Wait

**Příklad 4: Srovnání při zhoršení**
- Given: Předchozí běh měl Avg Lead Time 6.1 s
- When: Kouč zmenší tým a dokončí nový běh s Avg Lead Time 9.3 s
- Then: Zobrazí se `↑ 52%  vs prev run` (červená)

## Out of Scope
- Graf Lead Time (scatter plot) — odstraněn, nepřidával workshopovou hodnotu
- Median (p50) jako samostatná statistická dlaždice — odstraněn
- Tlačítko "Reset stats" — odstraněno; reference na předchozí běh se ukládá automaticky
- Export statistik do PDF, PNG, CSV
- Konfigurace zobrazených percentilů
- Cycle time nebo flow efficiency jako samostatné metriky
- Možnost pokračovat v simulaci po zpracování posledního itemu

## Technical Notes
- Komponenty: `src/components/StatTile.tsx` (prop `delta?: number` pro delta indikátor, prop `variant="timer"` pro Total Time)
- Formátování čítače: `src/lib/formatTime.ts` — `formatTime(simSec)` → `MM:SS.d`; používá `Math.floor` (ne round) aby čítač nikdy nepřeskočil hodnotu
- Metriky: `computeStats()` v `src/simulation/engine.ts` — vrací `avg`, `p85`, histogramy
- Podmínka ukončení: `backlog.length === 0 && inProgress.length === 0` → `state.finished = true` — detekováno na konci `tick()`
- Delta uložení: `lastFinishedRef` (typ `RunSnapshot = { avgLt, avgWip, totalTime, totalWait }`) se uloží při konci simulace; do `prevStats` state se propaguje až při reset/regenerate — delta tak zůstane viditelná i po skončení běhu
- Stav `finished`: `SimState.finished: boolean` v `src/types/simulation.ts`; po nastavení na `true` RAF smyčka přestane volat `tick()`
- Animace pulzujícího indikátoru: CSS keyframes `timer-pulse` v `globals.css`

## Open Questions
—
