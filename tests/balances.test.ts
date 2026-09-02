import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoData } from '@/lib/data/demo';
import { summarise, breakdown, byDay, realisedPence, netByCurrency } from '@/lib/data/analytics';
import {
  balanceById, byCurrency, inBalance, nameList, resolveBalance,
} from '@/lib/domain/balances';
import { totalMovements } from '@/lib/domain/movements';
import { balanceSheet } from '@/lib/data/balance-sheet';

const NOW = new Date('2026-08-31T12:00:00Z');
const data = demoData(NOW);

// ------------------------------------------------------------ the shape

test('the example account keeps more than one balance, and one of them is in euro', () => {
  /*  One balance is not an example of anything, and one CURRENCY is not an
   *  example of the rule that matters here: without a second one, nothing on
   *  any screen demonstrates that two of them never add up. */
  assert.ok(data.balances.length >= 2, `only ${data.balances.length} balance`);
  const currencies = new Set(data.balances.map((b) => b.currency));
  assert.ok(currencies.has('GBP') && currencies.has('EUR'), [...currencies].join(', '));
});

test('every bet and every movement belongs to a balance that exists', () => {
  // Nothing orphaned. A row in no balance is a row no screen can show.
  for (const b of data.bets) {
    assert.ok(balanceById(data.balances, b.balanceId), `bet ${b.id} is in no balance`);
  }
  for (const m of data.movements) {
    assert.ok(balanceById(data.balances, m.balanceId), `movement ${m.id} is in no balance`);
  }
});

test('a balance has one currency, and every bet in it is in that currency', () => {
  /*  THE WHOLE RULE RESTS ON THIS. A selection inside a balance has one
   *  currency by construction, which is why no page has to check: it cannot
   *  see two at once. If this ever fails, every figure downstream of it is
   *  a sum of pounds and euros. */
  for (const bal of data.balances) {
    for (const b of inBalance(data.bets, bal.id)) {
      assert.equal(b.currency, bal.currency, `${b.id} is ${b.currency} in a ${bal.currency} balance`);
    }
    for (const m of inBalance(data.movements, bal.id)) {
      assert.equal(m.currency, bal.currency, `${m.id} is ${m.currency} in a ${bal.currency} balance`);
    }
  }
});

// ------------------------------------------------- one balance sees one book

test('a bet in one balance never reaches another balance return figure', () => {
  /*  The defect this exists to prevent, stated as an experiment: take one
   *  bet out of its own balance and put it in every other, and no figure in
   *  any of them may move. */
  const [a, b] = data.balances;
  const aBets = inBalance(data.bets, a.id);
  const bBets = inBalance(data.bets, b.id);
  assert.ok(aBets.length > 0 && bBets.length > 0, 'both balances need bets to compare');

  const before = summarise(bBets);
  const moved = aBets[0];
  assert.ok(!bBets.some((x) => x.id === moved.id), 'the two balances share a bet');

  // And it is not merely absent from the list: it is absent from the maths.
  const withIt = summarise([...bBets, moved]);
  assert.notEqual(withIt.netPence, before.netPence, 'the fixture bet has no effect at all, so this proves nothing');
  assert.equal(summarise(bBets).roi, before.roi);
  assert.equal(summarise(bBets).turnoverPence, before.turnoverPence);
  assert.equal(summarise(bBets).count, before.count);
});

test('every balance figure derives from that balance own rows, and they partition the book', () => {
  /*  Rule 5 of the codebase, one balance along: the parts sum to the whole
   *  because they ARE the whole, split once. A bet counted in two balances,
   *  or in none, would break this before it broke a screen. */
  const counted = data.balances.reduce((a, bal) => a + inBalance(data.bets, bal.id).length, 0);
  assert.equal(counted, data.bets.length);
  const moves = data.balances.reduce((a, bal) => a + inBalance(data.movements, bal.id).length, 0);
  assert.equal(moves, data.movements.length);
});

test('a breakdown of one balance contains only that balance rows', () => {
  const bal = data.balances[0];
  const rows = inBalance(data.bets, bal.id);
  const sports = breakdown(rows, 'sport');
  assert.equal(sports.reduce((a, r) => a + r.count, 0), rows.length);
  assert.equal(sports.reduce((a, r) => a + r.netPence, 0), summarise(rows).netPence);
});

test('the calendar for one balance carries only that balance money', () => {
  /*  The calendar is the most looked at surface here, so a day cell that
   *  quietly included the horses bank would be the most visible version of
   *  this defect. */
  const [a, b] = data.balances;
  const aDays = byDay(inBalance(data.bets, a.id));
  const bDays = byDay(inBalance(data.bets, b.id));
  const bByDay = new Map(bDays.map((d) => [d.day, d.netPence]));
  const shared = aDays.filter((d) => bByDay.has(d.day) && bByDay.get(d.day) !== 0);
  assert.ok(shared.length > 0, 'the two balances never settled on the same day, so this proves nothing');

  const whole = new Map(byDay(data.bets).map((d) => [d.day, d.netPence]));
  for (const d of shared) {
    assert.notEqual(d.netPence, whole.get(d.day), `${d.day} reads the same with and without the other balance`);
  }

  const aNet = aDays.reduce((x, d) => x + d.netPence, 0);
  assert.equal(aNet, realisedPence(inBalance(data.bets, a.id).filter((x) => x.state.status !== 'open')));
});

// ----------------------------------------------------- two currencies, apart

test('two currencies produce two totals and never one', () => {
  /*  netByCurrency is the only function in the product that looks at more
   *  than one currency at a time, and it hands them back APART. There is no
   *  field on its result that could hold the sum, which is the point: a
   *  caller cannot add them by accident, only on purpose. */
  const split = netByCurrency(data.bets);
  assert.ok(split.GBP !== 0, 'no sterling in the example account');
  assert.ok(split.EUR !== 0, 'no euro in the example account');

  const gbp = data.balances.filter((b) => b.currency === 'GBP');
  const eur = data.balances.filter((b) => b.currency === 'EUR');
  const gbpNet = gbp.reduce((a, b) => a + realisedPence(inBalance(data.bets, b.id)), 0);
  const eurNet = eur.reduce((a, b) => a + realisedPence(inBalance(data.bets, b.id)), 0);
  assert.equal(gbpNet, split.GBP);
  assert.equal(eurNet, split.EUR);

  /*  And the two are genuinely different quantities: a test that passed
   *  because one of them happened to be zero would prove nothing. */
  assert.notEqual(split.EUR, 0);
});

test('money in and money out are counted per currency, never across', () => {
  for (const { currency, balances } of byCurrency(data.balances)) {
    const ids = new Set(balances.map((b) => b.id));
    const moves = data.movements.filter((m) => ids.has(m.balanceId));
    assert.ok(moves.every((m) => m.currency === currency));
    // Every figure the sheet prints for this currency comes off this set.
    const t = totalMovements(moves);
    assert.equal(t.depositedMinor - t.withdrawnMinor, t.netInMinor);
  }
  const currencies = byCurrency(data.balances).map((g) => g.currency);
  assert.equal(new Set(currencies).size, currencies.length, 'a currency appears twice');
});

// ------------------------------------------------------------- resolving one

test('a cookie naming a balance that no longer exists falls back to the first', () => {
  /*  Not to an empty screen. An account with no bets on it and nothing
   *  saying why is the worst possible answer to a stale cookie. */
  assert.equal(resolveBalance(data.balances, 'bal-nothing').id, data.balances[0].id);
  assert.equal(resolveBalance(data.balances, undefined).id, data.balances[0].id);
  assert.equal(resolveBalance(data.balances, data.balances[1].id).id, data.balances[1].id);
});

test('an archived balance is not the one you land on', () => {
  const archived = [{ ...data.balances[0], archived: true }, data.balances[1]];
  assert.equal(resolveBalance(archived, undefined).id, data.balances[1].id);
  // Unless every one of them is archived, in which case an account with a
  // closed book still has to be able to read it.
  const allGone = archived.map((b) => ({ ...b, archived: true }));
  assert.equal(resolveBalance(allGone, undefined).id, allGone[0].id);
});

test('the sentence naming a currency group lists its balances', () => {
  assert.equal(nameList([]), '');
  assert.equal(nameList([data.balances[0]]), data.balances[0].name);
  assert.equal(
    nameList(data.balances.slice(0, 2)),
    `${data.balances[0].name} and ${data.balances[1].name}`,
  );
  assert.equal(
    nameList(data.balances.slice(0, 3)),
    `${data.balances[0].name}, ${data.balances[1].name} and ${data.balances[2].name}`,
  );
});

// ---------------------------------------------------------- the balance sheet

test('every balance on the sheet is counted once, and the sheet counts the book', () => {
  /*  Rule 5. The lines partition the book, so the sheet's own count is the
   *  number of bets that went into it. A bet in two balances, or in none,
   *  shows up here rather than as a figure nobody can source. */
  const sheet = balanceSheet(data.balances, data.bets, data.movements);
  assert.equal(sheet.lines.length, data.balances.length);
  assert.equal(sheet.counted, data.bets.length);
});

test('a currency total is the sum of its own balances and of nothing else', () => {
  const sheet = balanceSheet(data.balances, data.bets, data.movements);
  for (const group of sheet.perCurrency) {
    const mine = sheet.lines.filter((l) => l.currency === group.currency);
    assert.equal(group.balances.length, mine.length);
    assert.equal(group.bets, mine.reduce((a, l) => a + l.bets, 0));
    assert.equal(group.netMinor, mine.reduce((a, l) => a + l.netMinor, 0));
    assert.equal(group.turnoverMinor, mine.reduce((a, l) => a + l.turnoverMinor, 0));
    assert.equal(group.balanceMinor, mine.reduce((a, l) => a + l.balanceMinor, 0));
    assert.equal(group.ownInMinor, mine.reduce((a, l) => a + l.ownInMinor, 0));
  }
});

test('the sheet has two currency totals and no field that could hold a third', () => {
  /*  The type is the enforcement: `perCurrency` and `lines`, and nothing
   *  else. A component cannot print a cross currency total by reaching for
   *  the wrong property, because there is no property to reach for. */
  const sheet = balanceSheet(data.balances, data.bets, data.movements);
  assert.deepEqual(Object.keys(sheet).sort(), ['counted', 'lines', 'perCurrency']);
  assert.ok(sheet.perCurrency.length >= 2, 'the example account needs two currencies to prove this');
  const currencies = sheet.perCurrency.map((c) => c.currency);
  assert.equal(new Set(currencies).size, currencies.length, 'a currency has two totals');

  /*  And the two are genuinely different money. If a future change made one
   *  of them empty, the assertion above would still pass and prove nothing. */
  for (const c of sheet.perCurrency) assert.ok(c.bets > 0, `${c.currency} has no bets`);
});

test('a currency return is net over turnover, never an average of the rows', () => {
  /*  Averaging them weights a balance with four bets in it the same as one
   *  with four hundred, which is the most misleading way to summarise a
   *  column of returns and the one every spreadsheet reaches for first. */
  const sheet = balanceSheet(data.balances, data.bets, data.movements);
  for (const group of sheet.perCurrency) {
    const expected = group.turnoverMinor > 0 ? (group.netMinor / group.turnoverMinor) * 100 : 0;
    assert.equal(group.roi, expected);
    const mine = sheet.lines.filter((l) => l.currency === group.currency);
    if (mine.length > 1) {
      const mean = mine.reduce((a, l) => a + l.roi, 0) / mine.length;
      assert.notEqual(Number(group.roi.toFixed(6)), Number(mean.toFixed(6)),
        'the weighted return and the mean of the rows agree, so this proves nothing');
    }
  }
});

test('every figure on a line comes from the same fold the ledger uses', () => {
  /*  Not recomputed here. A sheet with its own arithmetic is a second
   *  implementation of the ledger, and the first thing anybody notices is
   *  that it disagrees with the page it summarises. */
  const sheet = balanceSheet(data.balances, data.bets, data.movements);
  for (const line of sheet.lines) {
    const s = summarise(inBalance(data.bets, line.balance.id));
    assert.equal(line.netMinor, s.netPence);
    assert.equal(line.turnoverMinor, s.turnoverPence);
    assert.equal(line.roi, s.roi);
    assert.equal(line.units, s.units);
    assert.equal(line.bets, s.count);
    assert.equal(line.settled + line.open, s.count);
  }
});

test('a line balance is its own money in plus its own realised profit', () => {
  const sheet = balanceSheet(data.balances, data.bets, data.movements);
  for (const line of sheet.lines) {
    const bal = line.balance;
    const t = totalMovements(inBalance(data.movements, bal.id));
    assert.equal(line.ownInMinor, bal.startMinor + t.depositedMinor - t.withdrawnMinor);
    assert.equal(line.balanceMinor, line.ownInMinor + realisedPence(inBalance(data.bets, bal.id)));
  }
});
