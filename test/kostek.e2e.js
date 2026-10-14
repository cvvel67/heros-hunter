// Koniec petli Kostka (Piekielny Kosciej, 14.10): po ostatnim respie
// w Slepym Wyrobisku bot wraca do Andarum zwojem, a bez zwoju pieszo.
//  A) zwoj w worku -> jedno uzycie, Andarum, nowa petla
//  B) bez zwoju -> pieszo: Kopalnia > Labirynt > Zdradzieckie p.2 > p.1 > Andarum
// Graf map Kostka (test/graf-kostek.json) jak po pierwszej petli w grze.
// Uruchomienie: node test/kostek.e2e.js
const path = require('node:path');
const fs = require('node:fs');
const { uruchom, sleep, raport } = require('./fixture');

const R = raport();
const GRAF = JSON.parse(fs.readFileSync(path.join(__dirname, 'graf-kostek.json'), 'utf8'));
const OSTATNI = 14; // indeks kroku "Ślepe Wyrobisko" w trasie Kostka
// Nazwy map -> numery, ktore bot zapamietuje w grze przy pierwszej petli
// (MAPS.rememberAlias). Klucz jak w MAPS.plain().
const plain = (t) => String(t || '').toLowerCase()
  .replace(/ą/g, 'a').replace(/ć/g, 'c').replace(/ę/g, 'e').replace(/ł/g, 'l').replace(/ń/g, 'n')
  .replace(/ó/g, 'o').replace(/ś/g, 's').replace(/ź/g, 'z').replace(/ż/g, 'z')
  .replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const ALIAS = {};
for (const [n, id] of [['Andarum Ilami', 180], ['Zdradzieckie Przejście p.1', 6628], ['Zdradzieckie Przejście p.2', 6629],
  ['Wylęgarnia Choukkerów p.1', 6634], ['Wylęgarnia Choukkerów p.2', 6635], ['Wylęgarnia Choukkerów p.3', 6636],
  ['Labirynt Margorii', 6771], ['Kopalnia Margorii', 6772], ['Margoria', 6773], ['Szyb Zdrajców', 6775],
  ['Ślepe Wyrobisko', 6776]]) ALIAS[plain(n)] = id;

async function scenariusz(nazwa, zeZwojem, fn) {
  console.log('\n== ' + nazwa);
  const s = await uruchom({
    magazyn: {
      HH_V3: JSON.stringify({
        state: 'SCAN', heroKey: 'piekielny-kosciej', routeIndex: OSTATNI, spawnIndex: 4, graph: GRAF, alias: ALIAS,
      }),
    },
  });
  try {
    await s.page.evaluate((zw) => {
      const E = window.Engine;
      E.map.d = { id: 6776, name: 'Ślepe Wyrobisko' };
      // Postac od razu staje tam, dokad bot ja wysyla - respy schodza w sekundy.
      E.hero.autoGoTo = (c) => { window.__ruchy++; if (c) { E.hero.d.x = c.x; E.hero.d.y = c.y; E.hero.rx = c.x; E.hero.ry = c.y; } };
      E.hero.getCords = () => E.hero.d.x + ',' + E.hero.d.y;
      window.__uzycia = 0;
      window.TIPS = { allTips: { tp1: '<div class="item-name">Zwój teleportacji do Andarum</div>' } };
      if (!zw) return;
      const el = document.createElement('div');
      el.className = 'inventory-item item-tpl-90001';
      el.setAttribute('tip-id', 'tp1');
      el.addEventListener('dblclick', () => { window.__uzycia++; E.map.d = { id: 180, name: 'Andarum Ilami' }; });
      document.body.appendChild(el);
    }, zeZwojem);
    await fn(s);
    R.sprawdz(nazwa + ': brak wyjątków', s.bledy.length === 0, s.bledy.join(' | '));
  } finally {
    await s.browser.close();
  }
}

(async () => {
  await scenariusz('A) koniec petli ze zwojem', true, async ({ page, logi }) => {
    await sleep(20000);
    const u = await page.evaluate(() => window.__uzycia);
    R.sprawdz('koniec trasy -> powrot do bazy', logi.some((l) => /obejdzie - wracam do Andarum Ilami/.test(l)), logi.slice(-5).join(' / '));
    R.sprawdz('zwoj uzyty dokladnie raz', u === 1, 'uzycia=' + u);
    R.sprawdz('w logu: powrót zwojem', logi.some((l) => /Używam "Zwój teleportacji do Andarum" \(powrót do Andarum Ilami\)/.test(l)), logi.filter((l) => /Używam/.test(l)).join(' / '));
    R.sprawdz('nowa petla od Andarum', logi.some((l) => /lecę od nowa/.test(l)), logi.slice(-4).join(' / '));
  });

  await scenariusz('B) koniec petli bez zwoju - pieszo', false, async ({ logi }) => {
    await sleep(22000);
    const trasa = logi.find((l) => /^Trasa do 180:/.test(l)) || '';
    R.sprawdz('pieszo: Kopalnia > Labirynt > Zdradzieckie p.2 > p.1 > Andarum', /6772 → 6771 → 6629 → 6628 → 180/.test(trasa), trasa || logi.slice(-5).join(' / '));
    R.sprawdz('bez Zakonnika', !logi.some((l) => /Zakonnika/.test(l)), logi.filter((l) => /Zakonnik/.test(l)).join(' / '));
  });

  process.exit(R.koniec() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
