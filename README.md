# Heros Hunter

Skrypt (Tampermonkey) do Margonem. Obchodzi respy wybranego heroesa,
powiadamia klan na czacie i Discorda, steruje walką z poziomu czatu.

## Instalacja

1. Otwórz `heros-hunter.user.js` z tego repo
2. Skopiuj całość do nowego skryptu w Tampermonkey
3. Zapisz

Skrypt sam wczytuje się na każdej stronie `*.margonem.pl`.
Pierwsze uruchomienie wymaga kliknięcia **Start**. Przy kolejnych
wejściach wznawia pracę sam (opcja `CONFIG.AUTO_RESUME`).

Webhook Discorda wpisuje się w panelu przy ikonie Discorda. W pliku jest
celowo pusty — adres nie powinien siedzieć w kodzie.

## Co robi

- **Obchodzi respy** wybranego heroesa w kolejności z `CONFIG.HEROES[].route`
- **Rozpoznaje zwoje przywołania** automatycznie — czyta nazwy przedmiotów
  z pamięci gry (`TIPS.allTips`) i dopasowuje je do nazwy z konfiguracji
- **Powiadamia** na czacie klanowym i webhooku Discorda
- **Steruje walką** komendami z czatu

### Komendy na czacie klanowym lub drużyny

| komenda | działanie |
|---|---|
| `zap!` | zaprasza ostatniego autora wiadomości do grupy |
| `bij!` | atakuje od razu, bez odliczania |
| `czekaj!` | cofnij odliczanie do ataku o `CONFIG.ATAK_OD_NOWA_MIN` minut |
| `przywo!` | zużywa zwój przywołania (tylko gdy heros jest na ekranie) |
| `oddaj d!` | przekazuje dowództwo drużyny |
| `odwolaj 30m` | przerwij obchód, wyloguj się na 30 minut |
| `heros 2!` | przełącz na herosa nr 2 z listy |

### Skróty klawiszowe

`Alt+H` — zwiń/rozwiń panel. `Alt+R` — przebuduj panel.
`Alt+L` — pokaż/ukryj DevLog.

## Konfiguracja

Wszystko w `CONFIG` na początku pliku. Najczęściej zmieniane:

```js
HOME: { id: 1, name: 'Ithan' }   // punkt powrotu
RESPAWN_MIN: 120                 // ile czekać po killu, gdy nie zna respu
AUTO_RESUME: true                // wznawiaj po odświeżeniu strony
HEROES: [ ... ]                  // lista herosów i ich tras
```

Nowego heroesa dodaje się przez skopiowanie istniejącego bloku
i wpisanie `key`, `nazwa`, `zwój`, `img`, `route`.

`route` to lista map w kolejności obchodzenia. Na mapie `spawns` to
miejsca, gdzie sprawdzać. `{ id: X, pass: true }` = przejść, nie szukać.

## Zwoje przywołania

Skrypt nie potrzebuje wpisywać `item-tpl` — to numer wewnętrzny gry,
łatwo go pomylić. Wpisuje się **nazwę** zwoju przy herosie:

```js
zwój: 'Zwój przywołania drużyny na herosa Zły Przewodnik'
```

Skrypt sam znajdzie numer, skanując ekwipunek co 20 sekund.
Zwoje w zamkniętym worku nie są widoczne — trzeba worek otworzyć.

## Znałe ograniczenia

- **Trasy nowych heroesa wymagają grafu przejść.** `CONFIG.GATEWAYS`
  pokrywa okolicę Złego Przewodnika (18 map). Bez wpisu przejść bot
  szuka bramy na miejscu, co działa, ale niekoniecznie najszybciej.
- **Punkty respów bywają nieaktualne** — po zmianie w grze trzeba
  sprawdzić `route`.
- **Zwój przywołania działa tylko tam, gdzie pojawia się heros.**
  Skrypt sprawdza to przed zużyciem i nie marnuje sztuk.

## Zgłoszone błędy

`NOTES.md` trzyma pełną historię: co było naprawione, co działa,
co zostało zmierzone, a co tylko zgadnięte. Warto przeczytać przed
dodaniem nowej trasy.