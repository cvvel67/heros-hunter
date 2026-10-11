// Playwright dla testow e2e. Najpierw z node_modules tego folderu
// (po `npm install`), a gdy go nie ma - z sasiedniego bot_margon-main,
// gdzie jest juz zainstalowany. Nic nie jest instalowane automatycznie.
const path = require('node:path');

function zaladuj() {
  try { return require('playwright'); } catch (e) { /* brak lokalnie */ }
  const sasiad = path.join(__dirname, '..', '..', 'bot_margon-main', 'node_modules', 'playwright');
  try { return require(sasiad); } catch (e) {
    throw new Error('Brak Playwrighta. Uruchom `npm install` w tym folderze '
      + 'albo trzymaj folder obok bot_margon-main (szukano: ' + sasiad + ').');
  }
}

module.exports = zaladuj();
