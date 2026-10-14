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
const HEROS = { 77: { d: { id: 77, nick: 'Zły Przewodnik', type: 2, x: 12, y: 10, lvl: 75 } } };

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

  await scenariusz('G) Discord: tylko Znaleziono (@everyone) i Zabito (bez pingu, miasto bazy)', async ({ page, stan, logi }) => {
    await znajdz(page, stan);
    await page.evaluate(() => { window.__npc = {}; });
    await sleep(5000);
    const ciala = await page.evaluate(() => window.__ciala);
    const tytuly = ciala.map((c) => c.embeds[0].title);
    R.sprawdz('na Discord poszly dokladnie 2 wiadomosci', tytuly.length === 2, JSON.stringify(tytuly));
    const zn = ciala.find((c) => /^Znaleziono /.test(c.embeds[0].title));
    const zb = ciala.find((c) => /^Zabito /.test(c.embeds[0].title));
    R.sprawdz('Znaleziono: @everyone + allowed_mentions', !!zn && zn.content === '@everyone' && zn.allowed_mentions && zn.allowed_mentions.parse.indexOf('everyone') !== -1, JSON.stringify(zn && { content: zn.content, am: zn.allowed_mentions }));
    R.sprawdz('Zabito: bez pingu', !!zb && !zb.content && !zb.allowed_mentions, JSON.stringify(zb && { content: zb.content }));
    const pola = (c) => (c ? c.embeds[0].fields : []).map((p) => p.name + '=' + p.value);
    R.sprawdz('Znaleziono: tytul i pola Nazwa/Lokalizacja/Poziom', !!zn && zn.embeds[0].title === 'Znaleziono Herosa!'
      && pola(zn).slice(0, 3).join(' | ') === 'Nazwa=Zły Przewodnik | Lokalizacja=Zniszczone Opactwo (12, 10) | Poziom=75 lvl', pola(zn).join(' | '));
    R.sprawdz('Znaleziono: linijka do skopiowania', !!zn && pola(zn)[3] === 'Informacja do skopiowania=```Znaleziono Herosa! Zły Przewodnik (75lvl) na mapie Zniszczone Opactwo (12, 10)```', pola(zn)[3]);
    R.sprawdz('Znaleziono: obrazek herosa i stopka Swiat | Mapa', !!zn && /mnich-zly2.gif$/.test((zn.embeds[0].thumbnail || {}).url || '') && / | Zniszczone Opactwo$/.test(zn.embeds[0].footer.text), JSON.stringify(zn && { t: zn.embeds[0].thumbnail, f: zn.embeds[0].footer }));
    R.sprawdz('Zabito: tytul, pola i Resp od', !!zb && zb.embeds[0].title === 'Zabito Herosa!' && /^Nazwa=Zły Przewodnik | Lokalizacja=Zniszczone Opactwo | Zabity o=dd:dd | Resp od=dd:dd$/.test(pola(zb).join(' | ')), pola(zb).join(' | '));
    R.sprawdz('Zabito: obrazek herosa', !!zb && /mnich-zly2.gif$/.test((zb.embeds[0].thumbnail || {}).url || ''), JSON.stringify(zb && zb.embeds[0].thumbnail));
    R.sprawdz('Zabito: "Wracam do Ithan" (baza Przewodnika)', !!zb && zb.embeds[0].description === 'Wracam do Ithan i czekam na respawn.', zb && zb.embeds[0].description);
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
