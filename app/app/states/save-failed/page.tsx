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
        A cash out cannot return more than the bet could ever have returned, so rather than store
        a figure that would corrupt your return, nothing was written.
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
            <li key={String(t)} className="brow brow--field">
              <Icon name={ok ? 'check' : 'close'} size={16} className={`readmark readmark--${ok ? 'ok' : 'gap'}`} />
              <span className="brow__title">{t}</span>
              <span className="fig fig--s tnum">{v}</span>
            </li>
          ))}
        </ul>
        <p className="small muted card__foot">
          {money(9900)} is {money(6150)} more than the bet could return at 3.00 on{' '}
          {money(1250)}. If the bookmaker really did pay that, correct the price.
        </p>
      </div>

      <div className="card" style={{ marginTop: 'var(--s4)' }}>
        <p className="card__title">What is in your ledger right now</p>
        <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
          Exactly what was there before you pressed the button. Nothing half-written is left behind.
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
