# Feature: Jednotné písmo: celá aplikace v JetBrains Mono

## Status
done

*Hotovo 2026-10-20 v jednom PR (#28, 5a511ee), včetně code review (8 nálezů opraveno). Smoke test produkce prošel (JetBrains Mono všude, žádné Archivo ani Kalam, ligatury vypnuté, karty jednotek ve dvou sloupcích při ~1070 px). Artefakt design systému je aktualizovaný (verze 8: jediná rodina `mono`, annotation v mono, README, mapping a komponenty).*

## Problem
Po feat-021 a feat-022 jsou titulky, záložky a tlačítka sjednocené, ale v aplikaci se dál střídají dvě písma a texty uvnitř panelů vedle sebe působí nejednotně:

- **Názvy features** (`F-001 Login flow`) jsou v JetBrains Mono 11 px.
- **Jména jednotek** (`Team A`), **specializace** (vstupy v nastavení, chipy rolí `Design`) a **prázdné stavy** (`Nothing in flight`) jsou v Archivo 11–13 px.
- **Poznámky a popisky** (`auto-scaled`, `Click + to add a specialty`, popisky sliderů, `live total`) jsou v Archivo 11–12 px.
- **Titulky, záložky a tlačítka** jsou v Archivo 800 verzálkami.

Na jedné kartě jednotky tak stojí jméno týmu v Archivo a pod ním název feature v mono. Design system to zamýšlel (mono pro data a ID, Archivo pro jména a titulky), ale na plátně to nepůsobí jednotně. Kouč chce **jedno písmo v celé aplikaci**.

## User Story
*Jako agilní kouč, který simulátor promítá na workshopu, chci, aby celá aplikace byla v jednom písmu, aby obrazovka působila jednotně a publikum se nerozptylovalo míchaním písem.*

## UI / Design
Rozhodnutí uživatele (2026-10-20): **JetBrains Mono všude, Archivo se přestane používat úplně**, i pro titulky, záložky, tlačítka, názvy aplikace i souvislé věty. Mění se jen písmo; barvy, velikosti, řezy, verzálky a rozložení zůstávají (kromě níže uvedených úprav šířek).

- **Titulky, záložky, tlačítka, wordmark** (dnes Archivo 800 verzálkami): JetBrains Mono 800 verzálkami, stejné velikosti (wordmark 15, záložky a tlačítka 13, titulky týmů 20, titulek výsledku 36, „404“ 56 px). Záporné prostrkání velkých titulků (−1,1 / −0,4 px) se v mono ruší, protože by se znaky slepovaly.
- **Obsahové texty:** jména jednotek a členů (11/600), specializace včetně vstupů, tlačítek − / + a nápovědy (11/500, nápověda 11/400), chipy rolí (11/600), prázdné stavy a „Page not found“ (11/400), poznámky v hlavičkách panelů, popisky sliderů (11/500), jednotky, poznámky a „Details“ u dlaždic metrik a zprávy v nastavení (11/400). Názvy features zůstávají mono 11/500 (na řádku práce na kartě jednotky 11/400).
- **Souvislé věty:** text tutoriálu, těla dialogů, plovoucí nápovědy, věta ve výsledku Compare a odkaz na 404 v mono, ve stávající velikosti (12–13 px).
- **Ligatury se vypínají.** JetBrains Mono má kódové ligatury (`->`, `!=`, `<=` se kreslí jako jeden glyf), které by změnily vzhled textu psaného uživatelem (jména jednotek, specializací, features z XLS). `font-variant-ligatures: none` platí pro celou aplikaci včetně vstupů a tlačítek.
- **Kalam se ruší.** Ručně psaná poznámka kouče ve výsledku Compare („same backlog!“) je JetBrains Mono 700, 15 px; zůstává jí papírový podklad (`surface-paper`) a lehký náklon −1,5°, takže je dál poznat jako poznámka.
- **Šířky:** mono je zhruba o 15 % širší než Archivo. Aby nic nepřetékalo, platí:
  - jména jednotek, chipy rolí, vstupy specializací a názvy features se při nedostatku místa zkrátí výpustkou „…“; plný text je v atributu `title` **jen u zkráceného textu** (nezkrácený text tooltip nemá), a vstupy se jmény mají přístupný název (`aria-label`: „Unit name“, „Specialization name“),
  - počet sloupců karet jednotek v Advanced a Cash Flow se řídí **šířkou prostředního sloupce**, ne šířkou okna: od asi 525 px tři sloupce, pod tím dva, pod asi 340 px jeden. Na projektoru 1024 × 768 (prostřední sloupec ~424 px) jsou tedy dva sloupce místo tří (dnes tři karty po ~127 px dostanou jména a chipy oříznuté i bez mono),
  - horní lišta se při 1024 a 1280 px dál nepřekrývá (feat-021, Příklad 11) a karta tutoriálu se vždy celá vejde do okna.

## Specification by Example

**Příklad 1: Písmo aplikace je JetBrains Mono**
- Given: libovolná stránka aplikace, i stránka 404
- When: se přečte písmo `body` a token `--font-mono`
- Then: `body` i token `--font-mono` jsou JetBrains Mono; tokeny `--font-display`, `--font-sans` a `--font-hand` neexistují a žádný soubor v `src/` je nepoužívá; v dokumentu není načtené žádné písmo Archivo ani Kalam, JetBrains Mono má řez 800 a prohlížeč nestahuje písma z Google Fonts

**Příklad 2: Názvy features zůstávají v mono**
- Given: Compare, Advanced i Cash Flow po spuštění simulace
- When: se vykreslí karty v backlogu, In progress, seznam Done a řádek práce na kartě jednotky
- Then: každý název feature („F-001 Login flow“) je JetBrains Mono 11 px, řez 500 (na řádku práce na kartě jednotky 400, beze změny)

**Příklad 3: Jména jednotek a členů v mono**
- Given: Advanced (preset Teams) a Compare
- When: se vykreslí karty jednotek
- Then: jméno jednotky („Team A“) i člena v Compare („Ada“) je JetBrains Mono 11 px, řez 600; po kliknutí do jména jde dál přepsat a Enter ho uloží

**Příklad 4: Specializace a chipy rolí v mono**
- Given: otevřený akordeon Specializations; karty jednotek a Compare s presetem Teams
- When: se vykreslí seznam a formulář specializací, výběr role po kliknutí na „+“ a chipy rolí
- Then: vstupy s názvy, pole „Name…“, tlačítka − / +, „Phase:“, „Req.:“ a nápověda jsou JetBrains Mono 11 px; text chipu je 11 px, řez 600, bílý na výplni role

**Příklad 5: Prázdné stavy, poznámky a popisky v mono**
- Given: Advanced, Compare a Cash Flow s otevřenými akordeony nastavení, stránka 404
- When: se projdou „Nothing in flight“, „None yet“, „No completed features yet.“, „Page not found“, poznámky v hlavičkách panelů, popisky sliderů, jednotky a poznámky u dlaždic metrik, „Details“ a zprávy v nastavení
- Then: všechny jsou JetBrains Mono 11 px (prázdné stavy a poznámky řez 400, popisky sliderů 500)

**Příklad 6: Titulky, záložky a tlačítka v mono 800**
- Given: libovolný mód
- When: se vykreslí wordmark, záložky, tlačítka (Run, Reset, Import XLS, Add…), titulky týmů v Compare a po doběhnutí obou běhů titulek výsledku
- Then: každý je JetBrains Mono, řez 800, verzálky, ve stejné velikosti jako dnes (15, 13, 13, 20, 36 px)

**Příklad 7: Souvislé věty a poznámka kouče v mono**
- Given: otevřený tutoriál, potvrzovací dialog, nápověda přepínače a „?“, výsledek Compare
- When: se vykreslí jejich texty a poznámka kouče
- Then: text tutoriálu, dialogu, nápověd a věta ve výsledku jsou JetBrains Mono; poznámka kouče je JetBrains Mono 700, 15 px, na papírovém podkladu s náklonem

**Příklad 8: Žádné Archivo v aplikaci**
- Given: Compare, Advanced i Cash Flow po spuštění simulace, se všemi akordeony nastavení otevřenými, otevřeným tutoriálem i dialogem, ve světlém i tmavém tématu
- When: se projdou všechny viditelné textové prvky
- Then: každý má první písmo JetBrains Mono, velikost ze škály design systému a žádný neobsahuje emoji

**Příklad 9: Dlouhé názvy nepřetékají (projektor 1024 px)**
- Given: okno široké 1024 px, Advanced a Cash Flow s presetem Teams („Client Acquisition“, „Integration Testing“) a jednotkou s dlouhým jménem
- When: se vykreslí karty jednotek a seznam specializací
- Then: karty jednotek jsou ve dvou sloupcích; žádné jméno, chip ani název feature nepřesahuje okraj své karty, stránka se vodorovně nerolí a u zkráceného textu je plný název v atributu `title`, kdežto nezkrácený text `title` nemá; vstup se jménem jednotky má `aria-label` „Unit name“. Počet sloupců se řídí šířkou prostředního sloupce: při šířce okna 900 px je jeden, při 1024 a 1100 px dva, při 1180 a 1280 px tři. Totéž pravidlo (bez přetékání, `title` jen u zkrácených textů) platí pro jména členů, chipy a řádky práce v Compare při 1024 px

**Příklad 10: Horní lišta a titulky se vejdou (1024 a 1280 px)**
- Given: okno široké 1024 px, resp. 1280 px
- When: se v Compare, Advanced i Cash Flow vykreslí horní lišta, titulky týmů v Compare a po doběhnutí obou běhů rám výsledku
- Then: značka končí před záložkami, záložky před ovládáním vpravo, titulky týmů se zalomí na nejvýš dva řádky, rám výsledku se vejde a stránka se vodorovně nerolí

**Příklad 11: Tutoriál se vejde do okna**
- Given: okno 1024 × 768, otevřený tutoriál Compare, Advanced i Cash Flow
- When: kouč projde všechny kroky tlačítkem Next
- Then: na každém kroku leží karta tutoriálu celá v okně (nahoře i dole) a její text není oříznutý

**Příklad 12: Bez ligatur**
- Given: libovolný mód, jednotka se jménem „A -> B != C <= D“
- When: se přečte `font-variant-ligatures` u `body`, vstupu se jménem jednotky a tlačítka
- Then: všude je `none`, takže se znaky `->`, `!=` a `<=` kreslí jednotlivě, tak jak je kouč napsal

## Out of Scope
- **Barvy, velikosti ostatních textů a rozložení** mimo úpravy šířek z části UI / Design.
- **Artefakt design systému** (README, `tokens.json`, `mapping.md`, komponenty) se upravuje samostatně po sloučení tohoto PR (viz Technical Notes, „Po sloučení“); není součástí repa.
- **TeamMap**, jak rozhodla feat-021.

## Technical Notes
- **Jeden zdroj pravdy:** v `globals.css` zůstane jediný token písma `--font-mono` (`var(--font-jetbrains-mono), ui-monospace, Menlo, monospace`); `--font-display`, `--font-sans` a `--font-hand` se ruší a všechny jejich použití v CSS modulech se nahradí `var(--font-mono)`. Písmo, které si třída nenastaví sama, dědí z `body` (taky mono), takže nový text zůstane v mono. Hlídá to jednotkový test zdrojů.
- **Načtení písem (`layout.tsx`):** odstranit Archivo a Kalam (`import`, konstanty, proměnné `--font-archivo` a `--font-kalam`, třídy na `<html>`) a v `globals.css` token `--font-hand`. JetBrains Mono dostane navíc řez 800 (`weight: ['400','500','600','700','800']`), protože titulky a tlačítka jsou 800 a bez něj by se řez dopočítal uměle.
- **Poznámka kouče:** `WinnerBanner.module.css` (`.note`) místo `font-family: var(--font-hand)` JetBrains Mono 700, 15 px, řádkování podle stávajícího; podklad a náklon zůstávají.
- **Prostrkání:** `letter-spacing` záporné u `not-found.module.css` (`.code`), `WinnerBanner.module.css` (`.title`) a `StatTile.module.css` (`.timer .value`, už mono) ověřit vizuálně a v mono je nastavit na 0 u titulků.
- **Úzké obrazovky:** sekce jednotek v `InProgressTeamPanel.module.css` je kontejner (`container-type: inline-size`); mřížka `repeat(3, 1fr)` se v `@container (max-width: 524px)` mění na `repeat(2, 1fr)` a v `@container (max-width: 337px)` na jeden sloupec (karta má vždy aspoň ~150 px). Pro jména, chipy a vstupy `min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap`. Plný název v `title` jen při zkrácení: nový hook `useIsTruncated` (`src/hooks/useIsTruncated.ts`, `ResizeObserver` + `scrollWidth > clientWidth`, bez `ResizeObserver`, např. v testech, se měří jen při změně textu) pro jména jednotek a členů, chipy rolí, řádky práce a vstupy specializací. Horní lišta a tutoriál (`CARD_W` = 400 px, výška se mění s textem) ověřit na 1024 × 768 ve všech krocích; podle potřeby posunout hranici `1259px` v `TopBar.module.css`.
- **Komentáře** v CSS modulech zmiňující „Archivo 800“ (`not-found`, `TopBar`, `Button`, `ComparePanel`, `WinnerBanner`) a v `layout.tsx` se přepíšou.
- **Ligatury:** v `globals.css` `* { font-variant-ligatures: none }`; selektor `*` je nutný, protože vstupy a tlačítka mají z prohlížeče vlastní `font` a dědičnost z `body` by je minula.
- **Čip role:** rozměry odebíracího × (velikost, odsazení, mezera) jsou CSS proměnné na `.chip`, z nichž se počítá `padding-right` i poloha tlačítka; žádné magické číslo.
- **Testy:** příklady 1–12 jako Playwright E2E (skutečné písmo, velikost a řez, šířka okna, kroky tutoriálu, počet sloupců podle šířky, `title` jen u zkrácených textů, ligatury); jsdom styly z CSS modulů nepočítá. Jednotkově se testuje, co jsdom umí: zdroje (tokeny písma), hook `useIsTruncated` (s vypůjčenými `scrollWidth` a `clientWidth`) a `aria-label` vstupů. Příklad 1 doplnit o kontrolu, že se nestahuje Archivo a že je načtený JetBrains Mono 800.
- **Po sloučení (součást dokončení feature):** aktualizovat artefakt design systému přes DesignSync, aby odpovídal aplikaci: README (Typografie, Principy: ručně psaný hlas kouče, Záměrná rozšíření), `tokens.json` (rodiny `display`, `sans` a `hand` zrušit, zůstane jediná `mono`; styl `annotation` v mono 700 15 px), komponenty a `mapping.md`. Až po něm se spec přepne na `done`.
- **Stávající testy, které se mění:** E2E feat-021 Příklad 10 (písmo `body` místo Archivo je JetBrains Mono) a E2E feat-022 příklady 1 (poznámky už 11 px mono), 7 (tlačítko „+ Add …“ mono 800), 8 (titulek týmu a odznak výsledku mono), 9 (povolené je jen JetBrains Mono) a 10 (404 v mono). Spec feat-021 (Příklad 10, „Písmo“) a feat-022 se doplní poznámkou, že je písmo změněno feat-023.

## Open Questions
—

*Vyřešeno s uživatelem (2026-10-20): Kalam se ruší úplně (poznámka kouče v mono); artefakt design systému se po sloučení aktualizuje.*

## Related Features
- **feat-021-prevod-design-system-org-flow:** zavedla písma a typovou škálu; tady se Archivo ruší a Příklad 10 (písma) se mění; spec feat-021 dostal poznámku o změně.
- **feat-022-sjednoceni-designu:** sjednotila titulky, emoji a inline styly; tato feature dokončuje sjednocení písma; spec feat-022 dostal poznámku o změně.
- **feat-013-zprehledneni-aplikace:** tutoriál a `HelpIcon` přecházejí na mono.
- **feat-007-sprava-specializaci, feat-019-ai-multiplikator-vykonu:** vstupy specializací a jména jednotek.
