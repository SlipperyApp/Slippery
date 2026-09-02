import type { Metadata } from 'next';
import { EmptyDashboard } from '@/components/app/EmptyDashboard';
import { trialState } from '@/lib/domain/trial';
import { emptyReason } from '@/lib/data/viewer';

export const metadata: Metadata = {
  title: 'A new dashboard',
  description: 'What the dashboard looks like before there is anything in it: the thing ghosted, with the action on top.',
};

/*  THE REAL COMPONENT, with a new account's own answers.
 *
 *  This page carried its own copy of the layout as well as its own five item
 *  literal, so the state screen and the dashboard were two screens that could
 *  disagree about what a new Slipper is shown, and for a long time they did:
 *  the real dashboard could not reach this state at all. One component now,
 *  rendered by both, and this page supplies the booleans a fresh account
 *  actually has. */
export default function NewDashboard() {
  const now = new Date();
  const trial = trialState({
    trialEndsAt: new Date(now.getTime() + 14 * 86400000).toISOString(),
    trialSlipsAllowed: 0,
    trialSlipsUsed: 0,
  }, now);

  return (
    <EmptyDashboard
      signals={{ telegramLinked: false, hasBet: false, unitSet: true, themeSet: false }}
      trial={trial}
      reason={emptyReason(true)}
    />
  );
}
