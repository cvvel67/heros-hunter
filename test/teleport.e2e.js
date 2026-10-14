// Zwoj teleportu do bazy (Opek: "Zwój teleportacji do Andarum", 14.10).
//  A) bot w Ithanie (poza trasa) ze zwojem w ekwipunku -> jedno uzycie,
//     przeniesienie do Andarum Ilami, start obchodu od pierwszego respu
//  B) brak zwoju -> komunikat w logu, nic nie zuzyte, bez wyjatkow
// Uruchomienie: node test/teleport.e2e.js
const { uruchom, sleep, raport } = require('./fixture');

const R = raport();
const MAGAZYN_OPEK = { HH_V3: JSON.stringify({ state: 'GO', heroKey: 'opetany-paladyn', routeIndex: 0 }) };

async function scenariusz(nazwa, fn) {
  console.log('\n== ' + nazwa);
  const s = await uruchom({ magazyn: MAGAZYN_OPEK });
  try {
    await fn(s);
    R.sprawdz(nazwa + ': brak wyjątków', s.bledy.length === 0, s.bledy.join(' | '));
  } finally {
    await s.browser.close();
  }
}

// Ithan, a w worku zwoj. Dwuklik = teleport do Andarum Ilami (180)
// z jej prawdziwymi przejsciami (odczyt z gry 14.10).
function przygotujIthan(zeZwojem) {
  const E = window.Engine;
  E.map.d = { id: 1, name: 'Ithan' };
  // Ithan jak w grze: przejscie do Zniszczonego Opactwa (42,99).
  E.map.gateways.getDrawableItems = () => [{ d: { id: 8, x: 42, y: 99 }, tip: ['Zniszczone Opactwo'] }];
  window.__uzycia = 0;
  window.TIPS = { allTips: { tp1: '<div class="item-name">Zwój teleportacji do Andarum</div>' } };
  if (!zeZwojem) return;
  const el = document.createElement('div');
  el.className = 'inventory-item item-tpl-90001';
  el.setAttribute('tip-id', 'tp1');
  el.innerHTML = '<span class="amount">9</span>';
  // Jak w grze: prawy klik na przedmiocie otwiera jego menu kontekstowe.
  el.addEventListener('contextmenu', function () {
    const m = document.createElement('div');
    m.className = 'popup-menu show menu-przedmiotu';
    m.textContent = 'Użyj Przenieś';
    document.body.appendChild(m);
  });
  el.addEventListener('dblclick', function () {
    window.__uzycia++;
    el.querySelector('.amount').textContent = String(9 - window.__uzycia);
    E.map.d = { id: 180, name: 'Andarum Ilami' };
    E.hero.d.x = 23; E.hero.d.y = 48;
    const gw = [[1387, 'Skały Mroźnych Śpiewów', 0, 5], [6628, 'Zdradzieckie Przejście p.1', 3, 39],
      [6608, 'Świątynia Andarum', 48, 14]];
    E.map.gateways.getDrawableItems = () => gw.map((g) => ({ d: { id: g[0], x: g[2], y: g[3] }, tip: [g[1]] }));
  });
  document.body.appendChild(el);
}

(async () => {
  await scenariusz('A) Ithan + zwoj -> Andarum i start obchodu', async ({ page, stan, logi }) => {
    await page.evaluate(przygotujIthan, true);
    await sleep(10000);
    const uzycia = await page.evaluate(() => window.__uzycia);
    const mapa = await page.evaluate(() => window.Engine.map.d.name);
    R.sprawdz('zwoj uzyty dokladnie raz', uzycia === 1, 'uzycia=' + uzycia);
    R.sprawdz('w logu: używam zwoju', logi.some((l) => /Używam "Zwój teleportacji do Andarum"/.test(l)), logi.slice(-4).join(' / '));
    R.sprawdz('jestesmy w Andarum Ilami', mapa === 'Andarum Ilami', 'mapa=' + mapa);
    R.sprawdz('po uzyciu nie zostaje menu przedmiotu', (await page.evaluate(() => document.querySelectorAll('.menu-przedmiotu').length)) === 0);
    R.sprawdz('bez Zakonnika', !logi.some((l) => /Zakonnika/.test(l)), logi.filter((l) => /Zakonnik/.test(l)).join(' / '));
    await sleep(4000);
    const s = await stan();
    R.sprawdz('obchod od Andarum (krok 1, stan SCAN/GO)', (s.badge === 'SCAN' || s.badge === 'GO') && (s.magazyn.routeIndex || 0) === 0,
      'badge=' + s.badge + ' routeIndex=' + s.magazyn.routeIndex);
    R.sprawdz('nadal tylko jedno uzycie', (await page.evaluate(() => window.__uzycia)) === 1);
  });

  await scenariusz('B) Ithan bez zwoju', async ({ page, stan, logi }) => {
    await page.evaluate(przygotujIthan, false);
    await sleep(10000);
    R.sprawdz('w logu: nie widzę zwoju', logi.some((l) => /Nie widzę "Zwój teleportacji do Andarum"/.test(l)), logi.slice(-4).join(' / '));
    R.sprawdz('komunikat raz, nie co takt', logi.filter((l) => /Nie widzę "Zwój teleportacji/.test(l)).length === 1);
  });

  await scenariusz('C) przejscie miedzy mapami (mapa chwilowo nieznana) - bez zwoju', async ({ page, stan, logi }) => {
    await page.evaluate(przygotujIthan, true);
    await sleep(10000);  // 5 s potwierdzenia mapy + teleport do Andarum (1. uzycie)
    const po1 = await page.evaluate(() => window.__uzycia);
    // Jak w grze przy zmianie mapy: przez chwile brak danych mapy.
    await page.evaluate(() => { const E = window.Engine; window.__zapas = E.map.d; E.map.d = { id: null, name: '' }; });
    await sleep(3000);
    await page.evaluate(() => { window.Engine.map.d = window.__zapas; });
    await sleep(2000);
    const po2 = await page.evaluate(() => window.__uzycia);
    R.sprawdz('pierwsze uzycie przy starcie z Ithanu', po1 === 1, 'uzycia=' + po1);
    R.sprawdz('w trakcie przejscia zwoj NIE uzyty ponownie', po2 === 1, 'uzycia=' + po2 + ' / ' + logi.filter((l) => /Używam/.test(l)).join(' / '));
  });

  await scenariusz('D) chwilowo zla mapa przy przejsciu ("Zapomniany Szlak") - bez zwoju', async ({ page, logi }) => {
    await page.evaluate(przygotujIthan, true);
    await sleep(10000);  // zwoj -> Andarum (1. uzycie)
    await sleep(15000);  // > 20 s od uzycia - jak na zywo, kilka petli pozniej
    // Jak na zywo 14.10: przy przejsciu przez brame gra na chwile podaje mape startu sesji.
    await page.evaluate(() => { const E = window.Engine; window.__zapas = E.map.d; E.map.d = { id: 150, name: 'Zapomniany Szlak' }; });
    await sleep(2500);   // 2-3 takty bota, krocej niz 5 s ochrony
    await page.evaluate(() => { window.Engine.map.d = window.__zapas; });
    await sleep(7000);
    const u = await page.evaluate(() => window.__uzycia);
    const graf150 = await page.evaluate(() => (JSON.parse(window.GM_getValue('HH_V3') || '{}').graph || {})['150'] || []);
    R.sprawdz('graf mapy 150 bez przejsc z Andarum', !graf150.some((g) => Number(g.to) === 6608), JSON.stringify(graf150).slice(0, 120));
    R.sprawdz('zwoj NIE uzyty przez chwilowo zla mape', u === 1, 'uzycia=' + u + ' / ' + logi.filter((l) => /Używam/.test(l)).join(' / '));
  });

  await scenariusz('E) Ithan bez zwoju - pieszo do Andarum (droga gracza 14.10)', async ({ page, logi }) => {
    await page.evaluate(przygotujIthan, false);
    await sleep(12000);
    const trasa = logi.find((l) => /^Trasa do Andarum Ilami:/.test(l)) || '';
    R.sprawdz('pieszo: Opactwo > Uroczysko > Szlak > Jaskinia 1 > Jaskinia 2 > Andarum', /8 → 38 → 150 → 6535 → 6536 → 180/.test(trasa), trasa || logi.slice(-4).join(' / '));
  });

  await scenariusz('F) gra chwilowo bez przejsc na mapie - znana droga zostaje', async ({ page, logi }) => {
    await page.evaluate(przygotujIthan, false);
    await page.evaluate(() => { window.Engine.map.gateways.getDrawableItems = () => []; });
    await sleep(12000);
    const trasa = logi.find((l) => /^Trasa do Andarum Ilami:/.test(l)) || '';
    R.sprawdz('pusta lista bram nie kasuje drogi z CONFIG', /8 → 38 → 150 → 6535 → 6536 → 180/.test(trasa), trasa || logi.slice(-3).join(' / '));
  });

  process.exit(R.koniec() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
