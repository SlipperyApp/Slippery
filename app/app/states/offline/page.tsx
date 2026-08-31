import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { money, timeOfDay } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Offline',
  description: 'What happens to a slip captured with no signal: it queues, and it says so.',
};

export default function Offline() {
  const now = new Date();
  const queued = [
    { t: 'Arsenal to win', s: 'Arsenal v Brentford · Match result', stake: 2500, at: new Date(now.getTime() - 12 * 60000) },
    { t: '4 fold', s: 'Napoli / Inter / Celtic / Leeds', stake: 1000, at: new Date(now.getTime() - 41 * 60000) },
  ];

  return (
    <div className="column column--wide">
      <span className="pill pill--neg">
        <Icon name="offline" size={13} /> No connection
      </span>
      <h1 style={{ marginTop: 'var(--s4)' }}>Two slips are waiting, and nothing has been lost</h1>
      <p className="lead" style={{ marginTop: 'var(--s3)' }}>
        A bet captured with no signal is held on this device and sent the moment there is one. It
        keeps the time you captured it, not the time it eventually sent, because that is the
        moment the record is meant to be from.
      </p>

      <div className="card" style={{ marginTop: 'var(--s6)' }}>
        <div className="spread">
          <p className="card__title">Queued</p>
          <span className="pill">{queued.length}</span>
        </div>
        <ul style={{ marginTop: 'var(--s3)' }}>
          {queued.map((q) => (
            <li key={q.t} className="brow" style={{ gridTemplateColumns: '20px minmax(0,1fr) auto', gap: 'var(--s3)' }}>
              <Icon name="clock" size={16} className="dim" />
              <span style={{ minWidth: 0 }}>
                <span className="brow__title" style={{ display: 'block' }}>{q.t}</span>
                <span className="brow__sub">{q.s} · captured {timeOfDay(q.at)}</span>
              </span>
              <span className="fig fig--s tnum">{money(q.stake)}</span>
            </li>
          ))}
        </ul>
        <p className="small dim card__foot">
          Nothing is sent twice. Each queued slip carries an identifier, so a retry that arrives
          after the first one succeeded is dropped rather than written again.
        </p>
      </div>

      <div className="card" style={{ marginTop: 'var(--s4)' }}>
        <p className="card__title">What still works with no signal</p>
        <ul style={{ marginTop: 'var(--s3)' }}>
          {[
            'Capturing a slip, which is the one that matters',
            'Reading the ledger you already loaded',
            'Typing a bet in by hand',
          ].map((t) => (
            <li key={t} className="checkitem" style={{ padding: '6px 0' }}>
              <Icon name="check" size={15} />
              <span>{t}</span>
            </li>
          ))}
          {[
            'Reading a slip image, which happens on the server',
            'Settlement, which needs a results feed',
          ].map((t) => (
            <li key={t} className="checkitem" style={{ padding: '6px 0' }}>
              <Icon name="close" size={15} style={{ color: 'var(--neg)' }} />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="row" style={{ marginTop: 'var(--s5)', gap: 'var(--s3)' }}>
        <Link href="/app" className="btn btn--ghost">Back to the dashboard</Link>
      </div>
    </div>
  );
}
