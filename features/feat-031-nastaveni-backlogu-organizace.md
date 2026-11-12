# Feature: Nastavení backlogu (mód Organization, inkrement 4)

## Status
draft

*Inkrement 4 módu Organization (Týmy složené z lidí). Vznikl rozdělením feat-028 podle INVEST a SPIDR 2026-11-12. Závisí jen na inkrementu 1 ([feat-028](feat-028-tymy-slozene-z-lidi.md)). UI kontrakt je mockup [`docs/feat-028-ui-mockup.html`](../docs/feat-028-ui-mockup.html) (verze 9), scénáře jsou v [`docs/feat-028-test-analysis.md`](../docs/feat-028-test-analysis.md) a koncept testů v [`docs/feat-028-test-drafts/`](../docs/feat-028-test-drafts/README.md). Spec se dopracuje a schválí, až na inkrement přijde řada.*

## Problem
V inkrementu 1 má backlog pevnou velikost a skladbu. Kouč nemůže ukázat menší rychlý příklad ani backlog, kde featury zasahují do více oblastí.

## User Story
Jako agilní kouč chci nastavit velikost backlogu, počet oblastí na featuru, počet skillů v oblasti a pracnost úkolů a vygenerovat nový backlog, abych přizpůsobil běh délce workshopu a tomu, jak provázaná je práce klienta.

## Prior Art
Research: hluboký (2026-11-10) — [`docs/feat-028-research.md`](../docs/feat-028-research.md), společný pro všechny inkrementy módu Organization.

—

## UI / Design
- Settings → Backlog (rozbalovací sekce v levém sloupci):
  - `Generate new backlog`,
  - `Backlog size` 10–1000, výchozí 100 (`100 items`),
  - posuvníky min–max se dvěma jezdci (`RangeSlider`): `Areas per feature` 1 až počet oblastí (výchozí 1–3), `Skills per area` 1 až počet skillů (1–3), `Effort per skill` 1–20 dní (1–5), s tooltipy z mockupu.
- Hodnota `1–3 areas`, při shodě `2 areas`, u jedničky `1 area`; jezdci se nepřekříží; s jedinou možností je posuvník neaktivní.
- Nastavení se projeví až po `Generate new backlog`. Doběhnutý běh se po vygenerování stane předchozím jako v Cash Flow.

## Specification by Example
Scénáře: A6–A9, A11, C11, I5 a rozsahy v A2.

**Příklad 1: Generování podle posuvníků** *(A8)*
- Given: Backlog size 50, Areas per feature 2–2, Skills per area 1–1, Effort per skill 5–5
- When: kouč klikne na `Generate new backlog`
- Then: 50 featur, každá 2 různé oblasti po jednom úkolu s pracností 5

**Příklad 2: Jezdci se nepřekříží** *(A7)*
- Given: Effort per skill `1–5 days`
- When: kouč táhne minimum na 8
- Then: minimum se zastaví na 5 a posuvník ukazuje `5 days`

## Out of Scope
- Req. (povinný skill) a změna počtu oblastí a skillů v editorech (feat-036); posuvníky na ni zareagují stažením mezí, až feat-036 přijde.

## Technical Notes
- Engine: `generateOrgBacklog(rng, settings, setup)`, `clampOrgBacklogSettings`.
- Nová komponenta `RangeSlider` (dnešní `Slider` má jeden jezdec).
- Sekci Settings → Backlog založí první z inkrementů 4, 5 a 6, který přijde na řadu.

## Open Questions
—
