# Feature: Color Picker Panel pro specializace

## Status
implemented

## Kontext
Navazuje na feat-007 (správa specializací). Stávající inline color picker zobrazuje
8 teček přímo v řádku tabulky — při více barvách je přeplněný a špatně klikatelný.

## Změna UX
Namísto stále viditelných teček: kliknutím na barevný indikátor (nebo na ikonu palety)
se otevře malý **floating panel** se všemi barvami. Kliknutím na barvu v panelu se
barva aplikuje a panel se zavře. Klik mimo panel (nebo Escape) panel zavře bez změny.

## UI — stávající role (editace barvy)
- V řádku každé specializace je místo 8 teček **jeden barevný čtverec/kruh** (aktuální barva)
  s malou ikonou tužky nebo šipky dolů
- Klik na něj otevře panel s barvami (absolutně pozicovaný pod/nad indikátorem)
- Panel: mřížka 4×2 barevných teček (velké, ~20 px), aktuálně vybraná je označena
- Klik na barvu → `onChange(roleId, { color })` + zavření panelu

## UI — formulář pro novou specializaci
- Namísto řady 8 teček: barevný čtverec (aktuálně vybraná barva nové role) s ikonou
- Klik → stejný floating panel s barvami
- Výběr barvy → uloží do lokálního stavu `newColor`, panel se zavře

## Technické poznámky
- Stav `openPickerId: string | null` v RoleSettings — ID role s otevřeným pickerem,
  `'__new__'` pro formulář nové role, `null` = zavřený
- `useEffect` s `mousedown` listenererem na `document` pro zavření při kliku mimo
- Panel je `position: absolute` — rodičovský `div` musí mít `position: relative`
- Barvy, počet a formát teček zůstávají stejné (COLOR_PRESETS beze změny)
- Žádné nové pure funkce → fáze TDD se přeskočí (čistě UI stav)

## Out of Scope
- Animace otevření panelu
- Vlastní barva přes HSL/hex input
- Více než 8 předvoleb
