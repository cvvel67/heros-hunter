// Testy loadera heros-hunter.user.js: naglowek, wersja, adres @require
// i suma sha256 kodu glownego. Uruchomienie: node --test test/loader.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { zbuduj, wersjaZKodu, SRC, LOADER, REPO, SCIEZKA_KODU } = require('../tools/build-loader');

const loader = fs.readFileSync(LOADER, 'utf8');
const kod = fs.readFileSync(SRC);
const meta = (klucz) => [...loader.matchAll(new RegExp('^// @' + klucz + '\\s+(.+)$', 'gm'))].map((m) => m[1].trim());

test('loader jest aktualny (npm run build:loader po kazdej zmianie src)', () => {
  assert.equal(loader, zbuduj().tresc);
});

test('loader to sam naglowek userscriptu - bez kodu', () => {
  const linie = loader.trimEnd().split('\n');
  assert.equal(linie[0], '// ==UserScript==');
  assert.equal(linie[linie.length - 1], '// ==/UserScript==');
  for (const l of linie) assert.match(l, /^\/\/ /);
});

test('wersja: @version == WERSJA w kodzie == package.json', () => {
  const wersja = wersjaZKodu(kod.toString('utf8'));
  assert.deepEqual(meta('version'), [wersja]);
  const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  assert.ok(pkg.version === wersja || pkg.version === wersja + '.0', 'package.json version ' + pkg.version);
});

test('@require wskazuje tag wersji na jsDelivr i ma poprawna sume sha256 kodu', () => {
  const req = meta('require');
  assert.equal(req.length, 1);
  const wersja = meta('version')[0];
  const sha = crypto.createHash('sha256').update(kod).digest('hex');
  assert.equal(req[0], 'https://cdn.jsdelivr.net/gh/' + REPO + '@v' + wersja + '/' + SCIEZKA_KODU + '#sha256=' + sha);
});

test('uprawnienia i strony jak w pelnej wersji 0.28', () => {
  assert.deepEqual(meta('name'), ['Heros Hunter']);
  assert.deepEqual(meta('namespace'), ['https://github.com/cvvel67/heros-hunter']);
  assert.deepEqual(meta('grant').sort(), ['GM_getValue', 'GM_setValue', 'unsafeWindow']);
  assert.deepEqual(meta('match'), ['https://margonem.pl/*', 'https://*.margonem.pl/*', 'http://margonem.pl/*', 'http://*.margonem.pl/*']);
  assert.deepEqual(meta('run-at'), ['document-idle']);
});

test('kod glowny: konce linii LF i poprawna skladnia', () => {
  const t = kod.toString('utf8');
  assert.ok(!t.includes('\r'));
  assert.doesNotThrow(() => new Function(t));
});

test('@icon wskazuje plik ikony z repo spod tagu wersji', () => {
  const { adresIkony, SCIEZKA_IKONY } = require('../tools/build-loader');
  const wersja = meta('version')[0];
  assert.deepEqual(meta('icon'), [adresIkony(wersja)]);
  const png = fs.readFileSync(path.join(__dirname, '..', SCIEZKA_IKONY));
  assert.equal(png.slice(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 48);
  assert.equal(png.readUInt32BE(20), 48);
});
