/** Settings: six groups, each opening a detail pane. Not 33 flat rows.
 *
 *  Everything here genuinely changes what is displayed. A preference nothing
 *  reads is a dead control with a switch on it. */

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
    blurb: 'Who you are, how to reach you, and how to stop for a while.',
    items: ['Display name and handle', 'Email address', 'Password', 'Two step sign in', 'Devices signed in', 'Take a break'],
  },
  {
    id: 'betting', label: 'Betting', icon: 'slip',
    blurb: 'Your unit, your currency, how prices and profit are shown.',
    items: ['Unit size', 'Currency', 'Odds format', 'Show profit in', 'Week starts on', 'Bankroll starting balance'],
  },
  {
    id: 'data', label: 'Data', icon: 'download',
    blurb: 'Export, slip images, and the two destructive actions.',
    items: ['Export CSV, JSON or PDF', 'Slip image retention', 'Reset the ledger', 'Delete the account'],
  },
  {
    id: 'sharing', label: 'Sharing', icon: 'social',
    blurb: 'What other Slippers can see, and what a group is allowed to ask for.',
    items: ['Profile visibility', 'Who can follow you', 'Group defaults', 'Late edit visibility'],
  },
  {
    id: 'organising', label: 'Organising', icon: 'sliders',
    blurb: 'Bookmakers, tipsters, market groups and tags.',
    items: ['Bookmakers and commission', 'Tipsters', 'Market groups and aliases', 'Tags'],
  },
  {
    id: 'about', label: 'About', icon: 'info',
    blurb: 'Themes, notifications, what changed, and the legal pages.',
    items: ['Theme', 'Notifications', 'What changed', 'Terms and Privacy', 'What this deployment can reach'],
  },
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
