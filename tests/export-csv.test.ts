import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSV_COLUMNS, toCsv, csvCell, csvFilename } from '../lib/export-csv.ts';

test('the column order is fixed, because people build formulas on it', () => {
  /* This assertion exists to make a column move impossible to do by accident.
     If you are changing it deliberately, the old order has to keep working
     for anyone who already exported. */
  assert.deepEqual([...CSV_COLUMNS], [
    'date_utc','date_local','bookmaker','sport','competition','event',
    'selection','market','bet_type','legs','each_way','place_terms',
    'stake','currency','unit_at_placement','price_decimal','price_fractional',
    'commission_rate','outcome','returned','profit','is_bonus','slip_backed',
    'tipster','tags','notes',
  ]);
});

test('a selection containing a comma or a quote does not shift the columns', () => {
  assert.equal(csvCell('Arsenal to win'), 'Arsenal to win');
  assert.equal(csvCell('Arsenal "to win", 1-0'), '"Arsenal ""to win"", 1-0"');
  assert.equal(csvCell('line one\nline two'), '"line one\nline two"');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(false), 'false');
});

test('every row has every column, in order, even when the bet has no value for it', () => {
  const csv = toCsv([{ event: 'Arsenal v Spurs', stake: '25.00', currency: 'GBP' }]);
  const [head, row] = csv.trim().split('\r\n');
  assert.equal(head.split(',').length, CSV_COLUMNS.length);
  assert.equal(row.split(',').length, CSV_COLUMNS.length);
  assert.equal(row.split(',')[CSV_COLUMNS.indexOf('event')], 'Arsenal v Spurs');
  assert.equal(row.split(',')[CSV_COLUMNS.indexOf('currency')], 'GBP');
});

test('lines end CRLF, because Excel reads a bare LF as one long line', () => {
  assert.ok(toCsv([{ event: 'a' }]).includes('\r\n'));
});

test('the filename says what period it covers', () => {
  assert.equal(csvFilename(new Date('2026-01-01'), new Date('2026-08-19')),
    'slippery-2026-01-01-to-2026-08-19.csv');
});
