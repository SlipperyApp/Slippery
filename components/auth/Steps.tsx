'use client';

import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { draftQuery } from '@/lib/signup-draft';
import { useDraft } from '@/components/auth/useDraft';

export const SIGNUP_STEPS = [
  { href: '/signup', label: 'Account' },
  { href: '/signup/verify', label: 'Code' },
  { href: '/signup/name', label: 'You' },
  { href: '/signup/unit', label: 'Unit' },
  { href: '/signup/sports', label: 'Sports' },
  { href: '/signup/plan', label: 'Plan' },
];

/** Where you are in signup, and the way back out of it.
 *
 *  SIX SCREENS AND NO WAY BACK OUT OF ANY OF THEM. Each step pushed the next
 *  one and nothing anywhere went the other way, so changing a handle you had
 *  just chosen meant starting again at the email address. The row of pips said
 *  how far along you were and could not take you anywhere.
 *
 *  The back control is an ANCHOR carrying the draft, not a router.back(). That
 *  matters twice over. It works when the step was opened directly, where
 *  history has nothing behind it to go back to. And it is a GET, so nothing on
 *  the way back re-posts: the profile writes happen on submit and only on
 *  submit.
 *
 *  The browser's own back button lands in the same place for the same reason.
 *  The draft lives in the URL (see lib/signup-draft.ts), so a history entry IS
 *  the answers, and popping to it renders the step with its fields filled from
 *  the address rather than from an empty useState.
 *
 *  The pips stay decorative. A 3px bar is not a target, and turning six of
 *  them into links means either six controls under the 44px floor or 44px of
 *  empty row above every heading in the flow. */
export function Steps({ current }: { current: number }) {
  const draft = useDraft();
  const back = current > 1 ? SIGNUP_STEPS[current - 2] : null;

  return (
    <div style={{ marginBottom: 'var(--s6)' }}>
      <div className="spread" style={{ marginBottom: 'var(--s2)', gap: 'var(--s3)' }}>
        {back ? (
          <Link
            href={`${back.href}${draftQuery(draft)}`}
            className="btn btn--quiet btn--sm steps__back"
          >
            <Icon name="chevronLeft" size={16} />
            Back to {back.label.toLowerCase()}
          </Link>
        ) : (
          <p className="label">Where you are</p>
        )}
        <p className="label">
          Step {current} of {SIGNUP_STEPS.length}, {SIGNUP_STEPS[current - 1]?.label.toLowerCase()}
        </p>
      </div>

      <div
        className="steps"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={SIGNUP_STEPS.length}
        aria-valuenow={current}
        aria-label="Sign up progress"
      >
        {SIGNUP_STEPS.map((s, i) => (
          <span key={s.href} className={`steps__pip${i < current ? ' steps__pip--on' : ''}`} />
        ))}
      </div>
    </div>
  );
}
