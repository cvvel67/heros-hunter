# Heros Hunter

Skrypt (Tampermonkey) do Margonem. Obchodzi respy wybranego herosa,
powiadamia klan na czacie i Discorda, steruje walką z poziomu czatu.

## Instalacja

Przy zainstalowanym Tampermonkey otwórz w przeglądarce:

```
https://raw.githubusercontent.com/cvvel67/heros-hunter/main/heros-hunter.user.js
```

i kliknij **Zainstaluj**. To loader: sam nagłówek userscriptu. Kod główny
Tampermonkey pobiera raz z jsDelivr (`@require`), sprawdza jego sumę
sha256 i trzyma u siebie. Kolejne wersje przychodzą same.

Wersja samodzielna (jeden plik, bez pobierania kodu z jsDelivr):
`dist/heros-hunter.min.user.js`.

Pierwsze uruchomienie wymaga kliknięcia **Start**. Webhook Discorda wpisuje
się w panelu (ikona Discorda). W kodzie jest celowo pusty.

Jeśli Tampermonkey pokazuje tylko stronę „This page is used as an
intermediate step…”: w `chrome://extensions` → Tampermonkey → Szczegóły
włącz **Zezwalaj na skrypty użytkownika**.

## Struktura

```
heros-hunter.user.js        loader - instalowany w Tampermonkey (GENEROWANY)
src/heros-hunter.js         kod główny - tu się wprowadza zmiany
dist/heros-hunter.min.user.js  wersja samodzielna, zminifikowana (GENEROWANA)
tools/build-loader.js       buduje loader (wersja + adres + sha256)
tools/release.js            sprawdza wszystko i zakłada tag wersji
tools/zbuduj-odczyt.js      fragment do konsoli gry, tylko odczyt
_build.js                   buduje dist/ (terser)
test/                       testy lokalne, bez sieci i bez gry
NOTES.md                    historia projektu
```

## Praca nad kodem

```
npm install            # raz: playwright (testy) + terser (dist)
npm test               # składnia + testy jednostkowe + e2e
```

Testy e2e ładują cały skrypt do Chromium na sztucznej grze (bez sieci).
Obejmują głównie obsługę zagadki gry i loader. Ruch, trasy, walka
i logowanie nie mają testów automatycznych: sprawdza się je w grze.

## Wydanie nowej wersji

Wersja ma jedno źródło: `const WERSJA` w `src/heros-hunter.js`
(plus `version` w `package.json`, pilnowane testem).

1. Zmiany w `src/heros-hunter.js`, podbij `WERSJA` i `version` w `package.json`.
2. `npm run build:loader` i `npm run build`.
3. `git commit`.
4. `npm run release`: sprawdza, czy loader jest aktualny i wszystko
   zacommitowane, uruchamia testy i zakłada tag `v<WERSJA>`. **Nie wypycha.**
5. `git push origin <gałąź> v<WERSJA>`.

Uwaga: plik pod tagiem jsDelivr trzyma **na stałe**. Tagu nie da się
poprawić. Błąd w wydanej wersji naprawia się kolejną wersją
(np. `0.29` → `0.29.1`). Plik `src/heros-hunter.js` ma w `.gitattributes`
`-text`, żeby suma sha256 w loaderze zgadzała się z plikiem w repo.

Loader i `dist/` wskazują `@updateURL` na gałąź `main`. Gracze dostają
aktualizację dopiero wtedy, gdy nowa wersja trafi na `main`.
