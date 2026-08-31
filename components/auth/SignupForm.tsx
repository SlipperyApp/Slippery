'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { isEmail, PASSWORD_RULES, passwordOk } from '@/lib/server/codes';

/** Step one. Email, password with live rule ticks, 18+ and terms, and Google
 *  BELOW the divider.
 *
 *  Every input has a label and an autocomplete value, the form has an
 *  onSubmit so Enter submits, and every button that is not the submit is
 *  type="button", because HTML defaults button to submit and doing one
 *  without the other turns every icon button into a submit. */
export function SignupForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [age, setAge] = useState(false);
  const [terms, setTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const emailOk = isEmail(email);
  const pwOk = passwordOk(password);
  const ready = emailOk && pwOk && age && terms;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) {
      setError(!emailOk ? 'That address does not look right.'
        : !pwOk ? 'The password does not meet all three rules yet.'
          : 'Both boxes need ticking before an account can be made.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, ageConfirmed: age, termsAccepted: terms }),
      });
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        const secs = Number(body.retryAfterSeconds) || 60;
        router.push(`/signup/rate-limited?wait=${secs}&from=signup`);
        return;
      }
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.message || 'That did not go through. Nothing was created.');
        setBusy(false);
        return;
      }
      router.push(`/signup/verify?email=${encodeURIComponent(email)}`);
    } catch {
      setError('That did not go through. Nothing was created.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="field">
        <label className="field__label" htmlFor="su-email">Email address</label>
        <input
          id="su-email" name="email" type="email" inputMode="email" autoComplete="email"
          className="input" value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com" required
          aria-invalid={email.length > 3 && !emailOk ? true : undefined}
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="su-pass">Password</label>
        <div style={{ position: 'relative' }}>
          <input
            id="su-pass" name="password" type={show ? 'text' : 'password'}
            autoComplete="new-password" className="input" value={password}
            onChange={(e) => setPassword(e.target.value)} required
            style={{ paddingRight: '52px' }}
            aria-describedby="su-rules"
          />
          <button
            type="button"
            className="iconbtn"
            onClick={() => setShow(!show)}
            aria-pressed={show}
            aria-label={show ? 'Hide the password' : 'Show the password'}
            style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
          >
            <Icon name="eye" size={18} />
          </button>
        </div>
        <ul id="su-rules" style={{ marginTop: 'var(--s3)', display: 'grid', gap: 4 }}>
          {PASSWORD_RULES.map((r) => {
            const ok = r.test(password);
            return (
              <li key={r.id} className="small" style={{ display: 'flex', gap: 8, alignItems: 'center', color: ok ? 'var(--pos)' : 'var(--ink-3)' }}>
                <Icon name={ok ? 'check' : 'minus'} size={14} strokeWidth={2.2} />
                <span>{r.label}</span>
                <span className="sr-only">{ok ? 'met' : 'not yet met'}</span>
              </li>
            );
          })}
        </ul>
      </div>

      <label className="check">
        <input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} name="age" />
        <span className="small">I am 18 or over. This is stored with the date and time I confirmed it.</span>
      </label>
      <label className="check">
        <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} name="terms" />
        <span className="small">
          I accept the <Link href="/terms">Terms</Link> and the <Link href="/privacy">Privacy policy</Link>.
        </span>
      </label>

      {error ? <p className="field__err" role="alert" style={{ marginTop: 'var(--s3)' }}>{error}</p> : null}

      <button type="submit" className="btn btn--primary btn--wide" style={{ marginTop: 'var(--s5)' }} disabled={busy}>
        {busy ? 'Creating' : 'Create account'}
      </button>

      <div className="row" style={{ margin: 'var(--s5) 0', gap: 'var(--s3)' }}>
        <span className="hr" style={{ flex: 1, margin: 0 }} />
        <span className="label">or</span>
        <span className="hr" style={{ flex: 1, margin: 0 }} />
      </div>

      <a href="/api/auth/google" className="btn btn--ghost btn--wide">
        <Icon name="google" size={18} /> Continue with Google
      </a>
      <p className="small dim" style={{ marginTop: 'var(--s3)' }}>
        Google still asks you to confirm you are 18 or over before an account is created.
      </p>
    </form>
  );
}
