'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { money } from '@/lib/format';
import { TRIAL_DAYS, TRIAL_SLIPS } from '@/lib/domain/trial';
import { keepAnswers } from '@/lib/signup-draft';
import { useDraft } from '@/components/auth/useDraft';

/*  Two callers: step six of signup, where a plan chosen and then stepped away
    from has to come back chosen, and the settings pane, which has no draft in
    its address at all and reads the default out of an empty one. */
export function PlanPicker({ stripeReady }: { stripeReady: boolean }) {
  const draft = useDraft();
  const [plan, setPlan] = useState<'yearly' | 'monthly'>(draft.plan);

  /*  The choice goes into the address as well as into state, by the same
      mechanism every other step uses to leave its answers in the history
      entry it is standing on. Without it, stepping back to the sports screen
      and forward again lost the plan, which is the one thing the back button
      was added to stop happening. */
  function choose(next: 'yearly' | 'monthly') {
    setPlan(next);
    keepAnswers('/signup/plan', { ...draft, plan: next });
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const b = await res.json().catch(() => ({}));
      if (res.ok && b.url) { window.location.href = b.url; return; }
      setError(b.message || 'Payments are not set up on this deployment, so nothing was charged and no plan was started.');
    } catch {
      setError('That did not reach the payment provider. Nothing was charged.');
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} noValidate>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="sr-only">Plan</legend>
        <div className="rows">
          <button
            type="button" className={`rowcard${plan === 'yearly' ? ' rowcard--on' : ''}`}
            aria-pressed={plan === 'yearly'} onClick={() => choose('yearly')}
            style={{ cursor: 'pointer', textAlign: 'left' }}
          >
            <Icon name={plan === 'yearly' ? 'check' : 'minus'} size={20} className="rowcard__i" />
            <span className="grow">
              <span className="rowcard__t">Yearly, {money(2999)}</span>
              <span className="rowcard__s">
                <span className="plan__was tnum" style={{ fontSize: 'inherit' }}>{money(3499)}</span>
                {' '}Save {money(1189)} a year.
              </span>
            </span>
            <span className="pill pill--accent">Recommended</span>
          </button>

          <button
            type="button" className={`rowcard${plan === 'monthly' ? ' rowcard--on' : ''}`}
            aria-pressed={plan === 'monthly'} onClick={() => choose('monthly')}
            style={{ cursor: 'pointer', textAlign: 'left' }}
          >
            <Icon name={plan === 'monthly' ? 'check' : 'minus'} size={20} className="rowcard__i" />
            <span className="grow">
              <span className="rowcard__t">Monthly, {money(349)}</span>
              <span className="rowcard__s">Same product. Cancel any month.</span>
            </span>
          </button>
        </div>
      </fieldset>

      <div className="card" style={{ marginTop: 'var(--s5)' }}>
        <div className="spread">
          <span className="card__title">Today</span>
          <span className="fig fig--m tnum">{money(0)}</span>
        </div>
        <ul style={{ marginTop: 'var(--s3)' }}>
          <li className="brow">
            <span className="brow__title">Free trial</span>
            <span className="small dim">{TRIAL_DAYS} days or {TRIAL_SLIPS} slips</span>
          </li>
          <li className="brow">
            <span className="brow__title">Then, {plan === 'yearly' ? 'yearly' : 'monthly'}</span>
            <span className="small dim tnum">{plan === 'yearly' ? money(2999) : money(349)}</span>
          </li>
        </ul>
        <p className="small muted card__foot">
          The plan starts automatically when the trial ends. No reminder email, deliberately: a reminder is a nudge. Cancel in one tap from Settings any time before it starts.
        </p>
      </div>

      {!stripeReady ? (
        <div className="banner" style={{ marginTop: 'var(--s4)' }}>
          <Icon name="info" size={18} className="banner__icon" />
          <span>
            Payments are not configured on this deployment, so this button will say so rather than
            pretending. <Link href="/api/sources">What this deployment has</Link>.
          </span>
        </div>
      ) : null}

      {error ? <p className="field__err" role="alert" style={{ marginTop: 'var(--s3)' }}>{error}</p> : null}

      <button type="submit" className="btn btn--primary btn--wide" style={{ marginTop: 'var(--s5)' }} disabled={busy}>
        {busy ? 'Opening the payment page' : 'Add a card and start'}
      </button>
      <p className="small dim center" style={{ marginTop: 'var(--s3)' }}>
        Card details go straight to Stripe. Slippery never sees or stores a card number.
      </p>
    </form>
  );
}
