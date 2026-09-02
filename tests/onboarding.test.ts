import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onboarding, onboardingSteps, type OnboardingSignals } from '@/lib/domain/onboarding';
import { trialState, TRIAL_DAYS, TRIAL_SLIPS } from '@/lib/domain/trial';

const nothing: OnboardingSignals = {
  telegramLinked: false, hasBet: false, unitSet: false, themeSet: false,
};
const everything: OnboardingSignals = {
  telegramLinked: true, hasBet: true, unitSet: true, themeSet: true,
};

test('four steps, and they are the four that make the product work', () => {
  /*  Not five. Joining a group was on the old literal, and a group is a thing
   *  to do with a record rather than a thing that makes a record work.
   *  Putting it in a list somebody is trying to finish is the product asking
   *  for engagement it has not earned. */
  const steps = onboardingSteps(nothing);
  assert.deepEqual(steps.map((s) => s.id), ['telegram', 'slip', 'unit', 'theme']);
  for (const s of steps) {
    assert.ok(s.title.length > 0);
    assert.ok(s.blurb.length > 0, `${s.id} has no reason to bother beside it`);
    assert.ok(s.href.startsWith('/app/'), `${s.id} goes nowhere`);
  }
});

test('it disappears when it is complete', () => {
  const o = onboarding(everything);
  assert.equal(o.complete, true);
  assert.equal(o.done, o.total);
  assert.equal(o.next, null, 'a finished list has no next step to point at');
});

test('a half done list points at exactly one next step', () => {
  const o = onboarding({ ...nothing, unitSet: true });
  assert.equal(o.complete, false);
  assert.equal(o.done, 1);
  assert.equal(o.next?.id, 'telegram', 'the first undone one, in order');
});

test('every step is driven by its own signal and nothing else', () => {
  /*  A step that ticked on somebody else's signal is a list that lies to
   *  make itself shorter, which is the failure a default theme would cause. */
  const keys: (keyof OnboardingSignals)[] = ['telegramLinked', 'hasBet', 'unitSet', 'themeSet'];
  const ids = ['telegram', 'slip', 'unit', 'theme'];
  keys.forEach((key, i) => {
    const steps = onboardingSteps({ ...nothing, [key]: true });
    steps.forEach((s, j) => {
      assert.equal(s.done, i === j, `${key} should tick ${ids[i]} and nothing else`);
    });
  });
});

// ---------------------------------------------------- it never contradicts

/*  THE TRIAL IS FOURTEEN DAYS OR THIRTY FIVE SLIPS and trialState() reports
 *  WHICH one ran out, in one sentence every surface shows. A checklist
 *  counting its own slips or days would be a second opinion about the number
 *  that blocks an upload, which is exactly the disagreement that function
 *  exists to make impossible. */

test('the checklist holds no number about the trial, in code or in copy', () => {
  const src = readFileSync('lib/domain/onboarding.ts', 'utf8');
  const card = readFileSync('components/app/Onboarding.tsx', 'utf8');

  for (const [file, text] of [['lib/domain/onboarding.ts', src], ['components/app/Onboarding.tsx', card]] as const) {
    const code = text
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/^\s*\/\/.*$/gm, ' ');
    assert.doesNotMatch(code, new RegExp(`\\b${TRIAL_DAYS}\\b`), `${file} states the trial day count itself`);
    assert.doesNotMatch(code, new RegExp(`\\b${TRIAL_SLIPS}\\b`), `${file} states the trial slip count itself`);
    assert.doesNotMatch(code, /trialSlipsUsed|trialSlipsAllowed|trialEndsAt/, `${file} counts the trial itself`);
  }

  // And where it does mention the trial, the words are trialState()'s own.
  assert.match(card, /trial\.message/, 'the card should print the one sentence rather than compose one');
});

test('the sentence the card prints is the one the trial owns', () => {
  const now = new Date('2026-09-01T12:00:00Z');
  const active = trialState({
    trialEndsAt: new Date(now.getTime() + 5 * 86400000).toISOString(),
    trialSlipsAllowed: TRIAL_SLIPS,
    trialSlipsUsed: 4,
  }, now);
  assert.equal(active.active, true);
  assert.match(active.message, /5 days left/);
  assert.match(active.message, new RegExp(`${TRIAL_SLIPS - 4} more slips`));

  const outOfSlips = trialState({
    trialEndsAt: new Date(now.getTime() + 5 * 86400000).toISOString(),
    trialSlipsAllowed: TRIAL_SLIPS,
    trialSlipsUsed: TRIAL_SLIPS,
  }, now);
  assert.equal(outOfSlips.ranOutOn, 'slips', 'which half ran out is the trial function to answer');

  const outOfDays = trialState({
    trialEndsAt: new Date(now.getTime() - 1000).toISOString(),
    trialSlipsAllowed: TRIAL_SLIPS,
    trialSlipsUsed: 2,
  }, now);
  assert.equal(outOfDays.ranOutOn, 'days');
});

test('nothing in the checklist praises, goads or asks for a return visit', () => {
  /*  Celebrate app actions, never betting outcomes, and never nag. A list
   *  that cheers at the end is one step from a product that cheers when you
   *  win, and tests/responsible.test.ts covers the whole tree for the praise
   *  words. This covers the shape peculiar to a checklist: a call to come
   *  back, or a count of what is left framed as falling behind. */
  /*  Comments are for whoever reads the code and are not the product, so
      they come out first, the way tests/house-style.test.ts does it. */
  const strip = (f: string) => readFileSync(f, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ');
  const text = strip('lib/domain/onboarding.ts') + strip('components/app/Onboarding.tsx');
  for (const phrase of [
    'almost there', 'nearly there', 'you have not', "you haven't", 'still need',
    'come back', 'finish setting up', 'complete your', 'get started today',
  ]) {
    assert.ok(!text.toLowerCase().includes(phrase), `the checklist says "${phrase}"`);
  }
});
