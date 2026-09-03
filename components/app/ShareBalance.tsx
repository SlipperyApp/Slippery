'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@/components/Icon';

/** Turn one balance's public link on, and off again.
 *
 *  THE OFF SWITCH IS AS PROMINENT AS THE ON SWITCH. A share control where
 *  turning it on is a button and turning it off is three taps into a settings
 *  pane is a control that only goes one way, and this one gives a stranger a
 *  read of somebody's record. Both are the same button in the same place.
 *
 *  The link is shown in full rather than behind a Copy button alone, because
 *  somebody about to hand a stranger a URL is entitled to read it first.
 *  Copy is there because nobody should have to select twenty characters of
 *  token by hand. */
export function ShareBalance({
  balanceId, name, path, explain = true,
}: {
  balanceId: string;
  name: string;
  /** The public path when it is shared, or null when it is not. */
  path: string | null;
  /** Whether this control carries the paragraph about what a link gives
   *  away. It is true beside one balance and false in a list of them: the
   *  sentence is the same for every balance on the account, so three
   *  balances printed it three times, twice of them word for word identical
   *  under two buttons that said the same thing. The list says it once. */
  explain?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');
  const [copied, setCopied] = useState(false);

  /*  THE ORIGIN ARRIVES AFTER MOUNT, and it has to. Reading
      window.location on the first render makes the server print the path and
      the browser print the whole URL, which is a hydration mismatch: React
      threw #418 on this page and the text quietly stopped matching. The
      first render is the path on both sides and the origin is added once. */
  const [origin, setOrigin] = useState('');
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const url = path ? `${origin}${path}` : null;

  async function set(on: boolean) {
    setBusy(true);
    setSaid('');
    try {
      const res = await fetch('/api/balances/share', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ balanceId, on }),
      });
      const b = await res.json().catch(() => ({}));
      if (res.ok) {
        setSaid(on
          ? 'On. Anybody with the link can read this balance in units.'
          : 'Off. The link stopped working straight away.');
        router.refresh();
      } else {
        setSaid((b.message as string) || 'Nothing was written.');
      }
    } catch {
      setSaid('That did not reach the server, so nothing was written.');
    }
    setBusy(false);
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      /*  A browser that refuses the clipboard still shows the link, which is
          the thing that matters. */
      setCopied(false);
    }
  }

  return (
    <div className="shareb">
      {path ? (
        <>
          <p className="label">Public link for {name}</p>
          <div className="row row--wrap" style={{ gap: 'var(--s3)' }}>
            <a className="small mono shareb__url" href={path}>{url ?? path}</a>
            <button type="button" className="btn btn--ghost btn--sm" onClick={copy}>
              <Icon name={copied ? 'check' : 'clipboard'} size={15} /> {copied ? 'Copied' : 'Copy'}
            </button>
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => set(false)} disabled={busy}>
              <Icon name="lock" size={15} /> Turn the link off
            </button>
          </div>
          {explain ? (
            <p className="small dim" style={{ marginTop: 'var(--s2)' }}>
              It shows this balance in units: net, return, bet count, the calendar and the curve.
              No stakes, no money, no email and nothing about your other balances. Turning it off
              stops it immediately, and turning it on again issues a different link.
            </p>
          ) : null}
        </>
      ) : (
        <>
          <p className="label">Public link for {name}</p>
          <div className="row row--wrap" style={{ gap: 'var(--s3)' }}>
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => set(true)} disabled={busy}>
              <Icon name="link" size={15} /> Share this balance
            </button>
          </div>
          {explain ? (
            <p className="small dim" style={{ marginTop: 'var(--s2)' }}>
              Off. A link would show this balance in units and nothing in money, at an address
              nobody can guess, and you can turn it off again whenever you like.
            </p>
          ) : null}
        </>
      )}
      {said ? <p className="small" role="status" style={{ marginTop: 'var(--s2)' }}>{said}</p> : null}
    </div>
  );
}
