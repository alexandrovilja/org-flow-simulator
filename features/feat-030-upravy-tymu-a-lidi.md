# Feature: Úpravy týmů a lidí (mód Organization, inkrement 3)

## Status
draft

*Inkrement 3 módu Organization (Týmy složené z lidí). Vznikl rozdělením feat-028 podle INVEST a SPIDR 2026-11-12. Závisí jen na inkrementu 1 ([feat-028](feat-028-tymy-slozene-z-lidi.md)). UI kontrakt je mockup [`docs/feat-028-ui-mockup.html`](../docs/feat-028-ui-mockup.html) (verze 9), scénáře jsou v [`docs/feat-028-test-analysis.md`](../docs/feat-028-test-analysis.md) a koncept testů v [`docs/feat-028-test-drafts/`](../docs/feat-028-test-drafts/README.md). Spec se dopracuje a schválí, až na inkrement přijde řada.*

## Problem
V inkrementu 1 je organizace pevná. Kouč nemůže postavit organizaci podobnou té klientově, přesunout člověka do jiného týmu ani ukázat, co se stane, když týmu chybí skill.

## User Story
Jako agilní kouč chci přidávat, odebírat a přejmenovávat týmy, měnit lidi a jejich skilly a přesouvat lidi mezi týmy, abych na workshopu postavil organizaci podobnou té klientově.

## Prior Art
Research: hluboký (2026-11-10) — [`docs/feat-028-research.md`](../docs/feat-028-research.md), společný pro všechny inkrementy módu Organization.

—

## UI / Design
- **Týmy:**
  - název je editovatelné pole `Team name` (Enter nebo opuštění pole uloží; okolní mezery se ořežou, prázdný název se neuloží, shodné názvy jsou povolené),
  - `+ Add team` přidá rozbalený `Team N` bez lidí a bez mandátu,
  - × u týmu ho odebere po potvrzení `Remove Team Web? 4 people will be removed.`,
  - `Expand all` / `Collapse all`.
- **Lidé:**
  - `+ Add person` přidá člověka bez skillů,
  - nabídka `Person actions` (`⋯`) má `Move to <tým>` (člověk se přesune na konec týmu i se skilly) a `Remove person`,
  - `Add skill` nabídne chybějící skilly (`Has every skill`, když žádný nechybí), `Remove skill Java` skill odebere.
- **Kontrola před během** hlásí chybějící skilly jedné oblasti v jednom řádku: `No one with Frontend or QA can work in BIL`.
- Dlouhé názvy se zkracují výpustkou s plným názvem v `title` (jako feat-023).

## Specification by Example
Scénáře: B6–B11, B22, C3, C5, C7, C9, C10, D13, E6, J3, J4, J8.

**Příklad 1: Chybí skill v týmech s mandátem** *(C3, C10)*
- Given: ORG-T, Chen nemá QA; backlog `F-1 (p1): BIL [Frontend 2 · QA 2]`
- When: proběhne kontrola před během
- Then: jediné varování `No one with Frontend or QA can work in BIL`; Run je neaktivní

**Příklad 2: Přesunutý člověk bere práci podle nového týmu** *(B11, J8)*
- Given: ORG-T; Eli se před během přesune do Team Web; backlog jako v příkladu 4 feat-028
- When: běh do konce
- Then: Eli vezme F-2 Frontend 0.0–3.0; obě featury jsou hotové v 3.0

## Out of Scope
- AI na skillech (feat-035), vlastní skilly a oblasti (feat-036).

## Technical Notes
- `src/simulation/organizationSetup.ts`: `movePerson` a další čisté úpravy organizace.
- Výkon: 15 týmů × 6 lidí × 100 featur doběhne do 2 s strojového času (J3, práh se ověří v TDD); hledání práce indexovat podle skillu a oblasti.
- Z review inkrementu 1 (2026-11-12): `tickOrg` skončí jen při prázdném backlogu i rozpracovaných. Když úkol nemůže vzít nikdo (tým s mandátem nemá člověka se skillem), běh by se nikdy nezastavil. Kontrola chybějících skillů proto musí pokrýt každou dvojici oblast + skill z backlogu, případně engine doplní detekci zaseknutí.

## Open Questions
—
