import type { Metadata } from 'next';
import Link from 'next/link';
import { getViewer } from '@/lib/data/session';
import { Icon } from '@/components/Icon';
import { bookmakerName } from '@/lib/data/reference';
import { legLine } from '@/lib/domain/working';
import { count, dateTime, money, shortDate, timeOfDay } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Change history',
  description: 'Every settlement event in order, with the ones entered after a result was known flagged.',
};

const LABEL: Record<string, string> = {
  won: 'Won', lost: 'Lost', void: 'Void', placed: 'Placed', push: 'Push',
  half_won: 'Half won', half_lost: 'Half lost',
  cash_out_partial: 'Cashed out, part', cash_out_full: 'Cashed out, in full',
  rule4: 'Rule 4 deduction', commission: 'Commission',
  promo_refund: 'Promo refund', manual_correction: 'Correction',
};

export default async function History() {
  const { data } = await getViewer();
  const { account, bets } = data;

  const rows = bets
    .flatMap((b) => b.events.map((e) => ({ bet: b, event: e })))
    .sort((a, b) => new Date(b.event.occurredAt).getTime() - new Date(a.event.occurredAt).getTime())
    .slice(0, 120);

  const late = rows.filter((r) => r.event.afterResultKnown).length;
  const byHand = rows.filter((r) => r.event.enteredBy !== 'system').length;
  /*  A COLUMN WHERE EVERY ROW SAYS THE SAME THING IS NOT A COLUMN. On an
      account the bot has settled, By reads "system" a hundred and twenty
      times and Returned is a hundred and twenty dashes, which is 260 pixels
      of the table spent saying nothing twice. Each is drawn when it has
      something to tell apart, the way the league table draws its two
      optional columns, and the footer says in words what the By column would
      have said in a column of identical cells. */
  const anyByHand = byHand > 0;
  const anyReturn = rows.some((r) => r.event.returnedPence != null);

  return (
    <>
      <div className="spread" style={{ marginBottom: 'var(--gap-block)', flexWrap: 'wrap' }}>
        <h1>Change history</h1>
        <Link href="/app/ledger" className="btn btn--quiet btn--sm">
          <Icon name="chevronLeft" size={16} /> Back to the ledger
        </Link>
      </div>

      {/*  A CARD OF THREE FIGURES, TWO OF WHICH WERE ZERO. "Entered by hand
           0" and "After a result was known 0" are the two facts this page
           exists to establish, and a 34 pixel zero under a label is the
           weakest way to state either: it reads as a measurement that has
           not been taken. They are a sentence in the table's own footer now,
           where they are about the rows above them, and the card they were
           in has gone with its heading and its paragraph.

           The append only rule is the page's lead, because it is the reason
           the table has the shape it has. */}
      <p className="muted" style={{ marginTop: 'var(--s2)', marginBottom: 'var(--gap-block)' }}>
        Append only: a correction is a new event, never an edit. Anything entered{' '}
        <strong>after a result was known</strong> is flagged.
      </p>

      {/*  THE TABLE SCROLLS AND THE RULE ABOVE IT DOES NOT. Measured at
           1440 by 900 this page was 7,861 pixels against the 824 the window
           leaves, which is nine screens of a table whose heading, its count
           and the sentence saying corrections are appended rather than
           edited all scrolled away at the first flick. */}
      <div className="card fitcol fitcol--scroll">
        <div className="card__head">
          <h2 className="card__title">Every settlement event</h2>
          <p className="card__note">{count(rows.length)} shown, newest first</p>
        </div>
        <div className="scroller" tabIndex={0} role="region" aria-label="Settlement events, scrollable">
          <table className="tbl">
            <caption className="sr-only">Settlement events, newest first</caption>
            <thead>
              {/*  SIX COLUMNS, NOT FIVE, and the fixture is the new one.
                   At 1920 this table was five short columns spread across
                   1620 pixels with five hundred of them between "system" and
                   a dash, and it could not answer the question somebody comes
                   to a change history with, which is which bet a correction
                   belongs to. A selection and a bookmaker are not a bet; the
                   match and the time it happened are what identify one. */}
              <tr>
                <th scope="col">When</th>
                <th scope="col">Bet</th>
                <th scope="col">Fixture</th>
                <th scope="col">Bookmaker</th>
                <th scope="col">Event</th>
                {anyByHand ? <th scope="col">By</th> : null}
                {anyReturn ? <th scope="col" className="num">Returned</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ bet, event }) => (
                <tr key={event.id}>
                  <td className="nowrap dim">
                    {shortDate(event.occurredAt)}
                    <span className="hist__time tnum">{timeOfDay(event.occurredAt)}</span>
                  </td>
                  <td>
                    <span style={{ fontWeight: 600 }}>
                      {bet.legs.length > 1 ? `${bet.legs.length} fold` : bet.selection}
                    </span>
                  </td>
                  {/*  A multi's eventName is the fold's own label, so the
                       fixture column printed "3 fold" beside a bet column
                       already reading "3 fold". The legs carry the matches,
                       and lib/domain/working.ts owns the line so the ledger,
                       the export and this table print the same one. */}
                  <td className="dim hist__fix">
                    {bet.legs.length > 1 ? legLine(bet.legs) : bet.eventName}
                  </td>
                  <td className="dim nowrap">{bookmakerName(bet.bookmakerId)}</td>
                  <td>
                    {LABEL[event.type] ?? event.type}
                    {event.fractionEighths ? <span className="dim"> · {event.fractionEighths}/8 of what remained</span> : null}
                    {event.deductionPence ? <span className="dim"> · {event.deductionPence}p in the pound</span> : null}
                    {event.afterResultKnown ? (
                      <>
                        {' '}
                        <span className="pill pill--warn">Late</span>
                      </>
                    ) : null}
                  </td>
                  {anyByHand ? <td className="dim nowrap">{event.enteredBy}</td> : null}
                  {anyReturn ? (
                    <td className="num tnum">
                      {event.returnedPence == null ? '–' : money(event.returnedPence, account.currency)}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small dim card__foot">
          {/*  THE ZONE SENTENCE IS GONE. "Every one carries the time it
               happened in UK time" told the reader how the product stores a
               timestamp, which is the mechanics copy this branch removes from
               every app screen; the zone is named once, in Settings, beside
               the control that sets it. What is left is three counts. */}
          {byHand === 0 ? 'None of them was' : `${count(byHand)} of them were`} entered by hand and{' '}
          {late === 0 ? 'none' : count(late)} after a result was known. The newest is{' '}
          {rows.length ? dateTime(rows[0].event.occurredAt) : 'not yet recorded'}.
        </p>
      </div>
    </>
  );
}
