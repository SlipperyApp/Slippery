'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icon';

/** The example account says so once, on arrival, and then gets out of the way.
 *
 *  IT WAS A BAR ACROSS THE TOP OF EVERY SCREEN. Fifty eight pixels of a 900
 *  pixel window, above the heading, on the dashboard, the ledger, Social,
 *  You, Settings and the import, carrying one sentence that is true of the
 *  whole visit rather than of the page under it. On a screen that has to fit
 *  the window that is a module's worth of height spent on a caption, and it
 *  pushed the last row of the dashboard grid off the bottom.
 *
 *  A popup on entering the view says the same thing in the same words, out of
 *  the flow, and closes. Dismissed, it stays dismissed for the length of the
 *  visit: the state is in the component and the component is on the app
 *  layout, so it survives every navigation inside the app and no storage is
 *  written. There is no localStorage in this product. */
export function DemoNote({ handle }: { handle: string }) {
  const [gone, setGone] = useState(false);
  if (gone) return null;
  return (
    <div className="expop" role="status">
      <Icon name="info" size={18} className="expop__i" />
      <p className="expop__t">
        This is the example account, <span className="mono">@{handle}</span>, folded by the same
        code your own ledger would use. <Link href="/signup">Start your own</Link>.
      </p>
      <button
        type="button"
        className="iconbtn expop__x"
        aria-label="Dismiss the example account note"
        onClick={() => setGone(true)}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
