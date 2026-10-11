// Przygotowuje wydanie: sprawdza, ze wszystko jest gotowe, i zaklada tag v<WERSJA>.
// NIE wypycha - push jest osobnym, swiadomym krokiem (polecenia na koncu).
//
// Kolejnosc przy nowej wersji:
//   1. zmiany w src/heros-hunter.js, podbita WERSJA (i version w package.json)
//   2. npm run build:loader
//   3. git commit
//   4. npm run release
//
// Uzycie: npm run release
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const { zbuduj, LOADER } = require('./build-loader');

const git = (polecenie) => execSync('git ' + polecenie, { encoding: 'utf8' }).trim();
const stop = (powod) => { console.error('STOP: ' + powod); process.exit(1); };

const { tresc, wersja } = zbuduj();
const tag = 'v' + wersja;

if (fs.readFileSync(LOADER, 'utf8') !== tresc) stop('loader nieaktualny - uruchom `npm run build:loader` i zacommituj.');
if (git('status --porcelain --untracked-files=no')) stop('niezacommitowane zmiany - najpierw commit.');
if (git('tag --list ' + tag)) stop('tag ' + tag + ' juz istnieje lokalnie. Podbij WERSJA.');
if (git('ls-remote --tags origin refs/tags/' + tag)) stop('tag ' + tag + ' juz jest na GitHubie. Podbij WERSJA.');

console.log('Testy...');
try { execSync('npm test', { stdio: 'inherit' }); } catch (e) { stop('testy nie przeszly.'); }

git('tag -a ' + tag + ' -m "Heros Hunter ' + wersja + '"');
const galaz = git('rev-parse --abbrev-ref HEAD');
console.log('\nGotowe: tag ' + tag + ' na ' + git('rev-parse --short HEAD') + ' (' + galaz + ').');
console.log('Wypchniecie (publikuje kod na jsDelivr na stale):');
console.log('  git push origin ' + galaz + ' ' + tag);
