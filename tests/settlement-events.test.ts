import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { recompute } from '@/lib/domain/fold';
import { validKey } from '@/lib/server/idempotency';
import type { Bet, EventType, SettlementEvent } from '@/lib/domain/types';

/** EVERY EVENT TYPE THE ROUTE ACCEPTS, FOLDED, AND REACHABLE FROM THE
 *  INTERFACE.
 *
 *  The endpoint accepted thirteen types, the fold handled thirteen, the tests
 *  pinned the arithmetic on most of them, and the browser could send exactly
 *  one. 475 tests passed over a product that could not settle a bet. The
 *  structural tests at the foot of this file are the ones that would have
 *  caught it: a type the server accepts and no control can produce is a
 *  feature that exists only in the database. */

const NOW = '2026-08-31T12:00:00.000Z';

function bet(over: Partial<Bet> = {}): Bet {
  return {
    id: 'b1', accountId: 'a1', balanceId: 'bal-main', shape: 'single', side: 'back',
    stakePence: 5000, liabilityPence: null, odds: 3, currency: 'GBP', fxRate: null,
    bookmakerId: 'bet365', tipsterId: 'own', sportId: 'football',
    competition: null, course: null, eventName: 'A v B', selection: 'A',
    marketRaw: 'Match result', marketGroupId: null,
    eventAt: NOW, placedAt: NOW, expectedSettleAt: null,
    isFreeBet: false, isBonusFunds: false, isBoosted: false,
    isEachWay: false, ewPlaceFraction: null, ewPart: null, ewGroupId: null,
    slipBacked: true, source: 'manual', arbGroupId: null, note: null,
    placesPaid: null, closingOdds: null,
    unitPenceAtPlacement: 2500, commissionPct: 0, createdAt: NOW, legs: [],
    ...over,
  };
}

let n = 0;
const ev = (type: EventType, over: Partial<SettlementEvent> = {}): SettlementEvent => {
  n += 1;
  return {
    id: `e${n}`, betId: 'b1', seq: n, type,
    fractionEighths: null, returnedPence: null, deductionPence: null, commissionPct: null,
    occurredAt: NOW, enteredBy: 'you', afterResultKnown: false, note: null, createdAt: NOW,
    ...over,
  };
};
const seqd = (...evs: SettlementEvent[]) => evs.map((e, i) => ({ ...e, seq: i + 1 }));

const ALL_TYPES: EventType[] = [
  'won', 'lost', 'void', 'placed', 'push', 'half_won', 'half_lost',
  'cash_out_partial', 'cash_out_full', 'rule4', 'commission',
  'promo_refund', 'manual_correction',
];

// --------------------------------------------------- one type at a time

test('a push returns the stake, profits nothing, and leaves turnover', () => {
  // Over 2.0 on a 1-1 is a push, not a loss. It is a void by another name and
  // the fold treats it as one, which is what stops a whole line being
  // reported as a defeat.
  const s = recompute(bet(), seqd(ev('push')), NOW);
  assert.equal(s.remainingStakePence, 0);
  assert.equal(s.returnedPence, 5000);
  assert.equal(s.realisedPlPence, 0);
  assert.equal(s.voidedStakePence, 5000);
  assert.equal(s.outcome, 'void');
  assert.equal(s.status, 'settled');
});

test('a full cash out settles at the figure the bookmaker paid', () => {
  const s = recompute(bet(), seqd(ev('cash_out_full', { returnedPence: 6250 })), NOW);
  assert.equal(s.remainingStakePence, 0);
  assert.equal(s.returnedPence, 6250);
  assert.equal(s.realisedPlPence, 1250);
  assert.equal(s.outcome, 'cash-profit');
  assert.equal(s.status, 'settled');
});

test('a full cash out below the stake is a cash loss, not a loss', () => {
  const s = recompute(bet(), seqd(ev('cash_out_full', { returnedPence: 3000 })), NOW);
  assert.equal(s.realisedPlPence, -2000);
  assert.equal(s.outcome, 'cash-loss');
});

test('a full cash out at the stake is flat, and is neither a win nor a loss', () => {
  const s = recompute(bet(), seqd(ev('cash_out_full', { returnedPence: 5000 })), NOW);
  assert.equal(s.realisedPlPence, 0);
  assert.equal(s.outcome, 'cash-flat');
});

test('a manual correction moves profit and nothing else', () => {
  const lost = seqd(ev('lost'));
  const before = recompute(bet(), lost, NOW);
  const after = recompute(bet(), seqd(ev('lost'), ev('manual_correction', { returnedPence: 500 })), NOW);
  assert.equal(before.realisedPlPence, -5000);
  assert.equal(after.realisedPlPence, -4500);
  assert.equal(after.remainingStakePence, before.remainingStakePence, 'a correction moves no stake');
  assert.equal(after.outcome, before.outcome, 'a correction never changes the result');
});

test('a correction can take money off as well as put it back', () => {
  const s = recompute(bet(), seqd(ev('won'), ev('manual_correction', { returnedPence: -1000 })), NOW);
  assert.equal(s.realisedPlPence, 10000 - 1000);
  assert.equal(s.outcome, 'won');
});

test('a placed result is reported as placed and never read off the money', () => {
  const s = recompute(bet({ isEachWay: true, ewPart: 'place', odds: 1.5 }), seqd(ev('placed')), NOW);
  assert.equal(s.outcome, 'placed');
  assert.equal(s.status, 'settled');
});

test('every event type the route accepts folds to a defined state', () => {
  /*  The coverage check. A type the fold does not understand falls through
   *  its default and contributes nothing, which is a silent no-op on an
   *  append only ledger: the row is there for ever and no figure moved. */
  for (const type of ALL_TYPES) {
    n = 0;
    const events = seqd(ev(type, {
      returnedPence: 4000, fractionEighths: 4, deductionPence: 25, commissionPct: 2,
    }));
    const s = recompute(bet({ commissionPct: 2 }), events, NOW);
    assert.ok(Number.isFinite(s.realisedPlPence), `${type} produced a non-number profit`);
    assert.ok(Number.isFinite(s.remainingStakePence), `${type} produced a non-number stake`);
    assert.ok(Number.isFinite(s.units), `${type} produced a non-number unit figure`);
    assert.ok(
      s.outcome === null || ['won', 'lost', 'placed', 'void', 'cash-profit', 'cash-loss', 'cash-flat'].includes(s.outcome),
      `${type} produced an outcome bet_state cannot store: ${s.outcome}`,
    );
  }
});

test('the six outcomes are all reachable, and there is no seventh', () => {
  const reached = new Set<string>();
  const cases: SettlementEvent[][] = [
    seqd(ev('won')),
    seqd(ev('lost')),
    seqd(ev('void')),
    seqd(ev('cash_out_full', { returnedPence: 9000 })),
    seqd(ev('cash_out_full', { returnedPence: 100 })),
    seqd(ev('cash_out_full', { returnedPence: 5000 })),
  ];
  for (const c of cases) {
    n = 0;
    const s = recompute(bet(), c, NOW);
    if (s.outcome) reached.add(s.outcome);
  }
  assert.deepEqual(
    [...reached].sort(),
    ['cash-flat', 'cash-loss', 'cash-profit', 'lost', 'void', 'won'],
  );
});

test('a Rule 4 recorded before the result takes nothing, which is why the sheet blocks it', () => {
  /*  The fold applies each event against the state at the moment it lands, so
   *  a deduction recorded before there are any winnings deducts from nothing.
   *  That is correct and it is a trap, so the settle sheet refuses to write
   *  an event that moves no figure and says why. */
  const early = recompute(bet(), seqd(ev('rule4', { deductionPence: 25 }), ev('won')), NOW);
  const proper = recompute(bet(), seqd(ev('won'), ev('rule4', { deductionPence: 25 })), NOW);
  assert.equal(early.realisedPlPence, 10000, 'a deduction before the result took nothing');
  assert.equal(proper.realisedPlPence, 10000 - 2500);
});

// ---------------------------------------------------------- write keys

test('a write key has to look like one before it reaches a query', () => {
  assert.equal(validKey('0f8fad5b-d9cb-469f-a165-70867728950e'), true);
  assert.equal(validKey('k9abc123def456ghi'), true);
  assert.equal(validKey('short'), false);
  assert.equal(validKey(`'; drop table bets; --${'x'.repeat(20)}`), false);
  assert.equal(validKey(null), false);
  assert.equal(validKey(123), false);
  assert.equal(validKey('x'.repeat(200)), false);
});

// --------------------------------------------------------- structural

const ROUTE = readFileSync('app/api/bets/[id]/events/route.ts', 'utf8');
const SETTLE_UI = readFileSync('components/app/Settle.tsx', 'utf8');
const SHEET_UI = readFileSync('components/app/BetSheet.tsx', 'utf8');

test('every settlement event the server accepts has a control that can produce it', () => {
  /*  THE TEST THAT WAS MISSING. The route accepted thirteen types and the
   *  interface could send one, so twelve of them were reachable only from a
   *  database client. A unit test is what hid this the last time: the fold
   *  was tested on all thirteen and nothing asked whether anybody could get
   *  at them. */
  const ui = SETTLE_UI + SHEET_UI;
  const missing = ALL_TYPES.filter((t) => !ui.includes(`'${t}'`));
  assert.deepEqual(missing, [], `no control writes: ${missing.join(', ')}`);
});

test('the settle sheet previews through the fold rather than working it out again', () => {
  assert.match(SETTLE_UI, /from '@\/lib\/domain\/fold'/);
  assert.match(SETTLE_UI, /recompute\(/);
  assert.doesNotMatch(SETTLE_UI, /settleBet|gradeLeg/, 'the browser must never grade a bet');
});

test('a result written by hand charges commission, the way the cron path does', () => {
  /*  appendEvent appends and stops. appendResult appends and then asks
   *  whether the exchange is owed anything, which is the only reason a
   *  manually settled Betfair winner is not reported two per cent high. */
  assert.match(ROUTE, /appendResult/);
  assert.match(ROUTE, /const RESULTS = new Set<EventType>\(\[/);
  for (const t of ['won', 'lost', 'void', 'placed', 'push', 'half_won', 'half_lost', 'cash_out_full']) {
    assert.ok(new RegExp(`RESULTS[\\s\\S]{0,400}'${t}'`).test(ROUTE), `${t} does not go through appendResult`);
  }
  assert.ok(
    !/RESULTS = new Set<EventType>\(\[[\s\S]{0,400}'cash_out_partial'/.test(ROUTE),
    'a part pull must not charge commission, or the rest of the bet is never charged',
  );
});

test('every settlement write carries an idempotency key', () => {
  /*  settlement_events is append only and there is no edit to undo a
   *  duplicate with. A double tap on a platform lift would otherwise settle
   *  the same bet twice, for good. */
  assert.match(ROUTE, /validKey/);
  assert.match(ROUTE, /once\(client, account\.id/);
  for (const src of [SETTLE_UI, SHEET_UI]) {
    const posts = [...src.matchAll(/\/api\/bets\/\$\{bet\.id\}\/events/g)];
    assert.ok(posts.length > 0);
  }
  assert.equal(
    (SETTLE_UI + SHEET_UI).match(/idempotencyKey/g)?.length,
    2,
    'both the settle sheet and the cash out send a key',
  );
});

test('the on-demand settle has a caller', () => {
  /*  POST /api/settle graded through the same engine the cron uses and no
   *  button in the product had ever called it. On a Hobby plan that is one
   *  sweep a day and no way to ask for another. */
  const caller = readFileSync('components/app/CheckResults.tsx', 'utf8');
  assert.match(caller, /'\/api\/settle'/);
  /*  It was in RunningNow, which was a 430 pixel card above the ledger
      naming up to twelve of the bets the list underneath already carries.
      The card is gone and the control moved to the one row that replaced it,
      which is where the count of what is waiting is printed. */
  const bar = readFileSync('components/app/OpenBar.tsx', 'utf8');
  assert.match(bar, /<CheckResults \/>/);
});
