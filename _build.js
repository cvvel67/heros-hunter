// Buduje dystrybucyjna, zminifikowana wersje skryptu - samodzielny plik,
// bez @require (zapasowa forma instalacji, gdy ktos nie chce loadera).
//
// Od 0.29 kod czytelny lezy w src/heros-hunter.js, a heros-hunter.user.js
// to loader (sam naglowek + @require). Wersja min bierze naglowek
// z loadera BEZ linii @require i dokleja zminifikowany kod z src/.
// Kazdy z plikow wskazuje @updateURL na SIEBIE, wiec niezaleznie od
// tego, ktory zostal zainstalowany, aktualizuje sie do tej samej formy
// (loader -> loader, min -> min) i nie zamienia sie miejscem
// z drugim plikiem bez wiedzy uzytkownika.
//
// Uzycie:  npm install  (raz, instaluje terser)
//          npm run build
const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const LOADER = path.join(__dirname, 'heros-hunter.user.js');
const KOD = path.join(__dirname, 'src', 'heros-hunter.js');
const OUT_DIR = path.join(__dirname, 'dist');
const OUT = path.join(OUT_DIR, 'heros-hunter.min.user.js');

// Plik lezy w dist/ - tak tez mowi README. Wczesniej byl tu adres bez
// "dist/" (404), wiec zainstalowana wersja min nigdy sie nie aktualizowala
// (sprawdzone 10.10: root 404, dist 200).
const RAW = 'https://raw.githubusercontent.com/cvvel67/heros-hunter/main/dist/heros-hunter.min.user.js';

// --- naglowek userscript (z loadera, bez @require) ----------------------
const loader = fs.readFileSync(LOADER, 'utf8');
const koniecNaglowka = loader.indexOf('// ==/UserScript==');
if (koniecNaglowka < 0) throw new Error('nie znaleziono // ==/UserScript==');

const naglowek = loader.slice(0, koniecNaglowka + '// ==/UserScript=='.length)
  .replace(/^\/\/ @require\s.*\n/gm, '');
// W dystrybucji @updateURL/@downloadURL musza wskazywac na dist, inaczej
// zainstalowany min.js aktualizowalby sam siebie zrodlem czytelnym -
// czyli zamienilby uzytkownikowi plik bez powodu.
const naglowekDist = naglowek.replace(
  /^(\/\/ @(?:updateURL|downloadURL)\s+).*$/gm,
  (_cała, prefiks) => prefiks + RAW
);
const wersja = (naglowek.match(/@version\s+(\S+)/) || [])[1];
if (!wersja) throw new Error('brak @version w naglowku');

// --- sam kod (src/) ----------------------------------------------------
const src = fs.readFileSync(KOD, 'utf8');
const body = src;
const wersjaKodu = (src.match(/const WERSJA = '([^']+)'/) || [])[1];
if (wersjaKodu !== wersja) throw new Error('WERSJA w src (' + wersjaKodu + ') != @version w loaderze (' + wersja + ') - uruchom npm run build:loader');

(async () => {
  const wynik = await minify(body, {
    compress: { passes: 2 },
    mangle: true,
    format: { comments: false },
  });
  if (wynik.error) throw wynik.error;

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const kod = naglowekDist + '\n' + wynik.code + '\n';
  fs.writeFileSync(OUT, kod, 'utf8');

  const kb = (n) => (n / 1024).toFixed(1) + ' KB';
  console.log('wersja:    ' + wersja);
  console.log('zrodlo:    ' + kb(Buffer.byteLength(src)));
  console.log('dist:      ' + kb(Buffer.byteLength(kod)));
  console.log('procent:   ' + ((Buffer.byteLength(kod) / Buffer.byteLength(src)) * 100).toFixed(0) + '%');
  console.log('sciezka:   dist/heros-hunter.min.user.js');
})();