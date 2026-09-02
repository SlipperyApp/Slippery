/** Settings: six groups, each opening a detail pane. Not 33 flat rows.
 *
 *  Everything here genuinely changes what is displayed. A preference nothing
 *  reads is a dead control with a switch on it.
 *
 *  A BLURB NAMES WHAT IS INSIDE, IT DOES NOT INTRODUCE IT. Every one of the
 *  six was a full sentence that ran to two and three lines beside its own
 *  title, and half of each sentence was the title again: "Account: who you
 *  are, how to reach you". They are lists now, because a list of four things
 *  is what somebody scanning a settings screen is actually reading for. */

import type { IconName } from '@/components/Icon';

export type SettingsGroup = {
  id: string;
  label: string;
  icon: IconName;
  blurb: string;
  items: string[];
};

export const SETTINGS_GROUPS: SettingsGroup[] = [
  {
    id: 'account', label: 'Account', icon: 'you',
    blurb: 'Name, email, sign in, and taking a break.',
    items: ['Display name and handle', 'Email address', 'Password', 'Two step sign in', 'Devices signed in', 'Take a break'],
  },
  {
    id: 'betting', label: 'Betting', icon: 'slip',
    blurb: 'Unit, currency, zone, and how prices read.',
    items: ['Unit size', 'Currency', 'Odds format', 'Show profit in', 'Week starts on', 'Time zone', 'Starting balance'],
  },
  {
    id: 'data', label: 'Data', icon: 'download',
    blurb: 'Export, slip images, and the two you cannot undo.',
    items: ['Export CSV, JSON or PDF', 'Slip image retention', 'Reset the ledger', 'Delete the account'],
  },
  {
    id: 'sharing', label: 'Sharing', icon: 'social',
    blurb: 'What other Slippers can see of you.',
    items: ['Profile visibility', 'Who can follow you', 'What you are tracking', 'Late edit visibility'],
  },
  {
    id: 'organising', label: 'Organising', icon: 'sliders',
    blurb: 'Bookmakers, tipsters, markets and tags.',
    items: ['Bookmakers and commission', 'Tipsters', 'Market groups and aliases', 'Tags'],
  },
  {
    id: 'about', label: 'About', icon: 'info',
    blurb: 'Themes, notifications, and the legal pages.',
    items: ['Theme', 'Notifications', 'What changed', 'Terms and Privacy', 'What this deployment can reach'],
  },
];

/** Showing what you are tracking before kick off is OFF until somebody turns
 *  it on, and the default lives here rather than in the feed that reads it.
 *
 *  A default of true would put every account's open bets in front of every
 *  other account the day the feature shipped, which is a disclosure nobody
 *  agreed to and cannot be taken back. The setting pane and the feed both
 *  read this constant, so there is one answer to what a new account does. */
export const TRACKING_DEFAULT_ON = false;

/** The four sharing switches, with the state a new account starts in.
 *  Written down rather than left as literals in the pane, so the default
 *  above and the switch a person sees cannot drift apart. */
export const SHARING_SWITCHES: { id: string; label: string; note: string; on: boolean }[] = [
  { id: 'profile', label: 'Profile visible to other Slippers', note: 'Your units, your slip backed percentage and your groups.', on: true },
  { id: 'follow', label: 'Anybody can follow you', note: 'Off means a follow is a request.', on: true },
  {
    id: 'tracking',
    label: 'Show what I am tracking before kick off',
    note: 'When this is on, an open bet captured before the off appears in Tracking now, in units, with no stake and no result. It goes when the event starts and is never revisited.',
    on: TRACKING_DEFAULT_ON,
  },
  { id: 'edits', label: 'Show my late edits in groups', note: 'A group can require this anyway.', on: true },
];

/** Seven toggles, and the billing notices are locked on: an account that
 *  cannot be told its card failed is an account that goes read only without
 *  warning. */
export const NOTIFICATIONS: { id: string; label: string; note: string; locked?: boolean; on: boolean }[] = [
  { id: 'settled', label: 'A bet settles', note: 'Batched into one message if several land within a minute.', on: true },
  { id: 'result-missing', label: 'A result has not arrived', note: 'Once, three hours past the expected finish.', on: true },
  { id: 'target', label: 'A target you set is met', note: 'Once per period, and only for a target you set yourself.', on: false },
  { id: 'group', label: 'Somebody joins a group you are in', note: 'Never who won what.', on: true },
  { id: 'follow', label: 'A Slipper follows you', note: '', on: true },
  { id: 'division', label: 'A division changes at the end of a month', note: 'States the number and stops.', on: true },
  { id: 'billing', label: 'Billing notices', note: 'Locked on. An account cannot be allowed to go read only without warning.', on: true, locked: true },
];

export const NEVER_SENT = [
  'Anything about not having bet',
  'Anything framed as losing your place',
  'Anything at all late at night',
  'Anything celebrating a betting outcome',
  'A reminder that the trial is about to end',
];

/** What every switch is set to before anybody touches one.
 *
 *  ONE PLACE, so the pane, the route and the repository cannot disagree about
 *  what "on" means for a switch nobody has chosen. An account stores only the
 *  ones it overrode, which is why changing a default here changes it for
 *  every account that has not, rather than for none of them. */
export function switchDefaults(
  list: { id: string; on: boolean }[],
  stored: Record<string, unknown> | null | undefined,
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const s of list) {
    const v = stored?.[s.id];
    out[s.id] = typeof v === 'boolean' ? v : s.on;
  }
  return out;
}

/** True when this id is one of the switches on that list. A key the product
 *  does not know about never reaches the column. */
export function isSwitch(list: { id: string }[], id: string): boolean {
  return list.some((s) => s.id === id);
}
