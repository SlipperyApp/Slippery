/* Several bets on one page.
 *
 * The schema used to be flat: one stake, one odds, one placed_at, one
 * bookmaker, and a LEG_SCHEMA with none of those. So when the prompt
 * correctly told the model to put three separate bets in `selections`,
 * three stakes collapsed into one and three dates into one. The data was
 * destroyed before sanitise() ran, and the client then joined the three
 * selections with " & " into a single nonsense bet while a badge said "3".
 *
 * A leg and a bet are different things. A treble is one bet with three
 * selections; three singles on one page are three bets. The test that
 * separates them is the stake: legs share one, bets each have their own.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitise, SLIP_SCHEMA } from '../api/extract.js';

const leg = (selection, odds) => ({ selection, event: '', market: '', odds, result: 'open' });
const bet = over => Object.assign({
  selection: 'Arsenal', event: 'Arsenal v Spurs', market: 'Match result',
  bookmaker: 'bet365', odds: 1.9, stake: 10, returns: -1,
  result: 'open', stage: 'prematch', placed_at: '', selections: []
}, over);

const doc = over => Object.assign({
  readable: true, doc_type: 'bet_list', platform: 'bet365', bet_type: 'single',
  bet_count: 0, selection: '', event: '', market: '', bookmaker: '',
  odds: 0, stake: 0, returns: -1, result: 'unknown', stage: 'unknown',
  free_bet: false, each_way: false, price_source: '', kickoff: '', legs: 0,
  selections: [], bets: [], totals: { present: false }, pl_rows: [],
  placed_at: '', unreadable_fields: [], notes: ''
}, over);

test('the schema can carry more than one bet', () => {
  const bets = SLIP_SCHEMA.properties.bets;
  assert.equal(bets.type, 'array');
  for (const f of ['stake', 'odds', 'returns', 'placed_at', 'bookmaker', 'selections']) {
    assert.ok(bets.items.properties[f],
      'each bet needs its own ' + f + ', or several bets cannot be told apart');
  }
});

test('three separate bets stay three bets with their own stakes', () => {
  const out = sanitise(doc({
    bet_count: 3,
    bets: [
      bet({ selection: 'Arsenal', stake: 10, odds: 1.90, bookmaker: 'bet365' }),
      bet({ selection: 'Spurs', stake: 25, odds: 2.40, bookmaker: 'Sky Bet' }),
      bet({ selection: 'Chelsea', stake: 5, odds: 3.10, bookmaker: 'Betfair' })
    ]
  }));
  assert.equal(out.bets.length, 3);
  assert.deepEqual(out.bets.map(b => b.stake), [10, 25, 5]);
  assert.deepEqual(out.bets.map(b => b.odds), [1.9, 2.4, 3.1]);
  assert.deepEqual(out.bets.map(b => b.bookmaker), ['bet365', 'Sky Bet', 'Betfair']);
  /* The exact failure this replaces. */
  assert.equal(out.bets.some(b => /&/.test(b.selection || '')), false,
    'bets must not be merged into one "A & B & C" row');
});

test('a treble is one bet with three selections, not three bets', () => {
  const out = sanitise(doc({
    doc_type: 'bet_slip', bet_type: 'multiple', bet_count: 1,
    bets: [bet({
      selection: 'Treble', stake: 20, odds: 7.4,
      selections: [leg('Arsenal', 1.9), leg('Spurs', 1.7), leg('Chelsea', 2.3)]
    })]
  }));
  assert.equal(out.bets.length, 1);
  assert.equal(out.bets[0].selections.length, 3);
  assert.equal(out.bets[0].legs, 3);
  assert.equal(out.bets[0].stake, 20, 'legs share one stake');
});

test('bet_count is what was actually returned, never what was claimed', () => {
  /* The badge said "3" while the card wrote one bet. It now cannot. */
  const out = sanitise(doc({ bet_count: 9, bets: [bet({}), bet({ selection: 'Spurs' })] }));
  assert.equal(out.bet_count, 2);
});

test('one unreadable stake among five costs one figure, not the page', () => {
  const out = sanitise(doc({
    bets: [bet({ selection: 'A' }), bet({ selection: 'B', stake: 0 }), bet({ selection: 'C' })]
  }));
  assert.equal(out.bets.length, 3);
  assert.equal(out.bets[1].stake, null);
  assert.equal(out.bets[0].stake, 10);
  assert.ok(out.unreadable_fields.some(x => /bet 2 stake/.test(x)),
    'and it says which bet lost which field: ' + JSON.stringify(out.unreadable_fields));
});

test('a reader that filled only the flat fields still produces one bet', () => {
  /* Backward compatibility: everything written before bets[] existed. */
  const out = sanitise(doc({
    doc_type: 'bet_slip', bets: [],
    selection: 'Over 2.5', stake: 12, odds: 1.85, bookmaker: 'bet365',
    selections: [leg('Over 2.5', 1.85)]
  }));
  assert.equal(out.bets.length, 1);
  assert.equal(out.bets[0].selection, 'Over 2.5');
  assert.equal(out.bets[0].stake, 12);
});

test('blank padding rows are dropped', () => {
  const out = sanitise(doc({
    bets: [bet({}), bet({ selection: '', stake: 0, odds: 0 })]
  }));
  assert.equal(out.bets.length, 1);
});

test('a P/L summary never becomes bets', () => {
  /* It has a second route to becoming bets now, so it gets a second guard. */
  const out = sanitise(doc({
    doc_type: 'pnl_summary',
    bets: [bet({ selection: 'Total', stake: 4200 })],
    totals: { present: true, period: 'March', profit: 120, turnover: 4200, bets: 88, won: 40, lost: 48 }
  }));
  assert.deepEqual(out.bets, []);
  assert.equal(out.bet_count, null);
  assert.ok(out.totals, 'the totals themselves survive');
});

test('sentinels inside a bet still mean not legible', () => {
  const out = sanitise(doc({
    bets: [bet({ odds: 0, returns: -1, result: 'unknown', stage: 'unknown', placed_at: '' })]
  }));
  const b = out.bets[0];
  assert.equal(b.odds, null);
  assert.equal(b.returns, null);
  assert.equal(b.result, null);
  assert.equal(b.stage, null);
  assert.equal(b.placed_at, null);
});

test('the page cap holds', () => {
  const out = sanitise(doc({ bets: Array.from({ length: 400 }, (_, i) => bet({ selection: 'S' + i })) }));
  assert.ok(out.bets.length <= 200, 'got ' + out.bets.length);
});
