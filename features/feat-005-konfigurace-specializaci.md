# Feature: Konfigurace specializací

## Status
implemented

## Problem
Fixní sada rolí (FE, BE, DSGN, QA, OPS, DATA) neumožňuje simulovat reálné týmy, kde mají role jiné názvy, jiné pořadí fází (např. Design musí vždy předcházet vývoji) nebo kde jsou některé role povinné v každé položce backlogu (např. QA). Bez konfigurace specializací kouč nemůže přizpůsobit simulaci konkrétnímu klientskému kontextu.

## User Story
Jako agilní kouč chci nastavit název, pořadí fáze (level) a povinnost každé specializace, abych přizpůsobil simulaci reálnému procesu klienta a ukázal dopad procesních pravidel na lead time.

## UI / Design
- V sekci Controls (levý spodní panel) je tlačítko **"⚙ Specializations"**
  - Výchozí stav: panel skrytý
  - Kliknutí na tlačítko přepne zobrazení panelu (toggle)
  - Když je panel otevřen, tlačítko je vizuálně aktivní (odlišný styl)
- Panel **Specializations** se zobrazí pod tlačítkem:
  - Pro každou specializaci jeden řádek se čtyřmi prvky:
    - **Barevný bod** — vizuální identifikátor (fixní, není editovatelný)
    - **Name** — textový input; výchozí hodnoty: Frontend, Backend, Design, QA, DevOps, Data
    - **Phase** — stepper s tlačítky `−` a `+` (rozsah 1–5); zobrazuje aktuální číslo
    - **Req.** — checkbox; pokud zaškrtnuto, každá feature musí obsahovat právě jeden úkol dané specializace
  - Pod tabulkou nápověda: `Phase: 1 = first phase, 2 = second, … Same phase = parallel. Req.: always in every backlog item (takes effect on regenerate).`

## Specification by Example

**Příklad 1: Nastavení fázového procesu (Design → Dev → QA)**
- Given: Design má level 1, FE a BE mají level 2, QA má level 3
- When: Simulace běží
- Then: V rámci každé feature začnou Design úkoly jako první; FE a BE úkoly mohou začít až po dokončení Design; QA začne až po dokončení všech FE a BE úkolů

**Příklad 2: Paralelní zpracování na stejné úrovni**
- Given: FE a BE mají oba level 2, QA má level 3
- When: Jsou dostupní FE i BE specialisté a Design (level 1) je dokončen
- Then: FE a BE pracují na stejné feature paralelně; QA čeká

**Příklad 3: Povinná specializace**
- Given: QA je označena jako Req. (required)
- When: Kouč klikne na "Generate new backlog"
- Then: Každá feature v novém backlogu obsahuje právě jeden QA úkol; existující backlog se nemění

**Příklad 4: Přejmenování specializace**
- Given: Kouč zadá do name pole pro FE text "iOS"
- When: Simulace běží
- Then: Chips, MemberCard a veškerý UI zobrazuje "iOS" místo "Frontend"; vnitřní ID role (FE) zůstává nezměněno

**Příklad 5: Level se projeví okamžitě**
- Given: Simulace běží, všechny role mají level 1
- When: Kouč změní QA na level 2
- Then: Nové přiřazování úkolů od příštího ticku respektuje nové pořadí; již rozdělané úkoly dokončí

## Out of Scope
- Přidávání nových typů specializací (počet rolí je fixní na 6)
- Konfigurace barvy specializace
- Různé level pro různé features (level je globální nastavení)
- Uložení konfigurace specializací do localStorage
- Import/export konfigurace

## Technical Notes
- Komponenta: `src/components/RoleSettings.tsx`
- Stav: `roleConfig: Record<Role, RoleMeta>` v `Simulator.tsx`; výchozí hodnota = kopie `ROLE_META` z enginu; aktualizuje se přes `handleRoleChange(roleId, updates)`
- Ref pro RAF smyčku: `roleConfigRef` — synchronizován s `roleConfig` state přes `useEffect`; předáván do `tick()` a `regenerate()` bez restartu RAF efektu
- Typ `RoleMeta` v `src/types/simulation.ts`: `{ label, color, level, required }`
- Sémantika level: **nižší číslo = dřívější fáze**. Level 1 = první fáze (začíná jako první). Úkol level N může začít až poté, co jsou hotové všechny úkoly s level < N ve stejné feature. Úkoly na stejném levelu mohou probíhat paralelně.
- Engine `tick()`: před přiřazením úkolu kontroluje `isAvailable(task, feature)` — ověřuje, zda jsou všechny úkoly nižší úrovně (level < task.level) v téže feature ve stavu `done`
- Engine `makeFeature()`: povinné role (required) dostanou vždy právě 1 úkol; extra úkoly (z `sizeVar`) se rozdělují pouze mezi volitelné role. Volitelné role se přidávají náhodně dle `roleVar`; projeví se jen při generování nového backlogu (`regenerate()`) nebo inicializaci (`makeInitialState()`)
- `makeFeature()` při generování seřadí tasky podle `roleConfig[role].level` vzestupně — fáze 1 první. `FeatureCard` zobrazuje tasky v pořadí, v jakém jsou uloženy na `feature.tasks`; nepotřebuje `roleConfig` jako prop.
- Dotčené funkce: `tick(state, dtSim, settings, rng, roleConfig)`, `makeInitialState(rng, settings, roleConfig)`, `regenerate(settings, roleConfig)` — všechny přijímají `roleConfig` jako volitelný parametr s výchozí hodnotou `ROLE_META`

## Open Questions
—
