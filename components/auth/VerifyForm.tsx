'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { stepHref } from '@/lib/signup-draft';
import { useDraft } from '@/components/auth/useDraft';

const LEN = 6;

export function VerifyForm() {
  const router = useRouter();
  const draft = useDraft();
  const email = draft.email;
  const [digits, setDigits] = useState<string[]>(Array(LEN).fill(''));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [sentAgain, setSentAgain] = useState(false);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const code = digits.join('');

  function setAt(i: number, v: string) {
    const clean = v.replace(/\D/g, '');
    if (!clean && v !== '') return;
    const next = [...digits];
    if (clean.length > 1) {
      // A pasted code fills the row from wherever it landed.
      for (let k = 0; k < clean.length && i + k < LEN; k++) next[i + k] = clean[k];
      setDigits(next);
      refs.current[Math.min(LEN - 1, i + clean.length)]?.focus();
      return;
    }
    next[i] = clean;
    setDigits(next);
    if (clean && i < LEN - 1) refs.current[i + 1]?.focus();
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    if (e.key === 'ArrowRight' && i < LEN - 1) refs.current[i + 1]?.focus();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== LEN) { setError('Six digits, and there are ' + code.length + ' so far.'); return; }
    setError(''); setBusy(true);
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      if (res.status === 429) {
        const b = await res.json().catch(() => ({}));
        router.push(stepHref('/signup/rate-limited', draft, { wait: String(Number(b.retryAfterSeconds) || 60), from: 'verify' }));
        return;
      }
      const b = await res.json().catch(() => ({}));
      if (!res.ok) { setError(b.message || 'That code did not match. Check it and try again.'); setBusy(false); return; }
      router.push(stepHref('/signup/name', draft));
    } catch {
      setError('That did not go through. The code is still valid.');
      setBusy(false);
    }
  }

  async function resend() {
    setSentAgain(false);
    const res = await fetch('/api/auth/resend', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (res.status === 429) {
      const b = await res.json().catch(() => ({}));
      setCooldown(Number(b.retryAfterSeconds) || 60);
      return;
    }
    setCooldown(30);
    setSentAgain(true);
  }

  return (
    <form onSubmit={submit} noValidate>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="field__label">Six digit code</legend>
        <div className="row" style={{ gap: 'var(--s2)' }}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { refs.current[i] = el; }}
              className="input mono"
              style={{ textAlign: 'center', padding: 'var(--s3) 0', fontSize: '20px', minWidth: 0 }}
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              maxLength={LEN}
              value={d}
              aria-label={`Digit ${i + 1} of ${LEN}`}
              onChange={(e) => setAt(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
            />
          ))}
        </div>
      </fieldset>

      {error ? <p className="field__err" role="alert" style={{ marginTop: 'var(--s3)' }}>{error}</p> : null}
      {sentAgain ? <p className="field__hint" role="status" style={{ marginTop: 'var(--s3)' }}>Sent again. Check the spam folder too.</p> : null}

      <button type="submit" className="btn btn--primary btn--wide" style={{ marginTop: 'var(--s5)' }} disabled={busy}>
        {busy ? 'Checking' : 'Confirm'}
      </button>

      <div className="row row--wrap" style={{ marginTop: 'var(--s4)', gap: 'var(--s4)' }}>
        <button type="button" className="btn btn--link" onClick={resend} disabled={cooldown > 0}>
          {cooldown > 0 ? `Send again in ${cooldown}s` : 'Send it again'}
        </button>
        <Link href={stepHref('/signup', draft)} className="btn btn--link">Change the address</Link>
      </div>
    </form>
  );
}
