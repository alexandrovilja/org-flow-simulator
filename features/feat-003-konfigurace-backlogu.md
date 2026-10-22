# Feature: Konfigurace backlogu

## Status
implemented

*Poznámka 2026-10-22 (feat-026): posuvník „Min. specializations“ se v UI jmenuje „Min. skills per item“ (hodnota „≥ N skills“) a „Role-mix variability“ se jmenuje „Skill-mix variability“ (hodnoty „2 skills“ / „1–6 skills“); nápovědy obou mluví o skills. Chování se nemění.*

## Problem
Agilní koučové potřebují demonstrovat různé scénáře — jednoduchý backlog se stejnorodými úkoly vs. komplexní backlog s velkou variabilitou. Bez možnosti nastavit parametry backlogu by každý workshop vypadal stejně a kouč by nemohl ukázat, jak variabilita práce ovlivňuje předvídatelnost dodání.

## User Story
Jako agilní kouč chci nastavit velikost backlogu a míru variability (velikost items, mix rolí), abych simuloval různé typy projektů a ukázal klientům vliv komplexity na průtok.

## UI / Design
- Konfigurační sekce je v levém panelu pod backlogem
- **Tlačítko "♻ Generate new backlog"** — vygeneruje nový backlog s aktuálním nastavením a novým seedem; umístěno jako první prvek v sekci, plná šířka, tmavé pozadí (`var(--ink)`); zároveň vyčistí stav `finished` a znovu aktivuje tlačítko Run
- Čtyři ovládací prvky (Slider komponenty), každý má `?` badge s nápovědou (tooltip):
  - **Backlog size** (10–1000) — kolik features backlog obsahuje
  - **Item size variability** (0–1) — jak moc se liší pracnost jednotlivých features (0 = všechny stejně velké, 1 = velký rozptyl)
  - **Role-mix variability** (0–1) — jak moc se liší požadované role na features (0 = každá feature vyžaduje stejné role, 1 = velký rozptyl)
  - **Min. specializations** (1–6) — minimální počet různých specializací, které musí každá feature obsahovat; hodnota 1 = žádný vynucený minimum, hodnota 6 = každá feature musí mít všechny role
- Změna slideru se projeví až po kliknutí na "Generate" (ne živě za běhu)

## Specification by Example

**Příklad 1: Generování backlogu s nízkou variabilitou**
- Given: Item size variability = 0, Role-mix variability = 0, Backlog size = 20
- When: Kouč klikne na "♻ Generate new backlog"
- Then: Backlog obsahuje 20 features, každá s podobnou pracností a stejnými rolemi; simulace bude předvídatelná a rovnoměrná

**Příklad 2: Generování backlogu s vysokou variabilitou**
- Given: Item size variability = 1, Role-mix variability = 1, Backlog size = 20
- When: Kouč klikne na "♻ Generate new backlog"
- Then: Backlog obsahuje 20 features s různou pracností (1–5 úkolů) a různými kombinacemi rolí; lead time bude nepravidelná

**Příklad 3: Reset backlogu po generování**
- Given: Kouč vygeneroval nový backlog a simulace proběhla
- When: Klikne na „↺ Reset“ (dřív „Reset backlog“, změna 2026-10-20, viz feat-021 Příklad 14)
- Then: Backlog se vrátí do stavu při posledním generování (stejný seed, stejné features); statistiky se vyčistí

**Příklad 4: Min. specializations = 3**
- Given: Role-mix variability = 0 (minimální variabilita), Min. specializations = 3
- When: Kouč klikne na "♻ Generate new backlog"
- Then: Každá feature v backlogu má alespoň 3 různé specializace, i když by roleVar samo generovalo méně

**Příklad 5: Tooltip na slideru**
- Given: Controls panel je viditelný
- When: Kouč najede myší na `?` badge u libovolného slideru
- Then: Zobrazí se nápověda vysvětlující, co slider ovlivňuje (title attribute)

## Out of Scope
- Ruční editace jednotlivých features (název, úkoly, role)
- Import backlogu z externího zdroje (Jira, CSV)
- Uložení konfigurace backlogu pro pozdější použití
- Živá změna parametrů za běhu simulace

## Technical Notes
- Generování: `regenerate()` v `src/simulation/engine.ts` — používá seedable RNG
- Seedable RNG: `mulberry32` — seed se mění při každém "Generate"
- Typy: `Feature`, `Task`, `SimSettings` v `src/types/simulation.ts`
- Slider komponenta: `src/components/Slider.tsx` — má volitelný prop `tooltip?: string`; zobrazí `?` badge s `title` atributem
- **Přístupné jméno slideru (revize 2026-10-13):** `<input type="range">` dostane `aria-label={label}`, takže čtečka obrazovky přečte např. „Backlog size“ a testy najdou slider přes `getByRole('slider', { name: 'Backlog size' })`. Vzhled se nemění. Pomocná funkce `setBacklogSize` v integračních testech feat-017 a feat-018 se tím zjednoduší na jeden dotaz místo procházení DOM struktury.
- Test: `tests/unit/simulation/feat-003-slider-aria-label.test.tsx` — vykreslený `Slider` s `label="Backlog size"` jde najít přes roli `slider` a jméno „Backlog size“.
- 30 předpřipravených jmen features (Login flow, Search filters, Dark mode…)
- Počet úkolů na feature: 1–5 (závisí na `sizeVar`)
- Role na feature: 1–6 různých (závisí na `roleVar`); povinné role (required z feat-005) jsou vždy zahrnuty bez ohledu na `roleVar`; min. počet rolí je vždy alespoň `settings.minSpecializations`
- `Feature.priority`: přiřazeno při vzniku (1 = nejdůležitější), nemění se — určuje pořadí zpracování týmem (viz feat-001)
- `SimSettings.minSpecializations`: nová hodnota, výchozí 1 (= žádný limit); engine respektuje při výpočtu `minRoles` v `makeFeature()`

## Open Questions
—
