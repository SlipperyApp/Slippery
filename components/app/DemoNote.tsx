'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icon';

/** The example account is labelled wherever it appears, and the note is
 *  dismissible for the length of the visit. */
export function DemoNote({ handle }: { handle: string }) {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return (
    <div className="banner banner--accent" style={{ marginBottom: 'var(--s4)' }}>
      <Icon name="info" size={18} className="banner__icon" />
      <span className="grow">
        The example account, <span className="mono">@{handle}</span>, folded by the same code your
        own ledger would use. <Link href="/signup">Start your own</Link>.
      </span>
      <button type="button" className="iconbtn" aria-label="Dismiss the example account note" onClick={() => setGone(true)}>
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
