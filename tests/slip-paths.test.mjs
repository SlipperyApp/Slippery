/* The slip paths the owner listed, at the level they can be tested without
 * a live model: the schema promises them, the sanitiser preserves them, and
 * the settlement side honours them.
 *
 * The one that matters most is the last: a bet settled from the slip must
 * never be handed to the results feed. Scraped results disagree with each
 * other often enough that re-grading something the bookmaker already
 * settled is a way to overwrite a true figure with a guess.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SLIP_SCHEMA, sanitise } from '../api/extract.js';

const props = SLIP_SCHEMA.properties;

test('the schema carries the fields the awkward slips need', () => {
  for (const f of ['free_bet', 'each_way', 'price_source', 'stage', 'result',
                   'selections', 'pl_rows', 'totals', 'doc_type']) {
    assert.ok(props[f], f + ' is missing from the slip schema');
  }
  assert.equal(props.free_bet.type, 'boolean');
  assert.equal(props.each_way.type, 'boolean');
});

test('every schema field is required, because there is no null in it', () => {
  /* The sentinel scheme only works if a field is always present: a missing
     field and an unreadable one would otherwise be indistinguishable. */
  for (const key of Object.keys(props)) {
    assert.ok(SLIP_SCHEMA.required.includes(key), key + ' is optional, so it can arrive absent');
  }
});

test('the union-typed parameter budget is still under the limit', () => {
  /* Twenty-nine of these once made every extraction fail with a 400 that
     was being swallowed, so the slip reader had never worked in
     production. The ceiling is sixteen. */
  let unions = 0;
  const walk = node => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node.type) || node.anyOf || node.oneOf) unions++;
    for (const v of Object.values(node)) walk(v);
  };
  walk(SLIP_SCHEMA);
  assert.ok(unions <= 16, unions + ' union-typed parameters, the limit is 16');
});

test('an unreadable stake is nulled and named, never guessed', () => {
  const out = sanitise({ stake: 0, odds: 10, unreadable_fields: [] });
  assert.equal(out.stake, null);
  assert.ok(out.unreadable_fields.includes('stake'));
});

test('a price of zero is nulled, so two prices cannot be averaged into one', () => {
  /* The reader returns 0 for odds when it cannot tell which of two printed
     prices was actually bet at. That has to survive as "no price". */
  const out = sanitise({ odds: 0, stake: 10, unreadable_fields: [] });
  assert.equal(out.odds, null);
  assert.ok(out.unreadable_fields.includes('odds'));
});

test('zero returns survives, because a losing bet really returns nothing', () => {
  const out = sanitise({ returns: 0, odds: 2, stake: 10, unreadable_fields: [] });
  assert.equal(out.returns, 0, 'nulling this would lose a real figure');
});

test('an unreadable returns figure is minus one, and is nulled', () => {
  const out = sanitise({ returns: -1, odds: 2, stake: 10, unreadable_fields: [] });
  assert.equal(out.returns, null);
});

test('no price source means one price was shown, not a failure', () => {
  assert.equal(sanitise({ price_source: '', unreadable_fields: [] }).price_source, null);
  assert.equal(sanitise({ price_source: 'Flutter', unreadable_fields: [] }).price_source, 'Flutter');
});

test('the reader is told what is not a bet field', async () => {
  /* A value tool prints its workings next to the bet. Those numbers look
     like odds and are not. */
  const src = await readFile(new URL('../api/extract.js', import.meta.url), 'utf8');
  assert.match(src, /Value: 2\.38x|138% edge|NOT A BET FIELD/i,
    'the prompt must name the value-tool lines it has to ignore');
  assert.match(src, /NEVER\s+average two prices/i);
  assert.match(src, /ACTUALLY RETURNED/i, 'cashed out must take the returned amount');
  assert.match(src, /Stake not returned/i, 'a free bet must be recognisable');
});

test('a bet settled from the slip is never handed to the results feed', async () => {
  /* The cron only ever looks at pending bets, and a slip that stated its
     own result is written as settled. That is the whole guarantee: an
     obscure reserve fixture no feed carries still gets the right figure,
     because nothing goes looking for it. */
  const cron = await readFile(new URL('../api/results.js', import.meta.url), 'utf8');
  assert.match(cron, /status\s*=\s*'pending'/,
    'the sweep must select only pending bets');

  const bot = await readFile(new URL('../api/telegram.js', import.meta.url), 'utf8');
  assert.match(bot, /outcome \? 'settled' : 'pending'/,
    'a slip carrying its own result must be written as settled, not pending');
  assert.match(bot, /Result read from the slip/,
    'and it must say where the result came from');
});
