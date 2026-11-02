# Feature: Export výsledků do PDF

## Status
draft

## Problem
Agilní koučové po skončení simulace potřebují výsledky sdílet se svými klienty nebo účastníky workshopu. Aktuálně musí dělat screenshoty nebo ručně kopírovat data z obrazovky — to je zdlouhavé, neprofesionální a výsledky nevypadají dobře v reportech a prezentacích. Kouči tak nemohou snadno doložit průběh simulace ani porovnat výsledky různých týmů.

## User Story
Jako agilní kouč chci exportovat výsledky simulace do PDF, abych je mohl profesionálně sdílet s účastníky workshopu nebo klientem bez nutnosti screenshotů a ručního kopírování dat.

## UI / Design
- Tlačítko "Exportovat PDF" se zobrazí v pravém horním rohu panelu výsledků (Results Panel), vedle existujících ovládacích prvků.
- Po kliknutí na tlačítko se otevře modální dialog s možností výběru obsahu pro export: grafy průběhu simulace, tabulka výsledků, textové shrnutí (retrospektiva).
- Uživatel potvrdí výběr tlačítkem "Stáhnout PDF".
- Prohlížeč automaticky stáhne vygenerovaný PDF soubor s názvem ve formátu `simulation-export-YYYY-MM-DD.pdf`.
- Po úspěšném stažení se zobrazí krátká notifikace (toast) "PDF bylo úspěšně exportováno".

## Specification by Example

**Příklad 1: Úspěšný export dokončené simulace**
- Given: Simulace proběhla a panel výsledků zobrazuje grafy a tabulku výsledků
- When: Kouč klikne na "Exportovat PDF", vybere všechny sekce a potvrdí
- Then: Prohlížeč stáhne PDF soubor obsahující všechny vybrané sekce (grafy, tabulka, shrnutí) se správným datem v názvu souboru

**Příklad 2: Export s prázdným výběrem obsahu**
- Given: Modální dialog pro export je otevřený
- When: Kouč odznačí všechny sekce a klikne na "Stáhnout PDF"
- Then: Tlačítko "Stáhnout PDF" je deaktivované (disabled) a export není spuštěn; uživatel vidí hint "Vyberte alespoň jednu sekci"

**Příklad 3: Pokus o export před dokončením simulace**
- Given: Simulace stále běží a panel výsledků není dostupný
- When: Kouč se pokusí najít tlačítko "Exportovat PDF"
- Then: Tlačítko není zobrazeno nebo je deaktivované; export je dostupný pouze po dokončení simulace

## Out of Scope
- Přímé odesílání exportovaného PDF emailem z aplikace
- Ukládání PDF do cloudového úložiště (Google Drive, Dropbox apod.)
- Real-time náhled PDF před stažením
- Lokalizace obsahu PDF do více jazyků
- Export do jiných formátů (Excel, PNG, CSV) — to jsou samostatné features
- Uložení nastavení exportu (zapamatování posledního výběru sekcí)

## Technical Notes
- Pravděpodobně bude potřeba klientská knihovna pro generování PDF, např. jsPDF + html2canvas, nebo server-side řešení pomocí Puppeteer/Playwright (headless browser).
- Soubory, které se pravděpodobně dotknou změn: `ResultsPanel`, `ChartsView`, případně nová komponenta `ExportModal` a servisní vrstva `pdfExportService`.
- Feature závisí na dokončeném stavu simulace — je potřeba spolupracovat s logikou stavového automatu simulace.
- Při použití html2canvas je potřeba ošetřit fonty a SVG grafy, aby se správně renderovaly do canvasu.
- Výsledný PDF by měl být čitelný na mobilních zařízeních (dostatečná velikost písma, responzivní layout).

## Open Questions
- Jaký layout PDF preferujeme — portrait (A4) nebo landscape? Landscape může být vhodnější pro grafy.
- Má PDF obsahovat branding aplikace (logo Org Flow Simulator, záhlaví/zápatí)?
- Je export dostupný pouze po úplném dokončení simulace, nebo i v průběhu (např. pro průběžné výsledky)?
- Kdo schvaluje vizuální design PDF šablony — má existovat více šablon nebo jen jedna?
