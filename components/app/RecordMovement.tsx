'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { ALL_BOOKMAKERS } from '@/lib/data/reference';
import { MOVEMENT_KINDS, type MovementKind } from '@/lib/domain/movements';

/** Recording money in or money out.
 *
 *  A DISCLOSURE, NOT A FORM SITTING OPEN. This is the least used control on
 *  the ledger, a few times a month against a page somebody opens every day,
 *  and an always-open form would put four fields above the rows they came to
 *  read.
 *
 *  The amount box has no minus in it and refuses one, because the direction
 *  is the segmented control. A minus typed into a deposit is a question about
 *  what somebody meant, and the ledger does not guess at money. */
export function RecordMovement() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<MovementKind>('deposit');
  const [amount, setAmount] = useState('');
  const [bookmaker, setBookmaker] = useState('');
  const [note, setNote] = useState('');
  const [said, setSaid] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaid('');
    const res = await fetch('/api/movements', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind, amount, bookmaker, note }),
    }).catch(() => null);
    setSaving(false);
    if (!res) {
      setSaid('That did not reach the server. Nothing was written and what you typed is still here.');
      return;
    }
    const body = await res.json().catch(() => ({ message: '' }));
    /*  The route's own sentence, not one made up here. It is the route that
        knows whether there was a database, a session or an amount it could
        read, and two descriptions of one failure is how somebody gets sent
        back to fix the wrong thing. */
    setSaid(res.ok
      ? `${kind === 'deposit' ? 'Deposit' : 'Withdrawal'} recorded. It moves your balance and no other figure.`
      : String(body.message ?? 'Nothing was written.'));
    if (res.ok) { setAmount(''); setNote(''); }
  }

  if (!open) {
    return (
      <button type="button" className="btn btn--quiet btn--sm" onClick={() => setOpen(true)}>
        <Icon name="bank" size={16} /> Record a deposit or withdrawal
      </button>
    );
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 'var(--s3)' }}>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field__label">This is a</legend>
        <div className="seg" role="group" aria-label="Deposit or withdrawal">
          {MOVEMENT_KINDS.map((k) => (
            <button
              key={k.id} type="button" className="seg__btn" aria-pressed={kind === k.id}
              onClick={() => setKind(k.id)}
            >
              {k.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="field">
        <label className="field__label" htmlFor="mv-amount">Amount</label>
        <input
          id="mv-amount" className="input input--money" inputMode="decimal" autoComplete="off"
          value={amount} onChange={(e) => setAmount(e.target.value)}
          placeholder="200.00"
        />
        <span className="field__hint">
          No minus sign. Which way the money went is the choice above.
        </span>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="mv-book">Bookmaker, if it was one</label>
        <select id="mv-book" className="select" value={bookmaker} onChange={(e) => setBookmaker(e.target.value)}>
          <option value="">Not attributed</option>
          {ALL_BOOKMAKERS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="mv-note">Note</label>
        <input
          id="mv-note" className="input" autoComplete="off" value={note}
          onChange={(e) => setNote(e.target.value)} placeholder="Monthly top up"
        />
      </div>

      <div className="row row--wrap" style={{ gap: 'var(--s2)' }}>
        <button type="submit" className="btn btn--primary btn--sm" disabled={saving || !amount.trim()}>
          {saving ? 'Recording' : 'Record it'}
        </button>
        <button type="button" className="btn btn--quiet btn--sm" onClick={() => { setOpen(false); setSaid(''); }}>
          Cancel
        </button>
      </div>
      {said ? <p className="small muted" role="status" style={{ marginTop: 'var(--s2)' }}>{said}</p> : null}
    </form>
  );
}
