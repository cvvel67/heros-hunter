// Buduje dystrybucyjna, zminifikowana wersje skryptu.
//
// Po co: w repo lezy wersja czytelna (heros-hunter.user.js, 5342 linie
// z komentarzami) i wersja produkcyjna (dist/heros-hunter.min.user.js,
// ~91 KB, 16 linii). Wersja czytelna zostaje w repo, bo to jedyny
// miejsce, gdzie jest zapis *dlaczego* kazda poprawka istnieje;
// instalowana przez Tampermonkey jest zazwyczaj ta z dist.
// Kazdy z plikow wskazuje @updateURL na SIEBIE, wiec niezaleznie od
// tego, ktory zostal zainstalowany, aktualizuje sie do tej samej formy
// (czytelna -> czytelna, min -> min) i nie zamienia sie miejscem
// z drugim plikiem bez wiedzy uzytkownika.
//
// Uzycie:  npm install  (raz, instaluje terser)
//          npm run build
const fs = require('fs');
const path = require('path');
const { minify } = require('terser');

const SRC = path.join(__dirname, 'heros-hunter.user.js');
const OUT_DIR = path.join(__dirname, 'dist');
const OUT = path.join(OUT_DIR, 'heros-hunter.min.user.js');

const RAW = 'https://raw.githubusercontent.com/cvvel67/heros-hunter/main/heros-hunter.min.user.js';

// --- naglowek userscript -----------------------------------------------
const src = fs.readFileSync(SRC, 'utf8');
const koniecNaglowka = src.indexOf('// ==/UserScript==');
if (koniecNaglowka < 0) throw new Error('nie znaleziono // ==/UserScript==');

const naglowek = src.slice(0, koniecNaglowka + '// ==/UserScript=='.length);
// W dystrybucji @updateURL/@downloadURL musza wskazywac na dist, inaczej
// zainstalowany min.js aktualizowalby sam siebie zrodlem czytelnym -
// czyli zamienilby uzytkownikowi plik bez powodu.
const naglowekDist = naglowek.replace(
  /^(\/\/ @(?:updateURL|downloadURL)\s+).*$/gm,
  (_cała, prefiks) => prefiks + RAW
);
const wersja = (naglowek.match(/@version\s+(\S+)/) || [])[1];
if (!wersja) throw new Error('brak @version w naglowku');

// --- sam kod ----------------------------------------------------------
const body = src.slice(koniecNaglowka + '// ==/UserScript=='.length).replace(/^\s+/, '');

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