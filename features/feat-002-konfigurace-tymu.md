# Feature: Konfigurace týmu

## Status
implemented

## Problem
Agilní koučové chtějí klientům ukázat, jak složení týmu (počet lidí, jejich specializace) ovlivní průtok a lead time. Bez možnosti měnit tým za běhu by museli simulaci restartovat a ručně přepisovat kód — to není použitelné ve workshopu.

## User Story
Jako agilní kouč chci přidávat a odebírat členy týmu a měnit jejich specializace, abych klientům živě demonstroval dopad týmové struktury na průtok a lead time.

## UI / Design
- Tým je zobrazen ve středovém panelu (nadpis **"Units"**) jako grid **MemberCard** komponent
- Každá karta zobrazuje:
  - Avatar s iniciálou + **editovatelný název** (inline input, uloží při Enter nebo blur) + tlačítko **×** pro odebrání celé jednotky
  - **Role chips** se specializacemi člena (zobrazuje plný název, např. „Frontend") a tlačítkem × pro odebrání role
  - Tlačítko **"+"** na kartě — otevře inline picker dostupných specializací; výběrem se přidá role k dané jednotce
  - Aktuální úkol (feature + specializace + progress bar 0–100 %), nebo status "idle" / "no roles"
- Tlačítko **"+ Add unit"** pod gridem — přidá novou jednotku bez rolí; jméno se vybere automaticky ze seznamu (Ada, Ben, …)
- Odebrání role (×) okamžitě přeruší úkol, pokud člen na dané roli pracoval
- Odebrání celé jednotky (×) okamžitě vrátí aktivní úkol do stavu `todo` a jednotku odebere z týmu

**Dostupné specializace (výchozí sada, konfigurovatelná viz feat-005):**
| Kód | Výchozí název | Barva |
|-----|---------------|-------|
| FE | Frontend | modrá |
| BE | Backend | fialová |
| DSGN | Design | oranžová |
| QA | QA | zelená |
| OPS | DevOps | žlutá |
| DATA | Data | růžová |

## Specification by Example

**Příklad 1: Přidání nové jednotky**
- Given: Simulace běží s týmem 3 členů
- When: Kouč klikne na "+ Add unit"
- Then: Do týmu se přidá nová jednotka bez rolí; kouč může kliknout na "+" na kartě a přidat specializaci; při nejbližší příležitosti jednotka přebere odpovídající úkol

**Příklad 2: Odebrání specializace**
- Given: Člen týmu má role FE a BE, právě pracuje na BE úkolu
- When: Kouč klikne na × u role BE
- Then: Role BE se odebere; člen přestane pracovat na aktuálním úkolu; úkol se uvolní pro jiného BE specialistu (nebo zůstane čekat)

**Příklad 3: Člen bez rolí**
- Given: Všechny role člena byly odebrány
- When: Simulace běží
- Then: Karta člena zobrazuje status "no roles"; člen nepřebírá žádné úkoly

## Out of Scope
- Nastavení capacity nebo WIP limitu pro jednotlivce
- Přiřazení úkolu ručně (assignment je automatický)
- Perzistence týmové konfigurace (localStorage nebo server)

## Technical Notes
- Komponenta: `src/components/MemberCard.tsx` (`'use client'`)
- Typy: `Member`, `Role`, `RoleMeta` v `src/types/simulation.ts`
- Výchozí konfigurace specializací: `ROLES`, `ROLE_META` v `src/simulation/engine.ts`
- Uživatelská konfigurace specializací (název, level, required): `roleConfig` state v `Simulator.tsx`, předáváno do `tick()` a `makeInitialState()` — viz feat-005
- Přiřazování úkolů: logika v `tick()` — člen dostane úkol z nejvíce prioritní feature, na které může pracovat; respektuje `level` specializace (nižší číslo = dřívější fáze; úkol level N čeká na dokončení všech level < N ve stejné feature)
- Idle čas: každý člen s rolemi bez přiřazeného úkolu akumuluje `idleSec` — zobrazeno jako metrika „Total Wait" (viz feat-004)

## Open Questions
—
