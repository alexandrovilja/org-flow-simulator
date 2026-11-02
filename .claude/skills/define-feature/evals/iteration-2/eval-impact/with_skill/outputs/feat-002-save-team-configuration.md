# Feature: Uložení konfigurace týmu

## Status
draft

## Problem
Agilní koučové opakovaně nastavují stejné týmové konfigurace (počet členů, velocity, kapacita) pro různé workshopy nebo klienty. Každé spuštění simulace vyžaduje ruční zadání všech hodnot znovu, což je časově náročné a náchylné k chybám.

## User Story
Jako agilní kouč chci uložit konfiguraci týmu pod vlastním názvem a později ji znovu načíst, abych nemusel opakovaně zadávat stejné hodnoty před každou simulací.

## UI / Design
- V panelu konfigurace týmu přibudou dvě tlačítka: "Uložit konfiguraci" a "Načíst konfiguraci"
- "Uložit konfiguraci" otevře dialog s textovým polem pro název (např. "Tým Alpha – Sprint 5")
- "Načíst konfiguraci" zobrazí dropdown nebo seznam uložených konfigurací
- Po načtení se všechna pole v konfiguračním panelu automaticky vyplní uloženými hodnotami
- Uložené konfigurace se persistují v localStorage prohlížeče

## Specification by Example

**Příklad 1: Uložení aktuální konfigurace**
- Given: Uživatel má vyplněnou konfiguraci týmu (5 členů, velocity 30, 2-týdenní sprinty)
- When: Klikne na "Uložit konfiguraci" a zadá název "Tým Alpha"
- Then: Konfigurace se uloží a zobrazí se v seznamu uložených konfigurací

**Příklad 2: Načtení dříve uložené konfigurace**
- Given: Existuje uložená konfigurace "Tým Alpha"
- When: Uživatel klikne na "Načíst konfiguraci" a vybere "Tým Alpha"
- Then: Všechna pole konfiguračního panelu se vyplní hodnotami z uložené konfigurace

**Příklad 3: Přepsání existující konfigurace**
- Given: Uložená konfigurace "Tým Alpha" existuje
- When: Uživatel upraví hodnoty a uloží pod stejným názvem "Tým Alpha"
- Then: Zobrazí se dotaz na potvrzení přepsání; po potvrzení se konfigurace aktualizuje

## Out of Scope
- Synchronizace konfigurací mezi zařízeními nebo uživateli
- Export/import konfigurací do souboru
- Správa verzí konfigurace (history)
- Sdílení konfigurací s jinými uživateli

## Technical Notes
- Data se ukládají do `localStorage` pod klíčem `ofs-team-configs`
- Dotčené soubory: `src/components/team-panel/`, nový `src/hooks/useTeamConfig.ts`
- Žádná závislost na backendu — čistě klientská feature
- **feat-003 (Porovnání dvou simulací):** Hook `useTeamConfig` musí podporovat použití ve více instancích současně (jedna pro každý panel porovnání). Nesmí být implementován jako singleton se sdíleným stavem — musí přijímat kontext nebo ID panelu jako parametr.

## Open Questions
- Má být počet uložených konfigurací nějak omezen?
- Mají se konfigurace nabídnout k načtení automaticky při startu aplikace?
- Jak se chová "Načíst konfiguraci" v porovnávacím režimu (feat-003) — aplikuje se konfigurace pouze na daný panel, nebo na oba?

## Related Features
- **feat-003-porovnani-dvou-simulaci** — porovnávací režim umožňuje načíst uloženou konfiguraci do každého panelu zvlášť; hook `useTeamConfig` musí být multi-instance safe
