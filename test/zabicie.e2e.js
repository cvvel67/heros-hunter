// Zasada (ustalona 11.10):
//   heros znika                       -> zbity
//   bot ginie przy herosie (FOUND)    -> zbity
//   bot ginie z dala od herosa (trasa) -> NIE zbity, zwykly powrot
// "Zbity" = zapisane zabicie (resp od tej chwili) i powrot z wylogowaniem
// (homeReason 'poKillu').
//  A) szybka walka - gra rozstrzyga ja bez okna walki, bot nie widzi
//     Engine.battle.w_amount > 0 (zgloszone 11.10 na Zlodzieju: bot uznal
//     to za ucieczke i wrocil do petli)
//  B) heros znika, a bot jest juz na innej mapie
//  C) zwykla walka (okno walki widoczne) - dotychczasowa sciezka
//  D) ktos zabija bota przy herosie, gra przenosi go do Ithanu
//  E) bot zabity przy herosie, chwile jeszcze na tej samej mapie
//  F) bot ginie w trasie, herosa nie widzial - to nie zabicie herosa
// Czasy 20 s / 10 s sa w tescie skrocone do 2 s (zmianySkryptu).
// Uruchomienie: node test/zabicie.e2e.js
const { uruchom, sleep, MAGAZYN_GO, raport } = require('./fixture');

const R = raport();
const KROTKO = [
  ['if (now - this.goneSince < 20000) return;', 'if (now - this.goneSince < 2000) return;'],
  ['if (now - this.goneSince < 10000) return;', 'if (now - this.goneSince < 2000) return;'],
];
const HEROS = { 77: { d: { id: 77, nick: 'Zły Przewodnik', type: 2, x: 12, y: 10 } } };

async function scenariusz(nazwa, fn) {
  console.log('\n== ' + nazwa);
  const s = await uruchom({ magazyn: MAGAZYN_GO, zmianySkryptu: KROTKO });
  try {
    await fn(s);
    R.sprawdz(nazwa + ': brak wyjątków', s.bledy.length === 0, s.bledy.join(' | '));
  } finally {
    await s.browser.close();
  }
}

async function znajdz(page, stan) {
  await sleep(2000);
  await page.evaluate((h) => { window.__npc = h; }, HEROS);
  await sleep(2500);
  const s = await stan();
  R.sprawdz('heros znaleziony (FOUND)', s.badge === 'FOUND', 'badge=' + s.badge);
}

function zbity(s, logi) {
  R.sprawdz('zabicie zapisane (zabicia.przewodnik)', !!(s.magazyn.zabicia && s.magazyn.zabicia.przewodnik),
    JSON.stringify(s.magazyn.zabicia));
  R.sprawdz('powrot na wylogowanie (homeReason poKillu)', s.magazyn.homeReason === 'poKillu', 'homeReason=' + s.magazyn.homeReason);
  R.sprawdz('nie szuka dalej (stan != GO/SCAN)', s.badge !== 'GO' && s.badge !== 'SCAN', 'badge=' + s.badge);
  R.sprawdz('w logu: ZABITY', logi.some((l) => /ZABITY/.test(l)), logi.slice(-4).join(' / '));
}

const smierc = (nowaMapa) => {
  const E = window.Engine;
  E.dead = true;
  E.hero.d.hp = 0;
  window.__npc = {};
  if (nowaMapa) E.map.d = { id: 1, name: 'Ithan' };
};

(async () => {
  await scenariusz('A) szybka walka - heros znika bez okna walki', async ({ page, stan, logi }) => {
    await znajdz(page, stan);
    await page.evaluate(() => { window.__npc = {}; });
    await sleep(5000);
    zbity(await stan(), logi);
  });

  await scenariusz('B) heros znika, bot juz na innej mapie', async ({ page, stan, logi }) => {
    await znajdz(page, stan);
    await page.evaluate(() => { window.__npc = {}; window.Engine.map.d = { id: 9, name: 'Inna mapa' }; });
    await sleep(5000);
    zbity(await stan(), logi);
  });

  await scenariusz('C) zwykla walka (okno walki widoczne)', async ({ page, stan, logi }) => {
    await znajdz(page, stan);
    await page.evaluate(() => { window.Engine.battle.w_amount = 2; });
    await sleep(2000);
    await page.evaluate(() => { window.__npc = {}; });
    await sleep(1500);
    await page.evaluate(() => { window.Engine.battle.w_amount = 0; });
    await sleep(4000);
    zbity(await stan(), logi);
  });

  await scenariusz('D) ktos zabija bota przy herosie, bot w Ithanie', async ({ page, stan, logi }) => {
    await znajdz(page, stan);
    await page.evaluate(smierc, true);
    await sleep(3000);
    const s = await stan();
    zbity(s, logi);
    R.sprawdz('w logu: zginela przy herosie', logi.some((l) => /zginęła przy/.test(l)), logi.slice(-4).join(' / '));
  });

  await scenariusz('E) bot zabity przy herosie, jeszcze na jego mapie', async ({ page, stan, logi }) => {
    await znajdz(page, stan);
    await page.evaluate(smierc, false);
    await sleep(3000);
    zbity(await stan(), logi);
  });

  await scenariusz('F) bot ginie w trasie, z dala od herosa', async ({ page, stan, logi }) => {
    await sleep(2500);
    await page.evaluate(smierc, true);
    await sleep(3000);
    const s = await stan();
    R.sprawdz('brak zapisanego zabicia herosa', !(s.magazyn.zabicia && s.magazyn.zabicia.przewodnik), JSON.stringify(s.magazyn.zabicia));
    R.sprawdz('powrot jako smierc (homeReason poSmierci)', s.magazyn.homeReason === 'poSmierci', 'homeReason=' + s.magazyn.homeReason);
    R.sprawdz('w logu: brak ZABITY', !logi.some((l) => /ZABITY/.test(l)), logi.slice(-4).join(' / '));
  });

  process.exit(R.koniec() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
