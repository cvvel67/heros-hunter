// Testy sekcji 9a (ZAGADKA) z heros-hunter.user.js.
// Wycinamy z pliku dokladnie funkcje utworzZagadke - test sprawdza ten sam
// kod, ktory dziala w grze, a nie jego kopie.
// Uruchomienie: node --test zagadka.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const zrodlo = fs.readFileSync(path.join(__dirname, 'heros-hunter.user.js'), 'utf8');
const a = zrodlo.indexOf('function utworzZagadke(');
const b = zrodlo.indexOf('const ZAGADKA = utworzZagadke(');
assert.ok(a > 0 && b > a, 'nie znaleziono utworzZagadke w skrypcie');
const utworzZagadke = new Function(zrodlo.slice(a, b) + '\nreturn utworzZagadke;')();

// Element DOM o zadanym rozmiarze i tekscie.
function el(w, h, txt) {
  return { getBoundingClientRect: () => ({ width: w, height: h }), innerText: txt || '' };
}

function srodowisko(opcje) {
  const o = Object.assign({ przypomnijMs: 120000, oddechMs: 1500 }, opcje || {});
  const st = { lock: [], dom: {}, logi: [], pingi: [], stopy: 0 };
  const z = utworzZagadke({
    engine: () => ({ lock: { list: st.lock } }),
    doc: () => ({ querySelector: (s) => st.dom[s] || null }),
    stopWalk: () => { st.stopy++; },
    log: {
      warn: (m) => st.logi.push(['warn', m]),
      ok: (m) => st.logi.push(['ok', m]),
    },
    notify: (m) => st.pingi.push(m),
    przypomnijMs: o.przypomnijMs,
    oddechMs: o.oddechMs,
  });
  return { z, st };
}

test('lock "captcha" wstrzymuje bota, zatrzymuje ruch i wysyla jedno powiadomienie', () => {
  const { z, st } = srodowisko();
  st.lock.push('captcha');
  assert.equal(z.takt(0), true);
  assert.equal(z.takt(1000), true);
  assert.equal(z.takt(2000), true);
  assert.equal(st.stopy, 1);
  assert.equal(st.pingi.length, 1);
  assert.equal(z.stan().zrodlo, 'lock');
});

test('po zniknieciu zagadki krotka przerwa, potem bot rusza', () => {
  const { z, st } = srodowisko();
  st.lock.push('captcha');
  z.takt(0);
  st.lock.length = 0;
  assert.equal(z.takt(10000), true, 'oddech zaraz po zniknieciu');
  assert.equal(z.takt(11000), true);
  assert.equal(z.takt(11600), false, 'po 1,5 s bot wraca');
  assert.equal(z.stan().aktywna, false);
  assert.ok(st.logi.some((l) => l[0] === 'ok' && /zniknęła/.test(l[1])));
});

test('pre-captcha i okno zagadki sa wykrywane z DOM', () => {
  const { z, st } = srodowisko();
  st.dom['.pre-captcha.show'] = el(300, 80);
  assert.equal(z.wykryj(), 'pre-captcha');
  delete st.dom['.pre-captcha.show'];
  st.dom['.captcha-window'] = el(400, 300, 'Zagadka Zaznacz wszystkie odpowiedzi z gwiazdką');
  assert.equal(z.wykryj(), 'captcha-window');
});

test('negatywne: pusta warstwa, ukryte okno, okno bez tekstu zagadki - brak pauzy', () => {
  const { z, st } = srodowisko();
  st.dom['.captcha-layer'] = el(1920, 1080, '');            // lezy w DOM przez cala gre
  assert.equal(z.takt(0), false);
  st.dom['.captcha-window'] = el(0, 0, 'Zagadka');           // niewidoczne
  assert.equal(z.takt(1000), false);
  st.dom['.captcha-window'] = el(400, 300, 'Ekwipunek');     // inne okno
  assert.equal(z.takt(2000), false);
  st.dom['.pre-captcha.show'] = el(10, 10);                  // za male = szablon
  assert.equal(z.takt(3000), false);
  assert.equal(st.pingi.length, 0);
  assert.equal(st.stopy, 0);
});

test('negatywne: normalne stany gry w locku nie wstrzymuja bota', () => {
  const { z, st } = srodowisko();
  st.lock.push('battle', 'change_location', 'mapLoadedAndAllInit', 'dead');
  assert.equal(z.takt(0), false);
  assert.equal(st.pingi.length, 0);
});

test('przypomnienia co przypomnijMs, bez spamu', () => {
  const { z, st } = srodowisko({ przypomnijMs: 120000 });
  st.lock.push('captcha');
  for (let t = 0; t <= 180000; t += 1000) z.takt(t);   // 3 minuty, takt co 1 s
  assert.equal(st.pingi.length, 2, 'pierwsze + jedno przypomnienie po 2 min');
  assert.equal(st.pingi[1].title, 'Zagadka wciąż czeka');
});

test('przypomnijMs = 0 - tylko pierwsze powiadomienie', () => {
  const { z, st } = srodowisko({ przypomnijMs: 0 });
  st.lock.push('captcha');
  for (let t = 0; t <= 600000; t += 5000) z.takt(t);
  assert.equal(st.pingi.length, 1);
});

test('druga zagadka po pierwszej to nowy epizod z nowym powiadomieniem', () => {
  const { z, st } = srodowisko();
  st.lock.push('captcha');
  z.takt(0);
  st.lock.length = 0;
  z.takt(5000); z.takt(7000);
  st.lock.push('captcha');
  z.takt(60000);
  assert.equal(st.pingi.length, 2);
  assert.equal(st.stopy, 2);
});

test('brak Engine i dokumentu - bez wyjatku, brak pauzy', () => {
  const z = utworzZagadke({
    engine: () => undefined,
    doc: () => { throw new Error('brak DOM'); },
    stopWalk: () => {}, log: { warn() {}, ok() {} }, notify: () => {},
    przypomnijMs: 0, oddechMs: 1500,
  });
  assert.equal(z.takt(0), false);
});

test('skrypt nie zawiera kodu odpowiadajacego na zagadke', () => {
  const blok = zrodlo.slice(zrodlo.indexOf('// >>> ZAGADKA'), zrodlo.indexOf('// <<< ZAGADKA'));
  assert.ok(blok.length > 0);
  assert.doesNotMatch(blok, /setCaptchaAnswer|captcha__buttons|captcha__confirm|\.click\(/);
});

test('blokada (#captcha-timer) po zamknieciu okna trzyma pauze i daje osobne powiadomienie', () => {
  const { z, st } = srodowisko();
  st.lock.push('captcha');
  z.takt(0);
  st.lock.length = 0;                        // close(): lock zdjety...
  st.dom['#captcha-timer'] = el(0, 0, '60'); // ...ale gra pokazuje blokade
  assert.equal(z.takt(1000), true);
  assert.equal(z.takt(10000), true);
  assert.equal(z.stan().zrodlo, 'blokada');
  assert.deepEqual(st.pingi.map((p) => p.title), ['Zagadka w grze', 'Zagadka: blokada']);
});

test('powiadomienie odrzucone przez NOTIFY (false) jest ponawiane w nastepnym takcie', () => {
  const pingi = [];
  let odrzucaj = 1;
  const z = utworzZagadke({
    engine: () => ({ lock: { list: ['captcha'] } }),
    doc: () => null,
    stopWalk: () => {}, log: { warn() {}, ok() {} },
    notify: (m) => { if (odrzucaj > 0) { odrzucaj--; return false; } pingi.push(m.title); return true; },
    przypomnijMs: 0, oddechMs: 1500,
  });
  z.takt(0);
  assert.equal(pingi.length, 0);
  z.takt(1000);
  assert.deepEqual(pingi, ['Zagadka w grze']);
  z.takt(2000);
  assert.equal(pingi.length, 1, 'bez dubla po udanym ponowieniu');
});
