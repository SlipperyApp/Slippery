'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { thinReturn } from '@/lib/data/social';
import { useWide } from './wide';
import {
  ago, initials, pct, plural, position as fmtPosition, units as fmtUnits,
} from '@/lib/format';
import type { LeagueRow } from '@/lib/data/social';

/*  The width at which a Slipper can be read beside the board rather than by
    leaving it. Shared with the balance sheet and the gallery through .dsplit
    in components.css. */
const SPLIT_AT = 1500;

/** The league as a table, and one Slipper beside it.
 *
 *  WHAT WAS WRONG. A group's board is the screen somebody sees the first time
 *  a friend sends them an invite, and at 1920 it was a name against the left
 *  edge of a card and a units figure against the right with nine hundred
 *  pixels of nothing between them. Every fact that decides whether a position
 *  is worth anything -- how many bets it is over, how many were won, what
 *  share came off a captured slip -- was in a grey run-on line under the
 *  name, so comparing two Slippers meant reading two sentences rather than
 *  two columns.
 *
 *  THE COLUMNS ARE THE ONES A POSITION IS MADE OF, in the order they are
 *  asked about: how many bets, how they went, what that came to in units,
 *  and what it was as a return. The two optional columns are the group's own
 *  settings: a slip backed group has nothing to say about slip backing,
 *  because inside it the figure is a hundred per cent by definition.
 *
 *  RANKED IN UNITS, NEVER IN POUNDS, and there is no money column here at
 *  all. Nobody's stake is visible in a group or out of one. */
export function LeagueBoard({
  rows, you, period, showEdits = false, showSlipBacked = true, now,
  /** What the pane shows before anything is pressed. On a group page that is
   *  where the viewer sits; on the whole leaderboard it is the rest state. */
  rest,
  /*  THE PODIUM IS PART OF THE BOARD, not a card above it. Rendered here it
      shares the left column with the table, so the pane beside them starts
      at the top of the block rather than beside the table alone with the
      three plinths stretched across the whole card above it. */
  podium,
}: {
  rows: LeagueRow[];
  you: string;
  /** "this month", "all time". Printed in the pane so a figure is never
   *  shown without the window it was folded over. */
  period: string;
  showEdits?: boolean;
  showSlipBacked?: boolean;
  now: string;
  rest?: React.ReactNode;
  podium?: React.ReactNode;
}) {
  const wide = useWide(SPLIT_AT);
  const [picked, setPicked] = useState<string | null>(null);
  const row = picked ? rows.find((r) => r.handle === picked) ?? null : null;

  return (
    <div className="dsplit dsplit--lgt">
      <div>
        {podium ? <div style={{ marginBottom: 'var(--s5)' }}>{podium}</div> : null}
        <LeagueTable
          rows={rows}
          you={you}
          showEdits={showEdits}
          showSlipBacked={showSlipBacked}
          pickedHandle={wide ? picked : null}
          onPick={wide ? setPicked : undefined}
        />
      </div>

      <aside className="dsplit__side" aria-label="The Slipper you have open">
        {row && wide ? (
          <SlipperPane
            key={row.handle}
            row={row}
            mine={row.handle === you}
            field={rows.length}
            period={period}
            showEdits={showEdits}
            showSlipBacked={showSlipBacked}
            now={now}
            onClose={() => setPicked(null)}
          />
        ) : (
          rest ?? (
            <div className="dpane dpane--rest">
              <Icon name="social" size={22} className="dpane__mark" />
              <p className="card__title">Press a Slipper</p>
              <p className="small dim">
                What a position is made of opens here beside the table: the bets it is over, how
                they went, and how much of it came off a slip rather than a keyboard.
              </p>
            </div>
          )
        )}
      </aside>
    </div>
  );
}

/** The table on its own, for the boards that have no room for a pane. */
export function LeagueTable({
  rows, you, showEdits = false, showSlipBacked = true, pickedHandle = null, onPick,
}: {
  rows: LeagueRow[];
  you: string;
  showEdits?: boolean;
  showSlipBacked?: boolean;
  pickedHandle?: string | null;
  onPick?: (handle: string) => void;
}) {
  const anyThin = rows.some((r) => thinReturn(r.record));
  /*  Scaled to the largest absolute figure in the table, so a losing row and
      a winning one of the same size draw the same length in opposite
      directions. Scaling to the largest win instead makes every losing row a
      stub, which is the shape most of these charts have and the reason they
      are useless. */
  const peak = Math.max(1, ...rows.map((r) => Math.abs(r.record.units)));
  return (
    /*  THE CONTAINER THE TABLE MEASURES ITSELF AGAINST. Every rule that turns
        the stacked row into a table keys off this box rather than off the
        window, so the same component can be the whole content column on the
        leaderboard and half a card on the Social hub and be right in both.
        See .lgtwrap in components.css. */
    <div className="lgtwrap">
      <table className="lgt">
        <caption className="sr-only">
          Ranked in units. {onPick ? 'Press a row to read one Slipper beside the table.' : ''}
        </caption>
        <thead className="lgt__head">
          <tr>
            <th scope="col" className="lgt__h2 lgt__h2--pos"><span className="sr-only">Position</span>#</th>
            <th scope="col" className="lgt__h2 lgt__h2--who">Slipper</th>
            <th scope="col" className="lgt__h2 lgt__h2--at">Handle</th>
            <th scope="col" className="lgt__h2 lgt__h2--num lgt__h2--won">Won</th>
            <th scope="col" className="lgt__h2 lgt__h2--num lgt__h2--lost">Lost</th>
            <th scope="col" className="lgt__h2 lgt__h2--num lgt__h2--bets">Bets</th>
            {showSlipBacked ? (
              <th scope="col" className="lgt__h2 lgt__h2--num lgt__h2--slip">Slip backed</th>
            ) : null}
            {showEdits ? (
              <th scope="col" className="lgt__h2 lgt__h2--num lgt__h2--edits">Late edits</th>
            ) : null}
            <th scope="col" className="lgt__h2 lgt__h2--bar">
              <span className="sr-only">Units, drawn against the rest of the table</span>
            </th>
            <th scope="col" className="lgt__h2 lgt__h2--num lgt__h2--units">Units</th>
            <th scope="col" className="lgt__h2 lgt__h2--num lgt__h2--roi">Return</th>
          </tr>
        </thead>
        <tbody className="lgt__body">
          {rows.map((r) => (
            <LeagueTr
              key={r.handle}
              row={r}
              mine={r.handle === you}
              showEdits={showEdits}
              showSlipBacked={showSlipBacked}
              on={pickedHandle === r.handle}
              onPick={onPick}
              peak={peak}
            />
          ))}
        </tbody>
      </table>
      {anyThin ? (
        <p className="small dim lb__note">
          A row marked down the left has fewer than five settled bets in this table, and its
          return is left out rather than worked out over one of them.
        </p>
      ) : null}
    </div>
  );
}

function LeagueTr({
  row, mine, showEdits, showSlipBacked, on, onPick, peak,
}: {
  row: LeagueRow;
  mine: boolean;
  showEdits: boolean;
  showSlipBacked: boolean;
  on: boolean;
  onPick?: (handle: string) => void;
  peak: number;
}) {
  const r = row.record;
  /*  Under five settled bets the row is marked rather than the return being
      printed over one of them. thinReturn() decides, for every surface. */
  const thin = thinReturn(r);
  const none = r.bets === 0;
  return (
    <tr
      className={`lgt__r${onPick ? ' lgt__r--live' : ''}${thin ? ' lgt__r--thin' : ''}${mine ? ' lgt__r--you' : ''}${on ? ' lgt__r--on' : ''}`}
      onClick={onPick ? () => onPick(row.handle) : undefined}
      /*  "false" on the rows that are not open rather than no attribute at
           all: see the note on the gallery tile. One attribute that appears
           and disappears leaves the page's observable state identical
           whichever row is open. */
      aria-current={onPick ? (on ? 'true' : 'false') : undefined}
    >
      <td className={`lgt__c lgt__c--pos medal medal--${row.position <= 3 ? row.position : 'none'}`}>
        {row.position}
      </td>
      <td className="lgt__c lgt__c--who">
        <span className="lgt__whoin">
          <span className="avatar" aria-hidden="true">{initials(row.name)}</span>
          <span className="lgt__nm">
            {/*  ONE ACTION PER ROW, and which one depends on whether there is
                 a pane. Where there is, the name opens it and the profile is
                 a link inside it; where there is not, the name is the link to
                 the profile it has always been. Two controls in one cell
                 meant a click on a name that both navigated away and opened a
                 panel behind it, and a second tab stop on every row. */}
            {onPick ? (
              <button
                type="button"
                className="brow__title lgt__open"
                onClick={(e) => { e.stopPropagation(); onPick(row.handle); }}
              >
                {row.name}{mine ? <span className="dim league__you">(you)</span> : null}
              </button>
            ) : (
              <Link
                href={`/app/social/person?handle=${row.handle}`}
                className="brow__title"
                style={{ textDecoration: 'none' }}
              >
                {row.name}{mine ? <span className="dim league__you">(you)</span> : null}
              </Link>
            )}
          </span>
        </span>
      </td>
      {/*  THE HANDLE IS A COLUMN, and on a phone it is the first thing on the
           facts line under the name. It is one cell either way: the alternative
           is printing it twice and hiding one, which is how a row ends up
           reading the same thing to a screen reader in both layouts. */}
      <td className="lgt__c lgt__c--at mono">@{row.handle}</td>
      <td className="lgt__c lgt__c--num lgt__c--won">
        {none ? '' : <>{r.wins}<span className="lgt__u"> W</span></>}
      </td>
      <td className="lgt__c lgt__c--num lgt__c--lost">
        {none ? '' : <>{r.losses}<span className="lgt__u"> L</span></>}
      </td>
      {/*  A Slipper with nothing in this window keeps the sentence the row
           has always printed on a phone, and the table's own cells stay
           empty rather than drawing a column of zeroes that look like a
           record. The unit words are the phone's, and the table drops
           them. */}
      <td className="lgt__c lgt__c--num lgt__c--bets">
        {none
          ? <span className="lgt__u">no bets in this table yet</span>
          : <>{r.bets}<span className="lgt__u"> {r.bets === 1 ? 'bet' : 'bets'}</span></>}
      </td>
      {showSlipBacked ? (
        <td className="lgt__c lgt__c--num lgt__c--slip">
          {row.slipBackedPct}%<span className="lgt__u"> slip backed</span>
        </td>
      ) : null}
      {showEdits ? (
        <td className="lgt__c lgt__c--num lgt__c--edits">
          {row.lateEdits === 0
            ? ''
            : <>{row.lateEdits}<span className="lgt__u"> late edit{row.lateEdits === 1 ? '' : 's'}</span></>}
        </td>
      ) : null}
      <td className="lgt__c lgt__c--bar" aria-hidden="true">
        <span className="lgt__bar">
          <span
            className={`lgt__barfill lgt__barfill--${r.units >= 0 ? 'pos' : 'neg'}`}
            style={{ width: `${Math.min(100, (Math.abs(r.units) / peak) * 100).toFixed(1)}%` }}
          />
        </span>
      </td>
      <td className="lgt__c lgt__c--units">
        <span className={`fig fig--s tnum ${r.units > 0 ? 'pos' : r.units < 0 ? 'neg' : ''}`}>
          {fmtUnits(r.units, { league: true, sign: true })}
        </span>
      </td>
      {/*  A RETURN OVER FOUR BETS IS NOT A RETURN, it is the price of one of
           them, so it is a dash and the bet count beside it says why. The
           units still show, because units are what the table is ranked on
           and that is a fact whatever the volume. */}
      <td className="lgt__c lgt__c--roi tnum">
        {thin ? '–' : pct(r.roi, { sign: true })}
      </td>
    </tr>
  );
}

/** One Slipper, beside the board. Everything on it is about this person and
 *  none of it is money: a group shows units and a slip backed share, and a
 *  stake is never visible in a group or out of one. */
export function SlipperPane({
  row, mine, field, period, showEdits, showSlipBacked, now, onClose,
}: {
  row: LeagueRow;
  mine: boolean;
  field: number;
  period: string;
  showEdits: boolean;
  showSlipBacked: boolean;
  now: string;
  onClose: () => void;
}) {
  const r = row.record;
  const thin = thinReturn(r);
  return (
    <div className="dpane">
      <div className="dpane__head">
        <div style={{ minWidth: 0 }}>
          <h3 className="card__title">{row.name}{mine ? <span className="dim league__you">(you)</span> : null}</h3>
          <p className="small dim mono">@{row.handle}</p>
        </div>
        <button type="button" className="icobtn" onClick={onClose} aria-label="Close this Slipper">
          <Icon name="close" size={18} />
        </button>
      </div>

      <p className="label">Units, {period}</p>
      <p className={`fig tnum ${r.units > 0 ? 'pos' : r.units < 0 ? 'neg' : ''}`}>
        {fmtUnits(r.units, { league: true, sign: true })}
      </p>
      <p className="small dim" style={{ marginTop: 4 }}>
        <span className={`medal medal--${row.position <= 3 ? row.position : 'none'}`} style={{ fontWeight: 600 }}>
          {fmtPosition(row.position, field)}
        </span>{' '}
        of {plural(field, 'Slipper')}.
      </p>

      <ul className="dpane__rows">
        <li className="brow">
          <span style={{ minWidth: 0 }}>
            <span className="brow__title">Bets</span>
            <span className="brow__sub">{r.wins} won, {r.losses} lost</span>
          </span>
          <span className="fig fig--s tnum">{r.bets}</span>
        </li>
        <li className="brow">
          <span style={{ minWidth: 0 }}>
            <span className="brow__title">Return</span>
            <span className="brow__sub">
              {thin ? 'Fewer than five settled, so it is left out' : `Over ${plural(r.wins + r.losses, 'settled bet')}`}
            </span>
          </span>
          <span className={`fig fig--s tnum ${!thin && r.roi > 0 ? 'pos' : !thin && r.roi < 0 ? 'neg' : ''}`}>
            {thin ? '–' : pct(r.roi, { sign: true })}
          </span>
        </li>
        <li className="brow">
          <span style={{ minWidth: 0 }}>
            <span className="brow__title">Staked</span>
            <span className="brow__sub">In units. No stake is ever visible.</span>
          </span>
          <span className="fig fig--s tnum">{fmtUnits(r.stakedUnits)}</span>
        </li>
        {showSlipBacked ? (
          <li className="brow">
            <span style={{ minWidth: 0 }}>
              <span className="brow__title">Slip backed</span>
              {/*  IT SAID "Captured from a slip before the off", AND THAT IS
                   NOT WHAT THIS FIGURE COUNTS. slipBacked is set by where a
                   bet came from: read off a slip image, or typed in, or
                   brought in from a file. It says nothing about when, and
                   Slippery takes a bet at any time. The old wording read as a
                   deadline, so a group requiring slip backed bets looked like
                   a group refusing anything sent after a kick off, which it
                   has never been. */}
              <span className="brow__sub">Read off a slip rather than typed in</span>
            </span>
            <span className="fig fig--s tnum">{row.slipBackedPct}%</span>
          </li>
        ) : null}
        {showEdits ? (
          <li className="brow">
            <span style={{ minWidth: 0 }}>
              <span className="brow__title">Late edits</span>
              <span className="brow__sub">Settled after the result was known</span>
            </span>
            <span className="fig fig--s tnum">{row.lateEdits}</span>
          </li>
        ) : null}
        <li className="brow">
          <span className="brow__title">On Slippery</span>
          <span className="small dim">since {ago(row.joined, new Date(now))}</span>
        </li>
      </ul>

      <div className="card__foot">
        <p className="small dim">
          {row.following
            ? 'You follow this Slipper.'
            : row.followsYou ? 'This Slipper follows you.' : 'You do not follow this Slipper.'}
          {' '}Counted across every balance they keep: a league ranks a person rather than a pot.
        </p>
        <div style={{ marginTop: 'var(--s4)' }}>
          <Link href={`/app/social/person?handle=${row.handle}`} className="btn btn--ghost btn--sm">
            Their profile <Icon name="arrowRight" size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
