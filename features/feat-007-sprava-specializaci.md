# Feature: Správa specializací — vytváření a mazání

## Status
implemented

## Problem
Kouč nemůže přizpůsobit sadu specializací reálnému týmu klienta. Aktuálních 6 rolí (FE, BE, DSGN, QA, OPS, DATA) je pevně zakódovaných — nelze přidat novou (např. „ML", „Security", „Scrum Master") ani odebrat ty, které klient nepoužívá. Při workshopu je přitom klíčové modelovat skutečnou strukturu týmu.

## User Story
Jako agilní kouč chci přidat vlastní specializaci nebo odebrat nepotřebnou, aby model týmu odpovídal reálné situaci klienta a simulace byla věrohodná.

## Scope

### Co je v rozsahu
- Vytvoření nové specializace: zadání názvu + výběr barvy ze sady předvoleb
- Smazání existující specializace (s vypořádáním závislostí)
- Změna barvy existující specializace ze stejné sady předvoleb
- UI integrováno do stávajícího panelu ⚙ Specializations

### Co není v rozsahu
- Import/export konfigurací specializací
- Vlastní oklch barva přes color picker (pouze sada ~10 předvoleb)
- Přejmenování role ID (label lze měnit v existujícím RoleSettings)
- Změna pořadí specializací (drag & drop)
- Změna barvy ovlivní pouze UI (chipy, bary) — běžící simulace se nijak nepřeruší

## Architektonické změny

### Role type
```ts
// Před:
export type Role = 'FE' | 'BE' | 'DSGN' | 'QA' | 'OPS' | 'DATA'

// Po:
export type Role = string
```

Všechna místa používající `Role` jako string budou kompatibilní. `Record<Role, RoleMeta>` → `Record<string, RoleMeta>`.

### Správa seznamu rolí
- `ROLES` přestane být globální konstanta; seznam aktivních rolí se stane součástí stavu Simulatoru.
- `roleConfig: Record<string, RoleMeta>` (existující state) zůstane jako zdroj pravdy pro metadata.
- Nová helper funkce `activeRoles(roleConfig): string[]` vrátí klíče roleConfig v konzistentním pořadí (vznik → nové na konec).

### Identifikátor nové role
- Generuje se při vytvoření jako `CUSTOM_<timestamp_ms>` — unikátní, stabilní, neměnný.
- Label (zobrazovaný název) je editovatelný odděleně (existující RoleSettings).

## UI / Design

### Panel ⚙ Specializations (rozšíření)

Aktuální stav: seznam existujících rolí s editací label, level, required.

Nový stav:

**Existující role** — každý řádek rozšíří o:
- Řadu barevných teček (sada 8 předvoleb) jako inline color picker — kliknutí okamžitě změní barvu role
- Aktuálně vybraná barva je vizuálně označena (outline nebo check)
- Tlačítko **🗑** (delete) — viditelné jen pokud existují ≥ 2 role
  - Kliknutí zobrazí inline potvrzení: „Delete [název]? Tasks requiring it will be removed. [Confirm] [Cancel]"

**Přidání nové role** — formulář pod seznamem:
- `[text input pro název] [●●●●●● výběr barvy] [Add]`
  - Barvy: 8 předvoleb v oklch (hue: 30, 75, 120, 180, 220, 260, 300, 340)
  - Výchozí vybraná barva: první nepoužitá z předvoleb
  - Validace: název nesmí být prázdný, nesmí být duplicitní label

## Chování při smazání specializace

Mazání je destruktivní — uživatel musí potvrdit. Po potvrzení:

1. **Tasky v backlogu** — feature, která má task s mazanou rolí, přijde o tento task. Pokud feature ztratí všechny tasky → feature se odstraní z backlogu.
2. **Tasky v inProgress** — stejná logika. Navíc pokud člen právě pracuje na tasku smazané role → task se uvolní (status = todo), člen dostane currentTask = null. Pak platí bod 1 (feature bez tasků se odstraní).
3. **Členové týmu** — role se odebere z `member.roles` všem členům, kteří ji mají.
4. **roleConfig** — klíč se odstraní.

Výsledek: simulace zůstane konzistentní, žádné osiřelé reference.

## Specification by Example

**Příklad 0: Změna barvy existující specializace**
- Given: FE má barvu hue 250 (modrá)
- When: kouč klikne na tečku hue 30 (oranžová) v řádku FE
- Then: roleConfig['FE'].color = `oklch(70% 0.14 30)`, chipy a bary se okamžitě překreslí
- Then: simulace běží bez přerušení

**Příklad 1: Přidání nové specializace**
- Given: roleConfig má role FE, BE, DSGN, QA, OPS, DATA
- When: kouč zadá název „ML Engineer", vybere barvu (hue 220), klikne Add
- Then: roleConfig dostane klíč `CUSTOM_<ts>` s label „ML Engineer", color `oklch(70% 0.14 220)`, level 1, required false
- Then: role se zobrazí v RoleSettings i v pickerech MemberCard

**Příklad 2: Smazání specializace s tasky v backlogu**
- Given: backlog obsahuje F-001 se 3 tasky (FE, BE, QA); role QA se maže
- When: kouč potvrdí smazání QA
- Then: F-001 má 2 tasky (FE, BE); F-001 zůstane v backlogu
- Then: feature, která měla jediný task QA, zmizí z backlogu

**Příklad 3: Smazání specializace s aktivní prací**
- Given: člen Ada pracuje na QA tasku feature F-003 (inProgress)
- When: QA se smaže
- Then: Ada.currentTask = null, F-003 ztratí QA task
- Then: pokud F-003 stále má jiné tasky → zůstane v inProgress; pokud ne → odstraní se z inProgress

**Příklad 4: Nelze smazat poslední specializaci**
- Given: roleConfig má jedinou roli
- Then: tlačítko 🗑 není viditelné

## Technical Notes
- `Role = string` je breaking change pro všechna `Record<Role, ...>` — nutno projít typecheckem
- `ROLES` konstanta v engine.ts přestane být autoritativní; nahradí ji `Object.keys(roleConfig)`
- Engine funkce `makeBacklog`, `makeInitialState`, `regenerate` přijímají `roleConfig` jako parametr — přidání/odebrání role se projeví při příštím `regenerate`, ne za běhu
- Mazání za běhu (inProgress) mutuje SimState přímo, stejně jako handleRemoveRole
- Minimální počet rolí: 1 (tlačítko 🗑 se skryje při count ≤ 1)
- Nová komponenta `RoleEditor` nebo rozšíření `RoleSettings` — rozhodne se v implementaci

## Open Questions
— Má se barva nové role nabízet jako oklch předvolba, nebo lze zadat libovolný hue číslem? MVP = předvolby.
