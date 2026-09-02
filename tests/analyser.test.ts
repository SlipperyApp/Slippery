import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoData } from '@/lib/data/demo';
import { select, summarise, DEFAULT_SCOPE, PERIODS, THIN_BETS } from '@/lib/data/analytics';
import {
  AXES, COLUMNS, axisFromParam, bucketOf, columnFromParam, crosstab,
  defaultSort, isOrdered, sortCells, type Axis, type AxisContext,
} from '@/lib/data/analyser';
import { inBalance } from '@/lib/domain/balances';
import { isInPlay } from '@/lib/domain/types';

const NOW = new Date('2026-08-31T12:00:00Z');
const data = demoData(NOW);
const main = data.balances[0];
const rows = inBalance(data.bets, main.id);

const ctx: AxisContext = { unitPence: main.unitMinor, tz: 'Europe/London', weekStart: 1 };
const ALL: Axis[] = AXES.map((a) => a.id);

// ------------------------------------------------------------------ rule 5

test('every axis partitions the selection, so the rows sum to the total row', () => {
  /*  RULE 5 OF THE CODEBASE, and the only thing that stops an analyser
   *  lying. The total is folded from the whole array; the rows are folded
   *  from its parts. If those two ever disagree, every figure on the screen
   *  is unsourceable. */
  for (const axis of ALL) {
    const tab = crosstab(rows, axis, null, ctx);
    assert.equal(tab.rows.reduce((a, c) => a + c.bets, 0), rows.length, `${axis}: bets`);
    assert.equal(tab.total.bets, rows.length, `${axis}: total`);
    assert.equal(tab.rows.reduce((a, c) => a + c.netMinor, 0), tab.total.netMinor, `${axis}: net`);
    assert.equal(tab.rows.reduce((a, c) => a + c.stakedMinor, 0), tab.total.stakedMinor, `${axis}: staked`);
    assert.equal(tab.rows.reduce((a, c) => a + c.returnedMinor, 0), tab.total.returnedMinor, `${axis}: returned`);
    assert.equal(tab.rows.reduce((a, c) => a + c.won, 0), tab.total.won, `${axis}: won`);
    assert.equal(tab.rows.reduce((a, c) => a + c.lost, 0), tab.total.lost, `${axis}: lost`);
    assert.equal(tab.rows.reduce((a, c) => a + c.voided, 0), tab.total.voided, `${axis}: void`);
  }
});

test('every PAIR of axes partitions it too, which is where a cross tab usually goes wrong', () => {
  /*  Crossing is where double counting creeps in: a bet that landed in two
   *  cells looks like more history than there is, and the total is the only
   *  thing that would notice. */
  for (const a of ALL) {
    for (const b of ALL) {
      if (a === b) continue;
      const tab = crosstab(rows, a, b, ctx);
      assert.equal(tab.rows.reduce((x, c) => x + c.bets, 0), rows.length, `${a} by ${b}: bets`);
      assert.equal(tab.rows.reduce((x, c) => x + c.netMinor, 0), tab.total.netMinor, `${a} by ${b}: net`);
    }
  }
});

test('the total row is the ledger summary of the same selection, not a sum of the cells', () => {
  const s = summarise(rows);
  for (const axis of ALL) {
    const tab = crosstab(rows, axis, null, ctx);
    assert.equal(tab.total.bets, s.count);
    assert.equal(tab.total.netMinor, s.netPence);
    assert.equal(tab.total.turnoverMinor, s.turnoverPence);
    assert.equal(tab.total.roi, s.roi);
    assert.equal(tab.total.winRate, s.winRate);
    assert.equal(tab.total.avgOdds, s.avgOdds);
    assert.equal(tab.total.units, s.units);
  }
});

test('every cell is the ledger summary of its own bets', () => {
  /*  Nothing in the analyser does its own arithmetic. If a cell disagreed
   *  with summarise() over the same bets, the analyser would be a second
   *  implementation of the ledger and the two would drift. */
  for (const axis of ALL) {
    const tab = crosstab(rows, axis, null, ctx);
    for (const c of tab.rows) {
      const mine = rows.filter((b) => bucketOf(b, axis, ctx).key === c.key);
      const s = summarise(mine);
      assert.equal(c.bets, s.count, `${axis}/${c.key}`);
      assert.equal(c.netMinor, s.netPence, `${axis}/${c.key}`);
      assert.equal(c.roi, s.roi, `${axis}/${c.key}`);
      assert.equal(c.winRate, s.winRate, `${axis}/${c.key}`);
      assert.equal(c.avgOdds, s.avgOdds, `${axis}/${c.key}`);
    }
  }
});

test('the invariant holds in every period, not just the one the demo opens on', () => {
  for (const p of PERIODS) {
    const sel = select(rows, { ...DEFAULT_SCOPE, period: p.id }, NOW);
    const tab = crosstab(sel, 'bookmaker', 'odds', ctx);
    assert.equal(tab.rows.reduce((a, c) => a + c.bets, 0), sel.length, p.id);
    assert.equal(tab.total.bets, sel.length, p.id);
  }
});

// ------------------------------------------------------------------ groups

test('a bet lands in exactly one bucket on every axis', () => {
  for (const axis of ALL) {
    for (const b of rows) {
      const k = bucketOf(b, axis, ctx);
      assert.equal(typeof k.key, 'string');
      assert.ok(k.key.length > 0, `${axis}: empty key on ${b.id}`);
      assert.ok(k.label.length > 0, `${axis}: empty label on ${b.id}`);
    }
  }
});

test('an ordered axis draws its empty bands, and a crossed one does not', () => {
  /*  A band that is missing reads as a band you did not bet in only if it is
   *  still drawn. Crossed, six bands against seven days is forty two rows of
   *  which most are blank, and a table of blanks reads as nothing. */
  const alone = crosstab(rows, 'odds', null, ctx);
  const empties = alone.rows.filter((c) => c.bets === 0);
  assert.ok(alone.rows.length >= 6, 'the odds bands are not all drawn');

  const crossed = crosstab(rows, 'odds', 'sport', ctx);
  assert.ok(crossed.rows.every((c) => c.bets > 0), 'a crossed table drew an empty combination');
  // The empties change no figure, which is why they are safe to draw.
  assert.equal(empties.reduce((a, c) => a + c.netMinor, 0), 0);
});

test('an unordered axis draws only the groups the record contains', () => {
  const tab = crosstab(rows, 'bookmaker', null, ctx);
  assert.ok(tab.rows.every((c) => c.bets > 0), 'a bookmaker with no bets was drawn');
});

test('the in play axis has both groups on it, or the screen has never done its job', () => {
  const tab = crosstab(rows, 'live', null, ctx);
  assert.equal(tab.rows.length, 2, tab.rows.map((r) => r.label).join(', '));
  const live = rows.filter(isInPlay);
  assert.ok(live.length > 0, 'the example account has no in play bets');
  assert.equal(tab.rows.find((r) => r.key === 'live')!.bets, live.length);
});

test('a day of the week starts where the account calendar starts', () => {
  const monday = crosstab(rows, 'weekday', null, { ...ctx, weekStart: 1 });
  const sunday = crosstab(rows, 'weekday', null, { ...ctx, weekStart: 0 });
  const first = (t: typeof monday) => sortCells(t, 'group', 'asc')[0].label;
  assert.equal(first(monday), 'Monday');
  assert.equal(first(sunday), 'Sunday');
  // And the counts are identical: only the order moved.
  assert.equal(monday.total.bets, sunday.total.bets);
});

test('a bet with no competition is its own group rather than dropped or folded in', () => {
  /*  Either of the other two answers breaks the row total: dropping loses
   *  bets, folding moves them into a row that did not have them. */
  const tab = crosstab(rows, 'competition', null, ctx);
  assert.equal(tab.rows.reduce((a, c) => a + c.bets, 0), rows.length);
});

// -------------------------------------------------------------------- thin

test('a group under the threshold is marked and its figures are still there', () => {
  /*  Crossed, because crossing is what makes cells small and small cells are
   *  exactly where an unmarked return does its damage: a competition and an
   *  odds band together is three bets often enough that somebody will read
   *  one and believe it. */
  const tab = crosstab(rows, 'competition', 'odds', ctx);
  const thin = tab.rows.filter((c) => c.thin && c.bets > 0);
  assert.ok(thin.length > 0, 'no thin group in the example account, so this proves nothing');
  for (const c of thin) {
    assert.ok(c.bets < THIN_BETS);
    /*  Marked, never blanked. Hiding the figures would be a different lie,
     *  and somebody who wants them should be able to read them. */
    assert.equal(typeof c.roi, 'number');
    assert.equal(typeof c.netMinor, 'number');
  }
  for (const c of tab.rows.filter((x) => !x.thin)) assert.ok(c.bets >= THIN_BETS);
});

// -------------------------------------------------------------------- sort

test('every column sorts, both ways, and moves no figure', () => {
  const tab = crosstab(rows, 'bookmaker', null, ctx);
  for (const col of [...COLUMNS.map((c) => c.id), 'group']) {
    for (const dir of ['asc', 'desc'] as const) {
      const sorted = sortCells(tab, col, dir);
      assert.equal(sorted.length, tab.rows.length, `${col}/${dir}: rows appeared or vanished`);
      assert.equal(
        sorted.reduce((a, c) => a + c.netMinor, 0),
        tab.rows.reduce((a, c) => a + c.netMinor, 0),
        `${col}/${dir}: sorting changed the net`,
      );
      if (col !== 'group') {
        const get = COLUMNS.find((c) => c.id === col)!.get;
        for (let i = 1; i < sorted.length; i++) {
          const a = Number(get(sorted[i - 1]));
          const b = Number(get(sorted[i]));
          assert.ok(dir === 'asc' ? a <= b : a >= b, `${col}/${dir} out of order at ${i}`);
        }
      }
    }
  }
});

test('an ordered axis sorted by its group column keeps its band order', () => {
  /*  "1.50 to 2.00" before "10.00 and up" is the whole read of a price
   *  ladder. A to Z is not a fact about odds. */
  const tab = crosstab(rows, 'odds', null, ctx);
  const sorted = sortCells(tab, 'group', 'asc');
  assert.deepEqual(sorted.map((c) => c.label), [
    'Under 1.50', '1.50 to 2.00', '2.00 to 3.00', '3.00 to 5.00', '5.00 to 10.00', '10.00 and up',
  ]);
});

test('the sort is stable, so a table cannot shuffle itself between two renders', () => {
  const tab = crosstab(rows, 'competition', null, ctx);
  const once = sortCells(tab, 'won', 'desc').map((c) => c.key);
  const twice = sortCells(tab, 'won', 'desc').map((c) => c.key);
  assert.deepEqual(once, twice);
});

test('a table opens on the reading that answers the question', () => {
  assert.deepEqual(defaultSort('odds'), { column: 'group', dir: 'asc' });
  assert.deepEqual(defaultSort('bookmaker'), { column: 'net', dir: 'desc' });
  for (const a of ALL) {
    const d = defaultSort(a);
    assert.equal(d.column === 'group', isOrdered(a), `${a} opens on ${d.column}`);
  }
});

// --------------------------------------------------- hostile query strings

test('a prototype key is not an axis and not a column', () => {
  /*  /api/share?period=toString returned 500 on the live site for weeks: a
   *  plain object literal inherits from Object.prototype, so every prototype
   *  key reads as a hit and the `?? fallback` never fires. These are matched
   *  against a list. */
  for (const poison of ['toString', 'constructor', '__proto__', 'valueOf', 'hasOwnProperty', 'prototype']) {
    assert.equal(axisFromParam(poison), null, poison);
    assert.equal(columnFromParam(poison), null, poison);
  }
  assert.equal(axisFromParam(undefined), null);
  assert.equal(axisFromParam(42), null);
  assert.equal(axisFromParam('bookmaker'), 'bookmaker');
  assert.equal(columnFromParam('net'), 'net');
  assert.equal(columnFromParam('group'), 'group');
});

test('the analyser reports every figure the record has, and each one once', () => {
  const ids = COLUMNS.map((c) => c.id);
  for (const required of ['bets', 'won', 'lost', 'void', 'staked', 'returned', 'net', 'roi', 'units', 'winRate', 'avgOdds']) {
    assert.ok(ids.includes(required), `${required} is not a column`);
  }
  assert.equal(new Set(ids).size, ids.length, 'a column is listed twice');
});
