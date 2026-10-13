// Komenda "zap!" z czatu klanu w dwoch swiatach:
//  A) strona - skrypt widzi prawdziwe `window` (jak testowe wstrzykniecie)
//  B) piaskownica Tampermonkey - `window` to opakowanie (Proxy), nie
//     prawdziwe okno. Tak dziala skrypt z @grant GM_* + unsafeWindow.
// Zgloszone 13.10: "zap!" -> "nie widzę nicku w czacie". MouseEvent
// z `view: <opakowanie>` rzucal TypeError, a catch zwracal null.
// Uruchomienie: node test/komendy.e2e.js
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('./playwright');
const { przygotujStrone, raport, sleep, MAGAZYN_GO } = require('./fixture');

const R = raport();
const KOD = fs.readFileSync(path.join(__dirname, '..', 'src', 'heros-hunter.js'), 'utf8');

// Opakowanie okna jak w piaskownicy: odczyty i zapisy ida do prawdziwego
// okna, ale sam obiekt NIE jest Window.
const W_PIASKOWNICY = '(function (window) {\n' + KOD + '\n})(new Proxy(window, {\n'
  + '  get: function (t, k) { const v = Reflect.get(t, k); return typeof v === "function" && !/^[A-Z]/.test(String(k)) ? v.bind(t) : v; },\n'
  + '  set: function (t, k, v) { t[k] = v; return true; },\n'
  + '}));';

async function scenariusz(nazwa, kod) {
  console.log('\n== ' + nazwa);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.route('**/*', (r) => (r.request().url().startsWith('http://hh.test/')
      ? r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' })
      : r.abort()));
    const bledy = [];
    const logi = [];
    page.on('pageerror', (e) => bledy.push(e.message));
    page.on('console', (m) => { const t = m.text(); if (t.indexOf('[HH] ') === 0) logi.push(t.slice(5)); });
    await page.goto('http://hh.test/');
    await page.evaluate(przygotujStrone, MAGAZYN_GO);
    await page.addScriptTag({ content: kod });
    await sleep(3000);

    // Gra: prawy klik w nick otwiera menu z "Zaproś do grupy".
    await page.evaluate(() => {
      const teraz = new Date();
      const hh = String(teraz.getHours()).padStart(2, '0') + ':' + String(teraz.getMinutes()).padStart(2, '0');
      const w = document.createElement('div');
      w.className = 'new-chat-message chat-CLAN-message';
      w.innerHTML = '<span class="information-part"><span class="ts-section">[' + hh + ']</span>'
        + '<span class="channel-section">[K]</span><span class="author-section click-able">Runiczny Obrońca:</span></span>'
        + '<span class="message-part"><span class="message-section">zap!</span></span>';
      w.querySelector('.author-section').addEventListener('contextmenu', function () {
        const m = document.createElement('div');
        m.className = 'popup-menu show';
        const it = document.createElement('div');
        it.className = 'menu-item';
        it.textContent = 'Zaproś do grupy';
        it.addEventListener('click', function () { window.__zaproszono = 'Runiczny Obrońca'; m.remove(); });
        m.appendChild(it);
        document.body.appendChild(m);
      });
      document.body.appendChild(w);
    });
    await sleep(4000);

    const zaproszono = await page.evaluate(() => window.__zaproszono || null);
    R.sprawdz('komenda odebrana z czatu klanu', logi.some((l) => /Czat \(klan\) od Runiczny Obrońca: zap!/.test(l)), logi.slice(-4).join(' / '));
    R.sprawdz('klik "Zaproś do grupy" przy autorze', zaproszono === 'Runiczny Obrońca', 'zaproszono=' + zaproszono);
    R.sprawdz('w logu: wysłałem zaproszenie', logi.some((l) => /wysłałem zaproszenie do grupy: Runiczny Obrońca/.test(l)), logi.slice(-3).join(' / '));
    R.sprawdz(nazwa + ': brak wyjątków', bledy.length === 0, bledy.join(' | '));
  } finally {
    await browser.close();
  }
}

(async () => {
  await scenariusz('A) zap! - skrypt w swiecie strony', KOD);
  await scenariusz('B) zap! - skrypt w piaskownicy Tampermonkey', W_PIASKOWNICY);
  process.exit(R.koniec() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
