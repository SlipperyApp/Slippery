'use client';

import { useState } from 'react';
import { Icon } from '@/components/Icon';

export function FollowButton({ handle, initiallyFollowing }: { handle: string; initiallyFollowing: boolean }) {
  const [following, setFollowing] = useState(initiallyFollowing);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    const next = !following;
    setFollowing(next);
    await fetch('/api/social/follow', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ handle, following: next }),
    }).catch(() => null);
    setBusy(false);
  }

  return (
    <button
      type="button"
      className={`btn btn--sm ${following ? 'btn--ghost' : 'btn--primary'}`}
      onClick={toggle}
      aria-pressed={following}
      disabled={busy}
    >
      <Icon name={following ? 'check' : 'plus'} size={15} />
      {following ? 'Following' : 'Follow'}
    </button>
  );
}
