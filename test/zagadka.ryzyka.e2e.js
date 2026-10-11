// Ryzyka znalezione w przegladzie kodu - kazde jako osobny scenariusz:
//  A) badge ZAGADKA nadpisywany przez UI.build() (przycisk "Stan", wybor herosa)
//  B) komenda z czatu (zap!) wykonywana w trakcie zagadki - CHAT dziala poza tick()
//  C) dluga zagadka zjada POINT_LIMIT_MS - bot pomija resp bez sprawdzenia
//  D) dluga zagadka zjada odliczanie "Atak za" - bot atakuje zaraz po zagadce
// Uruchomienie: node zagadka.ryzyka.e2e.js
const { uruchom, sleep, MAGAZYN_GO, raport } = require('./fixture');

const R = raport();
async function scenariusz(nazwa, opcje, fn) {
  console.log('\n== ' + nazwa);
  const s = await uruchom(opcje);
  try {
    await fn(s);
    R.sprawdz(nazwa + ': brak wyjątków', s.bledy.length === 0, s.bledy.join(' | '));
  } finally {
    await s.browser.close();
  }
}
const sekundy = (t) => {
  const m = /^(\d+):(\d+)$/.exec(t || '');
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  const s = /^(\d+)s$/.exec(t || '');
  return s ? Number(s[1]) : NaN;
};

(async () => {
  await scenariusz('A) badge po UI.build w trakcie zagadki', { magazyn: MAGAZYN_GO }, async ({ page, stan }) => {
    await sleep(3000);
    await page.evaluate(() => window.__serwer.otworz(3));
    await sleep(1500);
    await page.evaluate(() => document.querySelector('#hh-panel [data-akcja="stan"]').click());
    await sleep(1500);
    const s = await stan();
    R.sprawdz('po "Stan" badge dalej ZAGADKA', s.badge === 'ZAGADKA', 'badge=' + s.badge);
  });

  await scenariusz('B) komenda z czatu w trakcie zagadki', { magazyn: MAGAZYN_GO }, async ({ page, logi }) => {
    await sleep(3000);
    await page.evaluate(() => window.__serwer.otworz(3));
    await sleep(1500);
    await page.evaluate(() => {
      window.__menu = 0;
      const w = document.createElement('div');
      w.className = 'chat-CLAN-message';
      w.innerHTML = '<span class="information-part"><span class="author-section">Kolega:</span></span>'
        + '<span class="message-part"><span class="message-section">zap!</span></span>';
      w.querySelector('.author-section').addEventListener('contextmenu', () => { window.__menu++; });
      document.body.appendChild(w);
    });
    await sleep(2500);
    const menu = await page.evaluate(() => window.__menu);
    R.sprawdz('zap! NIE wykonany w trakcie zagadki', menu === 0, 'contextmenu=' + menu);
    R.sprawdz('log mówi, że komenda pominięta', logi.some((l) => /pomijam komendę/.test(l)), logi.slice(-3).join(' | '));
  });

  await scenariusz('C) długa zagadka a limit czasu respu', {
    magazyn: MAGAZYN_GO,
    zmianySkryptu: [['POINT_LIMIT_MS: 60000,', 'POINT_LIMIT_MS: 8000,']],
  }, async ({ page, stan, logi }) => {
    await sleep(3000);                                   // punkt respu juz liczy czas
    await page.evaluate(() => window.__serwer.otworz(3));
    await sleep(10000);                                  // zagadka dluzsza niz limit punktu
    await page.evaluate(() => window.__serwer.odpowiedz(window.__serwer.poprawna));
    await sleep(3500);
    const s = await stan();
    R.sprawdz('resp NIE pominięty po zagadce', !logi.some((l) => /Timeout respu/.test(l)) && (s.magazyn.spawnIndex || 0) === 0,
      'spawnIndex=' + s.magazyn.spawnIndex + ' ' + logi.filter((l) => /Timeout respu/.test(l)).join(' | '));
    await sleep(6000);
    R.sprawdz('limit punktu dalej działa (czas bez pauzy)', logi.some((l) => /Timeout respu/.test(l)));
  });

  await scenariusz('D) długa zagadka a odliczanie do ataku', { magazyn: MAGAZYN_GO }, async ({ page, stan }) => {
    await sleep(2000);
    await page.evaluate(() => {
      window.__npc = { 77: { d: { id: 77, nick: 'Zły Przewodnik', type: 2, x: 12, y: 10 } } };
    });
    await sleep(3500);
    const przed = await page.evaluate(() => document.querySelector('#hh-t-atak').textContent);
    const t0 = Date.now();
    await page.evaluate(() => window.__serwer.otworz(3));
    await sleep(10000);
    await page.evaluate(() => window.__serwer.odpowiedz(window.__serwer.poprawna));
    await sleep(3500);
    const po = await page.evaluate(() => document.querySelector('#hh-t-atak').textContent);
    const minelo = Math.round((Date.now() - t0) / 1000);
    const ubylo = sekundy(przed) - sekundy(po);
    const s = await stan();
    R.sprawdz('stan FOUND zachowany', s.badge === 'FOUND');
    R.sprawdz('odliczanie nie biegło w pauzie (ubyło ~ czas bez zagadki)', ubylo <= minelo - 9,
      'przed=' + przed + ' po=' + po + ' ubyło=' + ubylo + ' s, minęło=' + minelo + ' s');
  });

  // E/F: komenda przyszla PRZED zagadka, ale jej ponowienia (setTimeout)
  // trafiaja juz w trwajaca zagadke - blokada w CHAT.handle ich nie obejmuje.
  const wiadomosc = (page, tresc) => page.evaluate((t) => {
    const w = document.createElement('div');
    w.className = 'chat-CLAN-message';
    w.innerHTML = '<span class="information-part"><span class="author-section">Kolega:</span></span>'
      + '<span class="message-part"><span class="message-section">' + t + '</span></span>';
    document.body.appendChild(w);
  }, tresc);

  await scenariusz('E) ponowienia "zap!" w trakcie zagadki', { magazyn: MAGAZYN_GO }, async ({ page }) => {
    await sleep(3000);
    await wiadomosc(page, 'zap!');                       // menu jeszcze nie ma - zap! ponawia co 350 ms
    await sleep(100);
    await page.evaluate(() => window.__serwer.otworz(3));
    await sleep(300);
    await page.evaluate(() => {
      window.__klikZapros = 0;
      const m = document.createElement('div');
      m.className = 'popup-menu show';
      m.innerHTML = '<div class="menu-item">Zaproś do grupy</div>';
      m.firstChild.addEventListener('click', () => { window.__klikZapros++; });
      document.body.appendChild(m);
    });
    await sleep(2500);
    const n = await page.evaluate(() => window.__klikZapros);
    R.sprawdz('zap!: zero kliknięć "Zaproś do grupy" w trakcie zagadki', n === 0, 'klikniecia=' + n);
  });

  await scenariusz('F) ponowienia "oddaj d!" w trakcie zagadki', { magazyn: MAGAZYN_GO }, async ({ page }) => {
    await sleep(3000);
    await page.evaluate(() => { window.__party = 0; window.Engine.interface.clickParty = () => { window.__party++; }; });
    await wiadomosc(page, 'oddaj d!');                   // okna druzyny nie ma - ponowienie za 1,5 s
    await sleep(200);
    await page.evaluate(() => window.__serwer.otworz(3));
    await sleep(500);
    await page.evaluate(() => {
      window.__klikLider = 0;
      const o = document.createElement('div');
      o.className = 'party-window';
      o.innerHTML = '<div class="party-member"><span class="nickname-text">Kolega</span>'
        + '<div class="give-lead-party"></div></div>';
      o.querySelector('.give-lead-party').addEventListener('click', () => { window.__klikLider++; });
      document.body.appendChild(o);
    });
    await sleep(5000);
    const n = await page.evaluate(() => window.__klikLider);
    R.sprawdz('oddaj d!: zero kliknięć przekazania dowództwa w trakcie zagadki', n === 0, 'klikniecia=' + n);
  });

  await scenariusz('G) potwierdzenie dowództwa w trakcie zagadki', { magazyn: MAGAZYN_GO }, async ({ page }) => {
    await sleep(3000);
    await page.evaluate(() => {
      const o = document.createElement('div');
      o.className = 'party-window';
      o.innerHTML = '<div class="party-member"><span class="nickname-text">Kolega</span>'
        + '<div class="give-lead-party"></div></div>';
      document.body.appendChild(o);
    });
    await wiadomosc(page, 'oddaj d!');                   // klik od razu, potw() czeka na okienko co 400 ms
    await sleep(150);
    await page.evaluate(() => window.__serwer.otworz(3));
    await sleep(300);
    await page.evaluate(() => {
      window.__klikTak = 0;
      const a = document.createElement('div');
      a.className = 'mAlert';
      a.innerHTML = 'Czy na pewno chcesz przekazać dowództwo? <div class="alert-accept-hotkey">Tak</div>';
      a.querySelector('.alert-accept-hotkey').addEventListener('click', () => { window.__klikTak++; });
      document.body.appendChild(a);
    });
    await sleep(3500);
    const n = await page.evaluate(() => window.__klikTak);
    R.sprawdz('oddaj d!: "Tak" NIE kliknięte w trakcie zagadki', n === 0, 'klikniecia=' + n);
  });

  process.exit(R.koniec() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
