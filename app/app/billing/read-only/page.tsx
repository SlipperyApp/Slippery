import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { getViewer } from '@/lib/data/session';
import { select, summarise, DEFAULT_SCOPE } from '@/lib/data/analytics';
import { READ_ONLY_ALLOWS, READ_ONLY_PAUSES } from '@/lib/domain/trial';
import { money, plural } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Read only',
  description: 'What is paused, what is not, and the one thing that undoes it.',
};

export default async function ReadOnly() {
  const { data, now } = await getViewer();
  const all = summarise(select(data.bets, { ...DEFAULT_SCOPE, period: 'all' }, now));

  return (
    <>
      <div className="row" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/app/settings/plan" className="btn btn--quiet btn--sm">
          <Icon name="chevronLeft" size={16} /> Plan and billing
        </Link>
      </div>

      <span className="pill pill--neg">Read only</span>
      <h1 style={{ marginTop: 'var(--s4)' }}>Two payments failed, so new slips are paused</h1>
      <p className="lead" style={{ marginTop: 'var(--s3)', maxWidth: '62ch' }}>
        Nothing has been deleted and nothing will be. Your {plural(all.count, 'bet')}, worth{' '}
        {money(all.netPence, data.account.currency, { sign: true })} net, are where you left them,
        and your export works right now.
      </p>

      <div className="grid" style={{ marginTop: 'var(--s6)' }}>
        <section className="card col-6">
          <h2 className="card__title">Paused</h2>
          <ul style={{ marginTop: 'var(--s3)' }}>
            {READ_ONLY_PAUSES.map((t) => (
              <li key={t} className="checkitem" style={{ padding: 'var(--s2) 0' }}>
                <Icon name="pause" size={15} style={{ color: 'var(--neg)' }} />
                <span style={{ textTransform: 'capitalize' }}>{t}</span>
              </li>
            ))}
          </ul>
          <p className="small dim card__foot">
            A slip forwarded to the bot while paused is not read and not lost: the bot says the
            account is paused and points at billing.
          </p>
        </section>

        <section className="card col-6">
          <h2 className="card__title">Still fully live</h2>
          <ul style={{ marginTop: 'var(--s3)' }}>
            {READ_ONLY_ALLOWS.map((t) => (
              <li key={t} className="checkitem" style={{ padding: 'var(--s2) 0' }}>
                <Icon name="check" size={15} />
                <span style={{ textTransform: 'capitalize' }}>{t}</span>
              </li>
            ))}
          </ul>
          <div className="row row--wrap card__foot" style={{ gap: 'var(--s2)' }}>
            <a className="btn btn--ghost btn--sm" href="/api/export?format=csv">
              <Icon name="download" size={15} /> Export CSV
            </a>
            <Link href="/app/ledger" className="btn btn--quiet btn--sm">Open the ledger</Link>
          </div>
        </section>

        <section className="card col-12">
          <h2 className="card__title">The one thing that undoes it</h2>
          <p className="small muted" style={{ marginTop: 'var(--s2)', maxWidth: '58ch' }}>
            A working card, and everything above turns back on immediately. There is no penalty, no
            reactivation fee, and no gap in your record where the pause was.
          </p>
          <div className="row row--wrap card__foot" style={{ gap: 'var(--s3)' }}>
            <Link href="/app/billing/declined" className="btn btn--primary">
              <Icon name="card" size={16} /> Update the card
            </Link>
            <Link href="/app/settings/plan" className="btn btn--link">Cancel instead</Link>
          </div>
        </section>
      </div>
    </>
  );
}
