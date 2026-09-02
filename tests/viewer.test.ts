import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  emptyBook, emptyReason, firstBalance, newAccountFacts, showsFigures, viewerSource,
} from '@/lib/data/viewer';
import { demoData } from '@/lib/data/demo';
import { TRIAL_SLIPS } from '@/lib/domain/trial';

/** A SIGNED-IN ACCOUNT NEVER SEES THE EXAMPLE ACCOUNT'S FIGURES.
 *
 *  This was the worst defect in the build: getViewer() read the example
 *  account unconditionally and the session cookie only switched off the
 *  "Example" label, so anybody holding one was shown @tester123, +£2,631.37
 *  and 259 bets with nothing saying it was not theirs. These tests pin the
 *  decision itself, which is why the decision is a pure function. */

test('a signed-out visitor gets the example account', () => {
  assert.equal(viewerSource({ signedIn: false, hasAccount: false, betCount: 0 }), 'example');
  // Even if a book somehow came back, signed out is signed out.
  assert.equal(viewerSource({ signedIn: false, hasAccount: true, betCount: 259 }), 'example');
});

test('a signed-in account with rows reads its own book', () => {
  assert.equal(viewerSource({ signedIn: true, hasAccount: true, betCount: 1 }), 'account');
});

test('a signed-in account with no rows gets the empty state, never the example', () => {
  assert.equal(viewerSource({ signedIn: true, hasAccount: true, betCount: 0 }), 'empty');
  assert.equal(showsFigures('empty'), false);
});

test('a session cookie with no database behind it is empty, not example', () => {
  /*  The exact case that shipped: a cookie was enough to remove the label
   *  and never enough to change the data. Without a database there is no
   *  account to resolve the cookie to, and the honest answer is zero rows. */
  assert.equal(viewerSource({ signedIn: true, hasAccount: false, betCount: 0 }), 'empty');
});

test('an empty book holds nothing and carries none of the example figures', () => {
  const now = new Date('2026-09-02T12:00:00Z');
  const account = newAccountFacts({ id: 'acc-1', displayName: 'Sam', handle: 'sam' }, now);
  const book = emptyBook(account, [], now);
  const example = demoData(now);

  assert.equal(book.bets.length, 0);
  assert.equal(book.movements.length, 0);
  assert.equal(book.balances.length, 1, 'an account always has one balance to look at');
  assert.equal(book.balances[0].startMinor, 0);
  assert.notEqual(book.account.handle, example.account.handle);
  assert.equal(book.account.balanceStartPence, 0);
  assert.equal(book.account.unitPence, 0);
  assert.equal(book.account.trialSlipsUsed, 0, 'a new account has used no slips');
  assert.equal(book.account.trialSlipsAllowed, TRIAL_SLIPS);
  assert.equal(book.account.telegramLinked, false);
});

test('no field of a new account is copied off the example account', () => {
  /*  A "sensible default" taken from @tester123 would be the same defect one
   *  layer down: a figure on somebody's screen that came from a stranger. */
  const now = new Date('2026-09-02T12:00:00Z');
  const fresh = newAccountFacts({}, now);
  const example = demoData(now).account;
  for (const key of ['unitPence', 'balanceStartPence', 'linkCode', 'handle', 'displayName', 'email'] as const) {
    assert.notEqual(
      String(fresh[key]), String(example[key]),
      `${key} on a new account matches the example account`,
    );
  }
  assert.equal(fresh.trialSlipsUsed, 0);
  assert.notEqual(fresh.trialSlipsUsed, example.account ? 0 : -1);
});

test('the first balance carries the account currency and unit, not sterling by assumption', () => {
  const account = newAccountFacts({ currency: 'EUR', unitPence: 1000, balanceStartPence: 50000 });
  const bal = firstBalance(account);
  assert.equal(bal.currency, 'EUR');
  assert.equal(bal.unitMinor, 1000);
  assert.equal(bal.startMinor, 50000);
});

test('an empty screen says WHY it is empty, and says so differently with no database', () => {
  assert.match(emptyReason(true), /no bets yet/);
  assert.doesNotMatch(emptyReason(true), /database/);
  assert.match(emptyReason(false), /no database/);
});

// ------------------------------------------------------------- structural

test('the viewer reads the example account only when signed out', () => {
  const src = readFileSync('lib/data/session.ts', 'utf8');
  const uses = [...src.matchAll(/demoData\(/g)];
  assert.equal(uses.length, 1, 'the example account is read in exactly one place');
  assert.match(
    src,
    /!signedIn[\s\S]{0,40}demoData\(/,
    'demoData must sit on the signed-out side of the decision',
  );
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

test('no product page folds the example account without asking whose it is', () => {
  /*  The social screens are the ones that could reintroduce this: every
   *  figure on them comes out of lib/data/social.ts, which folds the example
   *  account and the invented Slippers around it. A page may read that only
   *  if it has first checked `source`, so a signed-in account cannot be
   *  placed at the top of somebody else's league. */
  const offenders: string[] = [];
  for (const f of walk('app/app')) {
    if (f.includes('/states/')) continue;
    const src = readFileSync(f, 'utf8');
    const readsExample = /from '@\/lib\/data\/(social|demo)'/.test(src);
    if (!readsExample) continue;
    if (!/source !== 'example'|source === 'example'/.test(src)) offenders.push(f);
  }
  assert.deepEqual(offenders, [], offenders.join('\n'));
});
