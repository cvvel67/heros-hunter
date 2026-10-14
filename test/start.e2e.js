// Start w trakcie obchodu (po Stop albo odswiezeniu strony) nie moze pominac
// biezacego respu przez przeterminowany licznik punktu (pointSince).
// Zgloszone 14.10 na zywo: "Timeout respu 61,35 - idę dalej" zaraz po Starcie.
// Uruchomienie: node test/start.e2e.js
const { uruchom, sleep, raport } = require('./fixture');

const R = raport();

(async () => {
  console.log('\n== wznowienie skanowania z licznikiem sprzed 10 min');
  const s = await uruchom({
    magazyn: {
      HH_V3: JSON.stringify({
        state: 'SCAN', heroKey: 'przewodnik', routeIndex: 0, spawnIndex: 0,
        pointSince: Date.now() - 10 * 60000,
      }),
    },
  });
  try {
    await sleep(5000);
    const st = await s.stan();
    R.sprawdz('bez "Timeout respu" po Starcie', !s.logi.some((l) => /Timeout respu/.test(l)), s.logi.slice(-4).join(' / '));
    R.sprawdz('ten sam resp dalej w toku (spawnIndex 0)', (st.magazyn.spawnIndex || 0) === 0, 'spawnIndex=' + st.magazyn.spawnIndex);
    R.sprawdz('licznik punktu liczony od nowa', st.magazyn.pointSince > Date.now() - 60000, 'pointSince=' + st.magazyn.pointSince);
    R.sprawdz('brak wyjątków', s.bledy.length === 0, s.bledy.join(' | '));
  } finally {
    await s.browser.close();
  }
  process.exit(R.koniec() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
