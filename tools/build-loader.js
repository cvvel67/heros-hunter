// Buduje loader heros-hunter.user.js - plik instalowany w Tampermonkey.
//
// Loader to sam naglowek userscriptu. Kod glowny (src/heros-hunter.js)
// Tampermonkey pobiera przez @require z jsDelivr, spod TAGU wersji
// (v<WERSJA>), i sprawdza jego sume sha256. Plik pod tagiem jsDelivr
// trzyma na stale, wiec suma liczona tu lokalnie musi byc suma pliku
// w repo - dlatego src/heros-hunter.js ma w .gitattributes `-text`
// (git nie zmienia w nim koncow linii).
//
// Wersja ma jedno zrodlo: `const WERSJA` w src/heros-hunter.js.
//
// Uzycie: npm run build:loader
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const KATALOG = path.join(__dirname, '..');
const SRC = path.join(KATALOG, 'src', 'heros-hunter.js');
const LOADER = path.join(KATALOG, 'heros-hunter.user.js');

const REPO = 'cvvel67/heros-hunter';
const SCIEZKA_KODU = 'src/heros-hunter.js';
const AKTUALIZACJE = 'https://raw.githubusercontent.com/' + REPO + '/main/heros-hunter.user.js';

function wersjaZKodu(kod) {
  const m = kod.match(/^\s*const WERSJA = '([0-9][0-9.]*)';$/m);
  if (!m) throw new Error('nie znaleziono `const WERSJA = \'x.y\';` w ' + SCIEZKA_KODU);
  return m[1];
}

function adresKodu(wersja, sha256) {
  return 'https://cdn.jsdelivr.net/gh/' + REPO + '@v' + wersja + '/' + SCIEZKA_KODU + '#sha256=' + sha256;
}

// Zwraca tresc loadera dla biezacego src/heros-hunter.js.
function zbuduj() {
  const bajty = fs.readFileSync(SRC);
  const kod = bajty.toString('utf8');
  if (kod.includes('\r')) throw new Error(SCIEZKA_KODU + ' ma CR - oczekiwane konce linii LF');
  const wersja = wersjaZKodu(kod);
  const sha256 = crypto.createHash('sha256').update(bajty).digest('hex');
  const linie = [
    '// ==UserScript==',
    '// @name         Heros Hunter',
    '// @namespace    https://github.com/' + REPO,
    '// @version      ' + wersja,
    '// @description  szuka heros',
    '// @updateURL    ' + AKTUALIZACJE,
    '// @downloadURL  ' + AKTUALIZACJE,
    '// @match        https://margonem.pl/*',
    '// @match        https://*.margonem.pl/*',
    '// @match        http://margonem.pl/*',
    '// @match        http://*.margonem.pl/*',
    '// @grant        GM_setValue',
    '// @grant        GM_getValue',
    '// @grant        unsafeWindow',
    '// @run-at       document-idle',
    '// @require      ' + adresKodu(wersja, sha256),
    '// ==/UserScript==',
  ];
  return { tresc: linie.join('\n') + '\n', wersja, sha256 };
}

module.exports = { zbuduj, wersjaZKodu, adresKodu, SRC, LOADER, REPO, SCIEZKA_KODU };

if (require.main === module) {
  const { tresc, wersja, sha256 } = zbuduj();
  fs.writeFileSync(LOADER, tresc);
  console.log('heros-hunter.user.js: v' + wersja + ', sha256 ' + sha256.slice(0, 16) + '...');
}
