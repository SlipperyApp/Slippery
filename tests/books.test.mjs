/* One bookmaker registry, and everything downstream reading it.
 *
 * There were five copies of this list and they had already drifted.
 * BOOKS in data.js grouped brands for the settings screen. BOOKPAGES in
 * pages.js keyed the same brands as `paddy-power` while data.js called
 * them `Paddy Power`. BOOK_RULES in settlement.js was the only one with
 * behaviour attached, and it listed Unibet, LeoVegas and 32Red as three
 * unrelated rows with no idea they are one platform. app.html had a fourth
 * copy as hardcoded options and sample.js a fifth. Adding a brand meant
 * four edits and nothing failed if you forgot one.
 *
 * The test that matters most is the last one: adding a Kambi brand is one
 * row, and every consumer picks it up.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BOOKMAKERS, findBook, bookName, providerOf, booksByProvider, bookKey, ALL_BOOK_NAMES
} from '../src/js/books.js';
import { BOOK_RULES, rulesFor } from '../src/js/settlement.js';
import { BOOKS, ALL_BOOKS } from '../src/js/data.js';
import { BOOKPAGES } from '../src/js/pages.js';

test('every row is complete and every id is unique', () => {
  const ids = new Set();
  for (const b of BOOKMAKERS) {
    assert.match(b.id, /^[a-z0-9-]+$/, b.id + ' is not a slug');
    assert.ok(b.name, b.id + ' has no display name');
    assert.ok(b.provider, b.id + ' has no provider');
    assert.ok(b.handicap === 'asian' || b.handicap === 'european',
      b.id + ' must settle handicaps one way or the other');
    assert.equal(ids.has(b.id), false, b.id + ' is in the registry twice');
    ids.add(b.id);
  }
});

test('no alias resolves to two different bookmakers', () => {
  /* An alias colliding across brands would silently reassign somebody's
     bets and, worse, their settlement table. */
  const seen = new Map();
  for (const b of BOOKMAKERS) {
    for (const key of [b.id, b.name, ...(b.aliases || [])].map(bookKey)) {
      const other = seen.get(key);
      assert.ok(!other || other === b.id, key + ' is claimed by ' + other + ' and ' + b.id);
      seen.set(key, b.id);
    }
  }
});

test('slips spell a brand every way there is, and all of them resolve', () => {
  for (const spelling of ['bet365', 'Bet 365', 'BET365', 'bet-365', ' b365 ']) {
    assert.equal(findBook(spelling).id, 'bet365', spelling + ' did not resolve');
  }
  assert.equal(bookName('leo vegas'), 'LeoVegas');
  assert.equal(bookName('PADDYPOWER'), 'Paddy Power');
});

test('a bookmaker nobody has heard of keeps its name', () => {
  /* Dropping it would lose a real bet's real bookmaker. Not knowing the
     platform is a smaller problem than not knowing who took the bet. */
  assert.equal(bookName('Some Local Shop'), 'Some Local Shop');
  assert.equal(findBook('Some Local Shop'), null);
  assert.equal(providerOf('Some Local Shop'), null);
});

test('the settlement table is the registry, aliases included', () => {
  /* This is the one consumer where drift is a wrong grade rather than a
     wrong label: bet365 pushes a whole handicap line, everyone else loses
     it. A slip that says "Bet 365" has to reach the Asian table. */
  assert.equal(rulesFor('bet365').handicap, 'asian');
  assert.equal(rulesFor('Bet 365').handicap, 'asian');
  assert.equal(rulesFor('BET365').handicap, 'asian');
  for (const b of BOOKMAKERS) {
    assert.equal(BOOK_RULES[bookKey(b.id)].handicap, b.handicap, b.id);
    assert.equal(rulesFor(b.name).handicap, b.handicap, b.name);
  }
  /* And an unknown bookmaker still grades, on the safer European table. */
  assert.equal(rulesFor('Some Local Shop').handicap, 'european');
});

test('Kambi is a platform with brands on it, not a label', () => {
  const kambi = BOOKMAKERS.filter(b => b.provider === 'Kambi').map(b => b.id);
  assert.ok(kambi.length >= 3, 'Kambi should carry several brands');
  for (const id of kambi) assert.equal(providerOf(id), 'Kambi');
  assert.deepEqual(booksByProvider().Kambi, BOOKMAKERS.filter(b => b.provider === 'Kambi').map(b => b.name));
});

test('the settings screen and the reference pages show the same brands', () => {
  assert.deepEqual(ALL_BOOKS.slice().sort(), ALL_BOOK_NAMES.slice().sort());
  assert.deepEqual(Object.values(BOOKS).flat().slice().sort(), ALL_BOOK_NAMES.slice().sort());
  assert.deepEqual(BOOKPAGES.map(p => p.id).sort(), BOOKMAKERS.map(b => b.id).sort());
});

test('a reference page cannot disagree with the grader about handicaps', () => {
  /* The page used to restate the handicap style as prose beside a table
     that decided it independently. */
  for (const p of BOOKPAGES) {
    const row = findBook(p.id);
    assert.equal(p.handicap, row.handicap === 'asian' ? 'Asian' : 'European', p.id);
    assert.equal(p.name, row.name);
    assert.ok(p.edge && p.reads.length && p.caution, p.id + ' has an empty page');
  }
});

test('nothing keeps its own copy of the list any more', () => {
  const read = f => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
  /* The hardcoded platform options in the markup and the second grouping
     in data.js were two of the five copies. */
  assert.doesNotMatch(read('src/app.html'), /<option>Kambi<\/option>/);
  assert.match(read('src/js/data.js'), /booksByProvider\(\)/);
  assert.match(read('src/js/settlement.js'), /from '\.\/books\.js'/);
  assert.match(read('api/extract.js'), /bookName/);
  assert.match(read('api/bets.js'), /bookName/);
});

test('adding a brand is one row, and every consumer sees it', () => {
  /* The whole claim of the registry, checked rather than asserted in a
     comment. Mr Green was added to the Kambi rows and nothing else was
     touched. */
  const green = findBook('Mr Green');
  assert.ok(green, 'Mr Green should be in the registry');
  assert.equal(green.provider, 'Kambi');
  assert.equal(rulesFor('mr. green').handicap, 'european', 'the grader knows it');
  assert.ok(ALL_BOOKS.includes('Mr Green'), 'the settings list knows it');
  assert.ok(BOOKS.Kambi.includes('Mr Green'), 'and under the right platform');
  const page = BOOKPAGES.find(p => p.id === 'mrgreen');
  assert.ok(page, 'the reference screen knows it');
  assert.match(page.edge, /Kambi/, 'and says what platform it shares');
});
