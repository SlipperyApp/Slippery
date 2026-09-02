'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Icon } from '@/components/Icon';
import { isEmail } from '@/lib/server/codes';

export function LoginForm({
  startWithReset = false, canEmail = true,
}: {
  startWithReset?: boolean;
  /*  Whether this deployment can actually send. The reset screen used to say
      a link was on its way on a deployment that has no transport, which is
      the one thing this product does not do anywhere else. */
  canEmail?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'sign-in' | 'reset'>(startWithReset ? 'reset' : 'sign-in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEmail(email)) { setError('That address does not look right.'); return; }
    setError(''); setBusy(true);

    const endpoint = mode === 'reset' ? '/api/auth/reset' : '/api/auth/login';
    try {
      const res = await fetch(endpoint, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(mode === 'reset' ? { email } : { email, password }),
      });
      if (res.status === 429) {
        const b = await res.json().catch(() => ({}));
        router.push(`/signup/rate-limited?wait=${Number(b.retryAfterSeconds) || 60}&from=login`);
        return;
      }
      const b = await res.json().catch(() => ({}));
      if (mode === 'reset') {
        // Never reveals whether an address exists.
        setSent(true); setBusy(false); return;
      }
      if (!res.ok) {
        setError(b.message || 'That email and password do not match an account.');
        setBusy(false); return;
      }
      router.push('/app');
    } catch {
      setError('That did not reach us. Try again in a moment.');
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="card">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          {/*  readmark, not the profit colour. Green here meant "that address
               looks like an email", and this is the second screen anybody
               sees: the first place they learn what #86EFAC means should be
               a figure with money in it. */}
          <Icon
            name={canEmail ? 'check' : 'alert'}
            size={20}
            className={canEmail ? 'readmark readmark--ok' : 'readmark readmark--ask'}
            style={{ flex: 'none', marginTop: 2 }}
          />
          <div>
            <p className="card__title">
              {canEmail
                ? 'If that address has an account, a reset link is on its way'
                : 'Email is not configured on this deployment, so nothing was sent'}
            </p>
            <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
              {canEmail
                ? 'Worded that way on purpose: saying whether an address exists would say it to anybody. The link lasts an hour.'
                : 'Your account and your ledger are untouched. Nothing was charged.'}
            </p>
            <button type="button" className="btn btn--link" style={{ marginTop: 'var(--s3)' }}
              onClick={() => { setSent(false); setMode('sign-in'); }}>
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="field">
        <label className="field__label" htmlFor="li-email">Email address</label>
        <input id="li-email" name="email" type="email" inputMode="email" autoComplete="email"
          className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>

      {mode === 'sign-in' ? (
        <div className="field">
          <label className="field__label" htmlFor="li-pass">Password</label>
          <div style={{ position: 'relative' }}>
            <input id="li-pass" name="password" type={show ? 'text' : 'password'}
              autoComplete="current-password" className="input" value={password}
              onChange={(e) => setPassword(e.target.value)} required style={{ paddingRight: 'var(--s9)' }} />
            <button type="button" className="iconbtn" onClick={() => setShow(!show)} aria-pressed={show}
              aria-label={show ? 'Hide the password' : 'Show the password'}
              style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}>
              <Icon name="eye" size={18} />
            </button>
          </div>
        </div>
      ) : (
        <p className="small muted">
          A link to set a new password. This does not go through the attempt limit.
        </p>
      )}

      {error ? <p className="field__err" role="alert" style={{ marginTop: 'var(--s3)' }}>{error}</p> : null}

      <button type="submit" className="btn btn--primary btn--wide" style={{ marginTop: 'var(--s5)' }} disabled={busy}>
        {busy ? 'Checking' : mode === 'reset' ? 'Send a reset link' : 'Sign in'}
      </button>

      <button type="button" className="btn btn--link btn--wide" style={{ marginTop: 'var(--s2)' }}
        onClick={() => { setMode(mode === 'reset' ? 'sign-in' : 'reset'); setError(''); }}>
        {mode === 'reset' ? 'Back to signing in' : 'Forgotten your password?'}
      </button>

      <div className="row" style={{ margin: 'var(--s5) 0', gap: 'var(--s3)' }}>
        <span className="hr" style={{ flex: 1, margin: 0 }} />
        <span className="label">or</span>
        <span className="hr" style={{ flex: 1, margin: 0 }} />
      </div>

      <a href="/api/auth/google" className="btn btn--ghost btn--wide">
        <Icon name="google" size={18} /> Continue with Google
      </a>
    </form>
  );
}
