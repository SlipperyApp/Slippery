import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trialState, findPromo, referralHandle, TRIAL_DAYS, TRIAL_SLIPS, REFERRED_TRIAL_DAYS } from '../lib/server/promo.ts';

const base = { trialEndsAt: null as Date | null, trialSlipsAllowed: TRIAL_SLIPS, trialSlipsUsed: 0, plan: null as string | null, planState: null as string | null };
const inDays = (n: number) => new Date(Date.now() + n * 86400000);

test('the trial reports which half ran out, because they need different advice', () => {
  const daysGone = trialState({ ...base, trialEndsAt: inDays(-1) });
  assert.deepEqual(daysGone, { state: 'over', ran: 'days' });

  const slipsGone = trialState({ ...base, trialEndsAt: inDays(3), trialSlipsUsed: TRIAL_SLIPS });
  assert.deepEqual(slipsGone, { state: 'over', ran: 'slips' });
});

test('slips running out first ends the trial even with days left', () => {
  const s = trialState({ ...base, trialEndsAt: inDays(4), trialSlipsUsed: 15 });
  assert.equal(s.state, 'over');
});

test('an active trial reports both halves so the screen can show either', () => {
  const s = trialState({ ...base, trialEndsAt: inDays(3), trialSlipsUsed: 5 });
  assert.equal(s.state, 'active');
  if (s.state === 'active') {
    assert.equal(s.daysLeft, 3);
    assert.equal(s.slipsLeft, 10);
  }
});

test('a referral gives the longer trial and it is the referred person who gets it', () => {
  const s = trialState({ ...base, trialEndsAt: inDays(REFERRED_TRIAL_DAYS), trialSlipsAllowed: 40, trialSlipsUsed: 0 });
  assert.equal(s.state, 'active');
  if (s.state === 'active') assert.equal(s.slipsLeft, 40);
  assert.ok(REFERRED_TRIAL_DAYS > TRIAL_DAYS);
});

test('a paid account has no trial to report', () => {
  assert.deepEqual(trialState({ ...base, trialEndsAt: inDays(3), plan: 'yearly', planState: 'active' }), { state: 'none' });
});

test('the group codes are recognised and carry their group', () => {
  assert.equal(findPromo('ultras')?.group, 'Ultras');
  assert.equal(findPromo('HBVALUE')?.group, 'HBValue');
  assert.equal(findPromo('nope'), null);
});

test('the admin code is not in source, so reading the repository grants nothing', () => {
  const source = readFileSync(new URL('../lib/server/promo.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /slip_adm/i);
  assert.match(source, /ADMIN_PROMO_CODE/);
});

test('a referral code is a handle and nonsense is refused', () => {
  assert.equal(referralHandle('@Tester123'), 'tester123');
  assert.equal(referralHandle('tester123'), 'tester123');
  assert.equal(referralHandle('a'), null);
  assert.equal(referralHandle('has spaces'), null);
});
import { readFileSync } from 'node:fs';
