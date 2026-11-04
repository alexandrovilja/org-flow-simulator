# Research: Čas simulace v pracovních dnech (feat-027)

## Výzkumná otázka
Jak koučovské simulace, nástroje pro flow analytics a plánovací nástroje převádějí abstraktní čas a práci na pracovní dny a týdny, jak formátují délky trvání pro management a jak vysvětlují jednotku času?

## Metoda
- Datum: 2026-11-04
- Kategorie produktů: A koučovské simulace a hry, B flow analytics a forecasting, C formát „týdny a dny“ a konfigurace pracovního týdne, D jednotky velikosti práce.
- Vedl čtyři paralelní webové rešerše (jedna na kategorii). Jen veřejné zdroje. Co agenti nepotvrdili ze zdroje, je níže označeno „neověřeno“ nebo „nenalezeno“.
- Omezení:
  - Okaloa Flowlab: online verze jen s přihlášením, veřejné zdroje jednotky ani převod kola na čas neuvádějí.
  - getkanban.com vracel HTTP 429, pravidla jsem čerpal ze sekundárních zdrojů.
  - Několik stránek se načetlo prázdných nebo s HTTP 403 (znalostní báze Businessmapu, některé stránky 55 Degrees přes veřejné REST API).
  - Neověřeno: tvrzení Mikea Cohna o ideálních dnech (jen z výsledků vyhledávání), vzhled formátu „Pretty“ v Jiře, volba „jen pracovní dny“ v simulaci Businessmapu, dokumentace Apple DateComponentsFormatter a odhady v Linearu (stránka vrátila 404).
- Research popisuje jen to, co produkty dělají. Netvrdí nic o dopadu na metriky týmů.

## Nálezy

### Featureban (Mike Burrows), kategorie A
- **Zdroj:** https://www.slideshare.net/slideshow/featureban-slides/39065931 ; https://esicenter.bg/featureban-simulation/ ; https://habr.com/en/articles/499050 (přístup 2026-11-04)
- **Jak to řeší:** Jedno kolo hry je jeden simulovaný den. Tým si vede číslo dne, ke každé kartě zapisuje den vstupu a odchodu a z toho vzniká doba v dnech pro run chart a histogram. Ukázkové výsledky jsou uváděné v dnech s desetinami (průměr 4,4 dne). Tréninková varianta má šest kol po pěti simulovaných dnech. V online verzi (Kaiten) se den posune automaticky, až všichni odehrají tahy, a „dny“ jsou výslovně tahy, ne kalendářní data.
- **Co je relevantní pro nás:** Nejblíže našemu záměru „1 sekunda = 1 den“. Den je pojem hry, doba se čte v dnech s desetinami.
- **Co je nejasné:** Zda se doba počítá jako odchod minus vstup, nebo plus jedna. Den hry není vysvětlen vůči skutečnému času. Cycle time se samostatně nedefinuje, používá se lead time.

### getKanban (Russell Healy), kategorie A
- **Zdroj:** https://xebia.com/blog/dancing-with-getkanban-using-polca/ ; https://yeret-agility-site.pages.dev/how-i-would-simulate-time-boxed-agile-in-the-getkanban-kanban-board-game ; https://learn.microsoft.com/en-us/archive/blogs/willy-peter_schaub/whats-up-with-us-playing-kanban-games-in-the-garage (přístup 2026-11-04)
- **Jak to řeší:** Hra běží po „project days“ (v popsaném běhu 24 dní). Dny se sdružují do třídenních cyklů („billing cycle“), na jejichž konci se doplňuje Ready, a finanční shrnutí se dělá po billing cyclech, ne po každém dni. Lead time se měří ve dnech od vstupu do Ready po nasazení. Velikost práce je abstraktní „points of work“ na stanici, ne man-days.
- **Co je relevantní pro nás:** Výnos se agreguje po periodě několika dnů, podobně jako náš týdenní tik.
- **Co je nejasné:** Oficiální web nedostupný (429), pravidla výpočtu lead time nenalezena, započítání dne zahájení nenalezeno. Údaj o začátku doplňování ve dnech 9, 12, 15… je jen z úryvku vyhledávače (neověřeno).

### Kanban Pizza Game (agile42), kategorie A
- **Zdroj:** https://dokk.org/library/kanban_pizza_game_2013_agile42 ; https://www.agile42.com/fi/?p=3510 ; https://www.agilealliance.org/wp-content/uploads/2016/01/Kanban-Pizza-Game-AllIncluded.pdf (přístup 2026-11-04)
- **Jak to řeší:** Čas se nepřevádí na dny. Kolo trvá zhruba 5 až 7 minut a facilitátor délku záměrně neoznamuje, aby týmy nezpomalovaly. Lead time se v základní hře neměří, nahrazuje ho bodový systém. Volitelný celohrou časovač se mezi koly pozastavuje.
- **Co je relevantní pro nás:** Jediný příklad, který čas záměrně neváže na reálnou jednotku (opak našeho záměru).
- **Co je nejasné:** Jednotka celohrového časovače, definice cycle time.

### Flow Engineering Game (Pereira, Davis; IT Revolution), kategorie A
- **Zdroj:** https://itrevolution.com/wp-content/uploads/2023/12/The-Flow-Engineering-Game.pdf (přístup 2026-11-04, text vytažen z PDF lokálně)
- **Jak to řeší:** Čísla z kostek se zapisují jako cycle time a wait time mezi fázemi. K číslům facilitátor přidává jednotku času (měsíce, týdny, dny, hodiny) podle měřítka organizace; základní jednotka má odpovídat toku v dané organizaci (příklad: týdny a dny pro plně digitální release).
- **Co je relevantní pro nás:** Jednotka je volitelný popisek nad abstraktním číslem a vysvětluje se jako měřítko, ne přesné měření. Přesně to děláme s „1 s = 1 den“.
- **Co je nejasné:** Pracovní vs. kalendářní dny, zaokrouhlování, formát „týdny + dny“.

### Kanbanboardgame.com, kategorie A
- **Zdroj:** https://kanbanboardgame.com ; https://kirillklimov.com/playing-to-the-extreme (přístup 2026-11-04)
- **Jak to řeší:** Čas je „den“, hod kostkou 1 až 6 za den určuje množství práce, specialista ve své oblasti má dvojnásobný výstup. Grafy: Cumulative Flow, Cycle Time, finanční. Autor článku uvádí teoretické minimum lead time tři dny (jeden na každou fázi).
- **Co je relevantní pro nás:** Nejpodobnější našemu modelu (specializace, dny, práce na úkol). Minimum lead time plyne z toho, že každý krok zabere aspoň den (inference).
- **Co je nejasné:** Jednotku grafu Cycle Time stránka neuvádí (dny jsou odvozeny z článku), vysvětlení dne ani ovládání rychlosti nenalezeno.

### Okaloa Flowlab, kategorie A
- **Nenalezeno.** Veřejné zdroje uvádějí jen délku sezení a pojmy WIP, throughput a lead time. Převod kola na čas ani jednotky lead time tam nejsou.

### ActionableAgile (55 Degrees), kategorie B
- **Zdroj:** https://55degrees.atlassian.net/wiki/spaces/ActionableAgile/pages/2146304025/Frequently+Asked+Questions+FAQ ; https://55degrees.atlassian.net/wiki/spaces/AAS/pages/2324987905 ; https://www.55degrees.se/post/what-is-cycle-time ; stránky Throughput Run Chart a Monte Carlo (REST API 55degrees.atlassian.net/wiki/rest/api/content/2321744124, 2407399482, 2408972289) (přístup 2026-11-04)
- **Jak to řeší:** Cycle Time je (datum konce − datum začátku) + 1, takže minimum je 1 den. Víkendy a svátky nejdou vyloučit a FAQ to uvádí jako záměr (přínos vidí jen u úseků pod týden, vadí mu výjimky a práce o víkendech). Počítá se tedy v kalendářních dnech. Percentily se čtou ve smyslu „X % položek hotovo za tolik dní nebo dříve“. Throughput Run Chart má výchozí krok den a přepíná na týden nebo měsíc. Osa y je počet dokončených položek, ne velikost. Monte Carlo používá denní throughput.
- **Co je relevantní pro nás:** Konvence +1 (minimum 1 den) a prosté dny bez převodu na týdny u cycle time. Týdny se objevují u agregace throughputu.
- **Co je nejasné:** Global Chart Controls se k pracovním dnům nevyjadřují. Odkazy `…/wiki/x/…` se načítaly prázdné, obsah jsem získal přes veřejné REST API.

### Jira (Atlassian), kategorie B, C a D
- **Zdroj:** https://support.atlassian.com/jira-cloud-administration/docs/configure-time-tracking/ ; https://confluence.atlassian.com/jiracorecloud/logging-time-on-work-items-902498103.html ; https://support.atlassian.com/jira-software-cloud/docs/view-and-understand-the-control-chart/ ; https://support.atlassian.com/jira-software-cloud/docs/configure-working-days/ ; https://support.atlassian.com/jira-software-cloud/docs/log-time-on-an-issue/ ; https://confluence.atlassian.com/jiraportfolioserver0225/working-hours-and-days-967342131.html (přístup 2026-11-04)
- **Jak to řeší:** Admin nastaví počet pracovních dnů v týdnu a hodin ve dni (smí být i desetinné). Čas se zapisuje v jednotkách w, d, h, m spojených mezerou (příklad „2d 4h 30m“), číslo bez jednotky se vyloží podle volitelné výchozí jednotky. Zobrazení času má režimy Pretty, Days a Hours. Stránka o logování času uvádí výchozí převod 5 dnů na týden a 8 hodin na den (admin stránka výchozí hodnoty neuvádí). Control Chart má osu „Elapsed Time“ s příklady ve dnech, board má nastavení pracovních dnů (standardní dny, jednorázové nepracovní dny).
- **Co je relevantní pro nás:** Den a týden jsou konfigurovatelné pracovní jednotky a zobrazení se přepíná mezi „pretty“ a čistými dny či hodinami, což je blízká paralela k naší volbě „2 weeks 4.3 days“ pro celek a „9.1 days“ pro jednotlivé featury. Zápis zkratkami řeší jednotné a množné číslo tím, že ho nepotřebuje.
- **Co je nejasné:** Jak vypadá režim Pretty (neověřeno). Zda projde zápis zlomku dne („1.5d“) a jak se zobrazí. Nápověda neříká, zda se den zahájení počítá. Starší návod uvádí zaškrtávátko pro zahrnutí nepracovních dnů do cycle time, aktuální nápověda ho nezmiňuje (neověřeno pro dnešní verzi).

### Microsoft Project, kategorie C a D
- **Zdroj:** https://support.microsoft.com/en-us/project/how-project-schedules-tasks-behind-the-scenes ; https://support.microsoft.com/en-us/office/change-the-default-task-duration-unit-af79599d-29e8-4e77-86a7-77c37410155e ; https://support.microsoft.com/en-us/office/change-the-task-type-for-more-accurate-scheduling-b0b969ad-45bc-4e9e-8967-435587548a72 ; https://support.microsoft.com/en-us/office/effort-and-duration-in-project-for-the-web-f7740450-1ad8-4628-aef6-1fdca60cc4b6 (přístup 2026-11-04)
- **Jak to řeší:** Platí Work = Duration × Units: Work je práce v hodinách, Duration časové rozpětí v pracovním čase, Units podíl kapacity přiřazených lidí. Příklad z nápovědy: 80 hodin práce a jeden člověk při 8 h/den jsou 10 dní, druhý člověk zkrátí trvání na 5 dní a práce zůstává 80 h. Výchozí jednotka trvání je den, výchozí převod den = 8 h, týden = 40 h, měsíc = 20 pracovních dnů. Kalendář určuje pracovní čas (výchozí pondělí až pátek). Zlomky dnů se připouštějí (příklad 12,5 dne).
- **Co je relevantní pro nás:** Jednoznačně odděluje práci (effort) od trvání (duration) a ukazuje, že u více lidí se práce sčítá a trvání se zkracuje. Přesně to potřebujeme vysvětlit u organizační jednotky tvořené celým týmem. Délka týdne je odvozená z nastavení, ne pevná.
- **Co je nejasné:** Termín „person-days“ se v nápovědě nepoužívá (měří v hodinách). Stránka Project for the web poznamenává, že se nepředpokládá den o 8 hodinách. Zdroj k nastavení délky dne je jen komunitní fórum (neoficiální).

### Intl.DurationFormat (MDN) a pravidla množného čísla (CLDR), kategorie C
- **Zdroj:** https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DurationFormat/format ; https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DurationFormat/DurationFormat ; https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html (přístup 2026-11-04)
- **Jak to řeší:** Týdny a dny jsou samostatná pole. Styly: short (výchozí) dává „3 wks, 3 days“, narrow „3w 3d“, long plné názvy. Při výchozím nastavení se nulové jednotky vynechají. Podle CLDR má angličtina jen tvary „one“ a „other“ a jednotné číslo platí jen pro celé číslo 1 bez desetinné části: „1 day“, ale „1.0 days“ a „1.5 days“.
- **Co je relevantní pro nás:** Potvrzuje konvenci „týdny + dny“ i naše pravidlo množného čísla (při vždy zobrazené desetině je `days` množné).
- **Co je nejasné:** Hodnoty jsou podle MDN celá čísla, desetinné dny API nepodporuje a „4.3 days“ by se skládalo ručně. Stránky neřeší, kolik dnů má týden. Apple DateComponentsFormatter: stránka se nenačetla, nic netvrdím.

### Businessmap (dříve Kanbanize), kategorie B
- **Zdroj:** https://businessmap.io/blog/kanban-forecasting ; https://businessmap.io/blog/measure-cycle-time-calculations (přístup 2026-11-04)
- **Jak to řeší:** Percentily vysvětluje jako pravděpodobnost („85. percentil, zhruba 85 % šance“). Cycle time je konec − začátek, u položek dokončených týž den navrhuje +1. Doporučuje počítat i víkendy, protože zákazník vnímá celkový uplynulý čas (příklad: „5 dní“ slíbených v pátek znamená příští středu).
- **Co je relevantní pro nás:** Argument pro kalendářní čas z pohledu zákazníka, opak naší pracovní logiky. Stojí za zmínku jako vědomé rozhodnutí.
- **Co je nejasné:** Znalostní báze vrací HTTP 403. Tvrzení, že simulace umí běžet jen na pracovní dny, je jen z výtahu vyhledávače (neověřeno).

### Planview (LeanKit), Focused Objective (Magennis), Nave, kategorie B (doplňky)
- **Zdroj:** https://blog.planview.com/de/wp-json/wp/v2/posts/11853 ; https://www.focusedobjective.com/throughput ; https://getnave.com/cycle-time-scatterplot ; https://getnave.com/throughput-run-chart (přístup 2026-11-04)
- **Jak to řeší:** Planview počítá cycle time jako konec − začátek + 1 v uplynulých kalendářních dnech. Focused Objective nabízí u forecasteru jednotku throughputu 1 až 4 týdny a výhled 1 až 52 intervalů. Nave ukazuje throughput za den, týden nebo měsíc a doporučuje sledovat ho týdně nebo dvoutýdně.
- **Co je relevantní pro nás:** Týdny jsou běžná agregační jednotka throughputu a forecastingu, cycle time zůstává v dnech.
- **Co je nejasné:** U Nave pracovní vs. kalendářní dny a započítání dne zahájení nenalezeno. Focused Objective pracovní dny ani svátky nezmiňuje.

### Azure DevOps a odhadovací praxe (ideal days, man-days, person-days), kategorie D
- **Zdroj:** https://learn.microsoft.com/en-us/azure/devops/boards/queries/query-numeric?view=azure-devops ; https://innolution.com/resources/glossary/ideal-day ; https://www.jamesshore.com/Agile-Book/estimating.html ; https://www.dictionary.com/browse/man-day (přístup 2026-11-04)
- **Jak to řeší:** Azure DevOps vede odhad a odpracovanou práci v hodinách nebo dnech a jednotku nevynucuje; Story Points popisuje jako subjektivní míru velikosti. Innolution definuje ideal day jako dobu, kterou by položka zabrala, kdyby byla jedinou prací. James Shore popisuje ideální dny jako práci bez vyrušování a na kalendářní čas je převádí společným faktorem (velocity). Dictionary.com definuje man-day jako práci jedné osoby za jeden den a uvádí „person-day“ jako neutrální náhradu.
- **Co je relevantní pro nás:** Člověkoden se sčítá napříč lidmi, existuje zavedená genderově neutrální varianta „person-day“ a rozlišení práce (ideální dny) od kalendářního času je standardní vysvětlení.
- **Co je nejasné:** Společný odhad celého týmu jako jedné jednotky: nenalezeno (nejblíž je Project, kde Work je práce všech přiřazených lidí dohromady). Cohnovo tvrzení, že ideální dny nelze sčítat mezi lidmi nebo týmy, je neověřené. Linear neověřen.

## Vzory napříč produkty
- **Cycle time a lead time jsou všude v prostých dnech.** V analytických nástrojích i ve hrách (Featureban, getKanban, ActionableAgile, Jira Control Chart). Průměry se uvádějí s desetinami (Featureban „průměr 4,4 dne“).
- **Týdny jsou agregační jednotka**, ne jednotka cycle time: throughput po týdnech (ActionableAgile, Nave, Focused Objective), finanční shrnutí po několikadenním cyklu (getKanban billing cycle).
- **Den ve hrách je tah, ne kalendářní den.** Žádná z nalezených her neřeší pracovní vs. kalendářní dny. Flow Engineering Game výslovně označuje jednotku za volitelný popisek nad abstraktním číslem; Pizza Game délku kola záměrně skrývá.
- **Pracovní vs. kalendářní čas se v nástrojích rozchází.** Jira a MS Project počítají v pracovním čase s nastavitelným týdnem (výchozí 5 dnů, 8 hodin). ActionableAgile (záměrně), Planview a Businessmap (z pohledu zákazníka) počítají v kalendářních dnech.
- **Konvence +1:** ActionableAgile, Planview a Businessmap (jako volba) počítají den zahájení, takže minimum je 1 den. To předpokládá celodenní data. Náš engine má spojitý čas.
- **Formát trvání:** knihovní standard (Intl) skládá týdny a dny z oddělených polí, nulové jednotky při výchozím nastavení vynechává a řídí se pravidly jednotného a množného čísla podle CLDR. Jira používá zkratky.
- **Práce vs. trvání:** MS Project oddělují Work a Duration; ideální dny jsou práce bez vyrušování. Jednotka velikosti je v praxi hodiny nebo dny, v hrách abstraktní „points of work“.
- **Živý čítač v „týdny + dny“:** nalezen jen plugin pro Joplin, který se aktualizuje při otevření poznámky, takže to není tikající čítač.

## Co si bereme / nebereme (návrh)
- **Bereme:**
  - Prosté dny s desetinou pro cycle time, lead time a průměry (Featureban, ActionableAgile).
  - Týdny jako agregační jednotku: Total Time v týdnech a dnech a výnos po týdnech (getKanban billing cycle, throughput po týdnech).
  - Pracovní týden o 5 dnech jako výchozí (Jira, MS Project).
  - Jednotku jako popisek nad abstraktním číslem (Flow Engineering Game) a ji vysvětlit v tooltipu rychlosti. Žádný z nalezených produktů vysvětlení převodu času a rychlosti neposkytuje.
  - Pravidla množného čísla podle CLDR: týden jednotně jen pro přesně 1, `days` množné při zobrazené desetině (náš spec už tak počítá).
  - Rozlišení práce a trvání: u jednotky z celého týmu `Size` znamená práci jednotky v pracovních dnech (MS Project).
  - Zvážit neutrální „person-days“ (Dictionary.com uvádí zavedenou neutrální náhradu za „man-days“).
- **Nebereme:**
  - Kalendářní dny a započítání dne zahájení (+1). Naše simulace má spojitý čas a počítá jen pracovní dny. Businessmapův argument zákazníka patří k vědomým rozhodnutím a patří do Out of Scope.
  - Nastavitelnou délku týdne a dne (Jira, MS Project). Týden je pevně 5 dnů. Nastavitelnost lze přidat později.
  - Hodinové jednotky, vylučování víkendů a svátků na boardu, zkratky typu `2w 4d`. Pro workshop dáváme přednost plným slovům.
  - Skrývání délky kola (Pizza Game), převod ideálních dnů na kalendářní přes velocity.
  - Vynechání nulových dnů (výchozí chování Intl): náš čítač ukazuje dny vždy, aby neměnil tvar.

## Otevřené otázky
- Neexistuje (v dohledaných zdrojích) produkt s živě tikajícím čítačem ve formátu týdny + dny; naše řešení je tedy bez přímého vzoru.
- Nenalezen produkt, který by vysvětloval převod rychlosti běhu simulace na pracovní dny.
- Nenalezeno, jak jiné nástroje popisují velikost úkolu pro celý tým jako jednu jednotku.
- Neověřené položky (Cohn, Jira Pretty, simulace Businessmapu s pracovními dny, Linear, Apple DateComponentsFormatter) by pro rozhodnutí o specu neměly být podkladem.
- K rozhodnutí uživatele, ne k domněnkám: (a) „man-days“ vs. „person-days“; (b) zda někdy přidat konvenci +1 pro celodenní data, nebo zůstat u spojitého času; (c) potvrdit pracovní dny bez víkendů jako vědomou odchylku od nástrojů počítajících kalendářně. **Rozhodnuto 2026-11-04:** (a) „man-days“, (b) konvence +1 se nepřidává a (c) pracovní dny jsou potvrzeny jako vědomá odchylka; (b) i (c) a nastavitelný týden jsou zapsané v Out of Scope specu.
