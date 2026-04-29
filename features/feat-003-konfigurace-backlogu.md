# Feature: Konfigurace backlogu

## Status
implemented

## Problem
Agilní koučové potřebují demonstrovat různé scénáře — jednoduchý backlog se stejnorodými úkoly vs. komplexní backlog s velkou variabilitou. Bez možnosti nastavit parametry backlogu by každý workshop vypadal stejně a kouč by nemohl ukázat, jak variabilita práce ovlivňuje předvídatelnost dodání.

## User Story
Jako agilní kouč chci nastavit velikost backlogu a míru variability (velikost items, mix rolí), abych simuloval různé typy projektů a ukázal klientům vliv komplexity na průtok.

## UI / Design
- Konfigurační sekce je v levém panelu pod backlogem
- Tři ovládací prvky (Slider komponenty):
  - **Backlog size** (10–1000) — kolik features backlog obsahuje
  - **Item size variability** (0–1) — jak moc se liší pracnost jednotlivých features (0 = všechny stejně velké, 1 = velká rozptyl)
  - **Role-mix variability** (0–1) — jak moc se liší požadované role na features (0 = každá feature vyžaduje stejné role, 1 = velký rozptyl)
- Tlačítko **"Generate new backlog"** — vygeneruje nový backlog s aktuálním nastavením a novým seedem; zároveň vyčistí stav `finished` a znovu aktivuje tlačítko Play
- Změna slideru se projeví až po kliknutí na "Generate" (ne živě za běhu)

## Specification by Example

**Příklad 1: Generování backlogu s nízkou variabilitou**
- Given: Item size variability = 0, Role-mix variability = 0, Backlog size = 20
- When: Kouč klikne na "Generate new backlog"
- Then: Backlog obsahuje 20 features, každá s podobnou pracností a stejnými rolemi; simulace bude předvídatelná a rovnoměrná

**Příklad 2: Generování backlogu s vysokou variabilitou**
- Given: Item size variability = 1, Role-mix variability = 1, Backlog size = 20
- When: Kouč klikne na "Generate new backlog"
- Then: Backlog obsahuje 20 features s různou pracností (1–5 úkolů) a různými kombinacemi rolí; lead time bude nepravidelná

**Příklad 3: Reset backlogu po generování**
- Given: Kouč vygeneroval nový backlog a simulace proběhla
- When: Klikne na "Reset backlog"
- Then: Backlog se vrátí do stavu při posledním generování (stejný seed, stejné features); statistiky se vyčistí

## Out of Scope
- Ruční editace jednotlivých features (název, úkoly, role)
- Import backlogu z externího zdroje (Jira, CSV)
- Uložení konfigurace backlogu pro pozdější použití
- Živá změna parametrů za běhu simulace

## Technical Notes
- Generování: `regenerate()` v `src/simulation/engine.ts` — používá seedable RNG
- Seedable RNG: `mulberry32` — seed se mění při každém "Generate"
- Typy: `Feature`, `Task`, `SimSettings` v `src/types/simulation.ts`
- Slider komponenta: `src/components/Slider.tsx`
- 30 předpřipravených jmen features (Login flow, Search filters, Dark mode…)
- Počet úkolů na feature: 1–5 (závisí na `sizeVar`)
- Role na feature: 1–6 různých (závisí na `roleVar`); povinné role (required z feat-005) jsou vždy zahrnuty bez ohledu na `roleVar`
- `Feature.priority`: přiřazeno při vzniku (1 = nejdůležitější), nemění se — určuje pořadí zpracování týmem (viz feat-001)

## Open Questions
—
