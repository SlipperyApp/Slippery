'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { money } from '@/lib/format';
import { TRIAL_DAYS, TRIAL_SLIPS } from '@/lib/domain/trial';

export function PlanPicker({ stripeReady }: { stripeReady: boolean }) {
  const [plan, setPlan] = useState<'yearly' | 'monthly'>('yearly');
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
            aria-pressed={plan === 'yearly'} onClick={() => setPlan('yearly')}
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
            aria-pressed={plan === 'monthly'} onClick={() => setPlan('monthly')}
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
          The plan starts automatically when the trial ends. There is deliberately no reminder
          email: a reminder would be a nudge, and you can cancel in one tap from Settings at any
          point before it starts.
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
