import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { getViewer } from '@/lib/data/session';
import { has } from '@/lib/server/env';
import { PlanPicker } from '@/components/auth/PlanPicker';
import { money } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Plan and billing',
  description: 'What you are on, what it costs, and what happens if a payment fails.',
};

export default async function Plan() {
  const { trial } = await getViewer();
  const stripeReady = has('STRIPE_SECRET_KEY') && has('STRIPE_PRICE_MONTHLY') && has('STRIPE_PRICE_YEARLY');

  return (
    <>
      <div className="row" style={{ marginBottom: 'var(--gap-block)' }}>
        <Link href="/app/settings" className="btn btn--quiet btn--sm">
          <Icon name="chevronLeft" size={16} /> Settings
        </Link>
      </div>
      <h1>Plan and billing</h1>

      <div className="grid" style={{ marginTop: 'var(--s5)' }}>
        <section className="card col-6">
          <h2 className="card__title">Where you are</h2>
          <p className="fig fig--m" style={{ marginTop: 'var(--s3)' }}>
            {trial.active ? 'Free trial' : 'Trial over'}
          </p>
          <p className="small muted" style={{ marginTop: 'var(--s2)' }}>{trial.message}</p>
          <ul style={{ marginTop: 'var(--s4)' }}>
            <li className="brow"><span className="brow__title">Days left</span><span className="fig fig--s tnum">{trial.daysLeft}</span></li>
            <li className="brow"><span className="brow__title">Slips left</span><span className="fig fig--s tnum">{trial.slipsLeft}</span></li>
            <li className="brow"><span className="brow__title">Then</span><span className="fig fig--s tnum">{money(2999)} a year</span></li>
          </ul>
          <p className="small dim card__foot">
            The yearly plan starts when the trial ends. Cancelling is one tap and takes effect
            immediately.
          </p>
        </section>

        <section className="card col-6">
          <h2 className="card__title">If a payment fails</h2>
          <ul style={{ marginTop: 'var(--s3)' }}>
            {[
              ['Attempt one fails', 'Retried in three days. Nothing changes in the meantime.'],
              ['Attempt two fails', 'Read only. New slips, imports and the bot pause.'],
              ['Your ledger', 'Fully live, in read only and after cancelling.'],
              ['Your export', 'Fully live, always. A record belongs to whoever kept it.'],
              ['Your history', 'Never deleted for non payment, for any reason.'],
            ].map(([t, s]) => (
              <li key={t} className="brow" style={{ gridTemplateColumns: '1fr' }}>
                <span className="brow__title">{t}</span>
                <span className="brow__sub">{s}</span>
              </li>
            ))}
          </ul>
          <div className="card__foot row row--wrap" style={{ gap: 'var(--s2)' }}>
            <Link href="/app/billing/trial" className="btn btn--quiet btn--sm">Trial</Link>
            <Link href="/app/billing/declined" className="btn btn--quiet btn--sm">Declined</Link>
            <Link href="/app/billing/read-only" className="btn btn--quiet btn--sm">Read only</Link>
          </div>
        </section>

        <section className="card col-12">
          <h2 className="card__title">Change plan</h2>
          <div style={{ marginTop: 'var(--s4)', maxWidth: '560px' }}>
            <PlanPicker stripeReady={stripeReady} />
          </div>
        </section>
      </div>
    </>
  );
}
