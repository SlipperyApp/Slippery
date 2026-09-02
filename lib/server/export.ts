/** The export, with its columns frozen.
 *
 *  WHY THIS IS A MODULE AND NOT A MAP LITERAL IN THE ROUTE. People build
 *  spreadsheets on this file. A formula in column M is a promise that column
 *  M is still the bookmaker next month, and the previous version made that
 *  promise by accident: the header row came from `Object.keys(rows[0])`, so
 *  the column order was whatever order the object literal happened to be
 *  written in and any reordering of that literal silently rewrote every
 *  saved sheet. EXPORT_COLUMNS is the contract, tests/export.test.ts pins it
 *  character for character, and a change to it has to be meant.
 *
 *  HOW IT MAY CHANGE. A new column goes on the END. Renaming, reordering or
 *  removing one is a breaking change and needs EXPORT_SCHEMA_VERSION raised
 *  with it, which is why the version is a column on every row rather than a
 *  comment: a comment line is stripped by every importer that exists, so a
 *  consumer could not detect the break it was about to walk into.
 *
 *  MONEY IS DECIMAL HERE AND NOWHERE ELSE. Internally money is integer minor
 *  units and it stays that way to the last statement of this file. A
 *  spreadsheet cannot use pence: summing a stake column of 2500s and calling
 *  it twenty five pounds is the error this format exists to prevent. The
 *  conversion is moneyPlain() in lib/format.ts, so the export cannot
 *  disagree with the app about what a pound is. */

import { effectiveOdds, riskPence, turnoverPence } from '@/lib/domain/fold';
import { betTags } from '@/lib/domain/working';
import { isImportedSource } from '@/lib/domain/types';
import { bookmakerName } from '@/lib/data/reference';
import { dayKey, DEFAULT_TZ, moneyPlain, type TimeZone } from '@/lib/format';
import { placeTerms, toFractional } from '@/lib/odds';
import type { DemoBet } from '@/lib/data/demo';

/** Raised only when a column is renamed, reordered or removed. Adding one to
 *  the end does not break a sheet and does not raise this. */
export const EXPORT_SCHEMA_VERSION = 1;

/** THE FROZEN ORDER. Every name is snake_case, every amount is decimal, and
 *  nothing here moves. */
export const EXPORT_COLUMNS = [
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
  /*  ON THE END, which is why the schema version is unchanged: a formula in
      column M still points at the bookmaker and every saved sheet keeps
      working. An empty cell here means nobody recorded a closing price for
      that bet, and it is empty rather than 0 for the same reason it is null
      in the database: a zero would be read as a price. */
  'closing_odds',
] as const;

export type ExportColumn = (typeof EXPORT_COLUMNS)[number];
export type ExportRow = Record<ExportColumn, string>;

/*  Every value is a string, in both formats.
 *
 *  The CSV and the JSON used to be built from two different objects with two
 *  different vocabularies, camelCase in one and nothing agreed in the other,
 *  which is the same column drift one file further along: an importer
 *  written against the JSON and a sheet written against the CSV disagreed
 *  about the name of every field. One row builder, one set of names, and a
 *  reader of either format sees the same bet. */
const yesNo = (v: boolean) => (v ? 'true' : 'false');

/** Every event, named and quantified, in the order they were applied.
 *
 *  A settled figure somebody disputes is settled by this column: it is the
 *  append only ledger the profit was folded from. The deduction and the
 *  commission carry their size, because "rule4" alone does not tell anybody
 *  where the missing four pounds went. */
function eventSummary(b: DemoBet): string {
  return b.events
    .map((e) => {
      const detail = e.type === 'cash_out_partial' ? `(${e.fractionEighths ?? 0}/8)`
        : e.type === 'rule4' ? `(${e.deductionPence ?? 0}p in the pound)`
          : e.type === 'commission' ? `(${e.commissionPct ?? b.commissionPct}%)`
            : '';
      return `${e.type}${detail}`;
    })
    .join(' | ');
}

/** The bet's own note, and every note attached to a settlement event.
 *
 *  "Non runner withdrawn before the off." is the reason a winner paid less
 *  than the price says, and it lived only on the event. An export that drops
 *  it hands somebody a row they cannot explain and no way to find out. */
function notesOf(b: DemoBet): string {
  return [b.note, ...b.events.map((e) => e.note)]
    .filter((n): n is string => Boolean(n && n.trim()))
    .join('; ');
}

export function exportRow(b: DemoBet, tz: TimeZone = DEFAULT_TZ): ExportRow {
  const odds = effectiveOdds(b);
  return {
    schema_version: String(EXPORT_SCHEMA_VERSION),
    bet_id: b.id,
    placed_at: b.placedAt,
    event_at: b.eventAt,
    day: dayKey(b.eventAt, tz),
    sport: b.sportId,
    competition: b.competition ?? '',
    event_name: b.eventName,
    selection: b.selection,
    market: b.marketRaw,
    bet_type: b.shape,
    side: b.side,
    /*  THE FIXTURE, WITH THE SELECTION AND THE PRICE. This column read
        "Leeds @ 1.97 | Over 2.5 goals @ 1.34 | Over 2.5 goals @ 1.97": three
        markets, no matches, so a spreadsheet of accas could not be sorted,
        filtered or checked against a bookmaker's own statement. `eventName`
        was on the leg the whole time. */
    legs: b.legs.map((l) => `${l.selection}${l.eventName && l.eventName !== l.selection ? ` (${l.eventName})` : ''} @ ${l.legOdds}`).join(' | '),
    bookmaker: bookmakerName(b.bookmakerId),
    tipster: b.tipsterId ?? '',
    source: b.source,
    imported: yesNo(isImportedSource(b.source)),
    currency: b.currency,
    /*  A lay risks the liability, and the liability is what the rest of the
        row is worked out from, so it is what this column carries. */
    stake: moneyPlain(riskPence(b)),
    /*  Full precision, not the two places the app shows. A five fold prices
        at 7.3155, and rounding it here would make stake times price
        disagree with the returned column by a few pence on every multiple,
        which is exactly the check a spreadsheet is built to do. */
    price_decimal: String(odds),
    price_fractional: toFractional(odds),
    each_way: yesNo(b.isEachWay),
    each_way_part: b.ewPart ?? '',
    /*  The two halves of an each way bet are two rows. Without the group
        they are two indistinguishable rows at the same price on the same
        horse, and the sheet double counts the stake. */
    each_way_group: b.ewGroupId ?? '',
    place_terms: placeTerms(b.ewPlaceFraction),
    /** Per cent, on winnings only. */
    commission_rate: String(b.commissionPct),
    is_free_bet: yesNo(b.isFreeBet),
    is_bonus: yesNo(b.isBonusFunds),
    is_boosted: yesNo(b.isBoosted),
    slip_backed: yesNo(b.slipBacked),
    unit_size: moneyPlain(b.unitPenceAtPlacement),
    status: b.state.status,
    outcome: b.state.outcome ?? '',
    returned: moneyPlain(b.state.returnedPence),
    profit: moneyPlain(b.state.realisedPlPence),
    voided_stake: moneyPlain(b.state.voidedStakePence),
    turnover: moneyPlain(turnoverPence(b, b.state)),
    /*  Units are a ratio rather than money, so they are not minor units and
        moneyPlain would be wrong. Two places, as everywhere but a league. */
    units: b.state.units.toFixed(2),
    tags: betTags(b).join(';'),
    notes: notesOf(b),
    settlement_events: eventSummary(b),
    /*  Full precision, like price_decimal above it, so a sheet dividing one
        by the other gets the same figure the app shows. Empty when nobody
        recorded one: see EXPORT_COLUMNS for why that is not a zero. */
    closing_odds: b.closingOdds == null ? '' : String(b.closingOdds),
  };
}

export function exportRows(bets: DemoBet[], tz: TimeZone = DEFAULT_TZ): ExportRow[] {
  /*  The day column is the account's own day, not the server's. A
      spreadsheet built on this groups by it, and a row filed under the wrong
      date is a wrong daily total in somebody else's tool where nothing here
      can correct it. */
  return bets.map((b) => exportRow(b, tz));
}

/** RFC 4180 quoting: a field containing a quote, a comma or a newline is
 *  wrapped and its quotes doubled. */
export function csvField(value: string): string {
  return /["\n\r,]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** The header comes from EXPORT_COLUMNS, never from the first row's keys.
 *  An account with no bets used to export a header of one column called
 *  "id", because there was no row to take the keys from. */
export function toCsv(rows: ExportRow[]): string {
  return [
    EXPORT_COLUMNS.join(','),
    ...rows.map((r) => EXPORT_COLUMNS.map((c) => csvField(r[c])).join(',')),
  ].join('\n');
}
