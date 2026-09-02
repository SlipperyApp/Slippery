'use client';

import { Icon } from '@/components/Icon';
import { OutcomePill } from './BetRow';
import { effectiveOdds } from '@/lib/domain/fold';
import { betTags, legLine } from '@/lib/domain/working';
import { formatOdds, type OddsFormat } from '@/lib/odds';
import { bookmakerName } from '@/lib/data/reference';
import {
  money, shortDate, timeOfDay, units as fmtUnits, DEFAULT_TZ, type TimeZone,
} from '@/lib/format';
import { movementLabel, type Movement } from '@/lib/domain/movements';
import type { DemoBet } from '@/lib/data/demo';
import type { Currency } from '@/lib/domain/types';

/** THE LEDGER AS A TABLE, WHICH IS WHAT A LEDGER IS.
 *
 *  The stacked row this replaces above 1000px was a phone row given a
 *  thousand more pixels and told to spread. Measured at 1440: the row was
 *  1110px wide, the text inside it took about 460 of them and the money sat
 *  at the far right, so reading thirty bets meant a thousand pixel eye
 *  movement per row or reading one column and giving up. Every product a
 *  customer arrives from, Betstamp and Pikkit and the spreadsheet before
 *  them, presents bets in columns you can scan and sort. This one presented
 *  them as a chat log.
 *
 *  ONE DOM, TWO LAYOUTS. The same table reshapes into the stacked row below
 *  1000px through CSS alone (see .btbl in components.css), because the other
 *  way of doing this is to render both and hide one, and a ledger page that
 *  ships fifty rows twice is fifty rows of markup nobody can see.
 *
 *  THE ROW SAYS IT IS PRESSABLE. It had no chevron, no hover treatment and
 *  no affordance of any kind, and the markup underneath was a <ul> inside a
 *  <button> inside an <li>, which is an invalid content model that axe does
 *  not catch. The button is now one button in one cell, carrying the row's
 *  accessible name, and the row around it is a click target for a mouse. */

export type SortKey = 'when' | 'bet' | 'stake' | 'price' | 'result' | 'pl';

/** Which way each column starts when you first press it. A date starts at
 *  the newest, money at the biggest, a name at A. Starting every column
 *  ascending means the first press on Profit shows the worst bet in the
 *  book, which is nobody's first question. */
export const FIRST_DIR: Record<SortKey, 'asc' | 'desc'> = {
  when: 'desc', bet: 'asc', stake: 'desc', price: 'desc', result: 'asc', pl: 'desc',
};

const COLUMNS: { key: SortKey; label: string; num?: boolean }[] = [
  { key: 'result', label: 'Result' },
  { key: 'bet', label: 'Bet' },
  { key: 'stake', label: 'Stake', num: true },
  { key: 'price', label: 'Price', num: true },
  { key: 'when', label: 'Event' },
  { key: 'pl', label: 'Profit', num: true },
];

const RESULT_ORDER: Record<string, number> = {
  open: 0, won: 1, placed: 2, void: 3, 'cash-profit': 4, 'cash-flat': 5, 'cash-loss': 6, lost: 7,
};

function resultRank(b: DemoBet): number {
  if (b.state.status === 'open') return 0;
  return RESULT_ORDER[b.state.outcome ?? 'open'] ?? 9;
}

export function sortBets(bets: DemoBet[], key: SortKey, dir: 'asc' | 'desc'): DemoBet[] {
  const sign = dir === 'asc' ? 1 : -1;
  const value = (b: DemoBet): number | string => {
    switch (key) {
      case 'when': return Date.parse(b.eventAt);
      case 'bet': return (b.legs.length > 1 ? `${b.legs.length} fold` : b.selection).toLowerCase();
      case 'stake': return b.side === 'lay' ? (b.liabilityPence ?? 0) : b.stakePence;
      case 'price': return effectiveOdds(b);
      case 'result': return resultRank(b);
      default: return b.state.status === 'open' ? Number.NEGATIVE_INFINITY : b.state.realisedPlPence;
    }
  };
  return [...bets].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    if (x === y) return Date.parse(b.eventAt) - Date.parse(a.eventAt);
    return (typeof x === 'string' ? String(x).localeCompare(String(y)) : (x as number) - (y as number)) * sign;
  });
}

export type Entry =
  | { kind: 'bet'; at: string; bet: DemoBet }
  | { kind: 'movement'; at: string; movement: Movement };

export function BetTable({
  entries, currency, oddsFormat, showUnits = false, tz = DEFAULT_TZ,
  sort, dir, onSort, onOpen, openId, balanceAfter,
}: {
  entries: Entry[];
  currency: Currency;
  oddsFormat: OddsFormat;
  showUnits?: boolean;
  tz?: TimeZone;
  sort: SortKey;
  dir: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
  onOpen: (bet: DemoBet) => void;
  /** Which bet the detail pane is showing, so the row it came from is marked
   *  rather than the reader having to remember which one they pressed. */
  openId: string | null;
  balanceAfter: Record<string, number | null>;
}) {
  return (
    <table className="btbl">
      <caption className="sr-only">
        Your bets, newest first. Press a column heading to sort by it, or a row to open the bet.
      </caption>
      <thead className="btbl__head">
        <tr>
          {COLUMNS.map((c) => (
            <th
              key={c.key}
              scope="col"
              className={`btbl__h2 btbl__h2--${c.key}${c.num ? ' btbl__h2--num' : ''}`}
              aria-sort={sort === c.key ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
            >
              <button type="button" className="btbl__h" onClick={() => onSort(c.key)}>
                {c.label}
                <Icon
                  name={sort === c.key ? (dir === 'asc' ? 'chevronUp' : 'chevronDown') : 'sort'}
                  size={13}
                  className={sort === c.key ? 'btbl__sort' : 'btbl__sort btbl__sort--off'}
                />
              </button>
            </th>
          ))}
          <th scope="col" className="btbl__h2 btbl__h2--go"><span className="sr-only">Open</span></th>
        </tr>
      </thead>
      <tbody className="btbl__body">
        {entries.map((e) => (e.kind === 'movement' ? (
          <MovementTr
            key={e.movement.id}
            movement={e.movement}
            balanceAfter={balanceAfter[e.movement.id] ?? null}
            currency={currency}
            tz={tz}
          />
        ) : (
          <BetTr
            key={e.bet.id}
            bet={e.bet}
            currency={currency}
            oddsFormat={oddsFormat}
            showUnits={showUnits}
            tz={tz}
            open={openId === e.bet.id}
            onOpen={onOpen}
          />
        )))}
      </tbody>
    </table>
  );
}

function BetTr({
  bet, currency, oddsFormat, showUnits, tz, open, onOpen,
}: {
  bet: DemoBet;
  currency: Currency;
  oddsFormat: OddsFormat;
  showUnits: boolean;
  tz: TimeZone;
  open: boolean;
  onOpen: (bet: DemoBet) => void;
}) {
  const s = bet.state;
  const live = s.status === 'open';
  const tone = s.realisedPlPence > 0 ? 'pos' : s.realisedPlPence < 0 ? 'neg' : '';
  const legs = bet.legs.length;
  /*  One list, shared with the export's tags column. It was written out here
      and again there, and two lists of the same facts drift. */
  const tags = betTags(bet);
  const title = legs > 1 ? `${legs} fold` : bet.selection;

  return (
    <tr
      className={`btbl__r${open ? ' btbl__r--on' : ''}`}
      /*  A mouse presses anywhere on the row; a keyboard presses the button
           in the first cell, which carries the same handler and the same
           accessible name. Two ways in, one action, and no second tab stop
           per row for anybody reading with the keyboard. */
      onClick={() => onOpen(bet)}
      aria-current={open ? 'true' : undefined}
    >
      <td className="btbl__c btbl__c--res"><OutcomePill bet={bet} /></td>
      <td className="btbl__c btbl__c--bet">
        {/*  THE WHOLE NAME IS THE CONTROL, both lines of it. A button around
             the title alone measured 19px on a phone, under the 44px thumb
             floor, and the row it sits in is 95px tall: the target was the
             one part of the row a thumb was least likely to land on. It also
             gives a screen reader the fixture in the button's own name
             rather than "Open Real Sociedad" and nothing about the match. */}
        <button
          type="button"
          className="btbl__open"
          onClick={(ev) => { ev.stopPropagation(); onOpen(bet); }}
        >
          <span className="btbl__sel">{title}</span>
          <span className="btbl__sub">
            {/*  THE FIXTURE, WITH THE SELECTION. A five fold read "Over 2.5
                 goals / Over 2.5 goals / Over 2.5 goals / Over 2.5 goals /
                 Over 2.5 goals", which names no match and no day, so the one
                 thing somebody comes to the ledger to do, find last
                 Saturday's acca, could not be done. lib/domain/working.ts
                 owns the line so the export prints the same one. */}
            {legs > 1 ? legLine(bet.legs) : `${bet.eventName} · ${bet.marketRaw}`}
            {tags.map((t) => <span key={t} className="btbl__tag"> · {t}</span>)}
          </span>
        </button>
      </td>
      <td className="btbl__c btbl__c--stake tnum">
        {money(bet.side === 'lay' ? (bet.liabilityPence ?? 0) : bet.stakePence, currency)}
      </td>
      <td className="btbl__c btbl__c--price tnum">{formatOdds(effectiveOdds(bet), oddsFormat)}</td>
      <td className="btbl__c btbl__c--when">
        <span className="btbl__book">{bookmakerName(bet.bookmakerId)}</span>
        <span className="btbl__date tnum">
          {shortDate(bet.eventAt, new Date(), tz)} {timeOfDay(bet.eventAt, tz)}
        </span>
      </td>
      <td className="btbl__c btbl__c--money">
        {live ? (
          <>
            <span className="fig fig--s dim tnum">
              {money(Math.round(bet.stakePence * effectiveOdds(bet)), currency)}
            </span>
            <span className="btbl__note">to return</span>
          </>
        ) : (
          <>
            <span className={`fig fig--s tnum ${tone}`}>
              {showUnits ? fmtUnits(s.units, { sign: true }) : money(s.realisedPlPence, currency, { sign: true })}
            </span>
            <span className="btbl__note tnum">{money(s.returnedPence, currency)} back</span>
          </>
        )}
      </td>
      <td className="btbl__c btbl__c--go" aria-hidden="true">
        <Icon name="chevronRight" size={15} />
      </td>
    </tr>
  );
}

/*  A movement in the same columns as the bets, because it happened to the
    same money on the same day. It is NOT a bet and nothing about it is in
    any betting figure on this page, which is why it takes the accent rule
    down its left edge, the signed tag where a bet carries its outcome, and
    neither result colour: paying money in is not winning. */
function MovementTr({
  movement, balanceAfter, currency, tz,
}: {
  movement: Movement;
  balanceAfter: number | null;
  currency: Currency;
  tz: TimeZone;
}) {
  const inward = movement.kind === 'deposit';
  return (
    <tr className="btbl__r btbl__r--mv">
      <td className="btbl__c btbl__c--res">
        <span className="mvrow__tag">
          <Icon name={inward ? 'plus' : 'minus'} size={12} strokeWidth={2.4} />
          {movementLabel(movement.kind)}
        </span>
      </td>
      <td className="btbl__c btbl__c--bet">
        <span className="btbl__open btbl__open--flat">
          <span className="btbl__sel">
            {inward ? 'Paid in' : 'Taken out'}
            {movement.bookmakerId ? ` at ${bookmakerName(movement.bookmakerId)}` : ''}
          </span>
        {/*  It says so out loud. The rule and the tag carry it for anybody
             looking at the page and this carries it for anybody reading the
             row. It sits on the sub line rather than in the Event column,
             where a sentence in a 130px cell painted straight over the
             money beside it. */}
          <span className="btbl__sub">
            {movement.note ?? 'No note'} · Not a bet, so it is in no betting figure
          </span>
        </span>
      </td>
      <td className="btbl__c btbl__c--stake" />
      <td className="btbl__c btbl__c--price" />
      <td className="btbl__c btbl__c--when">
        <span className="btbl__book">{movement.bookmakerId ? bookmakerName(movement.bookmakerId) : 'Balance'}</span>
        <span className="btbl__date tnum">{shortDate(movement.occurredAt, new Date(), tz)}</span>
      </td>
      <td className="btbl__c btbl__c--money">
        <span className="fig fig--s tnum">
          {inward ? '+' : '−'}{money(movement.amountMinor, currency)}
        </span>
        <span className="btbl__note tnum">
          {balanceAfter === null ? 'Balance moved' : `${money(balanceAfter, currency)} balance`}
        </span>
      </td>
      <td className="btbl__c btbl__c--go" />
    </tr>
  );
}
