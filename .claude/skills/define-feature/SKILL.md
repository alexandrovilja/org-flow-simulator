---
name: define-feature
description: Guides you through defining a new feature for Org Flow Simulator using a structured interview in Czech. Use this skill whenever the user wants to create a feature spec, add a feature to the backlog, define what to build next, or document a feature idea. Trigger on phrases like "chci přidat feature", "nadefinuj feature", "nová feature", "feature spec", "I want to add a feature", "let's define a feature", "pomoz mi s feature". Always use this skill when a new feature needs to be specified — don't try to define features without it.
---

# Define Feature

Pomáháš uživateli nadefinovat novou feature pro **Org Flow Simulator** — real-time simulátor agilního backlogu pro agilní kouče. Výsledkem bude strukturovaný feature spec soubor uložený v `features/`.

## Proces

Proveď uživatele rozhovorem — **jedna otázka najednou**. Počkej na odpověď a teprve pak pokračuj na další otázku. Buď přátelský a konverzační, ne formální.

### Otázky (v tomto pořadí)

**1. Název**
"Jak by se tato feature jmenovala? (krátký název, 2–5 slov)"

Hned po odpovědi urči číslo a slug feature (viz sekce **Číslo a slug featury** níže) — potřebuje je research soubor i uložení specu.

**2. Problém**
"Jaký problém tato feature řeší? Co chtějí agilní koučové nebo uživatelé dělat, co teď nemohou — a proč je to limitující?"

**2b. Research (volitelné)**
"Chceš, abych před dalšími otázkami zjistil, jak podobné featury řeší jiné produkty?
- **Ne** — pokračujeme (výchozí)
- **Rychlý** — 3–5 příkladů s odkazy, hotovo během rozhovoru
- **Hluboký** — samostatný research uložený do `docs/feat-NNN-research.md`, rozhovor na něj počká"

Pravidla pro tuto otázku:
- Research je **volitelný**. Spusť ho jen po výslovné odpovědi „rychlý" nebo „hluboký". Odpověď „ne", „pokračuj" nebo žádná volba = pokračuj rovnou otázkou 3.
- Jde-li zjevně o nový koncept nebo nové UI, přidej k otázce jednu větu s doporučením research zvolit. U úprav existující feature, revizí a bugfixů research nedoporučuj.
- **Rychlý research (A):** spusť jednoho subagenta (nebo WebSearch) se zadáním: problém z odpovědi 2 a tyto typy zdrojů — koučovské simulace a board hry, nástroje pro flow analytics (CFD, scatterplot, forecasting), nástroje pro org design a obecné UX vzory pro daný typ ovládání či vizualizace. Vrať 3–5 příkladů. Prezentuj je jako tabulku `Produkt | Jak to řeší | Zdroj (URL, datum)` a zeptej se, co si uživatel z nich bere a co ne. Výsledek zapiš do sekce `Prior Art` (sloupec „Co si bereme / nebereme" vyplň podle odpovědi uživatele). Drž to na pár minut — není to hluboká rešerše.
- **Hluboký research (B):** spusť skill `research-feature` a předej mu číslo, slug, název a odpověď na otázku 2. Rozhovor pozastav — pokračuj otázkou 3 teprve poté, co uživatel research schválí. Do sekce `Prior Art` přepiš jen krátké shrnutí (3–5 řádků tabulky) a odkaz na `docs/feat-NNN-research.md`.
- **Společná pravidla:**
  - Výsledek researche je **vstup, ne rozhodnutí**: u otázek 4 a 5 ho nabídni jako návrh („Z researche plyne X — chceš to takto?"), rozhoduje uživatel. Research nesmí bez jeho souhlasu změnit scope (`Out of Scope`).
  - U každého nálezu uveď odkaz a datum přístupu. Shrnuj vlastními slovy, bez delších citací.
  - Nic nenalezeno → řekni to, nevymýšlej produkty ani funkce.
  - Nepiš tvrzení o dopadu na metriky týmu — popisuj jen, co jiné produkty dělají.

**3. User story**
"Kdo tuto feature používá, co chce dělat a proč? Zkus formulaci:
*Jako [role] chci [cíl], abych [důvod].*"

**4. UI / Design**
"Co uživatel vidí a s čím pracuje? Popiš:
- jaké nové prvky se objeví (tlačítka, panely, grafy, vstupy)
- kde v aplikaci se nacházejí (vlevo/vpravo/nahoře, v jakém panelu)
- co uživatel udělá, aby feature spustil
- jakou vizuální zpětnou vazbu dostane"

**5. Specification by Example**
"Uveď konkrétní příklad chování ve striktním formátu:

**Given:** [počáteční stav nebo kontext]
**When:** [akce uživatele nebo systémová událost]
**Then:** [očekávaný výsledek]

Máš více příkladů? Pokud ano, uveď je všechny — každý příklad pokryje jeden test."

**6. Out of Scope**
"Co **není** součástí této feature? Co by si uživatel mohl myslet, že tam bude, ale nebude? (Pokud nic nenapadá, napiš 'nic')"

**7. Technical Notes**
"Jsou nějaká technická omezení, soubory které se pravděpodobně změní, nebo závislosti na jiných features? (Pokud ne, napiš 'žádné')"

**8. Open Questions**
"Jsou nějaké nevyřešené otázky nebo nejasnosti, které je potřeba zodpovědět před implementací? (Pokud ne, napiš 'žádné')"

---

## Číslo a slug featury (urči hned po otázce 1)

### Číslo feature
Přečti obsah adresáře `features/`. Najdi soubory ve formátu `feat-NNN-*.md` a vezmi nejvyšší číslo NNN. Nová feature dostane číslo o 1 vyšší. Pokud žádné feat-NNN soubory neexistují, začni od `001`.

### Slug
Z názvu feature vytvoř slug: malá písmena, pomlčky místo mezer a diakritiky, max 4 slova.
Příklady:
- "Export výsledků do PDF" → `export-vysledku-pdf`
- "Porovnání dvou simulací" → `porovnani-dvou-simulaci`
- "Save team configuration" → `save-team-configuration`

---

## Po rozhovoru

### 1. Ulož soubor
Před uložením ověř, že číslo NNN je stále volné (`features/feat-NNN-*.md` neexistuje). Ulož feature spec do `features/feat-NNN-slug.md`. Použij tuto strukturu (přejatou ze šablony v `features/TEMPLATE.md`):

```markdown
# Feature: [Název]

## Status
draft

## Problem
[Odpověď z otázky 2]

## User Story
[Odpověď z otázky 3]

## Prior Art
Research: [neproběhl | rychlý | hluboký — `docs/feat-NNN-research.md`]

[Tabulka z researche: Produkt | Jak to řeší | Co si bereme / nebereme | Zdroj (URL, datum) — nebo "—" pokud research neproběhl]

## UI / Design
[Odpověď z otázky 4]

## Specification by Example

**Příklad 1: [krátký název]**
- Given: [...]
- When: [...]
- Then: [...]

**Příklad 2: [krátký název]** *(pokud existuje)*
- Given: [...]
- When: [...]
- Then: [...]

## Out of Scope
[Odpověď z otázky 6, nebo "—" pokud žádné]

## Technical Notes
[Odpověď z otázky 7, nebo "—" pokud žádné]

## Open Questions
[Odpověď z otázky 8, nebo "—" pokud žádné]
```

### 2. Analýza dopadu na existující features

Přečti všechny ostatní soubory `feat-NNN-*.md` v adresáři `features/` (kromě nově vytvořeného).

Pro každou existující feature posouď:

- **Překryv nebo konflikt** — řeší tato existující feature podobný problém? Mohl by nastat překryv funkcionality?
- **Závislost** — závisí nová feature na existující, nebo naopak? (Např. "Save team config" závisí na existenci team panelu.)
- **Dopad na Out of Scope** — je něco, co je v nové feature označeno jako Out of Scope, ale mohlo by patřit do existující?
- **Potřeba upřesnění** — odhaluje nová feature mezeru nebo nejasnost v existující specifikaci, která by měla být doplněna?

Výstup analýzy prezentuj přehledně:

```
## Dopad na existující features

### feat-NNN-nazev
- **Vztah:** [závislost / překryv / žádný]
- **Co to znamená:** [1–2 věty]
- **Navrhované úpravy v existující feature:** [konkrétní doplnění nebo změna, nebo "žádné"]
```

Pokud neexistují žádné jiné feature soubory, tuto sekci přeskoč.

### 3. Aktualizace dotčených features

Pro každou existující feature, kde jsi v předchozím kroku identifikoval navrhované úpravy:

1. Otevři soubor existující feature
2. Doplň nebo uprav relevantní sekce (nejčastěji `Technical Notes`, `Out of Scope`, nebo přidej novou `## Related Features` sekci)
3. Změny proveď — nevyžaduj potvrzení pro každý soubor zvlášť, uprav vše najednou
4. Vypiš seznam upravených souborů a co konkrétně bylo změněno

### 4. Potvrď uživateli
Vypiš cestu k nově uloženému souboru, seznam upravených existujících features a zeptej se:
"Soubor uložen: `features/feat-NNN-slug.md` ✓
[Případně: Research: `docs/feat-NNN-research.md`]
[Případně: Upraveny existující features: feat-XXX, feat-YYY]

Vypadá vše správně, nebo chceš něco upravit?"

---

## Jazyk
Komunikuj česky. Pokud uživatel píše anglicky, přepni do angličtiny — včetně otázek i výstupu.
