import type { Metadata } from 'next';
import Link from 'next/link';
import { getViewer } from '@/lib/data/session';
import { Icon } from '@/components/Icon';
import { bookmakerName } from '@/lib/data/reference';
import { dateTime, money, shortDate } from '@/lib/format';

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

  return (
    <>
      <div className="spread" style={{ marginBottom: 'var(--s4)', flexWrap: 'wrap' }}>
        <h1>Change history</h1>
        <Link href="/app/ledger" className="btn btn--quiet btn--sm">
          <Icon name="chevronLeft" size={16} /> Back to the ledger
        </Link>
      </div>

      <div className="card" style={{ marginBottom: 'var(--s4)' }}>
        <p className="small muted">
          <code>settlement_events</code> is append only. A correction is a new event rather than an
          edit, so nothing here can be quietly rewritten. Events entered <strong>after a result was
          known</strong> are flagged, and that flag is what a group&rsquo;s late-edit column reads.
        </p>
        <div className="row row--wrap" style={{ gap: 'var(--s6)', marginTop: 'var(--s4)' }}>
          <div><p className="label">Events shown</p><p className="fig fig--s tnum">{rows.length}</p></div>
          <div><p className="label">Entered by hand</p><p className="fig fig--s tnum">{byHand}</p></div>
          <div><p className="label">After a result was known</p><p className="fig fig--s tnum">{late}</p></div>
        </div>
      </div>

      <div className="card">
        <div className="scroller" tabIndex={0} role="region" aria-label="Settlement events, scrollable">
          <table className="tbl">
            <caption className="sr-only">Settlement events, newest first</caption>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Bet</th>
                <th scope="col">Event</th>
                <th scope="col">By</th>
                <th scope="col" className="num">Returned</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ bet, event }) => (
                <tr key={event.id}>
                  <td className="nowrap dim">{shortDate(event.occurredAt)}</td>
                  <td>
                    <span style={{ fontWeight: 600 }}>
                      {bet.legs.length > 1 ? `${bet.legs.length} fold` : bet.selection}
                    </span>
                    <br />
                    <span className="dim">{bookmakerName(bet.bookmakerId)}</span>
                  </td>
                  <td>
                    {LABEL[event.type] ?? event.type}
                    {event.fractionEighths ? <span className="dim"> · {event.fractionEighths}/8 of what remained</span> : null}
                    {event.deductionPence ? <span className="dim"> · {event.deductionPence}p in the pound</span> : null}
                    {event.afterResultKnown ? (
                      <>
                        {' '}
                        <span className="pill pill--neg">Late</span>
                      </>
                    ) : null}
                  </td>
                  <td className="dim nowrap">{event.enteredBy}</td>
                  <td className="num tnum">
                    {event.returnedPence == null ? '—' : money(event.returnedPence, account.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small dim card__foot">
          Showing the most recent {rows.length}. Every one carries the time it happened in UK time:
          the newest is {rows.length ? dateTime(rows[0].event.occurredAt) : 'not yet recorded'}.
        </p>
      </div>
    </>
  );
}
