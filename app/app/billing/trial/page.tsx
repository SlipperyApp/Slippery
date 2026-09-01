import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { getViewer } from '@/lib/data/session';
import { money } from '@/lib/format';
import { TRIAL_DAYS, TRIAL_SLIPS } from '@/lib/domain/trial';

export const metadata: Metadata = {
  title: 'Your free trial',
  description: 'Both halves of the trial, which one is running out, and what happens when it does.',
};

export default async function TrialPage() {
  const { trial } = await getViewer();
  const daysPct = Math.round(((TRIAL_DAYS - trial.daysLeft) / TRIAL_DAYS) * 100);
  const slipsPct = Math.round((trial.slipsUsed / Math.max(1, trial.slipsAllowed)) * 100);
  const leading = daysPct >= slipsPct ? 'days' : 'slips';

  return (
    <>
      <div className="row" style={{ marginBottom: 'var(--s4)' }}>
        <Link href="/app/settings/plan" className="btn btn--quiet btn--sm">
          <Icon name="chevronLeft" size={16} /> Plan and billing
        </Link>
      </div>
      <div className="column column--wide" style={{ marginInline: 0 }}>
        <span className="pill pill--accent">Free trial</span>
        <h1 style={{ marginTop: 'var(--s4)' }}>{trial.message}</h1>
        <p className="muted" style={{ marginTop: 'var(--s3)', maxWidth: '58ch' }}>
          Two halves, and they run out differently. One function owns both numbers and tells the
          app which one is closer, so the counter here cannot disagree with what blocks an upload.
        </p>

        <div className="grid" style={{ marginTop: 'var(--s5)' }}>
          <section className="card col-6">
            <div className="spread">
              <p className="card__title">Days</p>
              {leading === 'days' ? <span className="pill pill--accent">Running out first</span> : null}
            </div>
            <p className="fig" style={{ marginTop: 'var(--s3)' }}>{trial.daysLeft}</p>
            <p className="small dim">of {TRIAL_DAYS} left</p>
            <div className="meter" style={{ marginTop: 'var(--s4)' }}>
              <span className="meter__fill" style={{ width: `${daysPct}%` }} />
            </div>
          </section>

          <section className="card col-6">
            <div className="spread">
              <p className="card__title">Slips</p>
              {leading === 'slips' ? <span className="pill pill--accent">Running out first</span> : null}
            </div>
            <p className="fig" style={{ marginTop: 'var(--s3)' }}>{trial.slipsLeft}</p>
            <p className="small dim">of {trial.slipsAllowed} left, {trial.slipsUsed} used</p>
            <div className="meter" style={{ marginTop: 'var(--s4)' }}>
              <span className="meter__fill" style={{ width: `${slipsPct}%` }} />
            </div>
          </section>

          <section className="card col-12">
            <p className="card__title">When it ends</p>
            <p className="small muted" style={{ marginTop: 'var(--s2)', maxWidth: '62ch' }}>
              The yearly plan starts automatically at {money(2999)}. No reminder email, deliberately. Cancel in one tap from Settings any time before it starts.
            </p>
            <div className="row row--wrap card__foot" style={{ gap: 'var(--s2)' }}>
              <Link href="/app/settings/plan" className="btn btn--primary btn--sm">See the plans</Link>
              <Link href="/app/import" className="btn btn--ghost btn--sm">Use a slip</Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
