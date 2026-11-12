# Feature: AI na skillech lidí (mód Organization, inkrement 8)

## Status
draft

*Inkrement 8 módu Organization (Týmy složené z lidí). Vznikl rozdělením feat-028 podle INVEST a SPIDR 2026-11-12. Závisí jen na inkrementu 1 ([feat-028](feat-028-tymy-slozene-z-lidi.md)). UI kontrakt je mockup [`docs/feat-028-ui-mockup.html`](../docs/feat-028-ui-mockup.html) (verze 9), scénáře jsou v [`docs/feat-028-test-analysis.md`](../docs/feat-028-test-analysis.md) a koncept testů v [`docs/feat-028-test-drafts/`](../docs/feat-028-test-drafts/README.md). Spec se dopracuje a schválí, až na inkrement přijde řada.*

## Problem
Kouč nemůže v organizaci ukázat, co udělá AI nástroj u konkrétního skillu konkrétního člověka, i když to jde v Advanced a Cash Flow (feat-019).

## User Story
Jako agilní kouč chci u skillu člověka zapnout AI 2× nebo 5×, abych ukázal, jestli zrychlení jednotlivců pomůže toku organizace, když práci brzdí mandáty.

## Prior Art
Research: hluboký (2026-11-10) — [`docs/feat-028-research.md`](../docs/feat-028-research.md), společný pro všechny inkrementy módu Organization.

—

## UI / Design
- Čip skillu na kartě člověka má tlačítko AI jako feat-019: klik cyklí 1× → 2× → 5× → 1×, odznak `⚡2×`, tooltip `AI speed-up for Java: 2× – click for 5×`.
- Řádek týmu ukazuje souhrn `⚡1` (title `1 person with AI`).
- AI se nastavuje jen před během; při přesunu člověka (feat-030) se přenáší.

## Specification by Example
Scénáře: B12, B13, D12, G4 (část G4 s timeline, až bude feat-034).

**Příklad 1: AI zrychlí práci na skillu** *(D12)*
- Given: ORG-T; backlog `F-1 (p1): BIL [Java 3]`
- When: běh do konce s AI u Bena na Java
- Then: s 2× je F-1 hotová v 1.5, s 5× v 0.6

## Out of Scope
- AI pro celý tým nebo pro skill napříč lidmi.

## Technical Notes
- `aiBySkill` u člověka (jako `Member` ve feat-019); engine násobí postup práce.

## Open Questions
—
