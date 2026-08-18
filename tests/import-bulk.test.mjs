/* Bulk import: real bets, duplicates, and partial failure.
 *
 * Two things were wrong at once and they hid each other.
 *
 * The client folded every CSV row into a daily total and posted
 * {pl:[...]}, so a spreadsheet of 200 bets produced about 34 dated
 * figures: the ledger stayed empty, the bet count never moved, nothing
 * could settle, and the button saying "Import 200 bets" was telling the
 * truth about neither number. Meanwhile createMany, MAX_IMPORT and the
 * per-line rejected array sat on the server with no caller at all, so
 * none of that machinery had ever run.
 *
 * Appending bets is not idempotent the way the old upsert on
 * (user, date, period) was, so duplicate detection is not a nicety here.
 * Without it, importing the same export twice doubles a whole record.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = p => readFile(new URL(p, root), 'utf8');

test('the client posts bets, not dated figures', async () => {
  const main = await read('src/js/main.js');
  const fn = main.slice(main.indexOf('async function runCsvImport'), main.indexOf('function importSummary'));
  assert.match(fn, /post\('\/api\/bets', \{ bets:/,
    'a CSV of bets must create bets');
  assert.equal(/post\('\/api\/bets', \{ pl:/.test(fn), false,
    'folding bets into daily totals is what made the ledger stay empty');
});

test('foldToDays is gone, not merely unused', async () => {
  const main = await read('src/js/main.js');
  assert.equal(main.includes('function foldToDays'), false);
});

test('the summary reads the server rather than counting again', async () => {
  /* Nothing in the client used to read `rejected` or `imported` at all, so
     rows a user could see in their own file simply never appeared. */
  const main = await read('src/js/main.js');
  const fn = main.slice(main.indexOf('function importSummary'));
  for (const field of ['detected', 'imported', 'duplicates', 'rejected']) {
    assert.ok(fn.includes('body.' + field),
      'the summary must report ' + field + ' from the response');
  }
});

test('the server reports every number the summary needs', async () => {
  const bets = await read('api/bets.js');
  const ret = bets.slice(bets.indexOf('let inserted = 0;'));
  for (const field of ['imported', 'detected', 'duplicates', 'rejected']) {
    /* Shorthand counts: `rejected` and `rejected: rejected` are the same
       key on the wire. */
    assert.match(ret, new RegExp('\\b' + field + '\\s*[:,\\n]'),
      'createMany must return ' + field);
  }
});

test('a duplicate needs all four fields to match', async () => {
  /* Three matching is a coincidence: two people really do back the same
     selection twice in a day at different stakes. */
  const bets = await read('api/bets.js');
  const key = /const keyOf = \([^)]*\) =>\s*([\s\S]*?);\n/.exec(bets);
  assert.ok(key, 'expected a duplicate key builder');
  for (const part of ['day', 'selection', 'stakePence', 'book']) {
    assert.ok(key[0].includes(part), 'the key must include ' + part);
  }
});

test('duplicates are matched on the day, not the timestamp', async () => {
  /* A spreadsheet rarely carries a time, and re-exporting can move it. */
  const bets = await read('api/bets.js');
  assert.match(bets, /toISOString\(\)\.slice\(0, 10\)/);
  assert.match(bets, /to_char\(placed_at, 'YYYY-MM-DD'\)/);
});

test('a file containing the same bet twice is caught, not just a repeat import', async () => {
  const bets = await read('api/bets.js');
  /* lastIndexOf: `return json(res, 201` appears three times in this file
     and the first is above the loop, which made this slice empty and the
     assertion vacuously true. */
  const loop = bets.slice(bets.indexOf('for (const b of good)'), bets.lastIndexOf('return json(res, 201'));
  assert.ok(loop.length > 200, 'expected to find the insert loop');
  assert.ok(loop.includes('seen.add(key)'),
    'rows written by this import must join the set, or a file with an ' +
    'internal duplicate imports it twice');
});

test('existing bets are fetched in one query, not one per row', async () => {
  /* A 1000 row import would otherwise be 1000 round trips before writing. */
  const bets = await read('api/bets.js');
  const block = bets.slice(bets.indexOf('const days = [...new Set('), bets.indexOf('let inserted = 0;'));
  assert.equal((block.match(/await sql`/g) || []).length, 1,
    'the duplicate lookup should be a single windowed query');
  assert.match(block, /= ANY\(\$\{days\}\)/);
});

test('imported bets are marked as imported', async () => {
  /* This is what makes them a separate ledger rather than indistinguishable
     from bets logged through Slippery, and it is what already keeps them
     out of the capture rate. */
  const bets = await read('api/bets.js');
  const insert = bets.slice(bets.indexOf('INSERT INTO bets (user_id, event, selection, market, bookmaker, odds, stake_pence,'));
  assert.match(insert.slice(0, 900), /'import'\)/);
});

test('the duplicate rule the FAQ describes is the rule that is implemented', async () => {
  /* The public FAQ described duplicate detection in detail while nothing
     implemented it. Now that it exists, the two must agree. */
  const pages = await read('src/js/pages.js');
  const faq = pages.slice(pages.indexOf('How does duplicate detection work?'));
  assert.ok(faq.length > 40, 'expected the FAQ entry to still be there');
  const claim = faq.slice(0, 600);
  for (const field of ['date', 'selection', 'stake', 'bookmaker']) {
    assert.ok(new RegExp(field, 'i').test(claim),
      'the FAQ should name ' + field + ' as part of the rule');
  }
});
