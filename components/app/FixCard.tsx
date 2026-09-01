'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { money } from '@/lib/format';

/** One control, and it either opens the payment page or says plainly why it
 *  cannot. This screen previously carried a button that did nothing. */
export function FixCard({ stripeReady, amountPence }: { stripeReady: boolean; amountPence: number }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  async function go() {
    setBusy(true); setNote('');
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const b = await res.json().catch(() => ({}));
      if (res.ok && b.url) { window.location.href = b.url as string; return; }
      setNote((b.message as string) || 'Payments are not set up on this deployment, so nothing was charged.');
    } catch {
      setNote('That did not reach the payment provider. Nothing was charged.');
    }
    setBusy(false);
  }

  return (
    <>
      <button type="button" className="btn btn--primary btn--wide" style={{ marginTop: 'var(--s4)' }} onClick={go} disabled={busy}>
        <Icon name="card" size={16} />
        {busy ? 'Opening Stripe' : `Update the card and pay ${money(amountPence)}`}
      </button>
      {!stripeReady ? (
        <p className="small dim" style={{ marginTop: 'var(--s3)' }}>
          Payments are not configured on this deployment, so this button says so rather than spinning.
        </p>
      ) : null}
      {note ? <p className="small muted" role="status" style={{ marginTop: 'var(--s3)' }}>{note}</p> : null}
    </>
  );
}
