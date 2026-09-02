import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { getViewer } from '@/lib/data/session';
import { has } from '@/lib/server/env';
import { FixCard } from '@/components/app/FixCard';
import { select, summarise, DEFAULT_SCOPE } from '@/lib/data/analytics';
import { money, longDate, plural } from '@/lib/format';

export const metadata: Metadata = {
  title: 'A payment did not go through',
  description: 'What failed, what happens next, what has not changed, and one control that fixes it.',
};

/** A failed payment is the most valuable moment you get with a paying
 *  Slipper. It was previously a narrow column with a dead button in it. */
export default async function Declined() {
  const { data, now } = await getViewer();
  const all = summarise(select(data.bets, { ...DEFAULT_SCOPE, period: 'all' }, now));
  const stripeReady = has('STRIPE_SECRET_KEY');
  const retryAt = new Date(now.getTime() + 3 * 86400000);

  return (
    <>
      <div className="row" style={{ marginBottom: 'var(--gap-block)' }}>
        <Link href="/app/settings/plan" className="btn btn--quiet btn--sm">
          <Icon name="chevronLeft" size={16} /> Plan and billing
        </Link>
      </div>

      <span className="pill pill--neg">Attempt 1 of 2</span>
      <h1 style={{ marginTop: 'var(--s4)' }}>Your card was declined</h1>
      <p className="lead" style={{ marginTop: 'var(--s3)' }}>
        Your bank refused the payment. Usually an expiry date, a spending limit, or a bank blocking something it has not seen before. None of it is about your account here.
      </p>

      <div className="grid" style={{ marginTop: 'var(--s6)' }}>
        <section className="card col-8">
          <h2 className="card__title">Nothing has changed yet</h2>
          <ul style={{ marginTop: 'var(--s3)' }}>
            {[
              ['Your ledger', `All ${plural(all.count, 'bet')}, exactly where they were.`, 'check'],
              ['Slip reading', 'Still running. Forward a slip as normal.', 'check'],
              ['The bot', 'Still linked and still reading.', 'check'],
              ['Your export', 'Working, and it will keep working whatever happens next.', 'check'],
            ].map(([t, s, i]) => (
              <li key={t} className="brow" style={{ gridTemplateColumns: '20px minmax(0,1fr)', gap: 'var(--s3)' }}>
                <Icon name={i as 'check'} size={16} className="readmark readmark--ok" />
                <span>
                  <span className="brow__title">{t}</span>
                  <span className="brow__sub">{s}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="hr" />
          <h2 className="card__title">What happens next</h2>
          <ol style={{ marginTop: 'var(--s3)' }}>
            <li className="brow" style={{ gridTemplateColumns: '24px 1fr' }}>
              <span className="mono small dim">1</span>
              <span>
                <span className="brow__title">
                  We try again on {longDate(retryAt.toISOString())}
                </span>
                <span className="brow__sub">Three days from now. You do not have to do anything for that to happen.</span>
              </span>
            </li>
            <li className="brow" style={{ gridTemplateColumns: '24px 1fr' }}>
              <span className="mono small dim">2</span>
              <span>
                <span className="brow__title">If that fails too, the account goes read only</span>
                <span className="brow__sub">
                  New slips, imports and the bot pause. Your ledger and your export stay fully live,
                  and nothing is deleted. Ever, for any reason.
                </span>
              </span>
            </li>
            <li className="brow" style={{ gridTemplateColumns: '24px 1fr' }}>
              <span className="mono small dim">3</span>
              <span>
                <span className="brow__title">A working card undoes all of it immediately</span>
                <span className="brow__sub">There is no penalty, no reactivation fee and no gap in your record.</span>
              </span>
            </li>
          </ol>
        </section>

        <div className="col-4" style={{ display: 'grid', gap: 'var(--s4)', alignContent: 'start' }}>
          <section className="card">
            <h2 className="card__title">Fix it now</h2>
            <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
              Card details go straight to Stripe. Slippery never sees or stores a card number.
            </p>
            <FixCard stripeReady={stripeReady} amountPence={2999} />
          </section>

          <section className="card">
            <h2 className="card__title">Or stop paying</h2>
            <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
              Cancelling keeps your ledger, your history and your export.
            </p>
            <div className="row row--wrap card__foot" style={{ gap: 'var(--s2)' }}>
              <a className="btn btn--ghost btn--sm" href="/api/export?format=csv">
                <Icon name="download" size={15} /> Export first
              </a>
              <Link href="/app/settings/plan" className="btn btn--quiet btn--sm">Cancel the plan</Link>
            </div>
          </section>

          <section className="card">
            <h2 className="card__title">What it costs</h2>
            <p className="fig fig--m tnum" style={{ marginTop: 'var(--s3)' }}>{money(2999)}</p>
            <p className="small dim">a year, which is {money(250)} a month in effect</p>
          </section>
        </div>
      </div>
    </>
  );
}
