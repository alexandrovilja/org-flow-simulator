# Feature: Zpětná vazba od uživatelů

## Status
in-progress

*Spec schválen 2026-10-21. UI, testy i implementace hotové na větvi `feat/024-zpetna-vazba-uzivatelu` (2026-10-21).*

## Problem
Autor aplikace nemá data, podle kterých by se rozhodl, co stavět dál (nové scénáře, Pro tier, úpravy módů). Bezplatná verze nemá účty ani analytiku, takže autor neví, kdo aplikaci používá a jestli mu pomáhá. Uživatelé (koučové a manažeři, kteří simulátor ukazují na workshopech) zase nemají jak autorovi napsat, co jim pomohlo, co jim chybí nebo co je mate.

Druhá strana téhož problému (pohled autora): *Jako autor aplikace chci od uživatelů dostávat hodnocení užitečnosti a návrhy na vylepšení, abych se mohl na základě dat rozhodnout, co vyvíjet dál.*

## User Story
Jako AI kouč, agilní kouč nebo manažer používající simulátor chci rychle napsat, co mi pomohlo a co mi chybí, abych měl nástroj, který líp sedí na moje workshopy.

## UI / Design

### Ikona v horní liště
- Ikona bubliny (zpráva) v horní liště vpravo, **vlevo od přepínače tématu**, ve všech třech módech (Compare, Advanced, Cash Flow): `bublina · téma · ? · ↺ Reset · rychlost · ▶ Run`.
- Jen ikona bez textu, stejné velikosti a stylu jako „?“ a přepínač tématu (`Button onBar iconOnly`). Tooltip i přístupný název: „Send feedback“.
- Cíl tutoriálu `data-tutorial-target="feedback-button"`.

### Dialog „Send feedback“
Modální dialog přes aplikaci ve stylu design systému (stejný vzor jako potvrzovací dialog `ConfirmOverlay`). Shora dolů:

1. Titulek **„Send feedback“** a úvodní věta *„Takes a minute. Goes straight to the author.“*
2. **„Your role“** (nepovinné): přepínač s volbami „AI coach“, „Agile coach“, „Manager“, „Other“. Vybrat jde nejvýš jedna; klik na vybranou volbu výběr zruší.
3. **„How useful is Org Flow Simulator for your work?“** (nepovinné): škála 1–5. Body se jmenují 1 „Not useful“, 2 „Slightly useful“, 3 „Moderately useful“, 4 „Very useful“, 5 „Extremely useful“. Pod krajními body je stále vidět „Not useful“ a „Extremely useful“, pod škálou se po výběru ukáže název vybraného bodu. Klik na vybraný bod výběr zruší.
4. **„What helped you most?“** (nepovinné, víceřádkové pole, nejvýš 2000 znaků).
5. **„What's missing or what would you improve?“** (nepovinné, víceřádkové pole, nejvýš 2000 znaků).
6. Zaškrtávátko **„I'm open to a 20-min call with the author“**.
7. Pole **„Email“** s popiskem „(optional, for a reply)“; při zaškrtnutém rozhovoru „(required for the call)“. Zástupný text „name@company.com“.
8. **Poznámka o ochraně údajů** (malým písmem): *„Your answers are emailed to Ilja Alexandrov, the author of Org Flow Simulator, through Web3Forms. Along with them we send the mode you're in and today's date. Nothing else. Your email is used only to reply to you.“* a odkaz na zásady ochrany osobních údajů Web3Forms.
9. Tlačítka **„Cancel“** (ghost) a **„Send“** (strong).

Send není nikdy šedé ani vypnuté; když něco chybí, po kliknutí se ukáže hláška, co doplnit (Příklady 6–8).

### Stavy dialogu
- **Odesílání:** tlačítko ukazuje „Sending…“ a nejde stisknout znovu; pole formuláře jsou zamčená (ztlumená), aby se nezměnilo nic, co by se už neodeslalo. Cancel a Esc dialog zavřou, odeslání doběhne na pozadí a jeho výsledek (poděkování nebo chyba) ukáže příští otevření dialogu.
- **Úspěch:** obsah dialogu nahradí poděkování „Thanks for your feedback.“ (při zájmu o rozhovor doplněné o „The author will email you at {email} to set up a call.“) a tlačítko „Close“. Fokus přejde na nadpis poděkování, aby ho přečetla čtečka obrazovky.
- **Více dialogů:** když je v nastavení otevřený potvrzovací dialog a uživatel otevře zpětnou vazbu, Tab a Esc patří jen dialogu zpětné vazby (horní dialog); po jeho zavření patří zase potvrzovacímu.
- **Přístupné názvy:** skupina rolí se jmenuje podle popisku „Your role“, škála podle otázky.
- **Chyba:** dialog zůstane otevřený a vyplněný, ukáže se „Couldn't send your feedback. Check your connection and try again.“

### Simulace a dialog
Otevření dialogu běžící simulaci zastaví, stejně jako kliknutí na „❙❙ Pause“: tlačítko běhu ukáže „▶ Run“. Po zavření dialogu simulace stojí, dokud uživatel neklikne na „▶ Run“, a pak pokračuje tam, kde skončila. Chování tlačítka běhu se nijak nemění.

### Krok v tutoriálu
Tutoriály v Compare a Advanced dostanou nový **předposlední krok** (těsně před krokem s „▶ Run“), který zvýrazní ikonu bubliny s textem: *„Got an idea, or something you'd like to tell the author? Click the speech-bubble icon in the top bar to send feedback at any time.“* Cash Flow tutoriál nemá.

### Vzhled
Barvy a písmo z design systému Org Flow (JetBrains Mono, tokeny z `globals.css`), funguje ve světlém i tmavém tématu a na šířce 1024 px (projektor).

## Specification by Example

**Příklad 1: Ikona v liště ve všech módech**
- Given: aplikace je otevřená v módu Compare, Advanced nebo Cash Flow
- When: uživatel se podívá na horní lištu
- Then: vlevo od přepínače tématu je ikona bubliny; její tooltip i přístupný název jsou „Send feedback“; při šířce 1024 px se lišta vejde na jeden řádek a nic se nepřekrývá

**Příklad 2: Otevření dialogu**
- Given: žádný dialog není otevřený
- When: uživatel klikne na ikonu bubliny (nebo na ní stiskne Enter)
- Then: otevře se dialog „Send feedback“ s úvodní větou, rolí, hodnocením 1–5, poli „What helped you most?“ a „What's missing or what would you improve?“, zaškrtávátkem „I'm open to a 20-min call with the author“, polem Email, poznámkou o ochraně údajů a tlačítky Cancel a Send; fokus je na prvním prvku dialogu

**Příklad 3: Otevření dialogu zastaví běžící simulaci**
- Given: v aktivním módu běží simulace a tlačítko běhu ukazuje „❙❙ Pause“
- When: uživatel otevře dialog
- Then: simulace se zastaví a tlačítko běhu ukáže „▶ Run“ (stejně jako po kliknutí na Pause); po zavření dialogu simulace dál stojí, dokud uživatel neklikne na „▶ Run“, a pak pokračuje od stejného bodu; simulace, která ještě nezačala nebo je dokončená, zůstane, jak byla

**Příklad 4: Hodnocení s pojmenovanými body**
- Given: otevřený dialog, žádné hodnocení není vybrané; u krajů škály je vidět „Not useful“ a „Extremely useful“
- When: uživatel vybere bod 4
- Then: bod 4 je zvýrazněný a pod škálou se ukáže „Very useful“; ostatní body mají názvy 1 „Not useful“, 2 „Slightly useful“, 3 „Moderately useful“, 5 „Extremely useful“

**Příklad 5: Role i hodnocení jdou změnit a zrušit**
- Given: vybraná role „Manager“ a hodnocení 4
- When: uživatel klikne na „AI coach“ a pak znovu na vybraný bod 4
- Then: vybraná je jen role „AI coach“ a žádné hodnocení není vybrané (odešle se jako nevyplněné)

**Příklad 6: Prázdný formulář se neodešle**
- Given: žádné hodnocení a obě textová pole jsou prázdná nebo obsahují jen mezery (role může být vybraná)
- When: uživatel klikne na Send
- Then: nic se neodešle a u tlačítek se ukáže „Add a rating or a comment first.“; hláška zmizí, jakmile uživatel vybere hodnocení nebo začne psát

**Příklad 7: Zájem o rozhovor vyžaduje e-mail**
- Given: zaškrtnuté „I'm open to a 20-min call with the author“, pole Email je prázdné
- When: uživatel klikne na Send
- Then: nic se neodešle; u pole Email se ukáže „Add your email so the author can reach you.“ a popisek pole říká „(required for the call)“; po odškrtnutí je e-mail zase nepovinný a popisek říká „(optional, for a reply)“

**Příklad 8: Neplatný e-mail**
- Given: v poli Email je „jan@“
- When: uživatel klikne na Send
- Then: nic se neodešle a u pole se ukáže „Check your email address.“; platí bez ohledu na zaškrtávátko rozhovoru

**Příklad 9: Úspěšné odeslání**
- Given: role „Agile coach“, hodnocení 4, vyplněné pole „What's missing…“, aktivní mód Advanced
- When: uživatel klikne na Send a služba odpověď přijme
- Then: během odesílání tlačítko ukazuje „Sending…“ a nejde stisknout znovu; pak dialog ukáže „Thanks for your feedback.“ a tlačítko Close; odeslaná zpráva obsahuje roli, hodnocení („4 – Very useful“), oba texty (prázdný jako „—“), zájem o rozhovor („yes“ / „no“), e-mail (jen pokud je vyplněný), mód „Advanced“ a datum, nic dalšího; při dalším otevření je formulář prázdný

**Příklad 10: Poděkování se zájmem o rozhovor**
- Given: zaškrtnutý rozhovor a e-mail „jana@firma.cz“
- When: odeslání proběhne úspěšně
- Then: dialog ukáže „Thanks for your feedback. The author will email you at jana@firma.cz to set up a call.“

**Příklad 11: Chyba při odeslání**
- Given: vyplněný formulář, ale připojení nefunguje nebo služba odpověď odmítne (např. chybí klíč nebo je vyčerpaný měsíční limit)
- When: uživatel klikne na Send
- Then: dialog zůstane otevřený, vše vyplněné zůstane, ukáže se „Couldn't send your feedback. Check your connection and try again.“ a Send jde stisknout znovu

**Příklad 12: Zavření bez odeslání zachová rozepsané**
- Given: rozepsaný text a vybrané hodnocení 3
- When: uživatel klikne na Cancel (nebo stiskne Esc) a pak dialog znovu otevře
- Then: text i hodnocení jsou zpět; po obnovení stránky je formulář prázdný (nic se neukládá do prohlížeče)

**Příklad 13: Ovládání klávesnicí a délka textu**
- Given: dialog otevřený z klávesnice
- When: uživatel prochází prvky Tabem, píše do textových polí a pak stiskne Esc
- Then: fokus zůstává uvnitř dialogu a cyklí mezi jeho prvky; každé textové pole přijme nejvýš 2000 znaků; Esc dialog zavře a fokus se vrátí na ikonu bubliny

**Příklad 14: Krok tutoriálu o zpětné vazbě**
- Given: uživatel prochází tutoriál v Compare nebo Advanced
- When: dojde na předposlední krok
- Then: zvýrazněná je ikona bubliny v horní liště a text kroku je „Got an idea, or something you'd like to tell the author? Click the speech-bubble icon in the top bar to send feedback at any time.“; následuje poslední krok s „▶ Run“; Compare má 14 kroků (dříve 13), Advanced 10 (dříve 9); krok s ovládáním běhu je hned před krokem zpětné vazby
- *Změna ve feat-025 (revize tutoriálu): krok se zpětnou vazbou je krok 5 prohlídky Compare (v části „TOP BAR“, s nadpisem „Feedback“ a textem „Got an idea, found a bug, or something unclear? Click the speech-bubble icon any time to write to the author.“). Z prohlídky Advanced mizí.*

## Out of Scope
- Aplikace se sama neptá: žádná otázka po skončení běhu ani průzkum ve stylu Superhuman („jak moc by vám to chybělo“). Může přijít později.
- Veřejná nástěnka nápadů a hlasování.
- Odkaz na rezervaci termínu (Calendly, Cal.com); rozhovor jen přes zaškrtávátko a e-mail.
- Přehled odpovědí v aplikaci a vlastní databáze; odpovědi jsou jen v e-mailu autora (a v historii Web3Forms).
- Přílohy: screenshot, nahrávka ani automaticky přiložené nastavení týmu a backlogu. Posílá se jen mód a datum.
- Analytika a sledování používání (cookies, PostHog apod.).
- Potvrzovací e-mail uživateli.
- Čeština ve formuláři; UI je anglicky jako zbytek aplikace.
- Uchování rozepsaného textu po obnovení stránky.
- Samostatné hlášení chyb (bug report); formulář je obecný.
- Jakákoli změna chování tlačítka běhu (Run / Pause / Done).
- Captcha (hCaptcha apod.).

## Technical Notes

### Zvolený přístup
Zvažováno pět způsobů sběru zpětné vazby podle praxe známých produktů: (A) trvale dostupné tlačítko s formulářem (Figma, Linear), (B) mikro-otázka po klíčovém momentu („Was this helpful?“, Stripe, GitHub Docs), (C) průzkum „How would you feel if you could no longer use it?“ (Superhuman / Sean Ellis), (D) veřejná nástěnka s hlasováním (Canny, Excalidraw), (E) pozvánka na rozhovor s autorem. Zvoleno **A + E**; B a C jsou kandidáti na pozdější rozšíření.

### Nové soubory
- `src/lib/feedback.ts`: čistá logika bez Reactu, testovatelná bez sítě:
  - typ konceptu (role, hodnocení, dva texty, rozhovor, e-mail) a názvy bodů škály,
  - kontroly z Příkladů 6–8 a 13 (prázdný formulář, povinný e-mail při rozhovoru, formát e-mailu, limit 2000 znaků; text jen z mezer se bere jako prázdný),
  - sestavení zprávy pro Web3Forms (hodnocení jako „4 – Very useful“, prázdná pole „—“, mód, datum ve formátu `YYYY-MM-DD` podle místního času; předmět např. „Org Flow feedback – 4 Very useful – Agile coach“),
  - `sendFeedback()`: `fetch` POST na `https://api.web3forms.com/submit` s JSON tělem; vrací úspěch nebo chybu, nikdy nevyhodí výjimku do UI.
- `src/components/FeedbackDialog.tsx` + `FeedbackDialog.module.css`: dialog (`role="dialog"`, `aria-modal`, zachycení fokusu, Esc, návrat fokusu na ikonu podle vzoru `ConfirmOverlay`), používá `Button` a `SegmentedControl` (role).
- Škála 1–5 potřebuje vlastní malou komponentu (např. `RatingScale.tsx` + `.module.css`) nebo rozšíření `SegmentedControl`, protože ten je podle dokumentace pro 2–4 volby. Zrušení výběru kliknutím na vybranou volbu řeší rodič (`SegmentedControl` už podporuje `value = null`).

### Úpravy
- `TopBar.tsx`: ikona bubliny vlevo od `ThemeToggle` jako vložené SVG 14 × 14 (stejně jako ikony tématu), žádná knihovna ikon; nový prop pro otevření dialogu.
- `Simulator.tsx`: drží, jestli je dialog otevřený, a koncept jen v paměti (ne localStorage, Příklad 12); při otevření zastaví aktivní mód (`setPaused`, `setComparePaused`, `setCashFlowPaused`) stejně jako kliknutí na Pause; předá název módu tak, jak je na záložkách („Compare“ / „Advanced“ / „Cash Flow“). Názvy módů sdílet z jednoho místa místo kopírování z `TopBar.tsx`.
- `src/lib/tutorialSteps.ts`: nový krok (`compare-feedback`, `experiment-feedback`, `targetId: 'feedback-button'`) mezi krok ovládání a krok Run v obou tutoriálech.

### Web3Forms
- Free plán: 250 odpovědí měsíčně. Přístupový klíč je podle Web3Forms určený k veřejnému použití a funguje jako zástupce autorovy e-mailové adresy (adresa v kódu není).
- Klíč v proměnné prostředí `NEXT_PUBLIC_WEB3FORMS_ACCESS_KEY` (vývoj a testy můžou mít jiný nebo žádný). Na Vercelu ho nastaví autor. Bez klíče odeslání selže hláškou z Příkladu 11 a varováním v konzoli; aplikace nespadne.
- **Veřejný klíč je vědomé rozhodnutí (2026-10-21).** Vercel u proměnné s předponou `NEXT_PUBLIC_` a slovem „KEY“ v názvu varuje, že bude vidět v prohlížeči. Je to tak záměrně: Web3Forms na bezplatném plánu přijímá odeslání jen z prohlížeče (ze serveru až s placeným plánem a povolenou IP adresou serveru) a podle jejich FAQ klíč není tajný, jen zastupuje autorovu adresu; zneužitím jde nanejvýš poslat autorovi e-mail. Zvažovaná alternativa (vlastní Route Handler na Vercelu a e-mailová služba Resend s tajným klíčem) byla zamítnuta jako zbytečná práce navíc pro malé riziko. Při zneužití stačí klíč ve Web3Forms vyměnit.
- Pole `email` Web3Forms automaticky použije jako Reply-To, takže autor uživateli odpoví přímo z pošty.
- Spam: Web3Forms kontroluje spam na serveru u každé odpovědi. Navíc skryté pole (honeypot), které lidé ani čtečky obrazovky neuvidí; přesný název pole ověřit v dokumentaci Web3Forms při implementaci.
- V `next.config.ts` dnes žádná Content-Security-Policy není; kdyby se přidala, musí povolit `connect-src https://api.web3forms.com`.

### Architektura
Bezplatná verze poprvé posílá data mimo prohlížeč, a to přes třetí stranu. Do `architecture-decisions.md` je potřeba (po schválení autorem) doplnit nové rozhodnutí, návrh:

> **Zpětná vazba přes Web3Forms.** Free tier zůstává bez vlastního backendu. Jediná data, která opouštějí prohlížeč, je zpětná vazba odeslaná uživatelem vědomě z dialogu „Send feedback“; posílá se přes Web3Forms (`fetch`, žádná knihovna) na e-mail autora. Důvod: žádný serverový kód ani tajný klíč, zdarma v rozsahu očekávaného počtu odpovědí. Pokud by objem nebo nároky na data rostly, náhradou je vlastní Route Handler na Vercelu.

### Testy a omezení
- **Unit (Vitest):** `feedback.ts` (kontroly, sestavení zprávy, `sendFeedback` s podvrženým `fetch`), dialog a ikona (Testing Library), pozastavení všech tří módů, kroky tutoriálu.
- **E2E (Playwright):** požadavek na Web3Forms se vždy zachytí přes `page.route` a nikdy se nepošle skutečný e-mail; šířka lišty 1024 px (navazuje na feat-021, Příklad 11).
- **Stávající schválené testy feat-013**, které se musí upravit: počet kroků Compare 13 → 14 a Advanced 9 → 10 a pravidlo „krok ovládání je hned před krokem Run“ se mění na „ovládání → zpětná vazba → Run“. Test feat-021 Příklad 17 (oblast ovládání a texty kroků) zůstává beze změny.
- **Pravidla z feat-022 a feat-023:** statické styly v CSS modulech (žádné inline styly ve `.tsx`), žádné emoji v UI, písmo JetBrains Mono.
- `package.json` se nemění.

## Open Questions
—

**Vyřešeno:**
- Architektonické rozhodnutí schváleno autorem a zapsáno do `architecture-decisions.md` jako rozhodnutí 9 (2026-10-21), včetně veřejného klíče Web3Forms.
- Jméno autora v poznámce o ochraně údajů: Ilja Alexandrov. Odkaz na zásady Web3Forms `https://web3forms.com/privacy` ověřen 2026-10-21 (stránka pokrývá i zpracování odpovědí z formulářů; Web3Forms je zpracovatel, správcem je autor).
- Poznámka o ochraně údajů: ano, v dialogu (bez samostatné stránky „Privacy“).
- Tutoriál: ano, předposlední krok v Compare i Advanced.
- Adresa pro odpovědi: autorův e-mail; účet Web3Forms založí autor a klíč nastaví na Vercelu před nasazením. Implementace a testy se bez klíče obejdou.

## Related Features
- **feat-001-simulace-prubehu-vyvoje:** otevření dialogu pozastaví simulaci stejně jako „❙❙ Pause“ (Příklad 3); chování tlačítka běhu se nemění.
- **feat-009-dva-mody-ui:** pravidlo „jedna hlavní akce“ zůstává, ikona bubliny je nenápadná (`onBar iconOnly`) a nekonkuruje „▶ Run“.
- **feat-013-zprehledneni-aplikace:** tutoriály Compare a Advanced dostanou předposlední krok o zpětné vazbě (Příklad 14); mění se počet kroků a pořadí na konci (ovládání → zpětná vazba → Run).
- **feat-015-cash-flow-mod:** ikona je i v Cash Flow a otevření dialogu pozastaví i Cash Flow simulaci; Cash Flow tutoriál nemá.
- **feat-021-prevod-design-system-org-flow:** horní lišta dostane ikonu vlevo od přepínače tématu; šířka 1024 px (Příklad 11) se musí dál vejít. Dialog vychází ze vzoru `ConfirmOverlay`.
- **feat-022-sjednoceni-designu, feat-023-jednotne-pismo-textu:** nový dialog dodržuje jejich pravidla (CSS moduly, bez emoji, JetBrains Mono).
- **feat-025-revize-tutorialu (draft):** mění Příklad 14: krok se zpětnou vazbou je krok 5 prohlídky Compare, prohlídka Advanced ho nemá. Úvodní karta tutoriálu navíc říká, proč je zpětná vazba vítaná.
