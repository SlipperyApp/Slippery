'use client';

import { useState } from 'react';

/** Follow, and unfollow, from wherever a person appears.
 *
 *  It was on the profile page and nowhere else, so discovering somebody in
 *  a list and following them was: read the row, open the profile, follow,
 *  go back. Three of those four steps exist only because the button was
 *  missing from the row.
 *
 *  THE LABEL CHANGES ON HOVER, and that matters more than it sounds. A
 *  button that says "Following" is describing a state; the same button has
 *  to also be the way to stop, and a person who clicks something labelled
 *  "Following" expecting confirmation and gets an unfollow has been tricked
 *  by their own button. It says Following at rest and Unfollow when you are
 *  about to press it, which is the one convention everybody has learned. */
export function FollowButton({ handle, initial }: { handle: string; initial?: boolean }) {
  const [on, setOn] = useState(Boolean(initial));
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !on;
    setOn(next);            // optimistic: the row should not stutter
    setBusy(true);
    const res = await fetch('/api/social/follow', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ handle, following: next }),
    }).catch(() => null);
    /*  Signed out there is nothing to write to, and that is fine: the state
        is honest for this session and the account page says what is stored.
        What is NOT fine is silently reverting, which reads as the click
        having missed. */
    if (res && !res.ok && res.status !== 401 && res.status !== 503) setOn(!next);
    setBusy(false);
  }

  return (
    <button
      type="button"
      className={`btn btn--sm follow${on ? ' follow--on' : ''}`}
      aria-pressed={on}
      disabled={busy}
      onClick={toggle}
    >
      <span className="follow__rest">{on ? 'Following' : 'Follow'}</span>
      {on ? <span className="follow__hover">Unfollow</span> : null}
    </button>
  );
}
