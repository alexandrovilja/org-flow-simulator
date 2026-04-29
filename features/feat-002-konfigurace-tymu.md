# Feature: Konfigurace týmu

## Status
implemented

## Problem
Agilní koučové chtějí klientům ukázat, jak složení týmu (počet lidí, jejich specializace) ovlivní průtok a lead time. Bez možnosti měnit tým za běhu by museli simulaci restartovat a ručně přepisovat kód — to není použitelné ve workshopu.

## User Story
Jako agilní kouč chci přidávat a odebírat členy týmu a měnit jejich specializace, abych klientům živě demonstroval dopad týmové struktury na průtok a lead time.

## UI / Design
- Tým je zobrazen ve středovém panelu jako seznam **MemberCard** komponent
- Každá karta zobrazuje:
  - Avatar s iniciálou a jménem
  - **Role chips** se specializacemi člena a tlačítkem × pro odebrání
  - Aktuální úkol (feature + role + progress bar 0–100 %), nebo status "idle" / "no roles"
- Tlačítko **"+"** pod seznamem otevře dropdown s dostupnými specializacemi — kliknutím se přidá nový člen s danou specializací
- Odebrání role (×) okamžitě přeruší úkol, pokud člen na dané roli pracoval

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

**Příklad 1: Přidání člena týmu**
- Given: Simulace běží s týmem 3 členů
- When: Kouč klikne na "+" a vybere roli "BE"
- Then: Do týmu se přidá nový člen se specializací BE; při nejbližší příležitosti přebere úkol BE z rozběhnuté nebo backlogové feature

**Příklad 2: Odebrání specializace**
- Given: Člen týmu má role FE a BE, právě pracuje na BE úkolu
- When: Kouč klikne na × u role BE
- Then: Role BE se odebere; člen přestane pracovat na aktuálním úkolu; úkol se uvolní pro jiného BE specialistu (nebo zůstane čekat)

**Příklad 3: Člen bez rolí**
- Given: Všechny role člena byly odebrány
- When: Simulace běží
- Then: Karta člena zobrazuje status "no roles"; člen nepřebírá žádné úkoly

## Out of Scope
- Pojmenování členů týmu (jména jsou generována automaticky)
- Nastavení capacity nebo WIP limitu pro jednotlivce
- Odebrání celého člena (pouze role lze odebrat)
- Přiřazení úkolu ručně (assignment je automatický)

## Technical Notes
- Komponenta: `src/components/MemberCard.tsx` (`'use client'`)
- Typy: `Member`, `Role`, `RoleMeta` v `src/types/simulation.ts`
- Výchozí konfigurace specializací: `ROLES`, `ROLE_META` v `src/simulation/engine.ts`
- Uživatelská konfigurace specializací (název, level, required): `roleConfig` state v `Simulator.tsx`, předáváno do `tick()` a `makeInitialState()` — viz feat-005
- Přiřazování úkolů: logika v `tick()` — člen dostane úkol z nejvíce prioritní feature, na které může pracovat; respektuje `level` specializace (vyšší level musí být hotov dříve)

## Open Questions
—
