'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';

/** The on-demand settle, which had no caller anywhere in the codebase.
 *
 *  POST /api/settle sweeps this account's open bets whose events finished
 *  more than ninety minutes ago, grades each through lib/settlement/engine.ts
 *  and appends the result plus any commission it triggers. It existed, it was
 *  correct, and no button in the product had ever called it: a Hobby account
 *  allows one cron run a day, so without this the earliest anything settled
 *  by itself was the next morning.
 *
 *  IT NEVER GUESSES. The route settles what the grader is certain of and
 *  leaves the rest, and the sentence it sends back says how many of each,
 *  which is why the answer is printed here verbatim rather than summarised
 *  into "done". */
export function CheckResults() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');

  async function run() {
    setBusy(true);
    setSaid('');
    try {
      const res = await fetch('/api/settle', { method: 'POST' });
      const b = await res.json().catch(() => ({}));
      setSaid((b.message as string) || 'Nothing came back.');
      if (res.ok) router.refresh();
    } catch {
      setSaid('That did not reach the server, so nothing was settled.');
    }
    setBusy(false);
  }

  return (
    <div className="row row--wrap" style={{ gap: 'var(--s3)', marginTop: 'var(--s2)' }}>
      <button type="button" className="btn btn--quiet btn--sm" onClick={run} disabled={busy}>
        <Icon name="refresh" size={15} />
        {busy ? 'Checking' : 'Check for results now'}
      </button>
      {said ? <span className="small muted" role="status">{said}</span> : null}
    </div>
  );
}
