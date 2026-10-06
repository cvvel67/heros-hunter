// ==UserScript==
// @name         Heros Hunter
// @namespace    https://github.com/cvvel67/heros-hunter
// @version      3.3
// @description  Obchodzi respy wybranego herosa, pinguje Discord po znalezieniu
// @updateURL    https://raw.githubusercontent.com/cvvel67/heros-hunter/main/heros-hunter.user.js
// @downloadURL  https://raw.githubusercontent.com/cvvel67/heros-hunter/main/heros-hunter.user.js
// @match        https://margonem.pl/*
// @match        https://*.margonem.pl/*
// @match        http://margonem.pl/*
// @match        http://*.margonem.pl/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==
(function () {
  'use strict';

  /* =====================================================================
   *  1. CONFIG
   * =================================================================== */

  const CONFIG = {
    HOME: { id: 1, name: 'Ithan' },

    // Ile minut czekać po killu. Nadpisuje się wartością z okna "Minutnik",
    // gdy bot faktycznie kogoś zabije i panel się wypełni.
    RESPAWN_MIN: 120,

    // Po odswiezeniu strony bot wznawia prace sam, jesli przed
    // odswiezeniem byl zatrzymany na pozostawionym stanie (GO, SCAN,
    // FOUND, FIGHT, WAIT, HOME). Wczesniej odtwarzal sie tylko NAPIS
    // na badge - petla nie startowala, wiec bot wygladal na działający,
    // a stał i nie dało się go włączyć inaczej niż Stop + Start.
    // false = po odswieżeniu zawsze czeka na kliknięcie Start.
    AUTO_RESUME: true,

    // Koniec pracy na jednym punkcie respu (ms). Przechodzimy przez niego,
    // nie stoimy - ale dystanse bywają 40 kafelkow, więc limit musi być realny.
    POINT_LIMIT_MS: 60000,

    // Odstęp między wywołaniami autoGoTo. autoGoTo ignoruje wywołania
    // w trakcie animacji kafelka, więc pytamy raz na jakiś czas.
    GO_EVERY_MS: 2500,

    // Webhook Discord. Wpisany na test 03.10.
    // UWAGA: ten adres był ujawniony w rozmowie - po testach zrotuj go
    // w Discordzie (Ustawienia kanału → Integracje → Webhooks → Nowy).
    // Pusty = adres wpisujesz w panelu (ikona discord).
    // Swiadomie pusty: wpisany tu adres byl ujawniony w rozmowie,
    // a martwy adres w CONFIG jest cichym pulapka - skrypt wraca
    // do niego, gdy pole w panelu jest puste, i Discorda zwraca 404.
    WEBHOOK: '',
    WEBHOOK_COLOR: 0x8b5cf6,

    // Odstęp między uderzeniami w walkę (ms).
    ATTACK_EVERY_MS: 2000,

    // Ile minut od nowa liczy się po komendzie "czekaj!" z czatu.
    ATAK_OD_NOWA_MIN: 5,

    // ZWOJE PRZYWOŁANIA
    //
    // Stary, prosty sposób - wpisujesz item-tpl ręcznie:
    //   SCROLLS: { przewodnik: 22255 }
    //
    // Ale item-tpl to numer wewnętrzny gry. Łatwo pomylić się, a przy 4-6
    // herosach wpisywanie sześciu numerów jest proszeniem się o kłopot.
    //
    // Dlatego jest LEPSZY sposób: skrypt uczy się sam.
    //   1. Wpisz w CONFIG.HEROES nazwę zworu przy herosie (pole `zwój`).
    //   2. To wszystko. Skrypt sam znajdzie zwój w ekwipunku po nazwie
    //      i zapamięta jego item-tpl na przyszłość.
    //
    // Jak to działa: nazwy przedmiotu nie ma w DOM slotu (ikona jest
    // rysowana na <canvas>), ale gra trzyma kompletne podpowiedzi
    // w `TIPS.allTips`, indeksowane atrybutem `tip-id`, który każdy slot
    // ekwipunku ma. Skrypt czyta z nich nazwy i dopasowuje do pola
    // `zwój` niżej. Skan co 20 s + po każdym przeładowaniu gry.
    //
    // Jedyne ograniczenie: slot musi istnieć w DOM. Zwój w ZAMKNIĘTYM
    // worku nie ma slota, więc pozostaje nierozpoznany, dopóki ktoś
    // go nie otworzy.
    //
    // Które zwój jest który: nazwa w grze to np.
    //   "Zwój przywołania drużyny na herosa Zły Przewodnik"
    //
    // Zwoje SĄ PRZYPISANE DO HEROSA - opis przedmiotu mówi wprost:
    // "Działa tylko w wybranych lokacjach. Użycie przedmiotu możliwe jest
    //  w lokacji, w której pojawia się heros." Czyli zwój jednego herosa
    //  nie zadziała przy innym.

    // Awaryjnie: item-tpl wpisane z ręki. Gdy jest znane, ma pierwszeństwo
    // przed tym zapamiętanym. Zostaw puste, jeśli nie znasz numeru.
    SCROLLS: {
      przewodnik: 22255,
    },

    // ---------------------------------------------------------------
    // HEROSOWIE
    //
    // Każdy heros ma własną trasę, własny zwój i własne zachowanie.
    // Wybór herosa jest ręczny - klikasz na liście w panelu gry.
    //
    //   key         - unikalny identyfikator (małe litery, bez spacji)
    //   nazwa       - nick w grze; dopasowanie normalizuje tekst, więc
    //                 "Zły Przewodnik (63w)" pasuje do "Zły Przewodnik"
    //   zwój        - NAZWA przedmiotu w grze, dokładnie taka jak widać
    //                 w podpowiedzi po najechaniu myszką. Skrypt sam
    //                 znajduje zwój w ekwipunku po tej nazwie, więc nie
    //                 musisz nigdzie wpisywać numerów.
    //                 Puste = brak zwoju, "przywo!" nie zadziała.
    //   img         - adres obrazka herosa, pokazywany na liście wyboru
    //                 i przy nazwie w nagłówku panelu. Puste = kropka.
    //                 Zwykły <img>, więc wystarczy GIF/JPG/PNG z sieci:
    //                   https://micc.garmory-cdn.cloud/obrazki/npc/her/mnich-zly2.gif
    //   atakPoMin   - ile minut stoi obok czekając na klan, zanim sam
    //                 zaatakuje. 0 = nie atakuje, tylko czeka.
    //   maxWalkaMin - USUNIETE 03.10. Bot bije az do konca, nie odpuszcza.
    //   idleMin     - USUNIETE 03.10. Bot nie przeskakuje sam na innego
    //                 herosa - wybierasz jednego i szuka az go znajdzie.
    //
    // route: kroki trasy, w kolejności obchodzenia
    //   { id: 38, spawns: [{x:13,y:26}, ...] }  - punkty do obejścia
    //   { id: 815, pass: true }                 - tylko przejście
    // ---------------------------------------------------------------
    HEROES: [
      // ── HEROS NR 1 ──
      // Wpisany 04.10 na zadanie: ma byc nad Zlym Przewodnikiem.
      // Kolejnosc na liscie i numer przy komendzie "heros N" wynikaja
      // z ORDER, nie z kolejnosci obiektow w HEROES. Ten sam wpis jest
      // w ORDER na pierwszym miejscu, a obiekt tutaj - zeby czytajacy
      // plik od gory widzial ta sama kolejnosc.
      //
      // Spawny prawdziwe (margoworld.pl/npc/view/40601, stan 05.03.2023),
      // 24 mapy. Zmierzone BFS-em od Ithan (ten sam algorytm co _verify.js):
      // **wszystkie 24 sa poza CONFIG.GATEWAYS**, wiec zaden spawn nie
      // jest osiagalny. Trzeba najpierw dopisac do grafu caly rejon
      // Edera wraz z wnetrzami - to osobna robota, wieksza niz przy
      // dwoch pozostalych nowych herosach.
      //
      // Uwaga na moj blad z 04.10: najpierw policzylem "mapy w grafie"
      // przez `new Set(blok.match(/\d+/g))` i wyszlo 70, w tym Eder (33)
      // i Siedziba Kultystow (43). To byl fałszywy trafienie - ten
      // regex lapie takze wspolrzedne i numery wersji. Poprawny wynik to
      // 18 map. Nie ufaj liczbie z regexa na calym obiekcie.
      {
        key: 'zlodziej',
        nazwa: 'Złodziej',
        zwój: 'Zwój przywołania drużyny na herosa Złodziej',
        img: 'https://micc.garmory-cdn.cloud/obrazki/npc/her/zlodziej.gif',
        atakPoMin: 5,
        // route: [] - z powodu opisanego wyzej. Nie wklejam spawnow,
        // bo powstalaby trasa widoczna w panelu, a nieprzechodzaca.
        // Pozycje ponizej to dane zrodlowe do przepisania w route po
        // uzupelnieniu grafu.
        //
        //   Eder (33) - bez spawnow na samej mapie, tylko wnetrza:
        //    162 Dom Erniego                       (6,7)
        //   2010 Dom Erniego p.1                   (6,5)
        //    157 Dom Artenii i Tafina               (5,5)
        //   2011 Dom Artenii i Tafina - piwnica     (11,12)
        //   2016 Dom Etrefana - pracownia          (6,12)
        //   2018 Dom Etrefana p.2                  (5,6)
        //    221 Dom Mrocznego Zgrzyta             (10,5)
        //   2341 Dom Mikliniosa p.1                (9,5)
        //   2342 Dom Mikliniosa - przyziemie       (8,10)
        //   2349 Pracownia Bonifacego p.1          (5,6)
        //    43 Siedziba Kultystow                 (11,11)
        //   Fort Eder (244):
        //   244  Fort Eder                         (59,60)
        //    247  Fortyfikacja                     (7,17)
        //    249  Fortyfikacja p.2                 (10,4)
        //    251  Fortyfikacja p.4                 (11,14)
        //    252  Fortyfikacja p.5                 (10,10)
        //   2350 Ciemnica Szubrawcow p.1 - sala 1  (8,14)
        //   2351 Ciemnica Szubrawcow p.1 - sala 2  (13,5)
        //   2352 Ciemnica Szubrawcow p.1 - sala 3  (45,12) (51,53)
        //   poza miastem:
        //   2308 Stary Kupiecki Trakt   (8,8) (51,12) (55,44) (55,92)
        //   2324 Stukot Widmowych Kol   (5,5) (20,28) (23,61) (48,72)
        //   4151 Wertepy Rzezimieszkow  (12,55) (53,12) (53,51)
        //   4528 Chata szabrownikow     (6,4)
        route: [],
      },

      // ── HEROS NR 2 ──
      {
        key: 'przewodnik',
        nazwa: 'Zły Przewodnik',
        zwój: 'Zwój przywołania drużyny na herosa Zły Przewodnik',
        img: 'https://micc.garmory-cdn.cloud/obrazki/npc/her/mnich-zly2.gif',
        atakPoMin: 5,
        route: [
          { id: 8, spawns: [{ x: 6, y: 46 }] },

          { id: 38, spawns: [{ x: 13, y: 26 }, { x: 22, y: 53 }, { x: 80, y: 33 }, { x: 90, y: 9 }, { x: 92, y: 50 }] },

          { id: 814, spawns: [{ x: 13, y: 16 }] },
          { id: 815, spawns: [{ x: 25, y: 20 }, { x: 35, y: 9 }, { x: 55, y: 17 }] },
          { id: 816, spawns: [{ x: 9, y: 18 }] },
          { id: 3869, spawns: [{ x: 10, y: 16 }, { x: 22, y: 41 }, { x: 34, y: 16 }] },

          { id: 815, pass: true },
          { id: 814, pass: true },
          { id: 38, pass: true },

          {
            id: 150,
            spawns: [
              { x: 6, y: 34 }, { x: 17, y: 15 }, { x: 25, y: 24 }, { x: 26, y: 49 }, { x: 38, y: 34 },
              { x: 41, y: 5 }, { x: 47, y: 13 }, { x: 48, y: 60 }, { x: 55, y: 50 }, { x: 58, y: 41 },
              { x: 64, y: 34 }, { x: 66, y: 48 }, { x: 79, y: 22 }, { x: 86, y: 36 }, { x: 89, y: 51 },
            ],
          },

          { id: 6473, spawns: [{ x: 18, y: 12 }, { x: 19, y: 16 }] },
          { id: 6474, spawns: [{ x: 12, y: 19 }, { x: 33, y: 10 }, { x: 51, y: 17 }, { x: 52, y: 43 }] },
          { id: 6475, spawns: [{ x: 5, y: 15 }, { x: 28, y: 42 }, { x: 34, y: 13 }, { x: 34, y: 29 }, { x: 45, y: 49 }] },

          { id: 6473, pass: true },
          { id: 150, pass: true },

          { id: 176, spawns: [{ x: 20, y: 52 }, { x: 37, y: 41 }, { x: 58, y: 13 }] },
          { id: 4582, pass: true },
          { id: 4550, spawns: [{ x: 17, y: 40 }, { x: 25, y: 35 }, { x: 44, y: 56 }] },
          { id: 4262, spawns: [{ x: 13, y: 44 }, { x: 23, y: 18 }, { x: 36, y: 33 }] },
          { id: 179, pass: true },

          // w Mrocznym Przesmyku (42,34) pomijamy - wycofany z listy
          {
            id: 140,
            spawns: [
              { x: 15, y: 51 }, { x: 18, y: 7 }, { x: 30, y: 24 }, { x: 30, y: 59 }, { x: 42, y: 2 },
              { x: 42, y: 16 }, { x: 49, y: 50 }, { x: 56, y: 24 }, { x: 59, y: 54 },
            ],
          },
        ],
      },

      // ── WZÓR NA KOLEJNEGO HEROSA ──
      // Dosłownie skopiuj ten blok, zmień key/nazwa/zwój i wpisz trasę.
      // Dopisz klucz do ORDER poniżej. Nic więcej w kodzie nie trzeba tykać.
      //
      // {
      //   key: 'drugi',
      //   nazwa: 'Nazwa Herosa W Grze',
      //   zwój: 'Zwój przywołania drużyny na herosa Nazwa Herosa W Grze',
      //   img: 'https://.../obrazek.gif',   // obrazek na liscie wyboru
      //   atakPoMin: 5,             // po tylu minutach czekania bijemy sami (0 = nigdy)
      //   route: [
      //     { id: 8, spawns: [{ x: 6, y: 46 }] },
      //     { id: 38, spawns: [{ x: 13, y: 26 }] },
      //   ],
      // },

      // ── Odkryte 04.10 w ekwipunku na experimental ──
      //
      // Te dwa zwoje lezały w worku, ale nie pasowaly do zadnego herosa,
      // bo ich herosow nie bylo w CONFIG - skrypt nie ma prawa zgadywac,
      // do kogo nalezy zwój, ani wskazywac na to "najblizszego" w liscie.
      //
      // Numery item-tpl znalezione 04.10 (TIPS.allTips -> tip-id -> .item-name):
      //   tip458 -> tpl 22257, 6 szt  ->  Opętany Paladyn
      //   tip459 -> tpl 22256, 9 szt  ->  Piekielny Kościej
      // Świadomie NIE wpisane do CONFIG.SCROLLS - skrypt ma znaleźć je sam
      // po nazwie. Wpisanie numeru znosiłoby cały mechanizm i przy zmianie
      // w grze zostawiłoby zepsutą wartość na sztywno.
      //
      // ── DLACZEGO TRASA JEST PUSTA ──
      // Spawny ponizej sa prawdziwe (margoworld.pl, 04.10), ale zadna
      // z tych map NIE JEST w CONFIG.GATEWAYS. Graf przejsc ma 18 map
      // i pokrywa wylacznie okolice Zlego Przewodnika (Ithan, Uroczysko,
      // Lazurytowa Grota, Zapomniany Szlak, ...). Bez wejsc w grafie bot
      // nie ma jak dojechac, wiec route zostaje [] i Start blokuje sie
      // czytelnym komunikatem. Wpisanie samych spawnow daloby trase, ktora
      // wyglada poprawnie i nie dziala - to gorsze niz brak.
      //
      // Do zrobienia: dopisac te obszary do CONFIG.GATEWAYS (potrzebne
      // realne przejscia od Ithan, sprawdzone w grze), potem przepisac
      // spawny z nizej do route. Graf i spawny musza isc razem.
      {
        key: 'opetany-paladyn',
        nazwa: 'Opętany Paladyn',
        zwój: 'Zwój przywołania drużyny na herosa Opętany Paladyn',
        img: 'https://micc.garmory-cdn.cloud/obrazki/npc/her/opetanypaladyn02.gif',
        // Slot 53 px zamiast 40 - zadane 04.10 ("daj opka na 53").
        // Sprite ma 96x128 i najwieksza tresc ze wszystkich, wiec przy
        // 40 px wychodzil najmniejszy mimo wyrownania. Dotyczy tylko
        // listy; naglowek zostaje 24 px.
        imgBox: 53,
        atakPoMin: 5,
        // margoworld.pl/npc/view/17494 (stan 05.03.2023):
        //   1387 Skaly Mroznych Spiewow  (8,48) (28,60) (43,21) (44,39)
        //   1730 Cmentarzysko Szerpow    (43,20) (46,60) (63,47) (75,55)
        //    180 Andarum Ilami          (17,40) (23,55) (26,18) (37,20)
        //   6608 Swiatynia Andarum      (12,10) (16,26) (34,10)
        //   6609 Swiatynia Andarum - zejscie lewe   (15,16)
        //   6610 Swiatynia Andarum - zejscie prawe  (7,26)
        //   6611 Swiatynia Andarum - podziemia
        //        (4,33) (11,9) (24,21) (29,9) (41,19) (47,7)
        //   6612 Swiatynia Andarum - biblioteka
        //        (12,29) (16,47) (51,7) (59,52) (61,35)
        //   6616 Swiatynia Andarum - lokum mnichow
        //        (10,17) (12,44) (31,13) (49,20) (51,52)
        //   6624 Krypty Dusz Sniegu p.1 (13,35) (15,18) (30,31) (37,18)
        //   6625 Krypty Dusz Sniegu p.2 (9,12) (12,43) (27,14) (42,29)
        //   6626 Krypty Dusz Sniegu p.3 (5,41) (8,19) (30,29)
        route: [],
      },
      {
        key: 'piekielny-kosciej',
        nazwa: 'Piekielny Kościej',
        zwój: 'Zwój przywołania drużyny na herosa Piekielny Kościej',
        img: 'https://micc.garmory-cdn.cloud/obrazki/npc/her/piekielny_kosciej.gif',
        atakPoMin: 5,
        // margoworld.pl/npc/view/19743 (stan 17.10.2023):
        //   6628 Zdradzieckie Przejscie p.1 (8,85) (9,42)
        //   6629 Zdradzieckie Przejscie p.2 (9,28) (19,6) (51,45)
        //   6634 Wylegarnia Choukkerow p.1  (23,14) (26,59)
        //   6635 Wylegarnia Choukkerow p.2  (11,20) (36,24) (54,47)
        //   6636 Wylegarnia Choukkerow p.3  (19,50) (52,42)
        //   6771 Labirynt Margorii (6,35) (29,22) (62,42) (86,26) (87,44)
        //   6772 Kopalnia Margorii (8,40) (30,92) (58,71)
        //   6773 Margoria           (10,47) (30,39) (51,39) (55,15)
        //   6775 Szyb Zdrajcow      (11,34) (32,13) (49,47)
        //   6776 Slepe Wyrobisko    (23,56) (28,24) (35,8) (54,28)
        route: [],
      },

      ],

    // Kolejność na liście w UI. Bot NIE przechodzi tu automatycznie -
    // wybierasz herosa kliknięciem albo komendą "heros 2" z czatu.
    // Kolejność decyduje tylko o tym, w jakiej kolejności są w UI
    // i którzy numer ma każdy z nich przy komendzie "heros N".
    ORDER: ['zlodziej', 'przewodnik', 'opetany-paladyn', 'piekielny-kosciej'],

    NAMES: {
      1: 'Ithan', 8: 'Zniszczone Opactwo', 38: 'Uroczysko', 150: 'Zapomniany Szlak',
      140: 'Mroczny Przesmyk', 814: 'Lazurytowa Grota p.1', 815: 'Lazurytowa Grota p.2',
      3869: 'Lazurytowa Grota p.3 - sala 1', 816: 'Lazurytowa Grota p.3 - sala 2',
      176: 'Mokra Grota p.1', 4582: 'Mokra Grota p.1 - przełaz',
      4550: 'Mokra Grota p.1 - boczny korytarz', 4262: 'Mokra Grota p.2 - korytarz',
      179: 'Mroczna Pieczara p.1 - sala 3',
      6473: 'Grota Bezszelestnych Kroków - sala 1', 6474: 'Grota Bezszelestnych Kroków - sala 2',
      6475: 'Grota Bezszelestnych Kroków - sala 3',
      // 142 brakowalo - mapa jest w GATEWAYS, wiec w UI wychodzilo "mapa 142"
      142: 'Mroczna Pieczara p.1 - sala 2',
    },

    // GATEWAYS - bramy odczytane z gry (Engine.map.gateways.getDrawableItems).
    // Format:  'id mapy': { 'id mapy docelowej': [kafelki] }
    // Bot nie musi niczego odkrywać na start - ma cały graf od razu.
    // Wspólne dla wszystkich herosów: mapa ma te same bramy niezależnie
    // od tego, po której trasie idziemy.
    // WAŻNE: 140 Mroczny Przesmyk NIE ma bramy do Ithan. Powrót idzie:
    //        140 -> 150 -> 38 -> 8 -> Ithan
    GATEWAYS: {
      1: { 8: [[42, 99]] },
      8: {
        1: [[10, 0], [11, 0], [12, 0]], 38: [[0, 38], [0, 39]], 28: [[3, 52]],
        116: [[10, 63], [11, 63]], 290: [[30, 25]], 23: [[61, 56]], 2520: [[63, 17], [63, 18]],
      },
      38: {
        8: [[95, 38], [95, 39]], 814: [[37, 6]], 150: [[53, 63], [54, 63], [55, 63]],
        138: [[22, 0], [23, 0], [24, 0]], 84: [[0, 41], [0, 42], [0, 43]], 3209: [[9, 52]],
      },
      814: { 38: [[16, 26], [17, 26]], 815: [[26, 13]] },
      815: { 814: [[18, 5]], 816: [[41, 28]], 3869: [[25, 7]] },
      816: { 815: [[13, 26]], 3869: [[17, 7]], 2729: [[7, 11]] },
      3869: { 815: [[6, 1]], 816: [[34, 43]] },
      150: {
        38: [[53, 0], [54, 0], [55, 0]], 140: [[64, 63], [65, 63], [66, 63]],
        6473: [[53, 15]], 176: [[57, 26]], 6535: [[15, 53]],
      },
      6473: { 150: [[9, 30]], 6474: [[27, 9]], 6475: [[7, 2]] },
      6474: { 6475: [[5, 11], [5, 12]], 6473: [[15, 62]] },
      6475: { 6473: [[43, 62]], 6474: [[60, 11], [60, 12]] },
      176: { 150: [[4, 60]], 4550: [[13, 18]], 4582: [[39, 11]], 177: [[52, 56]] },
      4582: { 4550: [[3, 3]], 176: [[10, 14]] },
      4550: { 4582: [[54, 40]], 4262: [[5, 52]], 176: [[12, 61]] },
      4262: { 179: [[39, 39]], 4550: [[5, 1]] },
      179: { 4262: [[17, 6]], 140: [[12, 28]], 141: [[2, 20]], 142: [[5, 2]] },
      140: {
        150: [[32, 0], [33, 0], [34, 0]], 179: [[43, 39]], 141: [[33, 46]],
        142: [[37, 24]], 122: [[63, 32]],
      },
      142: { 179: [[5, 8]], 140: [[6, 15]] },
    },
  };

  /* =====================================================================
   *  2. LOG
   * =================================================================== */

  const LOG = {
    lines: [],
    add(level, msg) {
      const e = { t: Date.now(), level: level, msg: msg };
      this.lines.push(e);
      while (this.lines.length > 60) this.lines.shift();
      UI.log(e);
      console.log('[HH] ' + msg);
    },
    info(m) { this.add('info', m); },
    ok(m) { this.add('ok', m); },
    warn(m) { this.add('warn', m); },
    err(m) { this.add('error', m); },
    cmd(m) { this.add('cmd', m); },
  };

  /* =====================================================================
   *  3. GAME - warstwa na Engine. Zero logiki gry.
   * =================================================================== */

  // Stany, ktore gra zapisuje w Engine.lock.list, a ktore NIE sa blokada
  // do rozwiazania przez gracza. Bot obsluguje je sam.
  //
  //   dead            - postac nie zyje, wracamy do Ithanu
  //   battle          - trwa walka, oddajemy ciosy
  //   change_location - przechodzenie miedzy mapami, trwa sekunde
  //
  // Bez filtrowania 'change_location' bot wstrzymywal sie na kazdym
  // przejsciu brama i prosil gracza o rozwiazanie czegos, co samo sie
  // zdejmialo (widziane 00:10:42 na mapie 815).
  const STANY_GRY = ['dead', 'battle', 'change_location'];

  const GAME = {
    ready() { return typeof window.Engine !== 'undefined' && !!Engine; },

    send(packet) {
      if (typeof window._g !== 'function') return null;
      try { return window._g(packet); } catch (e) { return null; }
    },

    // Engine istnieje takze na ekranie logowania, wiec sam nie wystarcza.
    loggedIn() {
      if (!this.ready()) return false;
      if (typeof Engine.browserToken === 'string' && Engine.browserToken.length > 3) return true;
      const d = Engine.hero && Engine.hero.d;
      return !!(d && d.id);
    },

    // Zycie nie jest w Engine.hero.d - gra trzyma je w DOM jako procent:
    //   .hero-hp-progress-bar .inner[bar-percent="100"]
    // Sprawdzone na zywo: poza walka hero.d.hp i hero.d.maxhp sa undefined,
    // a Engine.dead zostaje true po odrodzeniu i klamal.
    hpPercent() {
      if (typeof document === 'undefined') return null;
      let n = document.querySelector('.hero-hp-progress-bar .inner');
      if (n) {
        const f = parseFloat(n.getAttribute('bar-percent'));
        if (!isNaN(f)) return f;
      }
      n = document.querySelector('.hero-hp-progress-bar .value');
      if (n) {
        const f = parseFloat(String(n.textContent || '').replace('%', ''));
        if (!isNaN(f)) return f;
      }
      return null;
    },

    dead() {
      if (!this.ready()) return false;
      const p = this.hpPercent();
      if (p !== null) return p <= 0;
      const d = Engine.hero && Engine.hero.d;
      if (d && d.hp !== undefined && d.maxhp !== undefined) return d.hp <= 0;
      return Engine.dead === true;
    },

    cords() {
      if (!this.ready() || !Engine.hero) return null;
      try { return Engine.hero.getCords(); } catch (e) { return null; }
    },

    pos() {
      const c = this.cords();
      return c ? c.split(',').map(Number) : null;
    },

    // idle = postac stoi. autoGoTo NIE DZIALA gdy idle === false.
    idle() {
      if (!this.ready() || !Engine.hero || !Engine.hero.d) return false;
      return Engine.hero.rx === Engine.hero.d.x && Engine.hero.ry === Engine.hero.d.y;
    },

    walk(x, y) {
      if (!this.ready() || !Engine.hero) return false;
      try { Engine.hero.autoGoTo({ x: x, y: y }); return true; } catch (e) { return false; }
    },

    // pojedynczy kafelek - bez wyznaczania sciezki
    step(x, y) {
      if (!this.ready()) return false;
      try { Engine.stepsToSend.append({ x: x, y: y }); return true; } catch (e) { return false; }
    },

    // Wejscie przez brame. Engine.interface.clickGoGateway() robi dokladnie
    // to, co kliknie gracz na kafelku bramy - sprawdzone dziala.
    enterGateway() {
      if (!this.ready()) return false;
      try {
        const t = Engine.hero;
        const g = Engine.map.gateways.getOpenGtwAtPosition(Math.round(t.rx), Math.round(t.ry));
        if (!g) return false;
        if (Engine.interface && typeof Engine.interface.clickGoGateway === 'function') {
          Engine.interface.clickGoGateway();
          return true;
        }
        if (typeof t.getTroughGateway === 'function') { t.getTroughGateway(); return true; }
      } catch (e) { return false; }
      return false;
    },

    stopWalk() {
      try {
        if (this.ready() && Engine.hero && typeof Engine.hero.clearAutoPathOfHero === 'function') {
          Engine.hero.clearAutoPathOfHero();
          return true;
        }
      } catch (e) { /* brak */ }
      return false;
    },

    // Co blokuje postać: [] = nic.
    //
    // UWAGA: Engine.lock.list zawiera NIE TYLKO captchę. W trakcie walki
    // gra wstawia tam 'battle', a po śmierci 'dead'. To normalne stany
    // rozgrywki, NIE blokady do rozwiązania przez gracza - bot sam je
    // obsługuje (oddaje ciosy, wraca do Ithanu po śmierci).
    //
    // Bez tego rozróżnienia bot w trakcie walki logował "Gra blokuje
    // postać (battle). Rozwiąż i bot ruszy dalej." i stojal - znalezione
    // 02.10 na mapie 150.
    //
    // Wracamy tylko wtedy, gdy w locku jest coś obcego - czyli captcha.
    lockList() {
      try {
        const l = Engine.lock && Engine.lock.list;
        if (!Array.isArray(l)) return [];
        const out = [];
        for (let i = 0; i < l.length; i++) {
          const n = String(l[i]);
          if (STANY_GRY.indexOf(n) !== -1) continue;
          out.push(n);
        }
        return out;
      } catch (e) { return []; }
    },

    locked() {
      if (!this.ready()) return true;
      try {
        if (Engine.lock && typeof Engine.lock.check === 'function' && Engine.lock.check()) return true;
      } catch (e) { return true; }
      if (Engine.hero && Engine.hero.waitForDialog) return true;
      if (Engine.map && typeof Engine.map.getMoveBlock === 'function') {
        try { if (Engine.map.getMoveBlock()) return true; } catch (e) { /* ignoruj */ }
      }
      return false;
    },

    inBattle() {
      if (!this.ready() || !Engine.battle) return false;
      const b = Engine.battle;
      if (typeof b.w_amount === 'number' && b.w_amount > 0) return true;
      return b.myteam !== null && b.myteam !== undefined;
    },

    rawMap() {
      if (!this.ready() || !Engine.map || !Engine.map.d) return null;
      const d = Engine.map.d;
      const v = d.id !== undefined && d.id !== null ? d.id : d.mainid;
      const n = Number(v);
      return {
        id: (v !== undefined && v !== null && v !== '' && isFinite(n)) ? n : null,
        name: String(d.name || d.map_name || ''),
      };
    },

    mapSize() {
      if (!this.ready() || !Engine.map || !Engine.map.size) return null;
      return Engine.map.size;
    },

    inBounds(x, y) {
      const s = this.mapSize();
      if (!s) return true;
      return x >= 0 && y >= 0 && x < s.x && y < s.y;
    },

    // Bramy na biezacej mapie: [{ to, x, y, name }]
    gateways() {
      if (!this.ready() || !Engine.map || !Engine.map.gateways) return [];
      try {
        const list = Engine.map.gateways.getDrawableItems() || [];
        const out = [];
        for (let i = 0; i < list.length; i++) {
          const d = list[i].d;
          if (!d) continue;
          out.push({ to: d.id, x: d.x, y: d.y, name: (list[i].tip && list[i].tip[0]) || '' });
        }
        return out;
      } catch (e) { return []; }
    },

    townNames() {
      if (!this.ready() || !Engine.map || !Engine.map.gateways) return {};
      return Engine.map.gateways.townnames || {};
    },

    // Respy herosow na biezacej mapie. Zrodlo autorytatywne.
    heroSpawns() {
      const out = [];
      try {
        const store = Engine.heroesRespManager && Engine.heroesRespManager.test
          ? Engine.heroesRespManager.test() : {};
        for (const k of Object.keys(store || {})) {
          const d = store[k] && store[k].d ? store[k].d : store[k];
          if (d && d.x !== undefined) out.push({ x: d.x, y: d.y });
        }
      } catch (e) { /* brak */ }
      return out;
    },

    // NPC w zasiegu wzroku. check() zwraca OBIEKT, nie tablice.
    npcs() {
      if (!this.ready() || !Engine.npcs || typeof Engine.npcs.check !== 'function') return [];
      let r;
      try { r = Engine.npcs.check(); } catch (e) { return []; }
      if (!r) return [];
      if (Array.isArray(r)) return r;
      const out = [];
      const keys = Object.keys(r);
      for (let i = 0; i < keys.length; i++) {
        const v = r[keys[i]];
        if (v && typeof v === 'object') out.push(v.d ? v : { d: v });
      }
      return out;
    },

    // Okno "Minutnik" - czasy odbudowy. Puste do pierwszego killa.
    eliteTimers() {
      const out = [];
      const box = document.querySelector('.elite-timer-wnd .list');
      if (!box) return out;
      const rows = box.querySelectorAll('*');
      for (let i = 0; i < rows.length; i++) {
        const el = rows[i];
        if (el.children.length !== 0) continue;
        const txt = String(el.textContent || '').trim();
        if (!txt || txt.length > 60) continue;
        const m = txt.match(/(\d+)\s*(h|godz|min|m)/i);
        if (!m) continue;
        const godz = /h|godz/i.test(m[2]);
        out.push({ text: txt, minutes: godz ? parseInt(m[1], 10) * 60 : parseInt(m[1], 10) });
      }
      return out;
    },

    // Stan walki. w_amount > 0 = trwa walka z czymkolwiek.
    inFight() {
      if (!this.ready() || !Engine.battle) return false;
      try {
        const n = Number(Engine.battle.w_amount);
        return !isNaN(n) && n > 0;
      } catch (e) { return false; }
    },

    // Jedno uderzenie w najblizszego moba. API znalezione w grze.
    hit() {
      if (!this.ready()) return false;
      const I = Engine.interface;
      if (!I) return false;
      try {
        if (typeof I.clickAttackNearMob === 'function') { I.clickAttackNearMob(); return true; }
      } catch (e) { /* sprobuj autofight */ }
      try {
        if (typeof I.clickAutofightNearMob === 'function') { I.clickAutofightNearMob(); return true; }
      } catch (e) { return false; }
      return false;
    },

    // Wysyłka wiadomości na kanał czatu. API znalezione w grze:
    //   Engine.chatController.getChatInputWrapper()
    //     .sendMessageGhostMessageProcedure(tekst, CHANNEL)
    // Kanały dostępne są w getChatChannelsAvailable().checkAvailableProcedure.
    // Używamy w trybie ghost - wiadomość leci bez ruszania focusa inputa,
    // dzięki czemu bot nie przeszkadza w pisaniu.
    // Zwroci false gdy kanał jest niedostępny (np. brak klanu).
    sendChat(tekst, kanal) {
      if (!this.ready()) return false;
      const tresc = String(tekst || '').trim();
      if (!tresc) return false;
      try {
        const cc = Engine.chatController;
        if (!cc || typeof cc.getChatInputWrapper !== 'function') return false;
        const kanały = cc.getChatChannelsAvailable();
        // Klucz kanału jest zwykłym stringiem ('CLAN', 'GROUP') - tak go
        // oczekuje checkAvailable. Stała o$12.CHANNEL nie jest globalna,
        // więc nie da się jej odczytac z zewnątrza skryptu.
        if (kanały && typeof kanały.checkAvailable !== 'function') return false;
        if (kanały && !kanały.checkAvailable(kanal)) return false;
        const w = cc.getChatInputWrapper();
        if (!w || typeof w.sendMessageGhostMessageProcedure !== 'function') return false;
        w.sendMessageGhostMessageProcedure(tresc, kanal);
        return true;
      } catch (e) { return false; }
    },

    clanChat(tekst) { return this.sendChat(tekst, 'CLAN'); },
    groupChat(tekst) { return this.sendChat(tekst, 'GROUP'); },

    /* ---- klan: dodawanie członków do drużyny ---- */

    /* ---- zapraszanie do grupy przez menu kontekstowe ---- */

    // Nick gracza w czacie. Sprawdzone na zywo 03.10: wiadomosc ma
    //   span.guest-section  -> "[Z]" (oznaczenie, menu tylko "Kopiuj wiadomosc")
    //   span.author-section -> nick gracza, klikalny ("click-able")
    // To author-section ma menu z "Zapros do grupy".
    lastChatAuthor: function () {
      const w = [...document.querySelectorAll('.chat-CLAN-message, .chat-GROUP-message')];
      for (let i = w.length - 1; i >= 0; i--) {
        const a = w[i].querySelector('.author-section');
        if (a) return a;
      }
      return null;
    },

    // Prawy klik na nick -> menu -> klik w "Zapros do grupy".
    // Zwraca nick, ktorego zaproszenie wyslano, albo null.
    inviteFromChat() {
      try {
        const autor = this.lastChatAuthor();
        if (!autor) return null;
        const nick = String(autor.textContent || '').replace(/:\s*$/, '').trim();
        if (!nick) return null;

        const o = { bubbles: true, cancelable: true, view: window, button: 2 };
        autor.dispatchEvent(new MouseEvent('contextmenu', o));
        autor.dispatchEvent(new MouseEvent('mousedown', o));
        autor.dispatchEvent(new MouseEvent('mouseup', o));

        // Menu pojawia sie asynchronicznie - szukamy pozycji "Zapros do grupy".
        const spr = function (proby) {
          const itemy = [...document.querySelectorAll('.popup-menu.show .menu-item, .popup-menu.show *')];
          for (let i = 0; i < itemy.length; i++) {
            const t = String(itemy[i].textContent || '').trim();
            if (t === 'Zapros do grupy' || t === 'Zaproś do grupy') {
              itemy[i].click();
              return nick;
            }
          }
          if (proby > 0) { setTimeout(function () { spr(proby - 1); }, 350); }
          return null;
        };
        spr(6);
        return nick;
      } catch (e) { return null; }
    },

    // ---- zwoje przywolania: rozpoznawanie po nazwie ----

    // AWARYJNA metoda, zostawiona na wypadek, gdy nazwa w CONFIG.HEROES
    // nie pasuje do nazwy w grze. Normalnie zwoje rozpoznaje
    // skanujZwoje() niżej - czyta nazwy z TIPS.allTips i nie wymaga
    // najechania myszką.
    //
    // Uwaga historyczna: do 04.10 wydawało się, że nazwy przedmiotów nie
    // da się odczytać programowo, bo podpowiedź powstaje tylko przy
    // prawdziwym najechaniu myszką (dispatchEvent('mouseover') nie
    // tworzy tip-layer). To prawda tylko dla PODPOWIEDZI. Kompletne
    // podpowiedzi leżą też w pamięci gry, w TIPS.allTips.
    //
    // Ta metoda czyta podpowiedź pod kursorem i zapamiętuje identyfikator
    // zwoju, który właśnie tam widać.
    zwojZPodpowiedzi() {
      const tip = document.querySelector('.tip-layer [data-item-type]');
      if (!tip) return null;
      const m = /item-tpl-(\d+)/.exec(String(tip.className || ''));
      if (!m) return null;
      const el = tip.querySelector('.item-head, .item, [class*="item-tpl-"]') || tip;
      const txt = String(el.textContent || '').replace(/\s+/g, ' ').trim();
      const i = txt.indexOf('Zwój');
      let nazwa = (i >= 0 ? txt.slice(i) : txt).trim();
      // obetnij ogon po pierwszym zdaniu (po "Ilość:" itd.)
      const koniec = nazwa.search(/\s{2,}|\sIlość|\sTyp:|\sAkcja/);
      if (koniec > 10) nazwa = nazwa.slice(0, koniec);
      return { nazwa: nazwa.trim(), tpl: Number(m[1]) };
    },

    // Sprawdza podpowiedz pod kursorem i zapamiętuje, jeśli pasuje do
    // któregoś herosa. Wołasz raz na nowy zwój.
    zapamietajZwoj() {
      const z = this.zwojZPodpowiedzi();
      if (!z) return { ok: false, powod: 'brak podpowiedzi pod kursorem - najedź myszką na zwój' };
      const lista = MAPS.heroList();
      for (let i = 0; i < lista.length; i++) {
        const cfg = lista[i];
        if (!cfg.zwój) continue;
        const a = MAPS.plain(cfg.zwój);
        const b = MAPS.plain(z.nazwa);
        if (!a || !b) continue;
        if (b.indexOf(a) === -1 && a.indexOf(b) === -1) continue;
        STORE.set({ scrolls: Object.assign({}, STORE.data.scrolls, { [cfg.key]: z.tpl }) });
        LOG.ok('Zapamiętałem zwój dla ' + cfg.nazwa + ': "' + z.nazwa + '" → item-tpl-' + z.tpl);
        NOTIFY.send({
          title: 'Zwój rozpoznany',
          description: cfg.nazwa + ' → item-tpl-' + z.tpl,
          color: 0x22a06b,
        });
        return { ok: true, nazwa: z.nazwa, tpl: z.tpl, key: cfg.key };
      }
      return { ok: false, powod: 'podpowiedź nie pasuje do żadnego herosa: "' + z.nazwa + '"', nazwa: z.nazwa, tpl: z.tpl };
    },

    // Item-tpl zwoju dla herosa. Kolejność: ręczny wpis w CONFIG.SCROLLS,
    // potem to, czego skrypt się nauczył. null = nie wiadomo.
    zwojDla(cfg) {
      if (!cfg) return null;
      const reczny = CONFIG.SCROLLS ? CONFIG.SCROLLS[cfg.key] : undefined;
      if (reczny) return Number(reczny);
      const zapamietane = STORE.data.scrolls || {};
      const tpl = zapamietane[cfg.key];
      return tpl ? Number(tpl) : null;
    },

    // Liczba sztuk jest w .amount wewnatrz slotu (sprawdzone 04.10 -
    // zwykly slot ma <div class="amount">23</div>). Jak .amount nie ma,
    // przedmiotu jest 1.
    //
    // -1 = takiego przedmiotu NIE MA W EKWIPUNKU. To nie jest blad,
    // tylko informacja: zwoju nie ma, wiec "przywo!" nie zadziala.
    // Dawniej ta wartosc byla pokazywana jako zwykla liczba i czytelnik
    // nie mogl stwierdzic, czy -1 oznacza "nie ma" czy "nie wiem".
    itemAmount(tpl) {
      const el = document.querySelector('.inventory-item.item-tpl-' + Number(tpl));
      if (!el) return -1;
      const n = el.querySelector('.amount');
      if (!n) return 1;
      const f = parseInt(String(n.textContent || '').replace(/[^0-9]/g, ''), 10);
      return isNaN(f) ? 1 : f;
    },

    // Stan zwoju dla UI i dla "przywo!": { tpl, ile, wEq, powod }.
    // wEq = czy slot jest widoczny w ekwipunku. Nie wszystkie worki sa
    // otwarte naraz, wiec brak slotu nie musi znaczyc "nie masz" -
    // moze byc w innym worku. Dlatego trzymamy ostatni ZNANY licznik
    // i przy braku slotu mowimy "nie wiem", a nie "zero".
    zwojStan(cfg) {
      const tpl = this.zwojDla(cfg);
      if (!tpl) return { tpl: null, ile: null, wEq: false, powod: 'nie znam zwoju' };

      // ostatni znany stan z magazynu - przetrwa brak slotu
      const zapamietany = STORE.data.scrollStan || {};
      const zap = zapamietany[cfg.key];
      const ileTeraz = this.itemAmount(tpl);

      if (ileTeraz >= 0) {
        const stan = { tpl: tpl, ile: ileTeraz, wEq: ileTeraz > 0, powod: null };
        if (!zap || zap.ile !== ileTeraz) {
          STORE.data.scrollStan = Object.assign({}, STORE.data.scrollStan, { [cfg.key]: { ile: ileTeraz, o: Date.now() } });
        }
        return stan;
      }

      // slotu nie widac - moze byc w zamknietym worku
      if (zap && typeof zap.ile === 'number') {
        return { tpl: tpl, ile: null, ileOstatnio: zap.ile, wEq: null, powod: 'nie widac slotu (zamknity worek?)' };
      }
      return { tpl: tpl, ile: null, wEq: null, powod: 'nie ma go w widocznym eq' };
    },

    /* -----------------------------------------------------------------
     *  ROZPOZNAWANIE ZWOJOW - AUTOMATYCZNIE
     *
     *  Problem: skrypt musial znac item-tpl zwoju dla kazdego herosa,
     *  a to numer wewnetrzny gry. Bez niego panel pokazywal "brak
     *  przywo" nawet przy 6 sztukach w worku, a "przywo!" nie dzialalo.
     *  Stare rozwiazanie wymagalo pracy czloweka: najechac myszka na
     *  zwój, wpisac HH.zwój() w konsoli. Raz na nowy zwój. Nikt tego
     *  nie zrobi, wiec skrypt zainstalowany przez kogos innego byl
     *  zepsuty od startu.
     *
     *  ROZWIAZANIE
     *  Nazwy przedmiotu nie ma w DOM slotu - ikona jest rysowana na
     *  <canvas>, wiec slot niesie tylko item-tpl i atrybut tip-id.
     *  Ale gra trzyma kompletne podpowiedzi w `TIPS.allTips`,
     *  indeksowane dokladnie tym tip-id. Wystarczy:
     *      slot [class*="item-tpl-"]  ->  tip-id + item-tpl
     *      TIPS.allTips[tip-id]        ->  HTML, w nim .item-name
     *
     *  Sprawdzone 04.10 na gefion, 92 sloty w ekwipunku:
     *      tip457 -> "Zwój przywołania drużyny na herosa Zły Przewodnik"
     *               -> item-tpl-22255, 6 szt
     *      tip458 -> "…na herosa Opętany Paladyn"    -> item-tpl-22257, 6 szt
     *      tip459 -> "…na herosa Piekielny Kościej"  -> item-tpl-22256, 9 szt
     *
     *  Zero najechania myszka, zero zapytan do serwera, zero pracy
     *  czloweka. Dziala na kazdym swiecie i dla kazdej osoby, ktora
     *  zainstaluje skrypt.
     *
     *  Ograniczenie, ktorego nie da sie obejsc: slot musi istniec
     *  w DOM. Zwój w ZAMKNIETYM worku nie ma slota, wiec nie jest
     *  widoczny dopoki ktos go nie otworzy. Dlatego skan jest cykliczny,
     *  a nie jednorazowy.
     * ----------------------------------------------------------------- */

    // Nazwa przedmiotu z tip-id. Cache jest po to, zeby nie parsowac
    // tego samego HTML 92 razy co 20 sekund - tresc podpowiedzi nigdy
    // sie nie zmienia.
    nazwaZTipId(tipId) {
      if (!tipId) return '';
      const cache = this.tipCache || (this.tipCache = {});
      if (Object.prototype.hasOwnProperty.call(cache, tipId)) return cache[tipId];
      let nazwa = '';
      const T = (typeof TIPS !== 'undefined' && TIPS && TIPS.allTips) ? TIPS.allTips : null;
      if (T) {
        const html = T[tipId];
        if (typeof html === 'string' && html) {
          const i = html.indexOf('item-name');
          if (i >= 0) {
            const a = html.indexOf('>', i);
            const b = html.indexOf('<', a + 1);
            if (a >= 0 && b > a) nazwa = html.slice(a + 1, b).replace(/\s+/g, ' ').trim();
          }
        }
      }
      cache[tipId] = nazwa;
      return nazwa;
    },

    // Skan ekwipunku. Zwraca { znalezione: {key: tpl}, widzianych: n }.
    // Czysto odczytowy - o zapisie decyduje odswiezZwoje(), dzieki
    // czemu skan moze byc wołany z kodu diagnostycznego bez skutków
    // ubocznych.
    skanujZwoje() {
      const lista = MAPS.heroList();
      const sloty = document.querySelectorAll('[class*="item-tpl-"]');
      const wynik = {};
      let widzianych = 0;

      for (let i = 0; i < sloty.length; i++) {
        const el = sloty[i];
        const tipId = el.getAttribute('tip-id');
        if (!tipId) continue;
        const m = /item-tpl-([0-9]+)/.exec(String(el.className || ''));
        if (!m) continue;
        const tpl = Number(m[1]);
        const nazwa = this.nazwaZTipId(tipId);
        if (!nazwa) continue;
        widzianych++;

        // Nazwa musi byc zwójem przywolania - inaczej kazdy przedmiot
        // w worku dostawalby porownanie z kazdym herosem.
        if (nazwa.toLowerCase().indexOf('zwój przywo') === -1) continue;

        const czysta = MAPS.plain(nazwa);
        for (let h = 0; h < lista.length; h++) {
          const cfg = lista[h];
          if (!cfg.zwój) continue;
          const b = MAPS.plain(cfg.zwój);
          if (!b || !czysta) continue;
          // Porownanie w obie strony: nazwa w grze bywa dluzsza niz
          // w CONFIG albo odwrotnie.
          if (czysta.indexOf(b) < 0 && b.indexOf(czysta) < 0) continue;
          // Jesli dwa herosa daja ten sam zwój, pierwszy wygrywa -
          // kolejka z CONFIG jest kolejnosc obchodzenia.
          if (wynik[cfg.key] === undefined) wynik[cfg.key] = tpl;
          break;
        }
      }

      return { znalezione: wynik, widzianych: widzianych };
    },

    // Czy skan ekwipunku juz sie powiodl? Od tego zalezy, czy chip pokazuje
    // "nie wiem" (skanu jeszcze nie bylo - wtedy to prawda) czy "brak"
    // (skan byl i zwoju nie ma - wtedy to tez prawda, i taka odpowiedz
    // jest uzyteczna).
    _zwojeSkanOk: false,
    zwojeSkanSieUdalo() { return this._zwojeSkanOk === true; },

    // Cykliczny skan + zapis nowych rozpoznan. `silne` wymusza zapis
    // nawet bez zmian - potrzebne przy pierwszym uruchomieniu.
    odswiezZwoje(silne) {
      const r = this.skanujZwoje();
      if (!r.widzianych) {
        // TIPS.allTips nie jest jeszcze zaladowany albo nie ma slotow.
        // Nie zapisuj pustki - zostalaby jako "nie wiem" na wiecznosc.
        return { ok: false, powod: 'brak slotow z tip-id', znalezione: {} };
      }

      // Co juz wiemy zostaje - zwój w zamknietym worku nie znika
      // z pamieci tylko dlatego, ze chwilowo go nie widac.
      const stare = STORE.data.scrolls || {};
      const polaczone = {};
      for (const k in stare) {
        if (Object.prototype.hasOwnProperty.call(stare, k)) polaczone[k] = stare[k];
      }
      let nowe = 0;
      for (const k in r.znalezione) {
        if (!Object.prototype.hasOwnProperty.call(r.znalezione, k)) continue;
        if (polaczone[k] !== r.znalezione[k]) { polaczone[k] = r.znalezione[k]; nowe++; }
      }

      if (!nowe && !silne) return { ok: true, nowe: 0 };
      if (nowe) STORE.set({ scrolls: polaczone });
      // Skan sie udal - od teraz chipy rozrozniaja "nie ma zwoju"
      // od "jeszcze nie wiem".
      this._zwojeSkanOk = true;

      if (nowe) {
        const lista = MAPS.heroList();
        const opis = [];
        for (let i = 0; i < lista.length; i++) {
          const k = lista[i].key;
          const v = polaczone[k];
          if (v === undefined) continue;
          if (this._zwojeOstatnio && this._zwojeOstatnio[k] === v) continue;
          opis.push(lista[i].nazwa + ' = item-tpl-' + v);
        }
        if (opis.length) {
          LOG.ok('Zwój przywołania rozpoznany z ekwipunku: ' + opis.join(', '));
          NOTIFY.send({
            title: 'Zwój przywołania rozpoznany',
            description: opis.join('\n') + '\nSkrypt zapamiętał ten numer na przyszłość.',
            color: 0x5a9e73,
          });
        }
      }
      this._zwojeOstatnio = Object.assign({}, polaczone);

      // Tylko znaczniki przy herosach. Pelne UI.build() przy kazdej
      // zmianie przeskakiwaloby na goraco i co 20 s przebudowywalo
      // panel sam w sobie.
      if (typeof UI !== 'undefined' && UI.odswiezZnacznikiZwojow) {
        UI.odswiezZnacznikiZwojow();
      }
      return { ok: true, nowe: nowe, scrolls: polaczone };
    },

    // Cykliczny skan. 20 sekund - tyle wystarczy: zawartosc worka
    // zmienia sie przy przenoszeniu przedmiotow i uzyciu zwoju, nie
    // co milisekund. Wlasny interwal (nie BOT.timer), bo skan ma
    // dzialac takze przy zatrzymanym bocie.
    startZwoje() {
      const self = this;
      this.tipCache = {};
      this._zwojeOstatnio = null;
      // Pierwszy skan moze byc za wczesny - TIPS.allTips jeszcze sie
      // nie buduje. Kilka prob w odstepach.
      let proby = 0;
      const startowe = function () {
        const r = self.odswiezZwoje(true);
        if (!r.ok && proby < 6) {
          proby++;
          setTimeout(startowe, 2000);
          return;
        }
        if (!r.ok) {
          LOG.warn('Nie umiem rozpoznać zwojów: ' + r.powod
            + '. Otwórz worek z przedmiotami i przeładuj grę.');
        }
        if (self.timerZwojow) clearInterval(self.timerZwojow);
        self.timerZwojow = setInterval(function () { self.odswiezZwoje(false); }, 20000);
      };
      startowe();
    },

    // Uzywa przedmiotu z ekwipunku przez dwuklik na slocie.
    // Zwraca { ok, tpl, before, after, powod } - po `before`/`after` widac,
    // czy przedmiot naprawde zniknal, bo dwuklik nie musi zadzialac.
    useItem(tpl) {
      const t = Number(tpl);
      const przed = this.itemAmount(t);
      if (przed < 0) return { ok: false, tpl: t, before: -1, after: -1, powod: 'nie ma takiego przedmiotu' };
      if (przed === 0) return { ok: false, tpl: t, before: 0, after: 0, powod: 'przedmiot się skończył' };

      const el = document.querySelector('.inventory-item.item-tpl-' + t);
      if (!el) return { ok: false, tpl: t, before: przed, after: przed, powod: 'brak slotu' };

      // Gra nasłuchuje zdarzeń myszy na slocie. Wysyłamy pełną sekwencję
      // (najechanie, przycisnięcie, puszczenie, dwuklik) - sama kliknij()
      // nie wystarcza przy elementach z własnym handlerem.
      const opcje = { bubbles: true, cancelable: true, view: window };
      try {
        el.dispatchEvent(new MouseEvent('mouseover', opcje));
        el.dispatchEvent(new MouseEvent('mousedown', opcje));
        el.dispatchEvent(new MouseEvent('mouseup', opcje));
        el.dispatchEvent(new MouseEvent('click', opcje));
        el.dispatchEvent(new MouseEvent('dblclick', opcje));
        el.dispatchEvent(new MouseEvent('contextmenu', opcje));
      } catch (e) {
        return { ok: false, tpl: t, before: przed, after: przed, powod: 'wyjątek: ' + e.message };
      }
      return { ok: true, tpl: t, before: przed, after: -2, powod: 'dwuklik wysłany' };
    },

    login() {
      const sels = ['#login-btn', '.login-btn', 'button.login', '.char-login',
        'input[value*="Zaloguj"]', '.character-item', '.relogger__one-character'];
      for (let i = 0; i < sels.length; i++) {
        const el = document.querySelector(sels[i]);
        if (el && !el.disabled && String(el.className).indexOf('disabled') === -1) {
          el.click();
          return true;
        }
      }
      return false;
    },

    logout() {
      const el = document.querySelector('a[href*="logout"], .logout, #logout');
      if (el) { el.click(); return true; }
      const nodes = document.querySelectorAll('.label, a, button, div');
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (n.children.length !== 0) continue;
        const t = String(n.textContent || '').trim().toLowerCase();
        if (t.indexOf('wyloguj') === 0) { n.click(); return true; }
      }
      return this.send('logout') !== null;
    },
  };

  /* =====================================================================
   *  4. MAPS
   * =================================================================== */

  const MAPS = {
    // Wstrzykuje CONFIG.GATEWAYS do STORE.data.graph, zeby bot znal droge
    // do kazdej mapy od razu, bez odkrywania. NIGDY nie nadpisuje tego,
    // co juz zostalo zapamietane z gry - wazniejsze sa dane odczytane na zywo.
    seedGraph() {
      const g = STORE.data.graph || (STORE.data.graph = {});
      let dodane = 0, pominiete = 0;
      const src = CONFIG.GATEWAYS || {};
      for (const from in src) {
        if (!Object.prototype.hasOwnProperty.call(src, from)) continue;
        const istniejace = g[from];
        if (Array.isArray(istniejace) && istniejace.length) { pominiete++; continue; }
        const out = [];
        const doMap = src[from];
        for (const to in doMap) {
          if (!Object.prototype.hasOwnProperty.call(doMap, to)) continue;
          const pola = doMap[to];
          for (let i = 0; i < pola.length; i++) {
            out.push({
              to: Number(to),
              x: Number(pola[i][0]),
              y: Number(pola[i][1]),
              name: (CONFIG.NAMES[Number(to)] || ('mapa ' + to)),
            });
          }
        }
        g[from] = out;
        dodane++;
      }
      if (dodane || pominiete) {
        LOG.info('Graf bram: ' + dodane + ' map z CONFIG, ' + pominiete + ' juz znanych z gry.');
      }
      STORE.save();
    },

    /* ---- herosowie ---- */

    // Wszyscy herosowie w kolejnosci obchodzenia (CONFIG.ORDER).
    // Brakujacy klucz w ORDER jest dopisywany na koncu, zeby dodanie
    // herosa do HEROES wystarczylo - nie trzeba pamietac o ORDER.
    heroList() {
      const wszystkie = CONFIG.HEROES || [];
      const poKliszczu = {};
      for (let i = 0; i < wszystkie.length; i++) poKliszczu[wszystkie[i].key] = wszystkie[i];
      const lista = [];
      const order = CONFIG.ORDER || [];
      for (let i = 0; i < order.length; i++) {
        const h = poKliszczu[order[i]];
        if (h) { lista.push(h); delete poKliszczu[order[i]]; }
      }
      for (const k in poKliszczu) {
        if (Object.prototype.hasOwnProperty.call(poKliszczu, k)) lista.push(poKliszczu[k]);
      }
      return lista;
    },

    heroByKey(key) {
      const lista = this.heroList();
      for (let i = 0; i < lista.length; i++) if (lista[i].key === key) return lista[i];
      return lista.length ? lista[0] : null;
    },

    // heros, ktorego trase wlasnie obchodzimy
    hero() {
      return this.heroByKey(STORE.data.heroKey) || this.heroList()[0] || null;
    },

    // Ktory z kolei heros po aktualnym. Koniec listy = powrot do pierwszego.
    nextHero(key) {
      const lista = this.heroList();
      if (lista.length < 2) return lista[0] || null;
      for (let i = 0; i < lista.length; i++) {
        if (lista[i].key === key) return lista[(i + 1) % lista.length];
      }
      return lista[0];
    },

    // Szukamy WSZYSTKICH herosow, nie tylko aktualnego. Zdarza sie, ze na
    // trasie jednego siedzi drugi - lepiej zglosic niz przegapic.
    // Ktory z nich "biesmi" - zwraca { hero, cfg } pierwszego pasujacego.
    findAny(list) {
      const cfg = this.hero();
      const wszystkie = this.heroList();
      for (let i = 0; i < wszystkie.length; i++) {
        const h = wszystkie[i];
        const want = this.plain(h.nazwa);
        if (!want) continue;
        for (let j = 0; j < list.length; j++) {
          const d = list[j] && list[j].d ? list[j].d : list[j];
          if (!d || typeof d.nick !== 'string') continue;
          // typ 2 = heros; filtr po nazwie jest bezpieczniejszy
          if (d.type !== 2) continue;
          if (this.plain(d.nick).indexOf(want) === -1) continue;
          return { hero: d, cfg: h, biezacy: !!cfg && h.key === cfg.key };
        }
      }
      void list;
      return null;
    },

    // wszystkie kroki trasy AKTYWNEGO herosa, w kolejnosci podanej przez gracza
    all() {
      const out = [];
      const cfg = this.hero();
      const r = (cfg && cfg.route) || [];
      for (let i = 0; i < r.length; i++) {
        out.push({
          id: Number(r[i].id),
          name: CONFIG.NAMES[Number(r[i].id)] || ('mapa ' + r[i].id),
          spawns: r[i].spawns || [],
          pass: !!r[i].pass,
        });
      }
      return out;
    },

    plain(s) {
      return String(s || '')
        .toLowerCase()
        .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e')
        .replace(/ł/g, 'l').replace(/ń/g, 'n').replace(/ó/g, 'o')
        .replace(/ś/g, 's').replace(/ź/g, 'z').replace(/ż/g, 'z')
        .replace(/\(.*?\)/g, ' ')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    },

    byId(id) {
      const l = this.all();
      for (let i = 0; i < l.length; i++) if (l[i].id === Number(id)) return l[i];
      return null;
    },

    byName(name) {
      const n = this.plain(name);
      if (!n) return null;
      const l = this.all();
      for (let i = 0; i < l.length; i++) if (this.plain(l[i].name) === n) return l[i];
      return null;
    },

    // krok trasy o podanym numerze (0 = pierwszy)
    stepAt(i) {
      const l = this.all();
      if (i < 0 || i >= l.length) return null;
      return l[i];
    },

    // krok trasy, ktorym aktualnie zajmujemy sie przy tej mapie.
    // Szukamy ostatniego wystapienia mapy - trasa ma powtorzenia (powroty).
    stepFor(id) {
      const l = this.all();
      let out = null;
      for (let i = 0; i < l.length; i++) if (l[i].id === Number(id)) out = l[i];
      return out;
    },

    home() { return { id: CONFIG.HOME.id, name: CONFIG.HOME.name }; },

    // Biezaca mapa. ID pierwsze, nazwa jako zapas.
    // Biezaca mapa. Wazne: entry to TYLKO biezacy krok trasy.
    // Wczesniej bralismy ostatnie wystapienie mapy w ROUTE - przez to bot
    // na 6473 (powrot) myslal ze juz obejdzil respa i leciał dalej.
    current() {
      const raw = GAME.rawMap();
      if (!raw) return { id: null, name: '???', entry: null };
      const step = this.stepAt(STORE.data.routeIndex || 0);
      const onStep = step && Number(step.id) === Number(raw.id);
      return {
        id: raw.id,
        name: this.nameOf(raw.id) || raw.name,
        entry: onStep ? step : null,
      };
    },

    nameOf(id) {
      return CONFIG.NAMES[Number(id)] || null;
    },

    isHome(m) {
      if (!m) return false;
      const h = this.home();
      if (h && m.id !== null && m.id === h.id) return true;
      return this.plain(m.name) === this.plain(CONFIG.HOME.name);
    },

    label(m) {
      if (!m) return '???';
      return m.name + ' (' + (m.id === null ? 'brak' : m.id) + ')';
    },

    // ile krokow trasy ma respa do obejścia (do paska postepu)
    searchCount() {
      const l = this.all();
      let n = 0;
      for (let i = 0; i < l.length; i++) if (l[i].spawns.length) n++;
      return n;
    },
  };

  /* =====================================================================
   *  5. STORE
   * =================================================================== */

  const STORE = {
    KEY: 'HH_V3',
    data: {
      state: 'STOPPED',
      routeIndex: 0,
      // Którego herosa właśnie obchodzimy - klucz z CONFIG.HEROES.
      heroKey: null,
      // Statystyka na herosa: { [key]: {znalezione, zabici, ostatnio} }
      // ostatnio = ms kiedy znaleziono (do "X min temu" na liscie)
      heroStats: {},
      // item-tpl zwojow rozpoznanych automatycznie (nazwa -> tpl).
      // Uzupelniane przez GAME.odswiezZwoje() co 20 s na podstawie
      // nazw odczytanych z TIPS.allTips. Awaryjnie przez HH.zwój().
      scrolls: {},
      // Ostatni ZNANY licznik zwoju na herosa: { [key]: {ile, o} }.
      // Trzymamy go, bo nie wszystkie worki sa otwarte naraz - brak slotu
      // w DOM nie znaczy "nie masz", tylko "nie widac".
      scrollStan: {},
      // Webhook nadpisujacy CONFIG (wpisywany z panelu). Pusty =
      // uzyj CONFIG.WEBHOOK.
      webhook: '',
      // Czas realnego polowania w ms. NIE liczy czasu wylogowania
      // w oczekiwaniu na resp - potrafi trwac godziny.
      huntMs: 0,
      // "bij!" przyszlo z czatu, gdy herosa jeszcze nie bylo w zasiegu
      atakNaKomendę: false,
      killed: 0,
      stepFails: 0,
      spawnIndex: 0,
      pointSince: 0,
      nextRespawnAt: 0,
      // Czas z komendy "odwolaj Nmin". Chroni go przed przeliczeniem
      // w goHome() - bez tego "odwolaj 3min!" przepadalo po dotarciu
      // do Ithanu (bot ustawial sobie 120 min). Po wykorzystaniu 0.
      odwolajReczny: 0,
      // Powod powrotu do Ithanu. TRZEBA go trzymac w magazynie, bo smierc
      // przekierowuje na www.margonem.pl i skrypt wstrzykuje sie od nowa.
      // Bez tego po reloadzie bot uznalby to za 'poKillu' i wylogowal sie
      // na 120 minut zamiast lecieć od nowa od Zniszczonego Opactwa.
      homeReason: null,
      graph: {},
      visited: {},
      respawnSamples: [],
      found: 0,
      runs: 0,
    },

    load() {
      try {
        const raw = GM_getValue(this.KEY, null);
        if (raw) {
          const d = JSON.parse(raw);
          for (const k of Object.keys(this.data)) if (d[k] !== undefined) this.data[k] = d[k];
        }
      } catch (e) { /* pusto */ }
      return this.data;
    },

    save() { try { GM_setValue(this.KEY, JSON.stringify(this.data)); } catch (e) { /* brak GM */ } },

    set(patch) {
      for (const k of Object.keys(patch)) this.data[k] = patch[k];
      this.save();
    },
  };

  /* =====================================================================
   *  6. NOTIFY
   * =================================================================== */

  const NOTIFY = {
    last: 0,

    // Adres webhooka. Kolejnosc:
    //   1. to co uzytkownik wpisal w panelu (STORE.data.webhook)
    //   2. CONFIG.WEBHOOK z poczatku skryptu
    // Pusty wpis = wroc do CONFIG, wiec da sie wywrocic zmiane bez
    // grzebania w kodzie i bez utraty ustawienia z pliku.
    adres() {
      const zMagazynu = (STORE.data.webhook || '').trim();
      return zMagazynu || CONFIG.WEBHOOK || '';
    },

    // Sprawdza czy adres w ogole wyglada na webhook Discorda.
    // Zle sklejenie URL-a zostawia skrypt cicho bez pingow, a uzytkownik
    // nie wie dlaczego - lepiej powiedziec od razu.
    poprawny(adres) {
      const a = String(adres || '').trim();
      return /^https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(a);
    },

    /* ---------------------------------------------------------------
     *  JEDNA WARSTWA HTTP
     *
     *  Transport: zwykly fetch z kontekstu strony.
     *
     *  Co zmierzone na gefion.margonem.pl:
     *    fetch('https://discord.com/api/webhooks/<zyjowy>/<token>')
     *      -> 200 + JSON kanału        (CORS DZIALA)
     *    fetch('https://discord.com/api/webhooks/<martwy>/<token>')
     *      -> 404 + {"code":10015}
     *    fetch('https://example.com/') -> "Failed to fetch"
     *
     *  Ten ostatni przypadek jest mylacy: example.com po prostu nie
     *  wysyla Access-Control-Allow-Origin. Po nim wyciagnalem wniosek,
     *  ze Discorda tez nie wysyla - i przenioslem transport na
     *  GM_xmlhttpRequest. To byla niepotrzebna zmiana; sam fetch do
     *  Discorda dziala, a GM_xmlhttpRequest to warstwa, ktora zglaszala
     *  "blad sieci". Wrocilem do fetch.
     *
     *  Co zostaje z tamtej wersji i jest warto zatrzymac:
     *    - timeout 8 s przez AbortController
     *    - rozroznienie 204 / 400 / 401 / 403 / 404 / 429
     *    - KAZDY nieudany ping trafia do DevLogu (bez adresu, tylko
     *      status). Wczesniej send() konczyl sie .catch(function(){}),
     *      a odpowiedz 404 w ogole nie jest wyjatkiem - przez to martwy
     *      webhook wygladal jak "nic nie dziala", bez sladu.
     * ------------------------------------------------------------- */

    wyslij(adres, body) {
      const opcje = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        // Bez cookies przegladarki - webhook ich nie potrzebuje, a
        // wysylane do obcego hosta to wyciek.
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      };
      let timer = null;
      let ctrl = null;
      if (typeof AbortController === 'function') {
        ctrl = new AbortController();
        opcje.signal = ctrl.signal;
        timer = setTimeout(function () { ctrl.abort(); }, 8000);
      }
      const sprzataj = function () { if (timer) clearTimeout(timer); };
      return fetch(adres, opcje).then(function (r) {
        sprzataj();
        return {
          // Dostarczone to 204 albo 200. OBA znacza sukces i roznia sie
          // tylko sposobem zgloszenia:
          //    send() - bez wait -> 204 (pusta odpowiedz)
          //    test() - z  wait -> 200 + JSON utworzonej wiadomosci
          //
          // Wczesniej test sprawdzal samo "status === 204" przy wait=true.
          // Discord tam zwraca 200, wiec test ZAWSZE zglaszal blad - mimo
          // ze wiadomosc dochodzila. Uzytkownik widzial komunikat na
          // Discordzie i jednoczesnie "Niepowodzenie" w grze. Blad siedzial
          // w skrypcie od pierwszego dnia, nie w moich zmianach.
          ok: (r.status === 204 || r.status === 200),
        status: r.status,
      };
      }).catch(function (e) {
        sprzataj();
        const przekroczony = e && e.name === 'AbortError';
        return {
          ok: false,
          status: 0,
          powod: przekroczony ? 'brak odpowiedzi w 8 s'
            : 'blad sieci (' + String((e && e.message) || e) + ')',
        };
      });
    },

    send(o) {
      const adres = this.adres();
      if (!adres) {
        if (!this.ostrzezoneBrak) {
          this.ostrzezoneBrak = true;
          LOG.warn('Brak adresu webhooka. Wpisz go w panelu (ikona '
            + 'discord) albo w CONFIG.WEBHOOK.');
        }
        return Promise.resolve({ ok: false, status: 0, powod: 'brak adresu' });
      }
      const now = Date.now();
      if (now - this.last < 2000) return Promise.resolve();
      this.last = now;
      const embed = {
        title: o.title || 'Heros Hunter',
        description: o.description || '',
        color: o.color === undefined ? CONFIG.WEBHOOK_COLOR : o.color,
        fields: (o.fields || []).map(function (f) {
          return { name: String(f.name), value: String(f.value), inline: !!f.inline };
        }),
        footer: { text: 'Heros Hunter' },
        timestamp: new Date().toISOString(),
      };
      // Adres z tokenem nie trafia ani do logu, ani do konsoli - to sekret.
      // self jest potrzebne, bo w .then() nie ma "this" - tam jest
      // kontekst obietnicy, nie NOTIFY.
      const self = this;
      const zadanie = this.wyslij(adres, JSON.stringify({
        username: 'Heros Hunter',
        embeds: [embed],
      }));
      zadanie.then(function (r) {
        if (r && r.ok) { self.ostrzezoneBrak = false; return; }
        if (r && r.status === 404) {
          LOG.warn('Discord nie zna webhooka (404). Adres jest nieaktualny '
            + 'albo usuniety - wpisz nowy w panelu.');
          return;
        }
        LOG.warn('Ping nie doszedl: ' + (r && (r.powod || ('status ' + r.status)))
          + '. Sprawdz adres w Ustawieniach.');
      });
      return zadanie;
    },

    // Test webhooka z panelu. Zwraca obietnice z wynikiem, zeby UI
    // mogl napisac "dostarczono" albo "odrzucone".
    //
    // Argument opcjonalny: panel podaje to, co jest wpisane w polu, a nie
    // to, co zapisane. Wczesniej test leciał na ZAPISANY adres, wiec
    // "Wyślij test" po wpisaniu nowego odpowiadało, czy dziala stary -
    // czyli weryfikowalo nie to, co user wlasnie wkleił.
    test(adres) {
      const a = (adres === undefined ? this.adres() : String(adres || '').trim());
      if (!a) return Promise.resolve({ ok: false, powod: 'brak adresu' });
      if (!this.poprawny(a)) return Promise.resolve({ ok: false, powod: 'zly format adresu' });
      // wait=true: Discord zwraca wynik zamiast pustego 204, wiec
      // widac status HTTP zamiast zgadywac. Wysyłamy jednoznacznie
      // oznaczona wiadomość - to test, wiec zostaje na kanale.
      return this.wyslij(a + (a.indexOf('?') < 0 ? '?' : '&') + 'wait=true',
        JSON.stringify({
          username: 'Heros Hunter',
          embeds: [{
            title: 'Test webhooka',
            description: 'Ten komunikat oznacza, że adres działa '
              + 'i bot będzie tu pisać o znalezionym herosie.',
            color: CONFIG.WEBHOOK_COLOR,
            footer: { text: 'Heros Hunter' },
            timestamp: new Date().toISOString(),
          }],
        })).then(function (r) {
          if (r.ok) return { ok: true, status: r.status };
          if (r.status === 429) {
            return { ok: false, status: 429, powod: 'limit Discorda' };
          }
          return r;
        });
    },
  };

  /* =====================================================================
   *  7. UI
   * =================================================================== */

const CSS_HEROS_HUNTER = [
  '/* =====================================================================',
  ' *  TOKENY  -  jedno miejsce, jeden slownik',
  ' * ===================================================================== */',
  ':where(#hh-panel,.hh-setwin,.hh-helpwin,.hh-logwin){',
  // Powierzchnie. Trzy poziomy zloci: tlo okna, kafelek/pole, hover.
  '--hh-bg:rgba(20,22,26,.97);',
  '--hh-bg-2:#1b1e24;',
  '--hh-bg-3:#21252c;',
  // OBRAMOWANIA - tylko dwa tokeny, tylko 1px. Wszystkie inne kolory
  // kresek w UI pochodza od nich.
  '--hh-line:rgba(255,255,255,.07);',
  '--hh-line-2:rgba(255,255,255,.14);',
  // TEKST - trzy poziomy, wszystkie >= AA na kazdym z trzech tlo.
  // Trzeciego poziomu (dawne --hh-fg-4, 4.08:1 na bg-3) nie ma: byl
  // uzywany wylacznie tam, gdzie mial kontrast ponizej normy.
  '--hh-fg:#e9ebee;',
  '--hh-fg-2:#a4aab4;',
  '--hh-fg-3:#8a9099;',
  // AKCENT - jeden, stonowany. 5.47:1 jako tekst na tle panelu,
  // 5.71:1 z ciemnym tekstem na wypelnieniu, 4.65:1 na bg-3.
  // Wczesniej akcentem byla czysta biel, czyli kolor tekstu - przez to
  // nie bylo hierarchii, tylko jeden bardzo jasny blok.
  '--hh-accent:#5b8fd6;',
  '--hh-on-accent:#0e1116;',
  // STATUS - osobne tokeny dla tekstu, bo ten sam odcien co na krawedzi
  // daje 4.4:1, czyli ponizej AA.
  '--hh-ok:#5a9e73;',
  '--hh-warn:#b8862f;',
  '--hh-err:#c25c56;',
  '--hh-ok-t:#6fb087;',
  '--hh-warn-t:#c99a3e;',
  '--hh-err-t:#d4776f;',
  // SIATKA 4/8. Odstepy nigdy nie sa pisane recznie.
  '--hh-s1:4px;',
  '--hh-s2:8px;',
  '--hh-s3:12px;',
  '--hh-s4:16px;',
  // PROMIENIE - trzy, zero wiekszych.
  '--hh-r:6px;',
  '--hh-r-sm:4px;',
  '--hh-r-xs:3px;',
  '--hh-t:120ms;',
  // WYMIARY. Wszystkie wysokosci pochodza z tych tokenow, wiec naglowek
  // panelu i naglowki trzech okien sa z definicji takie same.
  '--hh-h:44px;',
  '--hh-ib:24px;',
  '--hh-btn-h:30px;',
  '--hh-badge-h:18px;',
  '--hh-inset:16px;',
  // Z-INDEX. Panel pod oknami; kazde okno o jeden stopien wyzej od
  // poprzedniego. Wczesniej wszystkie mialy ten sam i rozstrzygala
  // kolejnosc w DOM.
  '--hh-z-panel:2147483600;',
  '--hh-z-win:2147483601;',
  '--hh-ui:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Helvetica,Arial,sans-serif;',
  '--hh-mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;',
  '}',

  /* ===================================================================== */
  /*  BAZA                                                                  */
  /* ===================================================================== */
  '#hh-panel,.hh-setwin,.hh-helpwin,.hh-logwin{box-sizing:border-box;',
  'font:400 13px/1.45 var(--hh-ui);color:var(--hh-fg);background:var(--hh-bg);',
  'border:1px solid var(--hh-line);border-radius:var(--hh-r);overflow:hidden;}',
  '#hh-panel *,.hh-setwin *,.hh-helpwin *,.hh-logwin *{box-sizing:border-box;}',
  // Gra ma wlasne style dla button i summary - zerujemy marginesy i
  // rodzine, nie calky reset.
  '#hh-panel button,.hh-setwin button,.hh-helpwin button,.hh-logwin button,',
  '#hh-panel summary,.hh-setwin summary,.hh-helpwin summary{',
  'margin:0;font-family:inherit;line-height:inherit;}',

  /* ===================================================================== */
  /*  POZYCJA                                                               */
  /* ===================================================================== */
  '#hh-panel{position:fixed;right:var(--hh-inset);bottom:var(--hh-inset);',
  'z-index:var(--hh-z-panel);width:300px;max-height:calc(100vh - var(--hh-inset)*2);',
  'display:flex;flex-direction:column;min-height:0;}',
  '.hh-setwin,.hh-helpwin,.hh-logwin{position:fixed;left:var(--hh-inset);',
  'bottom:var(--hh-inset);z-index:var(--hh-z-win);width:400px;',
  'max-width:calc(100vw - var(--hh-inset)*2);',
  'max-height:calc(100vh - var(--hh-inset)*2);display:none;flex-direction:column;',
  'min-height:0;}',
  '.hh-setwin.open,.hh-helpwin.open,.hh-logwin.open{display:flex;}',
  // Zwiniety panel zostaje samym naglowkiem. Musi obejmowac rowniez
  // .hh-foot - inaczej Alt+H zmienia tylko znaczek, a panel zostaje
  // tej samej wysokosci.
  '#hh-panel.min .hh-body,#hh-panel.min .hh-foot{display:none;}',

  /* ===================================================================== */
  /*  NAGLOWEK - jeden blok dla panelu i trzech okien                       */
  /* ===================================================================== */
  '#hh-panel .hh-head,.hh-setwin-hd,.hh-helpwin-hd,.hh-logwin-hd{',
  'flex:0 0 auto;display:flex;align-items:center;gap:var(--hh-s2);',
  'height:var(--hh-h);padding:0 var(--hh-s2) 0 var(--hh-s3);',
  'border-bottom:1px solid var(--hh-line);cursor:grab;user-select:none;',
  'touch-action:none;}',
  '#hh-panel .hh-head:active,.hh-setwin-hd:active,.hh-helpwin-hd:active,',
  '.hh-logwin-hd:active{cursor:grabbing;}',
  '.hh-setwin-hd,.hh-helpwin-hd,.hh-logwin-hd{justify-content:space-between;}',
  // Tytul okna to tytul, nie etykieta sekcji. Wczesniej "Ustawienia"
  // i "Webhook discord" mialy identyczne 9.5 px / uppercase / szary -
  // okno nie mialo naglowka, tylko dwie etykiety pod rzad.
  '.hh-setwin-hd>b,.hh-helpwin-hd>b,.hh-logwin-hd>b{font:600 12px/1.2 var(--hh-ui);',
  'letter-spacing:-.01em;color:var(--hh-fg);}',
  '#hh-panel .hh-title{flex:1;min-width:0;}',
  '#hh-panel .hh-title>b{display:block;font:600 12px/1.2 var(--hh-ui);',
  'letter-spacing:-.01em;}',
  '#hh-panel .hh-sub{display:flex;align-items:center;gap:6px;min-width:0;',
  'margin-top:3px;}',
  '#hh-panel .hh-sub>i{font:400 11.5px/1.2 var(--hh-ui);color:var(--hh-fg-2);',
  'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
  '#hh-panel .hh-av{display:flex;align-items:center;flex:0 0 auto;}',
  '#hh-panel .hh-av-head{width:24px;height:24px;border-radius:var(--hh-r-xs);',
  'display:block;flex:0 0 auto;background:none;border:0;padding:0;',
  'position:relative;overflow:hidden;}',

  /* ===================================================================== */
  /*  ETYKIETY SEKCJI - jedna recepta, cztery miejsca                     */
  /* ===================================================================== */
  '.hh-lbl,.hh-heroes-hd>span,.hh-tile>label{',
  'font:500 10px/1.2 var(--hh-ui);letter-spacing:.09em;text-transform:uppercase;',
  'color:var(--hh-fg-3);}',
  '.hh-lbl{display:block;margin:0 0 var(--hh-s2);}',
  '.hh-heroes-hd{margin-bottom:var(--hh-s2);}',

  /* ===================================================================== */
  /*  BADGE - jeden rozmiar, jeden promien, jeden kolor obramowania        */
  /*                                                                     */
  /*  Warianty zmieniaja tylko kolor tekstu i kropki. Tlo zostaje         */
  /*  przezroczyste, obramowanie neutralne - kolor niesie wskaznik,       */
  /*  nie obwodka. Wczesniej badge dostawal kolorowe obramowanie         */
  /*  i wypelnienie z inline-stylu przy kazdej zmianie stanu.             */
  /* ===================================================================== */
  '.hh-pill,.hh-hero-tag{display:inline-flex;align-items:center;',
  'justify-content:center;gap:5px;flex:0 0 auto;height:var(--hh-badge-h);',
  'padding:0 6px;border:1px solid var(--hh-line-2);',
  'border-radius:var(--hh-r-xs);background:transparent;white-space:nowrap;',
  'font:500 10px/1 var(--hh-mono);letter-spacing:.04em;color:var(--hh-fg-3);}',
  '.hh-pill{letter-spacing:.06em;text-transform:uppercase;}',
  '.hh-pill>i{width:5px;height:5px;border-radius:50%;background:currentColor;',
  'flex:0 0 auto;}',
  '.hh-pill.ok{color:var(--hh-ok-t);border-color:rgba(90,158,115,.34);}',
  '.hh-pill.warn{color:var(--hh-warn-t);border-color:rgba(184,134,47,.34);}',
  '.hh-pill.err{color:var(--hh-err-t);border-color:rgba(194,92,86,.34);}',
  // Znacznik zwoju jest chipem w liscie, nie odczytem stanu - dlatego
  // ma tlo, ale ten sam rozmiar i promien co badge.
  // 46 px, nie 52: przy 52 nazwa "Przykładowy Heros Alpha" byla ucinana
  // o ~8 px. Skrócony chip ("5 szt" / "brak") zajmuje 36 px, wiec 46
  // daje kolumnie stałą szerokość bez zjadania miejsca na nazwę.
  '.hh-hero-tag{min-width:46px;}',
  '.hh-hero-tag.ok{color:var(--hh-ok-t);background:rgba(90,158,115,.12);',
  'border-color:transparent;}',
  '.hh-hero-tag.brak{color:var(--hh-err-t);background:rgba(194,92,86,.12);',
  'border-color:transparent;}',
  '.hh-hero-tag.niepewne{color:var(--hh-fg-3);background:rgba(255,255,255,.05);',
  'border-color:transparent;}',

  /* ===================================================================== */
  /*  PRZYCISKI IKONY - neutralne, kolor tylko na hover                   */
  /* ===================================================================== */
  '.hh-ib,.hh-win-x{width:var(--hh-ib);height:var(--hh-ib);flex:0 0 auto;',
  'display:inline-flex;align-items:center;justify-content:center;padding:0;',
  'border:1px solid transparent;border-radius:var(--hh-r-sm);',
  'background:transparent;color:var(--hh-fg-3);cursor:pointer;',
  'font:400 13px/1 var(--hh-ui);',
  'transition:background var(--hh-t),color var(--hh-t),border-color var(--hh-t);}',
  '.hh-ib:hover,.hh-win-x:hover{background:var(--hh-bg-3);color:var(--hh-accent);',
  'border-color:var(--hh-line);}',
  '.hh-ib:active,.hh-win-x:active{background:#171a1f;}',
  '#hh-panel .hh-disc>svg{display:block;fill:#5865f2;',
  'transition:fill var(--hh-t);}',
  '#hh-panel .hh-disc:hover>svg{fill:#4752c4;}',
  // Znak zapytania: kolor w naglowku, nie osobna ikona. Wersja z gaszonym
  // kolorem tekstu wygladala spójniej, ale uzytkownik wolisz wersje
  // kolorowa - "lepiej wygladalo". 3.93:1 na tle, czyli powyzej progu
  // 3:1 dla grafik nietekstowych (WCAG 1.4.11), ale ponizej 4.5:1, ktore
  // dotyczy tylko tekstu. Dlatego znak nie jest jedynym nośnikiem
  // tej informacji - ma tez title i aria-label.
  '#hh-panel .hh-helpbtn>i{display:block;font-style:normal;color:#d9a441;',
  'font:700 15px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;',
  'text-align:center;transition:color var(--hh-t);}',
  '#hh-panel .hh-helpbtn:hover>i{color:#e8b955;}',

  /* ===================================================================== */
  /*  TRESC - jeden blok przewijania, jeden scrollbar                     */
  /* ===================================================================== */
  '#hh-panel .hh-body,.hh-win-bd{padding:var(--hh-s3);overflow-y:auto;flex:1;',
  'min-height:0;overscroll-behavior:contain;scrollbar-gutter:stable;',
  'scrollbar-width:thin;scrollbar-color:var(--hh-line-2) transparent;}',
  '.hh-logwin .hh-logs{padding:var(--hh-s1) 0;flex:1;min-height:0;',
  'overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable;',
  'scrollbar-width:thin;scrollbar-color:var(--hh-line-2) transparent;}',

  /* ===================================================================== */
  /*  KAFELKI - etykieta slabsza, wartosc dominujaca                       */
  /* ===================================================================== */
  '#hh-panel .hh-tiles{display:grid;grid-template-columns:repeat(2,1fr);',
  'gap:var(--hh-s2);padding-bottom:var(--hh-s3);}',
  '#hh-panel .hh-tile{min-width:0;padding:var(--hh-s2) 9px 9px;',
  'background:var(--hh-bg-2);border:1px solid var(--hh-line);',
  'border-radius:var(--hh-r-sm);',
  'transition:background var(--hh-t),border-color var(--hh-t);}',
  '#hh-panel .hh-tile>label{display:block;white-space:nowrap;overflow:hidden;',
  'text-overflow:ellipsis;}',
  '#hh-panel .hh-tile>b{display:block;margin-top:6px;',
  'font:500 15px/1.1 var(--hh-mono);',
  'font-variant-numeric:tabular-nums;letter-spacing:-.02em;color:var(--hh-fg);',
  'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
  // Stan pusty: mylilem sie w kolorze wartosci wygladalo jak bledna
  // wartosc. Ten sam znak w kolorze pomocniczym i mniejszy rozmiar
  // mowi "nie ma danych".
  '#hh-panel .hh-tile>b.pusty{color:var(--hh-fg-3);font-size:12px;',
  'font-weight:400;}',
  '#hh-panel .hh-tile.good{background:rgba(90,158,115,.09);',
  'border-color:rgba(90,158,115,.28);}',
  '#hh-panel .hh-tile.good>label{color:var(--hh-ok-t);}',
  '#hh-panel .hh-tile.hot{background:rgba(90,158,115,.14);',
  'border-color:rgba(90,158,115,.45);}',
  '#hh-panel .hh-tile.hot>label{color:var(--hh-ok-t);}',
  '#hh-panel .hh-tile.warn{background:rgba(184,134,47,.09);',
  'border-color:rgba(184,134,47,.30);}',
  '#hh-panel .hh-tile.warn>label{color:var(--hh-warn-t);}',

  /* ===================================================================== */
  /*  LISTA HEROSOW                                                         */
  /* ===================================================================== */
  // Bez kreski nad sekcja: panel ma dokladnie JEDNA linie podzialu -
  // nad stopka, bo stopka jest na stale i tresc przewija sie pod nia.
  // Dwie kreski w odstepie 12 px wygladaly jak podwojna linia.
  '#hh-panel .hh-heroes{padding-top:var(--hh-s3);}',
  // 40 px obrazu (naturalny rozmiar pliku to 48x48). Rozmiar jest sprzężony
  // z trzema innymi wartosciami - .hh-hero-none (niewidoczny slot dla
  // herosow bez obrazka), min-height wiersza i marginesy. Bez poszerzenia
  // wszystkich cterech wiersze z obrazkiem i bez rozjezdaja sie po
  // wysokosci.
  '#hh-panel .hh-hero{position:relative;display:flex;align-items:center;',
  'gap:var(--hh-s2);min-height:40px;',
  'padding:var(--hh-s2) var(--hh-s2) var(--hh-s2) 10px;',
  'border:1px solid transparent;border-radius:var(--hh-r-sm);',
  'background:transparent;cursor:pointer;text-align:left;',
  'transition:background var(--hh-t),border-color var(--hh-t);}',
  '#hh-panel .hh-hero+.hh-hero{margin-top:2px;}',
  '#hh-panel .hh-hero:hover{background:var(--hh-bg-3);}',
  '#hh-panel .hh-hero:focus-visible{outline:2px solid var(--hh-accent);',
  'outline-offset:-2px;}',
  // JEDEN sygnal zaznaczenia: tlo + obramowanie. Wczesniej bylo ich dwa
  // (tlo z obramowaniem I bialy pasek ::before z lewej), przez co aktywny
  // wiersz wygladal jak zaznaczony podwojnie.
  '#hh-panel .hh-hero.active{background:var(--hh-bg-3);',
  'border-color:var(--hh-line-2);}',
  // Slot 40x40 to kontener z przycięciem. Sprite'y NIE wchodza w calosci -
  // UI.avatar() mierzy obwiednie pikseli kazdego pliku, przycina do
  // tresci, skaluje do wysokosci slotu i stawia lewa krawedz na x = 0.
  // Bez tego lewe krawedzie rozjechaly sie o 15 px zrodlowych, a opka
  // mial 34,1 px postaci przy 39,2 px u kostka (pomiar 04.10).
  //
  // `object-fit` na .hh-av-img jest tylko stanem zapasowym na czas ladowania
  // i na wypadek, gdy pomiar obwiedni sie nie uda (brak CORS).
  '#hh-panel .hh-hero-img{width:var(--hh-av-kol,40px);height:40px;',
  'border-radius:var(--hh-r-xs);',
  'display:block;flex:0 0 auto;background:none;border:0;padding:0;',
  'position:relative;overflow:hidden;}',
  '#hh-panel .hh-av-img{position:absolute;left:0;top:0;display:block;}',
  // Slot na brakujacy obrazek: niewidoczny, ale rezerwuje 32 px, wiec
  // nazwy we wszystkich wierszach stoja w tym samym miejscu.
  '#hh-panel .hh-hero-none{display:block;visibility:hidden;',
  'width:var(--hh-av-kol,40px);height:40px;flex:0 0 auto;}',
  '#hh-panel .hh-hero-n{flex:1;min-width:0;text-align:left;}',
  '#hh-panel .hh-hero-n>b{display:block;font:500 12.5px/1.3 var(--hh-ui);',
  'color:var(--hh-fg-2);white-space:nowrap;overflow:hidden;',
  'text-overflow:ellipsis;}',
  '#hh-panel .hh-hero.active .hh-hero-n>b{color:var(--hh-fg);}',
  // Regula dla `.hh-hero-n>i` ("znaleziono N - X min temu") USUNIETA
  // 04.10 razem z samym tekstem - nikt o niego nie prosil. Licznik
  // "znalezionych" w naglowku zostal, bo tam o niego proszono.

  /* ===================================================================== */
  /*  STOPKA - poza obszarem przewijanym, wiec Start i Stop sa zawsze      */
  /*  dostepne. Wczesniej byly na koncu .hh-body i przy dlugiej liscie   */
  /*  wypadaly poza ekran.                                                 */
  /* ===================================================================== */
  '#hh-panel .hh-foot{flex:0 0 auto;padding:10px var(--hh-s3) var(--hh-s3);',
  'border-top:1px solid var(--hh-line);background:var(--hh-bg);}',
  '#hh-panel .hh-btns{display:grid;grid-template-columns:1fr 1fr;',
  'gap:var(--hh-s2);}',
  '#hh-panel .hh-hint{margin:var(--hh-s2) 0 0;font:400 10.5px/1.4 var(--hh-ui);',
  'color:var(--hh-warn-t);}',
  // Linia jest pusta przy kazdym normalnym stanie, wiec nie rezerwuje
  // miejsca. Wypelnia sie wylacznie wtedy, gdy Start jest zgaszony z
  // powodu bledu konfiguracji - a nie dlatego, ze bot juz jedzie
  // (to widae w badge w naglowku).
  '#hh-panel .hh-hint:empty{display:none;}',

  /* ===================================================================== */
  /*  PRZYCISKI TEKSTOWE - primary / secondary / tertiary                  */
  /* ===================================================================== */
  '.hh-btn,.hh-row-b button{height:var(--hh-btn-h);border-radius:var(--hh-r-sm);',
  'cursor:pointer;font:500 12px/1 var(--hh-ui);letter-spacing:.01em;',
  'border:1px solid transparent;',
  'transition:background var(--hh-t),border-color var(--hh-t),color var(--hh-t);}',
  '.hh-btn.go,.hh-row-b button.pri{background:var(--hh-accent);',
  'color:var(--hh-on-accent);border-color:var(--hh-accent);font-weight:600;}',
  '.hh-btn.go:hover,.hh-row-b button.pri:hover{background:#6d9ddd;',
  'border-color:#6d9ddd;}',
  '.hh-btn.go:active,.hh-row-b button.pri:active{background:#4a7cc0;',
  'border-color:#4a7cc0;}',
  '.hh-btn.stop,.hh-row-b button.sec{background:transparent;color:var(--hh-fg-2);',
  'border-color:var(--hh-line-2);}',
  '.hh-btn.stop:hover,.hh-row-b button.sec:hover{background:var(--hh-bg-3);',
  'color:var(--hh-fg);border-color:var(--hh-line-2);}',
  '.hh-btn.stop:active,.hh-row-b button.sec:active{background:#171a1f;}',
  // Trzeciorzedny: bez obramowania, najslabszy kontrast. Wyczyszczenie
  // pola to nie jest akcja glowna tego okna.
'.hh-row-b button.ter{background:transparent;color:var(--hh-fg-3);',
'border-color:transparent;font-weight:400;flex:0 0 auto;}',
'.hh-row-b button.ter:hover{background:var(--hh-bg-3);color:var(--hh-fg-2);}',
  // Stan potwierdzenia akcji destrukcyjnej: ten sam rozmiar i kadr,
  // zmieniona tylko waga i kolor - nie rozszerza sie i nie skacze.
'.hh-row-b button.potwierdzenie{color:var(--hh-warn-t);',
'border-color:rgba(184,134,47,.45);font-weight:600;}',
  // Kolejnosc od lewej: Zapisz, Wyslij test, Wyczysc. Kazdy przycisk
  // trzyma szerokosc tresci - rozciaganie rozjezdzalo wiersz, a
  // odpychanie gestow destrukcyjnych do prawej mylilo hierarchie.
'.hh-row-b{display:flex;gap:var(--hh-s2);margin-top:10px;}',
'.hh-row-b button{flex:0 0 auto;}',
'.hh-row-b button.pri{min-width:96px;}',
  // Wylaczony przycisk: 0.4 alpha daje ~2.3:1. AA nie dotyczy elementow
  // nieaktywnych, wiec wystarczy czytelnosc - ale kadr zostaje, zeby
  // "Stop" nadal byl rozpoznawalny jako przycisk.
  '.hh-btn:disabled,.hh-row-b button:disabled{opacity:.45;cursor:not-allowed;}',
  '.hh-btn:disabled:hover,.hh-row-b button:disabled:hover{background:inherit;',
  'border-color:inherit;color:inherit;}',

  /* ===================================================================== */
  /*  POLE + MASKA                                                          */
  /* ===================================================================== */
  '.hh-inp{width:100%;padding:7px var(--hh-s2);',
  'border:1px solid var(--hh-line-2);border-radius:var(--hh-r-sm);',
  'background:var(--hh-bg-2);color:var(--hh-fg);',
  'font:400 11.5px/1.4 var(--hh-mono);}',
  '.hh-inp::placeholder{color:var(--hh-fg-3);opacity:1;}',
  '.hh-inp:hover{border-color:rgba(255,255,255,.2);}',
  '.hh-inp:focus{outline:none;border-color:var(--hh-accent);',
  'box-shadow:0 0 0 2px rgba(91,143,214,.22);}',
  '.hh-inp[aria-invalid="true"]{border-color:var(--hh-err-t);}',
  '  .hh-inp-wrap{position:relative;}',
  '.hh-inp-wrap .hh-inp{padding-right:66px;}',
  // Pole jako calosc: etykieta, pole, pomoc, komunikat. Odstepy 8 px
  // wewnatrz bloku - komunikat bledu jest DOKladnie pod polem, a nie
  // pod accordionem (wczesniej byl pod nim, przez co blad walidacji
  // pojawial sie 150 px od przyczyny).
  '.hh-field{display:block;}',
  '.hh-field>.hh-lbl{margin-bottom:var(--hh-s2);}',
  '.hh-field-hint{margin:var(--hh-s2) 0 0;font:400 11px/1.45 var(--hh-ui);',
  'color:var(--hh-fg-3);}',
  '.hh-field-hint:empty{display:none;}',
  // Przycisk maski - ta sama receptura co ikony w naglowku, tylko
  // mniejszy, bo musi zmiescic sie w polu 32 px.
  '.hh-reveal{position:absolute;right:5px;top:50%;',
  'transform:translateY(-50%);height:22px;padding:0 6px;',
  'border:1px solid transparent;border-radius:var(--hh-r-xs);',
  'background:transparent;color:var(--hh-fg-3);cursor:pointer;',
  'font:500 10px/1 var(--hh-ui);letter-spacing:.04em;',
  'text-transform:uppercase;',
  'transition:background var(--hh-t),color var(--hh-t);}',
  '.hh-reveal:hover{background:var(--hh-bg-3);color:var(--hh-accent);}',
  '.hh-reveal[aria-pressed="true"]{color:var(--hh-fg-2);',
  'border-color:var(--hh-line);}',
  // Rytm pionowy okna: 8 wewnatrz pola, 12 miedzy blokami. Wczesniej
  // byly trzy rozne odstepy - 8, 16 i 10 px.
  '.hh-setwin-bd>.hh-acc{margin-top:var(--hh-s3);}',
  '.hh-setwin-bd>.hh-row-b{margin-top:var(--hh-s3);}',
  '.hh-msg{font:500 11px/1.45 var(--hh-ui);margin:var(--hh-s2) 0 0;}',
  '.hh-msg:empty{display:none;}',
  '.hh-msg.ok{color:var(--hh-ok-t);}',
  '.hh-msg.err{color:var(--hh-err-t);}',

  /* ===================================================================== */
  /*  AKORDEON - 120 ms, zero animacji przy prefers-reduced-motion          */
  /* ===================================================================== */
  '.hh-acc{margin-top:var(--hh-s4);border:1px solid var(--hh-line);',
  'border-radius:var(--hh-r-sm);background:var(--hh-bg-2);}',
  '.hh-acc>summary{list-style:none;cursor:pointer;padding:var(--hh-s2) 10px;',
  'display:flex;align-items:center;justify-content:space-between;',
  'gap:var(--hh-s2);font:500 11px/1.4 var(--hh-ui);color:var(--hh-fg-2);',
  'transition:color var(--hh-t);}',
  '.hh-acc>summary::-webkit-details-marker{display:none;}',
  '.hh-acc>summary::after{content:"+";flex:0 0 auto;color:var(--hh-fg-3);',
  'font:400 13px/1 var(--hh-ui);}',
  '.hh-acc[open]>summary::after{content:"\\2212";}',
  '.hh-acc>summary:hover{color:var(--hh-fg);}',
  '.hh-acc-bd{padding:var(--hh-s2) 10px 10px;',
  'border-top:1px solid var(--hh-line);',
  'animation:hh-akordeon 120ms ease-out;}',
  '@keyframes hh-akordeon{from{opacity:0;transform:translateY(-2px);}',
  'to{opacity:1;transform:none;}}',

  /* ===================================================================== */
  /*  OKNO POMOCY                                                          */
  /* ===================================================================== */
  // Wszystkie sekcje sa zwijane i wszystkie maja ten sam stan poczatkowy,
  // wiec okno po otwarciu jest spojnym spisem tematow. Odstepy daje sam
  // .hh-acc (16 px) - nie ma zadnego recznie dostawianego marginesu.
  '.hh-helpwin p{font:400 12.5px/1.6 var(--hh-ui);color:var(--hh-fg-2);margin:0;}',
  // Tabela komend: kolumna komendy o stalej szerokosci, opisy wyrównane
  // do gory. Przy "auto" chipy dostawaly rozna szerokosc, wiec nie bylo
  // w czym wyrównac ich krawedzi.
  '.hh-helpwin dl{display:grid;grid-template-columns:112px 1fr;',
  'gap:var(--hh-s2) var(--hh-s3);margin:0;align-items:start;}',
  '.hh-helpwin dt{margin:0;}',
  '.hh-helpwin dt kbd{display:flex;align-items:center;justify-content:center;',
  'height:20px;padding:0 6px;border:1px solid var(--hh-line-2);',
  'border-radius:var(--hh-r-xs);background:var(--hh-bg-2);',
  'font:500 11px/1 var(--hh-mono);color:var(--hh-fg);white-space:nowrap;}',
  '.hh-helpwin dd{margin:0;font:400 11.5px/1.5 var(--hh-ui);',
  'color:var(--hh-fg-3);padding-top:2px;}',
  // Nota pod tabela komend: kreska z lewej zamiast ramki - wskazuje, ze
  // to przypis, nie kolejna sekcja. Wczesniej byla zwyklym akapitem
  // przyklejonym do tabeli.
  //
  // Selektor MUSI byc ".hh-helpwin p.hh-note", a nie ".hh-note":
  // ".hh-helpwin p" ma specyficznosc 0,1,1 i wygrywal z 0,1,0, przez co
  // nota dostawala akapitowe 12.5 px i margines 0 - czyli wygladala
  // dokladnie tak jak przed zmiana.
  '.hh-helpwin p.hh-note,.hh-setwin p.hh-note{margin:var(--hh-s3) 0 0;',
  'padding-left:var(--hh-s2);border-left:1px solid var(--hh-line-2);',
  'font:400 11px/1.5 var(--hh-ui);color:var(--hh-fg-3);}',
  '.hh-steps{margin:0;padding-left:18px;font:400 11.5px/1.6 var(--hh-ui);',
  'color:var(--hh-fg-2);}',
  '.hh-steps li{margin:2px 0;padding-left:2px;}',
  '.hh-steps li::marker{color:var(--hh-fg-3);',
  'font-variant-numeric:tabular-nums;}',

  /* ===================================================================== */
  /*  LOG                                                                   */
  /* ===================================================================== */
  '.hh-log{display:flex;gap:var(--hh-s2);',
  'padding:2px 10px 2px var(--hh-s2);border-left:2px solid transparent;',
  'font:400 11px/1.55 var(--hh-mono);}',
  '.hh-log>time{color:var(--hh-fg-3);flex:0 0 auto;}',
  '.hh-log>span{min-width:0;}',
  '.hh-log.info{border-left-color:var(--hh-line-2);}',
  '.hh-log.info>span{color:var(--hh-fg-3);}',
  '.hh-log.ok{border-left-color:var(--hh-ok);}',
  '.hh-log.ok>span{color:var(--hh-ok-t);}',
  '.hh-log.warn{border-left-color:var(--hh-warn);}',
  '.hh-log.warn>span{color:var(--hh-warn-t);}',
  '.hh-log.error{border-left-color:var(--hh-err);}',
  '.hh-log.error>span{color:var(--hh-err-t);}',
  '.hh-log.cmd{border-left-color:var(--hh-fg-3);}',
  '.hh-log.cmd>span{color:var(--hh-fg);}',

  /* ===================================================================== */
  /*  SCROLLBAR - 5 px, kciuk neutralny, szyna przezroczysta               */
  /* ===================================================================== */
  '#hh-panel .hh-body::-webkit-scrollbar,.hh-win-bd::-webkit-scrollbar,',
  '.hh-logs::-webkit-scrollbar{width:5px;}',
  '#hh-panel .hh-body::-webkit-scrollbar-thumb,',
  '.hh-win-bd::-webkit-scrollbar-thumb,',
  '.hh-logs::-webkit-scrollbar-thumb{background:var(--hh-line-2);',
  'border-radius:3px;}',
  '#hh-panel .hh-body::-webkit-scrollbar-track,',
  '.hh-win-bd::-webkit-scrollbar-track,',
  '.hh-logs::-webkit-scrollbar-track{background:transparent;}',

  /* ===================================================================== */
  /*  FOKUS                                                                 */
  /* ===================================================================== */
  '#hh-panel :focus-visible,.hh-setwin :focus-visible,',
  '.hh-helpwin :focus-visible,.hh-logwin :focus-visible{',
  'outline:2px solid var(--hh-accent);outline-offset:1px;}',

  /* ===================================================================== */
  /*  MNIEJSZE EKRANY                                                       */
  /* ===================================================================== */
  '@media (max-width:900px){',
  '#hh-panel{width:268px;right:var(--hh-s2);bottom:var(--hh-s2);',
  'max-height:calc(100vh - var(--hh-s2)*2);}',
  '.hh-setwin,.hh-helpwin,.hh-logwin{left:var(--hh-s2);bottom:var(--hh-s2);',
  'max-height:calc(100vh - var(--hh-s2)*2);}',
  '}',
  // Dwa jedyne uzycia !important w calym arkuszu: preferencje systemowe
  // maja w wyzszosci od wszystkiego.
  '@media (prefers-reduced-motion:reduce){',
  '#hh-panel *,.hh-setwin *,.hh-helpwin *,.hh-logwin *{',
  'transition:none!important;animation:none!important;}',
  '}',
].join('')

  const UI = {
    cells: {},
    tiles: {},
    // Etykiety kafelkow po kluczu - set() uzywa ich do tytulu i
    // aria-label, zeby po odtworzeniu panelu nie zostalo "brak danych"
    // przy realnej wartosci.
    cellNames: {},
    colors: {
      // Kolory semantyczne dla badge'a stanu. Panel ustawia je inline
      // (kolor kropki, tekstu, tla badge'a), wiec musza byc zgodne
      // z tokenami w CSS_HEROS_HUNTER. Kontrast na tle #14161a:
      // STOPPED 4.6:1, WAIT/HOME 6.1:1, SCAN/GO/FOUND 5.4:1.
      STOPPED: '#8a9099', WAIT: '#b8862f', SCAN: '#5a9e73',
      GO: '#5a9e73', FOUND: '#5a9e73', HOME: '#b8862f',
    },

    css: CSS_HEROS_HUNTER,

    /* ---------------------------------------------------------------
     *  OBRAZEK HEROSA
     *
     *  Zwykly <img src> z adresem podanym w CONFIG.HEROES[].img.
     *  Dwie zasady:
     *    1. gdy obrazek się nie wczyta - znika i zostaje kropka,
     *       zamiast rozbitej ikony / pustego prostokata
     *    2. gdy `img` jest puste - od razu kropka, bez pustego <img>
     *  --------------------------------------------------------------- */

    // Rozmiar slotu wg klasy. CSS jest zrodlem prawdy, ale w chwili
    // pomiaru obrazek moze nie byc jeszcze w DOM - wtedy
    // getBoundingClientRect zwraca 0. Stad male mapowanie.
    _avRozmiar: { 'hh-hero-img': 40, 'hh-av-head': 24 },

    // Adres URL -> { nw, nh, x, y, w, h } obwiedni tresci, albo null.
    _avBox: {},

    // Obwiednia pikseli z widocznym alpha. Promise, bo wymaga wczytania
    // obrazka do canvasa.
    _avObwiednia(adres) {
      if (Object.prototype.hasOwnProperty.call(this._avBox, adres)) {
        return Promise.resolve(this._avBox[adres]);
      }
      const self = this;
      return new Promise(function (done) {
        const im = new Image();
        im.crossOrigin = 'anonymous';
        im.referrerPolicy = 'no-referrer';
        im.onload = function () {
          const nw = im.naturalWidth, nh = im.naturalHeight;
          if (!nw || !nh) { self._avBox[adres] = null; done(null); return; }
          let wynik = null;
          try {
            const c = document.createElement('canvas');
            c.width = nw; c.height = nh;
            const x = c.getContext('2d', { willReadFrequently: true });
            x.drawImage(im, 0, 0);
            const d = x.getImageData(0, 0, nw, nh).data;
            let minX = nw, minY = nh, maxX = -1, maxY = -1;
            for (let y = 0; y < nh; y++) {
              const r = y * nw * 4;
              for (let xx = 0; xx < nw; xx++) {
                if (d[r + xx * 4 + 3] > 12) {
                  if (xx < minX) minX = xx;
                  if (xx > maxX) maxX = xx;
                  if (y < minY) minY = y;
                  if (y > maxY) maxY = y;
                }
              }
            }
            if (maxX < 0) wynik = null;            // calkiem przezroczysty
            else wynik = { nw: nw, nh: nh, x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
          } catch (e) {
            // getImageData rzuca SecurityError bez CORS - zostajemy
            // przy object-fit z CSS. Wynik zapamietujemy, zeby nie
            // probowac ponownie przy kazdym build().
            wynik = null;
          }
          self._avBox[adres] = wynik;
          done(wynik);
        };
        im.onerror = function () { self._avBox[adres] = null; done(null); };
        im.src = adres;
      });
    },

    // Szerokosc kolumny z obrazkami = najszersza tresc posrod zmierzonych.
    // Wywolywana po kazdym pomiarze; oblicza od nowa, wiec obrazki
    // wczytajace sie pozniej nie zostawiaja za soba za waskiej kolumny.
    //
    // Zaokraglamy w gore do pelnego px - inaczej przegladarka zaokragli
    // szerokosc slotu w dol i trzyma bedzie 0,3 px rozjazdu miedzy
    // wierszami, czyli dokladnie ten sam objaw o mniejszej skali.
    _avUstawKol() {
      const panel = document.getElementById('hh-panel');
      if (!panel) return 0;
      const sloty = panel.querySelectorAll('.hh-hero-img[data-av-tresc-w]');
      let naj = 0;
      for (let i = 0; i < sloty.length; i++) {
        const w = parseFloat(sloty[i].dataset.avTrescW);
        if (w > naj) naj = w;
      }
      if (!naj) return 0;
      const kol = Math.ceil(naj);
      panel.style.setProperty('--hh-av-kol', kol + 'px');
      return kol;
    },

    avatar(cfg, cls) {
      const kropka = function () {
        // Zwykly slot 28x28 z ramka przerywana wygladal jak pusty
        // kwadrat i budzil pytania co to jest (04.10). Brak obrazka
        // = brak slota, a wiersz trzyma wysokosc przez min-height.
        const d = document.createElement('i');
        d.className = 'hh-hero-none';
        return d;
      };
      const adr = cfg && cfg.img;
      if (!adr) return kropka();

      const klasa = cls || 'hh-hero-img';
      // Slot z przyciemieniem. Trzyma wymiary z CSS i obcina to, co
      // z niego wystaje - sprite'y wchodza do srodka tylko w czesci.
      const box = document.createElement('span');
      box.className = klasa;

      const im = document.createElement('img');
      im.className = 'hh-av-img';
      im.alt = (cfg.nazwa || '') + '';
      im.referrerPolicy = 'no-referrer';
      // Stan zapasowy, zanim poznamy obwiednie - i jedyna obsluga
      // przypadku, gdy pomiar sie nie uda.
      im.style.width = '100%';
      im.style.height = '100%';
      im.style.objectFit = 'contain';
      im.addEventListener('error', function () {
        // obrazek się nie wczytal - wstawiamy kropke zamiast dziury
        if (box.parentNode) box.parentNode.replaceChild(kropka(), box);
      });
      box.appendChild(im);

      const self = this;
      // `imgBox` z CONFIG.HEROES dziala TYLKO na liscie. Naglowek ma
      // swoj rozmiar (24 px) i nie moze urosnac - jego wysokosc jest
      // sprzezona z calym paskiem tytulu.
      const bok = (klasa === 'hh-hero-img' && Number(cfg.imgBox) > 0)
        ? Number(cfg.imgBox)
        : (this._avRozmiar[klasa] || 40);
      // Slot dostaje WYSOKOSC od razu, a fitting do tresci dzieje sie
      // w `load` (ponizej). Wazne: `.hh-hero` ma tylko `min-height`, nie
      // `height` - wiec wiersz sam urodnie od slotu, bez zmian w CSS.
      //
      // SZEROKOSC slotu celowo NIE ustawiamy tutaj - pochodzi z
      // `--hh-av-kol` w CSS, ktore ustawia _avUstawKol(). Powod: przy
      // `imgBox: 53` slot opka byl szeroki, wiec jego nazwa startowala
      // 13 px dalej niz pozostale. Kolumna musi byc jedna dla wszystkich
      // wierszy, inaczej nazwy sie rozjezdzaja.
      box.style.height = bok + 'px';
      im.addEventListener('load', function () {
        self._avObwiednia(adr).then(function (bb) {
          if (!bb || !im.isConnected) return;
          // Dopasowanie po WYSOKOSCI tresci: wszystkie postaci maja
          // wtedy identyczna wysokosc, a nie identyczna szerokosc -
          // postaci sa roznej szerokosci i nie powinny byc rozciagane.
          const skala = bok / bb.h;
          im.style.objectFit = 'fill';
          im.style.width = (bb.nw * skala) + 'px';
          im.style.height = (bb.h * skala) + 'px';
          // lewa krawedz tresci na x = 0, tresc wyrownana w pionie
          im.style.left = (-bb.x * skala) + 'px';
          im.style.top = ((bok - bb.h * skala) / 2 - bb.y * skala) + 'px';
          // Szerokosc TRESCI (bez przezroczystych marginesow) - to ona
          // wyznacza kolumne, nie szerokosc calego pliku.
          box.dataset.avTrescW = String(Math.round(bb.w * skala * 100) / 100);
          self._avUstawKol();
        });
      });
      im.src = adr;
      return box;
    },

    // Chip ze stanem zwoju przy herosie.
    //
    // ── POPRAWKA 04.10 po zgloszeniu uzytkownika ──
    // Wczesniej stan "nie znam item-tpl" dawal napis "nie wiem" i byl
    // zuzywalny: po skanie ekwipunku KAZDY wynik jest jednoznaczny.
    // Albo skrypt znalazl zwój i zna liczbe, albo go nie ma i "przywo!"
    // nie zadziala - obie odpowiedzi sprowadzaja sie do jednej:
    //
    //     nie ma zwoju w ekwipunku  ->  brak przywo
    //
    // "nie wiem" zostaje JEDYNE wtedy, gdy skan sie jeszcze nie wykonal
    // (np. TIPS.allTips nie wczytany, pusty worek). Wtedy to jest prawda,
    // a nie ulga. W drugim przypadku "nie wiem" wisialoby do konca swiata
    // i niczego nie wnosilo - a uzytkownik wlasnie takiego napisu nie
    // chcial widziec.
    znacznikZwoju(cfg) {
      const z = GAME.zwojStan(cfg);
      const tag = document.createElement('span');
      tag.className = 'hh-hero-tag';
      tag.setAttribute('data-zw', cfg.key);

      let krotkie, pelne, klasa;
      if (!z.tpl) {
        if (GAME.zwojeSkanSieUdalo()) {
          // Skan przeszedl i nie znalazl zwoju dla tego herosa.
          klasa = 'brak';
          krotkie = 'brak';
          pelne = 'nie ma zwoju przywołania w ekwipunku - skan zrobiony, '
            + 'nie znaleziono. "przywo!" nie zadziała.';
        } else {
          klasa = 'niepewne';
          krotkie = 'nie wiem';
          pelne = 'skan ekwipunku jeszcze się nie wykonał - poczekaj '
            + '20 s albo otwórz worek';
        }
      } else if (z.ile > 0) {
        klasa = 'ok';
        krotkie = z.ile + ' szt';
        pelne = z.ile + ' szt przywołań';
      } else if (typeof z.ileOstatnio === 'number' && z.ile === null) {
        // Slotu nie widac - worek zamkniety. Ostatnio widziana liczba
        // jest lepsza niz klamliwe "brak".
        klasa = 'niepewne';
        krotkie = z.ileOstatnio + ' szt';
        pelne = 'nie widzę slotu, ostatnio było ' + z.ileOstatnio + ' szt (' + z.powod + ')';
      } else {
        klasa = 'brak';
        krotkie = 'brak';
        pelne = 'brak przywołań';
      }

      tag.classList.add(klasa);
      tag.textContent = krotkie;
      tag.title = pelne + (cfg.zwój ? ' · ' + cfg.zwój
        : ' · brak wpisu `zwój` w CONFIG.HEROES');
      tag.setAttribute('aria-label', pelne);
      return tag;
    },

    // Przepisuje chipy zwojow bez przebudowy panelu. Wywolywane przez
    // GAME.startZwoje() co 20 s. Pelne build() przy kazdej zmianie
    // przeskakiwaloby panel na goraco i gubilo pozycje okna.
    odswiezZnacznikiZwojow() {
      const lista = MAPS.heroList();
      const panel = document.querySelector('#hh-panel');
      if (!panel) return 0;
      let n = 0;
      for (let i = 0; i < lista.length; i++) {
        const cfg = lista[i];
        const stary = panel.querySelector('.hh-hero[data-key="' + cfg.key + '"] [data-zw]');
        if (!stary) continue;
        const nowy = this.znacznikZwoju(cfg);
        stary.parentNode.replaceChild(nowy, stary);
        n++;
      }
      return n;
    },

    /* Znak Discorda jako inline SVG. <img> wymagalyby pliku na
       * dysku albo dodatkowego requestu, a SVG skaluje sie czysto
       * i nie ma problemu z rozmazaniem pikseli. */
    discordMark() {
      const NS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('width', '17');
      svg.setAttribute('height', '17');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('focusable', 'false');
      const p = document.createElementNS(NS, 'path');
      p.setAttribute('d', 'M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.41891.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.41891.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z');
      // Kolor ikony bierze CSS: #hh-panel .hh-disc>svg{fill:#5865f2}.
      // Atrybut fill na <path> ma wyzszy priorytet niz dziedziczenie
      // po CSS, wiec bez jego usuniecia regula fill z arkusza nigdy by
      // nie zadzialala - ikona zostalaby wpisana na sztywno w JS.
      svg.appendChild(p);
      return svg;
    },

    build() {
      const old = document.getElementById('hh-panel');
      const self = this;

      // ---- fokus do odtworzenia -------------------------------------------
      // UI.build() kasuje panel i tworzy nowy, wiec fokus leci. Bez tego
      // wybranie herosa z klawiatury wracalo do poczatku dokumentu i trzeba
      // bylo od nowa wchodc Tabem.
      let fokusHero = null;
      const aktywny = document.activeElement;
      if (aktywny && aktywny.closest && old && old.contains(aktywny)) {
        const w = aktywny.closest('.hh-hero');
        if (w) fokusHero = w.getAttribute('data-key');
      }
      if (old && old.parentNode) old.parentNode.removeChild(old);

      let styleHH = document.getElementById('hh-style');
      if (!styleHH) {
        styleHH = document.createElement('style');
        styleHH.id = 'hh-style';
        (document.head || document.documentElement).appendChild(styleHH);
      }
      styleHH.textContent = this.css;

      const el = function (tag, cls, txt) {
        const d = document.createElement(tag);
        if (cls) d.className = cls;
        if (txt !== undefined && txt !== null) d.textContent = txt;
        return d;
      };
      const ikona = function (klasa, tytul, akcja, tresc) {
        const b = el('button', 'hh-ib' + (klasa ? ' ' + klasa : ''));
        b.title = tytul;
        b.setAttribute('aria-label', tytul);
        b.setAttribute('data-akcja', akcja);
        if (tresc) b.appendChild(tresc);
        return b;
      };

      const box = el('div');
      box.id = 'hh-panel';

      /* ---- naglowek ---- */
      const head = el('div', 'hh-head');
      const title = el('div', 'hh-title');
      title.appendChild(el('b', null, 'Heros Hunter'));
      const h = MAPS.hero();

      const sub = el('div', 'hh-sub');
      this.headAv = document.createElement('span');
      this.headAv.className = 'hh-av';
      if (h) this.headAv.appendChild(this.avatar(h, 'hh-av-head'));
      sub.appendChild(this.headAv);
      this.heroSub = el('i', null, h ? h.nazwa : '?');
      sub.appendChild(this.heroSub);
      title.appendChild(sub);
      head.appendChild(title);

      // Badge stanu. role=status + aria-live: czytnik ekranu ma wypowiedziec
      // zmiane stanu - inaczej jedyna informacja o tym, ze bot ruszyl, to
      // kolor kropki.
      this.dot = el('i');
      this.stateTxt = el('span', null, 'STOPPED');
      this.stateTxt.setAttribute('role', 'status');
      this.stateTxt.setAttribute('aria-live', 'polite');
      this.stateTxt.setAttribute('aria-atomic', 'true');
      const st = el('div', 'hh-pill');
      st.appendChild(this.dot);
      st.appendChild(this.stateTxt);
      head.appendChild(st);
      this.pillBox = st;

      // Trzy przyciski ikony w jednym wzorcu .hh-ib. Wczesniej zwijanie
      // nie mialo ani title, ani aria-label - dla czytnika ekranu to byl
      // przycisk bez nazwy.
      const bWh = ikona('hh-disc', 'Webhook Discorda', 'webhook', this.discordMark());
      bWh.setAttribute('aria-haspopup', 'dialog');
      bWh.setAttribute('aria-expanded', 'false');
      bWh.setAttribute('aria-controls', 'hh-setwin');
      const pyt = document.createElement('i');
      pyt.textContent = '?';
      const bHelp = ikona('hh-helpbtn', 'Jak to działa', 'help', pyt);
      bHelp.setAttribute('aria-haspopup', 'dialog');
      bHelp.setAttribute('aria-expanded', 'false');
      bHelp.setAttribute('aria-controls', 'hh-helpwin');
      const min = ikona('', 'Zwiń panel', 'min', document.createTextNode('–'));
      min.setAttribute('aria-expanded', 'true');
      head.appendChild(bWh);
      head.appendChild(bHelp);
      head.appendChild(min);

      this.minBtn = min;
      if (STORE.data.uiMin) {
        box.classList.add('min');
        min.textContent = '+';
        min.title = 'Rozwiń panel';
        min.setAttribute('aria-label', 'Rozwiń panel');
        min.setAttribute('aria-expanded', 'false');
      }

      /* ---- tresc ---- */
      const body = el('div', 'hh-body');
      const tiles = [['Znalezionych', 'found'], ['Atak za', 'atak']];
      const grid = el('div', 'hh-tiles');
      for (let i = 0; i < tiles.length; i++) {
        const t = el('div', 'hh-tile idle');
        // label powiazany z wartoscia - bez tego czytnik ekranu czyta
        // "ZNALEZIONYCH" i znak jako dwa osobne wezly.
        const lb = el('label', null, tiles[i][0]);
        const lbId = 'hh-t-' + tiles[i][1];
        lb.setAttribute('for', lbId);
        t.appendChild(lb);
        const v = el('b', 'pusty', '–');
        v.id = lbId;
        v.title = 'brak danych';
        v.setAttribute('aria-label', tiles[i][0] + ': brak danych');
        t.appendChild(v);
        grid.appendChild(t);
        this.cells[tiles[i][1]] = v;
        this.tiles[tiles[i][1]] = t;
        this.cellNames[tiles[i][1]] = tiles[i][0];
      }
      body.appendChild(grid);

      // Kafelki startuja od "–" i NIKT ich nie uzupelnial z magazynu.
      // Przy kazdym odswiezeniu panel pokazywal "–", mimo ze licznik
      // w STORE byl zapisany - wygladalo jak reset, a dane byly na
      // miejscu. Samo UI.set('found', ...) wolalo sie tylko w found(),
      // czyli dopiero po NASTEPNYM znalezieniu.
      if (STORE.data.found) {
        this.set('found', String(STORE.data.found));
        this.tile('found', 'good');
      }
      // 'atak' celowo zostaje "–": to zywy licznik (odliczanie do
      // ataku albo godzina powrotnego zalogowania), nie ma czego
      // przywracac z magazynu.

      /* ---- lista herosow ---- */
      const wszyscy = MAPS.heroList();
      if (wszyscy.length > 1) {
        const sekcja = el('div', 'hh-heroes');
        // radiogroup + role=radio: lista jest wyborem jednej rzeczy, wiec
        // nie powinna byc zbiorem divow dla czytnika ekranu ani dla Tabu.
        sekcja.setAttribute('role', 'radiogroup');
        sekcja.setAttribute('aria-label', 'Wybór herosa');
        const hd = el('div', 'hh-heroes-hd');
        hd.appendChild(el('span', null, 'HEROSI'));
        sekcja.appendChild(hd);

        const biezacy = MAPS.hero();
        for (let i = 0; i < wszyscy.length; i++) {
          const hh = wszyscy[i];
          const wybrany = !!(biezacy && biezacy.key === hh.key);
          const wiersz = el('div', 'hh-hero' + (wybrany ? ' active' : ''));
          wiersz.setAttribute('data-key', hh.key);
          wiersz.setAttribute('role', 'radio');
          wiersz.setAttribute('aria-checked', wybrany ? 'true' : 'false');
          // Roving tabindex: jeden przystanek Tabu na liste, reszta strzalkami.
          // Bez tego 6 herosow = 6 przystankow, a zaden nie byl w ogole
          // osiagalny (div bez tabindex ma tabIndex -1).
          wiersz.setAttribute('tabindex', wybrany ? '0' : '-1');
          wiersz.appendChild(this.avatar(hh, 'hh-hero-img'));

          const nazwa = el('div', 'hh-hero-n');
          const nb = el('b', null, hh.nazwa);
          nb.title = hh.nazwa;   // nazwa moze byc ucieta - pelna w podpowiedzi
          nazwa.appendChild(nb);
          // Pod nazwa NIE ma juz "znaleziono N · X min temu" (usuniete
          // 04.10 na zadanie - nikt o to nie prosil). Dane zostaja w
          // STORE.data.heroStats, bo z nich korzysta licznik "znalezionych"
          // w naglowku - to ten sam komunikat, ale w miejscu, gdzie o niego
          // proszono.
          wiersz.appendChild(nazwa);

          wiersz.appendChild(this.znacznikZwoju(hh));

          sekcja.appendChild(wiersz);
        }
        body.appendChild(sekcja);
      }

      /* ---- stopka: zawsze widoczna ---- */
      const foot = el('div', 'hh-foot');
      const btns = el('div', 'hh-btns');
      const bGo = el('button', 'hh-btn go', 'Start');
      const bStop = el('button', 'hh-btn stop', 'Stop');
      bGo.setAttribute('data-akcja', 'start');
      bStop.setAttribute('data-akcja', 'stop');
      btns.appendChild(bGo);
      btns.appendChild(bStop);
      foot.appendChild(btns);
      // Referencje dla state(). Bez tych dwoch linii przyciski nigdy nie
      // byly wylaczane - state() sprawdza if (this.btnGo), wiec cicho
      // robil nic. Zgubione przy przepisywaniu build() w rundzie 1.
      this.btnGo = bGo;
      this.btnStop = bStop;
      this.hintEl = el('p', 'hh-hint', '');
      foot.appendChild(this.hintEl);

      box.appendChild(head);
      box.appendChild(body);
      box.appendChild(foot);

      // Przyciski naglowka powstaja od nowa z aria-expanded="false", a
      // build() odpala takze zapisywanie webhooka - okno zostaje wtedy
      // otwarte, a stan na przycisku klamie. Odtwarzamy go z
      // RZECZYWISTYCH okien. Musi byc tutaj, a nie przy tworzeniu
      // przyciskow: head jest jeszcze nie dzieckiem box, wiec
      // box.querySelector zwracalo null i blok cicho nic nie robil.
      [['webhook', 'hh-setwin'], ['help', 'hh-helpwin']].forEach(function (para) {
        const w = document.getElementById(para[1]);
        const b = box.querySelector('[data-akcja="' + para[0] + '"]');
        if (b && w && w.classList.contains('open')) {
          b.setAttribute('aria-expanded', 'true');
        }
      });

      (document.body || document.documentElement).appendChild(box);
      this.przywrocPozycje(box, 'panel');
      this.kolo(body);

      /* ---- JEDEN delegat zamiast listenerow na kazdym elemencie ----
       * Wczesniej kazdy wiersz listy i kazdy przycisk dostawal wlasny
       * addEventListener przy kazdym UI.build(). Przy przebudowaniu
       * stare listenery ginely razem z panelem, ale kolo() dodawal nowy
       * do nowego .hh-body - po kilku przebudowaniach jedno kolo myszy
       * przewijalo o dwa kroki. Teraz panel ma dwa listenery.
       */
      box.addEventListener('click', function (e) {
        const cel = e.target;
        if (!cel || !cel.closest) return;
        const przycisk = cel.closest('[data-akcja]');
        if (przycisk && box.contains(przycisk)) {
          e.stopPropagation();
          const a = przycisk.getAttribute('data-akcja');
          if (a === 'start') BOT.start();
          else if (a === 'stop') BOT.stop(true);
          else if (a === 'webhook') self.setWindow();
          else if (a === 'help') self.helpWindow();
          else if (a === 'min') self.przełączMin();
          return;
        }
        const wiersz = cel.closest('.hh-hero');
        if (wiersz) BOT.wybierzHeroza(wiersz.getAttribute('data-key'));
      });

      box.addEventListener('keydown', function (e) {
        const cel = e.target;
        if (!cel || !cel.closest) return;
        const wiersz = cel.closest('.hh-hero');
        if (!wiersz) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          BOT.wybierzHeroza(wiersz.getAttribute('data-key'));
          return;
        }
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        const lista = box.querySelectorAll('.hh-hero');
        if (!lista.length) return;
        let i = -1;
        for (let k = 0; k < lista.length; k++) if (lista[k] === wiersz) { i = k; break; }
        const nastepny = lista[(i + (e.key === 'ArrowDown' ? 1 : lista.length - 1)) % lista.length];
        if (nastepny) { nastepny.focus(); }
      });

      this.drag(head, box, 'panel');
      for (let i = 0; i < LOG.lines.length; i++) this.log(LOG.lines[i]);
      this.state(BOT.state);

      if (fokusHero) {
        // Bez budowania selektora z cudzyslowami: '.hh-hero[data-key="x"]'
        // wyglada niezle, ale cudzyslow w wyrazeniu regularnym rozbija
        // tokenizer walidatora (_verifyConfig.js), ktory ucina komentarze
        // i stringi jednym przebiegiem. Po tym miejscu przestawal
        // widziec kode i zglaszal nieistniejacy blad GAME.stopAutofight().
        const wiersze = box.querySelectorAll('.hh-hero');
        for (let i = 0; i < wiersze.length; i++) {
          if (wiersze[i].getAttribute('data-key') === fokusHero) {
            wiersze[i].focus();
            break;
          }
        }
      }
    },

    /* ---------------------------------------------------------------
     *  OKNA DODATKOWE - jedna pozycja, jedno otwarte naraz
     *
     *  Wszystkie trzy okna staly w tym samym rogu (lewy dolny) na tym
     *  samym z-indexie. Otwarcie DEVLOGu przy otwartych Ustawieniach
     *  kladlo je na siebie i rozstrzygala kolejność w DOM, czyli
     *  na wierzchu lądalo to okno, ktorego nie chciałeś.
     * ------------------------------------------------------------- */

    okna: ['hh-setwin', 'hh-helpwin', 'hh-logwin'],

    otworz(win, wyzwalaczSel, focusSel) {
      this.okna.forEach(function (n) {
        const w = document.getElementById(n);
        if (w && w !== win) w.classList.remove('open');
      });
      // Ostatnio otwarte okno na wierzchu - licznik zamiast magicznej
      // liczby w kodzie.
      const panel = document.getElementById('hh-panel');
      const baza = panel
        ? parseInt(getComputedStyle(panel).getPropertyValue('--hh-z-win'), 10)
        : 0;
      this.oknaLicznik = (this.oknaLicznik || 0) + 1;
      if (baza) win.style.zIndex = String(baza + this.oknaLicznik);

      const triggery = document.querySelectorAll(
        '#hh-panel [data-akcja="webhook"],#hh-panel [data-akcja="help"]');
      for (let i = 0; i < triggery.length; i++) {
        triggery[i].setAttribute('aria-expanded',
          triggery[i].getAttribute('data-akcja') === wyzwalaczSel ? 'true' : 'false');
      }
      this.ostatniFokus = document.activeElement;
      win.classList.add('open');
      // Focus na wskazanym elemencie. Wczesniej szukaliśmy
      // '.hh-win-bd .hh-inp,.hh-win-bd kbd,.hh-win-x' - querySelector
      // zwraca pierwsze trafienie w kolejności DOKUMENTU, a przycisk
      // zamknięcia jest w nagłówku, czyli przed treścią. Otwarcie
      // Ustawień ustawiało fokus na X zamiast na polu.
      // Osobne zapytania, nie lista z przecinkiem. querySelector z lista
      // zwraca pierwsze trafienie w kolejnosci DOKUMENTU, a przycisk
      // zamkniecia siedzi w naglowku, czyli PRZED trescia - wygrywal
      // z polem i fokus ladowal na X zamiast w polu.
      const kandydaci = focusSel
        ? [win.querySelector(focusSel)]
        : [win.querySelector('.hh-win-bd .hh-inp'),
           win.querySelector('.hh-win-bd kbd'),
           win.querySelector('.hh-win-bd summary'),
           win.querySelector('.hh-win-x')];
      for (let i = 0; i < kandydaci.length; i++) {
        if (kandydaci[i] && kandydaci[i].focus) { kandydaci[i].focus(); break; }
      }
    },

    zamknijOkna() {
      let bylo = false;
      this.okna.forEach(function (n) {
        const w = document.getElementById(n);
        if (w && w.classList.contains('open')) { w.classList.remove('open'); bylo = true; }
      });
      const triggery = document.querySelectorAll(
        '#hh-panel [data-akcja="webhook"],#hh-panel [data-akcja="help"]');
      for (let i = 0; i < triggery.length; i++) triggery[i].setAttribute('aria-expanded', 'false');
      if (bylo && this.ostatniFokus && this.ostatniFokus.focus) {
        try { this.ostatniFokus.focus(); } catch (e) { /* element zniknal */ }
      }
      return bylo;
    },

    /* ---------------------------------------------------------------
     *  ZWIJANIE PANELU - stan w magazynie, nie tylko w sesji
     * ------------------------------------------------------------- */

    przełączMin() {
      const box = document.getElementById('hh-panel');
      if (!box) { this.build(); return; }
      const zwin = box.classList.toggle('min');
      const b = this.minBtn;
      if (b) {
        b.textContent = zwin ? '+' : '–';
        b.title = zwin ? 'Rozwiń panel' : 'Zwiń panel';
        b.setAttribute('aria-label', b.title);
        b.setAttribute('aria-expanded', zwin ? 'false' : 'true');
      }
      STORE.set({ uiMin: zwin });
    },

    /* ---------------------------------------------------------------
     *  POZYCJA OKIEN - w magazynie i przycięta do ekranu
     *
     *  Wczesniej pozycja znikala przy kazdym UI.build() (a build()
     *  odpala wybor herosa, "zapisz" w Ustawieniach i Alt+R) - panel
     *  wracał do prawego dolnego rogu za kazdym razem.
     * ------------------------------------------------------------- */

    przywrocPozycje(box, klucz) {
      const p = (STORE.data.uiPos || {})[klucz];
      if (!p) return;
      const w = box.offsetWidth, h = box.offsetHeight;
      const x = Math.round(Math.max(0, Math.min(window.innerWidth - w, p.l)));
      const y = Math.round(Math.max(0, Math.min(window.innerHeight - h, p.t)));
      box.style.left = x + 'px';
      box.style.top = y + 'px';
      box.style.right = 'auto';
      box.style.bottom = 'auto';
    },

    zapamietajPozycje(box, klucz) {
      const wszystkie = STORE.data.uiPos || {};
      const kopia = {};
      for (const k in wszystkie) {
        if (Object.prototype.hasOwnProperty.call(wszystkie, k)) kopia[k] = wszystkie[k];
      }
      kopia[klucz] = {
        l: parseInt(box.style.left, 10) || 0,
        t: parseInt(box.style.top, 10) || 0,
      };
      STORE.set({ uiPos: kopia });
    },

    /* ---------------------------------------------------------------
     *  DLACZEGO START JEST WYLACZONY
     *
     *  Zgaszony przycisk bez powodu wygląda jak awaria. Powod jest w
     *  podpowiedzi na przycisku, a widoczna linia pod przyciskami
     *  wypelnia sie TYLKO przy bledzie konfiguracji.
     * ------------------------------------------------------------- */

    powodStartu() {
      if (BOT.state !== 'STOPPED') return 'Bot już jedzie.';
      const hh = MAPS.hero();
      if (!hh) return 'W CONFIG.HEROES nie ma żadnego herosa.';
      if (!hh.route || !hh.route.length) {
        return 'Ten heros nie ma trasy w CONFIG - bot nie ma gdzie iść.';
      }
      return '';
    },

    // Tresc widoczna pod przyciskami - TYLKO dla bledu konfiguracji.
    //
    // Wczesniej stalo tu "Bot jedzie - zatrzymaj go przyciskiem Stop."
    // przy kazdym stanie, w ktorym bot pracowal, czyli w ~99% czasu.
    // Linia powtarzala badge z naglowka i tlumaczyla cos, o co nikt
    // nie pytal. Teraz jest pusta przy kazdym normalnym stanie, wiec
    // :empty w CSS zabija jej wysokosc.
    ostrzezenieStartu() {
      if (BOT.state !== 'STOPPED') return '';
      const hh = MAPS.hero();
      if (!hh) return 'W CONFIG.HEROES nie ma żadnego herosa - dodaj co najmniej jednego.';
      if (!hh.route || !hh.route.length) {
        return 'Ten heros nie ma trasy w CONFIG, więc bot nie ma gdzie iść.';
      }
      return '';
    },

    /* ---------------------------------------------------------------
     *  DEVLOG
     * ------------------------------------------------------------- */

    logWindow() {
      if (this.logBox) { return; }

      const el = function (tag, cls, txt) {
        const d = document.createElement(tag);
        if (cls) d.className = cls;
        if (txt !== undefined && txt !== null) d.textContent = txt;
        return d;
      };

      const win = el('div', 'hh-logwin hh-win');
      win.id = 'hh-logwin';
      const hd = el('div', 'hh-logwin-hd hh-win-hd');
      hd.appendChild(el('b', null, 'DEVLOG'));
      const x = el('button', 'hh-logwin-x hh-win-x', '×');
      x.title = 'Zamknij DEVLOG';
      x.setAttribute('aria-label', 'Zamknij DEVLOG');
      hd.appendChild(x);
      win.appendChild(hd);
      this.logBox = el('div', 'hh-logs hh-win-bd');
      win.appendChild(this.logBox);
      this.unread = 0;

      x.addEventListener('click', function (e) {
        e.stopPropagation();
        UI.zamknijOkna();
      });

      (document.body || document.documentElement).appendChild(win);
      this.logWin = win;
      this.drag(hd, win, 'log');
      this.kolo(this.logBox);
    },

    toggleLog() {
      const win = this.logWin;
      if (!win) { this.logWindow(); return; }
      if (win.classList.contains('open')) { this.zamknijOkna(); return; }
      this.otworz(win, null);
      if (this.logBox) this.logBox.scrollTop = this.logBox.scrollHeight;
      this.unread = 0;
    },

    syncLog() {
      if (!this.logBox) return;
      for (let i = 0; i < LOG.lines.length; i++) this.push(LOG.lines[i]);
    },

    /* ---------------------------------------------------------------
     *  OKNO USTAWIEN - webhook Discorda
     * ------------------------------------------------------------- */

/* ---------------------------------------------------------------
     *  WSPOLNE KOMPONENTY
     *
     *  Wydzielone, zeby wszystkie trzy panele korzystaly z tych samych
     *  receptur. Kazdy z nich ma juz swoja regule CSS, ale brakowalo
     *  odpowiednika po stronie JS - kazde okno budowalo przyciski i
     *  komunikaty na wlasna reke.
     * ------------------------------------------------------------- */

    // Przycisk tekstowy. type=button jest celowy: bez tego element
    // dostaje type=submit, a w przyszlosci w formule wysylalby ja
    // zamiast wykonac swoje zadanie. data-akcja idzie do delegata.
    przycisk(tekst, klasa, akcja, tytul) {
      const b = document.createElement('button');
      b.type = 'button';
      if (klasa) b.className = klasa;
      b.textContent = tekst;
      if (akcja) b.setAttribute('data-akcja', akcja);
      if (tytul) { b.title = tytul; b.setAttribute('aria-label', tytul); }
      return b;
    },

    // Pole tekstowe z etykieta, linia pomocnicza i miejscem na
    // komunikat walidacji. Zwraca referencje, bo okno musi je
    // aktualizowac (bled, focus, stan przyciskow).
    pole(o) {
      const el = function (tag, cls, txt) {
        const d = document.createElement(tag);
        if (cls) d.className = cls;
        if (txt !== undefined && txt !== null) d.textContent = txt;
        return d;
      };
      const opakowanie = el('div', 'hh-field');

      const lb = el('label', 'hh-lbl', o.etykieta);
      lb.setAttribute('for', o.id);
      opakowanie.appendChild(lb);

      const wrap = el('div', 'hh-inp-wrap');
      const inp = document.createElement('input');
      inp.className = 'hh-inp';
      inp.id = o.id;
      inp.type = o.typ || 'text';
      inp.value = o.wartosc || '';
      if (o.placeholder) inp.placeholder = o.placeholder;
      inp.spellcheck = false;
      inp.autocomplete = 'off';
      inp.setAttribute('autocapitalize', 'off');
      inp.setAttribute('autocorrect', 'off');
      inp.setAttribute('data-1p-ignore', 'true');
      if (o.inputmode) inp.setAttribute('inputmode', o.inputmode);
      // Opisane przez komunikat walidacji. Linia pomocnicza pod polem
      // zostala usunieta - pole ma placeholder z wzorcem adresu, a druga
      // linia tekstu tylko powtarzala to, co widać.
      inp.setAttribute('aria-describedby', o.id + '-msg');
      wrap.appendChild(inp);

      // Przycisk maski. aria-pressed, bo to jest stan przelacznik,
      // nie akcja - inaczej czytnik ekranu nie wie, co jest wlaczone.
      let rev = null;
      if (o.maskowalny) {
        rev = el('button', 'hh-reveal', 'Pokaż');
        rev.type = 'button';
        rev.title = 'Pokaż adres';
        rev.setAttribute('aria-label', 'Pokaż adres');
        rev.setAttribute('aria-pressed', 'false');
        rev.addEventListener('click', function () {
          const odslon = inp.type === 'password';
          inp.type = odslon ? 'text' : 'password';
          rev.textContent = odslon ? 'Ukryj' : 'Pokaż';
          rev.title = odslon ? 'Ukryj adres' : 'Pokaż adres';
          rev.setAttribute('aria-label', odslon ? 'Ukryj adres' : 'Pokaż adres');
          rev.setAttribute('aria-pressed', odslon ? 'true' : 'false');
          inp.focus();
        });
        wrap.appendChild(rev);
      }
      opakowanie.appendChild(wrap);

      // Linia pomocnicza tylko wtedy, gdy jawnie o nia proszono.
      let hint = null;
      if (o.pomoc) {
        hint = el('p', 'hh-field-hint', o.pomoc);
        hint.id = o.id + '-hint';
        opakowanie.appendChild(hint);
      }

      const msg = el('p', 'hh-msg', '');
      msg.id = o.id + '-msg';
      msg.setAttribute('role', 'status');
      msg.setAttribute('aria-live', 'polite');
      opakowanie.appendChild(msg);

      return { opakowanie: opakowanie, inp: inp, rev: rev, hint: hint, msg: msg };
    },

    // Komunikat z auto-ukryciem. Kazda nastepna akcja kasuje poprzedni,
    // wiec stare "Zapisano" nie lezy jeszcze po 30 sekundach obok nowego
    // bledu. 6 sekund to czas na przeczytanie bez utrzymywania szumu.
    pokazKomunikat(msg, tekst, klasa, gasnij) {
      if (msg._timer) { clearTimeout(msg._timer); msg._timer = 0; }
      msg.className = 'hh-msg' + (klasa ? ' ' + klasa : '');
      msg.textContent = tekst;
      if (gasnij !== false) {
        msg._timer = setTimeout(function () {
          msg.className = 'hh-msg';
          msg.textContent = '';
        }, 6000);
      }
    },

    /* ---------------------------------------------------------------
     *  TRAP FOKUSA
     *
     *  Okno jest role=dialog, wiec Tab musi krążyć w jego obrebie.
     *  Bez tego focus ucieka na gra pod spodem i klawiatura przestaje
     *  sterowac panelem, ktorego uzytkownik wlasnie otworzyl.
     * ------------------------------------------------------------- */

    zlapFokus(win) {
      const sel = 'a[href],button:not([disabled]),input:not([disabled]),'
        + 'summary,select,textarea,[tabindex]:not([tabindex="-1"])';
      win.addEventListener('keydown', function (e) {
        if (e.key !== 'Tab') return;
        const wszystkie = win.querySelectorAll(sel);
        const widoczne = [];
        for (let i = 0; i < wszystkie.length; i++) {
          // offsetParent jest null dla elementow w zamknietym <details>
          if (wszystkie[i].offsetParent !== null
            || wszystkie[i] === document.activeElement) {
            widoczne.push(wszystkie[i]);
          }
        }
        if (!widoczne.length) return;
        const pierwszy = widoczne[0];
        const ostatni = widoczne[widoczne.length - 1];
        if (e.shiftKey && document.activeElement === pierwszy) {
          e.preventDefault();
          ostatni.focus();
        } else if (!e.shiftKey && document.activeElement === ostatni) {
          e.preventDefault();
          pierwszy.focus();
        }
      });
    },

    /* ---------------------------------------------------------------
     *  OKNO USTAWIEN - webhook Discorda
     * ------------------------------------------------------------- */

    setWindow() {
      if (this.setWin) {
        if (this.setWin.classList.contains('open')) { this.zamknijOkna(); return; }
        this.otworz(this.setWin, 'webhook', '.hh-inp');
        return;
      }
      const self = this;
      const el = function (tag, cls, txt) {
        const d = document.createElement(tag);
        if (cls) d.className = cls;
        if (txt !== undefined && txt !== null) d.textContent = txt;
        return d;
      };

      const win = el('div', 'hh-setwin hh-win');
      win.id = 'hh-setwin';
      win.setAttribute('role', 'dialog');
      win.setAttribute('aria-modal', 'false');
      win.setAttribute('aria-label', 'Ustawienia webhooka');
      const hd = el('div', 'hh-setwin-hd hh-win-hd');
      hd.appendChild(el('b', null, 'Ustawienia'));
      const x = this.przycisk('×', 'hh-setwin-x hh-win-x', null, 'Zamknij');
      x.setAttribute('aria-label', 'Zamknij Ustawienia');
      hd.appendChild(x);
      win.appendChild(hd);

      const bd = el('div', 'hh-setwin-bd hh-win-bd');

      /* ---- pole ---- */
      const pole = this.pole({
        id: 'hh-hook',
        etykieta: 'Webhook Discorda',
        typ: 'password',
        maskowalny: true,
        inputmode: 'url',
        wartosc: STORE.data.webhook || '',
        placeholder: 'https://discord.com/api/webhooks/…',
      });
      bd.appendChild(pole.opakowanie);
      const inp = pole.inp;

      /* ---- instrukcja: ten sam komponent co w oknie pomocy ---- */
      const acc = self.akordeon('Jak stworzyć webhook');
      const ol = document.createElement('ol');
      ol.className = 'hh-steps';
      [
        'Nowy lub już istniejący kanał na discord',
        'Edytuj kanał',
        'Integracje',
        'Webhooki',
        'Stwórz webhook',
        'Uzupełnij według preferencji',
        'Skopiuj url webhooka',
        'Wklej powyżej i zapisz',
        'Wyślij test',
      ].forEach(function (krok) {
        const li = document.createElement('li');
        li.textContent = krok;
        ol.appendChild(li);
      });
      const accBd = acc.querySelector('.hh-acc-bd');
      accBd.appendChild(ol);
      accBd.appendChild(el('p', 'hh-note',
        'Jeśli wyszła wiadomość testowa, wszystko działa.'));
      bd.appendChild(acc);

      /* ---- przyciski ---- */
      // Kolejnosc od lewej: Zapisz, Wyślij test, Wyczyść.
      const row = el('div', 'hh-row-b');
      const bSave = this.przycisk('Zapisz', 'pri', 'zapisz');
      const bTest = this.przycisk('Wyślij test', 'sec', 'test');
      const bClear = this.przycisk('Wyczyść', 'ter', 'wyczysc');
      row.appendChild(bSave);
      row.appendChild(bTest);
      row.appendChild(bClear);
      bd.appendChild(row);

      /* ---- stan przyciskow ---- */
      // Zapisz nieaktywny, gdy wartosc sie nie zmienila; Wyślij test
      // nieaktywny, gdy pole puste albo trwa wysylanie; Wyczyść
      // nieaktywne, gdy juz pusto.
      function odswiez() {
        const v = inp.value.trim();
        const zapisany = (STORE.data.webhook || '').trim();
        bSave.disabled = (v === zapisany);
        bTest.disabled = (!v || bTest.getAttribute('aria-busy') === 'true');
        bClear.disabled = (!v && !zapisany);
      }

      function zapisz() {
        const v = inp.value.trim();
        if (v && !NOTIFY.poprawny(v)) {
          self.pokazKomunikat(pole.msg,
            'To nie jest adres webhooka Discorda. Oczekiwany kształt: '
            + 'discord.com/api/webhooks/…', 'err', false);
          inp.setAttribute('aria-invalid', 'true');
          inp.focus();
          return;
        }
        inp.removeAttribute('aria-invalid');
        STORE.set({ webhook: v });
        self.pokazKomunikat(pole.msg, v
          ? 'Zapisano. Bot użyje tego adresu.'
          : 'Wyczyszczono. Bot wrócił do adresu zapisanego w skrypcie.', 'ok');
        // Bez samego adresu w logu. URL z tokenem w DevLogu to wyciek
        // sekretu na ekran - screen share, zrzut, zdjęcie.
        LOG.ok(v ? 'Webhook zmieniony z poziomu panelu.'
          : 'Webhook wyczyszczony - wracam do CONFIG.');
        odswiez();
        self.build();
      }

      inp.addEventListener('input', function () {
        inp.removeAttribute('aria-invalid');
        if (pole.msg.className.indexOf('err') >= 0) {
          self.pokazKomunikat(pole.msg, '', '', false);
        }
        odswiez();
      });
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); if (!bSave.disabled) zapisz(); }
      });
      bSave.addEventListener('click', zapisz);

      // DESTRUKCYJNE: dwa klikniecia. Pierwsze zmienia napis na
      // potwierdzenie i odpala timer, drugie czyści. Mniej stanow niz
      // modal, a dziala takze z klawiatury.
      let oczekujePotwierdzenia = false, timerPotwierdzenia = 0;
      function odwazPOTwierdzenie() {
        oczekujePotwierdzenia = true;
        bClear.textContent = 'Na pewno?';
        bClear.classList.add('potwierdzenie');
        timerPotwierdzenia = setTimeout(function () {
          oczekujePotwierdzenia = false;
          bClear.textContent = 'Wyczyść';
          bClear.classList.remove('potwierdzenie');
          odswiez();
        }, 4000);
      }
      function wyczysc() {
        if (timerPotwierdzenia) { clearTimeout(timerPotwierdzenia); timerPotwierdzenia = 0; }
        oczekujePotwierdzenia = false;
        bClear.textContent = 'Wyczyść';
        bClear.classList.remove('potwierdzenie');
        inp.value = '';
        zapisz();
        inp.focus();
      }
      bClear.addEventListener('click', function () {
        if (oczekujePotwierdzenia) wyczysc();
        else odwazPOTwierdzenie();
      });
      // Jakakolwiek inna akcja kasuje oczekujace potwierdzenie.
      inp.addEventListener('input', function () {
        if (!oczekujePotwierdzenia) return;
        clearTimeout(timerPotwierdzenia);
        timerPotwierdzenia = 0;
        oczekujePotwierdzenia = false;
        bClear.textContent = 'Wyczyść';
        bClear.classList.remove('potwierdzenie');
      });

      bTest.addEventListener('click', function () {
        // Test leci na to, co jest WPOLU, nie na to, co zapisane.
        // Wczesniej testowal stary adres, wiec "Wyślij test" po wklejeniu
        // nowego odpowiadało, czy działa poprzedni - czyli nie to, co
        // user właśnie wkleił.
        const v = inp.value.trim();
        if (v && !NOTIFY.poprawny(v)) {
          self.pokazKomunikat(pole.msg,
            'To nie jest adres webhooka Discorda. Oczekiwany kształt: '
            + 'discord.com/api/webhooks/…', 'err', false);
          inp.setAttribute('aria-invalid', 'true');
          inp.focus();
          return;
        }
        bTest.disabled = true;
        bTest.setAttribute('aria-busy', 'true');
        bTest.textContent = 'Wysyłanie...';
        self.pokazKomunikat(pole.msg, 'Wysyłam na wpisany adres...', '', false);
        NOTIFY.test(v).then(function (r) {
          bTest.removeAttribute('aria-busy');
          bTest.textContent = 'Wyślij test';
          if (r.ok) {
            self.pokazKomunikat(pole.msg, 'Dostarczone. Webhook działa.', 'ok');
          } else if (r.status === 404) {
            self.pokazKomunikat(pole.msg,
              '404 — Discorda nie zna tego adresu.', 'err');
          } else if (r.status === 401 || r.status === 403) {
            self.pokazKomunikat(pole.msg,
              'Token wygasł albo usunięto webhook (' + r.status + ').', 'err');
          } else if (r.status === 429) {
            self.pokazKomunikat(pole.msg,
              '429 — limit Discorda. Adres poprawny, za dużo wysyłki.', 'err');
          } else {
            self.pokazKomunikat(pole.msg,
              'Niepowodzenie' + (r.status ? ' (' + r.status + ')' : '')
              + (r.powod ? ': ' + r.powod : '') + '. Nie zapisuj, popraw adres.', 'err');
          }
          odswiez();
        });
      });

      x.addEventListener('click', function (e) {
        e.stopPropagation();
        self.zamknijOkna();
      });

      win.appendChild(bd);
      (document.body || document.documentElement).appendChild(win);
      this.setWin = win;
      this.drag(hd, win, 'set');
      this.kolo(bd);
      this.zlapFokus(win);
      this.otworz(win, 'webhook', '.hh-inp');
      odswiez();
    },
    /* ---------------------------------------------------------------
     *  OKNO "JAK TO DZIALA"
     *
     *  Tresc byla 614 px w oknie 464 px, wiec okno zawsze przewijane,
     *  a czytelnik zagladal glownie do naglowka. Teraz: sekcje maja
     *  jeden rytm odstepow (16 przed sekcja, 8 po naglowku) zapisany
     *  w .hh-sect, a sekcje drugorzedne sa w <details>.
     * ------------------------------------------------------------- */

    // Zwijana sekcja. <details> ma juz poprawne zachowanie klawiatury,
    // my dodajemy tylko aria-expanded na <summary> - natywnie go nie ma.
    //
    // Trzeci argument otwiera sekcje na starcie. Wszystkie okna pomocy
    // maja ten sam wzorzec i ten sam stan poczatkowy - inaczej wygladalo
    // by, jakby czesc sekcji byla "wazniejsza" od reszty.
    akordeon(tytul, tresc, otwarta) {
      const el = function (tag, cls, txt) {
        const d = document.createElement(tag);
        if (cls) d.className = cls;
        if (txt !== undefined && txt !== null) d.textContent = txt;
        return d;
      };
      const d = el('details', 'hh-acc');
      const sum = el('summary', null, tytul);
      // aria-controls: natywny <details> tego nie dostaje, a bez tego
      // czytnik ekranu nie wie, co ten naglowek rozwija.
      this.licznikAkordeonow = (this.licznikAkordeonow || 0) + 1;
      const bdId = 'hh-acc-' + this.licznikAkordeonow;
      sum.setAttribute('aria-expanded', otwarta ? 'true' : 'false');
      sum.setAttribute('aria-controls', bdId);
      d.appendChild(sum);
      const bd = el('div', 'hh-acc-bd');
      bd.id = bdId;
      if (tresc) bd.appendChild(tresc);
      d.appendChild(bd);
      if (otwarta) d.open = true;
      d.addEventListener('toggle', function () {
        sum.setAttribute('aria-expanded', d.open ? 'true' : 'false');
      });
      return d;
    },

    helpWindow() {
      if (this.helpWin) {
        if (this.helpWin.classList.contains('open')) { this.zamknijOkna(); return; }
        this.otworz(this.helpWin, 'help', '.hh-win-bd summary');
        return;
      }
      const self = this;
      const el = function (tag, cls, txt) {
        const d = document.createElement(tag);
        if (cls) d.className = cls;
        if (txt !== undefined && txt !== null) d.textContent = txt;
        return d;
      };
      const dl = function (pairs) {
        const box = document.createElement('dl');
        pairs.forEach(function (p) {
          const dt = document.createElement('dt');
          const kbd = document.createElement('kbd');
          kbd.textContent = p[0];
          dt.appendChild(kbd);
          const dd = document.createElement('dd');
          dd.textContent = p[1];
          box.appendChild(dt);
          box.appendChild(dd);
        });
        return box;
      };

      const win = el('div', 'hh-helpwin hh-win');
      win.id = 'hh-helpwin';
      win.setAttribute('role', 'dialog');
      win.setAttribute('aria-label', 'Jak to działa');
      const hd = el('div', 'hh-helpwin-hd hh-win-hd');
      hd.appendChild(el('b', null, 'Jak to działa?'));
      const x = el('button', 'hh-helpwin-x hh-win-x', '×');
      x.title = 'Zamknij';
      x.setAttribute('aria-label', 'Zamknij Jak to działa');
      hd.appendChild(x);
      win.appendChild(hd);

      const bd = el('div', 'hh-helpwin-bd hh-win-bd');

      // Piec sekcji, wszystkie tego samego wzorca i wszystkie domkniete.
      // Wczesniej trzy byly plaskie, a dwie zwijane - przez to okno nie
      // mialo jednego schematu. Przy 761 px tresci wszystko naraz jest
      // za dlugie, wiec wzorzec zostaje, tylko jest jednolity.
      bd.appendChild(this.akordeon('Co robi bot?', el('p', null,
        'Wybrany heros ma własną trasę: listę map i punktów respów. Bot chodzi '
        + 'po niej w kółko i sprawdza każdy resp, dopóki nie znajdzie herosa. '
        + 'Nie przeskakuje sam na innego herosa, szuka tego, którego wybrałeś, '
        + 'tak długo, aż go znajdzie.')));
      bd.appendChild(this.akordeon('Co się dzieje gdy znajdzie herosa?', el('p', null,
        'Wysyła powiadomienie na kanał discord i czeka aż zbierze się grupa. '
        + 'Sam nie zaatakuje przez pierwsze 5 minut. Potem atakuje.')));

      // Nota jest przypisem do tabeli, nie kolejnym akapitem - osobna
      // klasa z kreska z lewej.
      const komendy = el('div');
      komendy.appendChild(dl([
        ['zap!', 'zaprasza autora wiadomości do grupy'],
        ['oddaj d!', 'przekazuje dowództwo w drużynie'],
        ['przywo!', 'przywołuje członków drużyny'],
        ['bij!', 'atakuje, pomija czekanie'],
        ['czekaj!', 'cofa odliczanie do ataku o 5 minut'],
        ['odwołaj Xmin!', 'odwołuje szukanie herosa i cofa go do punktu '
          + 'startowego. X oznacza liczbę minut na ile ma zostać wyłączony'],
        ['heros x!', 'przełącza szukanie herosa o numerze x z listy (x '
          + 'odpowiada za daną liczbę, zaczynając od 1 u samej góry)'],
      ]));
      komendy.appendChild(el('p', 'hh-note',
        'Komendy działają też przy zatrzymanym bocie: wykonują się, '
        + 'a szukanie zostaje wstrzymane.'));
      bd.appendChild(this.akordeon('Komendy na czacie klanu lub drużyny', komendy));

      bd.appendChild(this.akordeon('Kafelki', dl([
        ['znalezionych', 'ile razy znaleziono herosa'],
        ['atak za', 'po znalezieniu: ile zostało do ataku'],
      ])));
      bd.appendChild(this.akordeon('Skróty klawiaturowe', dl([
        ['Alt+H', 'zwija / rozwija panel'],
        ['Alt+L', 'otwiera / zamyka DEVLOG'],
        ['Alt+R', 'przebudowuje panel'],
        ['Esc', 'zamyka otwarte okno'],
      ])));

      x.addEventListener('click', function (e) {
        e.stopPropagation();
        self.zamknijOkna();
      });

      win.appendChild(bd);
      (document.body || document.documentElement).appendChild(win);
      this.helpWin = win;
      this.drag(hd, win, 'help');
      this.kolo(bd);
      this.otworz(win, 'help', '.hh-win-bd summary');
    },

    /* ---------------------------------------------------------------
     *  PRZEWIJANIE KOLEM
     *
     *  Gra przechwytuje 'wheel' i nie pozwala przewijac panelu -
     * sprawdzone 04.10: przy 633 px tresci w 464 px oknie scrollTop po
     * realnym kolku zostawal na 0. Trzeba chwyta pasek myszka.
     *
     *  Flaga na elemencie: kolo() wolalo sie przy kazdym UI.build() na
     *  nowym .hh-body, ale ten sam element dostawal handler drugi raz
     *  przy odbudowie okna, i jedno kolo przewijalo o dwa kroki.
     * ------------------------------------------------------------- */
    kolo(elm) {
      if (!elm || elm.getAttribute('data-hh-kolo') === '1') return;
      elm.setAttribute('data-hh-kolo', '1');
      elm.addEventListener('wheel', function (e) {
        if (elm.scrollHeight <= elm.clientHeight + 1) return;
        e.preventDefault();
        e.stopPropagation();
        elm.scrollTop += e.deltaY;
      }, { passive: false });
    },

    // Przeciaganie: pointer events z setPointerCapture zamiast
    // listenerow na document. Stare wpisy wisialy do konca sesji -
    // cztery okna x dwa listenery x kazde UI.build(), a kazdy z nich
    // dostawal kazdy mousemove na calym dokumencie. Teraz: zero
    // listenerow na document, rAF zamiast pisania stylu w kazdym
    // ruchu myszy, pozycja leci do magazynu.
    drag(handle, box, klucz) {
      let pid = null, sx = 0, sy = 0, ox = 0, oy = 0, raf = 0, cel = null;
      let wTrakcie = false;
      // Prog 3 px. Bez niego kazdy pointerdown na naglowku byl
      // przeciagnieciem - wystarczylo jedno zdarzenie wygenerowane przez
      // gre, zeby panel przesunac i ZAPISAC te pozycje na stale
      // (zaobserwowane: panel skoczyl na srodek ekranu, uiPos.panel
      // = 465/373). Teraz pozycja jest zapisywana wylacznie po
      // faktycznym ruchu, a klik w naglowku nie rusza nic.
      const PRÓG = 3;

      const umieść = function () {
        raf = 0;
        if (!cel) return;
        const w = box.offsetWidth, h = box.offsetHeight;
        const x = Math.round(Math.max(0, Math.min(window.innerWidth - w, cel.x)));
        const y = Math.round(Math.max(0, Math.min(window.innerHeight - h, cel.y)));
        box.style.left = x + 'px';
        box.style.top = y + 'px';
        box.style.right = 'auto';
        box.style.bottom = 'auto';
      };

      handle.addEventListener('pointerdown', function (e) {
        if (e.button !== 0) return;
        // Przyciski w naglowku (ikony, zwijanie) to nie uchwyt.
        if (e.target && e.target.closest && e.target.closest('button,input,summary,a')) return;
        const r = box.getBoundingClientRect();
        pid = e.pointerId; sx = e.clientX; sy = e.clientY;
        ox = r.left; oy = r.top;
        wTrakcie = false;
        cel = null;
        try { handle.setPointerCapture(pid); } catch (err) { /* nie kazdy UA */ }
        e.preventDefault();
      });

      handle.addEventListener('pointermove', function (e) {
        if (pid === null || e.pointerId !== pid) return;
        if (!wTrakcie) {
          if (Math.abs(e.clientX - sx) < PRÓG
            && Math.abs(e.clientY - sy) < PRÓG) return;
          wTrakcie = true;
          box.style.left = ox + 'px';
          box.style.top = oy + 'px';
          box.style.right = 'auto';
          box.style.bottom = 'auto';
        }
        cel = { x: ox + e.clientX - sx, y: oy + e.clientY - sy };
        if (!raf) raf = requestAnimationFrame(umieść);
      });

      const koniec = function (e) {
        if (pid === null || (e && e.pointerId !== pid)) return;
        try { handle.releasePointerCapture(pid); } catch (err) { /* juz zwolniony */ }
        const przeciągnięto = wTrakcie;
        pid = null; cel = null; wTrakcie = false;
        if (klucz && przeciągnięto) this.zapamietajPozycje(box, klucz);
      }.bind(this);

      handle.addEventListener('pointerup', koniec);
      handle.addEventListener('pointercancel', koniec);
    },

    push(e) {
      if (!this.logBox) return;
      const row = document.createElement('div');
      row.className = 'hh-log ' + (e.level || 'info');
      const t = document.createElement('time');
      t.textContent = new Date(e.t).toLocaleTimeString('pl-PL');
      const s = document.createElement('span');
      s.textContent = e.msg;
      row.appendChild(t); row.appendChild(s);
      this.logBox.appendChild(row);
      while (this.logBox.children.length > 120) this.logBox.removeChild(this.logBox.firstChild);
      this.logBox.scrollTop = this.logBox.scrollHeight;
    },

    log(e) {
      if (!this.logBox) return;
      this.push(e);
    },

    set(k, t) {
      if (k === 'map' || k === 'resp') return;
      if (k === 'state') { this.state(t); return; }
      if (k === 'hero') { if (this.heroSub) this.heroSub.textContent = t || '?'; return; }
      const c = this.cells[k];
      if (c) {
        c.textContent = t;
        // Klasa `.pusty` (12 px, szary, normalna waga) zostawala na
        // komorce nawet z prawdziwa wartoscia - licznik wygladal wtedy
        // jak zastepczy "brak danych", mimo ze mial dane. Przelaczamy ja
        // razem z trescia, podobnie tytul i opis dla czytnika ekranu.
        const pusto = (t === undefined || t === null || t === '' || t === '-' || t === '–');
        if (pusto) c.classList.add('pusty');
        else c.classList.remove('pusty');
        const etykieta = this.cellNames[k] || k;
        c.title = pusto ? 'brak danych' : etykieta + ': ' + t;
        c.setAttribute('aria-label', pusto ? etykieta + ': brak danych' : etykieta + ': ' + t);
      }
    },

    tile(k, kind) {
      const t = this.tiles[k];
      if (t) t.className = 'hh-tile' + (kind ? ' ' + kind : '');
    },

    setFoot() {
      void arguments;
    },

    staty(hero, killed) {
      const cfg = (hero && typeof hero === 'object') ? hero : null;
      const nazwa = cfg ? cfg.nazwa : hero;
      this.set('hero', nazwa || '-');
      void killed;

      if (cfg && this.headAv) {
        const klucz = cfg.key + '|' + (cfg.img || '');
        if (this.headAvKey !== klucz) {
          this.headAvKey = klucz;
          this.headAv.textContent = '';
          this.headAv.appendChild(this.avatar(cfg, 'hh-av-head'));
        }
      }
    },

    state(s) {
      // Kolor niesie wariant KLASY, nie inline-styl. Wczesniej stan()
      // wpisywal borderColor i background prosto w element, przez co
      // badge mial kolorowa obwodke i wypelnienie zalezne od JS - nie
      // od tokenow CSS, wiec nie dawalo sie tego ujednolicic.
      const wariant = s === 'STOPPED' ? '' : (/^(WAIT|HOME)$/.test(s) ? ' warn' : ' ok');
      if (this.pillBox) {
        this.pillBox.className = 'hh-pill' + wariant;
        if (this.dot) this.dot.removeAttribute('style');
      }
      if (this.stateTxt) {
        this.stateTxt.textContent = s;
        this.stateTxt.removeAttribute('style');
      }
      const powod = this.powodStartu();
      if (this.btnGo) {
        this.btnGo.disabled = !!powod;
        this.btnGo.title = powod || 'Start';
      }
      if (this.btnStop) this.btnStop.disabled = (s === 'STOPPED');
      if (this.hintEl) this.hintEl.textContent = this.ostrzezenieStartu();
    },

    bar2(frac, warn, tekst) {
      this.lastFrac = frac;
      this.lastWarn = warn;
      this.lastTekst = tekst;
      void warn; void tekst;
    },
  };

  /* =====================================================================
   *  8. BOT
   *
   *  Przepływ:
   *    STOPPED -> (start) -> WAIT      ekran logowania, budzik
   *            -> SCAN               obchodzimy respy na biezacej mapie
   *            -> GO                 idziemy na kolejna mape z kolejki
   *            -> FOUND              znaleziony heros, ping na Discord
   *            -> HOME               powrot do Ithanu + logout
   *    Start moze byc wszzedzie - nie przywiazujemy sie do miasta.
   * =================================================================== */

  const BOT = {
    state: 'STOPPED',
    running: false,
    timer: null,
    startedAt: 0,
    lastGo: 0,
    lastMap: null,
    notFoundThisMap: false,

    setState(s) {
      if (this.state === s) return;
      this.state = s;
      STORE.set({ state: s });
      UI.state(s);
      LOG.info(s);
    },

    start() {
      if (this.running) return;
      this.running = true;
      this.startedAt = Date.now();
      this.setState(GAME.loggedIn() ? 'SCAN' : 'WAIT');
      if (!this.timer) {
        const self = this;
        this.timer = setInterval(function () { self.tick(); }, 1000);
      }
      LOG.ok('Start.');
    },

    stop(manual) {
      this.running = false;
      GAME.stopWalk();
      this.setState('STOPPED');
      LOG.warn('Stop' + (manual ? ' (recznie)' : '') + '.');
    },

    uptime() {
      const s = Math.floor((Date.now() - this.startedAt) / 1000);
      const p = function (n) { return (n < 10 ? '0' : '') + n; };
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      if (h) return h + 'h ' + p(m) + 'm';
      if (m) return m + 'm ' + p(s % 60) + 's';
      return s + 's';
    },

    /* ---- graf bram: potrzebny gdy nie ma bramy prosto do celu ---- */

    rememberGraph() {
      const m = GAME.rawMap();
      if (!m || m.id === null) return;
      if (!STORE.data.visited[m.id]) {
        STORE.data.visited[m.id] = m.name;
        LOG.info('Mapa: ' + m.id + ' ' + m.name);
      }
      STORE.data.graph[m.id] = GAME.gateways();
      STORE.save();
    },

    gatewayTo(mapId) {
      const g = GAME.gateways();
      for (let i = 0; i < g.length; i++) if (Number(g[i].to) === Number(mapId)) return g[i];
      return null;
    },

    // Pelna sciezka z biezacej mapy do celu, po zapamietanym grafie.
    // Zwraca liste krokow: {from, to, x, y}. Kazdy krok to brama na mapie `from`,
    // wiec jej wspolrzedne sa poprawne dla tej mapy.
    pathTo(mapId) {
      const m = GAME.rawMap();
      if (!m || m.id === null) return null;
      const cel = Number(mapId);
      if (Number(m.id) === cel) return [];
      const graf = STORE.data.graph || {};
      const prev = {};
      prev[Number(m.id)] = null;
      const kolejka = [Number(m.id)];
      let znaleziono = false;

      while (kolejka.length && !znaleziono) {
        const cur = kolejka.shift();
        const edges = graf[cur] || [];
        for (let i = 0; i < edges.length; i++) {
          const e = edges[i];
          if (e.to === undefined || e.to === null) continue;
          const to = Number(e.to);
          if (prev[to] !== undefined) continue;
          prev[to] = { from: cur, gw: e };
          if (to === cel) { znaleziono = true; break; }
          kolejka.push(to);
        }
      }
      if (!znaleziono) return null;

      const path = [];
      let c = cel;
      while (prev[c]) {
        path.unshift({
          from: prev[c].from,
          to: c,
          x: prev[c].gw.x,
          y: prev[c].gw.y,
          name: prev[c].gw.name,
        });
        c = prev[c].from;
      }
      return path;
    },

    // Idziemy po sciezce krok za krokiem.
    // Zwraca true gdy sciezka sie skonczyla.
    followPath(map) {
      const path = this.path;
      if (!path || !path.length) return true;
      if (this.pathIdx >= path.length) { this.path = null; return true; }

      const krok = path[this.pathIdx];
      if (Number(map.id) === Number(krok.to)) {
        this.pathIdx++;
        if (this.pathIdx >= path.length) {
          this.path = null;
          this.pathIdx = 0;
          return true;
        }
        return false;
      }
      if (Number(map.id) === Number(krok.from)) {
        // UWAGA: nie zerujemy tu gwSince/gwClicked. followPath() chodzi co tick,
        // a stepInto() czeka 800 ms od gwSince - zerowanie co tick uniezwiazalo
        // botowi klikniecia bramy ZAWSZE (znalezione 15:15, Ithan 42,99).
        // Reset zostaje w stepInto() i robi sie tylko przy zmianie kafelka.
        this.stepInto({ x: krok.x, y: krok.y, to: krok.to });
        return false;
      }
      // stoimy na mapie spoza sciezki - przeliczamy od nowa
      this.path = null;
      this.pathIdx = 0;
      return false;
    },

    // BFS po zapamietanym grafie - pierwszy krok w drodze do mapy
    firstHop(mapId) {
      const m = GAME.rawMap();
      const graf = STORE.data.graph || {};
      if (!m || m.id === null || m.id === Number(mapId)) return null;
      const prev = {};
      prev[m.id] = null;
      let fr = [m.id];
      while (fr.length) {
        const nx = [];
        for (let i = 0; i < fr.length; i++) {
          const edges = graf[fr[i]] || [];
          for (let j = 0; j < edges.length; j++) {
            const e = edges[j];
            if (e.to === undefined || prev[e.to] !== undefined) continue;
            prev[e.to] = { from: fr[i], e: e };
            if (Number(e.to) === Number(mapId)) {
              let hop = null, c = Number(mapId);
              while (prev[c]) { hop = prev[c].e; c = prev[c].from; }
              return hop;
            }
            nx.push(e.to);
          }
        }
        fr = nx;
      }
      return null;
    },

    // Wnetrza miast pomijamy - nigdy nie sa respy, tylko drogi do NPC
    INTERIOR: /^(Dom |Mury |Ratusz|Baraki|Kopalnia|Szko|Gild|Zajazd|Stary magazyn|Pod Rozbry|Jaskinia Łowców|Siedziba)/i,

    // Brama, gdy nie ma bezposredniej drogi do biezacego kroku trasy.
    // WAZNE: zwracamy brame z BIEZACEJ mapy i tylko takze, ktora prowadzi
    // do MAPY LUB DALEJ w trasie. Bot nie wraca wczes - idzie tylko do przodu.
    explore(celId) {
      const g = GAME.gateways();
      const wszystkie = MAPS.all();
      const nastepnyKrok = MAPS.stepAt((STORE.data.routeIndex || 0) + 1);
      const doPrzodu = {};
      for (let i = (STORE.data.routeIndex || 0); i < wszystkie.length; i++) doPrzodu[wszystkie[i].id] = true;

      // 1) prosto na cel
      const wCel = this.gatewayTo(celId);
      if (wCel) return wCel;

      // 2) brama do mapy, ktora jest dalej w trasie
      let najbl = null;
      for (let i = 0; i < g.length; i++) {
        const to = Number(g[i].to);
        if (!doPrzodu[to]) continue;
        if (this.INTERIOR.test(g[i].name)) continue;
        // im dalszy krok tym lepiej? nie - bierzemy najblizszy krok trasy
        const poz = pozycjaWKroku(to);
        if (poz < 0) continue;
        if (!najbl || poz < najbl.poz) najbl = { poz: poz, gw: g[i] };
      }
      if (najbl) return najbl.gw;

      void nastepnyKrok;
      return null;

      function pozycjaWKroku(id) {
        const idx = wszystkie.findIndex(function (m) { return m.id === id; });
        return idx;
      }
    },

    // Idz do mapy. Najpierw szukamy pelnej sciezki, potem bramy na biezacej mapie.
    goToMap(mapId) {
      const sciezka = this.pathTo(mapId);
      if (sciezka && sciezka.length) {
        this.path = sciezka;
        this.pathIdx = 0;
        LOG.info('Trasa do ' + mapId + ': ' + sciezka.map(function (k) { return k.to; }).join(' → '));
        return true;
      }
      const gw = this.explore(mapId);
      if (gw) {
        this.path = null;
        this.stepInto(gw);
        return true;
      }
      LOG.warn('Nie mam gdzie iść (cel ' + mapId + ').');
      return false;
    },

    // Throttle autoGoTo - gra ignoruje wywolania w trakcie animacji kafelka
    walk(x, y) {
      if (!GAME.inBounds(x, y)) return false;
      if (GAME.locked()) return false;
      const now = Date.now();
      if (now - this.lastGo < CONFIG.GO_EVERY_MS) return false;
      this.lastGo = now;
      return GAME.walk(x, y);
    },

    // Wchodzenie na brame.
    // Sama gra NIE przenosi automatycznie, gdy stoimy juz na kafelku bramy.
    // Hop w bok i powrot tez nie pomaga (sprawdzone na 6474 -> 6475).
    // Dziala Engine.interface.clickGoGateway() - to jest klik na bramie.
    stepInto(gw) {
      const pos = GAME.pos();
      if (!pos) return false;
      const x = Number(gw.x), y = Number(gw.y);
      const now = Date.now();

      // Zmiana kafelka bramy = nowy cel, zerujemy liczniki.
      const cel = x + ',' + y;
      if (this.gwTarget !== cel) {
        this.gwTarget = cel;
        this.gwSince = 0;
        this.gwClicked = 0;
        this.gwRetreats = 0;
        this.gwRetreatAt = 0;
      }

      if (pos[0] !== x || pos[1] !== y) {
        this.gwSince = 0;
        this.gwClicked = 0;
        return this.walk(x, y);
      }

      // stoimy na bramie - klikamy w nia
      if (!this.gwSince) this.gwSince = now;
      if (now - this.gwSince < 800) return false;
      if (this.gwClicked && now - this.gwClicked < 6000) return false;

      // Po 15 s bez skutku zejdz z kafelka bramy i wejdz ponownie.
      // Sprawdzone na zywo 14:05 (Ithan 42,99): samo klikniecie bramy
      // potrafi nie zadzialac, a bot stoi w miejscu w nieskonczonosc.
      // Ruch w bok i powrot jedynym sposobem, ktory wypuscil postac.
      if (now - this.gwSince > 15000) {
        const ile = this.gwRetreats || 0;
        if (ile >= 8) return false;
        if (this.gwRetreatAt && now - this.gwRetreatAt < 5000) return false;
        const kandydaci = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
        const dozwolone = [];
        for (let i = 0; i < kandydaci.length; i++) {
          if (GAME.inBounds(kandydaci[i][0], kandydaci[i][1])) dozwolone.push(kandydaci[i]);
        }
        if (!dozwolone.length) return false;
        const b = dozwolone[ile % dozwolone.length];
        this.gwRetreats = ile + 1;
        this.gwRetreatAt = now;
        this.gwClicked = 0;
        this.lastGo = 0;
        LOG.warn('Brama ' + x + ',' + y + ' nie przepuszcza - schodzę i wchodzę ponownie ('
          + this.gwRetreats + '/8).');
        return GAME.walk(b[0], b[1]);
      }

      this.gwClicked = now;
      return GAME.enterGateway();
    },

    // Ile czasu bot realnie polowal - bez czekania na resp po wylogowaniu.
    // "Godz:Min" powyzej godziny, "Min:Sek" ponizej.
    huntTime() {
      let ms = STORE.data.huntMs || 0;
      if (this.huntFrom !== undefined) ms += Math.max(0, Date.now() - this.huntFrom);
      const s = Math.floor(ms / 1000);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      if (h > 0) return h + ':' + String(m).padStart(2, '0');
      return m + ':' + String(s % 60).padStart(2, '0');
    },

    /* ---- petla ---- */

    tick() {
      if (!this.running) return;
      try {
        const now = Date.now();
        // kafelek "Czas" pokazuje czas POLOWANIA (bez czekania na resp),
        // liczony w huntMs dalej. Caly uptime od startu jest w stopce.
        UI.set('uptime', this.huntTime());
        // UI.setFoot, nie this.setFoot - setFoot należy do UI. Wcześniej
        // wywolanie na `this` (czyli BOT) rzucało wyjatkiem, który
        // try/catch w tick() połykał - przez to dalsza część ticku
        // nie wykonywała się wcale (licznik znalezen zostawal myślnikiem).
        UI.setFoot(this.uptime());

        // Jednorazowo przy starcie wczytaj licznik znalezen z magazynu.
        // Kafelek "Znalez." nie byl aktualizowany nigdzie w kodzie, wiec
        // pokazywal myslnik nawet po znalezieniu herosa.
        if (!this.synced) {
          this.synced = true;
          const ileF = STORE.data.found || 0;
          UI.set('found', String(ileF));
          UI.tile('found', ileF > 0 ? 'good' : 'idle');
        }

        // Walka z kimś po drodze (moby, obcy gracz). Bot oddaje ciosy
        // sam - nie stoi bezczynnie czekajac na "rozwiazanie".
        if (GAME.inFight()) {
          if (now - (this.lastAtk || 0) > CONFIG.ATTACK_EVERY_MS) {
            this.lastAtk = now;
            GAME.hit();
          }
        }

        // Gra zatrzymala postac (np. captcha). Bot tego nie rozwiazuje - czeka.
        // 'dead' i 'battle' sa z filtrewane w GAME.lockList() - to normalne
        // stany rozgrywki, nie blokady do rozwiazania przez gracza.
        // Log i powiadomienie DOKLADNIE RAZ na blokade, zeby nie zasypywac
        // Discordu co minute. W panelu stan widoczny ciągle.
        const blokady = GAME.lockList();
        if (blokady.length) {
          const co = blokady.join(', ');
          if (!this.lockKey || this.lockKey !== co) {
            this.lockKey = co;
            LOG.warn('Gra blokuje postać (' + co + '). Rozwiąż i bot ruszy dalej.');
            if (this.state !== 'WAIT') this.setState('WAIT');
            NOTIFY.send({
              title: 'Bot zablokowany',
              description: 'Gra wymaga: ' + co + '. Bot czeka.',
              color: 0xf59e0b,
            });
          }
          UI.set('map', 'BLOKADA: ' + co);
          UI.set('resp', 'czekam na gracza');
          UI.bar2(0, true);
          return;
        }
        if (this.lockKey) { this.lockKey = null; LOG.ok('Blokada zdjęta - lecę dalej.'); }

        if (GAME.dead()) {
          // jeden raz na smierc - nie powtarzamy co tick
          if (!this.deathHandled) {
            this.deathHandled = true;
            LOG.warn('Postać nieżyje - wracam do Ithanu i zaczynam trasę od nowa.');
            NOTIFY.send({ title: 'Śmierć', description: 'Postać zginęła. Wracam do Ithanu i lecę od nowa.', color: 0xdc4b4b });
            GAME.stopWalk();
            this.newRun();
            // Smierc od gracza to NIE jest kill herosa - nie wylogowujemy.
            // Wylogowanie zostaje wylacznie dla sytuacji 'poKillu'.
            this.homeReason = 'poSmierci';
            STORE.set({ homeReason: 'poSmierci' });
            this.setState('HOME');
          }
          this.homeAt = 0;
          return;
        }
        if (this.deathHandled) {
          this.deathHandled = false;
          LOG.ok('Postać żyje - wracam do szukania.');
          this.newRun();
        }

        if (!GAME.loggedIn()) {
          if (this.state !== 'WAIT') this.setState('WAIT');
          // Czekanie na resp to nie polowanie - przestajemy liczyc czas.
          // Po zalogowaniu zaczynamy liczyc znowu. Warunek na
          // UI.cells.uptime jak wyzej: kafelka nie ma, wiec nie zapisujemy.
          if (UI.cells.uptime && this.huntFrom !== undefined
            && now > this.huntFrom && now - this.huntFrom < 60000) {
            STORE.set({ huntMs: (STORE.data.huntMs || 0) + (now - this.huntFrom) });
          }
          this.huntFrom = undefined;
          UI.set('uptime', this.huntTime());
          // Kafelek "Atak za" ma sens tylko przy znalezionym herosie.
          // Po wylogowaniu wraca do wygaszonego stanu.
          UI.tile('atak', 'idle');
          UI.set('atak', '—');
          const until = STORE.data.nextRespawnAt || 0;
          if (!until) {
            UI.set('map', 'ekran logowania');
            UI.set('resp', 'brak zaplanowanego logowania - wciśnij Start');
          } else if (now >= until) {
            UI.set('map', 'ekran logowania');
            UI.set('resp', 'loguję się do gry');
            GAME.login();
          } else {
            // Czas logowania zapisany PRZED wylogowaniem - na ekranie
            // logowania nie da się go odczytać z gry. Bez flagi
            // respawnZgloszony pokazywalbym zgadniętą wartość jak pewnik.
            const godz = new Date(until).toLocaleTimeString('pl-PL');
            const zgl = STORE.data.respawnZgloszony;
            UI.set('map', 'ekran logowania');
            UI.set('resp', 'logowanie o ' + godz
              + (zgl ? '' : ' · szacunek, nie wiadomo ile trwa resp'));
            // zgloszony czas = zielono (wiadomo), zgadnięty = pomarańczowo
            UI.tile('atak', zgl ? 'good' : 'warn');
            UI.set('atak', godz);
          }
          UI.bar2(0, null, '');
          return;
        }

        this.rememberGraph();
        const map = MAPS.current();
        UI.set('map', MAPS.label(map));
        // przekazujemy obiekt herosa, nie sama nazwe - staty() podmienia
        // takze obrazek w naglowku przy zmianie herosa
        UI.staty(MAPS.hero(), STORE.data.killed);

        // Czas polowania: liczymy tylko czas, gdy bot naprawde szuka.
        // Kafelek "Czas" wyrzucony 04.10, wiec zapis do magazynu
        // co tick byl czystym marnowaniem - STORAGE.set po kazdym
        // ticku przy 5 s interwale, bez nikogo kto to czyta.
        // Liczymy tylko wtedy, gdy istnieje komorka na ten licznik.
        // Jak kafelek wroci, wszystko zadziala od razu.
        if (UI.cells.uptime && this.huntFrom !== undefined && now > this.huntFrom) {
          const delta = now - this.huntFrom;
          // zabezpieczenie przed wielogodzinnym uśpieniem karty (delta > 60 s
          // to nie polowanie, tylko brak aktywnosci)
          if (delta < 60000) STORE.set({ huntMs: (STORE.data.huntMs || 0) + delta });
        }
        this.huntFrom = now;
        UI.set('uptime', BOT.huntTime());

        // zmiana mapy = nowy indeks respa na niej
        if (this.lastMap !== null && this.lastMap !== map.id) {
          STORE.set({ spawnIndex: 0, pointSince: 0 });
          this.lastGo = 0;
        }
        this.lastMap = map.id;

        // heros na ekranie - najwyzszy priorytet, z kazdego stanu
        //
        // WAZNE: `found()` wolamy TYLKO przy pierwszym odkryciu.
        // Wczesniej bylo `if (hero) { this.found(map, hero); return; }`,
        // a `found()` zaczyna sie od `if (this.state === 'FOUND') return;`
        // - czyli przy kazdym kolejnym tyku tick() wchodzil w found(),
        // wychodzil natychmiast i **nigdy nie dochodzil do czekaj()**.
        // Skutki (zgloszone 04.10): brak odliczania "Atak za", brak
        // komendy "bij!" z czatu, brak przejscia do walki po
        // atakPoMin - bot stal obok heroesa w nieskonczonosc.
        const hero = this.findHero();
        if (hero && this.state !== 'FOUND' && this.state !== 'FIGHT') {
          this.found(map, hero);
          return;
        }
        // FOUND + heros widoczny  -> spadamy do czekaj()
        // FIGHT + heros widoczny  -> spadamy do walka()
        // FOUND + heros zniknal   -> czekaj() rozpozna ucieczke/zemiercia

        // Kafelek "Atak za" ma DWA rozne znaczenia w kodzie: odliczanie
        // do ataku (czekaj()) i godzina powrotnego zalogowania (ekran
        // logowania). W pozostalych stanach - GO, SCAN, FIGHT, HOME -
        // nikt go nie ustawial, wiec zostawal ZAMROZONY na ostatniej
        // wartosci. Uzytkownik widzial staty cyfrowe i myslel, ze licznik
        // nie dziala. Dlatego gasimy go domyslnie, a wypelnienie zostaje
        // tylko tam, gdzie ma sens.
        if (this.state !== 'FOUND') {
          UI.tile('atak', 'idle');
          UI.set('atak', '-');
        }

        switch (this.state) {
          case 'WAIT': this.setState('GO'); break;
          case 'SCAN': this.scan(map, now); break;
          case 'GO': this.stepNext(map, now); break;
          case 'FOUND': this.czekaj(map, now); break;
          case 'FIGHT': this.walka(map, now); break;
          case 'HOME': this.goHome(map); break;
        }
      } catch (e) {
        console.error('[HH]', e);
        LOG.err('Wyjątek: ' + ((e && e.message) ? e.message : e));
      }
    },

    /* ---- skanowanie ---- */

    // Respy bierzemy z CONFIG (trasa biezacego herosa), nie z gry.
// Engine.heroesRespManager zwraca pozycje dla CALEGO swiata - sprawdzone
// w Ithan, gdzie podal 15 punktow, chociaz Zly Przewodnik tam nie respowie.
    spawnsOn(map) {
      return map.entry ? (map.entry.spawns || []) : [];
    },

    scan(map, now) {
      // Ithan i wszystko, co nie jest krokiem trasy - nie skanujemy.
      // Zly Przewodnik w Ithan nie respowie, a my tam nie mamy nic do roboty.
      // Stoimy na mapie, ktora NIE jest biezacym krokiem trasy (np. przechodzimy
      // przez nia w drodze gdzie indziej). Nie przesuwamy kroku - wracamy do GO.
      if (!map.entry) {
        this.lastGo = 0;
        this.setState('GO');
        return;
      }
      if (MAPS.isHome(map) || map.entry.pass) { this.nextMap(); return; }

      const list = this.spawnsOn(map);
      if (!list.length) {
        LOG.warn('Brak respa na ' + MAPS.label(map) + ' - lecę dalej.');
        this.nextMap();
        return;
      }

      const i = STORE.data.spawnIndex || 0;
      if (i >= list.length) {
        LOG.ok(MAPS.label(map) + ' obejdzie (' + list.length + ' respa).');
        this.nextMap();
        return;
      }

      const pt = list[i];
      const pos = GAME.pos();
      UI.set('resp', (i + 1) + '/' + list.length + ' → ' + pt.x + ',' + pt.y);

      // Dotarliśmy do respu. Przechodzimy dalej OD RAZU, nie wracając
      // przez scan() - inaczej bot stoi całą sekundę na każdym punkcie,
      // a przy 58 respach to prawie minuta zmarnowanego marszu.
      //
      // Tolerancja 1 kafelka: gra nie zawsze raportuje idealne współrzędne.
      // Bez tego bot nigdy nie trafiał "dokładnie" i czekał pełne
      // POINT_LIMIT_MS (60 s) na każdym punkcie.
      if (pos && Math.abs(pos[0] - pt.x) <= 1 && Math.abs(pos[1] - pt.y) <= 1) {
        const ostatni = (i + 1) >= list.length;
        this.zakonczPunkt();
        if (ostatni) {
          this.nextMap();
        } else {
          const nastepny = list[i + 1];
          STORE.set({ pointSince: now });
          LOG.info('Resp ' + (i + 1) + '/' + list.length + ': ' + pt.x + ',' + pt.y);
          // od razu ruszamy do następnego - bez czekania na tick
          this.walk(nastepny.x, nastepny.y);
        }
        return;
      }

      if (!GAME.inBounds(pt.x, pt.y)) {
        LOG.warn('Resp poza mapą ' + pt.x + ',' + pt.y + ' - pomijam.');
        this.zakonczPunkt();
        return;
      }

      // limit czasu na jeden resp
      if (STORE.data.pointSince === 0) {
        STORE.set({ pointSince: now });
        LOG.info('Resp ' + (i + 1) + '/' + list.length + ': ' + pt.x + ',' + pt.y);
        this.walk(pt.x, pt.y);
        return;
      }
      if (now - STORE.data.pointSince >= CONFIG.POINT_LIMIT_MS) {
        LOG.warn('Timeout respu ' + pt.x + ',' + pt.y + ' - idę dalej.');
        this.zakonczPunkt();
        return;
      }

      // pasek postępu turki + licznik pkt na mapie
      UI.bar2(i / list.length, GAME.locked(), (i + 1) + '/' + list.length + ' pkt');

      this.walk(pt.x, pt.y);
    },

    // Konec punktu respu: przesuwamy indeks i zerujemy licznik czasu.
    zakonczPunkt() {
      STORE.set({ spawnIndex: (STORE.data.spawnIndex || 0) + 1, pointSince: 0 });
      this.lastGo = 0;
    },

    // mapa zrobiona -> nastepny krok trasy
    nextMap() {
      this.startStep();
    },

    // startStep: przesuwamy sie o jeden krok dalej
    startStep() {
      STORE.set({ spawnIndex: 0, pointSince: 0, stepFails: 0 });
      this.lastGo = 0;
      this.travelAt = 0;

      const all = MAPS.all();
      const n = (STORE.data.routeIndex || 0) + 1;
      if (n >= all.length) {
        // Koniec trasy. NIE przelaczamy sie na nastepnego herosa -
        // wybierasz jednego i bot szuka go az go znajdzie
        // (decyzja gracza, 03.10).
        LOG.ok('Trasa ' + (MAPS.hero() ? MAPS.hero().nazwa : '') +
          ' obejdzie - wracam do Ithanu i zaczynam od ' + all[0].name + '.');
        STORE.set({ routeIndex: 0 });
        this.homeReason = 'koniecTrasy';
        STORE.set({ homeReason: 'koniecTrasy' });
        this.setState('HOME');
        return;
      }
      STORE.set({ routeIndex: n });
      this.setState('GO');
    },

    // Przełączenie na innego herosa z listy w UI. Kasuje stan obecnej
    // trasy (indeks kroku, znalezienie, walka) i zaczyna szukać od nowa
    // na trasie wybranego herosa.
    wybierzHeroza(key) {
      const cfg = MAPS.heroByKey(key);
      if (!cfg) {
        LOG.warn('Nie ma herosa o kluczu "' + key + '".');
        return false;
      }
      const obecny = MAPS.hero();
      if (obecny && obecny.key === cfg.key) {
        LOG.info(cfg.nazwa + ' jest już wybrany.');
        return false;
      }

      LOG.ok('Wybrany heros: ' + cfg.nazwa + (obecny ? ' (było ' + obecny.nazwa + ')' : '') + '.');

      GAME.stopWalk();
      // UWAGA: tu nie bylo GAME.stopAutofight() - takiej metody w GAME nie ma,
      // przez co wybór herosa padał wyjątkiem w połowie i bot dalej szukał
      // poprzedniego. Walkę bot prowadzi recznie (GAME.hit()), więc nie ma
      // czego zatrzymywać.
      STORE.set({
        heroKey: cfg.key,
        heroSince: Date.now(),
        routeIndex: 0,
        spawnIndex: 0,
        pointSince: 0,
        stepFails: 0,
        atakNaKomendę: false,
      });
      this.path = null;
      this.pathIdx = 0;
      this.lastGo = 0;
      this.travelAt = 0;
      this.deathHandled = false;
      this.foundSince = 0;
      this.goneSince = 0;
      this.fightNoticed = false;
      this.fightSince = 0;
      this.lastAtk = 0;
      this.fightLogged = false;
      this.homeReason = null;

      UI.build();
      // Powiadomienie na czacie klanowym. Bez tego `heros 2!` dzialalo,
      // ale cicho - uzytkownik widzial tylko zmiane podswietlenia w
      // panelu i myslel, ze komenda przeszla bez skutku (zgłoszone
      // 04.10). "heros 2!" na czacie klanu musi dostac odpowiedz.
      GAME.clanChat('/k ide za ' + cfg.nazwa);

      // Stan ustawiamy TYLKO gdy bot faktycznie jedzie. Wczesniej
      // `setState('GO')` leciało bezwarunkowo - klikniecie herosa przy
      // zatrzymanym botie dawalo badge "GO" i przycisk Start zablokowany
      // napisem "Bot juz jedzie", a nic nie dzialalo (sprawdzone 04.10:
      // postac stala 16 s w miejscu, idle=true). Bot byl martwy i nie
      // dawal sie odpalicic bez Stop.
      if (this.running) this.setState('GO');
      else this.setState('STOPPED');
      return true;
    },

    // Przeskakuje na nastepnego herosa. Uzywane TYLKO przez komende
    // "heros 2" z czatu i przez HH.nextHero() - automatycznie nikt nikogo
    // nie podmienia, bot szuka wybranego heroa az go znajdzie.
    switchHero(why) {
      const obecny = MAPS.hero();
      const nastepny = MAPS.nextHero(obecny ? obecny.key : null);
      if (!nastepny || (obecny && nastepny.key === obecny.key)) {
        LOG.info('Nie ma innego herosa do obejścia - wracam do ' + (obecny ? obecny.nazwa : '?') + '.');
        this.newRun();
        this.setState('GO');
        return;
      }
      LOG.info('Przełączam się z ' + obecny.nazwa + ' na ' + nastepny.nazwa +
        (why ? ' (' + why + ')' : '') + '.');
      this.wybierzHeroza(nastepny.key);
    },

    // stepNext: idzemy dokladnie po kolejnosci ROUTE
    stepNext(map, now) {
      const all = MAPS.all();
      const idx = STORE.data.routeIndex || 0;
      const step = MAPS.stepAt(idx);
      if (!step) { STORE.set({ routeIndex: 0 }); this.setState('GO'); return; }

      // stoimy na tej mapie
      if (Number(map.id) === Number(step.id)) {
        if (step.pass) {
          LOG.info('Przelot przez ' + step.name + ' - tu nic nie szukam.');
          this.startStep();
          return;
        }
        if (!step.spawns.length) {
          LOG.warn(step.name + ' - brak punktów, lecę dalej.');
          this.startStep();
          return;
        }
        STORE.set({ spawnIndex: 0, pointSince: 0, stepFails: 0 });
        this.lastGo = 0;
        LOG.info('Jestem na ' + step.name + ' - zaczynam obchód (' + step.spawns.length + ' respa).');
        this.setState('SCAN');
        return;
      }

      const prog = 'krok ' + (idx + 1) + '/' + all.length;

      // mamy juz wyznaczona sciezke - lezymy ja krok za krokiem
      if (this.path && this.path.length) {
        if (this.followPath(map)) {
          // dotarliśmy na miejsce
          this.lastGo = 0;
          return;
        }
        UI.set('resp', prog + ': ' + step.name);
        return;
      }

      if (!this.travelAt) this.travelAt = 0;
      if (now - this.travelAt < 4000) {
        UI.set('resp', prog + ': ' + step.name);
        UI.bar2(idx / all.length, GAME.locked(), 'krok ' + (idx + 1) + '/' + all.length);
        return;
      }
      this.travelAt = now;
      UI.set('resp', 'jade do ' + step.name);
      UI.bar2(idx / all.length, GAME.locked(), 'krok ' + (idx + 1) + '/' + all.length);

      // 1) pelna sciezka po zapamietanym grafie
      const sciezka = this.pathTo(step.id);
      if (sciezka && sciezka.length) {
        this.path = sciezka;
        this.pathIdx = 0;
        LOG.info('Trasa do ' + step.name + ': ' + sciezka.length + ' przeskoków ('
          + sciezka.map(function (k) { return k.to; }).join(' → ') + ')');
        STORE.set({ stepFails: 0 });
        return;
      }

      // 2) brama na biezacej mapie - wzduz trasy, do przodu
      const gw = this.explore(step.id);
      if (gw) {
        this.path = null;
        this.stepInto(gw);
        STORE.set({ stepFails: 0 });
        return;
      }

      // 3) nie ma drogi - po 8 probach (ok. 30 s) pomijamy krok
      const f = (STORE.data.stepFails || 0) + 1;
      STORE.set({ stepFails: f });
      LOG.warn('Brak drogi do ' + step.name + ' (próba ' + f + ') - szukam bramy.');
      if (f >= 8) {
        LOG.warn('Nie da się dojść do ' + step.name + ' - pomijam ten krok.');
        this.startStep();
      }
    },

    /* ---- heros: wykrywanie ---- */

    // Szukamy WSZYSTKICH herosow z CONFIG.HEROES, nie tylko biezacego.
    findHero() {
      const trafienie = MAPS.findAny(GAME.npcs());
      return trafienie ? trafienie.hero : null;
    },

    // Pelna informacja: sam NPC + jego wpis z CONFIG (nazwa, atakPoMin).
    heroInfo() {
      return MAPS.findAny(GAME.npcs());
    },

    // stan trwalych statystyk na herosa
    stat(key, pole, delta) {
      const st = STORE.data.heroStats || {};
      const row = st[key] || (st[key] = {});
      if (delta !== undefined) row[pole] = (row[pole] || 0) + delta;
      // "ostatnio" trzyma kiedy zdarzenie wystapilo - przy `znalezione`
      // pokazuje sie jako "X min temu" na liscie herosow. Bez tego
      // po wielu godzinach "znaleziono 2" nie mowi kiedy.
      if (pole === 'znalezione' || pole === 'zabici') row.ostatnio = Date.now();
      STORE.data.heroStats = st;
      STORE.save();
      return row[pole] || 0;
    },

    /* ---- komendy z czatu ---- */

    // "bij!" - zacznij bic teraz. Dziala nawet gdy bot jeszcze nie
    // znalazl herosa: zapisuje zadanie, wykonane jak tylko cele sie pojawi.
    cmdAtak() {
      const cfg = MAPS.hero();
      const info = this.heroInfo();
      if (info && (this.state === 'FOUND' || this.state === 'FIGHT')) {
        this.fightSince = Date.now();
        this.lastAtk = 0;
        this.fightLogged = false;
        if (this.state === 'FOUND') this.setState('FIGHT');
        LOG.ok('Rozkaz z czatu: bij! Atakuję ' + cfg.nazwa + '.');
        return true;
      }
      STORE.set({ atakNaKomendę: true });
      LOG.cmd('Rozkaz z czatu: bij! Bot zacznie bić, gdy znajdzie ' +
        (cfg ? cfg.nazwa : 'herosa') + '.');
      return true;
    },

    // "czekaj!" - przesun odliczanie do ataku wlasnego.
    // Odliczanie liczymy od foundSince, wiec cofamy go w czasie:
    // ustawiamy foundSince tak, by do ataku pozostalo atakOdNowaMin minut.
    cmdCzekaj() {
      const cfg = MAPS.hero();
      const ile = CONFIG.ATAK_OD_NOWA_MIN;
      if (this.state !== 'FOUND') {
        LOG.warn('"czekaj!" działa tylko gdy bot stoi przy ' +
          (cfg ? cfg.nazwa : 'herosie') + ' (stan: ' + this.state + ').');
        return false;
      }
      const teraz = Date.now();
      const ileMin = Math.round(ile / 60000);
      this.foundSince = teraz - ileMin * 60000;
      this.goneSince = 0;
      LOG.ok('"czekaj!" - odliczanie cofnięte, atak za ' + ileMin + ' min.');
      return true;
    },

    // "przywo!" - uzywa zwoju przypisanego do biezacego herosa.
    // Skąd bierze item-tpl: najpierw z CONFIG.SCROLLS (wpisane ręcznie),
    // potem z tego, czego skrypt się nauczył (HH.zwój()).
    cmdPrzywo() {
      const cfg = MAPS.hero();
      if (!cfg) return false;
      const tpl = GAME.zwojDla(cfg);

      if (!tpl) {
        LOG.warn('Nie znam jeszcze zwoju dla ' + cfg.nazwa
          + '. Otwórz worek z przedmiotami - skrypt rozpozna go po nazwie w ciągu 20 s.');
        return false;
      }

      // Zwoj dziala tylko tam, gdzie pojawia sie heros. Uzycie gdzie indziej
      // marnuje sztuke, wiec sprawdzamy, czy stoimy przy celu.
      const info = this.heroInfo();
      if (!info) {
        LOG.warn('Nie widzę ' + cfg.nazwa + ' - nie ma gdzie przywołać drużyny.');
        return false;
      }

      // Czy zwój w ogóle jest? Bez tego checku "przywo!" wygladalo tak
      // samo przy pełnym eq i przy pustym - komunikat był w obu
      // przypadkach taki sam, wiec nie wiadomo co się stało.
      const stan = GAME.zwojStan(cfg);
      if (stan.ile === 0) {
        LOG.warn(cfg.nazwa + ': zwój się skończył (0 szt). Trzeba kupić/dostać nowy.');
        NOTIFY.send({
          title: 'Zwój się skończył',
          description: cfg.nazwa + ' — 0 szt w ekwipunku. "przywo!" nie zadziała.',
          color: 0xdc4b4b,
        });
        return false;
      }
      if (stan.wEq === null) {
        LOG.warn(cfg.nazwa + ': nie widzę zwoju w ekwipunku (' + stan.powod +
          '). Spróbuję mimo to.');
      }

      const wynik = GAME.useItem(tpl);
      if (!wynik.ok) {
        LOG.warn('Nie użyłem zwoju: ' + wynik.powod + ' (tpl ' + tpl + ').');
        return false;
      }

      // Po 1 s sprawdzamy czy zniknal - dwuklik nie gwarantuje uzycia.
      const self = this;
      setTimeout(function () {
        const po = GAME.itemAmount(tpl);
        if (po >= 0 && po < wynik.before) {
          // zapamietaj stan, zeby UI pokazywal licznik nawet gdy worek
          // zostanie zamkniety i slotu nie bedzie w DOM
          STORE.data.scrollStan = Object.assign({}, STORE.data.scrollStan,
            { [cfg.key]: { ile: po, o: Date.now() } });
          UI.build();
          LOG.ok('Zwój użyty! Zostało ' + po + ' szt. (' + wynik.before + ' -> ' + po + ')');
          NOTIFY.send({
            title: 'Zwój użyty',
            description: 'Zwój przywołania dla ' + cfg.nazwa + '. Zostało ' + po + ' szt.',
            color: 0x8b5cf6,
          });
        } else {
          LOG.warn('Zwój się nie zużył (' + wynik.before + ' -> ' + po +
            ' szt.). Dwuklik nie zadziałał - trzeba użyć inaczej.');
        }
        void self;
      }, 1200);
      return true;
    },

    /* ---- znaleziony heros ---- */

    found(map, hero) {
      if (this.state === 'FOUND') return;
      const info = this.heroInfo();
      const cfg = info ? info.cfg : MAPS.hero();
      if (!cfg) return;
      const kto = cfg.nazwa;

      this.stat(cfg.key, 'znalezione', 1);
      const ileZnalezen = (STORE.data.found || 0) + 1;
      STORE.set({ found: ileZnalezen });
      // Kafelek "Znalez." nie byl aktualizowany nigdzie - przez to
      // zawsze pokazywal myslnik, chociaz licznik w STORE rosnal.
      UI.set('found', String(ileZnalezen));
      UI.tile('found', 'good');
      UI.bar2(1, 'good', kto);
      LOG.ok(kto + ' znaleziony na ' + MAPS.label(map) +
        ' @' + (hero ? hero.x + ',' + hero.y : '?'));

      NOTIFY.send({
        title: 'Znaleziono ' + kto,
        description: 'Bot stoi obok i czeka na drużynę.',
        color: 0x22a06b,
        fields: [
          { name: 'Mapa', value: MAPS.label(map), inline: true },
          { name: 'Kordy', value: hero ? hero.x + ', ' + hero.y : '?', inline: true },
          { name: 'Godzina', value: new Date().toLocaleTimeString('pl-PL'), inline: true },
        ],
      });

      // Ogłoszenie na czacie klanowym. Bez niego nikt poza toba nie wie,
      // że bot coś znalazł. Wiadomość jest krotka, bo czyta ja caly klan.
      const kordy = hero ? (hero.x + ',' + hero.y) : '?';
      const teksty = [
        'HH: ' + kto + ' ' + MAPS.label(map) + ' @' + kordy,
        'HH: bij! = atak, czekaj! = cofnij odliczanie, odwolaj 30m = przerwij',
      ];
      let wyslane = 0;
      for (let i = 0; i < teksty.length; i++) {
        if (GAME.clanChat(teksty[i])) wyslane++;
      }
      if (wyslane) {
        LOG.ok('Powiadomiłem klan (' + wyslane + ' wiadomości) na czacie.');
      } else {
        LOG.warn('Nie udało się napisać na czacie klanu (brak klanu lub kanału CLAN).');
      }

      // tu docelowo wstawi zapraszanie klanu i zwoj przywolania
      this.setState('FOUND');
    },

    /* ---- stojmy, czekamy, potem bijemy ---- */

    // Bot NIE bije od razu. Po znalezieniu stoi obok i czeka na drużynę
    // (atakPoMin minut). Jak nikt nie zrobił tego wtedy - sam zaczyna.
    //
    // Rozróżnienie dwóch sytuacji, gdy heros znika z listy NPC:
    //   zniknął w trakcie walki -> ktoś go zabil (albo my)
    //   zniknął bez walki        -> uciekł
    czekaj(map, now) {
      const info = this.heroInfo();
      const cfg = info ? info.cfg : MAPS.hero();
      if (!cfg) { this.setState('GO'); return; }

      // 1) zniknął - rozróżniamy ucieczkę od killa
      if (!info) {
        if (!this.foundSince) { this.setState('GO'); return; }
        if (!this.goneSince) {
          this.goneSince = now;
          LOG.warn(cfg.nazwa + ' zniknął z ekranu - czekam chwilę, czy to nie ucieczka.');
          return;
        }
        if (now - this.goneSince < 20000) return;

        // 20 s go nie ma = uciekł, nie zabity. Wracamy do szukania.
        this.goneSince = 0;
        this.foundSince = 0;
        this.fightNoticed = false;
        LOG.warn(cfg.nazwa + ' uciekł - wracam do szukania.');
        this.newRun();
        this.setState('GO');
        return;
      }

      if (!this.foundSince) this.foundSince = now;
      this.goneSince = 0;

      // Stoimy obok celu, żeby grupa od razu miała gdzie przyjść.
      const kafel = this.adjacentTo(info.hero);
      if (kafel) this.walk(kafel[0], kafel[1]);

      const sek = Math.floor((now - this.foundSince) / 1000);
      const zegar = Math.floor(sek / 60) + ':' + String(sek % 60).padStart(2, '0');
      const atakPo = (cfg.atakPoMin || 0);

      if (GAME.inFight()) {
        if (!this.fightNoticed) {
          this.fightNoticed = true;
          LOG.ok('Ktoś walczy z ' + cfg.nazwa + ' - czekam.');
        }
      } else if (this.fightNoticed) {
        this.fightNoticed = false;
        LOG.info(cfg.nazwa + ' - walka się skończyła.');
      }

      // "bij!" z czatu - rozkaz bezposredni, omijamy odliczanie
      if (STORE.data.atakNaKomendę) {
        STORE.set({ atakNaKomendę: false });
        LOG.ok('Wykonuję rozkaz "bij!" z czatu.');
        this.fightSince = now;
        this.lastAtk = 0;
        this.fightLogged = false;
        this.setState('FIGHT');
        return;
      }

      // minęło atakPoMin - czas brać sprawę w swoje ręce
      if (atakPo > 0 && sek >= atakPo * 60) {
        LOG.warn(cfg.nazwa + ' - nikt go nie zaatakował w ' + atakPo + ' min. Atakuję sam.');
        this.fightSince = now;
        this.lastAtk = 0;
        this.fightLogged = false;
        this.setState('FIGHT');
        return;
      }

      UI.set('resp', (atakPo > 0
        ? 'czekam na drużynę, atak za ' + Math.max(0, atakPo * 60 - sek) + ' s: ' + cfg.nazwa
        : 'czekam na drużynę: ' + cfg.nazwa) + ' ' + zegar);
      // Kafelek "Atak za" - ile sekund zostalo do ataku. To czas,
      // ktory jest znany dokladnie (nie zgadujemy) i czekasz na niego
      // przy stojacym obok herosie, wiec dostal wlasne miejsce
      // zamiast chowania sie w drugiej linijce.
      const zostalo = atakPo > 0 ? Math.max(0, atakPo * 60 - sek) : null;
      if (zostalo === null) {
        UI.set('atak', '—');
        UI.tile('atak', 'idle');
      } else {
        UI.set('atak', zostalo >= 60
          ? Math.floor(zostalo / 60) + ':' + String(zostalo % 60).padStart(2, '0')
          : zostalo + 's');
        // ostatnia minuta na pomarańczowo - zaraz zacznie
        UI.tile('atak', zostalo <= 60 ? 'warn' : 'good');
      }

      // pasek pelny + licznik "czekam / bije". Znalezienie jest
      // najwazniejszym momentem, wiec pasek jest zielony.
      UI.bar2(1, GAME.inFight() ? 'warn' : 'good', cfg.nazwa);
    },

    /* ---- własna walka (po atakPoMin) ---- */

    walka(map, now) {
      const info = this.heroInfo();
      const cfg = MAPS.hero();
      if (!cfg) { this.setState('GO'); return; }

      // Zniknął w trakcie walki = KILL
      if (!info) {
        if (!this.goneSince) { this.goneSince = now; return; }
        if (now - this.goneSince < 10000) return;
        this.kill(cfg, map, now);
        return;
      }
      this.goneSince = 0;

      // Limit wlasnej walki USUNIETY (03.10). Bot bije az do konca:
      // heros zniknie (kill) - wtedy wraca do Ithanu. Zero limitu
      // czasowego, bo odpuszczanie w polowie walki niczego nie daje.
      const kafel = this.adjacentTo(info.hero);
      if (kafel) this.walk(kafel[0], kafel[1]);

      if (now - (this.lastAtk || 0) > CONFIG.ATTACK_EVERY_MS) {
        this.lastAtk = now;
        const uderzyl = GAME.hit();
        if (uderzyl && !this.fightLogged) {
          this.fightLogged = true;
          LOG.ok('Atakuję ' + cfg.nazwa + ' @' + info.hero.x + ',' + info.hero.y + '.');
        }
      }

      const sek = Math.floor(((this.fightSince && now - this.fightSince) || 0) / 1000);
      UI.set('resp', 'atak ' + cfg.nazwa + ' ' +
        Math.floor(sek / 60) + ':' + String(sek % 60).padStart(2, '0'));
      UI.bar2(1, 'warn', 'walka');
    },

    // heros zabity - lecimy do Ithanu i wylogowujemy na czas respa
    kill(cfg, map, now) {
      const ile = Math.round(((this.fightSince && now - this.fightSince) || 0) / 60000);
      this.stat(cfg.key, 'zabici', 1);
      STORE.set({ killed: (STORE.data.killed || 0) + 1 });
      LOG.ok(cfg.nazwa + ' ZABITY! (nasza walka: ' + ile + ' min)');

      NOTIFY.send({
        title: 'Zabito ' + cfg.nazwa,
        description: 'Wracam do Ithanu i czekam na respawn.',
        color: 0xdc2626,
        fields: [
          { name: 'Mapa', value: MAPS.label(map), inline: true },
          { name: 'Walka', value: ile + ' min', inline: true },
          { name: 'Godzina', value: new Date().toLocaleTimeString('pl-PL'), inline: true },
        ],
      });

      this.walkaKoniec();
      this.newRun();
      this.homeReason = 'poKillu';
      STORE.set({ homeReason: 'poKillu' });
      this.setState('HOME');
    },

    // koniec walki (sukces albo odpuszczenie) - wracamy do szukania
    walkaKoniec() {
      this.fightSince = 0;
      this.lastAtk = 0;
      this.fightLogged = false;
      this.goneSince = 0;
      this.foundSince = 0;
      this.fightNoticed = false;
    },


    // Wolny kafelek obok celu - stajemy blisko, ale nie na nim samym.
    adjacentTo(cel) {
      if (!cel) return null;
      const kandydaci = [[Number(cel.x) + 1, Number(cel.y)], [Number(cel.x) - 1, Number(cel.y)],
        [Number(cel.x), Number(cel.y) + 1], [Number(cel.x), Number(cel.y) - 1]];
      const ok = [];
      for (let i = 0; i < kandydaci.length; i++) {
        if (GAME.inBounds(kandydaci[i][0], kandydaci[i][1])) ok.push(kandydaci[i]);
      }
      if (!ok.length) return null;
      const p = GAME.pos();
      if (!p) return ok[0];
      let najlepsza = ok[0], najmniej = 1e9;
      for (let i = 0; i < ok.length; i++) {
        const d = Math.abs(ok[i][0] - p[0]) + Math.abs(ok[i][1] - p[1]);
        if (d < najmniej) { najmniej = d; najlepsza = ok[i]; }
      }
      return najlepsza;
    },

    /* ---- powrot i wylogowanie ---- */

    newRun() {
      STORE.set({ routeIndex: 0, spawnIndex: 0, pointSince: 0, stepFails: 0 });
      this.lastGo = 0;
      this.travelAt = 0;
      this.path = null;
      this.pathIdx = 0;
    },

    // reason: 'koniecTrasy' = wrocilismy po obchodzie, lecimy od razu od nowa
    //         'poKillu'      = zabicie herosa, wyloguj i czekaj na resp
    goHome(map) {
      const reason = this.homeReason || STORE.data.homeReason || 'poKillu';

      if (MAPS.isHome(map)) {
        // kolo sie zrobilo - wracamy do szukania od razu, bez wylogowania
        if (reason === 'koniecTrasy' || reason === 'poSmierci') {
          LOG.ok(reason === 'poSmierci'
            ? 'W Ithanie po śmierci - lecę od nowa od Zniszczonego Opactwa.'
            : 'Trasa obejdzie, jestem w Ithanie - lecę od nowa od razu.');
          GAME.stopWalk();
          this.newRun();
          this.homeReason = null;
          STORE.set({ homeReason: null });
          this.setState('GO');
          return;
        }

        LOG.ok('W Ithanie.');
        GAME.stopWalk();

        // "odwolaj Nmin" z czatu ma PIERWSZENSTWO nad Minutnikiem i nad
        // CONFIG.RESPAWN_MIN. Bez tego warunku bot po dotarciu do Ithanu
        // przeliczal czas od nowa (120 min albo srednia z Minutnika) i
        // komenda "odwolaj 3min!" przepadala - skrypt czekal dwie
        // godziny zamiast trzech minut (zgloszone 04.10).
        const reczny = Number(STORE.data.odwolajReczny || 0);
        if (reczny > Date.now()) {
          const zaIle = Math.max(0, Math.round((reczny - Date.now()) / 60000));
          STORE.set({ nextRespawnAt: reczny, respawnZgloszony: true });
          LOG.ok('Wracam do gry o ' + new Date(reczny).toLocaleTimeString('pl-PL')
            + ' (twoje "odwolaj ' + zaIle + ' min", nie Minutnik).');
          this.newRun();
          this.setState('WAIT');
          GAME.logout();
          return;
        }
        // Czas minal albo komendy nie bylo - wracamy do normalnego
        // wyliczania i kasujemy flage, zeby nie wisiała w nieskonczonosc.
        STORE.set({ odwolajReczny: 0 });
        // po killu herosa bot czeka do respu; gdy nie znamy czasu - 120 min
        const timers = GAME.eliteTimers();
        let minutes = CONFIG.RESPAWN_MIN;
        if (timers.length) {
          let best = timers[0];
          for (let i = 1; i < timers.length; i++) if (timers[i].minutes > best.minutes) best = timers[i];
          const s = (STORE.data.respawnSamples || []).concat([best.minutes]).slice(-10);
          let sum = 0;
          for (let i = 0; i < s.length; i++) sum += s[i];
          const avg = Math.round(sum / s.length);
          STORE.set({ respawnSamples: s });
          minutes = avg;
          LOG.ok('Minutnik: ' + best.minutes + ' min (średnia ' + avg + ' min).');
        }
        const when = Date.now() + minutes * 60000;
        // Czy czas respu pochodzi z prawdziwego odczytu Minutnika, czy to
        // zgadnięte CONFIG.RESPAWN_MIN. Bez tego nie odróżnilibyśmy "obudzi
        // się o 14:32" od "wpadłem z 14:32, bo nie wiem ile to trwa".
        STORE.set({
          nextRespawnAt: when,
          respawnZgloszony: timers.length > 0,
          runs: (STORE.data.runs || 0) + 1,
        });
        LOG.ok('Czekam do ' + new Date(when).toLocaleString('pl-PL')
          + (timers.length ? '' : ' (szacunek - Minutnik jeszcze pusty)'));
        this.newRun();
        this.setState('WAIT');
        GAME.logout();
        return;
      }
      // Jesli mamy juz wyznaczona droge do Ithanu - lezymy ja krok za krokiem.
      // WAZNE: goToMap() tylko WYZNACZA sciezke, nie idzie nia. Bez tego
      // bloku bot liczyl trasę co 20 s i stal w miejscu (znalezione 14:00
      // na mapie 140 - doklADNie ten sam objaw co "zapetlenie" wczesniej).
      if (this.path && this.path.length) {
        if (this.followPath(map)) this.path = null;
        UI.set('resp', 'wracam do Ithanu');
        return;
      }

      if (!this.homeAt) this.homeAt = 0;
      if (Date.now() - this.homeAt < 20000) return;
      this.homeAt = Date.now();
      this.goToMap(CONFIG.HOME.id);
    },
  };

  /* =====================================================================
   *  9. CHAT
   * =================================================================== */

  const CHAT = {
    channel(node) {
      const cls = String((node && node.className) || '');
      if (cls.indexOf('chat-CLAN-message') !== -1) return 'klan';
      if (cls.indexOf('chat-GROUP-message') !== -1) return 'drużyna';
      return null;
    },

    text(node) {
      const copy = node.cloneNode(true);
      const skip = copy.querySelectorAll('.ts-section, .channel-section');
      for (let i = 0; i < skip.length; i++) skip[i].parentNode.removeChild(skip[i]);
      return String(copy.textContent || '').trim();
    },

    nick(node) {
      const n = node.querySelector('.guest-section, .nick-section, .author-section');
      return n ? String(n.textContent || '').trim() : '';
    },

    minutes(arg) {
      if (!arg) return CONFIG.RESPAWN_MIN;
      // Obcinamy wszystko poza cyframi i jednostka m/h. Bez tego
      // "30m!" nie pasowal do zadnego wzoru i minutes() wracalo
      // do RESPAWN_MIN, czyli uzytkownik prosil o 30 a dostawal 120.
      const s = String(arg).trim().toLowerCase().replace(/[^0-9mh]/g, '');
      let m = s.match(/^(\d+)\s*m$/);
      if (m) return parseInt(m[1], 10);
      m = s.match(/^(\d+)\s*h$/);
      if (m) return parseInt(m[1], 10) * 60;
      m = s.match(/^(\d+)$/);
      if (m) return parseInt(m[1], 10);
      return CONFIG.RESPAWN_MIN;
    },

    // Komendy sterujace wpisywane na czacie (klanowym lub druzyny).
    // Wszystkie zostaja w jednym miejscu, zeby latwo bylo wrocic
    // do pominietych i je wrocic pozniej.
    KOMENDY: {
      // bip - zacznij bic teraz, nie czekajc atakPoMin
      bij: function () { return BOT.cmdAtak(); },
      // czekaj - przesun odliczanie do ataku o atakOdNowaMin minut
      czekaj: function () { return BOT.cmdCzekaj(); },
      // odwolaj 30m - wroc do domu i wyloguj sie na tyle minut
      odwolaj: function (arg) {
        const mins = CHAT.minutes(arg);
        const when = Date.now() + mins * 60000;
        LOG.cmd('Odwołuję wyszukiwanie na ' + mins + ' min.');
        // `odwolajReczny` chroni komende przed nadpisaniem - patrz
        // goHome(), ktory bez tego warunku przeliczal czas od nowa zaraz
        // po dotarciu do Ithanu (zgłoszone 04.10: "odwolaj 3min!" nie
        // wrócił, bo skrypt ustawił sobie 120 min).
        STORE.set({ nextRespawnAt: when, homeReason: 'poKillu', odwolajReczny: when });
        BOT.newRun();
        BOT.setState('HOME');
        return true;
      },
      // przywo - uzywa zwoju przypisanego do herosa (CONFIG.SCROLLS)
      przywo: function () { return BOT.cmdPrzywo(); },

      // zap - dodaje aktywnych czlonkow klanu do naszej druzyny.
      // Klikamy ".add-to-group" w oknie klanu (przycisk tip-id 2329).
      // Sprawdzone na zywo 02.10 w HTML wiersza czlonka:
      //   <div class="add-to-group"><div class="button small green" tip-id="2329">
      //   <div class="edit">        <div class="button small green" tip-id="2330">
      // Drugi to edycja rangi przez zaloziciela - go nie ruszamy.
      // zap - zaprasza ostatniego autora wiadomosci w czacie do grupy.
      // Klikamy prawym w jego nick i wybieramy "Zapros do grupy".
      zap: function () {
        const nick = GAME.inviteFromChat();
        if (!nick) {
          LOG.warn('"zap!" - nie widzę nicku w czacie albo menu nie otworzyło się.');
          return false;
        }
        LOG.ok('"zap!" - wysyłam zaproszenie do grupy: ' + nick);
        NOTIFY.send({
          title: 'Zaproszenie do grupy',
          description: 'Wysłane do ' + nick,
          color: 0x8b5cf6,
        });
        return true;
      },

      // oddaj d - przekazuje dowodztwo w druzynie.
      // Okno grupy ma div.give-lead-party przy kazdym czlonku. Klik
      // wysyla _g(`party&a=give&id=${memberId}`) - potwierdzenie
      // w grze to "Czy na pewno chcesz przekazac dowodztwo Graczowi %name%?",
      // wiec po kliknieciu musimy potwierdzic.
      oddaj: function () {
        const okno = document.querySelector('.party-window');
        if (!okno) {
          LOG.warn('"oddaj d!" - okno drużyny jest zamknięte. Otwieram.');
          try { Engine.interface.clickParty(); } catch (e) { /* brak */ }
          setTimeout(function () { CHAT.KOMENDY.oddaj(); }, 1500);
          return true;
        }

        // Przyciski sa w kolejnosci listy graczy. Pomijamy siebie -
        // oddanie dowodztwa samemu sobie nie ma sensu.
        const przyciski = [...okno.querySelectorAll('.give-lead-party')];
        if (!przyciski.length) {
          LOG.warn('"oddaj d!" - nie widzę przycisku oddania dowództwa (nie jestem liderem?).');
          return false;
        }

        // UWAGA: nie wolno laczyc listy przyciskow z osobna lista nickow -
        // maja rozne dlugosci (selektor nickow lapie tez puste elementy)
        // i wskazanie zlych indeksow konczylo sie wyjatkiem.
        // Nick bierzemy z tego samego wiersza co przycisk.
        const mojNick = (Engine.hero.d && Engine.hero.d.nick) || '';
        let wybrany = null;
        for (let i = 0; i < przyciski.length; i++) {
          const wiersz = przyciski[i].closest('.party-member');
          const nickEl = wiersz
            ? wiersz.querySelector('.nickname-text, .character-info-nick')
            : null;
          const nick = nickEl ? String(nickEl.textContent || '').trim() : '';
          if (nick && nick !== mojNick) { wybrany = { przycisk: przyciski[i], nick: nick }; break; }
        }
        if (!wybrany) { wybrany = { przycisk: przyciski[0], nick: 'pierwszy członek' }; }

        const kto = wybrany.nick;
        wybrany.przycisk.click();
        LOG.ok('"oddaj d!" - kliknąłem oddanie dowództwa: ' + kto + '.');

        // Potwierdzenie w grze: "Czy na pewno chcesz przekazać dowództwo
        // Graczowi %name%? Tak [↵] Nie [Esc]".
        // Przycisk ma klase alert-accept-hotkey - szukamy po klasie,
        // nie po tekscie, bo w napisie jest podpowiedz "Tak [↵]"
        // i dopasowanie /^tak$/ nic nie znajdowalo (sprawdzone 00:13).
        const potw = function (proby) {
          const tak = document.querySelector('.mAlert .alert-accept-hotkey');
          if (tak) {
            tak.click();
            LOG.ok('"oddaj d!" - potwierdziłem przekazanie dowództwa: ' + kto + '.');
            return;
          }
          // zapasowo: przycisk zaczynajacy sie od "Tak"
          if (!proby) {
            const alt = [...document.querySelectorAll('.mAlert .button')]
              .filter(n => /^tak\\b/i.test(String(n.textContent || '').trim()));
            if (alt.length) {
              alt[0].click();
              LOG.ok('"oddaj d!" - potwierdziłem (zapasowo): ' + kto + '.');
              return;
            }
          }
          if (proby > 0) setTimeout(function () { potw(proby - 1); }, 400);
        };
        potw(8);
        return true;
      },
    },

    handle(raw, source, nick) {
      const text = String(raw || '').toLowerCase().trim();
      if (!text) return;
      const who = nick ? ' od ' + nick : '';

      // Bot zatrzymany - komendy nadal działają (zap!, bij!, przywo!),
      // bo to one sterują całą akcją. Szukanie (GO/SCAN) wstrzymujemy,
      // żeby komenda nie została przerwana w połowie.
      //
      // Wczesniej tu bylo "if (!BOT.running) return;" - przez to komenda
      // napisana przy zatrzymanym botie ginela po cichu i człowiek nie
      // wiedzial czemu (sprawdzone 00:0x - "zap!" bez efektu).
      const wstrzymany = !BOT.running;
      if (wstrzymany) {
        // `heros` BYLO tu pominiete (04.10) - przez to `heros 2!` przy
        // zatrzymanym botie ginelo cicho, bez logu i bez powiadomienia.
        // Wybor herosa to zmiana ustawienia, nie ruch postaci, wiec
        // nie ma powodu, zeby byl blokowany.
        const jestKomenda2 = /^(zap|bij|czekaj|oddaj|przyw[oó]|odwo[lł]aj|heros)\b/.test(text);
        if (!jestKomenda2) return;
        LOG.cmd('Czat (' + source + ')' + who + ': ' + text +
          ' (bot zatrzymany - wykonuję samą komendę)');
      }

      // Blokada powtorek. Klikanie w przycisk w oknie klanu generuje kolejne
      // zdarzenie czatu, wiec jedna wiadomosc potrafi odpalic komende
      // kilka razy ("zap!" x4 - sprawdzone 23:33, "przywo!" x2 - 23:39).
      // Kluczem jest SAM TEKST, bez kanalu - bo to samo zdarzenie przychodzi
      // raz jako wezel, raz jako jego dziecko `.new-chat-message`.
      const jestKomenda = /^(zap|bij|czekaj|oddaj|przyw[oó]|przyw[oó]l|przyw[oó]ł|odwo[lł]aj)\b/.test(text);
      if (jestKomenda) {
        const teraz = Date.now();
        if (this.ostatniaKomenda && this.ostatniaKomenda.tekst === text
            && teraz - this.ostatniaKomenda.t < 6000) {
          return;
        }
        this.ostatniaKomenda = { tekst: text, t: teraz };
      }

      if (wstrzymany) {
        // Wykonaj komende bez ruszania petli szukania.
        if (/^(zap|oddaj|przyw[oó]|odwo[lł]aj)\b/.test(text)) { /* te nie wymagaja petli */ }
      }

      // "odwolaj 30m"
      // Argument lapie bez wykrzyknika - "odwolaj 30m!" ma byc
      // tym samym co "odwolaj 30m".
      let m = text.match(/(?:^|\s)odwo[lł]aj(?:\s+(\S+?))?\s*[!.!]*\s*$/);
      if (m) {
        LOG.cmd('Czat (' + source + ')' + who + ': odwołaj ' + this.minutes(m[1]) + ' min');
        this.KOMENDY.odwolaj(m[1]);
        return;
      }

      // "bij!"
      if (/(?:^|\s)bij\s*[!.!]*\s*$/.test(text)) {
        LOG.cmd('Czat (' + source + ')' + who + ': bij!');
        this.KOMENDY.bij();
        return;
      }

      // "czekaj!"
      if (/(?:^|\s)czekaj\s*[!.!]*\s*$/.test(text)) {
        LOG.cmd('Czat (' + source + ')' + who + ': czekaj!');
        this.KOMENDY.czekaj();
        return;
      }

      // "zap!"
      if (/(?:^|\s)zap\s*[!.!]*\s*$/.test(text)) {
        LOG.cmd('Czat (' + source + ')' + who + ': zap!');
        this.KOMENDY.zap();
        return;
      }

      // "oddaj d!"
      if (/(?:^|\s)oddaj\s+d?\s*[!.!]*\s*$/.test(text)) {
        LOG.cmd('Czat (' + source + ')' + who + ': oddaj d!');
        this.KOMENDY.oddaj();
        return;
      }

      // "przywo!" / "przywol!" / "przywoł!"
      // UWAGA: regex musi dopuszczac brak spolgloski na koncu - samo
      // "przywo[lł]" NIE lapało "przywo!", przez co komenda byla ignorowana.
      if (/(?:^|\s)przywo(?:l|ł)?\s*[!.!]*\s*$/.test(text)) {
        LOG.cmd('Czat (' + source + ')' + who + ': przywo!');
        this.KOMENDY.przywo();
        return;
      }

      // "heros 2" - przełączenie na herosa o podanym numerze z listy w UI
      // Wykrzyknik na koncu dopuszczony - tak jak w know how
      // ("heros x!"). Wczesniej regex go nie przyjmowal, przez co
      // "heros 2!" przepadalo cicho.
      let mn = text.match(/(?:^|\s)heros\s+(\d+)\s*[!.!]?\s*$/);
      if (mn) {
        const lista = MAPS.heroList();
        const idx = parseInt(mn[1], 10) - 1;
        if (idx < 0 || idx >= lista.length) {
          LOG.warn('Nie ma herosa nr ' + mn[1] + ' (jest ' + lista.length + ').');
          return;
        }
        LOG.cmd('Czat (' + source + ')' + who + ': heros ' + mn[1]);
        BOT.wybierzHeroza(lista[idx].key);
        return;
      }
    },

    // Obsluga jednej wiadomosci, z gwarancja ze wzel przetworzymy RAZ.
    // Bez tego ta sama wiadomosc dochodzila dwa razy: raz jako wezel
    // nadrzedny dodany do DOM, raz jako jego dziecko `.new-chat-message`.
    // Skutek: kazda komenda wykonywana x2 - "zap!" wysyłal dwa
    // zaproszenia, "przywo!" zużywał dwa zwoje (23:33, 23:39, 00:06).
    handleOnce(el, raw, source, nick) {
      if (!el) { this.bezpiecznie(raw, source, nick); return; }
      if (!this.obrobione) this.obrobione = new WeakSet();
      if (this.obrobione.has(el)) return;
      this.obrobione.add(el);
      this.bezpiecznie(raw, source, nick);
    },

    // Kazda komenda w osobnym try/catch.
    //
    // Wczesniej handle() rzucalo wyjatkiem prosto do MutationObserver,
    // wiec blad w jednej komendzie gasil calkowicie - nie bylo ani logu,
    // ani powiadomienia, ani sladu czemu cos nie zadzialalo. Tak zniklo
    // oddawanie dowodztwa: wyjatkiem na zlym indeksie przycisku
    // (sprawdzone 00:13).
    bezpiecznie(raw, source, nick) {
      try {
        this.handle(raw, source, nick);
      } catch (e) {
        const opis = (e && e.message) ? e.message : String(e);
        LOG.err('Komenda z czatu "' + String(raw || '').trim() + '" padła: ' + opis);
        NOTIFY.send({
          title: 'Błąd komendy',
          description: '"' + String(raw || '').trim() + '" - ' + opis,
          color: 0xdc4b4b,
        });
        if (typeof console !== 'undefined') console.error('[HH] komenda', raw, e);
      }
    },

    watch() {
      const process = function (node) {
        if (!node || node.nodeType !== 1) return;
        const src = CHAT.channel(node);
        if (src) { CHAT.handleOnce(node, CHAT.text(node), src, CHAT.nick(node)); return; }
        if (!node.querySelectorAll) return;
        const found = node.querySelectorAll('.new-chat-message');
        for (let i = 0; i < found.length; i++) {
          const s2 = CHAT.channel(found[i]);
          if (s2) CHAT.handleOnce(found[i], CHAT.text(found[i]), s2, CHAT.nick(found[i]));
        }
      };
      const obs = new MutationObserver(function (muts) {
        for (let i = 0; i < muts.length; i++) {
          const added = muts[i].addedNodes;
          for (let j = 0; j < added.length; j++) process(added[j]);
        }
      });
      obs.observe(document.body || document.documentElement, { childList: true, subtree: true });

      // ZABEZPIECZENIE: obserwator widzi tylko nowe wezly. Gra potrafi
      // dopisac tekst do JUZY istniejacego wiersza czatu - wtedy
      // `addedNodes` jest puste i komenda ginela po cichu (zgloszone
      // 04.10: "zap!" i "heros 2!" na czacie bez efektu, zero wpisow
      // w DevLogu).
      //
      // Co 2 s przechodzimy po ostatnich wiadomosciach i przepuszczamy
      // je przez handleOnce(), ktory ma wlasny WeakSet - wiec wiersz
      // obsluzony juz raz nie zostanie przetworzony drugi raz, a my
      // lapiemy kazdy sposob dostarczenia wiadomosci.
      setInterval(function () {
        const w = document.querySelectorAll('.chat-CLAN-message, .chat-GROUP-message');
        for (let i = Math.max(0, w.length - 12); i < w.length; i++) {
          process(w[i]);
        }
      }, 2000);

      LOG.info('Nasłuch czatu aktywny.');
    },
  };

  /* =====================================================================
   * 10. BOOT
   * =================================================================== */

  let booted = false;

  function boot() {
    if (booted) return;
    booted = true;

    STORE.load();
    MAPS.seedGraph();

    // Wznowienie po odswiezeniu strony. Wczesniej boot() tylko
    // ODCZYTYWAŁ zapisany stan: `BOT.state = STORE.data.state`, przez co
    // po refreshu badge pokazywal GO, przycisk Start byl zablokowany
    // napisem "Bot juz jedzie", a petla nie istniała - `BOT.running`
    // byl false i `BOT.timer` null. Bot wygladal jak dzialajacy, a
    // stojal, i nie dalo sie go odpalic inaczej niz Stop + Start
    // (zgloszone 04.10: "po przeladowaniu bot znika i trzeba go
    // znów wywolywac").
    //
    // Teraz stan odtwarzamy naprawde: start() zaklada interwal 1 s i
    // ustawia SCAN albo WAIT zależnie od tego, czy postac jest
    // zalogowana. Przy wyłączonym AUTO_RESUME bot po odswiezeniu
    // zostaje zatrzymany i startuje sie przyciskiem Start.
    if (CONFIG.AUTO_RESUME && STORE.data.state && STORE.data.state !== 'STOPPED') {
      BOT.start();
    } else {
      BOT.state = 'STOPPED';
    }

    // Kolejnosc istotna: najpierw okienko DEVLOG (UI.build() kasuje
    // #hh-panel przy kazdym przebudowaniu, log mieszka osobno),
    // potem glowny panel, ktory odtwarza historie do logu.
    UI.logWindow();
    UI.build();
    CHAT.watch();

    // Rozpoznanie zwojow z ekwipunku. Po build(), zeby pierwszy skan
    // mial juz panel do odswiezenia chipow. Wlasny interwal 20 s,
    // niezalezny od BOT.timer - dziala takze przy zatrzymanym bocie.
    GAME.startZwoje();

    document.addEventListener('keydown', function (e) {
      // Esc tylko gdy jest co zamknac. Bez tego blokowaloby Escape
      // grze (menu, rozmowa, anulowanie).
      if (e.key === 'Escape') {
        if (UI.zamknijOkna()) { e.preventDefault(); e.stopPropagation(); }
        return;
      }
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const k = String(e.key || '').toLowerCase();
      if (k === 'h') {
        e.preventDefault();
        UI.przełączMin();
      } else if (k === 'r') {
        e.preventDefault();
        UI.build();
      } else if (k === 'l') {
        e.preventDefault();
        UI.toggleLog();
      }
    });

    window.HH = {
      start: function () { BOT.start(); },
      stop: function () { BOT.stop(true); },
      state: function () { return BOT.state; },
      ui: function () { UI.build(); },
      // Rozwinie / zwinie DevLog (to samo co Alt+L).
      log: function () { UI.toggleLog(); },
      // Okno ustawien (webhook) i know how.
      set: function () { UI.setWindow(); },
      help: function () { UI.helpWindow(); },
      // Aktualny adres webhooka i jego zrodlo.
      webhook: function () {
        return { adres: NOTIFY.adres(), zPanelu: !!(STORE.data.webhook || '').trim() };
      },
      // Przełączenie herosa z konsoli (przydatne przy kilku herosach).
      // HH.hero('klucz') - wymusza szukanie tego herosa od początku trasy.
      nextHero: function () { BOT.switchHero('z konsoli'); },
      // Rozpoznaje zwój z podpowiedzi pod kursorem i zapamiętuje go.
      // AWARYJNE - normalnie skrypt rozpoznaje zwoje sam, co 20 s,
      // czytając nazwy z TIPS.allTips (patrz GAME.startZwoje).
      // To wywołanie zostaje dla sytuacji, gdy nazwa w CONFIG.HEROES
      // nie pasuje do nazwy w grze i trzeba wskazać ręcznie.
      // Użycie: najeedź myszką na zwój w grze, potem HH.zwój() w konsoli.
      zwój: function () {
        const r = GAME.zapamietajZwoj();
        if (!r.ok) {
          LOG.warn('Nie zapamiętałem zwoju: ' + r.powod);
          if (r.nazwa) LOG.info('Podpowiedź brzmiała: "' + r.nazwa + '" (item-tpl-' + r.tpl + ')');
        }
        UI.build();
        return r;
      },

      // Od razu po skanie, bez czekania na interwał 20 s.
      skanujZwoje: function () {
        const r = GAME.odswiezZwoje(true);
        if (!r.ok) LOG.warn(r.powod);
        else {
          LOG.ok('Zwoje po skanie: ' + JSON.stringify(r.scrolls || {}));
          UI.build();
        }
        return r;
      },
      // Stan wszystkich zworow - co bot wie, a czego nie.
      zwoje: function () {
        return MAPS.heroList().map(function (h) {
          return {
            key: h.key,
            nazwa: h.nazwa,
            zwójWConfigu: h.zwój || null,
            tpl: GAME.zwojDla(h),
            ile: (function(){ const t = GAME.zwojDla(h); return t ? GAME.itemAmount(t) : null; })(),
          };
        });
      },
      hero: function () { return MAPS.hero(); },
      heroes: function () { return MAPS.heroList(); },
      // Podglad stanu bez wlaczania walki - do podgladu UI.
      podglad: function () {
        const lista = MAPS.heroList();
        const st = STORE.data.heroStats || {};
        return lista.map(function (h) {
          return {
            key: h.key, nazwa: h.nazwa, atakPoMin: h.atakPoMin,
            kroki: (h.route || []).length,
            biezacy: !!(MAPS.hero() && MAPS.hero().key === h.key),
            znalezione: (st[h.key] && st[h.key].znalezione) || 0,
            zabici: (st[h.key] && st[h.key].zabici) || 0,
          };
        });
      },
      // Skok do dowolnego kroku trasy (0 = Zniszczone Opactwo).
      // Przydatne przy testach i gdy chcesz zacząć od konkretnej mapy.
      jump: function (n) {
        const i = Math.max(0, Number(n) || 0);
        const krok = MAPS.stepAt(i);
        STORE.set({ routeIndex: i, spawnIndex: 0, pointSince: 0, stepFails: 0, homeReason: null });
        BOT.path = null;
        BOT.pathIdx = 0;
        BOT.lastGo = 0;
        BOT.travelAt = 0;
        BOT.deathHandled = false;
        LOG.info('Skok do kroku ' + (i + 1) + '/' + MAPS.all().length + ' - ' + (krok ? krok.name : '?'));
        BOT.setState('GO');
      },
      probe: function () {
        return {
          url: location.href,
          loggedIn: GAME.loggedIn(),
          dead: GAME.dead(),
          state: BOT.state,
          map: GAME.rawMap(),
          cords: GAME.cords(),
          idle: GAME.idle(),
          locked: GAME.locked(),
          npcs: GAME.npcs().length,
          hero: BOT.findHero(),
          heroSpawns: GAME.heroSpawns(),
          gateways: GAME.gateways(),
          timers: GAME.eliteTimers(),
          store: STORE.data,
        };
      },
    };

    console.log('%cHeros Hunter v3%c - HH.start() / HH.probe() / Alt+H',
      'color:#a78bfa;font-weight:bold', 'color:#888');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();