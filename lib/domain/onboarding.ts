/** The four things that make this product work, and nothing else.
 *
 *  A NEW ACCOUNT LANDED ON AN EMPTY DASHBOARD WITH NOTHING TO DO. Every
 *  module was there and every one of them was a ghost of somebody else's
 *  figures, which is a screen that tells a new Slipper what the product looks
 *  like when it is working and not one thing about how to get there.
 *
 *  THREE STEPS AND ONE THAT IS OPTIONAL. Send a slip, set the unit and pick a
 *  theme are the three: without a slip every figure is zero, without a unit no
 *  comparison in the product means anything, and the theme is here because it
 *  takes ten seconds and makes the app feel like the person's own. Joining a
 *  group was a fifth and it is not one of these: a group is a thing to do with
 *  a record, not a thing that makes a record work, and putting it in a list
 *  somebody is trying to finish is the product asking for engagement it has
 *  not earned.
 *
 *  LINKING TELEGRAM IS THE OPTIONAL ONE, and it used to be the first of four
 *  with a meter counting it, which is a required step wearing a tick box: an
 *  account that will never link a chat could not finish the list and had a
 *  bar on its dashboard that stopped at three quarters for ever. Nothing in
 *  the product is gated on it. A screenshot uploads, a bet types in and a
 *  history imports with no chat linked at all, so it does not count towards
 *  the list, it does not hold the list open, and it is labelled Optional
 *  where the others are labelled To do.
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
  /** Shown, never counted, and it never holds the list open. Nothing in the
   *  product is gated on an optional step. */
  optional?: boolean;
};

export function onboardingSteps(s: OnboardingSignals): OnboardingStep[] {
  return [
    {
      id: 'telegram',
      title: 'Link the Telegram bot',
      /*  A plain statement of what it does and what it does not gate. It said
          "After it, sending a slip takes four seconds", which reads next to a
          To do label as a thing the reader is going without. */
      blurb: 'One code, once. Uploading, typing and importing work without it.',
      href: '/app/import/linked',
      done: s.telegramLinked,
      optional: true,
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
  /** Counted over the steps that are NOT optional, because a count is a
   *  measure of what is left to do and there is nothing left to do about a
   *  step nothing is gated on. */
  done: number;
  total: number;
  /** True when every step that is not optional is done. The caller draws
   *  nothing at all in that case: a finished checklist is furniture, and a
   *  finished checklist with a tick against every row is furniture
   *  congratulating itself. */
  complete: boolean;
  /** The step to do next, or null when there is none. One at a time is the
   *  difference between a list and an instruction, and an optional step is
   *  never the one pointed at. */
  next: OnboardingStep | null;
};

export function onboarding(signals: OnboardingSignals): Onboarding {
  const steps = onboardingSteps(signals);
  const counted = steps.filter((x) => !x.optional);
  const done = counted.filter((x) => x.done).length;
  return {
    steps,
    done,
    total: counted.length,
    complete: done === counted.length,
    next: counted.find((x) => !x.done) ?? null,
  };
}
