import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { demoData } from '@/lib/data/demo';
import { sharedView, sharePath } from '@/lib/data/share';
import { generateShareToken, isShareToken, SHARE_TOKEN_RE } from '@/lib/server/codes';
import { inBalance } from '@/lib/domain/balances';
import { realisedPence } from '@/lib/data/analytics';

const NOW = new Date('2026-08-31T12:00:00Z');
const data = demoData(NOW);
const shared = data.balances.find((b) => b.shareToken !== null)!;
const TOKEN = shared.shareToken!;

// ------------------------------------------------------------- the token

test('a generated token passes the validator that guards the page', () => {
  /*  A previous build seeded codes in a shape its own bot rejected. The
   *  generator and the validator are tested against each other here for the
   *  same reason. */
  for (let i = 0; i < 50; i++) {
    const t = generateShareToken();
    assert.ok(isShareToken(t), t);
    assert.match(t, SHARE_TOKEN_RE);
  }
});

test('a token is long enough that guessing is not a strategy', () => {
  /*  Twenty characters from a thirty one letter alphabet is about ninety
   *  nine bits. The four character link code would have been a public
   *  directory of everybody's ledger. */
  const t = generateShareToken();
  assert.equal(t.length, 23);            // "sb-" and twenty
  const a = generateShareToken();
  const b = generateShareToken();
  assert.notEqual(a, b, 'two tokens came out the same');
});

test('the example account carries a token in the shape the generator makes', () => {
  assert.ok(isShareToken(TOKEN), TOKEN);
  assert.equal(sharePath(TOKEN), `/b/${TOKEN}`);
});

test('nothing that is not a token opens anything', () => {
  for (const junk of [
    '', 'nope', 'sb-', 'sb-tooshort', TOKEN.toUpperCase(), `${TOKEN}x`,
    'sb-abcdefghijklmnopqrst',            // i, l and o are not in the alphabet
    '../../etc/passwd', 'sb-%2e%2e', 'null', 'undefined',
  ]) {
    assert.equal(isShareToken(junk), false, junk);
    assert.equal(sharedView(junk, NOW, data), null, junk);
  }
});

// ---------------------------------------------------------- what it shows

test('a live link opens the balance it was issued for, and only that one', () => {
  const view = sharedView(TOKEN, NOW, data);
  assert.ok(view, 'the example account link does not open');
  assert.equal(view.name, shared.name);

  const mine = inBalance(data.bets, shared.id);
  assert.equal(view.bets, mine.length, 'the page counts bets that are not on this balance');

  /*  And the days are this balance's days. A calendar carrying another
   *  balance's Saturday would be the leak nobody would ever notice. */
  const settled = mine.filter((b) => b.state.status !== 'open');
  const total = view.days.reduce((a, d) => a + d.count, 0);
  assert.equal(total, settled.length);

  const unit = shared.unitMinor;
  const drawn = view.days.reduce((a, d) => a + d.units100, 0);
  assert.equal(drawn, view.days.reduce((a, d) => a + d.units100, 0));
  // Within a hundredth per day, the calendar sums to this balance's own net.
  const expected = (realisedPence(settled) / unit) * 100;
  assert.ok(Math.abs(drawn - expected) <= view.days.length, `${drawn} against ${expected}`);
});

test('the curve is the running total of the days and ends where the record ends', () => {
  const view = sharedView(TOKEN, NOW, data)!;
  assert.equal(view.curve.length, view.days.length);
  let running = 0;
  for (let i = 0; i < view.days.length; i++) {
    running += view.days[i].units100;
    assert.equal(view.curve[i].units100, running, `point ${i}`);
    assert.equal(view.curve[i].day, view.days[i].day);
  }
});

test('not one figure on a shared view is money, and no field could carry it', () => {
  /*  THE RULE THE PAGE EXISTS UNDER. A shared record says how somebody has
   *  done. It does not say what they stake, what is in their account or what
   *  they can afford to lose, and the type is what makes that true rather
   *  than a promise in a comment: there is no field to put it in. */
  const view = sharedView(TOKEN, NOW, data)!;
  const keys = Object.keys(view);
  for (const k of keys) {
    assert.doesNotMatch(k, /pence|minor|money|stake|turnover|returned|currency|email|balanceStart/i,
      `${k} is a field money could travel through`);
  }
  assert.deepEqual(
    keys.sort(),
    ['bets', 'curve', 'days', 'handle', 'losses', 'name', 'roi', 'settled', 'timeZone', 'units', 'weekStart', 'winRate', 'wins'],
  );

  /*  And no value is one of this balance's money figures, which is the check
   *  that would catch a pence total smuggled through a differently named
   *  field. */
  const mine = inBalance(data.bets, shared.id);
  const money = new Set<number>([
    realisedPence(mine), shared.startMinor, shared.unitMinor,
    ...mine.map((b) => b.stakePence),
  ]);
  const flat: number[] = [
    view.bets, view.settled, view.units, view.roi, view.winRate, view.wins, view.losses,
    ...view.days.flatMap((d) => [d.units100, d.count]),
    ...view.curve.map((c) => c.units100),
  ];
  for (const v of flat) {
    if (v === 0) continue;
    assert.ok(!money.has(v), `${v} is one of this balance's money figures`);
  }
});

test('the email address is nowhere near a shared view', () => {
  const view = sharedView(TOKEN, NOW, data)!;
  const text = JSON.stringify(view);
  assert.ok(!text.includes(data.account.email), 'the email is in the shared view');
  assert.ok(!text.includes('@example.com'));
  // The handle is public, and it is the only thing about the account here.
  assert.equal(view.handle, data.account.handle);
  assert.ok(!text.includes(data.account.displayName));
});

test('a shared link carries nothing about the account other balances', () => {
  const view = sharedView(TOKEN, NOW, data)!;
  const others = data.balances.filter((b) => b.id !== shared.id);
  assert.ok(others.length > 0, 'the example account has one balance, so this proves nothing');
  const text = JSON.stringify(view);
  for (const b of others) {
    assert.ok(!text.includes(b.name), `${b.name} is named on the shared page`);
    assert.ok(!text.includes(b.id));
    const theirs = inBalance(data.bets, b.id);
    assert.notEqual(view.bets, theirs.length + inBalance(data.bets, shared.id).length,
      'the count looks like both balances added together');
  }
});

// --------------------------------------------------------------- revoking

test('a revoked link stops working immediately', () => {
  /*  Through the same function the page calls, on a record with the token
   *  cleared. Turning sharing off writes null to that column and there is
   *  nothing else to check: no cache, no second flag, no expiry that could
   *  outlive it. */
  assert.ok(sharedView(TOKEN, NOW, data), 'the link does not work to begin with');

  const revoked = { ...data, balances: data.balances.map((b) => ({ ...b, shareToken: null })) };
  assert.equal(sharedView(TOKEN, NOW, revoked), null, 'a revoked token still opens the balance');

  /*  And it is the TOKEN that was revoked, not the balance: the same record
   *  reshared under a new token opens again, which is what turning it off
   *  and on again has to do. */
  const fresh = generateShareToken();
  const reshared = {
    ...data,
    balances: data.balances.map((b) => (b.id === shared.id ? { ...b, shareToken: fresh } : { ...b, shareToken: null })),
  };
  assert.ok(sharedView(fresh, NOW, reshared), 'a fresh token does not open the balance');
  assert.equal(sharedView(TOKEN, NOW, reshared), null, 'the old token still works after resharing');
});

test('a balance that was never shared cannot be reached, and null matches nothing', () => {
  /*  The null guard in the lookup. Without it, a comparison against an
   *  unshared balance's null token would hand a stranger whichever balance
   *  happened to be first. */
  const unshared = data.balances.filter((b) => b.shareToken === null);
  assert.ok(unshared.length > 0, 'every balance is shared, so this proves nothing');
  for (const junk of ['null', 'undefined', '']) {
    assert.equal(sharedView(junk, NOW, data), null, junk);
  }
  const noneShared = { ...data, balances: data.balances.map((b) => ({ ...b, shareToken: null })) };
  assert.equal(sharedView(generateShareToken(), NOW, noneShared), null);
});

// ------------------------------------------------- the page cannot print money

test('the shared page has no way to print a money figure', () => {
  /*  Belt to the type's braces. The view carries no money, and this asserts
   *  the page never reaches for a formatter that could turn anything into
   *  some: a helpful money() added later would compile, type check and pass
   *  every other test in this file. */
  /*  Comments stripped first. This file's own note explains that money() is
      not reached on any path through the page, and a check that read the
      comment would fail on the sentence promising the thing it checks. */
  const src = readFileSync('app/b/[token]/page.tsx', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
  for (const banned of ['money(', 'moneyPlain(', 'cellFigure(', 'axisMoney(', 'CURRENCY_SYMBOL', ' pl(']) {
    assert.ok(!src.includes(banned), `the shared page calls ${banned}`);
  }
  // And it reads nothing but the view.
  assert.ok(!src.includes('demoData'), 'the shared page reads the account directly');
  assert.ok(!src.includes('getViewer'), 'the shared page reads the signed in viewer');
  assert.match(src, /sharedView\(/);
  // Never indexed: the whole security of the page is that the address is not guessable.
  assert.match(src, /index:\s*false/);
});

test('the shared prefix is out of robots.txt as well as noindex on the page', () => {
  const robots = readFileSync('public/robots.txt', 'utf8');
  assert.match(robots, /^Disallow: \/b\/$/m);
});
