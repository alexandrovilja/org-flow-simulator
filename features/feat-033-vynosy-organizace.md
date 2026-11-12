# Feature: Výnosy (mód Organization, inkrement 6)

## Status
draft

*Inkrement 6 módu Organization (Týmy složené z lidí). Vznikl rozdělením feat-028 podle INVEST a SPIDR 2026-11-12. Závisí jen na inkrementu 1 ([feat-028](feat-028-tymy-slozene-z-lidi.md)). UI kontrakt je mockup [`docs/feat-028-ui-mockup.html`](../docs/feat-028-ui-mockup.html) (verze 9), scénáře jsou v [`docs/feat-028-test-analysis.md`](../docs/feat-028-test-analysis.md) a koncept testů v [`docs/feat-028-test-drafts/`](../docs/feat-028-test-drafts/README.md). Spec se dopracuje a schválí, až na inkrement přijde řada.*

## Problem
Inkrement 1 ukazuje jen tok práce. Kouč nemůže ukázat, kolik peněz organizace ztratí, když mandáty zdržují dodání.

## User Story
Jako agilní kouč chci u featur vidět výnos a porovnat výnos ve společném čase s předchozím během, abych změnu mandátů převedl do peněz.

## Prior Art
Research: hluboký (2026-11-10) — [`docs/feat-028-research.md`](../docs/feat-028-research.md), společný pro všechny inkrementy módu Organization.

—

## UI / Design
- Výnos za týden `€280/week` u položek backlogu, rozpracovaných featur a v detailu backlogu (`Priority 2 · €280/week · …`, když už je feat-029); hlavička backlogu `sorted by revenue`.
- Settings → Backlog: `Revenue profile` Flat / J-curve / S-curve s náhledem (feat-017).
- Dlaždice `Revenue (time-matched)` s hintem `live total` / `@ 1 week 4.0 days`, Details a srovnáním (feat-018).
- Done: `€280/week · 7.0 d`, vydělaná částka a odpočet do dalšího výnosu.

## Specification by Example
Scénáře: F4, F5 a výnosové části A2, F6, H5, H7, H8 a snapshotu v I3.

**Příklad 1: Výnos hotové featury** *(F4)*
- Given: ORG-B; backlog `F-1 (p1, €300/week): BIL [Java 1]`, `F-2 (p2, €200/week): BIL [Java 12]`
- When: běh do konce
- Then: F-1 připíše €300 v čase 6.0 a 11.0; po doběhnutí je Revenue `€600` a Details `Total €600 in 2 weeks 3.0 days`

## Out of Scope
- Koordinační režie a její dlaždice z Cash Flow.

## Technical Notes
- Výnosy přes `generateRevenueBatch`, `computeRevenueAsOf` a `computeRevenueComparison`; tik výnosu 5 pracovních dní (feat-027).

## Open Questions
—
