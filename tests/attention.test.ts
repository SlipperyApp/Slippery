import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attention, filterByNeeds, needsFromParam, SETTLE_GRACE_MS } from '@/lib/data/attention';
import type { DemoBet } from '@/lib/data/demo';

const NOW = new Date('2026-09-01T20:00:00Z');
const at = (msAgo: number) => new Date(NOW.getTime() - msAgo).toISOString();

function bet(id: string, msAgo: number, status: 'open' | 'settled', stake = 5000, odds = 2): DemoBet {
  return {
    id, eventAt: at(msAgo), odds, stakePence: stake,
    state: { status, remainingStakePence: status === 'open' ? stake : 0, realisedPlPence: 0, returnedPence: 0, voidedStakePence: 0, units: 0, outcome: null, betId: id, updatedAt: at(msAgo) },
  } as unknown as DemoBet;
}

test('an open bet whose event has not had time to finish is running', () => {
  const a = attention([bet('a', 20 * 60 * 1000, 'open')], NOW);
  assert.equal(a.running.length, 1);
  assert.equal(a.waiting.length, 0);
  assert.equal(a.count, 0, 'a match in progress does not need a person');
});

test('an open bet whose event finished long ago is waiting on a result', () => {
  const a = attention([bet('a', SETTLE_GRACE_MS + 60_000, 'open')], NOW);
  assert.equal(a.running.length, 0);
  assert.equal(a.waiting.length, 1);
  assert.equal(a.count, 1, 'this one needs a person');
});

/*  The boundary is the whole definition, so it is asserted from both sides
 *  rather than trusted. A bet exactly on the grace period is still running:
 *  the comparison is strictly greater, so the first tick past it moves. */
test('the grace period is the boundary, and it is exact', () => {
  const justInside = attention([bet('a', SETTLE_GRACE_MS - 1, 'open')], NOW);
  assert.equal(justInside.running.length, 1);
  const justOutside = attention([bet('a', SETTLE_GRACE_MS + 1, 'open')], NOW);
  assert.equal(justOutside.waiting.length, 1);
});

test('a settled bet is in neither, and contributes nothing at risk', () => {
  const a = attention([bet('a', 60_000, 'settled')], NOW);
  assert.equal(a.running.length + a.waiting.length, 0);
  assert.equal(a.openStakePence, 0);
  assert.equal(a.toReturnPence, 0);
});

/*  The two figures beside each other on screen have to be the same money.
 *  Rounding the sum rather than each bet made them disagree by a penny on a
 *  ledger of a few hundred bets, which is a bug report. */
test('at risk and the return are summed the same way the screen shows them', () => {
  const bets = [bet('a', 60_000, 'open', 3333, 1.37), bet('b', 60_000, 'open', 6667, 2.11)];
  const a = attention(bets, NOW);
  assert.equal(a.openStakePence, 3333 + 6667);
  assert.equal(a.toReturnPence, Math.round(3333 * 1.37) + Math.round(6667 * 2.11));
});

test('the ledger filter selects exactly what the sidebar counted', () => {
  const bets = [
    bet('running', 10 * 60 * 1000, 'open'),
    bet('waiting', SETTLE_GRACE_MS * 2, 'open'),
    bet('done', 10 * 60 * 1000, 'settled'),
  ];
  const a = attention(bets, NOW);
  assert.deepEqual(filterByNeeds(bets, 'running', NOW).map((b) => b.id), ['running']);
  assert.deepEqual(filterByNeeds(bets, 'waiting', NOW).map((b) => b.id), ['waiting']);
  assert.equal(filterByNeeds(bets, null, NOW).length, 3);
  assert.equal(a.running.length, filterByNeeds(bets, 'running', NOW).length);
  assert.equal(a.waiting.length, filterByNeeds(bets, 'waiting', NOW).length);
});

/*  A query string is user input and arrives from anywhere. Object.prototype
 *  keys are the shape that has already produced a 500 on this codebase once,
 *  through a table lookup that returned a truthy function. */
test('the needs parameter refuses anything it does not know', () => {
  assert.equal(needsFromParam('running'), 'running');
  assert.equal(needsFromParam('waiting'), 'waiting');
  for (const junk of ['toString', 'constructor', '__proto__', 'RUNNING', '', 'all', undefined, ['running']]) {
    assert.equal(needsFromParam(junk as string | string[] | undefined), null, `${String(junk)} must not select a filter`);
  }
});

test('both lists are ordered by event time, soonest first', () => {
  const bets = [bet('c', 5 * 60 * 1000, 'open'), bet('a', 30 * 60 * 1000, 'open'), bet('b', 15 * 60 * 1000, 'open')];
  assert.deepEqual(attention(bets, NOW).running.map((b) => b.id), ['a', 'b', 'c']);
});
