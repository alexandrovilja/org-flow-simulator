# Feature: Porovnání dvou běhů simulace

## Status
draft

## Problem
Koučové chtějí ukázat klientům konkrétní dopad změny týmové struktury. Dnes mohou spustit simulaci před změnou a po změně, ale výsledky vidí vždy jen pro jeden běh najednou — musí si je pamatovat nebo ručně porovnávat na papíře či v hlavě. To je zdlouhavé, nepřesné a při prezentaci klientům nepřesvědčivé. Chybí jim nástroj, který by vizuálně a okamžitě ukázal rozdíl.

## User Story
Jako agilní kouč chci vedle sebe vidět výsledky dvou různých simulací, abych mohl klientovi přehledně ukázat, jak změna týmové struktury ovlivní průtok a dobu dodání.

## UI / Design
- Nové tlačítko "Porovnat" v hlavním toolbaru (vedle tlačítka "Spustit simulaci")
- Po kliknutí se hlavní plocha rozdělí na dva panely (split-view, levý a pravý)
- Každý panel zobrazuje kompletní výsledky jednoho běhu: graf průběhu sprintů, klíčové metriky (throughput, lead time, WIP)
- Nad každým panelem je label "Běh A" / "Běh B" s dropdown pro výběr ze seznamu uložených/spuštěných běhů v aktuální session
- Rozdílové hodnoty metrik jsou zvýrazněny barevně v přehledném řádku mezi panely (zelená = zlepšení, červená = zhoršení, oproti Běhu A jako baseline)
- Tlačítko "Zpět" nebo "Zavřít porovnání" vrátí zobrazení na standardní jednoběhový pohled

## Specification by Example

**Příklad 1: Kouč porovná běh před a po přidání vývojáře**
- Given: Kouč má spuštěné dva běhy — Běh A (tým 3 vývojáři) a Běh B (tým 4 vývojáři) — oba jsou dostupné v seznamu běhů aktuální session
- When: Kouč klikne na "Porovnat", v levém panelu vybere Běh A a v pravém panelu vybere Běh B
- Then: Oba panely zobrazí grafy a metriky svých běhů vedle sebe; řádek s rozdíly ukáže např. "+18 % throughput" zeleně a "−2 dny lead time" zeleně

**Příklad 2: Kouč se pokusí porovnat, ale má spuštěný jen jeden běh**
- Given: Kouč má v aktuální session spuštěný pouze jeden běh (Běh A); žádný druhý běh zatím neexistuje
- When: Kouč klikne na "Porovnat" a v pravém panelu otevře dropdown pro výběr Běhu B
- Then: Dropdown zobrazí pouze Běh A jako dostupnou možnost a informativní zprávu "Spusťte další simulaci, abyste mohli porovnat výsledky"; pravý panel zůstane prázdný, dokud druhý běh není k dispozici

## Out of Scope
- Porovnání více než dvou běhů najednou (3-way nebo N-way srovnání)
- Sdílení porovnání jako permalink nebo URL
- Export porovnání do PDF nebo obrázku
- Porovnání běhů napříč různými sessions (persistované ukládání mezi obnovením stránky)

## Technical Notes
- Pravděpodobně dotčené soubory: SimulationResultsPanel, nová komponenta ComparisonView (nebo SplitView)
- Výsledky běhů musí být uchovávány v in-memory stavu po celou dobu session (např. Redux store nebo React context se seznamem běhů)
- Závisí na schopnosti systému identifikovat a pojmenovat jednotlivé běhy (Běh A, Běh B, …)
- Responzivita: split-view nemusí fungovat dobře na malých obrazovkách — lze omezit na desktop

## Open Questions
- Jak dlouho / kde se uchovávají výsledky běhů: pouze v paměti (session only), nebo v localStorage pro přežití refresh stránky?
- Má se porovnání vizuálně synchronizovat (scrollování obou panelů najednou, nebo nezávisle)?
- Kolik běhů maximálně může být v seznamu pro výběr (limit pro výkon/UX)?
