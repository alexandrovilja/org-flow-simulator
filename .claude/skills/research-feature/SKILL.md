---
name: research-feature
description: Deep research of how similar products solve a problem that a planned Org Flow Simulator feature addresses (prior art). Use when define-feature offers "hluboký research" and the user picks it, or when the user asks for "research podobných featur", "jak to řeší jiné produkty", "prior art", "konkurenční analýza" for a feature. Produces a structured, sourced report in docs/feat-NNN-research.md and a short summary for the Prior Art section of the feature spec. Research is optional and never starts on its own.
---

# Research Feature

Děláš hluboký research pro **Org Flow Simulator** — real-time simulátor agilního backlogu pro agilní kouče: jak podobné produkty řeší problém, který má plánovaná feature řešit. Výsledkem je soubor `docs/feat-NNN-research.md` a krátké shrnutí pro sekci `Prior Art` ve feature specu.

Research je **vstup, ne rozhodnutí**. Nic v něm nemění scope feature bez souhlasu uživatele.

## Vstupy

Od `define-feature` dostaneš: číslo `NNN`, slug, název feature a odpověď na otázku „Problém".

Pokud tě uživatel zavolal samostatně, zeptej se na název a problém (jedna otázka najednou). Číslo zjisti takto: pokud už existuje `features/feat-NNN-*.md` pro tuto feature, použij jeho číslo; jinak vezmi nejvyšší `NNN` v `features/` a přičti 1.

## Postup

Komunikuj česky (anglicky, pokud uživatel píše anglicky). Mezi kroky 1 a 4 se vždy zastav a počkej na odpověď uživatele.

### 1. Výzkumná otázka
Formuluj jednu větu: „Jak [typy produktů] řeší [problém z pohledu agilního kouče]?" a navrhni 2–4 kategorie produktů ke zkoumání, například:
- koučovské simulace a board hry,
- nástroje pro flow analytics (CFD, scatterplot, forecasting),
- nástroje pro org design a modelování,
- obecné UX vzory pro daný typ ovládání nebo vizualizace.

Zeptej se uživatele, jestli otázku a kategorie potvrdí nebo upraví. Cíl je 4–8 produktů celkem.

### 2. Rešerše
Pro každou kategorii spusť jednoho subagenta (paralelně), každý s WebSearch / WebFetch. Pokud je dostupný skill `deep-research`, můžeš rešerši vést přes něj. Každý subagent vrací za produkt:
- název a odkaz,
- jak to řeší (chování a UI, popsané vlastními slovy),
- datum přístupu,
- co zůstalo nejasné.

Používej jen veřejně dostupné zdroje. Zdroj za přihlášením nebo paywallem se nesnaž obejít — označ ho jako nedostupný.

### 3. Syntéza
Z nálezů sestav:
- **vzory** napříč produkty a hlavní rozdíly,
- **co si bereme / nebereme** — jako návrh k diskusi, ne jako rozhodnutí,
- **otevřené otázky**, které research nezodpověděl.

### 4. Ulož a předlož ke schválení
Ulož `docs/feat-NNN-research.md` v této struktuře:

```markdown
# Research: [Název feature] (feat-NNN)

## Výzkumná otázka
[Jedna věta z kroku 1]

## Metoda
- Datum: [RRRR-MM-DD]
- Kategorie produktů: [...]
- Omezení: [co se nepodařilo dohledat nebo bylo nedostupné]

## Nálezy

### [Produkt]
- **Zdroj:** [URL] (přístup RRRR-MM-DD)
- **Jak to řeší:** [...]
- **Co je relevantní pro nás:** [...]
- **Co je nejasné:** [...]

## Vzory napříč produkty
- [...]

## Co si bereme / nebereme (návrh)
- Bereme: [...]
- Nebereme: [...]

## Otevřené otázky
- [...]
```

Pak se zeptej: „Research uložen: `docs/feat-NNN-research.md` ✓ Schvaluješ, nebo chceš něco doplnit?" Čekej na odpověď. Bez schválení nepokračuj.

### 5. Předej řízení
Po schválení:
- připrav pro `define-feature` shrnutí do sekce `Prior Art` — 3–5 řádků tabulky `Produkt | Jak to řeší | Co si bereme / nebereme | Zdroj (URL, datum)` a odkaz na research soubor,
- pokud tě zavolal `define-feature`, vrať řízení — rozhovor pokračuje otázkou 3.

## Pravidla

- U každého tvrzení uveď zdroj (URL a datum přístupu).
- Shrnuj vlastními slovy. Nekopíruj delší pasáže z cizích stránek; nanejvýš jedna krátká citace s uvedením zdroje.
- Nic nenalezeno → napiš to. Nevymýšlej produkty ani funkce.
- Nepiš tvrzení o dopadu na metriky týmu (co by feature změnila) — popisuj jen, co jiné produkty dělají.
- Neměň scope feature ani `Out of Scope`; jen navrhuj.
- Do repozitáře neukládej screenshoty ani zkopírované texty z cizích produktů.
