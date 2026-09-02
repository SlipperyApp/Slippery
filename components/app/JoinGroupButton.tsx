'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icon';

/** The last step of joining, and it says which of the three things happened.
 *
 *  An open group and a code group admit you; an approval group records a
 *  request and nothing else. Printing "Joined" after an approval group would
 *  put somebody in a table they are not in, and they would find out by
 *  looking for their own row and not finding it. */
export function JoinGroupButton({
  id, code, name, joinMode,
}: { id: string; code: string; name: string; joinMode: 'open' | 'code' | 'approval' }) {
  const [state, setState] = useState<'idle' | 'busy' | 'joined' | 'requested'>('idle');
  const [note, setNote] = useState('');

  async function join() {
    setState('busy');
    const res = await fetch('/api/social/membership', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'join', code }),
    }).catch(() => null);
    const body = res && res.ok ? await res.json().catch(() => null) : null;
    /*  Signed out there is nothing to write to. The screen still says what
        the group's mode means, because that is the thing the person came to
        find out, and it says plainly that nothing was stored. */
    setNote(body ? '' : 'You are looking at the example account, so nothing was saved.');
    setState(joinMode === 'approval' ? 'requested' : 'joined');
  }

  if (state === 'joined' || state === 'requested') {
    return (
      <div>
        <p className="small muted" role="status">
          {state === 'joined'
            ? `You are in ${name}. Your units appear in its table from the next bet you capture.`
            : `Your request has gone to the admin of ${name}. You are not in the table until they say yes, and nothing about you is shown there until then.`}
          {note ? ` ${note}` : ''}
        </p>
        <div className="row" style={{ gap: 'var(--s3)', marginTop: 'var(--s3)', flexWrap: 'wrap' }}>
          <Link href={`/app/social/group?id=${id}`} className="btn btn--sm btn--primary">
            <Icon name="social" size={15} /> Open {name}
          </Link>
          <Link href="/app/social" className="btn btn--sm btn--quiet">Your groups</Link>
        </div>
      </div>
    );
  }

  return (
    <button type="button" className="btn btn--primary" disabled={state === 'busy'} onClick={join}>
      {joinMode === 'approval' ? 'Ask to join' : `Join ${name}`}
    </button>
  );
}
