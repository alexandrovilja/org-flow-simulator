# Feature: Timeline hotové featury (mód Organization, inkrement 7)

## Status
draft

*Inkrement 7 módu Organization (Týmy složené z lidí). Vznikl rozdělením feat-028 podle INVEST a SPIDR 2026-11-12. Závisí jen na inkrementu 1 ([feat-028](feat-028-tymy-slozene-z-lidi.md)). UI kontrakt je mockup [`docs/feat-028-ui-mockup.html`](../docs/feat-028-ui-mockup.html) (verze 9), scénáře jsou v [`docs/feat-028-test-analysis.md`](../docs/feat-028-test-analysis.md) a koncept testů v [`docs/feat-028-test-drafts/`](../docs/feat-028-test-drafts/README.md). Spec se dopracuje a schválí, až na inkrement přijde řada.*

## Problem
Kouč vidí cycle time hotové featury, ale ne, kde čas strávila: kolik práce a kolik čekání, ve kterých oblastech a které týmy na ní pracovaly.

## User Story
Jako agilní kouč chci u hotové featury rozkliknout průběh zpracování v čase po oblastech a týmech, abych ukázal, kde featura čekala a kolik týmů se na ní podílelo.

## Prior Art
Research: hluboký (2026-11-10) — [`docs/feat-028-research.md`](../docs/feat-028-research.md), společný pro všechny inkrementy módu Organization.

—

## UI / Design
- Klik na hotovou featuru v Done otevře a zavře její timeline (každá sama):
  - hlavička `Started day 0.0 · done day 7.0 · cycle time 7.0 d`,
  - nadpis oblasti `BIL done by Team Billing` (víc týmů v pořadí prvního začátku práce, shoda → pořadí v panelu),
  - řádek pro každý úkol: úseky práce s iniciálou a tooltipem `Java · Ben, Team Billing · day 2.0–5.0`, čekání šrafovaně s tooltipem `QA · waiting 5.0 d`,
  - osa `d0.0 … d7.0`, součty `Task time: work 11.0 d · waiting 10.0 d`, `Teams: Team Billing → Team Mobile`, legenda.

## Specification by Example
Scénáře: G1–G3, G5, G6, J7.

**Příklad 1: Záznam zpracování** *(G1)*
- Given: ORG-T; backlog `F-1 (p1): BIL [Product 2 · Java 3 · QA 2] | MOB [Frontend 3 · QA 1]`, F-1 hotová
- When: kouč klikne na F-1 v Done
- Then: `BIL done by Team Billing` a `MOB done by Team Mobile`; součty `work 11.0 d · waiting 10.0 d`

## Out of Scope
- Timeline rozpracovaných featur.

## Technical Notes
- Engine: `featureTimeline(feature, setup)` z úseků práce, které úkoly vedou od inkrementu 1.

## Open Questions
—
