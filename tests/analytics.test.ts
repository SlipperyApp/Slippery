import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoData } from '@/lib/data/demo';
import {
  select, summarise, facets, filterByOutcome, breakdown, orderedBreakdown,
  byDay, byMonth, runningNow, settledToday, offerSplit, DEFAULT_SCOPE, PERIODS,
} from '@/lib/data/analytics';
import { ODDS_BANDS, STAKE_BANDS } from '@/lib/data/reference';
import { turnoverPence } from '@/lib/domain/fold';

const NOW = new Date('2026-08-31T12:00:00Z');
const data = demoData(NOW);

test('the example account has a real amount of history', () => {
  assert.ok(data.bets.length > 150, `only ${data.bets.length} bets`);
});

test('every count derives from one query, so the facet total equals the row total', () => {
  // The previous build had a banner saying 486, a ledger saying 482 and
  // facets summing to 474.
  for (const p of PERIODS) {
    const rows = select(data.bets, { ...DEFAULT_SCOPE, period: p.id }, NOW);
    const f = facets(rows);
    const s = summarise(rows);
    assert.equal(f.total, rows.length, `${p.id}: facets sum to ${f.total}, rows are ${rows.length}`);
    assert.equal(s.count, rows.length, `${p.id}: summary count disagrees with the row count`);
  }
});

test('selecting a facet returns exactly the number the facet promised', () => {
  const rows = select(data.bets, DEFAULT_SCOPE, NOW);
  for (const f of facets(rows).list) {
    assert.equal(filterByOutcome(rows, f.id).length, f.count, `facet ${f.id} promised ${f.count}`);
  }
});

test('zero count facets are hidden, so no facet reads as an empty promise', () => {
  const rows = select(data.bets, { ...DEFAULT_SCOPE, period: 'today' }, NOW);
  assert.ok(facets(rows).list.every((f) => f.count > 0));
});

test('a breakdown sums back to the same net as the summary', () => {
  const rows = select(data.bets, { ...DEFAULT_SCOPE, period: 'all' }, NOW);
  const s = summarise(rows);
  for (const dim of ['sport', 'market', 'tipster', 'bookmaker'] as const) {
    const b = breakdown(rows, dim);
    assert.equal(b.reduce((a, r) => a + r.count, 0), rows.length, `${dim} counts`);
    assert.equal(b.reduce((a, r) => a + r.netPence, 0), s.netPence, `${dim} net`);
  }
});

test('rows under five bets are marked thin, so volume outranks luck', () => {
  const rows = select(data.bets, { ...DEFAULT_SCOPE, period: 'all' }, NOW);
  for (const r of breakdown(rows, 'bookmaker')) {
    assert.equal(r.thin, r.count < 5);
  }
});

test('ordered dimensions keep their order and are never sorted by value', () => {
  const rows = select(data.bets, { ...DEFAULT_SCOPE, period: 'all' }, NOW);
  const odds = orderedBreakdown(rows, 'odds', 2500);
  assert.deepEqual(odds.map((r) => r.key), ODDS_BANDS.map((b) => b.id));
  const stake = orderedBreakdown(rows, 'stake', 2500);
  assert.deepEqual(stake.map((r) => r.key), STAKE_BANDS.map((b) => b.id));
});

test('stake buckets derive from the unit, not from pounds', () => {
  const rows = select(data.bets, { ...DEFAULT_SCOPE, period: 'all' }, NOW);
  // Doubling the unit must move bets down the bands, which a pound bucket
  // could not do.
  const a = orderedBreakdown(rows, 'stake', 2500).map((r) => r.count).join(',');
  const b = orderedBreakdown(rows.map((r) => ({ ...r, unitPenceAtPlacement: 5000 })), 'stake', 5000).map((r) => r.count).join(',');
  assert.notEqual(a, b);
});

test('turnover excludes voided stake everywhere', () => {
  const rows = select(data.bets, { ...DEFAULT_SCOPE, period: 'all' }, NOW);
  const s = summarise(rows);
  const manual = rows.reduce((acc, b) => acc + turnoverPence(b, b.state), 0);
  assert.equal(s.turnoverPence, manual);
  assert.ok(s.turnoverPence <= s.stakedPence);
});

test('ROI uses turnover as its denominator, not stake', () => {
  const rows = select(data.bets, { ...DEFAULT_SCOPE, period: 'all' }, NOW);
  const s = summarise(rows);
  assert.ok(Math.abs(s.roi - (s.netPence / s.turnoverPence) * 100) < 1e-9);
});

test('the headline splits money you won from money they gave you', () => {
  const s = summarise(select(data.bets, { ...DEFAULT_SCOPE, period: 'all' }, NOW));
  assert.equal(s.netRealPence + s.netPromoPence, s.netPence);
});

test('offers versus own is always all time and adds up', () => {
  const o = offerSplit(data.bets);
  const settled = data.bets.filter((b) => b.state.status !== 'open');
  assert.equal(o.ownCount + o.offerCount, settled.length);
});

test('no future day carries a value', () => {
  const days = byDay(data.bets);
  const today = '2026-08-31';
  assert.ok(days.every((d) => d.day <= today), 'a day after today has a figure on it');
});

test('running now contains only open bets, and settled today only closed ones', () => {
  assert.ok(runningNow(data.bets).every((b) => b.state.status === 'open'));
  assert.ok(settledToday(data.bets, NOW).every((b) => b.state.status !== 'open'));
});

test('month by month covers every month with settled bets', () => {
  const months = byMonth(data.bets);
  assert.ok(months.length >= 5, `only ${months.length} months`);
  const total = months.reduce((a, m) => a + m.netPence, 0);
  const settledNet = data.bets.filter((b) => b.state.status !== 'open')
    .reduce((a, b) => a + b.state.realisedPlPence, 0);
  assert.equal(total, settledNet);
});

test('the example account exercises every bet shape the reader claims', () => {
  const shapes = new Set(data.bets.map((b) => b.shape));
  assert.ok(shapes.has('single'));
  assert.ok(shapes.has('multi_cross_fixture'), 'no multiples: settleMulti would be dead code again');
  assert.ok(shapes.has('each_way'));
  const sides = new Set(data.bets.map((b) => b.side));
  assert.ok(sides.has('lay'));
});

test('multiples actually settle end to end, not just in a unit test', () => {
  const multis = data.bets.filter((b) => b.shape === 'multi_cross_fixture' && b.state.status === 'settled');
  assert.ok(multis.length > 10, `only ${multis.length} settled multiples`);
  // Each one folded to a real outcome through the same recompute production
  // uses, with its legs graded first.
  assert.ok(multis.every((b) => b.state.outcome !== null));
  assert.ok(multis.every((b) => b.legs.every((l) => l.legResult !== 'open')));
  assert.ok(multis.some((b) => b.legs.some((l) => l.legResult === 'void')), 'no void leg ever dropped');
});

test('each way pairs settle independently and both parts exist', () => {
  const ew = data.bets.filter((b) => b.shape === 'each_way');
  const groups = new Map<string, number>();
  for (const b of ew) groups.set(b.ewGroupId!, (groups.get(b.ewGroupId!) ?? 0) + 1);
  assert.ok(groups.size > 5);
  assert.ok([...groups.values()].every((n) => n === 2), 'every each way bet has exactly two parts');
});

test('the dataset is deterministic for a given day', () => {
  const a = demoData(NOW).bets.length;
  const b = demoData(new Date('2026-08-31T23:00:00Z')).bets.length;
  assert.equal(a, b);
});
