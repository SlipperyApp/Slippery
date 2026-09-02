import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { demoData } from '@/lib/data/demo';
import {
  closingValuePct, isPrice, summariseClosing, type Priced,
} from '@/lib/domain/closing';
import { exportRows } from '@/lib/server/export';

const NOW = new Date('2026-08-31T12:00:00Z');
const data = demoData(NOW);

const back = (odds: number, closingOdds: number | null): Priced => ({ side: 'back', odds, closingOdds });
const lay = (odds: number, closingOdds: number | null): Priced => ({ side: 'lay', odds, closingOdds });

// ------------------------------------------------------- a null is not a zero

test('a bet with no closing price has no closing value, and no zero either', () => {
  /*  THE RULE THE WHOLE MODULE IS BUILT AROUND. A zero would say the prices
   *  matched on a bet where nobody looked one up, which is a claim, and the
   *  claim is false. */
  assert.equal(closingValuePct(back(3.0, null)), null);
  assert.equal(closingValuePct(lay(3.0, null)), null);
});

test('nothing that is not a price is treated as one', () => {
  for (const bad of [0, 1, -2, Number.NaN, Number.POSITIVE_INFINITY, 20000]) {
    assert.equal(isPrice(bad), false, `${bad} passed as a price`);
    assert.equal(closingValuePct(back(3.0, bad)), null, `${bad} produced a value`);
  }
  /*  A price of exactly 1 is the one that matters: it divides into the price
   *  taken and would print an enormous positive value on every bet somebody
   *  typed "1" into. */
  assert.equal(closingValuePct(back(3.0, 1)), null);
});

/** Percentages come out of a division, so they are compared to a place
 *  rather than to the last bit: 2.2 / 2.0 is 1.1000000000000003 in binary
 *  and 10.000000000000009 per cent, which is ten. */
const near = (a: number | null, b: number, why?: string) => {
  assert.ok(a !== null, why ?? 'no value at all');
  assert.ok(Math.abs(a - b) < 1e-9, `${a} is not ${b}${why ? `: ${why}` : ''}`);
};

test('the value is the difference between the price taken and the price that closed', () => {
  near(closingValuePct(back(2.2, 2.0)), 10);
  near(closingValuePct(back(2.0, 2.2)), (2 / 2.2 - 1) * 100);
  assert.equal(closingValuePct(back(2.0, 2.0)), 0, 'two identical prices are level, which is a real answer');
});

test('a lay is worked out the other way round, because a layer wants the shorter price', () => {
  /*  Getting this backwards reports every good lay as a bad bet, and an
   *  exchange record reads upside down with nothing on screen to explain it. */
  near(closingValuePct(lay(2.0, 2.2)), ((2.2 / 2) - 1) * 100);
  assert.ok(closingValuePct(lay(2.0, 2.2))! > 0, 'laying under the close is a plus');
  assert.ok(closingValuePct(lay(2.2, 2.0))! < 0, 'laying over the close is a minus');
  // The same pair of prices reads the same size on the two sides, opposite ways.
  near(closingValuePct(lay(2.0, 2.2)), closingValuePct(back(2.2, 2.0))!);
  near(closingValuePct(lay(2.2, 2.0)), closingValuePct(back(2.0, 2.2))!);
});

// ----------------------------------------------------------- the aggregate

test('the aggregate counts only the bets that carry a closing price', () => {
  const rows = [back(2.2, 2.0), back(3.0, null), back(2.0, 2.2), back(5.0, null), back(4.0, null)];
  const s = summariseClosing(rows);
  assert.equal(s.recorded, 2);
  assert.equal(s.of, 5);
  /*  Not (10 + -9.09 + 0 + 0 + 0) / 5. The three without a price are not
   *  three zeroes dragging the mean toward nothing. */
  const expected = (closingValuePct(rows[0])! + closingValuePct(rows[2])!) / 2;
  assert.equal(s.meanPct, expected);
});

test('the aggregate always says how many of how many it is made of', () => {
  /*  Two figures, because the module prints them as one: "79 of 259" is the
      thing that decides whether the mean beside it means anything. */
  const s = summariseClosing([back(2.2, 2.0), back(3.0, null), back(3.0, null)]);
  assert.equal(s.recorded, 1);
  assert.equal(s.of, 3);
});

test('an account that has recorded nothing gets a null, never a zero', () => {
  /*  This is what makes the module conditional rather than empty. The
   *  predecessor of this feature printed "Not measured" on every account
   *  every day because no price feed existed, and it was deleted for it. */
  const s = summariseClosing([back(2.0, null), back(3.0, null)]);
  assert.equal(s.recorded, 0);
  assert.equal(s.meanPct, null, 'a mean over nothing is not zero');
  assert.equal(s.bestPct, null);
  assert.equal(s.worstPct, null);
  assert.equal(s.beat + s.matched + s.missed, 0);
});

test('an empty set says so rather than dividing by nothing', () => {
  const s = summariseClosing([]);
  assert.equal(s.of, 0);
  assert.equal(s.meanPct, null);
  assert.equal(s.recorded, 0);
});

test('the three counts partition the bets that carry a price', () => {
  const rows = [back(2.2, 2.0), back(2.0, 2.2), back(2.0, 2.0), back(9.9, null)];
  const s = summariseClosing(rows);
  assert.equal(s.beat + s.matched + s.missed, s.recorded);
  assert.equal(s.beat, 1);
  assert.equal(s.matched, 1);
  assert.equal(s.missed, 1);
});

// ------------------------------------------------------- the example account

test('the example account has closing prices on some bets and not on most', () => {
  /*  Both halves matter. Without any, no screen that shows this figure could
   *  ever be looked at; without the blanks, a screen could ship that has
   *  never been seen with an empty closing price on it. */
  const s = summariseClosing(data.bets);
  assert.ok(s.recorded > 20, `only ${s.recorded} bets carry a closing price`);
  assert.ok(s.recorded < s.of / 2, 'nearly every bet carries one, which is not what a real record looks like');
  assert.equal(s.beat + s.matched + s.missed, s.recorded);
});

test('no multiple carries a closing price, because nobody looks one up for a five fold', () => {
  for (const b of data.bets) {
    if (b.legs.length > 1) assert.equal(b.closingOdds, null, `${b.id} is a multiple with a closing price`);
  }
});

test('every recorded closing price is a price', () => {
  for (const b of data.bets) {
    if (b.closingOdds !== null) assert.ok(isPrice(b.closingOdds), `${b.id} has ${b.closingOdds}`);
  }
});

test('the export carries the closing price, and an empty cell where there is none', () => {
  const rows = exportRows(data.bets);
  const withOne = data.bets.filter((b) => b.closingOdds !== null);
  assert.ok(withOne.length > 0);
  for (let i = 0; i < data.bets.length; i++) {
    const b = data.bets[i];
    assert.equal(rows[i].closing_odds, b.closingOdds == null ? '' : String(b.closingOdds));
    /*  Empty, never "0". A spreadsheet summing this column would count a
        zero as a price of evens and the average would be wrong on every
        bet nobody looked up. */
    assert.notEqual(rows[i].closing_odds, '0');
  }
});

// -------------------------------------------------- nothing fabricates one

test('nothing in the product works a closing price out', () => {
  /*  The deleted module computed nothing and said so; the danger now is the
   *  opposite one, a helpful line somewhere that fills the blank in from the
   *  price taken, the market average or an implied probability. A fabricated
   *  closing price looks exactly like a real one, which is why this is a
   *  test rather than a comment.
   *
   *  The check: closingOdds is only ever assigned from something a person
   *  typed. The one exception is the example account, which stands in for
   *  that person and says so in its own comment. */
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue;
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e.name)) files.push(p);
    }
  };
  walk('app'); walk('components'); walk('lib');

  const ALLOWED = new Set([
    'lib/data/demo.ts',          // the example account, recording on a person's behalf
    'lib/domain/types.ts',       // the field
    'lib/domain/closing.ts',     // reads it, never writes it
    'lib/server/bets.ts',        // reads the column
    'lib/server/export.ts',      // writes it out
  ]);

  /*  The shapes a fabricated price would have: derived from the price taken,
   *  from an implied probability, from an average of anything, or from
   *  arithmetic of any kind. A value that came off a form has none of them. */
  const FABRICATION = /\bodds\b|\bprice\b|implied|probab|average|\bmean\b|[*/+]|Math\./i;

  const offenders: string[] = [];
  for (const f of files) {
    if (ALLOWED.has(f)) continue;
    const src = readFileSync(f, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' ');
    for (const m of src.matchAll(/closingOdds\s*:\s*([^,\n}]+)/g)) {
      const value = m[1].trim();
      if (value === 'null' || !FABRICATION.test(value)) continue;
      offenders.push(`${f}: closingOdds: ${value}`);
    }
  }
  assert.deepEqual(offenders, [], offenders.join('\n'));
});
