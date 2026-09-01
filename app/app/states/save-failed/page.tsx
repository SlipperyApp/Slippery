import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { money } from '@/lib/format';

export const metadata: Metadata = {
  title: 'That did not save',
  description: 'The arithmetic that did not add up, shown rather than described, and nothing written.',
};

export default function SaveFailed() {
  return (
    <div className="column column--wide">
      <span className="pill pill--neg">Nothing was written</span>
      <h1 style={{ marginTop: 'var(--s4)' }}>The arithmetic did not add up, so nothing was saved</h1>
      <p className="lead" style={{ marginTop: 'var(--s3)' }}>
        A cash out cannot return more than the bet could ever have returned. Rather than store a
        figure that would quietly corrupt your ROI, the write was refused whole.
      </p>

      <div className="card" style={{ marginTop: 'var(--s6)' }}>
        <p className="card__title">What was checked</p>
        <ul style={{ marginTop: 'var(--s3)' }}>
          {[
            ['Stake still standing', money(1250), true],
            ['Price in force', '3.00', true],
            ['Most this could return', money(3750), true],
            ['What you entered', money(9900), false],
          ].map(([t, v, ok]) => (
            <li key={String(t)} className="brow" style={{ gridTemplateColumns: '20px minmax(0,1fr) auto', gap: 'var(--s3)' }}>
              <Icon name={ok ? 'check' : 'close'} size={16} className={`readmark readmark--${ok ? 'ok' : 'gap'}`} />
              <span className="brow__title">{t}</span>
              <span className="fig fig--s tnum">{v}</span>
            </li>
          ))}
        </ul>
        <p className="small muted card__foot">
          {money(9900)} is {money(6150)} more than the bet could return at 3.00 on{' '}
          {money(1250)}. If the bookmaker really did pay that, the price was not 3.00 and the price
          is the thing to correct.
        </p>
      </div>

      <div className="card" style={{ marginTop: 'var(--s4)' }}>
        <p className="card__title">What is in your ledger right now</p>
        <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
          Exactly what was there before you pressed the button. The event and the recompute of
          bet_state happen in one transaction, so a refused write leaves nothing half done.
        </p>
      </div>

      <div className="row row--wrap" style={{ marginTop: 'var(--s5)', gap: 'var(--s3)' }}>
        <Link href="/app/ledger" className="btn btn--primary">
          <Icon name="chevronLeft" size={16} /> Back to the bet
        </Link>
        <Link href="/app/history" className="btn btn--link">See the change history</Link>
      </div>
    </div>
  );
}
