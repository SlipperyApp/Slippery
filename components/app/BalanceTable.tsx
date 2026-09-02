'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { OpenBalance } from './OpenBalance';
import { ShareBalance } from './ShareBalance';
import { useSideways, useWide } from './wide';
import { money, pct, units as fmtUnits, type Currency } from '@/lib/format';
import type { BalanceLine, CurrencyTotal } from '@/lib/data/balance-sheet';

/*  The width at which a balance can be read beside the sheet rather than
    under it. Shared with the gallery and the group table through .dsplit in
    components.css, where the number is written down once more. */
const SPLIT_AT = 1280;

/** The balance sheet, and one balance beside it.
 *
 *  WHAT WAS WRONG. This screen is the one that proves an account keeps more
 *  than one set of books, and at 1920 it was a table across the top and then
 *  a column of prose and share controls down the left with thirteen hundred
 *  pixels of nothing beside them: every balance's public link, its sentence
 *  about what the link gives away and its off switch, stacked under each
 *  other in a page-wide card. Three balances made three of those, so the
 *  page was 1750px tall to say seven figures about each of three things.
 *
 *  The sheet is the table, the row press opens the balance, and everything
 *  that is about ONE balance -- what it started with, what has gone in and
 *  out, and who can see it -- moved into the pane beside it. Under 1280 the
 *  pane is not drawn and the share controls are a list under the table, the
 *  way they always were. Nothing is rendered twice: the pane and the list
 *  are the two sides of one condition, because two live copies of the same
 *  control disagree about their own state the moment somebody presses one. */
export function BalanceTable({
  groups, openId, sharePaths, many,
}: {
  groups: { total: CurrencyTotal; word: string; names: string; lines: BalanceLine[] }[];
  /** The balance every other screen is currently showing. */
  openId: string;
  /** The public path for each shared balance, by balance id. Absent means
   *  the link is off. */
  sharePaths: Record<string, string | null>;
  many: boolean;
}) {
  const wide = useWide(SPLIT_AT);
  /*  Nothing is picked on a first paint. The pane says what pressing a row
      does instead of guessing which balance somebody wants, and the row for
      the balance that is open is already marked in the sheet. */
  const [picked, setPicked] = useState<string | null>(null);
  const all = groups.flatMap((g) => g.lines);
  const line = picked ? all.find((l) => l.balance.id === picked) ?? null : null;

  return (
    <div className="dsplit">
      <div>
        {groups.map((g) => (
          <Sheet
            key={g.total.currency}
            group={g}
            openId={openId}
            pickedId={picked}
            onPick={setPicked}
          />
        ))}

        {/*  The share controls, where they were, on the widths that have no
             room for a pane. */}
        {!wide ? (
          <div className="sharelist">
            {all.map((l) => (
              <ShareBalance
                key={l.balance.id}
                balanceId={l.balance.id}
                name={l.balance.name}
                path={sharePaths[l.balance.id] ?? null}
              />
            ))}
          </div>
        ) : null}

        {many ? (
          <p className="small dim" style={{ marginTop: 'var(--gap-block)' }}>
            There is no figure on this page that adds pounds to euro. One would need an exchange
            rate, the rate would be the one on the day you looked, and the number it produced
            would change overnight without a single bet being placed.
          </p>
        ) : null}
      </div>

      <aside className="dsplit__side" aria-label="The balance you have open">
        {line && wide ? (
          <BalancePane
            key={line.balance.id}
            line={line}
            isOpen={line.balance.id === openId}
            path={sharePaths[line.balance.id] ?? null}
            onClose={() => setPicked(null)}
          />
        ) : (
          <div className="dpane dpane--rest">
            <Icon name="bank" size={22} className="dpane__mark" />
            <p className="card__title">Press a balance</p>
            <p className="small dim">
              What it started with, what has gone in and out of it, and who can see it, open here
              beside the sheet rather than stacked under it.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}

function Sheet({
  group, openId, pickedId, onPick,
}: {
  group: { total: CurrencyTotal; word: string; names: string; lines: BalanceLine[] };
  openId: string;
  pickedId: string | null;
  onPick: (id: string) => void;
}) {
  const { total, word, names, lines } = group;
  const scroll = useSideways<HTMLDivElement>([lines.length]);

  return (
    <section
      className="card"
      style={{ marginBottom: 'var(--gap-block)' }}
      aria-labelledby={`bs-${total.currency}`}
    >
      <header className="card__head">
        <h2 className="card__title" id={`bs-${total.currency}`}>In {word}</h2>
        <p className="card__note">{names}</p>
      </header>

      <div
        ref={scroll.ref}
        className={`scroller${scroll.right ? ' scroller--r' : ''}`}
        tabIndex={0}
        role="region"
        aria-label={`Balances in ${word}, scrollable`}
      >
        <table className={`tbl bsheet${scroll.over ? ' bsheet--stuck' : ''}`}>
          <caption className="sr-only">
            Every balance kept in {word}, with a total for the currency. No figure here is a
            total across currencies. Press a row to open the balance beside the sheet.
          </caption>
          <thead>
            <tr>
              {/*  NET AND RETURN COME FIRST, before the count and the
                   turnover they are made of. The table scrolls on a phone,
                   and in column order Bets, Turnover, Net the two figures
                   somebody opened this page to compare were the two off the
                   right hand edge. */}
              <th scope="col" className="bsheet__name">Balance</th>
              <th scope="col" className="num">Net</th>
              <th scope="col" className="num">Return</th>
              <th scope="col" className="num">Bets</th>
              <th scope="col" className="num">Turnover</th>
              <th scope="col" className="num">Units</th>
              <th scope="col" className="num">In there</th>
              <th scope="col"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr
                key={l.balance.id}
                className={`bsheet__r${l.balance.id === openId ? ' bsheet__here' : ''}${l.balance.id === pickedId ? ' bsheet__r--on' : ''}`}
                onClick={() => onPick(l.balance.id)}
                aria-current={l.balance.id === pickedId ? 'true' : 'false'}
              >
                <th scope="row" className="bsheet__name">
                  {/*  A mouse presses anywhere on the row; a keyboard
                       presses the button in the first cell, which carries
                       the same handler and the same accessible name. The
                       ledger's table does it the same way. */}
                  <button
                    type="button"
                    className="bsheet__open"
                    onClick={(e) => { e.stopPropagation(); onPick(l.balance.id); }}
                  >
                    <span className="bsheet__nm">
                      {l.balance.name}
                      {l.balance.id === openId ? <span className="pill">Open</span> : null}
                    </span>
                    <span className="small dim bsheet__sub">
                      {money(l.balance.startMinor, l.currency)} to start
                      {l.depositedMinor > 0 ? `, ${money(l.depositedMinor, l.currency)} paid in` : ''}
                      {l.withdrawnMinor > 0 ? `, ${money(l.withdrawnMinor, l.currency)} taken out` : ''}
                    </span>
                  </button>
                </th>
                <td className={`num tnum ${l.netMinor > 0 ? 'pos' : l.netMinor < 0 ? 'neg' : ''}`}>
                  {money(l.netMinor, l.currency, { sign: true })}
                </td>
                <td className={`num tnum ${l.roi > 0 ? 'pos' : l.roi < 0 ? 'neg' : ''}`}>
                  {pct(l.roi, { sign: true })}
                </td>
                <td className="num tnum">{l.bets}</td>
                <td className="num tnum">{money(l.turnoverMinor, l.currency)}</td>
                <td className="num tnum">{fmtUnits(l.units, { sign: true })}</td>
                <td className="num tnum">{money(l.balanceMinor, l.currency)}</td>
                <td className="num bsheet__go">
                  <Icon name="chevronRight" size={16} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="bsheet__name">
                <span className="bsheet__nm">All {word}</span>
                <span className="small dim bsheet__sub">{names}</span>
              </th>
              <td className={`num tnum ${total.netMinor > 0 ? 'pos' : total.netMinor < 0 ? 'neg' : ''}`}>
                {money(total.netMinor, total.currency, { sign: true })}
              </td>
              <td className={`num tnum ${total.roi > 0 ? 'pos' : total.roi < 0 ? 'neg' : ''}`}>
                {pct(total.roi, { sign: true })}
              </td>
              <td className="num tnum">{total.bets}</td>
              <td className="num tnum">{money(total.turnoverMinor, total.currency)}</td>
              <td className="num tnum">{fmtUnits(total.units, { sign: true })}</td>
              <td className="num tnum">{money(total.balanceMinor, total.currency)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/*  THE AVERAGING SENTENCE IS ABOUT MORE THAN ONE ROW, and it was
           printed under a currency with one balance in it, where there is
           nothing to average and no returns above the line to weight. It
           draws when there are two. */}
      <p className="small dim" style={{ marginTop: 'var(--s3)' }}>
        The return on this line is {money(total.netMinor, total.currency, { sign: true })} over{' '}
        {money(total.turnoverMinor, total.currency)} of turnover
        {lines.length > 1
          ? ', not an average of the returns above it: averaging them would weight a balance with four bets in it the same as one with four hundred.'
          : `, over the ${lines.length === 1 ? 'one balance' : 'balances'} kept in it.`}
        {scroll.over ? ' The table scrolls sideways, and the name column stays put while it does.' : ''}
      </p>
    </section>
  );
}

/** One balance, beside the sheet. Everything on it is about this balance
 *  alone, which is why it could never sit in the table: a public link and
 *  the sentence explaining what it gives away are not a column. */
function BalancePane({
  line, isOpen, path, onClose,
}: {
  line: BalanceLine;
  isOpen: boolean;
  path: string | null;
  onClose: () => void;
}) {
  const b = line.balance;
  const c: Currency = line.currency;
  return (
    <div className="dpane">
      <div className="dpane__head">
        <div style={{ minWidth: 0 }}>
          <h3 className="card__title">{b.name}</h3>
          <p className="small dim">
            {isOpen ? 'The balance every other screen is showing' : 'Not the balance you have open'}
          </p>
        </div>
        <button type="button" className="icobtn" onClick={onClose} aria-label="Close this balance">
          <Icon name="close" size={18} />
        </button>
      </div>

      <p className="label">In there</p>
      <p className="fig tnum">{money(line.balanceMinor, c)}</p>
      <p className="small dim" style={{ marginTop: 4 }}>
        {money(line.ownInMinor, c)} of your own money and{' '}
        {money(line.netMinor, c, { sign: true })} of profit and loss.
      </p>

      <ul className="dpane__rows">
        <li className="brow">
          <span className="brow__title">Net</span>
          <span className={`fig fig--s tnum ${line.netMinor > 0 ? 'pos' : line.netMinor < 0 ? 'neg' : ''}`}>
            {money(line.netMinor, c, { sign: true })}
          </span>
        </li>
        <li className="brow">
          <span className="brow__title">Return</span>
          <span className={`fig fig--s tnum ${line.roi > 0 ? 'pos' : line.roi < 0 ? 'neg' : ''}`}>
            {pct(line.roi, { sign: true })}
          </span>
        </li>
        <li className="brow">
          <span style={{ minWidth: 0 }}>
            <span className="brow__title">Bets</span>
            <span className="brow__sub">{line.settled} settled, {line.open} still open</span>
          </span>
          <span className="fig fig--s tnum">{line.bets}</span>
        </li>
        <li className="brow">
          <span className="brow__title">Turnover</span>
          <span className="fig fig--s tnum">{money(line.turnoverMinor, c)}</span>
        </li>
        <li className="brow">
          <span style={{ minWidth: 0 }}>
            <span className="brow__title">Units</span>
            <span className="brow__sub">{money(b.unitMinor, c)} a unit</span>
          </span>
          <span className={`fig fig--s tnum ${line.units > 0 ? 'pos' : line.units < 0 ? 'neg' : ''}`}>
            {fmtUnits(line.units, { sign: true })}
          </span>
        </li>
        <li className="brow">
          <span style={{ minWidth: 0 }}>
            <span className="brow__title">Started with</span>
            <span className="brow__sub">
              {line.depositedMinor > 0 ? `${money(line.depositedMinor, c)} paid in since` : 'Nothing paid in since'}
              {line.withdrawnMinor > 0 ? `, ${money(line.withdrawnMinor, c)} taken out` : ''}
            </span>
          </span>
          <span className="fig fig--s tnum">{money(b.startMinor, c)}</span>
        </li>
      </ul>

      <div className="card__foot">
        <ShareBalance balanceId={b.id} name={b.name} path={path} />
        {!isOpen ? (
          <div style={{ marginTop: 'var(--s4)' }}>
            <OpenBalance id={b.id} name={b.name} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
