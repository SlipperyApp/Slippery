'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { isEmail } from '@/lib/server/codes';

/** Every input has a label and an autocomplete value, the form submits on
 *  Enter, and every button that is not the submit is type="button". */
export function WaitingListForm() {
  const [email, setEmail] = useState('');
  const [platform, setPlatform] = useState<'ios' | 'android' | 'both'>('both');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEmail(email)) {
      setError('That address does not look right. Check it and try again.');
      return;
    }
    setError('');
    setState('sending');
    try {
      const res = await fetch('/api/waiting-list', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, platform }),
      });
      setState(res.ok ? 'done' : 'error');
      if (!res.ok) setError('That did not save. Nothing was sent and nothing was stored.');
    } catch {
      setState('error');
      setError('That did not save. Nothing was sent and nothing was stored.');
    }
  }

  if (state === 'done') {
    return (
      <div className="row" style={{ alignItems: 'flex-start' }}>
        {/*  readmark, not the profit colour: this tick means an address was
             saved, and the two result colours mean money. */}
        <Icon name="check" size={20} className="readmark readmark--ok" style={{ flex: 'none', marginTop: 2 }} />
        <div>
          <p className="card__title">On the list</p>
          <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
            One email, once, when the listing is live. Nothing else, and no marketing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="field">
        <label className="field__label" htmlFor="wl-email">Email address</label>
        <input
          id="wl-email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          className="input"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-describedby={error ? 'wl-err' : 'wl-hint'}
          aria-invalid={error ? true : undefined}
          required
        />
        {error ? <span className="field__err" id="wl-err" role="alert">{error}</span> : (
          <span className="field__hint" id="wl-hint">Used once, for this. Never for marketing.</span>
        )}
      </div>

      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field__label">Which one</legend>
        <div className="seg" role="group" aria-label="Platform">
          {([['ios', 'iOS'], ['android', 'Android'], ['both', 'Either']] as const).map(([v, l]) => (
            <button key={v} type="button" className="seg__btn" aria-pressed={platform === v} onClick={() => setPlatform(v)}>
              {l}
            </button>
          ))}
        </div>
      </fieldset>

      <button type="submit" className="btn btn--primary btn--wide" style={{ marginTop: 'var(--s5)' }} disabled={state === 'sending'}>
        {state === 'sending' ? 'Saving' : 'Tell me when it is live'}
      </button>
    </form>
  );
}
