# Feature: Min units po týmech (mód Organization, inkrement 5)

## Status
draft

*Inkrement 5 módu Organization (Týmy složené z lidí). Vznikl rozdělením feat-028 podle INVEST a SPIDR 2026-11-12. Závisí jen na inkrementu 1 ([feat-028](feat-028-tymy-slozene-z-lidi.md)). UI kontrakt je mockup [`docs/feat-028-ui-mockup.html`](../docs/feat-028-ui-mockup.html) (verze 9), scénáře jsou v [`docs/feat-028-test-analysis.md`](../docs/feat-028-test-analysis.md) a koncept testů v [`docs/feat-028-test-drafts/`](../docs/feat-028-test-drafts/README.md). Spec se dopracuje a schválí, až na inkrement přijde řada.*

## Problem
Inkrement 1 zná jen pravidlo Reduce WIP. Kouč nemůže ukázat organizaci, kde lidé zůstávají na práci svého týmu a vyhýbají se práci jiných týmů.

## User Story
Jako agilní kouč chci přepnout výběr práce na Min units, kde se lidé drží featur svého týmu, abych porovnal, jak pravidlo výběru práce mění tok celé organizace.

## Prior Art
Research: hluboký (2026-11-10) — [`docs/feat-028-research.md`](../docs/feat-028-research.md), společný pro všechny inkrementy módu Organization.

—

## UI / Design
- Settings → Backlog: přepínač `Work in progress` Reduce WIP / Min units s hintem:
  - Reduce WIP: `WIP: people finish in-progress features before pulling new ones.`
  - Min units: `WIP: people stay on features their team already knows and avoid features other teams are working on.`

## Pravidla
- **R10 Min units počítá týmy:** člověk dá přednost featuře, na které už pracoval někdo z jeho týmu, potom featuře, na které nepracoval nikdo z jiného týmu, a nakonec rozhoduje priorita. S jediným týmem vybírá stejně jako Reduce WIP.

## Specification by Example
Scénáře: B21, D8, D9, D15 a část F3.

**Příklad 1: Min units drží člověka u featury jeho týmu** *(D9)*
- Given: ORG-T, Team Mobile má mandáty MOB a WEB; backlog `F-1 (p1): WEB [Java 2 · QA 1]`, `F-2 (p2): MOB [Frontend 2 · QA 1]`
- When: běh do konce
- Then: Reduce WIP: Fae v 2.0 vezme F-1 QA, Total Time 4.0. Min units: Fae vezme F-2 QA (pracuje na ní Eli z jejího týmu) a Ivo F-1 QA, Total Time 3.0

## Out of Scope
- Koordinační režie (feat-016).

## Technical Notes
- Featura si vede historii týmů (`workedByTeams`); `tickOrg(state, dt, wipMode)` dostane režim `min-units`.

## Open Questions
—
