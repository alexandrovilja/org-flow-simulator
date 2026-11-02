# Feature: Export výsledků do PDF

## Status
draft

## Problem
Agilní koučové potřebují sdílet výsledky simulace se svými klienty nebo týmy po skončení workshopu. Aktuálně není možné výsledky exportovat — koučové musí pořizovat screenshoty nebo ručně kopírovat data, což je zdlouhavé a neprofesionální.

## User Story
Jako agilní kouč chci exportovat výsledky simulace do PDF, abych je mohl profesionálně sdílet s klienty a použít je jako podklad pro retrospektivu.

## UI / Design
- Tlačítko "Export PDF" se zobrazí v pravém horním rohu panelu s výsledky simulace
- Kliknutím se otevře dialog s možností vybrat, které sekce zahrnout (grafy, tabulky, shrnutí)
- Po potvrzení se vygeneruje PDF a automaticky stáhne do počítače uživatele
- Během generování se zobrazí loading spinner; po dokončení notifikace "PDF uloženo"

## Specification by Example

**Příklad 1: Základní export po dokončení simulace**
- Given: Simulace byla dokončena a zobrazují se výsledky (burndown chart, velocity, throughput)
- When: Uživatel klikne na "Export PDF" a potvrdí výběr sekcí
- Then: Stáhne se PDF soubor obsahující vybrané grafy a tabulky s datem a názvem simulace

**Příklad 2: Export s vlastním názvem**
- Given: Uživatel má dokončenou simulaci a chce pojmenovat výstupní soubor
- When: V exportním dialogu vyplní název souboru a klikne "Stáhnout"
- Then: PDF se uloží pod zadaným názvem

## Out of Scope
- Export do jiných formátů (Excel, CSV, PNG)
- Sdílení přes email přímo z aplikace
- Automatický export po každé simulaci

## Technical Notes
- Pravděpodobně využije knihovnu jako `jsPDF` nebo `html2canvas` + `jsPDF`
- Dotčené soubory: komponenty v `src/components/results/`, případně nový `src/utils/export.ts`
- Závislost na existujícím výsledkovém panelu
- **feat-003 (Porovnání dvou simulací):** Export do PDF bude v budoucnu potřeba rozšířit o podporu porovnávacího pohledu (dva panely vedle sebe). Exportní utilita v `src/utils/export.ts` by měla být navržena tak, aby zvládla jak jednopanelový, tak dvoupanelový layout.

## Open Questions
- Má PDF obsahovat i konfiguraci týmu, která vedla k výsledkům?
- Jaká má být orientace stránky (na výšku / na šířku)?
- Má export podporovat i porovnávací pohled z feat-003 (dva panely vedle sebe na jedné stránce PDF)?

## Related Features
- **feat-003-porovnani-dvou-simulaci** — export porovnání dvou simulací do PDF je explicitně out of scope pro feat-003 a bude řešen jako rozšíření této feature
