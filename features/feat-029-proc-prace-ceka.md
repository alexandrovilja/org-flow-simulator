# Feature: Proč práce čeká (mód Organization, inkrement 2)

## Status
draft

*Inkrement 2 módu Organization (Týmy složené z lidí). Vznikl rozdělením feat-028 podle INVEST a SPIDR 2026-11-12. Závisí jen na inkrementu 1 ([feat-028](feat-028-tymy-slozene-z-lidi.md)). UI kontrakt je mockup [`docs/feat-028-ui-mockup.html`](../docs/feat-028-ui-mockup.html) (verze 9), scénáře jsou v [`docs/feat-028-test-analysis.md`](../docs/feat-028-test-analysis.md) a koncept testů v [`docs/feat-028-test-drafts/`](../docs/feat-028-test-drafts/README.md). Spec se dopracuje a schválí, až na inkrement přijde řada.*

## Problem
Po inkrementu 1 kouč vidí, že se po změně mandátů změnil cycle time, ale ne proč. Neukáže, který úkol stojí, protože ho nikdo s mandátem nemůže vzít, ani kdo je nečinný, přestože práci umí. Management tak vidí jen čísla, ne příčinu.

## User Story
Jako agilní kouč chci vidět, které úkoly čekají na člověka s mandátem a kdo je nečinný, protože jeho práce leží mimo mandát jeho týmu, abych managementu ukázal příčinu delšího cycle time.

## Prior Art
Research: hluboký (2026-11-10) — [`docs/feat-028-research.md`](../docs/feat-028-research.md), společný pro všechny inkrementy módu Organization.

—

## UI / Design
- **In progress:**
  - kliknutím se řádek featury rozbalí na úkoly po oblastech (hotový `✓`, rozpracovaný s iniciálou a výplní, to do, Waiting šrafovaně s tooltipem `Frontend · waiting · 1 idle person with this skill in Team Mobile`),
  - oblast s čekajícím úkolem má žlutý štítek a featura poznámku `Waiting · WEB`,
  - nad seznamem filtr `1 waiting`, jen když něco čeká.
- **Organization za běhu:**
  - štítky featur, na kterých tým pracuje (`F-001`, `F-002 ×2`); klik vypne filtr, rozbalí a zvýrazní featuru a posune ji do viditelné části,
  - pruh lidí rozlišuje pracující, žlutý idle (šrafa) a obyčejný idle; text `1 idle` šedě nebo v barvě čekání,
  - rozbalený tým ukáže lidi s úkolem `F-001 · BIL · QA` a pruhem postupu, nebo `Idle` (šedě, nebo žlutě s tooltipem `Idle while work for their skills waits in Web portal`),
  - hlavička ukazuje počet idle lidí; tým bez lidí `0/0` a `—`.
- **Metrics:** dlaždice `Idle Time` (`3.0 days`, hint `person-days without a task`) se srovnáním s předchozím během.
- **Backlog:** kliknutím se položka rozbalí: `Priority 2 · 3 tasks · 8 days of work`, po oblastech čipy úkolů `Product · 2 d` a `Mandate: Team Billing`, nebo červeně `No team has a mandate for this area`. Výnos do řádku přibude s feat-033.

## Pravidla
- **R1 Idle Time:** roste člověku bez úkolu, dokud existuje nepřidělený úkol s jeho skillem kdekoli, bez ohledu na fázi a mandát.
- **R2 Waiting a žlutý idle:** Waiting má úkol rozpracované featury s odemčenou fází, pro který existuje idle člověk se skillem, jehož tým nemá mandát na oblast úkolu. Žlutý idle má idle člověk, pro jehož skill čeká odemčená práce v oblasti mimo mandát jeho týmu (v backlogu i v rozpracovaných featurách). Úkol čekající jen na nižší fázi je obyčejné „to do“.

## Specification by Example
Scénáře: B5, E1–E5, H1–H4, H6, H7, J1 a části D2, D3, D5, D10, D11 o Idle Time; delta Idle Time v F6–F9.

**Příklad 1: Waiting a žlutý idle** *(E1)*
- Given: ORG-T; backlog `F-1 (p1): BIL [Java 1] | WEB [Frontend 3]`, `F-2 (p2): BIL [Java 1] | WEB [Frontend 3]`, čas 1.5
- When: kouč se podívá na obrazovku
- Then: Frontend ve F-2 je Waiting, Eli má žlutý `Idle`, filtr ukazuje `1 waiting`, Idle Time `2.5 days`; v čase 4.0 nic nečeká a Idle Time je `4.0 days`

**Příklad 2: Výpočet Idle Time** *(E3)*
- Given: ORG-T; backlog `F-1 (p1): BIL [Product 2 · Java 3 · QA 2] | MOB [Frontend 3 · QA 1]`
- When: běh do konce
- Then: Idle Time 18.0 (Ben 2, Gus 2, Chen 5, Fae 4, Ivo 5)

## Out of Scope
- Úpravy týmů a lidí (feat-030), výnosy v detailu backlogu (feat-033), timeline hotové featury (feat-034).

## Technical Notes
- Engine: `state.idleByPerson`, `orgMetrics(state).idleTime`, `orgTaskStatus` (done / doing / todo / waiting) a `orgPersonStatus` (working / idle / blocked s oblastmi). Waiting a žlutý idle se počítají, neukládají.
- Snapshot předchozího běhu dostane Idle Time.

## Open Questions
—
