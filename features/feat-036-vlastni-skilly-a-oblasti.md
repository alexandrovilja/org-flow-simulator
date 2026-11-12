# Feature: Vlastní skilly a oblasti (mód Organization, inkrement 9)

## Status
draft

*Inkrement 9 módu Organization (Týmy složené z lidí). Vznikl rozdělením feat-028 podle INVEST a SPIDR 2026-11-12. Závisí jen na inkrementu 1 ([feat-028](feat-028-tymy-slozene-z-lidi.md)). UI kontrakt je mockup [`docs/feat-028-ui-mockup.html`](../docs/feat-028-ui-mockup.html) (verze 9), scénáře jsou v [`docs/feat-028-test-analysis.md`](../docs/feat-028-test-analysis.md) a koncept testů v [`docs/feat-028-test-drafts/`](../docs/feat-028-test-drafts/README.md). Spec se dopracuje a schválí, až na inkrement přijde řada.*

## Problem
Výchozí skilly (Product, Java, Frontend, QA) a oblasti (BIL, MOB, WEB) nesedí na každou organizaci. Kouč je nemůže přejmenovat, přidat ani nastavit pořadí fází a povinné skilly.

## User Story
Jako agilní kouč chci upravit seznam skillů a oblastí, jejich fáze a povinné skilly, abych simulaci přizpůsobil produktům a systémům klienta.

## Prior Art
Research: hluboký (2026-11-10) — [`docs/feat-028-research.md`](../docs/feat-028-research.md), společný pro všechny inkrementy módu Organization.

—

## UI / Design
- Settings → **Skills**: sdílený editor z Advanced (feat-005):
  - barva, název, fáze `−`/`+` v rozsahu **1–10 ve všech módech** (dnes 1–5), `Req.`,
  - potvrzení smazání `Delete QA? 3 people lose it and tasks requiring it will be removed.`; poslední skill nejde smazat.
- Settings → **Areas**: kód 2–3 písmena a název, přejmenování, smazání s potvrzením `Delete Web portal? 1 team loses the mandate and tasks in this area will be removed.`; chyby `Code must be 2–3 letters.`, `BIL already exists.`, `Enter a name.`; poslední oblast nejde smazat.
- Smazání skillu nebo oblasti odebere úkoly z backlogu; featura bez úkolů zmizí.
- Za běhu jsou editory zamčené (`Skills are locked during the run. Reset to change them.`).
- Posuvníky z feat-031 (je-li hotový) stáhnou meze podle počtu oblastí a skillů.

## Specification by Example
Scénáře: B14–B20, B15b, C4, C6, C8, J5, J6, A3, A10 a editory v I1.

**Příklad 1: Smazání oblasti** *(B19, J5)*
- Given: backlog `F-1: BIL [Java 2] | WEB [QA 1]`, `F-2: WEB [Frontend 3]`
- When: kouč smaže oblast WEB a potvrdí
- Then: F-1 má jen `BIL [Java 2]`, F-2 z backlogu zmizí, Team Web má `No mandate`

**Příklad 2: Req. má přednost před horní mezí** *(A10)*
- Given: Req. u Product a QA, Areas per feature 1–1, Skills per area 1–1
- When: vygeneruje se backlog
- Then: každá featura má jednu oblast právě s úkoly Product a QA

## Out of Scope
- Hierarchie skillů a oblastí.

## Technical Notes
- `MAX_LEVEL` v `RoleSettings` 5 → 10 ve všech módech (mění chování feat-005).
- `organizationSetup.ts`: `deleteOrgSkill`, `deleteOrgArea`; engine `pruneOrgBacklog`.

## Open Questions
—
