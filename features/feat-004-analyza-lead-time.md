# Feature: Analýza Lead Time

## Status
draft

## Problem
Agilní koučové potřebují konkrétní čísla, která potvrdí nebo vyvrátí intuici klientů o výkonu týmu. Bez měření lead time a celkové doby zpracování backlogu je diskuse o zlepšení jen spekulativní — kouč nemůže ukázat, o kolik se zkrátila celková doba dodání po změně struktury týmu. Aktuální metrika Throughput (propustnost za 60s okno) navíc neposkytuje jasnou "cílovou čáru", která by dávala workshopu dramatický závěr.

## User Story
Jako agilní kouč chci vidět živý čítač celkové doby zpracování celého backlogu, který se zastaví ve chvíli, kdy je zpracována poslední položka, abych klientům ukázal jasný, měřitelný výsledek a mohl porovnávat, jak různá nastavení týmu zkrátí nebo prodlouží celkovou dobu dodání.

## UI / Design
- Analytická sekce je v pravém panelu, nad historií hotových features
- **Lead Time graf** (bodový scatter plot):
  - Osa X: pořadí dokončených features (chronologicky)
  - Osa Y: lead time v sekundách (od vytvoření do dokončení)
  - Každý bod = jedna dokončená feature
  - Horizontální čára = průměr (avg)
  - Horizontální čára = p85 percentil (výstražná hranice)
  - Automatické škálování osy Y (max = 1.1 × nejvyšší hodnota)
- **4 statistické dlaždice** (StatTile komponenty) pod grafem:
  - **Avg** — průměrná lead time všech hotových features
  - **Median (p50)** — 50. percentil lead time
  - **Avg WIP** — průměrný počet features v in-progress (Little's Law)
  - **Celkový čas** — živý čítač ve formátu `MM:SS.d` (minuty, sekundy, desetiny sekundy); tiká od spuštění simulace, zamrzne ve chvíli, kdy je zpracována poslední položka backlogu
- Tlačítko **"Reset stats"** — vyčistí historii lead times a statistiky (backlog a tým zůstanou)
- Po zpracování poslední položky backlogu:
  - Simulace se automaticky zastaví (pauza)
  - Tlačítko Play se deaktivuje (disabled) — nelze znovu spustit
  - Čítač zamrzne na výsledném čase
  - Veškeré výpočty statistik (Avg, Median, WIP) se zastaví

## Specification by Example

**Příklad 1: Živý čítač během simulace**
- Given: Simulace je spuštěna, backlog obsahuje 20 features
- When: Simulace běží a features se postupně dokončují
- Then: Dlaždice "Celkový čas" zobrazuje živý čítač ve formátu `01:23.4`; tiká plynule s každým tickem simulace

**Příklad 2: Zastavení simulace po zpracování posledního itemu**
- Given: Simulace běží, v backlogu i in-progress zbývá poslední feature
- When: Poslední feature přejde do Done
- Then: Simulace se automaticky zastaví; čítač zamrzne na výsledném čase (např. `04:17.8`); tlačítko Play se deaktivuje; ostatní dlaždice (Avg, Median, WIP) také přestanou aktualizovat

**Příklad 3: Porovnání výsledného času při různých konfiguracích týmu**
- Given: Kouč dokončil simulaci s týmem 3 členů — výsledný čas byl `06:42.1`; resetoval backlog a přidal 2 členy
- When: Spustí simulaci znovu
- Then: Simulace proběhne rychleji; čítač zamrzne na nižší hodnotě (např. `03:55.3`); kouč může porovnat obě čísla klientům

**Příklad 4: Reset statistik**
- Given: Graf obsahuje 20 bodů z předchozího běhu, čítač zobrazuje `04:17.8`
- When: Kouč klikne na "Reset stats"
- Then: Graf se vyčistí, všechny dlaždice se vynulují včetně čítače; tlačítko Play se znovu aktivuje; backlog a tým zůstanou beze změny; simulaci lze spustit znovu

## Out of Scope
- Export grafu nebo statistik do PDF, PNG, CSV
- Historické porovnání více měření (ukládání snapshotů statistik)
- Konfigurace zobrazených percentilů (p85 je pevně nastaveno)
- Cycle time nebo flow efficiency jako samostatné metriky
- Možnost pokračovat v simulaci po zpracování posledního itemu (simulace je u konce)

## Technical Notes
- Komponenta: `src/components/LeadTimeChart.tsx`, `src/components/StatTile.tsx`
- Metriky: `computeStats()` v `src/simulation/engine.ts` — odstranit Throughput, přidat `totalTime`
- Typy: `SimStats` v `src/types/simulation.ts` — nahradit pole `throughput` za `totalTime: number`
- Podmínka ukončení: backlog prázdný AND in-progress prázdný AND všechny úkoly dokončeny — detekovat v `tick()` v `src/simulation/engine.ts`
- Čítač zobrazuje simulační čas (ne reálný čas) — formát `MM:SS.d`, např. `04:17.8`
- Po detekci konce: nastavit příznak `finished: boolean` v `SimState`; Simulator.tsx reaguje zastavením smyčky a deaktivací Play tlačítka
- Reset stats musí také vyčistit příznak `finished` a znovu aktivovat Play tlačítko

## Open Questions
—
