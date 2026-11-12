# Research: Týmy složené z lidí (feat-028)

## Výzkumná otázka
Jak koučovské simulace, simulátory toku práce a nástroje pro org design modelují organizaci jako **několik týmů složených z lidí** a jak v nich uživatel mění, **kdo smí na čem pracovat** (mandáty), aby viděl dopad na výsledky?

Pracovní výklad pro tuto rešerši: **skill** = co člověk umí, **mandát** = co člověk nebo tým smí dělat (na čem smí pracovat, jestli smí pomáhat mimo svůj tým). Přesnou definici mandátu pro simulátor research neurčuje. Je v otevřených otázkách na konci.

## Metoda
- **Datum:** 2026-11-10
- **Kategorie produktů:**
  1. koučovské simulace a hry o struktuře týmů,
  2. softwarové simulátory, které modelují lidi v týmech,
  3. nástroje pro org design a záznam mandátů,
  4. UX vzory pro úpravu struktury týmy → lidé.
- **Postup:** čtyři paralelní rešerše veřejných webů, jedna na kategorii. Do nálezů je vybráno 8 produktů. Dalších 8 prověřených je stručně v sekci „Další prověřené“.
- **Omezení:**
  - **PDF jsme neotevírali:** pravidla getKanban v5, průvodce Team Shapes, materiály na less.works. Mechaniky těchto her známe jen z veřejných popisů.
  - **Nedostupné:**
    - plné texty článků o VDT (paywall Springer, INFORMS),
    - web Orgvue (HTTP 403),
    - článek na Medium o „Cross-team Dependency Game“ (403),
    - články T. Magennise na Observable (429),
    - kanbanboardgame.com (vyžaduje přihlášení).
  - **TeamForm:** stránky dokumentace v Confluence se nevykreslily. Údaje o alokacích pocházejí z textu indexovaného vyhledávačem.
  - **Businessmap:** znalostní báze vrací 403. Článek jsme četli přes její veřejné API (stejný text).
  - **Runn:** část článků nápovědy vrací 404.
  - **SimVision:** nevíme, jestli se dnes prodává, ani jak vypadá jeho UI.
  - **Mimo rozsah:** empirické důkazy o koordinačních nákladech tu nejsou, jsou v [`docs/coordination-costs-research.md`](coordination-costs-research.md).

## Nálezy

### 1. Koučovské hry

#### Hry „component teams vs. feature teams“ z komunity LeSS
- **Zdroj (přístup 2026-11-10):**
  - https://less.works/blog/2024/12/15/less-simulation-create-a-city-guide
  - https://www.scrum.org/node/36548
  - https://blog.crisp.se/2017/02/21/fredriklindgren/team-shapes-simulation
  - https://less.works/conferenza/sessions/2018-less-conference-new-york-building-agile-structures-85
- **Jak to řeší:** Rodina workshopových her. Organizaci tvoří několik týmů po 4–5 lidech a každý člověk má skilly. V LeSS City Guide si je vybírá jako barevné tečky na jmenovku ze 4 možných. Týmy si sestavují sami účastníci, celá organizace má jeden backlog.
  - **Mandát se mění pravidlem mezi koly**, ostatní podmínky zůstávají stejné. Hra s fotorámečky:
    - 1. kolo: tři komponentové týmy, integrovat smí jen jeden z nich,
    - 2. kolo: stejné týmy, každý dělá celý výrobek a smí sdílet materiál.
  - **Building Agile Structures** porovnává tři struktury: funkční týmy, cross-funkční týmy z jednorolových specialistů a cross-funkční týmy z lidí s více skilly.
  - **Měření:** počet hotových integrovaných kusů, ne lead time.
- **Co je relevantní pro nás:**
  - struktura týmy → lidé se skilly,
  - mandát jako pravidlo „kdo smí co“ (integrovat, sahat na materiál), které facilitátor mění mezi koly,
  - Building Agile Structures rozlišuje skill a strukturu, což odpovídá naší dvojici skill × mandát.
- **Co je nejasné:** jak hry pracují s kapacitou. Mechaniky Team Shapes a Building Agile Structures jsou veřejně jen v anotacích.

#### getKanban (Russell Healy)
- **Zdroj (přístup 2026-11-10):**
  - https://getkanban.com/pages/about-the-game
  - https://www.infoq.com/fr/news/2015/07/sortie-getkanban-v5
  - https://yeret-agility-site.pages.dev/how-i-would-simulate-time-boxed-agile-in-the-getkanban-kanban-board-game
  - https://www.slideshare.net/slideshow/hacking-getkanban-v20-advanced-game-mechanics-to-illuminate-lean-by-cheryl-hammond/72721980
- **Jak to řeší:** Desková hra pro jeden tým 4–6 hráčů.
  - Lidé jsou kostky, barva kostky je specializace (analytik, vývojář, tester). Kapacita je hod kostkou.
  - Tým každý den rozhoduje, do kterého sloupce dá kterou kostku.
  - Práce mimo specializaci je dovolená, ale penalizovaná: ve verzi 5 se výsledek dělí dvěma.
  - Facilitátorská varianta „Evil Carlos“ zakazuje přesunout kapacitu na úzké hrdlo.
  - Po každém dni se aktualizuje CFD, run chart, rozdělení lead time a finanční report. Lead time určuje výnos.
- **Co je relevantní pro nás:**
  - člověk = kapacita se skillem,
  - postih za práci mimo skill je jeden srozumitelný parametr,
  - zákaz přesunu kapacity je mandát, který zavádí facilitátor,
  - napojení lead time na výnos je blízké našemu Cash Flow módu.
- **Co je nejasné:** oficiální pravidla v5 (v PDF, neotevřeno). Hra má jen jeden tým, vrstva týmů chybí.

### 2. Softwarové simulátory

#### Virtual Design Team (Stanford) / SimVision
- **Zdroj (přístup 2026-11-10):**
  - text patentu US 7 483 841: https://trea.com/information/project-management-system-and-method/patentgrant/2d2a4eaa-4b59-4e41-9fb1-7d36bf9bbaaa
  - případová studie NASA, 2008: https://www.slideshare.net/slideshow/vincebilardo/13728247
  - https://purl.stanford.edu/zv021dk0355
  - https://www.jorgdesign.net/article/view/6345
  - https://www.computerworld.com/article/1356661/modeling-software-designed-to-cut-project-time-and-cost.html
- **Jak to řeší:** Agentní simulace projektové organizace.
  - **Pozice:** základní jednotka s 1..n FTE. Může představovat člověka i skupinu.
  - **Struktura:** pozice spojují vazby podřízenosti (projektový manažer, vedoucí podtýmu, člen podtýmu). Model zvládne maticovou organizaci i program z více projektů.
  - **Skill:** pozice má skill a jeho úroveň. Když skill neodpovídá úkolu, práce se zpomalí a roste pravděpodobnost chyby.
  - **Odpovědnost:** každý úkol má jednu odpovědnou pozici, ale přidělit k němu lze člověka z kteréhokoli oddělení.
  - **Rozhodovací pravomoc** je samostatný parametr:
    - výjimky jdou k projektovému nebo funkčnímu manažerovi,
    - míra centralizace (vysoká / střední / nízká) určuje, kdo rozhoduje,
    - když rozhodnutí nepřijde včas, deleguje se.
  - **Výstupy:**
    - Gantt,
    - rozpad času na přímou práci, přepracování, koordinaci a čekání na rozhodnutí,
    - backlog jednotlivých lidí v čase,
    - průměry z opakovaných běhů.
  - **Srovnání scénářů:** případová studie NASA porovnávala centralizované a distribuované rozhodování podle data dodání.
- **Co je relevantní pro nás:** Je to jediný nalezený nástroj, který odděluje tři věci: co pozice umí (skill), za co odpovídá (přidělení úkolu) a kdo smí rozhodovat (centralizace, eskalace). Čekání na rozhodnutí vykazuje jako samostatnou složku času.
- **Co je nejasné:** jestli se dnes prodává, jak vypadá UI a konkrétní hodnoty matic chování (patent je neuvádí).

#### Businessmap (dříve Kanbanize) – Kanban Flow Simulator
- **Zdroj (přístup 2026-11-10):**
  - https://businessmap.io/kanban-simulation/
  - https://knowledgebase.businessmap.io/hc/en-us/articles/4524939368338-The-Kanban-Flow-Simulation (čteno přes veřejné API znalostní báze)
- **Jak to řeší:** Tým je tabulka rolí s počtem lidí.
  - Každá role má produktivitu v % zvlášť pro každý sloupec procesu. Hodnota 0 % znamená, že role v daném sloupci pracovat nemůže.
  - Nastavuje se maximální WIP na osobu, maximální počet lidí na jedné kartě (swarming) a čas rozjezdu.
  - Za běhu ukazuje dashboard s cycle time, throughput, WIP a forecastingem.
  - Modeluje jen jeden tým. Porovnání běhů dokumentace nezmiňuje.
- **Co je relevantní pro nás:** nejjednodušší zápis mandátu, matice role × sloupec, kde 0 znamená „nesmí“. Limit lidí na kartě jako samostatný parametr.
- **Co je nejasné:** jak si volný člověk vybírá mezi sloupci, jaká je cena a jestli je nutné přihlášení.

### 3. Org design a mandáty

#### TeamForm (+ artefakty Team Topologies)
- **Zdroj (přístup 2026-11-10):**
  - https://www.teamform.co/
  - https://teamtopologies.com/success-toolkit-partners/teamform
  - https://teamform.atlassian.net/wiki/spaces/OS/pages/2777776406/TeamForm+Glossary+of+Terminology
  - https://teamform.atlassian.net/wiki/spaces/OS/pages/2777776340/How+can+someone+be+over-allocated
  - https://github.com/TeamTopologies/Team-API-template
- **Jak to řeší:**
  - **Členství je maticové.** Člověk patří do právě jednoho „supply“ týmu (linie, chapter). Zároveň může pracovat v několika „demand“ týmech s vahou v FTE. Když součet překročí jeho FTE, dostane štítek přetížení.
  - **Typy týmů a odpovědnosti** si firma pojmenuje sama. Způsoby spolupráce jsou podle Team Topologies.
  - **Reorganizaci** jde namodelovat před potvrzením. Výstupem jsou strukturální a nákladové metriky: headcount, počet úrovní řízení, náklady.
  - **Šablona Team API** zapisuje:
    - typ týmu výčtem ze 4 hodnot,
    - co tým vlastní, volným textem,
    - spolupráci s jinými týmy jako tabulku s módem (Collaboration / X-as-a-Service / Facilitating).
  - Rozhodovací práva šablona nemá.
- **Co je relevantní pro nás:**
  - domovský tým a práce v jiných týmech jako dvě vrstvy členství, vzor pro mandát „smí pomáhat mimo svůj tým“,
  - mód spolupráce mezi dvojicí týmů jako vzor výčtového typu.
- **Co je nejasné:** jak vypadá UI srovnání scénářů. Metriky toku práce nástroj nemá.

#### GlassFrog (Holacracy)
- **Zdroj (přístup 2026-11-10):**
  - https://glassfrog.com/product
  - https://support.glassfrog.com/how-do-i-add-one-role-to-multiple-circles-v5-premium
  - https://www.holacracy.org/blog/holacracy-basics-understanding-domains/
  - https://support.glassfrog.com/glassfrog-premium-features
- **Jak to řeší:**
  - **Struktura:** kruhy a role. Jeden člověk může zastávat víc rolí a jednu roli může zastávat víc lidí.
  - **Role** má účel, odpovědnosti (volný text) a domény.
  - **Doména** je věc pod výlučnou kontrolou role nebo kruhu. Ostatní do ní smí zasáhnout jen se svolením.
  - **Změny struktury** dělá admin přímo, nebo přes návrh na governance meetingu.
  - Režim scénářů ani srovnání jsme nenašli. Strukturu ukazuje kruhový org chart.
- **Co je relevantní pro nás:**
  - jasné oddělení mandátu (role) od člověka,
  - doména jako výlučné vlastnictví, kterým jde modelovat oblast produktu,
  - pravidlo „zasáhnout jen se svolením“ je hotové chování pro práci mimo vlastní mandát.
- **Co je nejasné:** formát „focus“ při přiřazení člověka k roli. Jestli existuje režim scénářů.

#### Delegation Board / Delegation Poker (Management 3.0)
- **Zdroj (přístup 2026-11-10):**
  - https://management30.com/practice/delegation-poker/
  - https://management30.com/blog/delegation-boards-at-management-30/
- **Jak to řeší:**
  - **Mřížka:** řádky jsou rozhodovací oblasti, sloupce 7 úrovní delegace. Úrovně jdou od „rozhoduje vedoucí“ (Tell) po „tým má plnou pravomoc“ (Delegate).
  - **Úroveň patří oblasti**, ne člověku.
  - **Úroveň se mění** hrou Delegation Poker: tajný výběr karty 1–7 a diskuse krajních voleb. Board se má pravidelně revidovat.
  - **Číselný práh:** mandát ho může mít, například měsíční rozpočet týmu nebo velikost týmu 3–9 lidí.
  - Existují jen šablony a karty, žádný software.
- **Co je relevantní pro nás:** pořadová škála místo ano/ne a slovník, který koučové znají. Úrovně ale popisují, kdo rozhoduje, ne kdo práci dělá. Převod na pravidla simulace by bylo nutné navrhnout.
- **Co je nejasné:** oficiální převod úrovní delegace na pravidla provádění práce neexistuje.

### 4. UX úprav týmů a lidí

#### Runn
- **Zdroj (přístup 2026-11-10):**
  - https://help.runn.io/en/articles/4293043-people-planner-overview
  - https://help.runn.io/en/articles/5521224-group-utilization-charts
  - https://intercom.help/runn/en/articles/3799861-teams
  - https://www.runn.io/blog/all-hail-runns-newest-feature-skills-and-levels
  - https://help.runn.io/en/articles/9829064-projects-access
- **Jak to řeší:**
  - **Plánovač lidí:** řádky lidí seskupené přes „Group By“. Výchozí je tým, dále role, skilly, tagy, projekty.
  - **Souhrn týmu:** rozbalený tým ukazuje souhrn dostupnosti, heatmapa barvou ukazuje volno a přetížení. Graf vytížení skupiny = součet plánovaných hodin / součet kapacity.
  - **Přesun mezi týmy:** člověk je vždy v jednom týmu a přesouvá se rozbalovacím polem.
  - **Skilly:** na osobě bez omezení počtu, s volitelnou úrovní 1–4, s filtrem podle skillu.
  - **Projekty:** projekt má jeden primární tým, ale přiřadit se na něj dá kdokoli z jakéhokoli týmu. Příslušnost k týmu a právo pracovat na projektu jsou tedy oddělené. Omezení existuje jen pro oprávnění uživatelů aplikace.
- **Co je relevantní pro nás:**
  - tým jako rozbalitelná skupina se souhrnnou lištou,
  - přepínač pohledu podle týmu nebo podle skillu,
  - oddělení „kam patřím“ od „na čem smím pracovat“.
- **Co je nejasné:** jak se kombinují filtry skillů (příslušné články vracejí 404). Drag & drop přiřazení dokumentace nezmiňuje.

### Další prověřené (stručně)
- **X-team Silos Game (Crisp, 2016):**
  - čtyři hráči, každý má jeden skill (jednu barvu Lego kostek),
  - ve 2. iteraci si rozdají po dvou kostkách, takže smí omezeně pracovat mimo svůj skill,
  - metrika „vynechaný tah“ měří nečinnost.
  - Zdroj: https://blog.crisp.se/2016/08/27/miakolmodin/x-team-silos-game-getting-in-tshape
- **Featureban:** pravidlo pomoci „nejdřív vlastní položky, pak smíš pomoci s cizími“. Jeden tým, bez skillů. Zdroj: https://oyomy.fr/en/?p=9436
- **Okaloa Flowlab:** prodává doplněk „Multi-team set“, jeho mechanika není veřejně popsaná. Zdroj: https://www.okaloa.com/physical-material
- **explaining-flow (Michel Grootjans, open source):**
  - jednotlivci se skilly zapsanými textem (např. `qa+dev`), každý drží jen jednu položku,
  - práci vybírá pravidlem „zprava doleva, nejschopnější pracovník“,
  - má 11 předpřipravených scénářů v řadě,
  - týmy ani mandáty nemá, mandát splývá se skillem.
  - Zdroj: https://github.com/michelgrootjans/explaining-flow
- **Focused Objective KanbanSim / ScrumSim:** modeluje sloupce a třídy služeb, ne jednotlivé lidi ani týmy. Zdroj: https://www.focusedobjective.com/kanban-scrum-sim
- **Jira Plans:**
  - tým je položka s avatary členů a jedním číslem kapacity,
  - individuální kapacitu a „stages & skills“ Atlassian zrušil kvůli nízkému využití a pracnosti zadávání,
  - plán je pískoviště, které se do Jiry zapíše až po potvrzení.
  - Zdroje: https://support.atlassian.com/jira-software-cloud/docs/what-are-teams-in-advanced-roadmaps, https://confluence.atlassian.com/jiraportfolioserver/future-releases-and-limitations-953663163.html
- **BigPicture (Appfire):**
  - kapacita týmu je součet kapacit členů vážených procentem dostupnosti,
  - skilly člena jsou vidět jako iniciály pod jménem,
  - data jde seskupit Skills → Individuals.
  - Zdroje: https://appfire.atlassian.net/wiki/spaces/DLP/pages/298224554, https://appfire.atlassian.net/wiki/spaces/DLP/pages/297603427
- **Orgvue:** nedostupné (403). Funkci srovnání „as-is / to-be“ jsme ověřit nemohli.

## Vzory napříč produkty
- **Organizaci z více týmů lidí spolu s metrikami toku jsme v jednom nástroji nenašli.** Výjimkou je SimVision, který ale měří trvání projektu, ne cycle time jednotlivých položek. Ostatní mají vždy jen jednu z těch dvou věcí:
  - vícetýmové koučovské hry měří hotové kusy,
  - hry s lead time (getKanban, Featureban) mají jeden tým,
  - flow simulátory mají jeden tým, nebo vůbec nemodelují lidi,
  - org-design nástroje počítají strukturu a náklady.
- **Skill a mandát většina nástrojů slučuje.** Flow simulátory vyjadřují „nesmí“ jako chybějící skill nebo 0 % produktivity. Odděleně je drží jen:
  - SimVision: schopnost, odpovědnost a rozhodovací pravomoc,
  - org-design nástroje: v GlassFrogu role ≠ člověk, v Runnu příslušnost k týmu ≠ právo pracovat na projektu.
- **Mandát se zapisuje třemi způsoby:**
  - ano/ne nebo % v matici (Businessmap: role × sloupec),
  - pořadová škála (Delegation Board: 7 úrovní, SimVision: centralizace vysoká/střední/nízká),
  - výlučné vlastnictví pojmenované věci (doména v GlassFrogu, „co tým vlastní“ v Team API, primární tým v Runnu).
- **Pro práci mimo mandát se objevují tři pravidla:** zákaz, svolení vlastníka (GlassFrog), nebo penalizace (getKanban: výsledek děleno dvěma).
- **Člověk a tým:** člověk má obvykle jeden domovský tým (TeamForm, Runn) a práce jinde je další vrstva, někdy s váhou (FTE, %). SimVision řeší „člověk, nebo tým“ jednou entitou s 1..n FTE. Kapacita týmu je součet kapacit členů (BigPicture).
- **Změna mandátu a srovnání:**
  - hry mění jedno pravidlo mezi koly při jinak stejných podmínkách a výsledky srovnávají na společné tabuli,
  - software nastavuje mandát staticky před během a srovnává scénáře nebo opakované běhy,
  - změnu mandátu za běhu jsme nenašli u žádného nástroje.
- **UX:**
  - tým jako rozbalitelná skupina, jejíž souhrnná lišta je vidět i ve sbaleném stavu (Runn, BigPicture, Jira),
  - přepínač „seskupit podle týmu / podle skillu“ místo dalších obrazovek,
  - skilly jako barevné tečky nebo iniciály,
  - přesun člověka mezi týmy přes rozbalovací pole, ne přetažením,
  - Jira zrušila skilly na osobách kvůli pracnosti zadávání.
- **Pravidla výběru práce jsou výslovná a jednoduchá:** FIFO; „zprava doleva, nejschopnější pracovník“; priorita / FIFO / LIFO / náhoda.

## Co si bereme / nebereme (návrh)
Jde o návrh k diskusi u otázek na UI a příklady chování. Nic z toho zatím není rozhodnuté a nic nemění scope bez souhlasu.

**Bereme (návrh):**
- Oddělit skill (umí) a mandát (smí) jako dvě různé vlastnosti. Dnešní model je slučuje stejně jako flow simulátory.
- Mandát jako vlastnictví pojmenované oblasti: tým má mandát na oblast(i) produktu a featura nese svoji oblast (doména v GlassFrogu, Team API).
- Jedno výslovné pravidlo pro práci mimo mandát. Na výběr: zákaz, svolení se zpožděním, nebo penalizace (GlassFrog, getKanban).
- Každý člověk má jeden domovský tým a kapacita týmu je součet jeho lidí (TeamForm, Runn, BigPicture).
- Tým jako karta nebo rozbalitelná skupina lidí se souhrnem. Skilly lidí jako barevné tečky v barvách skillů, které aplikace už používá.
- Experiment ve stylu her: stejný backlog i stejní lidé, změní se jen mandát a výsledky jsou vidět vedle sebe.
- Jednoduché a vysvětlitelné pravidlo, jak si člověk vybírá práci.

**Nebereme (návrh):**
- Částečné alokace (FTE, % dostupnosti) a člověka ve více týmech najednou. Na workshop je to zbytečně složité.
- Governance procesy (návrhy, poker, schvalování). V simulátoru stačí přímé nastavení.
- Strukturální a nákladové metriky (headcount, počet úrovní řízení).
- Pravděpodobnostní matice rozhodování ze SimVision (centralizace, eskalace) v první verzi.
- Ruční matici osoba × oblast jako hlavní ovládání. Hrozí stejná pracnost, kvůli které Jira zrušila skilly na osobách.

## Otevřené otázky
- **Co přesně je mandát v simulaci?** Možnosti:
  - (a) oblast produktu, na které tým smí pracovat,
  - (b) skill, ve kterém člověk smí pracovat, i když ho umí,
  - (c) rozhodovací pravomoc: bez mandátu se čeká na rozhodnutí, jako v SimVision.
- **Komu se mandát nastavuje?** Týmu, člověku, nebo obojí (člověk dědí mandát týmu a má výjimky)?
- **Co se stane s prací, na kterou nikdo nemá mandát?** Zůstane stát, čeká na svolení, nebo ji někdo udělá s penalizací?
- **Jak se mód napojí na koordinační režii z feat-016?** Liší se připojení člověka ze stejného týmu a připojení člověka z jiného týmu? Rešerše [`coordination-costs-research.md`](coordination-costs-research.md) popisuje efekt, který jde přes počet lidí.
- **Jak se mandát mění a výsledky srovnávají?** Před během se srovnáním dvou variant (jako v Compare), nebo i za běhu? Za běhu to nedělá žádný z nalezených nástrojů.
- **Jak velký má být výchozí scénář?** Kolik týmů a lidí, aby zůstal na workshopu čitelný?
