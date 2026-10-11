// Buduje odczyt-zagadki.js: snippet TYLKO DO ODCZYTU dla prawdziwej strony gry.
// Wkleja funkcje utworzZagadke wycieta z heros-hunter.user.js (ten sam kod,
// ktory dziala w skrypcie) i zwraca, co widzi w kazdej dostepnej ramce:
// Engine.lock.list, selektory zagadki, wynik wykryj(). Nie klika, nie wysyla
// pakietow, nie zmienia stanu gry. Uruchomienie: npm run odczyt
const fs = require('node:fs');
const path = require('node:path');

const zrodlo = fs.readFileSync(path.join(__dirname, '..', 'heros-hunter.user.js'), 'utf8');
const a = zrodlo.indexOf('function utworzZagadke(');
const b = zrodlo.indexOf('const ZAGADKA = utworzZagadke(');
if (a < 0 || b <= a) throw new Error('nie znaleziono utworzZagadke');
const funkcja = zrodlo.slice(a, b).trim();

const snippet = `(() => {
${funkcja}
  const ramki = [window];
  for (let i = 0; i < window.frames.length; i++) ramki.push(window.frames[i]);
  const wynik = [];
  for (const w of ramki) {
    let host;
    try { host = w.location.host; } catch (e) { wynik.push({ ramka: 'inna domena (brak dostepu)' }); continue; }
    const doc = w.document;
    const E = w.Engine;
    const z = utworzZagadke({
      engine: () => E, doc: () => doc,
      stopWalk() {}, log: { warn() {}, ok() {} }, notify() {},
      przypomnijMs: 0, oddechMs: 0,
    });
    const opis = (sel) => {
      const n = doc.querySelector(sel);
      if (!n) return null;
      const r = n.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height),
        tekst: String(n.innerText || n.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 80) };
    };
    wynik.push({
      ramka: host,
      engine: typeof E,
      lock: E && E.lock && Array.isArray(E.lock.list) ? E.lock.list.slice() : null,
      engineCaptcha: !!(E && E.captcha),
      preCaptcha: opis('.pre-captcha'),
      preCaptchaShow: opis('.pre-captcha.show'),
      captchaWindow: opis('.captcha-window'),
      captchaLayer: opis('.captcha-layer'),
      captchaTimer: opis('#captcha-timer'),
      wykryj: z.wykryj(),
    });
  }
  return wynik;
})()`;

fs.writeFileSync(path.join(__dirname, 'odczyt-zagadki.js'), snippet + '\n');
console.log('odczyt-zagadki.js: ' + snippet.length + ' znakow');
