/* 08 · EXPORT. A stable column order, because people build spreadsheets on it.
 *
 * No format was specified anywhere and the button raised a toast. CSV first,
 * with a header row and an order that is fixed from here on: a column that
 * moves breaks every formula anybody has written against a previous export,
 * silently, and they will not find out until a total is wrong.
 *
 * NOT A TAX RETURN. UK betting winnings are not taxed, so this exists for the
 * Slipper's own spreadsheet. Nothing here is framed as an HMRC document and
 * nothing should be.
 */

export const CSV_COLUMNS = [
  'date_utc', 'date_local', 'bookmaker', 'sport', 'competition', 'event',
  'selection', 'market', 'bet_type', 'legs', 'each_way', 'place_terms',
  'stake', 'currency', 'unit_at_placement', 'price_decimal', 'price_fractional',
  'commission_rate', 'outcome', 'returned', 'profit', 'is_bonus', 'slip_backed',
  'tipster', 'tags', 'notes',
] as const;

export type CsvColumn = (typeof CSV_COLUMNS)[number];
export type CsvRow = Partial<Record<CsvColumn, string | number | boolean | null | undefined>>;

/* RFC 4180 quoting. A selection like `Arsenal "to win", 1-0` will otherwise
   split one bet across three columns and shift every column after it. */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v);
  if (!/[",\n\r]/.test(s)) return s;
  return '"' + s.replace(/"/g, '""') + '"';
}

export function toCsv(rows: readonly CsvRow[]): string {
  const head = CSV_COLUMNS.join(',');
  const body = rows.map((r) => CSV_COLUMNS.map((c) => csvCell(r[c])).join(','));
  /* CRLF, because Excel on Windows treats a bare LF as one long line. */
  return [head, ...body].join('\r\n') + '\r\n';
}

/* Excel reads a bare UTF-8 file as Windows-1252 and turns £ into Â£, which
   makes every money column look corrupted. The byte-order mark is the only
   thing that stops it. */
export const CSV_BOM = '﻿';

export function csvFilename(from: Date, to: Date): string {
  const d = (x: Date) => x.toISOString().slice(0, 10);
  return `slippery-${d(from)}-to-${d(to)}.csv`;
}
