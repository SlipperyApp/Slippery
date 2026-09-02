import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoData } from '@/lib/data/demo';
import {
  select, summarise, facets, filterByOutcome, breakdown, orderedBreakdown,
  byDay, byMonth, runningNow, settledToday, offerSplit, DEFAULT_SCOPE, PERIODS,
  sourceFacets, filterBySource, SOURCES, periodStart, cappedUnits, SHAPE_UNIT_CAP,
} from '@/lib/data/analytics';
import { isImportedSource } from '@/lib/domain/types';
import { ODDS_BANDS, STAKE_BANDS } from '@/lib/data/reference';
import { turnoverPence, recompute } from '@/lib/domain/fold';
import type { Bet, SettlementEvent } from '@/lib/domain/types';
import type { DemoBet } from '@/lib/data/demo';
import { zonedParts, DEFAULT_TZ } from '@/lib/format';

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
  /*  Every period, not just the default one.
   *
   *  The counter and the filter were two expressions, and they disagreed
   *  about a bet that is part settled with stake still standing: counted
   *  under Running, dropped by the filter. The example account has none of
   *  those inside a month, so this test passed on the default scope and the
   *  Running chip on the all time view promised ten and delivered three. */
  for (const p of PERIODS) {
    const rows = select(data.bets, { ...DEFAULT_SCOPE, period: p.id }, NOW);
    for (const f of facets(rows).list) {
      assert.equal(filterByOutcome(rows, f.id).length, f.count, `${p.id}: facet ${f.id} promised ${f.count}`);
    }
  }
});

test('a bet that is part settled is counted as running and filters as running', () => {
  const rows = select(data.bets, { ...DEFAULT_SCOPE, period: 'all' }, NOW);
  const part = rows.filter((b) => b.state.status === 'part_settled');
  assert.ok(part.length > 0, 'the example account has no partially cashed out bets left');
  const running = filterByOutcome(rows, 'open');
  for (const b of part) assert.ok(running.includes(b), `${b.id} is counted under Running and filtered out of it`);
});

test('zero count facets are hidden, so no facet reads as an empty promise', () => {
  const rows = select(data.bets, { ...DEFAULT_SCOPE, period: 'today' }, NOW);
  assert.ok(facets(rows).list.every((f) => f.count > 0));
});

// --------------------------------------------------------- source facets

test('the source facets obey the same invariant the outcome facets do', () => {
  /*  The whole reason the facets on this screen can be trusted is that they
   *  are counted off the array the rows come from. A second facet row
   *  counted off anything else would be the 486 / 482 / 474 defect again,
   *  one chip along. */
  for (const p of PERIODS) {
    const rows = select(data.bets, { ...DEFAULT_SCOPE, period: p.id }, NOW);
    const f = sourceFacets(rows);
    assert.equal(f.total, rows.length, `${p.id}: source facets sum to ${f.total}, rows are ${rows.length}`);
    for (const facet of f.list) {
      assert.equal(filterBySource(rows, facet.id).length, facet.count, `${p.id}: ${facet.id} promised ${facet.count}`);
    }
    assert.ok(f.list.every((x) => x.count > 0), `${p.id}: a zero count chip is an empty promise`);
  }
});

test('imported history can be shown, hidden or shown alone, and the three add up', () => {
  const rows = select(data.bets, { ...DEFAULT_SCOPE, period: 'all' }, NOW);
  const all = filterBySource(rows, null);
  const alone = filterBySource(rows, 'imported');
  const hidden = filterBySource(rows, 'own');

  assert.equal(all.length, rows.length, 'no chip pressed shows every bet');
  assert.equal(alone.length + hidden.length, rows.length, 'the two chips partition the rows');
  assert.ok(alone.length > 0, 'the example account has no imported history to filter');
  assert.ok(hidden.length > 0);
  assert.ok(alone.every((b) => isImportedSource(b.source)));
  assert.ok(hidden.every((b) => !isImportedSource(b.source)));
  assert.deepEqual(SOURCES.map((s) => s.id), ['own', 'imported']);
});

test('imported history is never slip backed, because nobody uploaded a slip for it', () => {
  const imported = data.bets.filter((b) => isImportedSource(b.source));
  assert.ok(imported.every((b) => !b.slipBacked));
});

test('a source chip and an outcome chip filter the same rows together', () => {
  // Both filters are applied to one array in the page, so composing them can
  // never produce more rows than either alone.
  const rows = select(data.bets, { ...DEFAULT_SCOPE, period: 'all' }, NOW);
  for (const f of facets(rows).list) {
    const both = filterBySource(filterByOutcome(rows, f.id), 'imported');
    assert.ok(both.length <= f.count);
    assert.ok(both.every((b) => isImportedSource(b.source)));
  }
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

test('a month fold and a month scope disagree by exactly the open bets', () => {
  /*  /app/you drew the Form list from byMonth, which folds SETTLED bets, and
   *  the line under it from summarise over the month scope, which counts
   *  everything in the period. September had three settled and one running,
   *  so the row read "Sep 3" and the foot four inches below read "from 4
   *  bets" over the same net. An open bet contributed nothing to that net.
   *
   *  Both numbers are correct answers to different questions, which is what
   *  makes conflating them easy. This pins the relationship so that a page
   *  showing both has to mean it. */
  const p = zonedParts(NOW, DEFAULT_TZ);
  const key = `${p.year}-${String(p.month).padStart(2, '0')}`;
  const fold = byMonth(data.bets).find((m) => m.key === key);
  const scope = select(data.bets, { ...DEFAULT_SCOPE, period: 'month' }, NOW);
  const open = scope.filter((b) => b.state.status === 'open').length;

  assert.ok(fold, 'no settled bets this month in the example account');
  assert.equal(scope.length - fold.count, open);
  assert.equal(
    fold.netPence,
    scope.filter((b) => b.state.status !== 'open')
      .reduce((a, b) => a + b.state.realisedPlPence, 0),
  );
});

// ------------------------------------------------------- a place is neither

/*  A PLACE COUNTS AS NEITHER A WIN NOR A LOSS. It is out of the win rate on
 *  both sides, exactly like a void, and it has its own count and its own
 *  facet. The reasoning is written above summarise(); this is the part of it
 *  that has to stay true. */

let seq = 0;
function row(over: Partial<Bet>, events: SettlementEvent['type'][]): DemoBet {
  seq += 1;
  const bet: Bet = {
    id: `t${seq}`, accountId: 'a1', shape: 'single', side: 'back',
    stakePence: 1000, liabilityPence: null, odds: 4, currency: 'GBP', fxRate: null,
    bookmakerId: 'bet365', tipsterId: 'own', sportId: 'horse-racing',
    competition: null, course: 'Ascot', eventName: '14:05 Ascot', selection: 'Jonbon',
    marketRaw: 'Win', marketGroupId: null,
    eventAt: '2026-08-30T14:05:00.000Z', placedAt: '2026-08-30T13:00:00.000Z',
    expectedSettleAt: null, isFreeBet: false, isBonusFunds: false, isBoosted: false,
    isEachWay: true, ewPlaceFraction: 0.2, ewPart: 'win', ewGroupId: 'g1', placesPaid: 3,
    slipBacked: true, source: 'telegram', arbGroupId: null, note: null,
    unitPenceAtPlacement: 1000, commissionPct: 0, createdAt: '2026-08-30T13:00:00.000Z',
    legs: [],
    ...over,
  };
  const evs: SettlementEvent[] = events.map((type, i) => ({
    id: `${bet.id}-e${i}`, betId: bet.id, seq: i + 1, type,
    fractionEighths: null, returnedPence: null, deductionPence: null,
    commissionPct: type === 'commission' ? bet.commissionPct : null,
    occurredAt: bet.eventAt, enteredBy: 'system', afterResultKnown: i > 0,
    note: null, createdAt: bet.eventAt,
  }));
  return { ...bet, events: evs, state: recompute(bet, evs, '2026-08-31T12:00:00.000Z') };
}

test('an each way place is Placed on the ledger, out of the win rate, and in the money', () => {
  /*  £10.00 each way at 4.00 on a fifth the odds, third of twelve. The win
   *  part loses £10.00 and the place part wins £6.00, so the bet is £4.00
   *  down and it PLACED. It used to report Lost. */
  const win = row({ ewPart: 'win', odds: 4 }, ['lost']);
  const place = row({ id: 'p1', ewPart: 'place', odds: 1.6, marketRaw: 'Each way place' }, ['placed']);
  const rows = [win, place];

  assert.equal(win.state.outcome, 'lost');
  assert.equal(place.state.outcome, 'placed');

  const s = summarise(rows);
  assert.equal(s.netPence, -400, 'the pair is four pounds down');
  assert.equal(s.placed, 1);
  assert.equal(s.wins, 0, 'a place was counted as a win');
  assert.equal(s.losses, 1, 'only the win part lost');
  assert.equal(s.winRate, 0, 'the selection did not win, so the win rate is zero');

  // Neither means neither: dropping the placed row moves no win rate figure,
  // and moves every money figure.
  const without = summarise(rows.filter((b) => b.state.outcome !== 'placed'));
  assert.equal(without.winRate, s.winRate);
  assert.equal(without.wins, s.wins);
  assert.equal(without.losses, s.losses);
  assert.notEqual(without.netPence, s.netPence);
  assert.notEqual(without.turnoverPence, s.turnoverPence);
  assert.equal(s.turnoverPence, 2000, 'both halves of the stake were turned over');
});

test('a place has its own facet and the facet total still equals the row total', () => {
  const rows = [
    row({ ewPart: 'win', odds: 4 }, ['lost']),
    row({ id: 'p2', ewPart: 'place', odds: 1.6 }, ['placed']),
    row({ id: 'w2', ewPart: 'win', odds: 4 }, ['won']),
  ];
  const f = facets(rows);
  assert.equal(f.total, rows.length);
  assert.equal(f.list.find((x) => x.id === 'placed')?.count, 1);
  assert.equal(filterByOutcome(rows, 'placed').length, 1);
  assert.equal(filterByOutcome(rows, 'won').length, 1, 'a place was filed under Won');
  assert.equal(filterByOutcome(rows, 'lost').length, 1);
});

test('the example account shows its places as Placed, and they never move the win rate', () => {
  const all = select(data.bets, { ...DEFAULT_SCOPE, period: 'all' }, NOW);
  const placed = all.filter((b) => b.state.outcome === 'placed');
  assert.ok(placed.length > 0, 'the example account has no placed bets left to check');

  const s = summarise(all);
  assert.equal(s.placed, placed.filter((b) => !b.arbGroupId).length);
  const without = summarise(all.filter((b) => b.state.outcome !== 'placed'));
  assert.equal(without.wins, s.wins);
  assert.equal(without.losses, s.losses);
  assert.equal(without.winRate, s.winRate);
});

// ----------------------------------------------------- commission aggregates

test('commission lands in net, in return and in every aggregate that reads them', () => {
  /*  £50.00 at 3.00 on a 2% exchange: £150.00 back, £100.00 of net winnings,
   *  £2.00 charged, £98.00 kept. Every figure below has to be the charged
   *  one, because they all read the same folded realised figure. */
  const charged = row({
    id: 'x1', stakePence: 5000, odds: 3, bookmakerId: 'betfair-exchange',
    commissionPct: 2, isEachWay: false, ewPart: null, ewGroupId: null,
    ewPlaceFraction: null, placesPaid: null, sportId: 'football',
    marketRaw: 'Match result', unitPenceAtPlacement: 5000,
  }, ['won', 'commission']);

  assert.equal(charged.state.realisedPlPence, 9800);
  assert.equal(charged.state.returnedPence, 14800);

  const s = summarise([charged]);
  assert.equal(s.netPence, 9800, 'the banner is the overstated figure');
  assert.equal(s.returnedPence, 14800);
  assert.equal(s.turnoverPence, 5000, 'commission never touches turnover');
  assert.equal(s.roi, 196, 'return is worked on the charged profit');
  assert.equal(s.units, 1.96);

  assert.equal(breakdown([charged], 'bookmaker')[0].netPence, 9800);
  assert.equal(breakdown([charged], 'bookmaker')[0].roi, 196);
  assert.equal(byDay([charged])[0].netPence, 9800);
  assert.equal(byMonth([charged])[0].netPence, 9800);
  assert.equal(offerSplit([charged]).ownNetPence, 9800);

  // The same bet with the charge missing is the defect: two pounds too good.
  const uncharged = row({
    id: 'x2', stakePence: 5000, odds: 3, bookmakerId: 'betfair-exchange',
    commissionPct: 2, isEachWay: false, ewPart: null, ewGroupId: null,
    ewPlaceFraction: null, placesPaid: null, sportId: 'football',
    marketRaw: 'Match result', unitPenceAtPlacement: 5000,
  }, ['won']);
  assert.equal(summarise([uncharged]).netPence - s.netPence, 200);
});

// ------------------------------------------------------- the account's zone

/*  THE BET AT 23:40.
 *
 *  Every day boundary here used to be Europe/London, and worse, the boundary
 *  and the label were computed two different ways: byDay asked Intl for the
 *  zoned day while periodStart took the zoned year, month and day and handed
 *  them to Date.UTC, which is that day's midnight in UTC and an hour early
 *  through British summer time. So a bet in that hour was drawn on the
 *  calendar under one day and counted in the period totals under another.
 *
 *  These pin both halves against the same instant, in three zones. */

const LATE = '2026-08-12T22:40:00Z';       // 23:40 in Dublin, 00:40 in Madrid

function lateBet(): DemoBet {
  return row({ id: 'late-1', eventAt: LATE, placedAt: LATE, isEachWay: false, ewGroupId: null, ewPart: null }, ['won']);
}

test('periodStart is local midnight, not the server midnight of a local date', () => {
  // 13 August, at 08:00 in each zone, so "today" is unambiguously the 13th.
  const dublinMorning = new Date('2026-08-13T07:00:00Z');
  assert.equal(
    periodStart('today', dublinMorning, 1, 'Europe/Dublin')!.toISOString(),
    '2026-08-12T23:00:00.000Z',
  );
  assert.equal(
    periodStart('today', dublinMorning, 1, 'UTC')!.toISOString(),
    '2026-08-13T00:00:00.000Z',
  );
});

test('a 23:40 Irish bet is in Today for a Dublin account and not for a Madrid one', () => {
  /*  One instant, two accounts. In Dublin it is 23:40 on the 12th, so on the
   *  13th it is yesterday's bet. In Madrid the same instant is 00:40 on the
   *  13th, so it belongs to today. Both answers are right for the person
   *  reading them, which is the whole reason the zone is on the account. */
  const bets = [lateBet()];
  const onThe13th = new Date('2026-08-13T09:00:00Z');

  const dublinToday = select(bets, { ...DEFAULT_SCOPE, period: 'today' }, onThe13th, 1, 'Europe/Dublin');
  assert.equal(dublinToday.length, 0, 'a 23:40 bet from last night is not today');

  const madridToday = select(bets, { ...DEFAULT_SCOPE, period: 'today' }, onThe13th, 1, 'Europe/Madrid');
  assert.equal(madridToday.length, 1, 'a 00:40 bet this morning is today');
});

test('the day a bet is counted in is the day it is drawn on', () => {
  /*  The two halves that disagreed. byDay names the day and periodStart
   *  bounds it, so for every zone the bet has to be inside the window of the
   *  day byDay filed it under, and outside the next one. */
  const bets = [lateBet()];
  for (const tz of ['Europe/London', 'Europe/Dublin', 'Europe/Madrid', 'UTC', 'Australia/Sydney']) {
    const [point] = byDay(bets, tz);
    const noonThatDay = new Date(`${point.day}T12:00:00Z`);
    const today = select(bets, { ...DEFAULT_SCOPE, period: 'today' }, noonThatDay, 1, tz);
    assert.equal(today.length, 1, `${tz}: drawn on ${point.day} and not counted in it`);
  }
});

test('a bet in the small hours of the first of a month counts in that month', () => {
  /*  The same defect one scale up. 1 September 2026 begins at 23:00Z on 31
   *  August in London, so a 00:30 kick off on the 1st is an August timestamp
   *  and the month window has to know it. */
  const firstAt0030 = row(
    { id: 'sep-1', eventAt: '2026-08-31T23:30:00Z', placedAt: '2026-08-31T23:30:00Z', isEachWay: false, ewGroupId: null, ewPart: null },
    ['won'],
  );
  const midSeptember = new Date('2026-09-15T12:00:00Z');
  const inMonth = select([firstAt0030], { ...DEFAULT_SCOPE, period: 'month' }, midSeptember, 1, 'Europe/London');
  assert.equal(inMonth.length, 1, 'a 00:30 kick off on the 1st fell into August');
  assert.equal(byMonth([firstAt0030], 'Europe/London')[0].key, '2026-09');
});

test('the week window starts at local midnight on the week start day', () => {
  // Monday 10 August 2026, read at midday on the Wednesday.
  const wednesday = new Date('2026-08-12T11:00:00Z');
  assert.equal(
    periodStart('week', wednesday, 1, 'Europe/London')!.toISOString(),
    '2026-08-09T23:00:00.000Z',
  );
  assert.equal(
    periodStart('week', wednesday, 0, 'Europe/London')!.toISOString(),
    '2026-08-08T23:00:00.000Z',
  );
});

test('settledToday answers in the account zone', () => {
  const bets = [lateBet()];
  const onThe13th = new Date('2026-08-13T09:00:00Z');
  assert.equal(settledToday(bets, onThe13th, 'Europe/Dublin').length, 0);
  assert.equal(settledToday(bets, onThe13th, 'Europe/Madrid').length, 1);
});

// ------------------------------------------------------- the three unit cap

/*  THE SHAPE CHARTS DRAW UNITS, AND A UNIT IS CAPPED AT THREE.
 *
 *  A running total in raw money has one shape whenever a single bet dwarfs
 *  the rest: one vertical wall and a flat line either side of it, with every
 *  other bet drawn at a pixel. The chart that exists to say "steadily, or on
 *  one Saturday" can then say neither. And it flatters: a forty unit win is a
 *  forty unit STAKE that came in, and drawn full size it looks like the shape
 *  of somebody's judgement.
 *
 *  So the DISPLAYED contribution is clamped and NOTHING ELSE IS. */

test('one bet cannot contribute more than three units to a shape', () => {
  assert.equal(cappedUnits(0.4), 0.4);
  assert.equal(cappedUnits(3), 3);
  assert.equal(cappedUnits(40), SHAPE_UNIT_CAP);
  assert.equal(cappedUnits(-40), -SHAPE_UNIT_CAP);
  assert.equal(cappedUnits(Number.NaN), 0, 'a bet with no units draws nothing, never a wall');
});

test('a forty unit bet is drawn at three and reported at forty', () => {
  const unit = 1000;
  const small = row(
    { id: 'small', stakePence: unit, odds: 2, isEachWay: false, ewGroupId: null, ewPart: null, unitPenceAtPlacement: unit, eventAt: '2026-08-01T14:00:00Z' },
    ['won'],
  );
  const huge = row(
    { id: 'huge', stakePence: unit * 40, odds: 2, isEachWay: false, ewGroupId: null, ewPart: null, unitPenceAtPlacement: unit, eventAt: '2026-08-02T14:00:00Z' },
    ['won'],
  );
  assert.equal(small.state.units, 1);
  assert.equal(huge.state.units, 40, 'the fold reports the true size');

  const [r] = breakdown([small, huge], 'sport');
  assert.equal(r.count, 2);
  // The FIGURE is the true money: one unit and forty units both won at 2.00.
  assert.equal(r.netPence, unit + unit * 40);
  assert.equal(r.units, 41);
  // The SHAPE is 1 then 1 + 3.
  assert.deepEqual(r.spark, [1, 4]);
  assert.equal(r.capped, true, 'a row that clamped anything has to say so');
});

test('a row inside the cap is not marked, and its shape is its real one', () => {
  const unit = 1000;
  const bets = [1, 2, 1.5].map((u, i) => row(
    {
      id: `ok${i}`, stakePence: unit * u, odds: 2, isEachWay: false, ewGroupId: null,
      ewPart: null, unitPenceAtPlacement: unit, eventAt: `2026-08-0${i + 1}T14:00:00Z`,
    },
    ['won'],
  ));
  const [r] = breakdown(bets, 'sport');
  assert.equal(r.capped, false);
  assert.deepEqual(r.spark.map((x) => Number(x.toFixed(2))), [1, 3, 4.5]);
});

test('the cap changes no figure, only the picture', () => {
  /*  The defect the cap must not become. If clamping ever reaches net,
   *  turnover, return or units, the chart has started editing the record. */
  const unit = 1000;
  const bets = [
    row({ id: 'a', stakePence: unit * 40, odds: 2, isEachWay: false, ewGroupId: null, ewPart: null, unitPenceAtPlacement: unit, eventAt: '2026-08-01T14:00:00Z' }, ['won']),
    row({ id: 'b', stakePence: unit, odds: 2, isEachWay: false, ewGroupId: null, ewPart: null, unitPenceAtPlacement: unit, eventAt: '2026-08-02T14:00:00Z' }, ['lost']),
  ];
  const s = summarise(bets);
  const [r] = breakdown(bets, 'sport');
  assert.equal(s.units, 39);
  assert.equal(r.units, 39, 'the row figure is the true unit count');
  assert.equal(r.netPence, s.netPence);
  assert.equal(r.turnoverPence, s.turnoverPence);
  assert.ok(Math.abs(r.roi - s.roi) < 1e-9);
});

test('an open bet is in no shape, capped or otherwise', () => {
  const unit = 1000;
  const open = row(
    { id: 'open', stakePence: unit * 40, odds: 2, isEachWay: false, ewGroupId: null, ewPart: null, unitPenceAtPlacement: unit, eventAt: '2026-08-01T14:00:00Z' },
    [],
  );
  const [r] = breakdown([open], 'sport');
  assert.deepEqual(r.spark, [], 'nothing has settled, so there is no line');
  assert.equal(r.capped, false, 'a bet that has not settled has clamped nothing');
});

test('the banded breakdowns cap the same way', () => {
  const unit = 1000;
  const bets = [
    row({ id: 'x', stakePence: unit * 40, odds: 2, isEachWay: false, ewGroupId: null, ewPart: null, unitPenceAtPlacement: unit, eventAt: '2026-08-01T14:00:00Z' }, ['won']),
    row({ id: 'y', stakePence: unit * 40, odds: 2, isEachWay: false, ewGroupId: null, ewPart: null, unitPenceAtPlacement: unit, eventAt: '2026-08-02T14:00:00Z' }, ['won']),
  ];
  const over = orderedBreakdown(bets, 'stake', unit).find((b) => b.key === 'over-five');
  assert.ok(over);
  assert.equal(over.capped, true);
  assert.deepEqual(over.spark, [3, 6], 'two forty unit winners draw three each');
  assert.equal(over.units, 80, 'and are reported at eighty');
});
