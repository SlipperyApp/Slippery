/** The four things that make this product work, and nothing else.
 *
 *  A NEW ACCOUNT LANDED ON AN EMPTY DASHBOARD WITH NOTHING TO DO. Every
 *  module was there and every one of them was a ghost of somebody else's
 *  figures, which is a screen that tells a new Slipper what the product looks
 *  like when it is working and not one thing about how to get there.
 *
 *  FOUR STEPS. Link the bot, send a slip, set the unit, pick a theme. Each of
 *  them changes what the product can do: without the link a slip takes a
 *  minute instead of four seconds, without a slip every figure is zero,
 *  without a unit no comparison in the product means anything, and the theme
 *  is here because it is the one that takes ten seconds and makes the app
 *  feel like the person's own. Joining a group was a fifth and it is not one
 *  of these: a group is a thing to do with a record, not a thing that makes a
 *  record work, and putting it in a list somebody is trying to finish is the
 *  product asking for engagement it has not earned.
 *
 *  IT NEVER NAGS, and that is a rule rather than a preference. It appears on
 *  the dashboard while it is unfinished, it disappears the moment it is
 *  finished, and it is never sent anywhere: no notification, no email, no
 *  message from the bot. It states what is done and stops. There is no
 *  congratulation at the end, because this product celebrates app actions
 *  quietly and betting outcomes never, and a checklist that cheers is one
 *  step from a product that cheers when you win.
 *
 *  IT SAYS NOTHING ABOUT THE TRIAL. `trialState()` in lib/domain/trial.ts
 *  owns both halves of that and reports WHICH one ran out, in one sentence
 *  every surface shows. A checklist counting its own slips would be a second
 *  opinion about the number that blocks an upload, which is exactly the
 *  disagreement that function exists to make impossible. Where the trial is
 *  worth saying here, the caller passes trialState()'s own message through. */

export type OnboardingStepId = 'telegram' | 'slip' | 'unit' | 'theme';

export type OnboardingSignals = {
  /** A Telegram chat is linked to this account. */
  telegramLinked: boolean;
  /** Any bet at all is in the ledger. A typed bet counts: the step is "log
   *  your first bet", and telling somebody their first bet does not count
   *  because they typed it in would be the product arguing with them. */
  hasBet: boolean;
  /** A unit has been chosen. Signup asks for one, so this is normally true by
   *  the time anybody sees the list, and it is on the list because an account
   *  that arrived any other way still needs it. */
  unitSet: boolean;
  /** A theme has been chosen, as opposed to sitting on the default. */
  themeSet: boolean;
};

export type OnboardingStep = {
  id: OnboardingStepId;
  title: string;
  /** What it changes. Never what it is: "Link the Telegram bot" needs no
   *  explanation of what linking is, it needs the reason to bother. */
  blurb: string;
  href: string;
  done: boolean;
};

export function onboardingSteps(s: OnboardingSignals): OnboardingStep[] {
  return [
    {
      id: 'telegram',
      title: 'Link the Telegram bot',
      blurb: 'One code, once. After it, sending a slip takes four seconds.',
      href: '/app/import/linked',
      done: s.telegramLinked,
    },
    {
      id: 'slip',
      title: 'Send your first slip',
      blurb: 'Forward it, upload it, or type the bet in. All three count.',
      href: '/app/import',
      done: s.hasBet,
    },
    {
      id: 'unit',
      title: 'Set your unit',
      blurb: 'One unit is one normal bet for you. Every comparison here is in units.',
      href: '/app/settings?pane=betting',
      done: s.unitSet,
    },
    {
      id: 'theme',
      title: 'Pick a theme',
      blurb: 'Eight, all dark. It takes ten seconds and it is yours after that.',
      href: '/app/settings?pane=about',
      done: s.themeSet,
    },
  ];
}

export type Onboarding = {
  steps: OnboardingStep[];
  done: number;
  total: number;
  /** True when every step is done. The caller draws nothing at all in that
   *  case: a finished checklist is furniture, and a finished checklist with a
   *  tick against every row is furniture congratulating itself. */
  complete: boolean;
  /** The step to do next, or null when there is none. One at a time is the
   *  difference between a list and an instruction. */
  next: OnboardingStep | null;
};

export function onboarding(signals: OnboardingSignals): Onboarding {
  const steps = onboardingSteps(signals);
  const done = steps.filter((x) => x.done).length;
  return {
    steps,
    done,
    total: steps.length,
    complete: done === steps.length,
    next: steps.find((x) => !x.done) ?? null,
  };
}
