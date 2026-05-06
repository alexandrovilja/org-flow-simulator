# feat-012 — XLS Import do Advanced módu

## Stav
`spec-approved`

## Kontext a motivace
Koučové chtějí importovat reálná data z Jira (nebo jiného nástroje) a simulovat průběh na různých organizačních strukturách. Bez importu musí konfiguraci backlogu zadávat ručně, což je na workshopu pomalé a chybové.

## Uživatelský příběh
> Jako kouč chci nahrát Excel exportovaný z Jiry, aby simulátor okamžitě ukázal, jak by vypadal průběh na různých org strukturách — bez manuálního zadávání.

## Formát vstupního souboru

### Podporované formáty
- `.xlsx` (Office Open XML, Excel 2007+)
- `.xls` (BIFF8, Excel 97–2003)

### Struktura tabulky
Každý řádek = jeden task (úkol) uvnitř feature. Feature s více tasky má více řádků.

| Sloupec | Povinný | Popis | Příklad |
|---------|---------|-------|---------|
| `Feature` | ano | Název feature / uživatelského příběhu. Řádky se stejným názvem tvoří jednu feature. | `Login flow` |
| `Specializace` | ano | Role potřebná pro tento task. Mapuje se na existující nebo novou roli v simulátoru. | `FE`, `Backend`, `QA` |
| `Tym` | ano | Organizační jednotka zodpovědná za tento task. Každá unikátní hodnota = jedna jednotka (`Member`) v simulátoru. | `Squad A`, `Platform`, `Team 1` |
| `Velikost` | ano | Odhad pracnosti (story points nebo hodiny). Celé nebo desetinné číslo > 0. Mapuje se na `task.work`. | `3`, `8`, `0.5` |

**Poznámky k parsování:**
- Záhlaví sloupců jsou case-insensitive a trimovány (` Feature `, `FEATURE`, `feature` jsou ekvivalentní).
- Pořadí sloupců je libovolné.
- Prázdné řádky jsou ignorovány.
- Pokud soubor obsahuje více listů (sheets), použije se první list.
- **Duplicitní řádky:** pokud se stejná kombinace `Feature + Specializace + Tym` vyskytne vícekrát, zachová se pouze první výskyt — ostatní se přeskočí (tiše, bez varování).

### Mapování hodnot

#### `Specializace` → `Role`
- Hodnota se trimuje a převede na uppercase: `"  frontend  "` → `"FRONTEND"`.
- Pokud Role s tímto klíčem v `roleConfig` neexistuje, vytvoří se nová s výchozí barvou a `level: 1`.
- Pokud existuje (přesná shoda klíče), použije se stávající konfigurace.

#### `Tym` → `Member`
- `Tym` reprezentuje organizační jednotku (squad, tým, útvar) — ne konkrétního člověka.
- Každá unikátní hodnota v sloupci `Tym` (trimovaná, case-sensitive) = jedna jednotka = jeden `Member` v simulátoru.
- Jednotka dostane jako `roles` všechny unikátní specializace, které se pro ni vyskytují v datech.
- Příklad: `Squad A` s řádky `Specializace = FE` a `Specializace = BE` → `{ name: "Squad A", roles: ["FE", "BE"] }`.
- Stávající tým v simulátoru se **celý nahradí** importovanými jednotkami.

#### `Velikost` → `task.work`
- Mapování 1:1 — `Velikost = 3` → `task.work = 3` sim-sekundy.
- Desetinná čísla jsou povolena; záporné hodnoty nebo 0 jsou chybou.
- Maximální hodnota: 999 (ochrana před neúmyslně velkými hodnotami).

### Příklad souboru

| Feature | Specializace | Tym | Velikost |
|---------|-------------|-----|---------|
| Login flow | FE | Squad A | 3 |
| Login flow | BE | Squad A | 5 |
| Login flow | QA | Squad B | 2 |
| Dashboard | FE | Squad A | 4 |
| Dashboard | BE | Squad B | 6 |
| Dashboard | QA | Squad B | 2 |
| Payment gateway | BE | Squad A | 8 |
| Payment gateway | QA | Squad B | 3 |

Výsledek: 3 features v backlogu, 2 členové týmu (`Squad A`: FE+BE, `Squad B`: QA+BE), 3 role (FE, BE, QA).

## Chování po importu

1. **Replace all:** celý stav experiment módu se resetuje — backlog, tým, roleConfig, settings.
2. Simulace je **inicializována ale nespuštěna** (stejný stav jako po kliknutí Reset).
3. Aplikace přepne na **Advanced mód** (pokud není aktivní).
4. Uživatel vidí potvrzovací zprávu: `"Importováno: X features, Y tasků, Z členů týmu."` (transientní toast, 4 s).

## Šablona ke stažení

- Tlačítko **"Stáhnout šablonu"** vedle tlačítka pro upload.
- Generuje prázdný `.xlsx` soubor se záhlavím a 3 příkladovými řádky (barevně odlišené jako vzor).
- Šablona se generuje čistě na klientu (bez serveru) — pomocí stejné knihovny jako import.

## Validace a chybové stavy

| Stav | Chování |
|------|---------|
| Soubor není `.xlsx` ani `.xls` | Chybová hláška pod inputem: `"Nepodporovaný formát. Nahrajte .xlsx nebo .xls soubor."` |
| Chybí povinný sloupec | `"Soubor neobsahuje sloupec 'Feature'. Zkontrolujte záhlaví."` |
| Prázdný soubor / žádná data | `"Soubor neobsahuje žádná data."` |
| Velikost není číslo | Řádek se přeskočí; po importu: `"X řádků bylo přeskočeno (neplatná Velikost)."` |
| Velikost ≤ 0 nebo > 999 | Řádek se přeskočí; stejná hláška jako výše. |
| Více než 50 unikátních Tym hodnot | Import se zastaví: `"Příliš mnoho členů týmu (max. 50)."` |
| Více než 200 unikátních Feature hodnot | Import se zastaví: `"Příliš velký backlog (max. 200 features)."` |

Všechny chybové a varovné zprávy se zobrazí pod import tlačítkem (inline, ne jako overlay).

## UI návrh

```
Advanced mód — levý panel (Team & Settings):

[ Importovat z XLS ▲ ]  [ Stáhnout šablonu ↓ ]

Po výběru souboru:
  ✓ Importováno: 8 features, 18 tasků, 2 členové týmu.

nebo při chybě:
  ✗ Soubor neobsahuje sloupec 'Specializace'. Zkontrolujte záhlaví.
```

- Input pro soubor je skrytý (`display: none`), trigger je styled button.
- Tlačítka jsou vedle sebe, vizuálně odlišeny (import = primární, šablona = ghost).

## Technická implementace

### Závislost
- **SheetJS (`xlsx`)** — de-facto standard pro Excel v browserech, BSD licence, zero-server.
- Instalace: `npm install xlsx`
- Volání: `read` + `utils.sheet_to_json` — vše client-side, soubor neopouští prohlížeč.

### Nový modul
`src/lib/xlsImport.ts` — čistá funkce bez React závislostí:

```typescript
export interface ImportResult {
  features: Feature[]         // vygenerovaný backlog
  team: Member[]              // vygenerovaný tým
  roleConfig: Record<Role, RoleMeta>  // merged/nové role
  warnings: string[]          // přeskočené řádky apod.
}

export function parseXlsFile(buffer: ArrayBuffer): ImportResult
```

### Integrace v Simulator.tsx
- Nový handler `handleXlsImport(file: File)` v Experiment mode sekci.
- Po úspěšném parsování: `setState` přepíše backlog, tým, roleConfig; volá `regenerate` s importovanými daty.
- Žádné nové globální state — import je jednorázová akce, výsledek jde přímo do existujícího state.

## Scope — co tato feature NEZAHRNUJE
- Export simulace zpět do XLS (samostatná feature).
- Import do Compare módu.
- CSV podpora (možné rozšíření v budoucnu).
- Serverová validace nebo ukládání souborů.

## Otevřené otázky
_Žádné — všechna rozhodnutí uzavřena._

## Akceptační kritéria
- [ ] `.xlsx` a `.xls` soubory s výše popsanou strukturou se úspěšně importují.
- [ ] Výsledný backlog, tým a roleConfig odpovídají datům v souboru.
- [ ] Simulace je po importu resetována a připravena (ne spuštěna).
- [ ] Šablona ke stažení funguje a obsahuje správné záhlaví + příkladové řádky.
- [ ] Všechny chybové stavy zobrazují správnou hlášku inline.
- [ ] Přidání `xlsx` závislosti nerozbije build ani testy.
- [ ] `parseXlsFile` je pokryta unit testy (happy path + každý chybový stav).
