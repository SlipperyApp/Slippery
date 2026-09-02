import type { Metadata } from 'next';
import { EmptySocial } from '@/components/app/EmptySocial';

export const metadata: Metadata = {
  title: 'No groups yet',
  description: 'Social before you have joined anything: the leaderboard ghosted, with the action on top.',
};

/*  The same component the real social hub renders for an account that is not
 *  the example one. Two copies of this screen were two screens that could
 *  disagree, and the one an account was actually shown was the example
 *  account's league table with itself at the top of it. */
export default function NewSocial() {
  return <EmptySocial />;
}
