// Wspolne srodowisko testow e2e: sztuczny Engine + atrapa serwera zagadki.
//
// Atrapa odtwarza obsluge pakietu `captcha` z frontendu gry (zrzut
// bot_margon-main/analysis/margonem_frontend/sources/...main.min.js,
// Engine.captcha.getAction/updateData):
//   { autostart_time_left } -> showPreCaptcha  (.pre-captcha.show z odliczaniem)
//   { content, triesLeft }  -> openCaptcha     (.captcha-window, Engine.lock.add("captcha"))
//   { done: true }          -> captchaDone     (close(): lock.remove + usuniecie okna)
//   { blockade_time_left }  -> blockWithCounter (close() + mAlert z #captcha-timer)
//
// "Gracz" w testach odpowiada przez serwer.odpowiedz(...) - tak jak w grze
// odpowiedz idzie pakietem do serwera, a serwer odsyla wynik. Poprawna
// odpowiedz zna tylko serwer (serwer.poprawna); test nie czyta jej z okna.
// Zadnego ruchu sieciowego: strona jest podstawiana lokalnie, reszta
// zapytan jest odrzucana, fetch jest atrapa liczaca powiadomienia.
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('./playwright');

const PLIK = path.join(__dirname, '..', 'src', 'heros-hunter.js');

// Wykonywane W PRZEGLADARCE (serializowane przez page.evaluate).
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
  window.__npc = {};
  window.Engine = {
    browserToken: 'token-testowy',
    dead: false,
    allInit: true,
    lock: {
      list: [],
      add(n) { if (this.list.indexOf(n) === -1) this.list.push(n); },
      remove(n) { const i = this.list.indexOf(n); if (i !== -1) this.list.splice(i, 1); },
      check: () => false,
    },
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
    npcs: { check: () => window.__npc },
    battle: {},
    interface: {},
    stopped: false,
    stop() { this.stopped = true; },
  };

  // ---- atrapa Engine.captcha + serwera ----
  const usun = (sel) => { const n = document.querySelector(sel); if (n) n.remove(); };
  const blok = (cls, w, h, html) => {
    const d = document.createElement('div');
    d.className = cls;
    d.style.cssText = 'position:fixed;left:10px;top:10px;width:' + w + 'px;height:' + h + 'px';
    d.innerHTML = html;
    document.body.appendChild(d);
    return d;
  };
  const captcha = {
    close() { window.Engine.lock.remove('captcha'); usun('.captcha-window'); },
    showPreCaptcha(p) {
      blok('pre-captcha show', 300, 60, '<div class="captcha-pre-info">Zagadka za <span class="captcha-pre-info__time">'
        + p.autostart_time_left + '</span>s<div class="captcha-pre-info__button"><div class="button">Rozwiąż teraz</div></div></div>');
    },
    openCaptcha(p) {
      usun('.pre-captcha');
      this.close();
      const opcje = p.content.question.options.map((o) => '<div class="button"><span class="label">' + o + '</span></div>').join('');
      blok('captcha-window', 420, 320, '<div class="captcha"><div class="captcha__question">'
        + p.content.question.text + '</div><div class="captcha__buttons">' + opcje
        + '</div><div class="captcha__confirm"><div class="button"><span class="label">Potwierdzam</span></div></div>'
        + '<div class="captcha__triesleft">Liczba pozostałych prób: ' + p.triesLeft + '</div></div>');
      window.Engine.lock.add('captcha');
    },
    captchaDone() { this.close(); },
    blockWithCounter(p) {
      this.close();
      blok('mAlert', 300, 120, 'Błędna odpowiedź. Blokada: <span id="captcha-timer">' + p.blockade_time_left + '</span>');
      window.Engine.stop();
    },
    updateData(p) {
      if (p.content) return this.openCaptcha(p);
      if (p.autostart_time_left !== undefined) return this.showPreCaptcha(p);
      if (p.done) return this.captchaDone(p);
      if (p.blockade_time_left !== undefined) return this.blockWithCounter(p);
      throw new Error('[atrapa] brak akcji dla pakietu');
    },
  };
  window.Engine.captcha = captcha;

  window.__serwer = {
    proby: 0,
    poprawna: null,
    odpowiedzi: [],
    zapowiedz(sek) { captcha.updateData({ autostart_time_left: sek }); },
    otworz(proby) {
      this.proby = proby || 3;
      this.poprawna = '0,2';
      captcha.updateData({
        content: { image: null, question: { text: 'Zagadka testowa', options: ['A', 'B', 'C', 'D'] } },
        triesLeft: this.proby,
      });
    },
    // odpowiedz "gracza": 'ok' | 'zle' | 'blokada'
    odpowiedz(answerId) {
      this.odpowiedzi.push(answerId);
      if (answerId === this.poprawna) { captcha.updateData({ done: true }); return 'ok'; }
      this.proby--;
      if (this.proby <= 0) { captcha.updateData({ blockade_time_left: 60 }); return 'blokada'; }
      captcha.updateData({
        content: { image: null, question: { text: 'Zagadka testowa', options: ['A', 'B', 'C', 'D'] } },
        triesLeft: this.proby,
      });
      return 'zle';
    },
  };
}

// Uruchamia skrypt na swiezej stronie. `zmianySkryptu` - podmiany tekstu
// skryptu tylko na czas testu (np. krotszy czas przypomnien).
async function uruchom(opcje) {
  const o = Object.assign({ magazyn: {}, zmianySkryptu: [] }, opcje || {});
  let skrypt = fs.readFileSync(PLIK, 'utf8');
  for (const [z, na] of o.zmianySkryptu) {
    if (skrypt.indexOf(z) === -1) throw new Error('podmiana nie trafila: ' + z);
    skrypt = skrypt.replace(z, na);
  }
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.route('**/*', (r) => (r.request().url().startsWith('http://hh.test/')
    ? r.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head></head><body></body></html>' })
    : r.abort()));
  const bledy = [];
  const logi = [];
  page.on('pageerror', (e) => bledy.push(e.message));
  page.on('console', (m) => {
    const t = m.text();
    if (t.indexOf('[HH] ') === 0) logi.push(t.slice(5));
    if (/Wyjątek/.test(t)) bledy.push(t);
  });
  await page.goto('http://hh.test/');
  await page.evaluate(przygotujStrone, o.magazyn);
  await page.addScriptTag({ content: skrypt });

  const stan = () => page.evaluate(() => ({
    badge: (document.querySelector('#hh-panel .hh-pill span') || {}).textContent || null,
    ruchy: window.__ruchy,
    stopy: window.__stopy,
    pingi: window.__pingi.slice(),
    magazyn: JSON.parse(window.GM_getValue('HH_V3') || '{}'),
  }));
  return { browser, page, stan, bledy, logi };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Magazyn: bot w GO na trasie Przewodnika (mapa 8), AUTO_RESUME startuje petle.
const MAGAZYN_GO = {
  HH_V3: JSON.stringify({
    state: 'GO', heroKey: 'przewodnik', routeIndex: 0,
    webhook: 'https://discord.com/api/webhooks/1/test-token',
  }),
};

function raport() {
  const wyniki = [];
  return {
    sprawdz(nazwa, ok, szczegoly) {
      wyniki.push(!!ok);
      console.log((ok ? 'PASS ' : 'FAIL ') + nazwa + (szczegoly ? '  [' + szczegoly + ']' : ''));
    },
    koniec() {
      const zle = wyniki.filter((w) => !w).length;
      console.log('\n' + (wyniki.length - zle) + '/' + wyniki.length + ' PASS');
      return zle;
    },
  };
}

module.exports = { przygotujStrone, uruchom, sleep, MAGAZYN_GO, raport };
