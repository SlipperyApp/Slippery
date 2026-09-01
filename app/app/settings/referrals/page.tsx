import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { getViewer } from '@/lib/data/session';
import { CopyCode } from '@/components/app/CopyCode';
import { TRIAL_DAYS, TRIAL_SLIPS } from '@/lib/domain/trial';

export const metadata: Metadata = {
  title: 'Referrals',
  description: 'A code that gives somebody else a longer trial. You get nothing for it, deliberately.',
};

export default async function Referrals() {
  const { data } = await getViewer();
  return (
    <>
      <div className="row" style={{ marginBottom: 'var(--gap-block)' }}>
        <Link href="/app/settings" className="btn btn--quiet btn--sm">
          <Icon name="chevronLeft" size={16} /> Settings
        </Link>
      </div>
      <div className="column column--wide" style={{ marginInline: 0 }}>
        <h1>Referrals</h1>
        <p className="muted" style={{ marginTop: 'var(--s2)' }}>
          Your code gives the person who uses it a longer trial. You get nothing for it, on purpose.
        </p>

        <div className="card" style={{ marginTop: 'var(--s5)' }}>
          <p className="label">Your code</p>
          <CopyCode code={data.account.linkCode.replace('SLIP-', 'REF-')} />
          <p className="small muted card__foot">
            They get {TRIAL_DAYS + 7} days or {TRIAL_SLIPS + 15} slips instead of the usual{' '}
            {TRIAL_DAYS} or {TRIAL_SLIPS}. You both start following each other, which you can undo.
          </p>
        </div>

        <div className="card" style={{ marginTop: 'var(--s4)' }}>
          <p className="card__title">Who has used it</p>
          <p className="small dim" style={{ marginTop: 'var(--s3)' }}>
            Nobody yet. When somebody does, they appear here by handle and nothing else: not what
            they bet, not what they staked, not how they are doing.
          </p>
        </div>
      </div>
    </>
  );
}
