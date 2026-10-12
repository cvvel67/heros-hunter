// Pelny przeplyw zagadki na atrapie serwera (fixture.js): zapowiedz ->
// okno -> zla odpowiedz -> poprawna -> wznowienie, oraz przypomnienia,
// blokada po wyczerpaniu prob, zagadka przy znalezionym herosie i Stop
// w trakcie zagadki. Uruchomienie: node zagadka.przeplyw.e2e.js
const { uruchom, sleep, MAGAZYN_GO, raport } = require('./fixture');

const R = raport();
const ileZagadkowych = (p) => p.filter((t) => /^Zagadka/.test(t)).length;

async function scenariusz(nazwa, opcje, fn) {
  console.log('\n== ' + nazwa);
  const s = await uruchom(opcje);
  try {
    await fn(s);
    R.sprawdz(nazwa + ': brak wyjątków w skrypcie', s.bledy.length === 0, s.bledy.join(' | '));
  } finally {
    await s.browser.close();
  }
}

(async () => {
  // 1) Pelny przeplyw z sukcesem
  await scenariusz('pełny przepływ', { magazyn: MAGAZYN_GO }, async ({ page, stan, logi }) => {
    await sleep(5000);
    const s0 = await stan();
    R.sprawdz('bot pracuje przed zagadką', s0.ruchy > 0 && s0.badge === 'SCAN', 'badge=' + s0.badge + ' ruchy=' + s0.ruchy);

    await page.evaluate(() => window.__serwer.zapowiedz(30));
    await sleep(1500);
    const s1 = await stan();
    R.sprawdz('zapowiedź (pre-captcha) wstrzymuje bota', s1.badge === 'ZAGADKA', 'badge=' + s1.badge);
    R.sprawdz('zapowiedź: nic na Discord, wpis w logu',
      ileZagadkowych(s1.pingi) === 0 && logi.some((l) => /Zagadka w grze \(pre-captcha\)/.test(l)), JSON.stringify(s1.pingi));

    await page.evaluate(() => window.__serwer.otworz(3));
    await sleep(3000);
    const s2 = await stan();
    R.sprawdz('okno zagadki: dalej pauza, ten sam epizod (jeden wpis w logu)',
      s2.badge === 'ZAGADKA' && logi.filter((l) => /^Zagadka w grze/.test(l)).length === 1, logi.slice(-3).join(' / '));
    R.sprawdz('lock "captcha" założony przez grę', await page.evaluate(() => window.Engine.lock.list.includes('captcha')));

    const zla = await page.evaluate(() => window.__serwer.odpowiedz('1'));
    await sleep(3000);
    const s3 = await stan();
    R.sprawdz('zła odpowiedź: serwer otwiera ponownie, bot dalej stoi',
      zla === 'zle' && s3.badge === 'ZAGADKA' && s3.ruchy === s0.ruchy, 'wynik=' + zla + ' ruchy=' + s3.ruchy);
    R.sprawdz('okno pokazuje 2 pozostałe próby',
      /2$/.test(await page.evaluate(() => document.querySelector('.captcha__triesleft').textContent.trim())));

    const ok = await page.evaluate(() => window.__serwer.odpowiedz(window.__serwer.poprawna));
    await sleep(800);
    const s4 = await stan();
    R.sprawdz('poprawna odpowiedź: lock zdjęty, okno zamknięte',
      ok === 'ok' && await page.evaluate(() => !window.Engine.lock.list.includes('captcha') && !document.querySelector('.captcha-window')));
    R.sprawdz('przez 1,5 s po zniknięciu bot jeszcze stoi', s4.ruchy === s0.ruchy, 'ruchy=' + s4.ruchy);
    await sleep(6000);
    const s5 = await stan();
    R.sprawdz('bot wznowiony: badge SCAN i nowe ruchy', s5.badge === 'SCAN' && s5.ruchy > s4.ruchy,
      'badge=' + s5.badge + ' ruchy ' + s4.ruchy + '->' + s5.ruchy);
    R.sprawdz('trasa zachowana (ten sam krok)', s5.magazyn.routeIndex === 0 && s5.magazyn.heroKey === 'przewodnik');
    R.sprawdz('log: zatrzymanie i wznowienie',
      logi.some((l) => /Zagadka w grze \(pre-captcha\)/.test(l)) && logi.some((l) => /Zagadka zniknęła/.test(l)));
    R.sprawdz('w całym epizodzie zero wiadomości Zagadka na Discordzie', ileZagadkowych(s5.pingi) === 0, JSON.stringify(s5.pingi));
  });

  // 2) Przypomnienia, gdy nikt nie rozwiazuje (przypomnienie co 3 s tylko w tym tescie)
  await scenariusz('przypomnienia', {
    magazyn: MAGAZYN_GO,
    zmianySkryptu: [['ZAGADKA_PRZYPOMNIJ_MIN: 5,', 'ZAGADKA_PRZYPOMNIJ_MIN: 0.05,']],
  }, async ({ page, stan, logi }) => {
    await sleep(3000);
    await page.evaluate(() => window.__serwer.otworz(3));
    await sleep(8000);   // przypomnienia <= otwarcie+7 s, trzecie >= otwarcie+9 s
    const s = await stan();
    const tytuly = s.pingi.filter((t) => /^Zagadka/.test(t));
    R.sprawdz('przypomnienia nie idą na Discord', tytuly.length === 0, JSON.stringify(tytuly));
    R.sprawdz('w logu: zagadka + 2 przypomnienia w 8 s',
      logi.filter((l) => /^Zagadka w grze/.test(l)).length === 1
        && logi.filter((l) => /^Zagadka wciąż czeka/.test(l)).length === 2, logi.slice(-4).join(' / '));
    await page.evaluate(() => window.__serwer.odpowiedz(window.__serwer.poprawna));
    await sleep(3000);
    const s2 = await stan();
    R.sprawdz('po rozwiązaniu przypomnienia ustają', s2.pingi.length === s.pingi.length && s2.badge === 'SCAN',
      JSON.stringify(s2.pingi.slice(s.pingi.length)));
  });

  // 3) Wyczerpane proby -> blokada gry
  await scenariusz('blokada po złych odpowiedziach', { magazyn: MAGAZYN_GO }, async ({ page, stan, logi }) => {
    await sleep(3000);
    await page.evaluate(() => window.__serwer.otworz(2));
    await sleep(1500);
    const r1 = await page.evaluate(() => window.__serwer.odpowiedz('3'));
    const r2 = await page.evaluate(() => window.__serwer.odpowiedz('3'));
    await sleep(1000);
    const s0 = await stan();
    R.sprawdz('serwer nałożył blokadę, lock i okno zniknęły (jak close() w grze)',
      r1 === 'zle' && r2 === 'blokada'
        && await page.evaluate(() => !window.Engine.lock.list.includes('captcha') && !!document.querySelector('#captcha-timer')));
    await sleep(6000);
    const s1 = await stan();
    R.sprawdz('w blokadzie bot NIE wznawia pracy', s1.badge === 'ZAGADKA' && s1.ruchy === s0.ruchy,
      'badge=' + s1.badge + ' ruchy ' + s0.ruchy + '->' + s1.ruchy);
    R.sprawdz('blokada: w logu, nie na Discordzie',
      logi.some((l) => /gra nałożyła blokadę/.test(l)) && !s1.pingi.includes('Zagadka: blokada'), JSON.stringify(s1.pingi));
  });

  // 4) Zagadka przy znalezionym herosie - stan FOUND przetrwa
  await scenariusz('zagadka w stanie FOUND', { magazyn: MAGAZYN_GO }, async ({ page, stan }) => {
    await sleep(2000);
    await page.evaluate(() => {
      window.__npc = { 77: { d: { id: 77, nick: 'Zły Przewodnik', type: 2, x: 12, y: 10 } } };
    });
    await sleep(3500);   // > 2 s blokady NOTIFY po pingu "Znaleziono"
    const s0 = await stan();
    R.sprawdz('heros znaleziony', s0.badge === 'FOUND', 'badge=' + s0.badge);
    await page.evaluate(() => window.__serwer.otworz(3));
    await sleep(2000);
    const s1 = await stan();
    R.sprawdz('pauza w FOUND (bez wiadomości Zagadka na Discordzie)',
      s1.badge === 'ZAGADKA' && !s1.pingi.includes('Zagadka w grze'), JSON.stringify(s1.pingi));
    await page.evaluate(() => window.__serwer.odpowiedz(window.__serwer.poprawna));
    await sleep(3000);
    const s2 = await stan();
    R.sprawdz('po zagadce bot dalej w FOUND (nie zgubił herosa)', s2.badge === 'FOUND' && s2.magazyn.state === 'FOUND',
      'badge=' + s2.badge + ' state=' + s2.magazyn.state);
  });

  // 5) Stop w trakcie zagadki
  await scenariusz('Stop w trakcie zagadki', { magazyn: MAGAZYN_GO }, async ({ page, stan }) => {
    await sleep(3000);
    await page.evaluate(() => window.__serwer.otworz(3));
    await sleep(1500);
    await page.evaluate(() => window.HH.stop());
    await page.evaluate(() => window.__serwer.odpowiedz(window.__serwer.poprawna));
    await sleep(4000);
    const s = await stan();
    const s2 = await (async () => { await sleep(3000); return stan(); })();
    R.sprawdz('po Stop i rozwiązaniu bot zostaje zatrzymany', s.badge === 'STOPPED' && s2.ruchy === s.ruchy,
      'badge=' + s.badge + ' ruchy ' + s.ruchy + '->' + s2.ruchy);
  });

  process.exit(R.koniec() ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
