import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { currencyAgrees } from '@/lib/domain/balances';
import { ensureBalance } from '@/lib/server/balances';
import { balanceReply, REPLIES } from '@/lib/server/telegram';
import type { Runner } from '@/lib/server/db';

/** A BET HAS TO LAND IN A CHOSEN BALANCE.
 *
 *  An account keeps several balances, each with its own currency, its own
 *  unit and its own figures, and not one entry path asked which. Three
 *  separate defects sat under that:
 *
 *  1. The insert had balance_id in its parameters and NOT in its column list,
 *     so it offered twenty six values for twenty five columns and every bet
 *     written through /api/bets was rejected by the parser. Nothing caught it
 *     because nothing in this suite runs against a database.
 *
 *  2. Only migration 0011 ever created a balance. Signup writes an accounts
 *     row and stops, so every account made after that file ran had none,
 *     while the screens drew one called Main and balance_id is not null.
 *
 *  3. Nothing named the balance a write was about to land in, so somebody
 *     keeping a matched betting float apart from a football bank found out
 *     which one they had used by disagreeing with the balance sheet later. */

// -------------------------------------------------------- the broken insert

const BETS_ROUTE = readFileSync('app/api/bets/route.ts', 'utf8');

test('the bets insert names as many columns as it passes values', () => {
  /*  THE DEFECT, COUNTED. This is the one thing in the file a reader cannot
   *  check by eye: twenty five identifiers against twenty six placeholders,
   *  in a statement no test could execute. */
  const stmt = /insert into bets\s*\(([^)]*)\)\s*values\s*\(([\s\S]*?)\)\s*returning/.exec(BETS_ROUTE);
  assert.ok(stmt, 'the insert into bets could not be found');

  const columns = stmt[1].split(',').map((s) => s.trim()).filter(Boolean);
  const values = stmt[2].split(',').map((s) => s.trim()).filter(Boolean);
  assert.equal(columns.length, values.length,
    `${columns.length} columns against ${values.length} values`);

  const placeholders = values.filter((v) => v.startsWith('$'));
  const highest = Math.max(...placeholders.map((v) => Number(v.slice(1))));
  assert.equal(highest, placeholders.length, 'the placeholders are not $1 to $n without a gap');
});

test('balance_id is a column on the bets insert and not only a parameter', () => {
  const stmt = /insert into bets\s*\(([^)]*)\)/.exec(BETS_ROUTE);
  const columns = (stmt?.[1] ?? '').split(',').map((s) => s.trim());
  assert.ok(columns.includes('balance_id'), `balance_id is not in: ${columns.join(', ')}`);
  // Second, right after account_id, which is where its parameter is.
  assert.equal(columns[1], 'balance_id', `balance_id sits at ${columns.indexOf('balance_id')}`);
});

// ------------------------------------------------ the balance a write lands in

/** A fake that answers the two statements ensureBalance runs, so the rule can
 *  be tested as a rule. A fake cannot prove the SQL is right; the seed's own
 *  guard is asserted as text at the bottom of this file. */
function store(rows: { id: string; name: string; currency: string; unit_pence: number }[]) {
  const state = [...rows];
  const seen: string[] = [];
  const runner: Runner = {
    async query<R>(text: string) {
      seen.push(text.replace(/\s+/g, ' ').trim().slice(0, 40));
      if (/^insert into balances/i.test(text.trim())) {
        if (!state.length) state.push({ id: 'seeded', name: 'Main', currency: 'EUR', unit_pence: 1000 });
        return { rows: [] as R[] };
      }
      return { rows: state as unknown as R[] };
    },
  };
  return { runner, state, seen };
}

test('a write into an account with no balance creates one rather than failing', () => {
  /*  balance_id is not null on bets and on money_movements, so an account
   *  with no balance row could not have a bet or a deposit written at all.
   *  The screens said Main; the constraint said no. */
  const s = store([]);
  return ensureBalance(s.runner, 'acct', null).then((bal) => {
    assert.ok(bal, 'no balance came back for an account that had none');
    assert.equal(bal?.name, 'Main');
    assert.equal(s.state.length, 1, 'the seed did not write exactly one balance');
  });
});

test('an account that already has a balance is never seeded a second time', async () => {
  const s = store([{ id: 'b1', name: 'Main', currency: 'GBP', unit_pence: 2500 }]);
  const bal = await ensureBalance(s.runner, 'acct', null);
  assert.equal(bal?.id, 'b1');
  assert.equal(s.state.length, 1);
  assert.ok(!s.seen.some((q) => q.startsWith('insert into balances')), 'it tried to seed over an existing balance');
});

test('the write lands in the balance the person has open, not the first row', async () => {
  /*  The whole point of the item. Somebody with the euro account open types a
   *  bet in and it belongs to the euro account. */
  const s = store([
    { id: 'b1', name: 'Main', currency: 'GBP', unit_pence: 2500 },
    { id: 'b2', name: 'Euro account', currency: 'EUR', unit_pence: 1000 },
  ]);
  const bal = await ensureBalance(s.runner, 'acct', 'b2');
  assert.equal(bal?.id, 'b2');
  assert.equal(bal?.currency, 'EUR');
  assert.equal(bal?.unitPence, 1000, 'the unit did not come with the balance');
});

test('a cookie naming a balance this account does not have falls to the first', async () => {
  /*  The whole authorisation check: the query is already scoped to this
   *  account, so an id from somebody else's cookie matches nothing here. It
   *  resolves to the first balance rather than to an empty screen. */
  const s = store([
    { id: 'b1', name: 'Main', currency: 'GBP', unit_pence: 2500 },
    { id: 'b2', name: 'Euro account', currency: 'EUR', unit_pence: 1000 },
  ]);
  const bal = await ensureBalance(s.runner, 'acct', 'somebody-elses-balance');
  assert.equal(bal?.id, 'b1');
});

test('the seed is guarded on the account having no balance, in the statement itself', () => {
  /*  A fake believes whatever the where clause says, so the guard that
   *  actually holds the line is asserted as text. Without it two writes
   *  arriving at once leave an account with two balances called Main. */
  const src = readFileSync('lib/server/balances.ts', 'utf8');
  assert.match(src, /insert into balances/);
  assert.match(src, /not exists \(select 1 from balances b where b\.account_id = a\.id\)/);
  assert.match(src, /on conflict do nothing/);
  /*  And it is seeded from the ACCOUNT'S own figures, exactly as migration
      0011 seeds it, never from a default sitting in this file. */
  assert.match(src, /a\.currency, a\.balance_start_pence, a\.unit_pence/);
});

// ------------------------------------------------------------ the currency

test('a slip in one currency is never written into a balance kept in another', () => {
  /*  The balance decides what a stake is denominated in, so a euro slip
   *  confirmed against a sterling balance records fifty euro as fifty pounds
   *  and nothing on any screen says otherwise. Refused, never converted: a
   *  rate would make a settled bet's return move overnight. */
  assert.equal(currencyAgrees('EUR', 'GBP'), false);
  assert.equal(currencyAgrees('GBP', 'EUR'), false);
  assert.equal(currencyAgrees('GBP', 'GBP'), true);
  assert.equal(currencyAgrees('EUR', 'EUR'), true);
});

test('a currency the reader never found agrees with every balance', () => {
  /*  Refusing on a field that was not read would block the ordinary case to
   *  catch the rare one. Unknown is not a disagreement. */
  assert.equal(currencyAgrees(null, 'EUR'), true);
  assert.equal(currencyAgrees('EUR', null), true);
  assert.equal(currencyAgrees(null, null), true);
});

test('the route and the confirm button hold the currency rule through one function', () => {
  /*  Two implementations of one rule is how a button and the route it calls
   *  come to disagree about what is allowed. */
  assert.match(BETS_ROUTE, /currencyAgrees\(/, '/api/bets does not use the shared rule');
  const review = readFileSync('components/app/ReviewSlip.tsx', 'utf8');
  assert.match(review, /currencyAgrees\(/, 'the review screen does not use the shared rule');
  assert.match(review, /disabled=\{saving \|\| open > 0 \|\| heldOnDuplicate \|\| wrongCurrency\}/,
    'confirm is not held on a currency the balance cannot hold');
});

test('the reader compares a slip against the OPEN BALANCE, not the account row', () => {
  /*  accounts.currency is what a balance was seeded from and nothing reads it
   *  for a figure once a balance exists. Comparing against it refused every
   *  euro slip on an account whose row said GBP, including one sent with the
   *  euro balance open. */
  const extract = readFileSync('app/api/extract/route.ts', 'utf8');
  assert.match(extract, /currentBalance\(accountId, await openBalanceId\(\)\)/);
  const from = extract.indexOf('async function ledgerCurrency');
  const body = extract.slice(from, extract.indexOf('\n}', from));
  assert.ok(
    body.indexOf('currentBalance') < body.indexOf('select currency from accounts'),
    'the account row is consulted before the balance',
  );
});

// ------------------------------------------------- every entry path names it

test('every path that writes a bet or a movement names the balance it lands in', () => {
  /*  A control that files money somewhere without saying where is how a top
   *  up meant for the matched betting float ends up in the football bank. */
  const paths: [string, RegExp][] = [
    ['components/app/ManualEntry.tsx', /<BalanceChoice/],
    ['components/app/ReviewSlip.tsx', /<BalanceChoice/],
    ['components/app/RecordMovement.tsx', /\{balanceName\}/],
  ];
  for (const [file, wanted] of paths) {
    assert.match(readFileSync(file, 'utf8'), wanted, `${file} does not name the balance`);
  }
});

test('the pages hand the entry forms the balance that is open, never a first row', () => {
  /*  The sensible default is the balance selected in the app chrome. Both
   *  pages read it off the viewer, which resolves the same cookie the top bar
   *  switcher writes, so the form and the chrome cannot disagree. */
  for (const file of ['app/app/import/manual/page.tsx', 'app/app/import/review/page.tsx']) {
    const src = readFileSync(file, 'utf8');
    assert.match(src, /getViewer\(\)/, `${file} does not ask the viewer`);
    assert.match(src, /balanceId=\{balance\.id\}/, `${file} does not pass the open balance`);
    assert.doesNotMatch(src, /balances\[0\]/, `${file} reaches for a hardcoded first row`);
  }
});

test('choosing a balance on a form writes the same cookie the top bar writes', () => {
  /*  One switch, not two. A form that kept its own idea of which balance was
   *  open would write a bet into one balance while the chrome above it named
   *  another. Never localStorage: iOS Safari is the primary target. */
  const choice = readFileSync('components/app/BalanceChoice.tsx', 'utf8');
  const bar = readFileSync('components/app/BalanceSwitch.tsx', 'utf8');
  const cookie = /document\.cookie = `slip_balance=\$\{encodeURIComponent\(id\)\}; path=\/; max-age=31536000; samesite=lax`/;
  assert.match(choice, cookie);
  assert.match(bar, cookie);
  assert.doesNotMatch(choice, /localStorage|sessionStorage/);
  // The refresh is what re-denominates the form behind it.
  assert.match(choice, /router\.refresh\(\)/);
});

test('the manual form never says pounds on a balance kept in euro', () => {
  /*  The stake hint read "In pounds and pence" whatever the balance was. A
   *  balance's currency comes with it, so the sentence naming the money has
   *  to come from the balance too. */
  const src = readFileSync('components/app/ManualEntry.tsx', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');   // the comment naming the defect is not the product
  assert.doesNotMatch(src, /In pounds and pence/);
  assert.match(src, /CURRENCY_WORD\[currency\]/);
});

// ------------------------------------------------------------------ the bot

test('the bot says which balance a bet from a chat is filed in', () => {
  /*  A chat cannot be asked which balance you mean, so it files into the
   *  first one. That is only acceptable if it is said out loud. */
  const one = balanceReply([{ name: 'Main', currency: 'GBP' }]);
  assert.match(one, /^Main, kept in pounds\./);
  assert.match(one, /A bet from this chat is filed there/);

  const many = balanceReply([
    { name: 'Main', currency: 'GBP' },
    { name: 'Horses', currency: 'GBP' },
    { name: 'Euro account', currency: 'EUR' },
  ]);
  assert.match(many, /^Main, kept in pounds\./, 'it did not name the one a bet lands in first');
  assert.match(many, /All 3: Main \(£\), Horses \(£\), Euro account \(€\)/);
  assert.match(many, /send it in the app instead/, 'it offers no way to put a slip elsewhere');
});

test('the bot never invents a balance for an account that has none', () => {
  assert.equal(balanceReply([]), REPLIES.noBalance);
  assert.match(REPLIES.noBalance, /no balance yet/);
});

test('the bot lists the balance command where it lists the others', () => {
  assert.match(REPLIES.help, /\/balance/);
  const route = readFileSync('app/api/telegram/route.ts', 'utf8');
  assert.match(route, /case '\/balance'/, 'the command is listed and not handled');
  assert.match(route, /listBalances\(link\.accountId\)/, 'it answers from a table rather than a query');
});

test('the confirm reply tells a missing slip from one already saved', () => {
  /*  It answered "already saved" to a key that names no row at all, which
   *  sends somebody to look in the ledger for a bet that was never written. */
  const route = readFileSync('app/api/telegram/route.ts', 'utf8');
  assert.match(route, /state === 'missing'/);
  assert.match(route, /no longer waiting to be confirmed/);
  assert.match(route, /saved\$\{done\.balanceName \? ` in \$\{done\.balanceName\}` : ''\}/);
});

// ------------------------------------------------------------- the migration

test('the balance seed is a checked in migration, numbered after the one it re-runs', () => {
  /*  It used to assert this was the LAST file in the directory, which is a
      test that fails the first time anybody adds a migration for anything
      else: the next one along was the liquid to sage rename, and it broke
      this. What the seed actually needs is to run after 0011, whose seed it
      repeats and whose not null constraints it satisfies, and the runner
      applies files in filename order, so that is what is asserted. */
  const files = readdirSync('migrations').filter((f) => f.endsWith('.sql')).sort();
  const mine = files.filter((f) => f.startsWith('0017_'));
  assert.equal(mine.length, 1, `expected one 0017, found ${mine.join(', ')}`);
  const seeded = files.find((f) => f.startsWith('0011_'));
  assert.ok(seeded, 'the migration this one re-runs has gone');
  assert.ok(mine[0] > seeded, `${mine[0]} must sort after ${seeded}`);
  /*  And every migration is numbered uniquely, or the runner applies two files
      in an order that depends on the rest of the name. */
  const numbers = files.map((f) => f.slice(0, 4));
  assert.equal(new Set(numbers).size, numbers.length, `duplicate migration numbers: ${numbers.join(', ')}`);

  const sql = readFileSync(`migrations/${mine[0]}`, 'utf8');
  /*  Guarded on the account having no balances rather than on this file never
      having run, so it is safe to apply twice. */
  assert.match(sql, /where not exists \(select 1 from balances b where b\.account_id = a\.id\)/);
  assert.match(sql, /a\.currency, a\.balance_start_pence, a\.unit_pence/);
  // And the unique index that stops a second Main, added only when it can be.
  assert.match(sql, /create unique index if not exists balances_name_idx/);
  assert.match(sql, /having count\(\*\) > 1/);
  assert.doesNotMatch(sql, /drop |alter column .* drop not null/i, 'a migration that goes backwards');
});
