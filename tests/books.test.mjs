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
} from '../lib/settlement/books.js';
import { BOOK_RULES, rulesFor } from '../lib/settlement/settlement.js';
/* The signup screen's bookmaker list lives in the view layer, where the
   prototype put it. It is read out of the source rather than imported so a
   brand added to the registry and forgotten in the picker still fails here,
   which is the drift the registry exists to catch. */
const RUNTIME = readFileSync(new URL('../lib/proto/runtime.js', import.meta.url), 'utf8');
const PICKER = (() => {
  const m = RUNTIME.match(/const BOOKS=(\[[\s\S]*?\]\]\]);/);
  if (!m) throw new Error('the bookmaker picker is no longer where the test looks');
  return JSON.parse(m[1].replace(/'/g, '"'));
})();
const ALL_BOOKS = PICKER.flatMap(([, names]) => names);
const BOOKS = Object.fromEntries(PICKER);

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

test('every brand the picker offers is one the grader knows', () => {
  /* One direction only, deliberately. A brand in the picker that the
     registry has never heard of cannot be graded by the rules of the book
     that took the bet, and that is a wrong settlement. The registry knowing
     more brands than the picker offers is fine: the picker is the
     prototype's list and "Add a custom bookmaker" reaches the rest. */
  for (const name of ALL_BOOKS) {
    assert.ok(findBook(name), name + ' is offered at signup and the grader does not know it');
  }
});

test('the grader knows bet365 even though the picker does not offer it', () => {
  /* bet365 pushes a whole handicap line where everybody else loses it, which
     is the single most consequential settlement rule in the product. It is
     not in the prototype's picker, so it arrives through "Add a custom
     bookmaker" or off a slip, and it has to grade correctly either way. */
  assert.equal(ALL_BOOKS.includes('bet365'), false, 'the picker is the prototype list');
  assert.ok(ALL_BOOK_NAMES.includes('bet365'), 'and the registry still knows it');
  assert.equal(rulesFor('bet365').handicap, 'asian');
  assert.equal(rulesFor('Bet 365').handicap, 'asian');
});

test('adding a brand is one row, and every consumer sees it', () => {
  /* The whole claim of the registry, checked rather than asserted in a
     comment. Adding Mr Green to the Kambi rows gives the grader its rules,
     the platform grouping its membership and the alias table its spellings,
     with nothing else touched. */
  const green = findBook('Mr Green');
  assert.ok(green, 'Mr Green should be in the registry');
  assert.equal(green.provider, 'Kambi');
  assert.equal(rulesFor('mr. green').handicap, 'european', 'the grader knows it');
  assert.equal(bookName('mrgreen.com'), 'Mr Green', 'and every spelling reaches it');
  assert.ok(booksByProvider().Kambi.includes('Mr Green'), 'under the right platform');
});

test('the signup picker and the grader name the same brands', () => {
  /* The picker is what somebody chooses from and the grader is what decides
     whether their handicap pushed. A brand in one and not the other is a bet
     that cannot be settled by the rules of the book it was placed with. */
  for (const name of ALL_BOOKS) {
    assert.ok(findBook(name), name + ' is offered at signup and is not in the registry');
  }
});

test('the picker groups a brand under the platform the registry gives it', () => {
  for (const [provider, names] of Object.entries(BOOKS)) {
    if (provider === 'Other') continue;
    for (const name of names) {
      assert.equal(providerOf(name), provider, name + ' is grouped under the wrong platform');
    }
  }
});
