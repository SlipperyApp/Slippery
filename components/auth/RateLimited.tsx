'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icon';

/** A real 429 branch with a real countdown.
 *
 *  The previous build put the raw rate limit string into a toast with no
 *  number in it, so nobody could tell whether to wait ten seconds or an hour. */
export function RateLimited({ seconds, from }: { seconds: number; from: string }) {
  const [left, setLeft] = useState(seconds);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  const mm = Math.floor(left / 60);
  const ss = left % 60;
  const back = from === 'login' ? '/login' : from === 'verify' ? '/signup/verify' : '/signup';
  const backLabel = from === 'login' ? 'Back to sign in' : from === 'verify' ? 'Back to the code' : 'Back to sign up';

  return (
    <>
      <span className="pill pill--neg">429</span>
      <h1 style={{ marginTop: 'var(--s4)' }}>Too many attempts from here</h1>
      <p className="muted" style={{ marginTop: 'var(--s2)' }}>
        This is a limit on attempts, not on you. Nothing was created and nothing was locked.
      </p>

      <div className="card" style={{ marginTop: 'var(--s6)', alignItems: 'center', textAlign: 'center' }}>
        <p className="label">Try again in</p>
        <p className="fig tnum" aria-live="polite">
          {left > 0 ? `${mm}:${String(ss).padStart(2, '0')}` : 'now'}
        </p>
        <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
          {left > 0
            ? 'The counter is real. Refreshing does not shorten it and does not lengthen it.'
            : 'The wait is over. Go straight back.'}
        </p>
      </div>

      <Link
        href={back}
        className={`btn btn--wide ${left > 0 ? 'btn--ghost' : 'btn--primary'}`}
        style={{ marginTop: 'var(--s5)' }}
        aria-disabled={left > 0 ? true : undefined}
      >
        {backLabel} <Icon name="arrowRight" size={16} />
      </Link>

      <div className="banner" style={{ marginTop: 'var(--s5)' }}>
        <Icon name="info" size={18} className="banner__icon" />
        <span>
          If you were signing in and cannot remember the password, the reset link does not go
          through this limit. <Link href="/login?reset=1">Send a reset link</Link>.
        </span>
      </div>
    </>
  );
}
