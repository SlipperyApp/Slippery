/* The slip reader's schema and its sanitiser.
 *
 * This file exists because of a real outage. Every field in the schema was
 * declared as `{anyOf: [{type: 'string'}, {type: 'null'}]}`, twenty-nine of
 * them, and the structured-output API refuses any schema with more than
 * sixteen union-typed parameters:
 *
 *   Schemas contains too many parameters with union types (29 parameters
 *   with type arrays or anyOf) ... limit: 16 parameters with unions.
 *
 * So every request 400'd. Not intermittently, not on odd images, every
 * single one. The reader was completely dead and the failure looked like a
 * mystery because it was being reported as a generic 500.
 *
 * The first test below counts unions in the schema the file actually
 * exports. Adding one nullable field is the natural way to reintroduce this
 * bug, and there is nothing in local testing that would otherwise catch it,
 * because the schema is only validated by the API at request time.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitise, SLIP_SCHEMA } from '../api/extract.js';

/* The API's documented ceiling. */
const UNION_LIMIT = 16;

/** Count every parameter in the schema that is a union: anyOf, oneOf, or a
    type given as an array. Recurses through properties and array items,
    which is where the leg and totals objects live. */
function countUnions(node) {
  if (!node || typeof node !== 'object') return 0;
  let n = 0;
  if (Array.isArray(node.anyOf) || Array.isArray(node.oneOf)) n += 1;
  if (Array.isArray(node.type)) n += 1;
  if (node.properties) for (const key of Object.keys(node.properties)) n += countUnions(node.properties[key]);
  if (node.items) n += countUnions(node.items);
  return n;
}

test('the schema stays under the structured-output union limit', () => {
  const n = countUnions(SLIP_SCHEMA);
  assert.ok(n <= UNION_LIMIT,
    'the slip schema has ' + n + ' union-typed parameters, limit is ' + UNION_LIMIT +
    '. Every request would 400 and the reader would be dead. Use a sentinel ' +
    'value for "not legible" instead of a nullable type.');
});

test('every object in the schema forbids extra properties', () => {
  /* Structured outputs require additionalProperties:false on every object,
     and the failure is another 400 at request time. */
  const walk = node => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'object') {
      assert.equal(node.additionalProperties, false,
        'an object in the schema allows additional properties');
      assert.ok(Array.isArray(node.required), 'an object in the schema has no required list');
      for (const key of Object.keys(node.properties || {})) {
        assert.ok(node.required.includes(key), key + ' is a property but not required');
      }
    }
    for (const key of Object.keys(node.properties || {})) walk(node.properties[key]);
    if (node.items) walk(node.items);
  };
  walk(SLIP_SCHEMA);
});

/* ---- sanitise: sentinels in, nulls out ---- */

/** A complete reading with everything legible, as the schema demands it. */
const readable = over => Object.assign({
  readable: true,
  doc_type: 'bet_slip',
  platform: 'bet365',
  bet_type: 'single',
  bet_count: 1,
  selection: 'Arsenal',
  event: 'Arsenal v Spurs',
  market: 'Match result',
  bookmaker: 'bet365',
  odds: 2.1,
  stake: 25,
  returns: 52.5,
  result: 'open',
  stage: 'prematch',
  kickoff: '2026-08-15T14:00:00Z',
  legs: 1,
  selections: [{ selection: 'Arsenal', event: 'Arsenal v Spurs', market: 'Match result', odds: 2.1, result: 'open' }],
  totals: { present: false, period: '', profit: 0, turnover: 0, bets: 0, won: 0, lost: 0 },
  placed_at: '2026-08-12T09:00:00Z',
  unreadable_fields: [],
  notes: ''
}, over);

test('a fully legible slip survives intact', () => {
  const out = sanitise(readable());
  assert.equal(out.odds, 2.1);
  assert.equal(out.stake, 25);
  assert.equal(out.returns, 52.5);
  assert.equal(out.selection, 'Arsenal');
  assert.equal(out.platform, 'bet365');
  assert.equal(out.legs, 1);
  assert.equal(out.selections.length, 1);
  assert.deepEqual(out.unreadable_fields, []);
});

test('an unreadable price is 0 and comes back as null, not as a price', () => {
  const out = sanitise(readable({ odds: 0 }));
  assert.equal(out.odds, null, 'a 0 must never reach the ledger as odds');
  assert.ok(out.unreadable_fields.includes('odds'), 'and the user has to be told');
});

test('an unreadable stake is 0 and comes back as null', () => {
  const out = sanitise(readable({ stake: 0 }));
  assert.equal(out.stake, null);
  assert.ok(out.unreadable_fields.includes('stake'));
});

test('returns of zero is a real figure and survives', () => {
  /* This is why returns uses -1 rather than 0: a losing bet returns
     nothing, and nulling that would ask the user about a field the slip
     stated perfectly clearly. */
  const out = sanitise(readable({ returns: 0, result: 'lost' }));
  assert.equal(out.returns, 0);
  assert.ok(!out.unreadable_fields.includes('returns'));
});

test('unreadable returns is -1 and comes back as null', () => {
  const out = sanitise(readable({ returns: -1 }));
  assert.equal(out.returns, null);
  assert.ok(out.unreadable_fields.includes('returns'));
});

test('an unknown choice never reaches a caller as the string "unknown"', () => {
  /* A bet whose result is the truthy string "unknown" would be treated as
     settled by anything that tests the field for presence. */
  const out = sanitise(readable({ result: 'unknown', stage: 'unknown', bet_type: 'unknown' }));
  assert.equal(out.result, null);
  assert.equal(out.stage, null);
  assert.equal(out.bet_type, null);
  for (const f of ['result', 'stage', 'bet_type']) {
    assert.ok(out.unreadable_fields.includes(f), f + ' should be named as unreadable');
  }
});

test('an empty string is not a selection', () => {
  const out = sanitise(readable({ selection: '', platform: '   ', kickoff: '' }));
  assert.equal(out.selection, null);
  assert.equal(out.platform, null);
  assert.equal(out.kickoff, null);
});

test('a leg with an unreadable price is named by its number', () => {
  const out = sanitise(readable({
    legs: 2,
    selections: [
      { selection: 'Arsenal', event: 'Arsenal v Spurs', market: 'Match result', odds: 1.8, result: 'open' },
      { selection: 'Over 2.5', event: 'Arsenal v Spurs', market: 'Over/Under', odds: 0, result: 'unknown' }
    ]
  }));
  assert.equal(out.selections[1].odds, null);
  assert.equal(out.selections[1].result, null);
  assert.ok(out.unreadable_fields.includes('leg 2 odds'),
    'the user needs to know which leg to correct');
  assert.equal(out.selections[0].odds, 1.8, 'the readable leg is untouched');
});

test('a profit and loss screenshot never becomes a bet', () => {
  const out = sanitise(readable({
    doc_type: 'pnl_summary',
    totals: { present: true, period: 'This year', profit: -240.5, turnover: 9800, bets: 312, won: 141, lost: 171 }
  }));
  assert.equal(out.stake, null);
  assert.equal(out.odds, null);
  assert.equal(out.selection, null);
  assert.deepEqual(out.selections, []);
  assert.equal(out.totals.profit, -240.5);
  assert.equal(out.totals.bets, 312);
  assert.equal(out.totals.present, undefined, 'the flag is internal, not part of the reading');
});

test('a break-even summary keeps its zero', () => {
  /* Profit of exactly nothing is the whole reason totals cannot use 0 as
     its "not legible" value. */
  const out = sanitise(readable({
    doc_type: 'pnl_summary',
    totals: { present: true, period: 'August', profit: 0, turnover: 1200, bets: 40, won: 20, lost: 20 }
  }));
  assert.equal(out.totals.profit, 0);
});

test('totals are dropped on anything that is not a summary', () => {
  const out = sanitise(readable({
    totals: { present: true, period: 'This year', profit: 100, turnover: 2000, bets: 10, won: 5, lost: 5 }
  }));
  assert.equal(out.totals, null, 'a slip does not carry lifetime totals');
});

test('a single is one bet even when the reader did not count', () => {
  const out = sanitise(readable({ legs: 0, bet_count: 0 }));
  assert.equal(out.legs, 1, 'derived from the one selection');
  assert.equal(out.bet_count, 1);
});

test('an impossible price is rejected however it arrives', () => {
  for (const odds of [0.85, 1, -3, 99999, Infinity, NaN]) {
    const out = sanitise(readable({ odds }));
    assert.equal(out.odds, null, odds + ' must not be accepted as a price');
  }
});
