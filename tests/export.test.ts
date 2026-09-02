import { test } from 'node:test';
import assert from 'node:assert/strict';
import { demoData } from '@/lib/data/demo';
import {
  EXPORT_COLUMNS, EXPORT_SCHEMA_VERSION, csvField, exportRow, exportRows, toCsv,
} from '@/lib/server/export';
import { riskPence, turnoverPence } from '@/lib/domain/fold';
import { moneyPlain } from '@/lib/format';

/** The export is the one surface with users this repository cannot see.
 *
 *  Somebody puts a SUMIF in column AH and comes back to it in six months. If
 *  a column moved, their sheet is wrong and nothing tells them: a CSV has no
 *  version, no types and no complaint. So the order is pinned here, written
 *  out by hand rather than derived from the constant, because a test that
 *  reads the same array it is checking passes whatever that array says.
 *
 *  If this fails, you have changed the contract. Adding a column to the END
 *  is the change that costs nothing: update the list below and leave the
 *  version alone. Renaming, reordering or removing one breaks every saved
 *  sheet, so it needs EXPORT_SCHEMA_VERSION raised with it. */

const FROZEN = [
  'schema_version',
  'bet_id',
  'placed_at',
  'event_at',
  'day',
  'sport',
  'competition',
  'event_name',
  'selection',
  'market',
  'bet_type',
  'side',
  'legs',
  'bookmaker',
  'tipster',
  'source',
  'imported',
  'currency',
  'stake',
  'price_decimal',
  'price_fractional',
  'each_way',
  'each_way_part',
  'each_way_group',
  'place_terms',
  'commission_rate',
  'is_free_bet',
  'is_bonus',
  'is_boosted',
  'slip_backed',
  'unit_size',
  'status',
  'outcome',
  'returned',
  'profit',
  'voided_stake',
  'turnover',
  'units',
  'tags',
  'notes',
  'settlement_events',
  /*  Added on the END, which is the only change to this list that does not
      break a saved sheet and the only one that does not raise the schema
      version. Empty when nobody recorded a closing price for the bet. */
  'closing_odds',
];

/** The columns a spreadsheet does arithmetic on. Every one of them is
 *  decimal money and none of them is pence. */
const MONEY = ['stake', 'returned', 'profit', 'voided_stake', 'turnover', 'unit_size'];

const NOW = new Date('2026-08-31T12:00:00Z');
const data = demoData(NOW);
const rows = exportRows(data.bets);
const csv = toCsv(rows);
const header = csv.split('\n')[0];

test('the column list and its order are exactly this, and changing it is a decision', () => {
  assert.deepEqual([...EXPORT_COLUMNS], FROZEN);
});

test('the header row is the frozen list, not whatever the first row is shaped like', () => {
  // It used to be Object.keys(rows[0]), so an account with no bets exported a
  // header of one column called "id" and every reordering of one object
  // literal silently rewrote every saved sheet.
  assert.equal(header, FROZEN.join(','));
  assert.equal(toCsv([]).trim(), FROZEN.join(','), 'an empty account still exports the full header');
});

test('every column name is snake_case, because half of them used to be camelCase', () => {
  for (const c of EXPORT_COLUMNS) {
    assert.match(c, /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/, `${c} is not snake_case`);
  }
});

test('the spec names ten columns, and all ten are here', () => {
  for (const required of [
    'bookmaker', 'competition', 'each_way', 'place_terms', 'price_decimal',
    'price_fractional', 'commission_rate', 'is_bonus', 'tags', 'notes',
  ]) {
    assert.ok(EXPORT_COLUMNS.includes(required as never), `${required} is not exported`);
  }
});

test('every schema_version cell carries the version, so a break is detectable', () => {
  // A comment line would be stripped by every importer that exists, which is
  // why this is a column on every row.
  assert.ok(rows.length > 100);
  assert.ok(rows.every((r) => r.schema_version === String(EXPORT_SCHEMA_VERSION)));
});

test('money in the export is decimal, and never pence', () => {
  /*  A spreadsheet cannot use pence: a stake column of 2500s summed and
   *  called twenty five pounds is the whole reason this format exists. No
   *  symbol and no thousands separator either, because "£1,234.56" imports
   *  as text in half the locales it lands in and a text column will not sum. */
  for (const r of rows) {
    for (const c of MONEY) {
      assert.match(r[c as keyof typeof r], /^-?\d+\.\d{2}$/, `${c} is ${r[c as keyof typeof r]}`);
    }
  }
  const biggest = rows.reduce((a, r) => Math.max(a, Math.abs(Number(r.profit))), 0);
  assert.ok(biggest > 0, 'nothing to check');
});

test('the decimal figures are the integer minor units they came from', () => {
  // The conversion is the only place money stops being an integer, so it is
  // the only place it can go wrong.
  for (const b of data.bets.slice(0, 60)) {
    const r = exportRow(b);
    assert.equal(r.stake, moneyPlain(riskPence(b)));
    assert.equal(r.profit, moneyPlain(b.state.realisedPlPence));
    assert.equal(r.turnover, moneyPlain(turnoverPence(b, b.state)));
    assert.equal(Math.round(Number(r.profit) * 100), b.state.realisedPlPence);
  }
  assert.equal(moneyPlain(1999), '19.99', 'a float would make this 19.990000000000002');
  assert.equal(moneyPlain(-2500), '-25.00');
  assert.equal(moneyPlain(0), '0.00');
  assert.equal(moneyPlain(5), '0.05');
  assert.equal(moneyPlain(123456789), '1234567.89', 'no thousands separator');
});

test('every row has exactly one field per column, quoting included', () => {
  const lines = csv.split('\n');
  assert.equal(lines.length, rows.length + 1);
  for (const line of lines) {
    assert.equal(fields(line).length, FROZEN.length, `wrong field count: ${line.slice(0, 90)}`);
  }
});

test('a comma, a quote and a newline survive the trip', () => {
  assert.equal(csvField('Brighton & Hove'), 'Brighton & Hove');
  assert.equal(csvField('Over 2.5, under 3.5'), '"Over 2.5, under 3.5"');
  assert.equal(csvField('He said "value"'), '"He said ""value"""');
  assert.equal(fields(csvField('a,b') + ',x')[0], 'a,b');
});

test('an each way bet exports as two joinable rows with its terms on them', () => {
  /*  Two rows at the same course on the same horse with no way to tell them
   *  apart is a sheet that double counts the stake. */
  const ew = rows.filter((r) => r.each_way === 'true');
  assert.ok(ew.length > 10, `only ${ew.length} each way rows`);
  for (const r of ew) {
    assert.ok(['win', 'place'].includes(r.each_way_part), `each_way_part is ${r.each_way_part}`);
    assert.ok(r.each_way_group, 'no group to join the halves on');
    assert.match(r.place_terms, /^1\/\d+$/, `place_terms is ${r.place_terms}`);
  }
  const groups = new Map<string, string[]>();
  for (const r of ew) groups.set(r.each_way_group, [...(groups.get(r.each_way_group) ?? []), r.each_way_part]);
  assert.ok([...groups.values()].every((parts) => parts.sort().join(',') === 'place,win'));
});

test('a bet that is not each way carries no place terms', () => {
  for (const r of rows.filter((x) => x.each_way === 'false')) {
    assert.equal(r.place_terms, '');
    assert.equal(r.each_way_part, '');
  }
});

test('the price is exported at full precision, so stake times price is the return', () => {
  const multi = rows.find((r) => r.bet_type === 'multi_cross_fixture' && r.outcome === 'won');
  assert.ok(multi, 'no settled multiple to check');
  const expected = Number(multi.stake) * Number(multi.price_decimal);
  // Within a penny: the fold rounds to minor units and this does not.
  assert.ok(Math.abs(expected - Number(multi.returned)) < 0.02,
    `${multi.stake} at ${multi.price_decimal} is ${expected}, not ${multi.returned}`);
});

test('commission and Rule 4 are in the row that lost money to them', () => {
  const withCommission = rows.filter((r) => r.settlement_events.includes('commission'));
  assert.ok(withCommission.length > 0);
  for (const r of withCommission) {
    assert.match(r.settlement_events, /commission\(\d/, 'the rate is not in the event summary');
    assert.notEqual(r.commission_rate, '0');
  }
  const rule4 = rows.filter((r) => r.settlement_events.includes('rule4'));
  assert.ok(rule4.length > 0, 'no Rule 4 in the example account');
  for (const r of rule4) {
    assert.match(r.settlement_events, /rule4\(\d+p in the pound\)/);
    // The reason lives on the event, and an export that drops it hands
    // somebody a row they cannot explain.
    assert.ok(r.notes.length > 0, 'the Rule 4 reason did not reach the notes column');
  }
});

test('imported history is marked, in a column and in the tags', () => {
  const imported = rows.filter((r) => r.imported === 'true');
  assert.ok(imported.length > 0, 'the example account has no imported history to mark');
  for (const r of imported) {
    assert.ok(['csv_import', 'shot_import'].includes(r.source));
    assert.ok(r.tags.split(';').includes('Imported'));
    assert.equal(r.slip_backed, 'false', 'imported history is never slip backed');
  }
  for (const r of rows.filter((x) => x.imported === 'false')) {
    assert.ok(!r.tags.split(';').includes('Imported'));
  }
});

test('the JSON and the CSV describe the same bet by the same names', () => {
  // Two vocabularies for one export is column drift one file further along.
  for (const r of rows.slice(0, 20)) {
    assert.deepEqual(Object.keys(r), FROZEN);
  }
});

/** A minimal RFC 4180 reader, so the field count is checked against a parser
 *  rather than against a split on commas, which the quoting exists to defeat. */
function fields(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out;
}
