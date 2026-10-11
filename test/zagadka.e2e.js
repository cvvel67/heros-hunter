// Test integracyjny sekcji 9a: caly heros-hunter.user.js w headless Chromium,
// na lokalnej stronie ze sztucznym Engine. Siec jest zablokowana (zadnego
// polaczenia z gra ani z Discordem); fetch jest podstawiony i tylko liczy
// powiadomienia.
// Uruchomienie: node zagadka.e2e.js
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('./playwright');

const SKRYPT = fs.readFileSync(path.join(__dirname, '..', 'heros-hunter.user.js'), 'utf8');

// Stan startowy magazynu: bot byl w GO na trasie Przewodnika (mapa 8),
// wiec AUTO_RESUME uruchamia petle sama.
const MAGAZYN = {
  HH_V3: JSON.stringify({
    state: 'GO', heroKey: 'przewodnik', routeIndex: 0,
    webhook: 'https://discord.com/api/webhooks/1/test-token',
  }),
};

function przygotujStrone(magazyn) {
  const m = Object.assign({}, magazyn);
  window.GM_getValue = (k, d) => (k in m ? m[k] : d);
  window.GM_setValue = (k, v) => { m[k] = v; };
  window.__pingi = [];
  window.fetch = (url, o) => {
    try { window.__pingi.push(JSON.parse(o.body).embeds[0].title); } catch (e) { window.__pingi.push('?'); }
    return Promise.resolve({ status: 204 });
  };
  window.__ruchy = 0;
  window.__stopy = 0;
  window.Engine = {
    browserToken: 'token-testowy',
    dead: false,
    lock: { list: [], check: () => false },
    hero: {
      d: { id: 1, x: 10, y: 10, nick: 'Tester', hp: 100, maxhp: 100 },
      rx: 10, ry: 10,
      getCords() { return '10,10'; },
      autoGoTo() { window.__ruchy++; },
      clearAutoPathOfHero() { window.__stopy++; },
    },
    map: {
      d: { id: 8, name: 'Zniszczone Opactwo' },
      size: { x: 64, y: 64 },
      gateways: { getDrawableItems: () => [], townnames: {} },
      getMoveBlock: () => false,
    },
    npcs: { check: () => ({}) },
    battle: {},
    interface: {},
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const wyniki = [];
function sprawdz(nazwa, ok, szczegoly) {
  wyniki.push({ nazwa, ok });
  console.log((ok ? 'PASS ' : 'FAIL ') + nazwa + (szczegoly ? '  [' + szczegoly + ']' : ''));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    // Zadnego ruchu sieciowego - tylko nasza strona.
    await page.route('**/*', (r) => (r.request().url().startsWith('http://hh.test/')
      ? r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' })
      : r.abort()));
    const bledy = [];
    page.on('pageerror', (e) => bledy.push(e.message));
    page.on('console', (m) => { if (/\[HH\] Wyj|Wyjątek/.test(m.text())) bledy.push(m.text()); });

    await page.goto('http://hh.test/');
    await page.evaluate(przygotujStrone, MAGAZYN);
    await page.addScriptTag({ content: SKRYPT });

    const stan = () => page.evaluate(() => ({
      badge: (document.querySelector('#hh-panel .hh-pill span') || {}).textContent || null,
      ruchy: window.__ruchy, stopy: window.__stopy, pingi: window.__pingi.slice(),
    }));

    // 1) bot pracuje normalnie
    await sleep(6000);
    let s0 = await stan();
    sprawdz('panel zbudowany, bot wznowiony po starcie', !!s0.badge && s0.badge !== 'STOPPED', 'badge=' + s0.badge);
    sprawdz('bot wysyla ruchy przed zagadka', s0.ruchy > 0, 'ruchy=' + s0.ruchy);

    // 2) gra zaklada lock "captcha" (to samo co Engine.captcha.blockMove)
    await page.evaluate(() => { window.Engine.lock.list.push('captcha'); });
    await sleep(1500);
    const s1 = await stan();
    sprawdz('badge ZAGADKA', s1.badge === 'ZAGADKA', 'badge=' + s1.badge);
    sprawdz('ruch zatrzymany (stopWalk)', s1.stopy > s0.stopy, 'stopy ' + s0.stopy + '->' + s1.stopy);
    await sleep(7000);
    const s2 = await stan();
    sprawdz('zero ruchow przez 7 s pauzy', s2.ruchy === s1.ruchy, 'ruchy ' + s1.ruchy + '->' + s2.ruchy);
    const zagadkowe = s2.pingi.filter((t) => /Zagadka/.test(t));
    sprawdz('dokladnie jedno powiadomienie', zagadkowe.length === 1, JSON.stringify(zagadkowe));

    // 3) zagadka rozwiazana - gra zdejmuje lock
    await page.evaluate(() => { window.Engine.lock.list.length = 0; });
    await sleep(7000);
    const s3 = await stan();
    sprawdz('badge wraca do stanu bota', s3.badge !== 'ZAGADKA' && s3.badge !== 'STOPPED', 'badge=' + s3.badge);
    sprawdz('bot znowu wysyla ruchy', s3.ruchy > s2.ruchy, 'ruchy ' + s2.ruchy + '->' + s3.ruchy);
    const trasa = await page.evaluate(() => JSON.parse(window.GM_getValue('HH_V3')).routeIndex);
    sprawdz('trasa nie zresetowana (routeIndex 0 -> ten sam krok)', trasa === 0, 'routeIndex=' + trasa);

    // 4) negatywny: pusta .captcha-layer w DOM nie zatrzymuje bota
    await page.evaluate(() => {
      const d = document.createElement('div');
      d.className = 'captcha-layer layer';
      d.style.cssText = 'position:fixed;inset:0;pointer-events:none';
      document.body.appendChild(d);
    });
    const s4a = await stan();
    await sleep(6000);
    const s4 = await stan();
    sprawdz('pusta .captcha-layer - brak pauzy', s4.badge !== 'ZAGADKA' && s4.ruchy > s4a.ruchy,
      'badge=' + s4.badge + ' ruchy ' + s4a.ruchy + '->' + s4.ruchy);

    // 5) okno zagadki w DOM (bez locka) tez wstrzymuje
    await page.evaluate(() => {
      const w = document.createElement('div');
      w.className = 'captcha-window';
      w.style.cssText = 'position:fixed;left:0;top:0;width:400px;height:300px';
      w.textContent = 'Zagadka Zaznacz wszystkie odpowiedzi z gwiazdką';
      document.body.appendChild(w);
    });
    await sleep(1500);
    const s5 = await stan();
    sprawdz('.captcha-window z tekstem - pauza', s5.badge === 'ZAGADKA', 'badge=' + s5.badge);
    await page.evaluate(() => document.querySelector('.captcha-window').remove());
    await sleep(3000);
    const s6 = await stan();
    sprawdz('po usunieciu okna - wznowienie', s6.badge !== 'ZAGADKA', 'badge=' + s6.badge);
    sprawdz('drugi epizod = drugie powiadomienie',
      s6.pingi.filter((t) => t === 'Zagadka w grze').length === 2, JSON.stringify(s6.pingi));

    sprawdz('brak wyjatkow w skrypcie', bledy.length === 0, bledy.join(' | '));
  } finally {
    await browser.close();
  }
  const zle = wyniki.filter((w) => !w.ok).length;
  console.log('\n' + (wyniki.length - zle) + '/' + wyniki.length + ' PASS');
  process.exit(zle ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
