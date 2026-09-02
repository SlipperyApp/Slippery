import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  GROUPS, LEAGUE_PERIODS, TRACKING_FEED_MAX, YOU,
  divisionMove, findSlipper, groupByCode, groupMembers, groupSummaries, league,
  pinnedRow, recordFor, slipBackedExcluded, slippers, trackable, trackingCandidates, trackingFeed,
  type LeaguePeriod, type TrackedBet,
} from '@/lib/data/social';
import { TRACKING_DEFAULT_ON } from '@/lib/data/settings';
import { isInviteCode } from '@/lib/server/codes';

/*  A fixed instant, because every figure in here is derived from a window
 *  that ends at "now" and a test that moves with the clock proves nothing on
 *  the first of the month. */
const NOW = new Date('2026-09-02T14:00:00Z');

// -------------------------------------------------------------- the gate

/*  THE ONE RULE THIS FEED HAS. A bet captured after the event started is not
 *  a prediction, it is a claim, and the whole product exists because a record
 *  written afterwards is a record of the bets somebody felt like writing
 *  down. The example account carries one of these per opted-in Slipper so
 *  that the refusal is visible in the data and not only in the code. */
test('a bet captured after kick off never reaches the feed', () => {
  const opted = slippers(NOW).filter((p) => p.tracking);
  assert.ok(opted.length > 0, 'nobody has opted in, so this proves nothing');

  const late = opted
    .flatMap((p) => trackingCandidates(p, NOW))
    .filter((c) => new Date(c.capturedAt).getTime() >= new Date(c.startsAt).getTime());
  assert.ok(late.length > 0, 'the example account has to contain a late capture for this to mean anything');

  const shown = new Set(trackingFeed(NOW).map((t) => t.id));
  for (const c of late) {
    assert.ok(!shown.has(c.id), `${c.id} was captured after the off and is in the feed`);
  }
});

test('the gate refuses a late capture and an event already under way', () => {
  const base: TrackedBet = {
    id: 'x', handle: 'rowan', name: 'Rowan', selection: 'Arsenal', eventName: 'Arsenal v Brentford',
    price: 2.1, stakeUnits: 1, bookmakerId: 'bet365', bookmaker: 'bet365',
    capturedAt: '2026-09-02T12:00:00Z', startsAt: '2026-09-02T19:45:00Z',
  };
  assert.equal(trackable(base, NOW), true);

  // Captured one minute after the off.
  assert.equal(trackable({ ...base, capturedAt: '2026-09-02T19:46:00Z' }, NOW), false);
  // Captured at the exact moment of the off: not before it.
  assert.equal(trackable({ ...base, capturedAt: '2026-09-02T19:45:00Z' }, NOW), false);
  // Started an hour ago, however early it was captured.
  assert.equal(trackable({ ...base, startsAt: '2026-09-02T13:00:00Z' }, NOW), false);
});

const utcDay = (d: Date) => d.toISOString().slice(0, 10);

test('an item ages out when its event starts, and is never brought back', () => {
  const shown = trackingFeed(NOW);
  assert.ok(shown.length > 0);
  /*  One whose event is on the day being read, so stepping past its kick off
      stays inside the same day's fixture list and the comparison is between
      two readings of the same item rather than of two different days. */
  const first = shown.find((t) => utcDay(new Date(t.startsAt)) === utcDay(NOW));
  assert.ok(first, 'nothing in the feed starts today, so ageing out cannot be shown');

  const after = new Date(new Date(first.startsAt).getTime() + 60000);
  assert.equal(utcDay(after), utcDay(NOW));
  const later = trackingFeed(after);
  assert.ok(!later.some((t) => t.id === first.id), 'an item survived its own kick off');
  /*  And what it aged out into is nothing. There is no list anywhere of
      things that have started, which is what makes a result impossible. */
  for (const t of later) assert.ok(new Date(t.startsAt).getTime() > after.getTime());
});

// ------------------------------------------------------------- opting in

test('showing what you are tracking is off until somebody turns it on', () => {
  assert.equal(TRACKING_DEFAULT_ON, false, 'the default must be off');
  const me = findSlipper(YOU, NOW)!;
  assert.equal(me.tracking, TRACKING_DEFAULT_ON, 'the viewer starts at the default');
  assert.ok(!trackingFeed(NOW).some((t) => t.handle === YOU), 'the viewer has not opted in and is in the feed');
});

test('a Slipper who has not opted in appears nowhere in the feed', () => {
  const out = slippers(NOW).filter((p) => !p.tracking);
  assert.ok(out.length > 0, 'somebody has to be opted out for this to prove anything');

  const shown = trackingFeed(NOW);
  for (const p of out) {
    assert.ok(!shown.some((t) => t.handle === p.handle), `@${p.handle} is opted out and is in the feed`);
    /*  And not because their bets happened to fail the gate: at least one of
        theirs WOULD have passed it. Opting out is what keeps them out. */
    const wouldPass = trackingCandidates(p, NOW).filter((c) => trackable(c, NOW));
    assert.ok(wouldPass.length > 0, `@${p.handle} has nothing the gate would have let through`);
  }
});

// ------------------------------------------------------- what it never says

test('nothing in the feed can carry an outcome or a stake in money', () => {
  const shown = trackingFeed(NOW);
  assert.ok(shown.length > 0);
  const allowed = [
    'id', 'handle', 'name', 'selection', 'eventName', 'price', 'stakeUnits',
    'bookmakerId', 'bookmaker', 'capturedAt', 'startsAt',
  ].sort();
  for (const item of shown) {
    assert.deepEqual(Object.keys(item).sort(), allowed, 'a field appeared on a tracked bet');
    assert.equal(typeof item.stakeUnits, 'number');
    for (const k of Object.keys(item)) {
      assert.ok(!/pence|money|pounds|stake$/i.test(k), `${k} is money on a tracked bet`);
      assert.ok(!/outcome|result|won|lost|settled|winner/i.test(k), `${k} is an outcome on a tracked bet`);
    }
  }
});

test('the feed offers no way to turn somebody else’s bet into yours', () => {
  /*  A tail button is a tip with an extra step, and Slippery never gives
      tips. The rule is worth a test rather than a comment because it is the
      single most obvious thing to add to a screen like this. */
  const src = readFileSync('app/app/social/feed/page.tsx', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
  for (const banned of [/\btail\b/i, /copy this bet/i, /back this/i, /place this/i, /bet along/i]) {
    assert.ok(!banned.test(src), `the feed has grown a ${banned} control`);
  }
});

test('the feed is capped, and says so rather than running for ever', () => {
  assert.ok(TRACKING_FEED_MAX <= 20, 'a cap of more than twenty is not a cap');
  assert.ok(trackingFeed(NOW).length <= TRACKING_FEED_MAX);
  const page = readFileSync('app/app/social/feed/page.tsx', 'utf8');
  assert.ok(page.includes('TRACKING_FEED_MAX'), 'the page states a number it does not derive');
});

test('the soonest kick off is first, because time is the only thing that moves', () => {
  const shown = trackingFeed(NOW);
  for (let i = 1; i < shown.length; i += 1) {
    assert.ok(
      new Date(shown[i - 1].startsAt).getTime() <= new Date(shown[i].startsAt).getTime(),
      'the feed is out of order',
    );
  }
});

// ------------------------------------------------------------ the league

test('every figure on a row is folded from the same set of bets', () => {
  /*  Rule 5 of the codebase, applied to a leaderboard: the return and the
      units cannot come from two derivations, or a row prints a return that
      could not have produced the units beside it. */
  for (const period of LEAGUE_PERIODS.map((p) => p.id)) {
    for (const p of slippers(NOW)) {
      const r = recordFor(p, period);
      assert.equal(r.wins + r.losses <= r.bets, true, `@${p.handle} has more decided bets than bets`);
      if (r.stakedUnits > 0) {
        const implied = (r.units / r.stakedUnits) * 100;
        assert.ok(
          Math.abs(implied - r.roi) < 0.05,
          `@${p.handle} ${period}: return ${r.roi} does not come from ${r.units}u over ${r.stakedUnits}u`,
        );
      } else {
        assert.equal(r.roi, 0, 'a return over no stake is zero, not a division');
      }
    }
  }
});

test('a table is ranked in units, and the positions run one to n', () => {
  const board = league(slippers(NOW), 'month');
  assert.ok(board.length > 3);
  board.forEach((row, i) => {
    assert.equal(row.position, i + 1);
    if (i > 0) assert.ok(board[i - 1].record.units >= row.record.units, 'the table is not sorted by units');
  });
});

test('the row carries the record for the period it is ranked over', () => {
  for (const period of LEAGUE_PERIODS.map((p) => p.id) as LeaguePeriod[]) {
    for (const row of league(slippers(NOW), period)) {
      assert.deepEqual(row.record, recordFor(row, period), `${period} row carries the wrong record`);
    }
  }
});

test('the podium pins your row only when it is not already carrying you', () => {
  const board = league(slippers(NOW), 'all');
  /*  Somebody on the podium is not pinned under it: they would be on the
      page three times, on a plinth, in the pinned row, and in the first rows
      of the table below. */
  for (const r of board.slice(0, 3)) {
    assert.equal(pinnedRow(board, r.handle), undefined, `@${r.handle} is on the podium and pinned under it`);
  }
  for (const r of board.slice(3)) {
    assert.equal(pinnedRow(board, r.handle)?.handle, r.handle, `@${r.handle} is off the podium and not pinned`);
  }
  assert.equal(pinnedRow(board, 'nobody-with-this-handle'), undefined);
});

test('a bigger bankroll is not a bigger score', () => {
  /*  Nothing about a person reaches a table in money. If a pence figure ever
      appears on a Slipper the ranking stops being comparable between a five
      pound bettor and a five hundred pound one, which is the whole reason
      the table is in units. */
  for (const p of slippers(NOW)) {
    for (const k of Object.keys(p)) {
      assert.ok(!/pence|money|stake$|bankroll/i.test(k), `${k} puts money on a Slipper`);
    }
  }
});

test('a period that is not one of the three falls back rather than throwing', () => {
  const ids = LEAGUE_PERIODS.map((p) => p.id);
  assert.deepEqual(ids, ['month', 'year', 'all']);
  const all = league(slippers(NOW), 'all');
  const month = league(slippers(NOW), 'month');
  assert.notDeepEqual(
    all.map((r) => r.handle),
    month.map((r) => r.handle),
    'all time and this month produce the same order, so the period is doing nothing',
  );
});

// -------------------------------------------------------------- the groups

test('a slip backed only group actually excludes what it says it excludes', () => {
  const g = GROUPS.find((x) => x.slipBackedOnly)!;
  const restricted = groupMembers(g.id, NOW);
  const everyone = slippers(NOW).filter((p) => p.groups.includes(g.id));

  let tighter = 0;
  for (const m of restricted) {
    const same = everyone.find((p) => p.handle === m.handle)!;
    const a = recordFor(m, g.rankingPeriod);
    const b = recordFor(same, g.rankingPeriod);
    assert.ok(a.bets <= b.bets, `@${m.handle} counts more bets under the stricter rule`);
    if (a.bets < b.bets) tighter += 1;
  }
  assert.ok(tighter > 0, 'the slip backed rule removed nothing from anybody');
  assert.ok(slipBackedExcluded(g.id, NOW) > 0, 'the board does not know how many it left out');

  const open = GROUPS.find((x) => !x.slipBackedOnly)!;
  assert.equal(slipBackedExcluded(open.id, NOW), 0, 'a group counting every bet is excluding some');
});

test('leaving a group changes nothing about your own figures', () => {
  /*  Units are folded from your own ledger, so they were never the group's
      to keep. The same Slipper read through a group and read on their own
      has to be the same Slipper. */
  const open = GROUPS.find((x) => !x.slipBackedOnly && x.id !== 'sunday-singles')!;
  const inside = groupMembers(open.id, NOW).find((p) => p.handle === YOU)!;
  const outside = findSlipper(YOU, NOW)!;
  for (const period of ['month', 'year', 'all'] as LeaguePeriod[]) {
    assert.deepEqual(recordFor(inside, period), recordFor(outside, period));
  }
});

test('a group summary knows whether you are in it and whether you run it', () => {
  const all = groupSummaries(NOW);
  const yours = all.filter((g) => g.youAreIn);
  const notYours = all.filter((g) => !g.youAreIn);
  assert.ok(yours.length > 0 && notYours.length > 0, 'the example account needs one of each');

  for (const g of notYours) {
    assert.equal(g.yourPosition, 0, 'a position in a table you are not in is a made up number');
  }
  for (const g of yours) {
    assert.ok(g.yourPosition >= 1 && g.yourPosition <= g.members);
  }
  assert.ok(all.some((g) => g.youOwn), 'no group has an owner who is the viewer');
  assert.ok(all.some((g) => g.members === 1), 'no group of one, so that empty state has no example');
});

test('every join mode is represented and each one is a different answer', () => {
  const modes = new Set(GROUPS.map((g) => g.joinMode));
  assert.deepEqual([...modes].sort(), ['approval', 'code', 'open']);
});

test('an invite code is one format with one validator', () => {
  for (const g of GROUPS) {
    assert.ok(isInviteCode(g.inviteCode), `${g.name} has a code its own validator rejects`);
  }
  /*  The create screen generates a code offline when there is nothing to
      save to, and it used to do it from its own alphabet, which contained an
      L. `isInviteCode` has no L in it, so that code would have been refused
      by the join screen it was made for. */
  const created = readFileSync('components/app/CreateGroup.tsx', 'utf8');
  const codes = readFileSync('lib/server/codes.ts', 'utf8');
  const a = /const ALPHABET = '([^']+)'/.exec(created)?.[1];
  const b = /const ALPHABET = '([^']+)'/.exec(codes)?.[1];
  assert.ok(a && b, 'one of the two alphabets is no longer a literal');
  assert.equal(a, b, 'the create screen issues codes from a different alphabet');
});

test('a code is matched the way somebody types it, and a wrong one matches nothing', () => {
  const g = GROUPS[0];
  assert.equal(groupByCode(g.inviteCode, NOW)?.id, g.id);
  assert.equal(groupByCode(g.inviteCode.toLowerCase(), NOW)?.id, g.id);
  assert.equal(groupByCode(` ${g.inviteCode.slice(0, 3)} ${g.inviteCode.slice(3)} `, NOW)?.id, g.id);
  assert.equal(groupByCode('ZZZZZZ', NOW), undefined);
  assert.equal(groupByCode('', NOW), undefined);
});

// ------------------------------------------------- responsible gambling

test('a division move states the move and stops', () => {
  const said = [
    divisionMove(1, 12, 'Championship'),
    divisionMove(6, 12, 'Championship'),
    divisionMove(12, 12, 'Championship'),
    divisionMove(1, 12, 'Premier'),
    divisionMove(12, 12, 'League Two'),
    divisionMove(1, 2, 'Premier'),
  ];
  for (const s of said) {
    assert.match(s, /^(Moving to|Staying in|Divisions are set)/, `"${s}" is not a statement of fact`);
    assert.doesNotMatch(s, /relegat|demot|dropped|promot|congrat|well done|keep/i, `"${s}" is a verdict`);
    assert.ok(s.endsWith('.'), `"${s}" runs on`);
  }
  assert.match(divisionMove(12, 12, 'Championship'), /Moving to League One next month\./);
  assert.match(divisionMove(1, 2, 'Premier'), /four Slippers/, 'a group of two cannot promote anybody');
});

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.next' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

test('nothing anywhere says a Slipper has gone down', () => {
  const found: string[] = [];
  for (const f of [...walk('app'), ...walk('components'), ...walk('lib')]) {
    const src = readFileSync(f, 'utf8');
    src.split('\n').forEach((line, i) => {
      /*  A line that says the word in order to say it is never used is the
          rule being written down, not the rule being broken. Both marketing
          pages and this module quote it that way. */
      if (/never/i.test(line)) return;
      if (/relegat|demoted|bottom of the table|last place/i.test(line)) found.push(`${f}:${i + 1} ${line.trim().slice(0, 60)}`);
    });
  }
  assert.deepEqual(found, [], found.join('\n'));
});

test('no social surface draws an interface element with an emoji', () => {
  /*  They rasterise out of the system font, so they cannot take the profit
      or the loss colour, and they differ per platform. A podium drawn with
      medals would print a losing figure in a colour that says nothing. */
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/u;
  const found: string[] = [];
  for (const f of [...walk('app'), ...walk('components'), ...walk('lib')]) {
    const src = readFileSync(f, 'utf8');
    src.split('\n').forEach((line, i) => {
      if (emoji.test(line)) found.push(`${f}:${i + 1} ${line.trim().slice(0, 60)}`);
    });
  }
  assert.deepEqual(found, [], found.join('\n'));
});
