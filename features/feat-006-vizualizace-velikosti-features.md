# Feature: Vizualizace velikosti features

## Status
implemented

## Problem
Kouč nemůže na první pohled poznat, jak se features liší velikostí. Aktuální FeatureCard zobrazuje tasky jako stejně wide segmenty bez ohledu na skutečnou pracnost — feature se 3 rychlými tasky vypadá stejně jako feature se 3 dlouhými. Při workshopu je přitom klíčové ukázat, proč variabilita velikosti způsobuje nepředvídatelný průtok.

## User Story
Jako agilní kouč chci vidět vizuálně, jak se features liší celkovou pracností a jak je tato pracnost rozložena mezi specializace, abych klientům na první pohled ukázal, proč variabilní backlog způsobuje nepředvídatelný Lead Time.

## UI / Design

### Stacked bar — segmenty úměrné work

Aktuální stav: každý task dostane `1/N` šířky baru.  
Nový stav: každý task dostane `task.work / feature.totalWork` šířky baru.

**Celková šířka baru = relativní velikost feature**

Bar nevyplňuje vždy celou šířku karty. Šířka baru je proporcionální vůči největší feature v aktuálně viditelné sadě (backlog + inProgress):

```
bar width = (feature.totalWork / maxWork) * 100%
```

kde `maxWork = max(totalWork)` přes všechny features v backlogu a inProgress dohromady.

Největší feature → bar 100% šířky karty.  
Menší features → bar proporcionálně užší.

Za barem zůstává viditelná „stopa" (prázdný track) aby bylo jasné, co je maximum.

**Vizuální struktura (pseudokód):**
```
[— track (100% šířky karty, světlé pozadí) —————————————]
[— bar (N% šířky)  [seg1][seg2][seg3] —]
```

**Segmenty:**
- Barva: role color z `roleConfig` (nebo ROLE_META jako fallback)
- Stav todo: barva s opacity 0.25 (jako dosud)
- Stav doing: progress fill (jako dosud)
- Stav done: plná barva (jako dosud)

**Compact karta (backlog):**
- Bar výška: 6 px (beze změny)
- Segmenty: proporcionální šířky (změna)
- Celková šířka baru: proporcionální (změna)

**Full karta (inProgress):**
- Bar výška: 22 px (beze změny)
- Segmenty: proporcionální šířky (změna)
- Celková šířka baru: proporcionální (změna)
- Iniciály a ✓ ikonky zůstávají (beze změny)

## Specification by Example

**Příklad 1: Dvě features různé velikosti**
- Given: Feature A má totalWork = 6.0 s, Feature B má totalWork = 3.0 s, maxWork = 6.0
- Then: Feature A má bar šířky 100 %, Feature B má bar šířky 50 %
- Vizuálně: Feature B je napůl tak „tlustá" jako Feature A

**Příklad 2: Segmenty uvnitř feature**
- Given: Feature se dvěma tasky: FE work=1.0, BE work=3.0, totalWork=4.0
- Then: FE segment zaujímá 25 % šířky baru, BE segment 75 %
- Vizuálně: BE úkol je jasně viditelně delší

**Příklad 3: Všechny features stejně velké**
- Given: sizeVar = 0 (uniform backlog), všechny totalWork ≈ stejné
- Then: všechny bary mají stejnou šířku (100 %)
- Vizuálně: není žádný rozdíl — očekávané chování

**Příklad 4: Nová feature přijde do backlogu s větším work**
- Given: maxWork se změní, protože nová feature je větší než předchozí max
- Then: všechny ostatní bary se proporcionálně zúží
- Poznámka: v MVP generujeme backlog najednou — maxWork se nemění za běhu

## Out of Scope
- Tooltip nebo label zobrazující absolutní hodnotu totalWork při hoveru
- Animace změny šířky baru (při změně maxWork)
- Done panel — zůstává beze změny (text + čas)
- Normalizace vůči historickým (done) features

## Technical Notes
- `FeatureCard` dostane nový prop `maxWork: number`
- `totalWork = feature.tasks.reduce((sum, t) => sum + t.work, 0)`
- `maxWork` se počítá v `Simulator.tsx` přes `[...backlog, ...inProgress]`
- Segmenty: `segWidth = t.work / totalWork * 100` (procenta uvnitř baru)
- Bar kontejner: `width = totalWork / maxWork * 100` (procenta karty)
- Track (pozadí za barem): `rgba(0,0,0,0.04)` na 100 % šířky
- Stávající prop `compact` a `neutral` zůstávají beze změny

## Open Questions
—
