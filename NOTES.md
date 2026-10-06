# Heros Hunter — stan na 04.10.2026

## UWAGA: TO JEST WERSJA TESTOWA, NIE GOTOWY SKRYPT DO ZAINSTALOWANIA

Trzy rzeczy do naprawienia przed użyciem na poważnie:

1. **Graf bram dotyczy tylko świata `gefion`.** Na `experimental` i `gordion` bot
   nie ma dokąd iść — przeskakuje kroki po 8 próbach (`Brak drogi` → `pomiń krok`).
   Skoro działa na `gefion`, zostań na `gefion`.
2. **`oddaj d!` — jedyna komenda o niepewnym statusie.** Naprawiona (błąd
   indeksu przycisku + selektor potwierdzenia), ale niepotwierdzona na żywo.
3. **Trzy herosy z pustą trasą** (`zlodziej`, `opetany-paladyn`,
   `piekielny-kosciej`) — czekają na nowy graf przejść. Patrz
   „Stan na 04.10" niżej. `_verify.js` wypisuje dla nich `BŁĄD: pusta trasa`
   i to jest **świadome**, nie regresja. Działa tylko `przewodnik`.

## Pliki (katalog: `C:\Users\numb7\Documents\Default Project\`)

| Plik | Co |
|---|---|
| `heros-hunter.user.js` | właściwy skrypt, 5340 linii, `node --check` → OK |
| `_verifyConfig.js` | sprawdza, że każda właściwość używana jako `CONFIG.X` istnieje + że każdy heros ma zwój |
| `_verifyCzat.js` | sprawdza, że 6 komend się dopasowuje i nic nie daje fałszywych dopasowań |
| `_verify.js` | sprawdza każdą trasę: osiągalność map, przejścia, duplikaty respów |
| `_bridge.js` | osobny proces: czyta kanał Discorda tokenem bota, odpowiada modelem `space-bunny-free` (OpenCode Zen, za darmo) |
| `_bridge.config.json` | **tajny** — token bota + klucz Zen. Nigdy nie wysyłaj go w archiwum |
| `_bridge.config.example.json` | wzór konfigu — to kopiuj, nie `config.json` |
| `graf-bram.json` | wszystkie bramy odczytane z gry (18 map) |
| `trasa.json` | trasa w formie czytelnej (21 kroków) |
| `margonem-maps.tsv` | 223 mapy: ID, nazwa, pozycja na mapie świata |
| `spawny-verified.json` | spawny herosa Zły Przewodnik odczytane z gry 02.10 |
| `hh-ui-preview.html` | podgląd UI (dwuklik → przeglądarka) |
| `_bridge.log`, `_bridge.err.log` | logi mostka — `_bridge.err.log` pusty = brak błędów |

**Pliki wyprowadzane 04.10** (tryb eksperymentalny, 3 backupy skryptu) przeniesione
do `%LOCALAPPDATA%\Temp\opencode\smietka\`. Zostają tam do końca sesji.
Jeśli któraś zkaże się przydatna — `_bridge.przed-poprawkami.js` to mostek
przed poprawkami z tego dnia, trzy pozostałe to tryb eksperymentalny i backupy.

**Uruchomienie:** `node _verifyConfig.js`, `_verifyCzat.js`, `_verify.js` — pierwsze
dwa muszą wypisać `WSZYSTKO OK` po każdej zmianie skryptu. Trzeci wypisuje
`BŁĘDY: 3` dopóki nie uzupełnisz tras trzech herosów — to stan świadomy.

## Instalacja
Notatnik → `Ctrl+A/Ctrl+C` → Tampermonkey → Nowy skrypt → `Ctrl+A` → `Ctrl+V` → `Ctrl+S`.

## Skróty i konsola

| Klawisz | Co |
|---|---|
| `Alt+H` | pokaż/ukryj panel |
| `Alt+L` | DevLog — okno logu (skrót działa, w panelu go nie ma) |
| `Alt+R` | przebuduj panel |
| `Esc` | zamknij okna skryptu (nie przechwytuje Esc gry) |

W konsoli: `HH.probe()` stan gry · `HH.podglad()` herosowie i liczniki ·
`HH.zwoje()` zwoje · `HH.jump(N)` skok na krok trasy · `HH.start()` / `HH.stop()`.

## Mostka trzeba odpalać osobno
Skrypt gry działa bez mostka — ten tylko gada na Discordzie. Po instalacji
skryptu uruchom `node _bridge.js` (status: <http://127.0.0.1:8181/>).
Bez tego pamiętasz wcisnąć ręcznie. Zatrzymanie: `Ctrl+C` w oknie.

## Stan trasy — ZWERYFIKOWANY

Trasa podana przez gracza, 21 kroków, **58 punktów respu na 16 mapach**.
Wszystkie 20 przejść potwierdzone odczytem z gry (`graf-bram.json`).

```
Ithan ─42,99→ 8 ─0,38→ 38 ─37,6→ 814 ─26,13→ 815 ─41,28→ 816 ─17,7→ 3869
      ─6,1→ 815 ─18,5→ 814 ─16,26→ 38 ─53,63→ 150 ─53,15→ 6473 ─27,9→ 6474
      ─5,11→ 6475 ─43,62→ 6473 ─9,30→ 150 ─57,26→ 176 ─39,11→ 4582 ─3,3→ 4550
      ─5,52→ 4262 ─39,39→ 179 ─12,28→ 140
```

**Kluczowe odkrycie:** `140 Mroczny Przesmyk` **nie ma bramy do Ithan**.
Powrót idzie: `140 ─32,0→ 150 ─53,0→ 38 ─95,38→ 8 ─10,0→ Ithan`.

Poprawka w Mrocznym Przesmyku: punkt **(42,34) pominięty** na życzenie gracza.
W Zapomnianym Szlaku `(17,15)` było podwojnie — usunięte.

## Jak to teraz działa

- `CONFIG.ROUTE` — kolejność kroków. `pass: true` = czyste przejście, bez szukania.
- `CONFIG.GATEWAYS` — **graf wstrzykiwany do `STORE.data.graph` przy starcie** (`MAPS.seedGraph()`).
  Bot zna całą trasę od razu, nie musi nic odkrywać. Nigdy nie nadpisuje danych
  zapamiętanych z gry — `rememberGraph()` ma pierwszeństwo.
- Nawigacja: `pathTo()` (BFS po grafie) → `followPath()` → `stepInto()`.
  Każdy krok ścieżki niesie współrzędne bramy **z mapy źródłowej**, więc nie ma
  już błędu „idzie na kafelek z cudzej mapy".
- `explore()` działa tylko jako awaryjny fallback, gdy brak drogi w grafie.

Walidacja po zmianach: `node _verify.js` → musi wypisać `WSZYSTKO OK`.

## Zdobyte wartości (przetestowane na żywo, świat gefion)
| Co | Wartość |
|---|---|
| Domena gry | `gefion.margonem.pl` |
| ID mapy | `Engine.map.d.id` (numeryczne, `mainid` jako zapas) |
| Rozmiar mapy | `Engine.map.size` → `{x,y}` w kafelkach (Ithan 96×100) |
| Ruch | `Engine.hero.autoGoTo({x,y})`, `Engine.stepsToSend.append({x,y})` |
| Wejście w bramę | `Engine.interface.clickGoGateway()` — postój na kafelku nie teleportuje |
| Walka | `Engine.battle.w_amount` / `myteam` — **nie** `battle.show` |
| NPC | `Engine.npcs.check()` → obiekt, `d.type === 2` = heros |
| Śmierć | `Engine.dead` **nie wraca do false** — źródłem prawdy `Engine.hero.d.hp` |
| Respy | `Engine.heroesRespManager` podaje pozycje dla **całego świata** — nie używać |
| Ekwipunek | `Engine.items.fetchLocationItems()` zwraca pustkę; itemy tylko w DOM |
| Czat | `.new-chat-message.chat-CLAN-message` / `.chat-GROUP-message` |
| Minutnik | `.elite-timer-wnd .list` (wypełnia się dopiero po killu) |
| Wyjście z sesji | logout przez `div.label` o tekście „Wyloguj" |

## Wychwycone bugi (naprawione)
1. `autoGoTo` ma guard `rx != d.x` → w trakcie animacji kafelka wywołanie jest no-opem.
2. `Engine.map.blockMove` to **funkcja**, nie flaga → `getMoveBlock()`.
3. `Engine.npcs.check()` nie zwraca tablicy.
4. Selektory czatu `.sys_clan`/`.sys_party` nie istnieją w obecnym NI.
5. `Engine.party` / `Engine.clan` nie istnieją w tym buildzie.
6. Postój **na** kafelku bramy nie teleportuje; `Engine.stepsToSend` bywa ignorowany.
   Ratunek: `Engine.interface.clickGoGateway()`.
7. `explore()` zwracał bramę **innej mapy** z grafu → bot stał w miejscu i próbował
   wejść w kafelek, którego nie ma. Teraz zwraca wyłącznie bramy bieżącej mapy.
8. Kolejność `CONFIG.MAPS` (mapa po ID) nie odpowiadała połączeniom w świecie →
   bot szukał drogi, której nie ma. Zastąpione `CONFIG.ROUTE`.
9. **Stara instancja skryptu działająca w tle nadpisywała `STORE`** — graf wstrzyknięty
   przy starcie znikał po kilku sekundach. Po wstrzyknięciu zawsze najpierw
   `HH.stop()` / przeładowanie strony.

## Wielu herosów (v3.2)

`CONFIG.HEROES` to lista obiektów, każdy z własną trasą, własnym zwojem i
własnym zachowaniem. Wybór herosa jest **ręczny** — klikasz na liście w panelu
albo piszesz `heros 2` na czacie. Bot **nie przeskakuje sam** na nikogo:
szuka wybranego tak długo, aż go znajdzie. `CONFIG.ORDER` decyduje już tylko
o kolejności na liście w UI i o numerach przy `heros N`.

| Pole | Znaczenie |
|---|---|
| `key` | unikalny identyfikator (małe litery, bez spacji) |
| `nazwa` | nick w grze; dopasowanie normalizuje tekst, więc „Zły Przewodnik (63w)" pasuje |
| `zwój` | **nazwa** zworu w grze, dokładnie jak widnieje po najechaniu myszką (puste = brak) |
| `atakPoMin` | po ilu minutach czekania na klan bot sam zaczyna bić (`0` = nigdy) |
| `route` | kroki trasy — ten sam format co dotąd |
| ~~`maxWalkaMin`~~ | **usunięte** — bot bije do końca, nie odpuszcza w połowie walki |
| ~~`idleMin`~~ | **usunięte** — bot nie przeskakuje sam na innego herosa |

Dodanie herosa = skopiować blok w `HEROES` + dopisać klucz do `ORDER`. W kodzie
nic więcej nie trzeba tykać. `node _verify.js` sprawdza każdą trasę osobno
(osiągalność, przejścia, duplikaty), `_verifyConfig.js` pilnuje zworów i metod.

### Zwój po nazwie — skrypt uczy się sam

Nazwy przedmiotów **nie da się odczytać z DOM**: podpowiedź powstaje tylko przy
prawdziwym najechaniu myszką. Sprawdzone 03.10 — `dispatchEvent('mouseover')`
tworzy zero elementów w `.tip-layer`.

Dlatego zamiast wpisywać wewnętrzne numery gry (`item-tpl`), podaje się **nazwę**
przy herosie, a skrypt zapamiętuje identyfikator, gdy tylko podpowiedź
przedmiotu się pojawi:

1. wpisujesz nazwę w polu `zwój:` przy herosie
2. najeżdżasz myszką na ten zwój w grze
3. `HH.zwój()` w konsoli — skrypt zapamiętuje i już wie na zawsze

Robi się to **raz na zwój**. `HH.zwoje()` pokazuje, co bot wie. Na liście w UI
widać przy każdym herosie `zwój 22255` albo pomarańczowe `brak zwoju`.

Stary sposób (`CONFIG.SCROLLS = { przewodnik: 22255 }`) nadal działa i ma
pierwszeństwo przed tym zapamiętanym.

**Uwaga:** zwoje są przypisane do herosa — opis przedmiotu mówi wprost, że
działa tylko tam, gdzie pojawia się ten konkretny heros. Zwój jednego herosa
nie zadziała przy innym.

### Wybór herosa

Kliknięcie wiersza na liście albo `heros 2` z czatu. Przełączenie kasuje stan
bieżącej trasy (indeks kroku, znalezienie, walka) i jedzie od zera po trasie
wybranego herosa. Lista pojawia się dopiero gdy jest więcej niż jeden heros.

## Znalezienie → czekanie → atak

Po znalezieniu herosa bot **nie bije od razu**. Stoi obok i czeka na drużynę,
a dopiero po `atakPoMin` minutach sam zaczyna.

| Pole | Znaczenie |
|---|---|
| `atakPoMin` | ile minut czeka na klan, zanim sam zaatakuje; `0` = nigdy nie bije |

Walka trwa do rozstrzygnięcia — limitu czasowego nie ma (patrz wyżej).

Stany: `WAIT → GO → SCAN → FOUND → FIGHT → HOME`
- `FOUND` — ping, stoi obok, odlicza do ataku (domyślnie 5 min)
- `FIGHT` — podchodzi i bije co 2 s (`Engine.interface.clickAttackNearMob`)

Rozróżnienie ucieczki od killa — gdy heros znika z listy NPC:
- znika **w trakcie walki** → kill → ping → Ithan → wylogowanie → czekanie na resp
- znika **bez walki** → uciekł, po 20 s wracamy do szukania

Wykrywanie szuka **wszystkich** herosów z `HEROES`, nie tylko bieżącego —
na trasie jednego może siedzieć drugi.

`HH.podglad()` — lista herosów z ich statystykami (znalezione/zabici).

## Komendy z czatu

Bot nasłuchuje czatu klanowego i drużyny (`.new-chat-message.chat-CLAN-message`).

| Komenda | Działanie | Status |
|---|---|---|
| `zap!` | prawy klik w nick autora wiadomości → „Zaproś do grupy" | **potwierdzone** — drużyna powstała |
| `przywo!` | zużywa zwój przypisany do herosa | **potwierdzone** — zwoj 9 → 8 |
| `oddaj d!` | klik `.give-lead-party` + potwierdzenie „Tak" | naprawione, **niepotwierdzone** |
| `bij!` | atak teraz, pomija odliczanie | napisane, nieprzetestowane |
| `czekaj!` | cofa odliczanie do ataku o `ATAK_OD_NOWA_MIN` | napisane, nieprzetestowane |
| `odwołaj 30m` | wróć do Ithanu i wyloguj na tyle minut | napisane, nieprzetestowane |
| `heros N` | przełącz na herosa o numerze N z listy w UI | **potwierdzone 03.10** — przełącza w obie strony |

**Ważne: komendy działają też przy zatrzymanym bocie.** Wczesniej `handle()`
miało `if (!BOT.running) return;` i komenda napisana przy zatrzymanym botzie
ginęła po cichu. Teraz komendy się wykonują, szukanie zostaje wstrzymane.

Bot nasłuchuje **tylko nowych** wiadomości (`MutationObserver` na `addedNodes`).
Nie przegląda tych, które już leżą w czacie — dlatego komenda napisana przed
wstrzyknięciem skryptu nie zadziała, nawet jeśli jest widać ją na ekranie.

**Pakiety drużyny znalezione w `main.min.js`:**
```
_g("party&a=inv&id=" + id)      // zaproszenie
_g(`party&a=give&id=${id}`)     // oddanie dowództwa
_g("party&a=inv_massive")       // zaproś bliskich
_g("clan&a=members")            // lista członków
```

Ścieżki do zaproszenia (sprawdzone na żywo 03.10):
- **prawy klik na nick w czacie** → menu z „Zaproś do grupy" — **to działa**
- `.author-section` to nick, `.guest-section` to oznaczenie `[Z]` (brak menu gracza)
- przycisk `.add-to-group` w oknie klanu też wysyła `party&a=inv`, ale w praktyce
  drużyna nie powstawała — nie wybrano tej drogi

**Zwój przywołania:** identyfikator to `item-tpl-22255` w klasie slotu
`.inventory-item`, nie nazwa (nazwy w DOM nie ma). Użycie przez dwuklik na slocie
i sprawdzenie czy liczba sztuk spadła. Zwoje są **przypisane do herosa** —
opis przedmiotu: „Działa tylko w wybranych lokacjach".

## Błędy znalezione i naprawione (03.10)

Wszystkie ciche — brak błędu w konsoli, brak efektu, bot po prostu nic nie robił:

1. **`followPath()` zerował licznik kliknięcia co tick** → bot nigdy nie kliknął
   bramy, stał w nieskończoność. Reset przeniesiony na zmianę kafelka.
2. **Trzy właściwości lądowały w `GAME` zamiast `CONFIG`** (`ATTACK_EVERY_MS`,
   `SCROLLS`, `ATAK_OD_NOWA_MIN`) → `CONFIG.ATTACK_EVERY_MS === undefined`,
   `now - x > undefined` zawsze `false`, **bot nigdy nie zaatakował**. Stąd
   `_verifyConfig.js`.
3. **`przywo[lł]` nie łapało `przywo!`** → komenda cicho przepadała.
4. **Ta sama wiadomość dochodziła 2×** (węzeł nadrzędny + `.new-chat-message`)
   → każda komenda 2×, dwa zwoje, cztery zaproszenia. Naprawione `WeakSet` na węzeł.
5. **Wyjątek zjadał komendę** → `handle()` rzucał prosto do `MutationObserver`,
   zero logu. Każda komenda ma teraz własny try/catch (`bezpiecznie()`).
6. **`battle` i `dead` w `Engine.lock.list` traktowane jak captcha** → bot stał
   w trakcie walki i po śmierci z komunikatem „Rozwiąż i bot ruszy dalej".
   Dodane do `STANY_GRY` (także `change_location`).
7. **`GAME.lockList()` zgłaszał brak** → dopiero po poprawkach pokazało się,
   że `Engine.party` istnieje (metody na prototypie, `Object.keys` ich nie widzi).
8. **`GAME.stopAutofight()` nie istnieje** — `BOT.wybierzHeroza()` wołał metodę,
   której w `GAME` nie ma. Wyjątek padał w połowie funkcji, **zanim** zapisało
   się nowego herosa, więc komenda `heros 2` z czatu wyglądała na zignorowaną,
   a bot spokojnie jeździł dalej po trasie starego. Walkę bot prowadzi ręcznie
   (`GAME.hit()`), więc nie ma czego zatrzymywać. Stąd kontrola metod w
   `_verifyConfig.js`.
9. **CSS panelu wstrzykiwany był tylko raz** (`if (!getElementById('hh-style'))`).
   Po zmianie stylu stary arkusz zostawał w stronie — lista herosów wyglądała
   jak goły tekst bez ramek, bez błędu w konsoli. Teraz styl jest nadpisywany
   przy każdym `UI.build()`.
10. **Kafelek „Znalez." nigdy nie był aktualizowany** — `UI.set('found')` nie
    miał w całym skrypcie ani jednego wywołania. Licznik w `STORE` rósł, widać
    go w `HH.podglad()`, a w panelu zawsze było `-`.
11. **Brak reguły CSS dla `.open`** przy zwijanym logu — klasa dochodziła do
    sekcji, ale nie było reguły, która ją obsługiwała. Log był niewidoczny
    zawsze, klik „działał", a nic się nie działo.
12. **`this` w listenerze wskazywał na przycisk, nie na `UI`** — licznik
    nieprzeczytanych wpisów trafiałby jako właściwość elementu DOM.

## Panel — wygląd (03.10)

Przebudowany z 718 px na **455 px**. Osiem wierszy „Mapa / Stan / Cel / Heros /
Budzik / Czas / Znalezienia / Kill" zastąpione trzema rzeczami:

- **TERAZ** — nazwa mapy dużo, pod nią co konkretnie robi
- **pasek postępu z licznikiem** — niebieski szukanie, pomarańczowy blokada,
  zielony znaleziony heros
- **cztery kafelki** — Czas, Znalez., Kill, Atak za

Wiersz „Heros" wypadł: nazwa była w trzech miejscach naraz (wiersz, podtytuł
nagłówka, lista wyboru). Stan to teraz pill z kolorowym tłem i pulsującą
kropką, zamiast samego kolorowego tekstu.

Kafelek **„Atak za"** robi dwie różne rzeczy zależnie od stanu:
- po znalezieniu herosa — ile sekund zostało do ataku (`4:59`, ostatnia
  minuta pomarańczowo)
- na ekranie logowania — godzina powrotu do gry

### Czas logowania jest zgadnięty, nie znany

Czas respu **nie da się odczytać z gry na ekranie logowania**. Bot czyta
okno „Minutnik" (`GAME.eliteTimers()`) **przed** wylogowaniem, liczy średnią
z ostatnich 10 prób i zapisuje `nextRespawnAt` w `GM_setValue`. Magazyn
przeżywa wylogowanie, więc na ekranie logowania ta godzina już jest — nie
jest odczytywana, tylko przypomniana.

Problem: „Minutnik" wypełnia się **dopiero po ubiciu** herosa, a nikt jeszcze
nie zabił. Więc `timers` jest puste i skrypt zakłada `CONFIG.RESPAWN_MIN = 120`
— czysta założenie. Dlatego wartość oznaczona flagą `respawnZgloszony`
i pokazywana na pomarańczowo z dopiskiem „szacunek", żeby nie udawała pewnika.

## DevLog — osobno, poza panelem

Wewnętrzny log skryptu to szum (co tick coś się zmienia), więc **wyrzucony
z panelu**. Teraz:

- **powiadomienie** — pasek na dole ekranu **po lewej** (panel jest po prawej).
  Pojawia się **tylko** przy `warn`, `error` i `cmd` — czyli ostrzeżenie,
  błąd albo komenda z czatu. Pokazuje treść ostatniego takiego wpisu
  i licznik. Zwykłe `info` i `ok` go nie odpalają.
- **okienko `DEVLOG`** — osobne okno, domyślnie zamknięte. Otwiera się
  kliknięciem w pasek, `Alt+L` albo `HH.log()`. Ma przycisk `×`, oba elementy
  można przeciągać. Przy otwartym oknie pasek się nie pojawia.

Budowane raz w `UI.logWindow()`, **przed** `UI.build()` — panel kasuje się przy
każdym przebudowaniu, log musi mieszkać obok.

Od stopki panelu zniknęło `Alt+L` (nie ma już przycisku, do którego by się
odwoływał). Skrót nadal działa.

### Fałszywy alarm, który wyglądał jak błąd

Na zrzucie widać było `zap!` i `oddaj d!` z czatu grupowego z 00:27, na które
bot nie zareagował. **To nie był błąd.** `CHAT.watch()` reaguje wyłącznie na
**nowo dodane** węzły DOM (`MutationObserver` na `addedNodes`) i nigdy nie
przegląda wiadomości, które już leżą w czacie. Komendy przyszły 19 minut przed
wstrzyknięciem skryptu. Bot po prostu jeszcze nie nasłuchiwał.

Ta sama zasada przy testowaniu: żeby sprawdzić komendę, trzeba ją wysłać
**po wstrzyknięciu** skryptu. Dorzucanie węzłów do DOM testuje tylko wyjątkiem
przez `CHAT.handleOnce()`, ale węzeł musi mieć klasę `chat-CLAN-message`
albo `chat-GROUP-message` — `chat-LOCAL-message` (twoje własne wiadomości)
jest ignorowany.

## Zablokowania gry

`Engine.lock.list` mówi, co trzyma postać. Typowo `['captcha']` — to **gra
wymaga rozwiązania przez człowieka**. Bot wtedy:
- loguje ostrzeżenie **raz na blokadę** (nie co minutę)
- pinguje Discord raz
- wstrzymuje się w stanie `WAIT` zamiast cicho przekraczać timeout na każdym respie

Filtr `STANY_GRY` (`dead`, `battle`, `change_location`) — to normalne stany
rozgrywki, nie blokady. Bez niego bot wstrzymywał się na każdym przejściu bramą.

## Światy

Graf bram (`CONFIG.GATEWAYS`) zebrany na **`gefion`**. Na `experimental` i `gordion`
bot nie ma dokąd iść — przeskakuje kroki trasy i niczego nie obchodzi.
Rozwiązanie na przyszłość: osobny graf na każdy świat (albo zbieranie bram
przy pierwszym wejściu na nowy świat).

## Gadanina na Discordzie — `_bridge.js`

Webhook Discorda potrafi tylko **wysyłać**. Nie da się nim podsłuchać, co
piszą ludzie na kanale. Dlatego gadanie wymaga **tokena bota**, a ten nie może
lecieć w skrypcie gry (tam ląduje w Tampermonkey i przy wklejaniu widać go
w całości). Dlatego osobny proces na twoim PC.

```
_klan Discord  ──►  _bridge.js  ──►  space-bunny-free (Zen)  ──►  _bridge.js  ──►  kanał
                   czyta co 3s          https://opencode.ai/zen/v1/chat/completions
                   token bota           model jest darmowy
```

Skrypt gry **w ogóle nie uczestniczy** w gadaniu. `_bridge.js` to wątek
zupełnie niezależny — możesz go wyłączyć i bot dalej obchodzi resp'y.

**Uruchomienie:** `node _bridge.js` (status: <http://127.0.0.1:8181/>)
**Test bez Discorda:** `node _bridge.js --test "o czym jest Margonem"`
**Sprawdzenie tokenu:** `node _bridge.js --whoami`
**Jedno przejście i koniec:** `node _bridge.js --once`

**Co trzeba zrobić w Discordzie** (jednorazowo):
1. <https://discord.com/developers/applications> → New Application
2. Zakładka **Bot** → Add Bot → **Reset Token** → skopiuj do `_bridge.config.json`
3. W tej samej zakładce: **Privileged Gateway Intents → MESSAGE CONTENT INTENT ON**
   (bez tego bot widzi wiadomości innych botów, nie twoje)
   **Uwaga 03.10:** ten intent działa nie tylko na gateway, ale też na **odpowiedzi
   REST** — `GET /channels/{id}/messages` zwraca pusty `content` bez niego.
   Wyjątki, w których treść **i tak** wraca: wiadomości wysłane przez bota, DM-y do
   bota, wiadomości ze **@wzmianką bota** i odpowiedzi na jego wiadomości.
   Dlatego w `_bridge.config.json` jest **`requireMention`** — ustaw `true`, jeśli
   przełącznik nie da się włączyć, i bot będzie gadał tylko na `@wzmianka`.
   (Przełącznika nie dało się włączyć automatem 03.10 — wewnętrzny przewijnik portalu
   jest `overflow: hidden`, a ref z snapshotu wskazuje na ukryty input 28 px poniżej
   widocznego przełącznika. Kliknięcie nie trafia w element.)
4. OAuth2 → URL Generator: scopes `bot`, permissions View Channel + Send Messages
   → otwórz link, wybierz serwer, zezwól
5. Developer Mode w User Settings → prawy klik na kanał → **Copy Channel ID**

**Klucz Zen:** <https://opencode.ai/auth>. Ten sam login, którego używasz tu.
Jeśli nie chcesz go szukać, jest w `C:\Users\numb7\.local\share\opencode\auth.json`
(do odczytu Notatnikiem).

**Zabezpieczenia, które są w kodzie:**
- start od **najnowszej** wiadomości — nie odpowiada na starą historię;
- `author.bot` pomijane → bot nie gada z samym sobą w pętli;
- `cooldownMs: 5000` + `maxPer10min: 8` → limit darmowego modelu nie zje
  ci kanału, gdy jest gwarno;
- odpowiada **tylko** gdy ktoś użyje słowa z `triggerWords` (`replyToAll: false`);
- z serii wiadomości odpowiada **raz**, na ostatnią;
- kontekst: 16 ostatnich wiadomości, własne odpowiedzi wstawiane jako `assistant`.

### PRZETESTOWANE 04.10 — cała ścieżka działa

Wszystkie cztery tryby odpalone na żywo, oba klucze działają:

| Tryb | Wynik |
|---|---|
| `--whoami` | `bot: cwel (1555717234855247943)` |
| `--test "…"` | model odpowiada po polsku, w roli postaci |
| `--once` | `ok: true`, cursor pobrany z kanału |
| `--channels` | bot jest na serwerze `jebalnia`, kanał `test` istnieje |
| ciągła praca | działa, `polls` rośnie co 3 s, `_bridge.err.log` pusty |

Stan na 8181: `{"ok": true, "model": "space-bunny-free", "throttled": 0}`.

**Trzy realne bugi, które wyszły dopiero przy teście na żywo:**

1. **`maxTokens: 300` było za małe — model jest rozumowczy.** Odpowiedź
   wyglądała na zepsutą, a to nie był prompt: część tokenów idzie na
   `reasoning_tokens`, nie na widoczny tekst. Zmierzone: **1 z 5 pytań
   dawało `finish_reason: "length"`**, a raz `reasoning_tokens = 299`
   przy zerowej widocznej treści (bot w ogóle nie odpowiadał). Raz z 5
   odpowiedź była ucięta w połowie słowa („wykonując z") i poszłaby na kanał.
   Poprawka: `maxTokens` → **900**, a przy `finish_reason: "length"`
   mostek ponawia raz z budżetem ×3 (do 4000). Po poprawce: **0/5 uciętych,
   0/5 pustych.**
2. **Bot zmyślał informacje o grze.** Na pytanie o Margonem odpowiedział
   „gra w postapokaliptycznym świecie” (nieprawda), a na inne pytanie
   **przepytał rozmówcę** („jaki jest twój ulubiony gatunek gier?”).
   Sama persona tego nie wycinała. Poprawka: stała `ZASADY` dochodzona do
   persony **zawsze**, niezależnie od tekstu z configa. Po poprawce przy
   pytaniach o questy i fabułę: „nie mam dostępu, więc nie będę zmyślać”.
3. **`slice(0, 1890)` ucinał w środku zdania** przy długiej odpowiedzi.
   Poprawka: `clampDiscord()` + `trimToSentence()` — tnijemy do ostatniego
   kanańca zdania, nigdy do bajtu.

Stan licznika po poprawkach: w `status` doszło `retries`.

**Zostaje do zrobienia przy mosteku:** `MESSAGE CONTENT INTENT` dalej
nie włączony (przełącznik w portalu nie odpowiada), więc `requireMention:
true` zostaje. Bot gada wyłącznie na `@wzmianka`.

## Zostaje do zrobienia

**Zrobione 04.10:**
- ~~Usunąć pliki eksperymentalne~~ — przeniesione do `%LOCALAPPDATA%\Temp\opencode\smietka\`
- ~~Przetestować `_bridge.js` na żywo~~ — wszystkie tryby przetestowane, patrz wyżej
- ~~Naprawić zmyślanie i urwane odpowiedzi~~ — `maxTokens`, `ZASADY`, `trimToSentence`
- ~~`podglad-heros-a` / `podglad-heros-b`~~ — usunięte 04.10

**Reszta:**
1. **`HH.zwój()` po najechaniu** na zwój każdego nowego herosa.
2. **`oddaj d!` — sprawdzić na żywo.** Ostatnia niepotwierdzona komenda.
3. **Graf przejść dla 22 map** (Złodziej, Opętany Paladyn, Piekielny Kościej) —
   patrz „BLOKADA" niżej. Bez tego `_verify.js` wypisuje `BŁĘDY: 3`.
4. **Kill i rozliczenie** — bot wykrywa, że heros zniknął, ale cały flow
   „kill → Ithan → wylogowanie → czekanie na respa" nigdy nie był przetestowany,
   bo nikt nie zabił jeszcze herosa.
5. **Godziny ciągłej pracy** — najdłużej ~35 min bez przerwy.
6. **Stopka panelu** — `Alt+L` zniknął razem z logiem z panelu. Skrót
   nadal działa, ale brak o nim informacji. Do przebudowy przy okazji.
8. **Czas respu nie da się odczytać z klienta** — tylko z okna „Minutnik", które
   wypełnia się po zabiciu. Do czasu tego skrypt zakłada `CONFIG.RESPAWN_MIN`.
9. **Klan** — postać testowa nie ma klanu, ścieżka zapraszania nie sprawdzona.
10. Rozważyć `clamp` kordów do granic mapy zamiast pomijania punktu.
11. **Brak drogi powinien być głośniejszy** — przeskakiwanie kroków po cichu
    gubi całą turę punktów respów, a komunikat jest w logu skryptu, nie w grze.
12. **Przetestować `_bridge.js` na żywo** — założony, składnia OK, ale Discord
    nigdy nie był podłączony. Kolejność testów: `--test`, potem `--whoami`,
    potem `--once`, dopiero na końcu tryb ciągły.

## Obrazek herosa w UI (03.10, wieczór)

Pole `img` w `CONFIG.HEROES` — zwykły adres do obrazka, pokazywany w dwóch
miejscach: wiersz na liście wyboru i podpis w nagłówku panelu.

```js
img: 'https://micc.garmory-cdn.cloud/obrazki/npc/her/mnich-zly2.gif',
```

Grafiki herosów leżą pod `https://micc.garmory-cdn.cloud/obrazki/npc/her/`.
Nazwa pliku = nick herosa pisany małymi literami i z myślnikami:
`mnich-zly2.gif` → Zły Przewodnik.

Zasady:
- brak `img` → kropka, nic się nie psuje
- obrazek się nie wczytał → kropka zamiast dziury (zdarzenie `error`)
- kropka dostaje **ten sam slot 30 px** co obrazek, żeby wszystkie wiersze
  na liście miały identyczną wysokość

### Co poprawiono po pierwszej wersji

- obrazek w nagłówku miał **17 px** — ciemna plamka, nie dało się rozpoznać
  postaci. Teraz 22 px, w linii z nazwą, nie osobne dziecko `.hh-head`
  (przy 310 px nie ma miejsca obok tytułu, pilla i przycisku)
- `.hh-av` bywał **pusty** — `MAPS.hero()` zwraca `null` przy starcie, więc
  zostawał sam `padding-left:2px`, czyli dziura
- wiersze miały **różne wysokości** (32 px z obrazkiem, 6 px z kropką)

### Otwarte — wygląd do dostrojenia 04.10

Dwa wątpliwe miejsca, bez odpowiedzi:

1. **Puste sloty 30 px** u herosów bez obrazka — duża dziura, w której nic
   nie ma, wygląda jak niedokończone. Można zostawić kropkę wypełniającą
   slot albo kurczyć slot do rozmiaru kropki.
2. **Kolor obrazka** — jest ciemnozielony i nie pasuje do fioletowo-szarego
   panelu. Do wyboru: przyciemnić i zostawić kolor tylko aktywnemu,
   albo zostawić w kolorze.

## Panel — finalna decyzja wyglądu (04.10)

Wszystko poniżej wyrwcone **na życzenie**, po obejrzeniu zrzutów:

| Element | Powód usunięcia |
|---|---|
| linia statusu (nazwa mapy + „krok 1/21") | gra pokazuje nazwę lokacji i położenie sama, panel tylko powtarzał |
| licznik „N wpisanych" | nic nie mówił; lista pod spodem jest widoczna |
| pusty kwadrat w miejscu braku obrazka | wyglądał jak placeholder i budził pytanie „co to jest" |
| stopka (`praca 30s` + `Alt+H Alt+L Alt+R`) | zbędne |
| pasek postępu | informacja i tak była w linii statusu |
| kafelek „Kill" | licznik zostaje w `HH.podglad()` |

**DevLog przestał otwierać się sam.** Otwierał się przy `warn` i `error`, a bot
wypisuje ostrzeżenia co kilka sekund („Brak drogi, próba N") — okno wracało
wtedy, kiedy właśnie je zamknięto. Zostaje **pasek powiadomienia** na dole
ekranu, który pokazuje treść ostatniego ostrzeżenia, więc nie trzeba otwierać
logu, żeby dowiedzieć się co się stało. Log otwiera: klik w pasek, `Alt+L`
albo `HH.log()`.

Panel: 452 px → **366 px**.

### Slot na brakujący obrazek

`display:none` psuł wyrównanie — wiersz bez ikony miał tekst przesunięty
o szerokość ikony. `visibility:hidden` rezerwuje miejsce, a nic nie pokazuje.
Wiersze mają równe 48 px.

### Wyśrodkowanie wiersza

Nazwa i „58 pkt" są wyśrodkowane w przestrzeni między ikoną a badge'em.

### Jeszcze cztery rzeczy (04.10)

1. **„58 pkt" wyrzucone z wiersza herosa** — liczba punktów respu nikogo nie
   obchodziła, a zajmowała miejsce w jedynej wartościowej informacji.
   Wiersz ma teraz tylko nazwę i statystykę znalezień. Bez statystyki druga
   linia w ogóle nie powstaje — pusta szara plamka tylko szkodziła.
2. **Znaczniki zwoju ujednolicone** — wszystkie mają ten sam kształt, kolor
   niesie znaczenie:

   | Stan | Znacznik | Kolor |
   |---|---|---|
   | n szt w eq | `9 szt` | zielony |
   | 0 szt w eq | `0 szt` | **czerwony** (kup nowy) |
   | slot niewidoczny | `? szt` | szary |
   | nie znam tpl | `brak szt` | **czerwony** |

   Wcześniej `brak zwoju` i `nie w eq` były pomarańczowe, a `było n`
   wyskakiwało spoza wzorca. Teraz wszystko wygląda tak samo.
3. **Kafelek „Czas" wyrzucony** — licznik zerował się na końcu każdej pętli
   trasy, więc pokazywał `0:00`. Czas nadal jest liczony w
   `STORE.data.huntMs`, ale zapis do magazynu jest warunkowy
   (`if (UI.cells.uptime)`) — bez wyświetlania nie zapisujemy co tick.
   Wróci cały mechanizm, jeśli kafelek wróci.
4. **Obrazek herosa bez kwadratu** — zniknęła ramka i tło pod obrazkiem,
   zostało lekkie zaokrąglenie 3 px. Ten sam zapis dla ikony w nagłówku.

Panel: 366 px → **346 px**.

### Fałszywy alarm: „panel jest przezroczysty"

Wyglądało, że przez panel przebija mapa gry. Nie — panel ma
`rgba(20,22,26,.97)`, czyli jest praktycznie nieprzezroczysty. To, co
widziałem, była mapa gry **obok** panelu (okno mapy po lewej, minimap po
prawej) przy szerokości okna 832 px.

Sprawdzone jednoznacznie: wymuszenie tła na `#ff0000` — w obrębie panelu
nie było widać niczego z gry. Wycofane.

Lekcja: dwukrotnie w tej sesji „widziałem" w zrzucie coś, czego nie było
(raz estetyczny problem z kwadratem, raz przezroczystość). Przy tym
rozmiarze okna gry zajmują cały kadr i łatwo pomylić co jest w panelu,
a co obok. **Weryfikować pomiarem, nie zrzutem.**

## Webhook z poziomu panelu (04.10)

Webhook był wpisany na sztywno w `CONFIG.WEBHOOK`, więc jego rotacja wymagała
edycji skryptu. Teraz adres siedzi w magazynie i nadpisuje config:

```
STORE.data.webhook  ->  używany
pusty               ->  wracamy do CONFIG.WEBHOOK
```

Czyli da się wrócić do wartości z pliku bez grzebania w kodzie.

**Okno ustawień** — przycisk `wh` w nagłówku panelu. Pole tekstowe,
trzy przyciski: Zapisz / Wyślij test / Wyczyść.

Walidacja `NOTIFY.poprawny()` sprawdza kształt
(`https://discord.com/api/webhooks/<id>/<token>`, dopuszczone też
`discordapp.com`, `canary.` i `ptb.`). Zły adres jest odrzucany z komunikatem
zamiast byc zapisywany — inaczej skrypt cicho przestałby pIngować.

`NOTIFY.test()` używa parametru `?wait=true`, żeby dostać odpowiedź:
- **204** — dostarczone, działa
- **404** — Discorda nie zna adresu
- **401 / 403** — token wygasł albo webhook usunięty

Bez tego nie ma jak sprawdzić, czy rotacja się powiodła, a nieudana rotacja
wygląda identycznie jak „nie znalazłem herosa".

`HH.webhook()` zwraca `{ adres, zPanelu }` — skąd aktualnie bierze się adres.

## Know how w panelu (04.10)

Przycisk `?` w nagłówku otwiera okno z siedmioma sekcjami: co robi bot, co się
dzieje po znalezieniu, co znaczą kafelki, wszystkie komendy czatu, skróty
klawiaturowe, zwój przywołania i co robić gdy bot stanie.

Powstało dlatego, że stopka z opisem skrótów została wyrzucona, a komendy
czatu i sposób działania zwojów nie były udokumentowane nigdzie w interfejsie.

## Znaczniki zwoju — dwa stania (04.10)

Wariant `? szt` (slot niewidoczny, zamknięty worek) wyrzucony — wymagał
tłumaczenia i nie mówił użytkownikowi niczego. Zostały dwa, słowami:

| Stan | Znacznik | Kolor |
|---|---|---|
| zwój jest w eq | `5 szt przywolan` | zielony |
| zwój nie ma | `brak przywolan` | czerwony |

Ostatni **znany** licznik nadal trzymany w `STORE.data.scrollStan`, więc
zamknięty worek nie kasuje informacji o tym, że zwój był.

## Pasek powiadomienia usunięty (04.10)

`.hh-trig` wyskakiwał sam, bo bot wypisuje ostrzeżenia co kilka sekund przy
szukaniu bramy („Brak drogi, próba N"). Zostaje badge stanu w nagłówku,
ping na Discord i log otwierany ręcznie (`Alt+L` / `HH.log()`).

## Błąd własny: podwójne podpięcie listenerów

`bWh` i `bHelp` miały `addEventListener` podpięte **dwa razy** — skrypt
transformujący dodał je, a potem dodałem je jeszcze ręcznie. Jedno kliknięcie
wołało `setWindow()` dwa razy: raz tworzyło okno i otwierało, raz natychmiast
toglowało. Okno otwierało się i zamykało w tej samej klatce — wyglądało jak
„nic się nie dzieje".

Nie wykrył tego walidator (sprawdza nazwy metod, nie duplikaty listenerów),
ani przeglądarka (brak błędu w konsoli). Wyłapało dopiero sprawdzenie
`classList.contains('open')` krok po kroku.

## Treść okna know how (04.10)

Nagłówki w formie pytan, **zero długich myślników** w treści (pozostały
tylko trzy w logach i jako placeholder `-` w kafelku, to nie interfejs).
Tytuł okna: „Jak to działa?" zamiast „Heros Hunter — jak to działa".

Opis komend przepisany słownie użytkownika. Najważniejsza zmiana:
`odwołaj Xmin!` i `heros x!` — **tak to jest teraz pokazane w pomocy,
więc komendy muszą przyjmować wykrzyknik**. Wcześniej nie przyjmowały
i cicho przepadały.

### Błąd, który przy okazji wyszedł

`odwołaj 30m!` trafiał do `CHAT.minutes('30m!')`, który nie pasował do
żadnego wzoru i **wracał do `RESPAWN_MIN` = 120 minut**. Czyli użytkownik
prosił o 30 minut, a bot wyłączał się na dwie godziny — bez żadnego
ostrzeżenia, bo brak ostrzeżenia był jedyną reakcją na niepoprawny argument.

Naprawione: `minutes()` obcina wszystko poza cyframi i jednostką `m`/`h`,
a regex `odwołaj` łapie argument bez wykrzyknika.

Zweryfikowane po napisaniu:

| Wejście | Wynik |
|---|---|
| `heros 2` / `heros 2!` / `heros 2.` | numer 2 |
| `odwołaj 30m` / `odwołaj 30m!` | 30 min |
| `odwołaj 2h!` | 120 min |
| `odwolaj 90m!` (bez ł) | 90 min |

## Instrukcja webhooka w oknie ustawień (04.10)

Lista numerowana, dokładnie w kolejności podanej przez użytkownika:

1. Nowy lub już istniejący kanał na discord
2. Edytuj kanał
3. Integracje
4. Webhooki
5. Stwórz webhook
6. Uzupełnij według preferencji
7. Skopiuj url webhooka
8. Wklej powyżej i zapisz
9. Wyślij test

Zamknięcie: „Jeśli wyszła wiadomość testowa, wszystko działa."

Lista, nie łańcuch z `>` — w oknie 400 px łańcuch był nieczytelny.
Poprawiono literówki w oryginale (`intergracja` → `Integracje`,
`webook` → `webhook`, `weehooka` → `url webhooka`).

## Nagłówek panelu — ikony (04.10, po dwóch nieudanych próbach)

W nagłówku są trzy przyciski, wszystkie 22×22 px:

| Przycisk | Co otwiera | Jak zrobiony |
|---|---|---|
| ikona Discorda | okno ustawień (webhook) | inline SVG, `fill:#5865f2` |
| złoty `?` | okno „Jak to działa?" | zwykły tekst, `color:#d9a441`, 15px/700 |
| `–` | zwijanie panelu | tekst |

**Dlaczego Discord, a nie zębatek:** okno ustawień jest obecnie w całości
o Discordzie (tylko adres webhooka), więc ikona Discorda mówi więcej. Gdy
pojawi się tam cokolwiek innego, ikona przestanie być prawdziwa — wtedy wstawić
zębatek.

### Dwie ślepe uliczki z ikoną „?"

**Obrazek z pulpitu.** `Desktop/pytanie.webp` okazał się ozdobną ramą z
wieńcem wokół czarnego koła z „?". W przycisku 22 px rama robiła się szumem,
a „?" był nieczytelną plamką. Przycinanie pomogło (inset 10 z 96 px, canvas
z `imageSmoothingEnabled=false`, webp q0.9 = 2616 B), ale użytkownik nadal
uznał to za brzydkie.

Odrzucone po pomiarze:
- powiększenie do 22/28 px — rama nadal szumi
- przycięcie w CSS (`overflow:hidden` + ujemny margines) — ułamkowe
  przesunięcie daje nierówne skalowanie pikseli, zostają resztki ramki
- canvas do PNG — 11 497 B; do webp q1.0 — 8 184 B (enkoder wygładza
  krawędzie i obraz źle się kompresuje)

**Ostatecznie:** zwykły złoty znak zapytania, bez obrazka. Wybór wariantu
miał nastąpić **przed** implementacją, nie po — dwa razy zgadywałem
najpierw zrobiłem, potem poprawiałem.

### Ścieżka Discorda: nie skracać

Pierwsza wersja ścieżki SVG była kanoniczną ścieżką logo **ręcznie
skróconą** (usunięte spacje, obcięte liczby). Przy okazji zgubiłem wielkie
`M` przed drugim oczkiem — zostało `m7.97`, czyli *relative moveto*. Drugie
oko rysowało się od względnego punktu zamiast od nowego, więc zamiast oka
wychodziła śmieć. Użytkownik zauważył: „nie ma jednego oka".

Poprawione: kanoniczna ścieżka, nieskompresowana, 1261 znaków.
Walidacja po podmianie: `sciezka.split('z').filter(s => s.startsWith('M')).length === 2`.

**Wniosek: ścieżek SVG nie skracać.** Skracanie „na oko" jest tanie tylko
wtedy, gdy wynik sprawdzisz — a wynik jest obrazkiem, którego nie da się
porównać tekstem.

## Serwer testowy podaje tylko jeden plik

`_srv.js` ignoruje `req.url` i zawsze zwraca `_inject.js`, dla każdej
ścieżki i każdego rozszerzenia. Sprawdzone: `/_podglad.html`,
`/_ikona_test.js`, `/_pytanie.webp` — wszystkie zwracały 161 186 B treści
`_inject.js` z `content-type: application/javascript`.

Wniosek: **nie da się przez ten serwer pobrać innego pliku.** Do przeniesienia
danych z przeglądarki na dysk trzeba osobnego odbiorcy (użyto jednorazowo
portu 8138) albo wklejenia kodu inline do `browser.evaluate`.

## Dwa razy zniszczyłem plik przez skrypty (04.10)

Oba przypadki miały tę samą przyczynę: **pętla szukająca końca zakresu bez
górnego ograniczenia**, wywołana gdy kotwica w pliku nie istniała.

1. `_rm.js` — szukał `]));` jako końca sekcji, trafił na dalej w pliku:
   **usunięte 1678 linii**, wraz z nagłówkiem metadanych. Odtworzone
   z `_inject.js` + nagłówek z `BAK2`. Nagłówek `@version` i `@description`
   **zostały napisane od nowa**, nie odzyskane — w katalogu nie ma kopii
   dzisiejszego nagłówka.
2. `_fix_bhelp.js` — szukał `head.appendChild(bWh);`, której nie było:
   **usunięte 2250 linii**, składnia przestała się zgadzać. Odtworzone
   z `_inject.js`.

Wniosek, który stosuję od tego miejsca: **każde `indexOf` sprawdzane pod
kodem, zanim użyję wyniku**, a po każdym skrypcie — porównanie liczby linii
przed i po. Kopie robocze: `heros-hunter.robocza.kopia.user.js`.

## Refaktor UI - 3 rundy, wgrane 03.10 (17:17)

`heros-hunter.user.js`: 3808 -> 4654 linii. Kopia przed refaktorem:
`heros-hunter.przed-refaktorem.user.js`.

### Co wchodzi w skrypcie (sprawdzone pomiarami, nie na oko)

| | przed | po |
|---|---|---|
| nagłówek panelu / okien | 56 / 41 px | 44 / 44 px (`--hh-h`) |
| wysokości wierszy listy | 91 / 38 / 38 px | 50 / 50 / 50 |
| obrazek herosa | 32 px | 40 px |
| slot bez obrazka | 32 px | 40 px |
| okno "Jak to działa?" rozwinięte | 807 px | 317 px (5 akordeonow, wszystkie domknięte) |
| okno Ustawień | 233 px | 209 px |
| Start / Stop widoczne | przy 6 herosach wypadały poza ekran | stopka poza obszarem przewijania |
| token `--hh-fg-4` | 4.08:1 na tle hoveru | usunięty, jeden `--hh-fg-3` 4.78:1 |
| akcent | `#e9ebee` (= kolor tekstu) | `#5b8fd6`, 5.47:1 |
| Start zgaszony bez powodu | tak | `powodStartu()` + podpowiedź na przycisku |
| okna nakładające się | tak (391 px) | jedno otwarte naraz |
| pozycja okien | gubiła się przy każdym build() | w `STORE.data.uiPos` |
| focus po otwarciu okna | na `×` | w polu / na nagłówku sekcji |
| focus trap | brak | `zlapFokus()` |
| klawiatura na liście herosów | `tabIndex: -1`, brak roli | `radiogroup` + `radio` + roving tabindex |
| wyciek listenerów | 2 na `document` × każde okno × każdy build | 0 na `document` poza jednym keydown |

### Błędy znalezione i naprawione po drodze

1. **`this.btnGo` / `this.btnStop` zgubione w `build()`** - przyciski nigdy nie
   były wyłączane. `state()` ma `if (this.btnGo)`, więc cicho nic nie robiło.
2. **`aria-expanded` gasło po `UI.build()`** - okno zostaje otwarte, przycisk
   od nowa z `false`. Pierwsza naprawa nie działała: blok był przy tworzeniu
   przyciskow, a `head` jest jeszcze nie dzieckiem `box`, wiec
   `box.querySelector` zwracalo `null`.
3. **Selektor fokusu jako lista z przecinkiem** - `querySelector` zwraca
   pierwsze trafienie w kolejności DOKUMENTU, a `×` jest w nagłówku, czyli
   przed treścią. Wygrywał z polem.
4. **Przeciąganie startowało na każdym `pointerdown`** - jedno zdarzenie
   wygenerowane przez grę przesunęło panel i zapisało pozycję na stałe
   (`uiPos.panel = 465/373`). Dodany próg 3 px + zapis tylko po realnym ruchu.
5. **`.hh-note` nie dostawała stylu** - `.hh-helpwin p` (0,1,1) bije
   `.hh-note` (0,1,0).
6. **Niezamknieta klamra CSS** - parser połknal 80 z 130 reguł, zero błędów
   w konsoli. Do patchu wchodzi kontrola bilansu klamer, bo `node --check`
   tego nie widzi.

## Transport do Discorda - dwa mylne diagnozy

**Obie wyszły ode mnie, nie z kodu.** Zapisuję, bo powtarzały się.

### 1. CORS - zła diagnoza

`fetch('https://example.com/')` zwraca "Failed to fetch". Wyciągnąłem z tego
wniosek, że Discorda też blokuje, i przeniosłem transport na
`GM_xmlhttpRequest` + `@connect`.

Nieprawda. `example.com` po prostu nie wysyła `Access-Control-Allow-Origin`.
Zmierzone potem:

```
fetch GET  /webhooks/<zyjowy>/<token>   -> 200 + JSON kanalu   CORS DZIALA
fetch POST /webhooks/<zyjowy>/<token>   -> 200 (wait=true)
fetch      /webhooks/0/nieistniejacy     -> 404 + {"code":10015}
```

`GM_xmlhttpRequest` to warstwa, ktora pozniej zglaszala "blad sieci".
Wrocilem do `fetch`. **Nie ma zadnych nowych grantow ani `@connect`** -
naglowek skryptu nietkniety.

### 2. "Blad sieci" z mojego kodu - prawdziwy bug, stary jak skrypt

Komunikat "Niepowodzenie: blad sieci" pochodzi z `onerror` w
`GM_xmlhttpRequest`. Powod zlapania wersji u uzytkownika:
stary kod mowi **"Nie zapisuj, najpierw popraw adres"**, nowy mowi
**"Nie zapisuj, popraw adres"** - brak slowa "najpierw".

### 3. Test zawsze klamal - od pierwszego dnia

```js
fetch(adres + '?wait=true', {method:'POST'})
  .then(function (r) { return { ok: r.status === 204, status: r.status }; })
```

`wait=true` sprawia, ze Discord zwraca **200** z JSON-em utworzonej
wiadomosci, a nie **204**. Wiadomosc dochodzila, warunek nie zachodzil,
panel pokazywal blad. Uzytkownik widzial komunikat na Discordzie i
jednoczesnie "Niepowodzenie" w grze.

Poprawione: `ok: (r.status === 204 || r.status === 200)`, bez parametru.
Sprawdzone odtworzeniem statusow (fetch podmieniony dla discord.com,
zero requestow na prawdziwy kanal):

| status | komunikat |
|---|---|
| 200 (`wait=true`, prawdziwy przypadek) | Dostarczone. Webhook działa. |
| 204 (bez wait, `send()`) | Dostarczone. Webhook działa. |
| 400 / 401 / 404 / 429 | osobne, konkretne komunikaty |

### 4. Cichy `.catch` ukrywal martwe adresy

`send()` konczyl sie `.catch(function () {})`. A `404` w ogole nie jest
wyjatkiem - `fetch` zwraca normalnie, odpowiedz leci do zmiennej, ktorej
nikt nie czyta. Martwy webhook wygladal jak "nic nie dziala".

Teraz kazdy nieudany ping trafia do DevLogu z powodem, bez adresu (URL
z tokenem w logu to wyciek sekretu na ekran - screen share, zrzut).

## Martwy webhook w CONFIG

`CONFIG.WEBHOOK` mial adres zwracajacy `404 {"code":10015}`. Skrypt wracal
do niego, gdy pole w panelu bylo puste - czyli cicha pulapka.
Ustawione na `''`, z komentarzem. Przy braku adresu skrypt pisze w DevLogu
jednoznacznie zamiast milczec.

## Proces - czego sie uczylem na bledach

1. **Nie stawiac diagnozy na jednym poslaku.** `example.com` wygladalo
   jak dowod na CORS. Posadzilem wylacznie ten host.
2. **Nie zmieniac transportu na podstawie domyslu.** Najpierw zmierzyc
   odpowiedz zwrotna.
3. **`querySelector` z lista z przecinkiem to nie priorytet, tylko
   kolejność w dokumencie.**
4. **Proba na zlym adresie jest bezpieczna, proba na dobrym nie.**
   `POST` do webhooka, ktory zwraca 404, niczego nie tworzy. Uzywalem tego
   zamiast pisac na prawdziwy kanal uzytkownika.
5. **`node --check` nie widzi CSS-a.** Klamry w tablicy stringow trzeba
   liczyc osobno - bez tego 80 regul zniklo po cichu.

## Bezpieczenstwo webhooka

Oba adresy (wklejony w rozmowie i zaszyty w `CONFIG`) byly ujawnione.
Powinny zostac zrotowane. **Nie zapisuj ich w skrypcie** - adres wpisuje
uzytkownik w panelu, a w pliku zostaje pusty string z komentarzem.

## Narzedzia

- `_refaktor-ui.patch.js` - 6 blokow, asercje na kazdej kotwicy, kopia
  przed zapisem, kontrola klamer CSS
- `_verifyConfig.js` - config + metody obiektow
- `_verifyCzat.js` - dopasowanie komend czatu
- `_verify.js` - osiagalnosc map, przejscia, duplikaty respow
- `_verify_walidator_test.js` - testuje sam walidator
- `kopia przed refaktorem`: `heros-hunter.przed-refaktorem.user.js`

## Środowisko
Konto testowe: `Astralny Kruk`, mag 64lvl, świat **gefion**.
Tryb eksperymentalny: skrypt wstrzykiwany z `http://127.0.0.1:8137/_inject.js`
(shim `GM_*`, obejście sprawdzenia zwoju, wyciszony webhook).
## ROZPOZNAWANIE ZWOJOW - rozwiazane 04.10

Problem: skrypt musial znac `item-tpl` zwoju dla kazdego herosa, a to
numer wewnetrzny gry. Bez niego panel pokazywal "brak przywo" nawet przy
6 sztukach w worku, a `przywo!` nie dzialalo. Wersja dla "dowolnej osoby"
byla zepsuta od startu, bo wymagala pracy czloweka (najechac myszka,
wpisac `HH.zwój()` w konsoli).

### Co bylo zle w moim rozumowaniu

Przez dwa dni pisalem w komentarzach, ze "nazwy przedmiotow nie da sie
odczytac programowo, bo podpowiedz powstaje tylko przy prawdziwym
najechaniu myszka". **To prawda tylko dla PODPOWIEDZI.** Kompletne
podpowiedzi leza rowniez w pamieci gry.

### Zrodlo odpowiedzi

```
window.TIPS.allTips[ tip-id ] = HTML podpowiedzi, w niej .item-name
```

Kazdy slot ekwipunku ma atrybut `tip-id`, a `item-tpl` w klasie. Wystarczy
zlaczyc te dwie informacje - zero najechania myszka, zero zapytan
do serwera. Odczytane 04.10 na `experimental`, 92 sloty:

| tip-id | item-tpl | nazwa z `.item-name` | szt |
|--------|----------|---------------------|-----|
| 456 | 22603 | Kupon na zwój przywołania drużyny | 2 |
| 457 | 22255 | Zwój przywołania drużyny na herosa Zły Przewodnik | 6 |
| 458 | 22257 | Zwój przywołania drużyny na herosa Opętany Paladyn | 6 |
| 459 | 22256 | Zwój przywołania drużyny na herosa Piekielny Kościej | 9 |

Kupon 22603 zawiera w nazwie "zwój przywołania" ale **nie pasuje** do
zadnego herosa - `plain()` + test zawierania w obie strony odrzuca go
poprawnie. Gdyby warunek byl tylko `indexOf('zwój') >= 0`, kupon
przeszedlby jako zwój.

### Co jest w skrypcie

- `GAME.nazwaZTipId(tipId)` - nazwa z `TIPS.allTips`, z cache
- `GAME.skanujZwoje()` - skan slotow, zwraca `{znalezione, widzianych}`
- `GAME.odswiezZwoje(silne)` - zapis do `STORE.data.scrolls`, log i Discord
  tylko przy **zmianie**
- `GAME.startZwoje()` - pierwszy skan + interwał **20 s**, własny (nie
  `BOT.timer`), bo ma działać przy zatrzymanym bocie
- `UI.znacznikZwoju(cfg)` / `UI.odswiezZnacznikiZwojow()` - chipy bez
  przebudowy panelu
- `HH.skanujZwoje()` - jednorazowy skan z konsoli

### Chip zwoju ma teraz TRZY stany

Wczesniej "nie znam numeru" i "nie masz zwoju" dawaly ten sam czerwony
"brak" - dwa rozne problemy o dwoch roznych rozwiazaniach.

| stan | klasa | kiedy |
|------|-------|-------|
| `6 szt` | `ok` | slot widoczny, liczba > 0 |
| `nie wiem` | `niepewne` | brak item-tpl - skrypt jeszcze nie rozpoznal |
| `4 szt` | `niepewne` | slotu nie widac (zamknity worek), ostatnio bylo 4 |
| `brak` | `brak` | slot widoczny, liczba 0 |

Klasa `.niepewne` istniała w CSS od poczatku refaktoru i nic jej nie
uzywało - dopasowanie stanów do istniejacego CSS-a.

### Ograniczenie, ktorego nie da sie obejsc

Zwój w **zamknietym worku** nie ma slota w DOM, wiec nie jest widoczny
dopoki ktos go nie otworzy. Dlatego skan jest cykliczny, a nie
jednorazowy, i `odswiezZwoje()` nigdy nie zapisuje pustki - pusty
`STORE.data.scrolls` zostalby jako "nie wiem" na wiecznosc.

### Herosi dopisani 04.10

`opetany-paladyn` i `piekielny-kosciej` z **nazwami** zwojow, bez
numerow. Numery 22257 i 22256 sa w komentarzu jako dokumentacja, ale
**nie** w `CONFIG.SCROLLS` - wpisanie numeru znosiłoby mechanizm
i przy zmianie w grze zostawiłoby zepsuta wartosc na sztywno.
`przewodnik` ma 22255 w `CONFIG.SCROLLS` jako udokumentowane awaryjne
podanie.

Oba nowe herosy maja `route: []` - nie znam spawnow. Pusta trasa blokuje
Start komunikatem `powodStartu()`, wiec bot nie pojdzie na slepo.
`_verify.js` celowo zglasza dla nich `BŁĄD: pusta trasa` i wychodzi
z kodem 1. To prawda, nie false positive - nie tlumilem tego.

### Ślepe uliczki po drodze

- `dictionary_pl.js` zawiera slowo "Zwój", ale ma tylko 126 kluczy i zero
  zwojow - to slownik UI, nie baza przedmiotow
- `main.min.js` jest zaciemniony (wybrane litery wymazane: `isSet$4` ->
  `i et$4`, `placeholder` -> `pla y eld`) - czytanie zrodel odpada
- `Engine.items` / `Engine.tpls` to **moduly z metodami**, nie magazyny
  danych. `Engine.bags` to `[42, 24, 12191620]`. Nie ma metody zwracajacej
  zawartosc wszystkich workow - metoda DOM + `TIPS.allTips` wygrywa
- `TIPS.allTips[0]` = `"Energia"`, a `TIPS.allTips[457..459]` to kompletne
  HTML-e podpowiedzi. Tablica jest mieszana: 173 wpisy UI + HTML-e przedmiotow

## Proces - czego sie uczylem na bledach (dodatek 04.10)

6. **Szukaj danych w pamieci gry, nie tylko w DOM.** Pomyslalem o
   najechaniu myszka i endpointach API, zanim sprawdzilem, co gra trzyma
   na `window`. Odpowiedź byla ostatnia rzecz, ktora sprawdzilem.
7. **"Nie da sie programowo" to twierdzenie do zweryfikowania, nie fakt.**
   Dwa dni pisałem ten sam komentarz w trzech miejscach bez jednego
   sprawdzenia alternatywy.
8. **Komentarz w kodzie to dokumentacja.** Zostawiony w trzech miejscach
   stanowi trzy okazje do powtorzenia bledu przy czytaniu.

### Wynik pomiaru na zywo (04.10, experimental, 92 sloty w eq)

Po wgraniu skryptu i zwyklym wejsciu do gry - **bez zadnej interwencji
czlowieka**:

```
HH.probe().store.scrolls = {
  "przewodnik":       22255,
  "opetany-paladyn":  22257,
  "piekielny-kosciej": 22256
}
```

Chipy na liscie: `6 szt / ok`, `6 szt / ok`, `9 szt / ok`. Wszystkie trzy
numery znalezione same, `przewodnik` zgadza sie z `CONFIG.SCROLLS`.
0 bledow w konsoli.

### Lista herosow - stan na 04.10

`podglad-heros-a` i `podglad-heros-b` **usuniete** (byly tymczasowe, zmyolone
nazwy zwojow, wiec wisialy jako `nie wiem` do konca swiata).
`ORDER` = `['przewodnik', 'opetany-paladyn', 'piekielny-kosciej']`.

Obrazy herosow - zweryfikowane `200 image/gif` (04.10):
- `obrazki/npc/her/opetanypaladyn02.gif`
- `obrazki/npc/her/piekielny_kosciej.gif`

### BLOKADA: trasy opka i kostka wymagaja nowego grafu przejsc

Spawny sa znane (margoworld.pl, zdjecie w komentarzu przy kazdym herosie):

- **Opętany Paladyn** - 12 map: 1387, 1730, 180, 6608, 6609, 6610, 6611,
  6612, 6616, 6624, 6625, 6626 (Andarum Ilami + Skaty Mroznych Spiewow)
- **Piekielny Kościej** - 10 map: 6628, 6629, 6634, 6635, 6636, 6771,
  6772, 6773, 6775, 6776 (Margoria + Zdradzieckie Przejscie)

**Zadna z tych 22 map nie jest w `CONFIG.GATEWAYS`.** Graf ma 18 map i
pokrywa wylacznie okolice Zlego Przewodnika. Samo wklejenie spawnow dalo by
trase, ktora wyglada poprawnie i nie dziala - bot nie ma jak dojechac.
`route` zostaje `[]`, Start blokuje sie komunikatem.

Do zrobienia, w kolejnosci:
1. Sprawdzic w grze przejscia Ithan -> Andarum Ilami i Ithan -> Margoria
   (na razie wiadomo tylko ze istnieja, nie jakie sa kafelki wyjscia)
2. Wpisac te obszary do `CONFIG.GATEWAYS` i `CONFIG.NAMES`
3. `_verify.js` musi pokazac `wszystkie mapy osiagalne z Ithan i z powrotem: OK`
4. Dopiero wtedy przepisac spawny z komentarza do `route`

Tego nie da sie zrobic zza mocy komputera - potrzebne jest przejscie
przez te mapy i zapis kafli wyjscia. Ale `strona z zagadka` na
experimental padla przy trzech kolejnych probach wejscia.

## HEROS ZLODZIEJ - dodany 04.10, na zadanie: nr 1

`ORDER = ['zlodziej', 'przewodnik', 'opetany-paladyn', 'piekielny-kosciej']`

Kolejnosc na liscie bierze sie **z `ORDER`, nie z kolejnosci obiektow
w `HEROES`** - `heroList()` najpierw przepuszcza `ORDER`, a dopiero
potem dopisuje wszystko inne. Obiekt wstawiony wiec takze na poczatku
`HEROES`, zeby czytajacy plik od gory widzial ta sama kolejnosc.
Komenda `heros N` liczy pozycje w `heroList()`, wiec tez z ORDER.

Zwój: `Zwój przywolania druzyny na herosa Złodziej` (nazwa, nie numer).
Obrazek `obrazki/npc/her/zlodziej.gif` - sprawdzony `200 image/gif`.

**Skrypt znalazl ten zwój sam, przy pierwszym zwykle wejsciu do gry:**

```
HH.probe().store.scrolls = {
  "zlodziej": 22254, "przewodnik": 22255,
  "opetany-paladyn": 22257, "piekielny-kosciej": 22256
}
```

Czyli uzytkownik ma ten zwój w worku - nie trzeba bylo nic wpisywac.

### Złodziej jest BLOKADĄ wieksza niz tamte dwa

24 mapy spawnow (margoworld.pl/npc/view/40601). Zmierzone BFS-em od
Ithan - **wszystkie 24 poza `CONFIG.GATEWAYS`**. To caly rejon Edera
wraz z wnetrzami domow, Fort Eder, Stary Kupiecki Trakt, Stukot
Widmowych Kol, Wertepy Rzezimieszkow, Chata szabrownikow.

### Mój bled w tej rundzie - wart zapamietac

Najpierw policzylem zawartosc grafu tak:

```js
new Set(blok.match(/\d{2,5}\b/g))   // -> "70 map, Eder 33 i Siedziba 43 sa"
```

**To byl fałszywy wynik.** Regex na calym obiekcie `GATEWAYS` lapie
takze wspolrzedne przejsc i numery wersji, bo `GATEWAYS` jest zapisany
na wiele linii. Poprawna liczba to **18 map**, a 33 i 43 sa poza grafem.
Wpisalem ten bledny wniosek do komentarza w kodzie, a potem go
poprawilem - ale gdybym nie zwalidowal go BFS-em (`_verify.js` ma juz
ten algorytm), zostalbym z mylnym stwierdzeniem w CONFIG.

Lekcja: **licznik na regexie to hipoteza, BFS to pomiar.** Validator
projektu ma juz poprawny algorytm osiagnieci - nalezy go uzywac
zamiast pisać wlasny regex.

### Znaleziona na boku rzecz (NIE naprawione, do decyzji)

`BOT.start()` **nie sprawdza `powodStartu()`**. Zablokowany jest tylko
przycisk Start (`btnGo.disabled = !!powod`). Dlatego `HH.start()` wpisane
w konsoli startuje bota **z pustym `route`** - czyli z robota, ktory nie
ma gdzie isc. W tym konkretnym przypadku nie szkodzil (tick nie ma
krokow, bot stoi, brak bledow w konsoli, uzytkownik go zatrzymal),
ale to jedyna droga omijajaca blokade.

Do rozwazenia: przeniesc sprawdzenie z `UI.state()` do `BOT.start()`,
zeby dalo sie zablokowac w jednym miejscu, a nie tylko w UI.

### Blad gry, nie skryptu

W konsoli 10x `Uncaught TypeError: $.isNumeric is not a function`,
zrodlo `TipsParser.js?v=9ba6b5fe1722a:2834`. To plik gry - `$.isNumeric`
zostalo usuniete w jQuery 3.3+, a gra ma stara wersje. **0 bledow
ze skryptu.**

## GRAFIKA OPE - object-fit cover -> contain (04.10)

Zgloszenie: "jakby mu nogi ucinało". Zmierzone:

| plik | naturalny | proporcje |
|------|-----------|-----------|
| `mnich-zly2.gif` | 48x48 | 1,00 |
| `zlodziej.gif` | 64x64 | 1,00 |
| `piekielny_kosciej.gif` | 96x96 | 1,00 |
| `opetanypaladyn02.gif` | **96x128** | **0,75** |

Slot 40x40 + `object-fit: cover` = obraz 96x128 skaluje sie do 40x53,3
i wychodzi poza slot. `object-position: 50% 50%` obcina symetrycznie
po ~6,7 px góry i dołu. W tym pliku dolna krawedz to nogi i miecz.

**Wniosek: `cover` jest zle dla sprite'ów, bo zakłada kwadratowe
źródła, a gry nie dostarczaja kwadratowych.** Zmienione na `contain`
w dwóch miejscach: `.hh-hero-img` (40px, lista) i `.hh-av-head` (24px,
nagłówek).

`contain` nigdy nie przycina: skala = `min(40/szer, 40/wysz)`.
- trzy kwadratowe: 40x40, bez zmian
- `opetanypaladyn02.gif`: 30x40, caly widoczny
- paski po bokach niewidoczne - wszystkie sprite'y maja przezroczyste
  tlo (zmierzone: narożniki alpha 0, środek 255)

Przesuniecie `object-position` tylko by przesunelo obcięcie, zależnie
od marginesu w konkretnym sprite'ie. `contain` nie zależy od pliku.

### Moje dwie pomyłki w tej rundzie

1. **Pomiary "widoczności" byly zle.** Napisalem "40/128 px wysokości",
   co sugeruje obcięcie, ale to byl moj własny wzor - `contain` skaluje
   caly obraz do mniejszego rozmiaru, wiec naturalnych pikseli zawsze
   mieści sie mniej. Nie mialem mierzyc "ile naturalnych pikseli
   wisi", tylko "czy cos wychodzi poza slot".
2. **Zrzut elementu renderowal sie znieksztalcony** (tekst pionowo).
   Do obejrzenia posadzilem chwilowy `zoom: 3.2` na `documentElement`
   - to modyfikuje zywa strone uzytkownika. Po zdjeciu trzeba przywrocic
   (`zoom=''` + `Alt+R`, ktore przebudowuje panel). Zapamietac: nie
   stylowac strony uzytkownika na zywo, chyba ze zdaze to cofnac.

## GRAFIKA: obcinanie do tresci sprite'a (04.10, druga runda)

Dwa zgloszenia: "opek jest nadal za maly" + "przewodnik przesuniety do
prawej". Po poprzedniej rundzie (`cover` -> `contain`) oba zostaly.

### Pomiar marginesow WEWNATRZ plikow

| plik | plik | lewy | prawy | gorny | dolny | tresc |
|------|------|------|-------|-------|-------|-------|
| zlodziej.gif | 64x64 | **11** | 6 | 2 | 2 | 47x60 |
| mnich-zly2.gif | 48x48 | **16** | 3 | 0 | 4 | 29x44 |
| opetanypaladyn02.gif | 96x128 | **1** | 4 | **18** | 1 | 91x109 |
| piekielny_kosciej.gif | 96x96 | **1** | 12 | 2 | 0 | 83x94 |

Rozrzut lewego marginesu: **15 px zrodlowych**. Tyle bylo widac
przesuniecia. Zly Przewodnik mial 16 px pustki z lewej, czyli 37% pliku.

Wysokosc samej postaci w slocie 40 px przy `contain`:

| hero | wysokosc postaci |
|------|-----------------|
| Złodziej | 37,5 px |
| Zły Przewodnik | 36,7 px |
| **Opętany Paladyn** | **34,1 px** |
| Piekielny Kościej | 39,2 px |

Opka byl najmniejszy ze wszystkich - 18 px pustki na gorze pliku
zjadlo mu wysokosc postaci. `cover` jest gorszy: obcina nogi.

### Wniosek: tego nie da sie zrobic CSS-em

Marginesow nie ma w stylach, sa w pikselach plikow. `object-fit` operuje
na calym pliku. `object-position` tylko by przesunelo obcięcie.

### Rozwiazanie

- `UI._avObwiednia(adres)` - canvas + `getImageData`, obwiednia pikseli
  o alpha > 12, zapamietana w `UI._avBox` raz na adres na strone
- `UI.avatar()` zwraca teraz **wrapper** `span.hh-hero-img` /
  `span.hh-av-head` z `position:relative;overflow:hidden`, a w srodku
  `img.hh-av-img` z `position:absolute`
- Po `load`: `skala = bok / bb.h` (dopasowanie po **wysokosci tresci**),
  `left = -bb.x * skala` (lewa krawedz tresci na x = 0),
  `top = ((bok - bb.h*skala)/2 - bb.y*skala)` (wyrownanie w pionie)
- `object-fit:contain` zostaje jako stan zapasowy: na czas ladowania
  i gdy pomiar sie nie uda (brak CORS)

### Wynik zmierzony po zmianie

```
wysokosc tresci:  40 px / 40 px / 40 px / 40 px   (wszyscy identycznie)
rozrzut lewych krawedzi: 0,01 px                 (bylo 15 px zrodlowych)
```

Dopasowanie po wysokosci, nie po szerokosci: postaci sa roznej
szerokosci (tresc 26-35 px przy wysokosci 40), rozciaganie wygladalo
by jak rozmazany plik. Zostawiaja rozne szerokosci, rowne wysokosci.

### Koszt i ryzyka

- 96x128 = 12288 pikseli na plik, raz na strone, w cache. Pomijalne.
- `getImageData` rzuca `SecurityError` bez CORS - CDN margonem go
  udostepnia (pomiar zadzialal), ale zabezpieczenie jest i wylapie
  blad, a wynik zapamietuje jako `null`, zeby nie probowac ponownie.
- `overflow:hidden` na slocie obcina przezroczyste marginesy, nie tresc:
  sprawdzone, szerokosc tresci 26-35 px miesci sie w 40 px.

### Znaki wyrazne (nie moje)

W trakcie testow bot sam znalazl i zabil dwa herosa:
- Piekielny Kosciej (85w) na Margorii
- Zly Przewodnik (63w) na Zapomnianym Szlaku
Panel: `FOUND`, `ZNALEZIONYCH 2`. Dzialaja komendy z czatu.

## imgBox - slot per heros (04.10)

Zgloszenie po wyrównaniu: opek wyrównany, ale nie wyróżniony - mial
tyle samo co inni. Najpierw 48 px, potem 50 px ("daj opka na 50").

Nowe pole w `CONFIG.HEROES`: `imgBox` - rozmiar slotu w px.
Dziala **tylko na liscie**. Naglowek zostaje 24 px, bo jego wysokosc
jest sprzezona z paskiem tytulu (44 px) i nie moze urosnac.

```js
const bok = (klasa === 'hh-hero-img' && Number(cfg.imgBox) > 0)
  ? Number(cfg.imgBox)
  : (this._avRozmiar[klasa] || 40);
```

`.hh-hero` ma tylko `min-height:40px`, nie `height` - wiersz sam
urodnie od slotu. **Zero zmian w CSS.** Wiersz opka: 68 px zamiast 58.

Pomiar po zmianie:

| hero | slot | tresc | szer. tresci | lewa krawedz | przyciete |
|------|------|-------|--------------|--------------|-----------|
| Złodziej | 40x40 | 40px | 32,0 px | 0,01 px | nie |
| Zły Przewodnik | 40x40 | 40px | 27,8 px | 0,01 px | nie |
| **Opętany Paladyn** | **50x50** | **50px** | 42,1 px | 0,01 px | nie |
| Piekielny Kościej | 40x40 | 40px | 35,4 px | 0,00 px | nie |

Naglowek: 24x24 bez zmian. Rozrzut lewych krawedzi nadal ~0.
Nic nie jest przyciete - `overflow:hidden` obcina tylko przezroczyste
marginesy, szerokosc tresci 42,1 px miesci sie w 50 px.

Cena: wiersz opka jest o 10 px wyzszy niz pozostale (68 vs 58). Przy
dalszym powiekszaniu slot trzeba przestawic `min-height`, inaczej kolejne
wiersze zaczną rozjeżdżać się wizualnie. Na 50 px jeszcze nie przeszkadza.

### imgBox: 53 px (ostatecznie)

Trzy podbija po rzedzie: 48 -> 50 -> 53. Zostawione 53.

| hero | slot | tresc | szer. tresci | wiersz |
|------|------|-------|--------------|--------|
| Złodziej | 40x40 | 40px | 32,0 px | 58 px |
| Zły Przewodnik | 40x40 | 40px | 27,8 px | 58 px |
| **Opętany Paladyn** | **53x53** | **53px** | 44,6 px | **71 px** |
| Piekielny Kościej | 40x40 | 40px | 35,4 px | 58 px |

Naglowek 24x24 bez zmian, lewe krawedzie wyrównane (rozrzut 0),
nic nie przyciete (44,6 px tresci mieści sie w 53 px).

**Ograniczenie, którego juz nie da sie ignorowac:** wiersz opka jest
o 13 px wyzszy niz pozostale (71 vs 58). Przy 64 px+ kolejne kroki:
1. `min-height` w `.hh-hero` podnies do najwiekszego slotu, inaczej
   wiersze rozjeda sie wizualnie przy wiekszych slotach
2. albo slot wyrównac do jednego rozmiaru dla wszystkich i zrezygnowac
   z `imgBox` - wtedy wraca problem z roznymi proporcjami sprite'ow

Obie sciezki sa do poprawienia przy okazji, nie teraz.

## Kolumna obrazkow jako jedna szerokosc (04.10)

Zgloszenie po `imgBox: 53`: nazwy herosow rozjezdza sie - nazwa za
opkiem startowala 13 px dalej, bo jego slot byl szerszy (53 px vs 40 px).

**Szerokosc slotu NIE MOZE pochodzic z `imgBox`.** To dwa niezalezne
wymiary:
- **wysokosc** - per heros, z `imgBox` (to o rozroznienie postaci)
- **szerokosc** - jedna dla calej kolumny (to o wyrównanie nazw)

Rozwiazanie: zmienna CSS `--hh-av-kol` ustawiana z JS.

```css
#hh-panel .hh-hero-img{width:var(--hh-av-kol,40px);height:40px;...}
#hh-panel .hh-hero-none{width:var(--hh-av-kol,40px);...}
```

`UI._avUstawKol()` bierze najszersza **tresc** (`bb.w * skala`, bez
przezroczystych marginesow) z wszystkich zmierzonych slotow, zaokragla
**w gore** do pelnego px i ustawia zmienna. Wywolywana po kazdym pomiarze
- obrazki wczytajace sie pozniej nie zostawiaja za soba za waskiej
kolumny. Zaokraglenie w dol dalo by 0,3 px rozjazdu, czyli ten sam objaw
o mniejszej skali.

`.hh-hero-none` tez uzywa zmiennej - inaczej heros bez obrazka
przesunalby nazwe.

### Pomiar po zmianie

```
--hh-av-kol: 45px

hero                  slot      tresca   lewaTresc  przycieta
Złodziej              45x40     31,33    0,01       nie
Zły Przewodnik        45x40     26,36    0,01       nie
Opętany Paladyn       45x53     44,25    0,00       nie
Piekielny Kościej     45x40     35,32    0,00       nie

pozycja nazw: 1207 / 1207 / 1207 / 1207
rozrzut nazw: 0 px
```

Kolumna 45 px (z 44,25 px tresci opka). Slot opka to 45x53 - kwadratowy
tylko dla niego nie bylby mozliwy bez obcięcia po bokach.

### Znaki wyrazne

`imgBox` zostaje **tylko wysokoscia**. Gdyby kazdy heros mial inny
`imgBox`, wysokosci wierszy rozjeda sie (58 / 71 px). Przy 64 px+ trzeba
podniesc `min-height` w `.hh-hero`, inaczej kolejne kroki widoczne.

## "znaleziono N - X min temu" pod nazwa herosa - USUNIETE (04.10)

Zgloszenie: "po znalezieniu opka pojawilo sie na nim znaleziono 1 oraz
czas jakis jakies tam minuty. Nikt o to nie prosil."

Usuniete:
- blok budujacy `<i>` pod nazwa w `UI.build()`
- zmienne `st2` i `teraz`, ktore po tym zostaly martwe w `build()`
- regula CSS `.hh-panel .hh-hero-n>i` (4 linie), ktora nie ma juz
  zadnego elementu do ostylowania

**Zostawione celowo:**
- `STORE.data.heroStats` - `BOT.stat()` dalej zapisuje `znalezione` i
  `zabici`. Uzywa ich `HH.podglad()` do diagnostyki.
- kafelek `Znalezionych` w naglowku - wypelniany z `STORE.data.found`
  przez `UI.set('found', ...)`, calkowicie niezaleznie od usunietego
  kodu. Ten sam komunikat, ale tam, gdzie o niego proszono.

Pomiar po zmianie: `.hh-hero-n` zawiera tylko `B` (nazwa), `i` = brak,
we wszystkich czterech wierszach. 0 bledow ze skryptu.

### Uwaga o tym, czego NIE ruszalem

`heroStats.ostatnio` (czas ostatniego zdarzenia) dalej sie zapisywuje.
Nikt go teraz nie wyswietla na liscie, wiec zostal tylko do `podglad()`
i ewentualnych przyszlych diagnostyk. Nie czyscilem go, bo kasowanie
danych zgromadzonych w trakcie polowania byloby zmiana, o ktora nikt
nie prosil.

## CHIP "nie wiem" -> "brak" po skanie (04.10, poprawka na zgloszenie)

Zgloszenie: "teraz sie to nie stalo i pokazuje jakies nie wiem, zamiast
przeskanowac ekwipunek i napisac ile ma sztuk lub ze jest brak przywo."

### Co sie okazalo (pomiar na zywo, postac 105h Bandyckie Chowisko)

Skan **dziala poprawnie** - odczytal 96 slotow i sam wypisal nazwy:

```
tip435 -> tpl 37648  "Zwój zmiany wzmocnienia V"
tip438 -> tpl 25115  "Zwój Czerwonego Smoka"
tip439 -> tpl 25115  "Zwój Czerwonego Smoka"
```

To nie sa zwoje przywolania. W worku **nie ma ani jednego** "Zwój
przywolania druzyny na herosa X". Sprawdzone rowniez wprost:
`.inventory-item.item-tpl-22254/22255/22256/22257` = 0 slotow.

To inna postac niz przy wczesniejszych pomiarach (75p experimental,
gdzie te cztery zwoje byly i zostaly rozpoznane). Pamiec `GM_*` jest
ulotna - po kazdym przeladowaniu skrypt zaczyna od zera i musi
rozpoznac zwoje od nowa, na biezacej postaci.

### Prawdziwy blad: chip, nie skan

Stan "nie znam item-tpl" dawal napis **"nie wiem"** i byl bezużyteczny.
Po skanie ekwipunku kazdy wynik jest jednoznaczny: albo skrypt znalazl
zwój i zna liczbe, albo go nie ma i "przywo!" nie zadziala. Obie
odpowiedzi sprowadzaja sie do jednej: **nie ma zwoju -> brak przywo**.

Zmiana:

```js
if (!z.tpl) {
  if (GAME.zwojeSkanSieUdalo()) { klasa='brak';  krotkie='brak'; }
  else                          { klasa='niepewne'; krotkie='nie wiem'; }
}
```

`GAME._zwojeSkanOk` ustawiane na `true` w `odswiezZwoje()` przy
udanym skanie. "nie wiem" zostaje **wylacznie** wtedy, gdy skanu jeszcze
nie bylo - i wtedy to jest prawda, a nie ulga.

Pomiar po zmianie (wszystkie cztery):

| hero | napis | klasa |
|------|-------|-------|
| Złodziej | brak | brak |
| Zły Przewodnik | brak | brak |
| Opętany Paladyn | brak | brak |
| Piekielny Kościej | brak | brak |

Podpowiedz: "nie ma zwoju przywołania w ekwipunku - skan zrobiony, nie
znaleziono. 'przywo!' nie zadziała."

### Moja wina

Dodalem stan "nie wiem" specjalnie, zeby rozroznic dwa przypadki, ktore
uzytkownika nie interesuja. Opisalem to w NOTES jako "uczciwosc" - a
skutkiem byl napis, ktorego nikt nie chcial widziec, wisiaacy bez konca.
Rozroznienie jest technicznie poprawne i **praktycznie bezwartosciowe**.

## Dwa bugi zgloszone 04.10: "znalezionych resetuje sie" + "atak za nie odlicza"

### 1. "Atak za" byl ZAMROZONY - prawdziwy bug

Kafelek `atak` ma w kodzie **dwa rozne znaczenia**:
- odliczanie do ataku (`czekaj()`, stan FOUND)
- godzina powrotnego zalogowania (ekran logowania)

W pozostalych stanach - GO, SCAN, FIGHT, HOME - **nikt go nie ustawial**,
wiec zostawal na ostatniej wartosci. Uzytkownik widzial staty cyfrowe
i myslel, ze licznik nie dziala.

Naprawa: gasimy domyslnie przed `switch (this.state)`, wypelnienie
zostaje tylko tam, gdzie ma sens.

```js
if (this.state !== 'FOUND') { UI.tile('atak','idle'); UI.set('atak','-'); }
```

### 2. "Znalezionych" pokazywal "–" po odswiezeniu - prawdzizy bug

`build()` tworzylo kafelki z wpisanym na sztywno `'-'` i **nigdy nie
wczytuje ich z `STORE.data`**. `UI.set('found', ...)` wolalo sie tylko
w `found()` - czyli dopiero po NASTEPNYM znalezieniu.

Efekt: dane w magazynie byly, panel ich nie pokazywal. Wygladalo jak
reset, a to byly trzy rzeczy naraz.

Naprawa w `build()`:
```js
if (STORE.data.found) { this.set('found', String(STORE.data.found)); this.tile('found','good'); }
```

### 3. Klasa `pusty` zostawala na prawdziwej wartosci - trzeci bug w tej samej linii

`.hh-tile>b.pusty` = 12 px, szary, normalna waga. Po hydratacji liczba
była wpisana, ale dalej ostylowana jak placeholder - czyli "bledna
wartosc" zamiast licznika.

`UI.set()` przelacza teraz klase, tytul i `aria-label` razem z trescia.
Nowe `UI.cellNames` trzyma etykiety kafelkow (potrzebne do tytulu
i opisu dla czytnika ekranu).

Pomiar:

| stan komorki | wartosc | klasa | tytul | wariant |
|---|---|---|---|---|
| found = 0 | – | pusty | brak danych | idle |
| **found = 12** | **12** | **(brak)** | **Znalezionych: 12** | **good** |
| found = 0 | – | pusty | brak danych | idle |

### Co NIE jest bugiem: reset licznika w wersji testowej

`STORE.save()` -> `GM_setValue(this.KEY, ...)`, `KEY: 'HH_V3'`,
`load()` -> `GM_getValue`. Pod prawdziwym Tampermonkey przezywa reload.

W moim wstrzykiwaniu `GM_*` to shim `var mem = {}` wewnatrz strony -
ginie z przeladowaniem. Sprawdzone:

```
przed injekcja:  typeof window.__GM_MEM === 'undefined'
po injekcji:     pamiec swieza, found: 0
po reloadzie:    __GM_MEM zniklo, licznik startuje od 0
```

Czyli **w wersji testowej licznik sie resetuje z mojej winy, nie skryptu**.
Trzeba to sprawdzic na prawdziwym skrypcie Tampermonkey, nie na
`_inject.js`.

### Moje wlasne bledy w diagnostyce (ta rozmowa)

1. Napisalem "pamiec testowa przezywa reload" - **nie przezywala**. Nie
   zrobilem reloadu miedzy dwoma wywolaniami i wniosek byl zly.
2. Test hydratacji zapisal `GM_setValue(...)`, a potem zrobil `Alt+R`.
   `Alt+R` tylko przebudowuje UI - **nie czyta z magazynu**. Test byl
   bezwartosciowy i pokazal "blad", ktorego nie bylo.
3. Dopiero `HH.probe().store.found = 7` (zywy obiekt) + `HH.ui()` dalo
   wynik. Dopiero wtedy zobaczylem trzeci bug (klasa `pusty`).

## "odwolaj 3min!" nie wrocil - NADPISANIE czasu w goHome() (04.10)

Zgloszenie: "po odwołaj 3min! nie wrocil do gry".

### Przyczyna

`CHAT.KOMENDY.odwolaj` ustawial `nextRespawnAt = now + 3 min` i `setState('HOME')`.
Bot szedl do Ithan. Po dotarciu `goHome()` **przeliczal czas od nowa**:

```js
let minutes = CONFIG.RESPAWN_MIN;          // 120
if (timers.length) { ...minutes = srednia z Minutnika... }
const when = Date.now() + minutes * 60000;
STORE.set({ nextRespawnAt: when, ... });   // <-- nadpisuje 3 minuty
```

Przy Minutniku = 300 min bot czekal **piet godzin** zamiast trzech minut.
Im dalesz krotszy czas przez `odwolaj`, tym wieksza byl rozdzial.

### Naprawa

Nowe pole `STORE.data.odwolajReczny` - znacznik czasu z komendy czatu.
`goHome()` respektuje je, jesli jeszcze nie minelo:

```js
const reczny = Number(STORE.data.odwolajReczny || 0);
if (reczny > Date.now()) {
  STORE.set({ nextRespawnAt: reczny, respawnZgloszony: true });
  LOG.ok('Wracam do gry o ' + ... + ' (twoje "odwolaj N min", nie Minutnik).');
  this.newRun(); this.setState('WAIT'); GAME.logout();
  return;
}
STORE.set({ odwolajReczny: 0 });   // czas minal albo komendy nie bylo
```

### Test logiki (Node, nie pomiar na zywo)

| scenariusz | stary kod | nowy kod |
|------------|-----------|----------|
| `odwolaj 3min!`, Minutnik 300 min | **300 min** | **3 min** |
| 3 minuty minely | 304 min | 304 min (wraca do Minutnika) |
| bez komendy | 300 min | 300 min (bez zmian) |

**NIE zmierzone na zywo** - postac nie jest zalogowana, a czekanie
3 minuty realnego czasu to wiecej niz rozmowa. Test na zywo bylby
jedynie powtorzeniem logiki, wiec napisalem ja osobno. Do potwierdzenia
przy nastepnym uzyciu komendy.

### Blad diagnostyczny

Najpierw napisalem, ze strona sie "przelaadowala" - nie. Postac po
prostu wrocila na ekran logowania (`loggedIn: false`), a skrypt wciaz
był wczytany. To samo zdarzylo sie wczesniej z botem w stanie `HOME`:
pamietalem `HH: Bot juz jedzie.` jako martwy bot, a postac po prostu
leżala - `dead: true`. **Zanim diagnozuje "nie dziala", sprawdz
`dead`, `loggedIn` i `idle`.**

## "po przeladowaniu bot znika" (04.10)

Zgloszenie: "po przeladowaniu strony bot znika i trzeba go znów
wywolywac w jakis posob".

### Dwie rozne rzeczy pod jednym haslem

**1. Skrypt wczytuje sie sam - pod prawdziwym Tampermonkey.**
Naglowek jest poprawny:
```
@match https://*.margonem.pl/*
@run-at document-idle
@grant GM_setValue / GM_getValue
```
Przy kazdym wejsciu na margonem skrypt odpala sie bezposrednio. To, co
widzialem w grze, to **moje reczne wstrzykiwanie** `_inject.js` przez
`browser.evaluate` - czyli czynnosc testowa, ktora w instalacji
uzytkownika nie istnieje.

**2. Ale po odswiezeniu bot NAPRAWDĘ nie wznawial - to byl bug.**

```js
BOT.state = STORE.data.state || 'STOPPED';   // wczesniej
```

Odtwarzalo **etykiete** stanu, nie petle. Po refreshu:
- badge pokazywal `GO`
- `BOT.running === false`, `BOT.timer === null`
- Start zablokowany napisem "Bot juz jedzie."
- postac stoi

Czyli bot wygladal na dzialajacy, a nie dzialal, i nie dalo sie go
włączyc inaczej niz reczny Stop + Start. Dokladnie to, co opisal
uzytkownik jako "znika".

### Naprawa: AUTO_RESUME

```js
if (CONFIG.AUTO_RESUME && STORE.data.state && STORE.data.state !== 'STOPPED') {
  BOT.start();          // zaklada interwal 1 s, ustawia SCAN albo WAIT
} else {
  BOT.state = 'STOPPED';
}
```

`CONFIG.AUTO_RESUME: true` - po odswiezeniu bot wznawia prace, jesli
przed odswiezeniem byl na pozostawionym stanie. `false` = zawsze czeka
na klikniecie Start.

### Test logiki (Node)

| zapisany stan | stan po starcie | petla |
|---|---|---|
| GO / SCAN / FOUND / FIGHT / WAIT / HOME | WAIT (czeka na zalogowanie) | TAK |
| STOPPED | STOPPED | nie |

**NIE zmierzone na zywo i nie da sie zmierzyc w wersji testowej** -
shim `GM_*` to zwykly obiekt JS, ginie z przeladowaniem strony, wiec
nie ma czego odtworzyc. Na prawdziwym Tampermonkey `GM_setValue`
przezywa i `AUTO_RESUME` zadziala. Do potwierdzenia po instalacji.

### Moje bledy w testowaniu tego

1. Zrobilem **podwojna injekcje** jednego skryptu na strone. Kazda
   injekcja tworzy nowy IIFE z wlasnym `booted`, wiec `window.HH`
   wskazywal na druga instancje, a pierwsza zostala osklepiona -
   panel, interwaly i logiki dzialaly dwa razy. Test pokazal STOPPED
   i byl **bezwartosciowy**.
2. Probowalem "wymusic" boot przez ponowna injekcje z innym
   parametrem - to nie jest to samo co przeładowanie strony i nie
   weryfikuje niczego. Do Node i zostawić to, co nie wymaga gry.

## KRYTYCZNY BUG: czekaj() nigdy nie dochodzilo (04.10)

Zgloszenie: "znalazl herosa nie ma odliczania do ataku". Na zrzucie:
`FOUND`, `ZNALEZIONYCH 4`, `ATAK ZA –`.

### Przyczyna - dwa warunki, ktore sie wykluczaly

`tick()`:
```js
const hero = this.findHero();
if (hero) { this.found(map, hero); return; }        // powrot ZAWSZE
...
switch (this.state) {
  case 'FOUND': this.czekaj(map, now); break;        // nigdy nie osiagniete
```

`found()` na początku:
```js
found(map, hero) {
  if (this.state === 'FOUND') return;                // juz FOUND -> nic
  ... this.setState('FOUND');
}
```

Czyli przy **kazdym kolejnym tyku** (1 s), dopoki heros jest na
ekranie, `tick()` wchodzil w `found()`, ten natychmiast wychodzil i
`czekaj()` nie bylo osiagane **ani razu**.

### Co to oznaczalo w praktyce

| funkcja | stan |
|---------|------|
| odliczanie "Atak za" | nigdy nie startowalo |
| podejscie pod heroesa (`adjacentTo`) | nie wykonywane |
| `bij!` z czatu | `atakNaKomendę` nie sprawdzane |
| atak po `atakPoMin` | **bot nigdy sam nie atakowal** |
| wykrycie ucieczki vs killa | `goneSince` nie liczony |

Bot stawal obok heroesa w nieskonczonosc. To nie byl kosmetyczny brak
licznika - to byla niedzialajaca petla walki.

### Test rozgałęzienia (Node)

| heros na ekranie | stan | tick robi | `czekaj()` |
|---|---|---|---|
| tak | GO / SCAN / WAIT / HOME | `found` | nie (jednorazowo, ok) |
| **tak** | **FOUND** | **czekaj** | **TAK** |
| tak | FIGHT | `walka` | nie (ok, nie powinno) |
| nie | FOUND | `czekaj` | TAK |

W starym kodzie wiersz "heros widoczny + FOUND" dawal `found` zamiast
`czekaj` - czyli `czekaj()` **NIE wywolywane**.

### Naprawa

```js
if (hero && this.state !== 'FOUND' && this.state !== 'FIGHT') {
  this.found(map, hero);
  return;
}
```

- heros + stan szukania -> `found()` raz, potem `return`
- heros + juz FOUND      -> spadamy do `switch` -> `czekaj()`
- heros + FIGHT          -> spadamy do `walka()` (wczesniej `found()`
  odpalal sie ponownie i wysylal powiadomienie co sekunde)

### NIE zmierzone na zywo

W momencie pomiaru heros nie byl na ekranie (bot byl w GO na mapie 6609).
Test powyzej jest testem **rozgałęzienia**, nie zachowania w grze.
Potwierdzenie: bot musi trafic na heroesa i zobaczymy licznik.

Warto zaznaczyc, ze ten sam wzorzec bledu powtarza sie w calym projekcie:
`if (x) { fn(); return; }` gdzie `fn()` samo ma `if (stan) return;`.
Dwa warunki "wychode z funkcji", ktore tworza cicho martwa galeaz.

## 06.10 22:46 - bot stoi 13 minut po smierci, plakietka klamie WAIT

Zgloszenie: "cos nie dziala i bot nie idzie". Zmierzone na zywo (`HH.probe()`):

| co | wartosc |
|---|---|
| `loggedIn` | true |
| `dead` | **true** (HP 0%) |
| `locked` | false |
| `state` | **WAIT** |
| `map` / `cords` | Ithan / 46,28 |
| `nextRespawnAt` | **0** |
| `runs` | **0** |
| `homeReason` | poSmierci |

Ostatni wpis w logu 22:46:39 "Blokada zdjeta - lece dalej", potem 13 min ciszy.
Strona zyje (wlasny `setInterval` 1 s odpalil sie 5/5), wyjatkow w logu brak.
To nie zawieszenie - to nieosiegalny kod.

### Przyczyna 1: `return` w galezi smierci

```js
if (GAME.dead()) {
  ...
  return;      // <-- PRZED maszyna stanow
}
```

Ten `return` stoi **przed** `switch`, wiec dopoki postac miala 0 HP, tick
konczyl sie w tym miejscu. `goHome()` nigdy nie wszedl - bot **nigdy** nie
zaplanowal respa i nie wracil do gry.

### Przyczyna 2: blokada nadpisala stan i go nie oddala

22:43:14 smierc -> `HOME`. 22:46:35 blokada (captcha) -> `WAIT`. Po zdjeciu
blokady skrypt wyczyscil tylko `lockKey`, a stan zostal `WAIT` na zawsze.
Ten sam wzorzec co w `czekaj()`: wyjscie z funkcji tworzy cicho martwa gaz.

### Falszywe "martwy" na ekranie logowania

`.hero-hp-progress-bar .inner` ma `bar-percent="0"`, ale caly element jest
**0x0 px** - to nierenderowany szablon, nie pasek HP (widoczny to
`.hp-indicator .blood[bar-percent]`). `hpPercent()` czytal szablon, wiec
po smierci `dead()` klamalo.

### Naprawa (3.4)

- `if (GAME.dead() && GAME.loggedIn())` - kolejnosc ma znaczenie: na ekranie
  logowania postaci nie ma, wiec `dead()` nie jest miarodajne
- koniec `return`, zamiast tego `goHome(MAPS.current())` - smierc prowadzi do
  planowania respa, tego samego kodu co po killu
- `lockState` zapamietuje stan przed blokada i przywraca go po zdjeciu;
  prawdziwy WAIT (czekanie na resp) zostaje nietkniety
- skrot "lece od nowa" w `goHome()` tylko dla **zywej** postaci
  (`&& !GAME.dead()`), inaczej logowal co sekunde i nigdy nie wylogowal

### Osobno: skrypt zainstalowany z GitHuba w ogole nie startuje

602 wpisy w konsoli gry, **wszystkie** z `127.0.0.1:8137/_inject.js` (kopia
wstrzyknieta recznie do testow). Z Tampermonkey zero - ani jednego logu
bootu, ani bledu. W DOM jest jeden `#hh-panel`. Na tej stronie dziala wiec
kopja wstrzyknieta, a nie skrypt z GitHuba - i tego drugiego nie uruchomiono
w ogole.
## 06.10 23:09 - dwa boty na jednej stronie + Start jako pusty strzal

Zgloszenie: "i czemu stoi". Zrzut konsoli pokazal w jednej sesji dwa
starty skryptu z DANYMI ROZNYMI:

```
[HH] Swiat: nerthus      <- pierwszy start
[HH] Swiat: commons      <- drugi start, ten sam dokument
```

### Przyczyna 1: skrypt wstrzykiwal sie w iframe

Margonem trzyma w sobie iframe `commons.margonem.pl` (potwierdzone
rowniez menu kontekstow DevTools, gdzie widnieja dwa konteksty).
`@match https://*.margonem.pl/*` pasowal do tego iframe, wiec skrypt
startowal tam po raz drugi. Dwa panele, dwa logi, dwa watki co sekunde,
dwa `BOT.state`. `Stop` trafial tylko w ten egzemplarz, ktory kliknal,
a drugi po chwili startowal z powrotem.

### Przyczyna 2: Start nie robil nic przy dzialajacej petli

`start()` mialo `if (this.running) return;`, a galaz `!GAME.loggedIn()`
z `nextRespawnAt = 0` pisala "brak zaplanowanego logowania - wcisnij
Start". Wyjscia nie bylo: przycisk Start nie robil nic, a godziny nie
bylo. Zmierzone: `WAIT -> Start. -> dalej WAIT`, `runs: 0`.

### Przyczyna 3: stanu nie dawalo sie odczytac

Tampermonkey MV3 trzyma kazdy skrypt w osobnym swiecie. `HH.probe()`
z konsoli strony zwraca `ReferenceError: HH is not defined`, a po
wybraniu kontekstu "Tampermonkey" w menu DevTools - to samo (dwa
podejscia, 06.10 23:12). Swiad klamal zrodlo bledu: `at VM11341:1`,
czyli kod siedzi w wewnetrznym VM poza zasiegiem obu kontekstow.
Bez odczytu stanu kazda awaria kończy sie zgadywaniem.

### Naprawa (3.6)

- `if (window.top !== window.self) return;` - tylko gorne okno
- `Start` przy dzialajacej petli kasuje plan i kaze sie zalogowac
- `Start` przy pierwszym uruchomieniu i bez planu zaklada plan za 3 s
- galaz bez planu sama planuje logowanie za 30 s, ale tylko gdy skrypt
  WIE, ze ma cos do zrobienia (`runs > 0` albo znany `nextRespawnAt`
  albo `homeReason`). Swiezy profil tego nie ma - tam Start mowi
  "wcisnij Start, zeby wejsc do gry". Bez tego warunku skrypt logowalby
  postac przy kazdym wejsciu na strone wyboru postaci, czyli wszedlby
  do gry bez pytania
- `mapLoadedAndAllInit` w `STANY_GRY` - flaga LADOWANIA mapy nie jest
  blokada do rozwiazania przez gracza; bez tego kazde wejscie na mape
  konczylo sie "Gra blokuje postac (mapLoadedAndAllInit)"
- `probe()` wyciagniete z `window.HH` do osobnej funkcji + przycisk
  **Stan** w panelu, ktory wypisuje trzy linie do DevLogu

### Zmierzone po naprawie (wlasna karta, przegladarka testowa)

| co | wynik |
|---|---|
| panele na stronie | 1 |
| przyciski | Start/start, Stop/stop, Stan/stan |
| swiat w panelu | `gefion` |
| klik `Stan` | 3 linie `STAN:` w DevLogu |
| `Start` na czystym magazynie | `running: true`, `nextRespawnAt` za 2 s |
| drugi `Start` | nie pusty strzal - plan przesuniety na 1 s |

### Znalezione przy okazji, dziala jak nalezy

`Start` jest **celowo** nieaktywny, gdy wybrany heros nie ma trasy
(`UI.powodStartu()`), a tytul mowi wprost "Ten heros nie ma trasy
w CONFIG - bot nie ma gdzie isc". Z trzech bohaterow z pustym `route`
(Zlodziej, Opetany Paladyn, Piekielny Kosciej) nie da sie startowac -
to poprawne zachowanie, nie blad. Przy wyczyszczonym magazynie
domyslnym bohaterem jest pierwszy z listy (Zlodziej), wiec Start
wydaje sie zepsuty, dopoki nie wybierzesz Przewodnika.
## 06.10 - "odpalam i nie idzie": falszywa smierc z szablonu

Zgloszenie: bot startuje i nie idzie. Na Gefion wygladalo to samo, wiec
od poczatku szukalem zlej sciezki po stronie skryptu.

### Zrodlo: dwa paski HP w DOM

Zmierzone na zywo w DOM gry:

```html
<!-- 1. SZABLON - 0x0 px, bar-percent="0" ZAWSZE -->
<div class="hero-hp-progress-bar hero-progress-bar-light-mode interface-element-progress-bar-1">
  <div class="inner" bar-horizontal="true" bar-percent="0"></div>
  <div class="value">0%</div>
</div>

<!-- 2. PRAWDA - .blood szerokosc 98 px, .hpp .value = "0%" -->
<div class="hp-indicator">
  <div class="blood-frame" style="display: block; ..."></div>
  <div class="blood" bar-horizontal="false" bar-percent="0" style="background-position: -103px -9px;"></div>
  <div class="hpp"><span class="value">0%</span></div>
</div>
```

`hpPercent()` czytal wylacznie punkt 1. Ten element ma `bar-percent="0"`
niezaleznie od tego, czy postac zyje - to nierysowany szablon, wiec
`dead()` mowilo "niezyje" **za kazdym razem**.

Wczesniej wygladalo to zgodnie z prawda, bo postac faktycznie lezala z
0 HP (pomiar z 22:56). Dopiero przy zywym bocie okazalo sie, ze to
odczyt szablonu, a nie postaci.

### Skutek

`dead()` = true -> galez smierci -> `goHome()` -> jestem w Ithanie ->
planowanie respa -> **`GAME.logout()`** i `WAIT` na `CONFIG.RESPAWN_MIN`
(domyslnie 120 minut). Bot wylogowywal postac i siadal na dwie godziny,
bez jednego logu bledu. Przy naprawie z 06.10 23:xx (smiec w `tick()`)
objaw wygladal identycznie - stąd dwa podobne zgloszenia.

Ten sam odczyt psucil logowanie: na stronie wyboru postaci szablon
tez mowi "0%", wiec galaz `dead() && loggedIn()` mogl wejsc w blad.

### Naprawa (3.7)

- `GAME.rendered(node)` - element uznany za warty odczytu tylko gdy gra
  go naprawde rysuje. Sprawdzamy wymiary ORAZ rodzica, bo `.hp-indicator
  .blood` ma wysokosc 0 px i sam o sobie o tym nie mowi
- kolejnosc zrodel: `.hp-indicator .hpp .value` -> `.hp-indicator .blood`
  -> `.hp-progress-bar .bar-percentage` -> szablon (ostatni i tylko
  wtedy, gdy jest rysowany)
- `dead()` przy `null` nie wchodzi w galez smierci. Jej skutek
  (wylogowanie + 120 minut) jest o wiele drozszy niz brak wykrycia
  smierci; przy zywej postaci `Engine.hero.d.id` wystarcza
- `const WERSJA` + wersja w panelu (`swiat · v3.7`). Konsola mowila na
  sztywno "Heros Hunter v3", wiec ze zrzutu nie dawalo sie odroznic
  3.5 od 3.7. `_verifyConfig.js` pilnuje zgodnosci `WERSJA` z `@version`

### Test na syntetycznym DOM (nie na zywej postaci - moja karta nie ma zyjacej)

| uklad w DOM | odczyt | oczekiwane |
|---|---|---|
| widoczny `.hpp .value` = 85% + ukryty szablon 0% | **85** | 85 |
| tylko ukryty szablon 0% (ekran logowania) | **null** | null |
| widoczny `.hpp .value` = 0% (postac martwa) | **0** | 0 |

Pierwsza wersja poprawki miala dziure: tekstowe odczyty (`textContent`)
nie sprawdzaly renderowania i ukryty szablon dalej zwracal 0. Wykrylo
to dopiero ten test - na zywej postaci wygladaloby git, bo tam prawdziwy
pasek jest renderowany.

### Różnica: skrypt w Tampermonkey vs wstrzyknieta kopia

Zgłoszenie: "problem jest w skrypcie w tamperze, tam nic nie działa".
To dwa rozne swiaty: skrypt z Tampermonkey zyje w izolowanym VM
(`@grant GM_setValue`), a testowa kopia to zwykly kod strony z shimem
`GM_*` na `localStorage`. Panele i log wygladaja tak samo, ale nie jest
to ten sam kod - i dokladnie dlatego testy u mnie nie wystarcza.