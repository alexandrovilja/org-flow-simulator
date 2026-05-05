# feat-010 — Cycle Time místo Lead Time

## Kontext

Aktuálně aplikace zobrazuje **Lead Time** = `finishedAt − createdAt`, tedy čas od zápisu featury do backlogu do jejího dokončení. To zahrnuje i čekání v backlogu, které tým nemůže ovlivnit.

**Cycle Time** = `finishedAt − startedAt` — čas od okamžiku, kdy tým začal na featurě aktivně pracovat, do jejího dokončení. Je to metrika efektivity samotného vývojového procesu.

Pro workshop agile coachů je Cycle Time relevantnější: ukazuje, jak rychle tým dokáže dokončit práci, kterou jednou začal — bez zkreslení způsobeného čekáním v backlogu.

## Cíl

Přejmenovat a přepočítat metriku z Lead Time na Cycle Time ve všech vrstvách aplikace:
- simulační engine (`engine.ts`)
- typy (`simulation.ts`)
- UI komponenty (StatTile, graf, popisky)

## Změny

### 1. Typy (`src/types/simulation.ts`)

- Přejmenovat `LeadTimeEntry.ms` → `LeadTimeEntry.ms` (hodnota zůstane `number`, ale sémantika se změní na `finishedAt − startedAt`)
- Přidat JSDoc vysvětlující, že `ms` je nyní Cycle Time
- Přejmenovat `SimStats` pole (kde relevantní) — názvy polí `avg`, `p50`, `p85` atd. zůstávají, jen JSDoc se aktualizuje

### 2. Engine (`src/simulation/engine.ts`)

- Řádek 544: změnit výpočet z `f.finishedAt - f.createdAt` na `f.finishedAt - (f.startedAt ?? f.createdAt)`
  - Fallback na `createdAt` je obranný — `startedAt` by nikdy nemělo být `null` ve chvíli dokončení
- Aktualizovat JSDoc u `LeadTimeEntry` a `computeStats`

### 3. UI (`src/components/`)

- Všechna místa, kde se zobrazuje text „Lead Time", přejmenovat na „Cycle Time"
- Graf a StatTile popisky aktualizovat

## Co se NEMĚNÍ

- Název pole `leadTimes` v `SimState` a pole `LeadTimeEntry` v typech — jsou to interní identifikátory, přejmenování by vyžadovalo velký refactor bez přidané hodnoty
- Výpočet handoffs — nesouvisí s touto metrikou
- Histogram a percentilový výpočet v `computeStats` — logika zůstává stejná, mění se jen vstupní hodnoty

## Acceptance criteria

1. `LeadTimeEntry.ms` = `finishedAt − startedAt` pro každou dokončenou feature
2. Všechny StatTile a popisky grafu zobrazují „Cycle Time" místo „Lead Time"
3. Unit testy pokrývají: feature s čekáním v backlogu má Cycle Time < Lead Time (starý výpočet)
4. Typecheck a lint projdou bez chyb

## Otevřené otázky

- Chceme také **zobrazovat Wait Time** (čas čekání v backlogu = `startedAt − createdAt`) jako doplňkovou metriku? → zatím NE, v MVP stačí Cycle Time
