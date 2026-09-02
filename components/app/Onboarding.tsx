import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { onboarding, type OnboardingSignals } from '@/lib/domain/onboarding';
import type { TrialState } from '@/lib/domain/trial';

/** The getting started card, on the dashboard, while it is unfinished.
 *
 *  It draws NOTHING when the four are done. A finished checklist is
 *  furniture, and a finished checklist with a tick against every row is
 *  furniture congratulating itself.
 *
 *  THE TRIAL SENTENCE IS trialState()'s OWN. The trial is fourteen days or
 *  thirty five slips, whichever runs out first, and that function reports
 *  which one ran out. A checklist that counted its own slips would be a
 *  second opinion about the number that blocks an upload, so this prints the
 *  one sentence and adds nothing to it. */
export function Onboarding({
  signals, trial, demo = false,
}: {
  signals: OnboardingSignals;
  trial: TrialState;
  /** The example account is somebody else's finished record. A getting
   *  started list on it would be a set of instructions for an account nobody
   *  reading it owns. */
  demo?: boolean;
}) {
  const o = onboarding(signals);
  if (demo || o.complete) return null;

  return (
    <section className="card col-12 onb" aria-labelledby="onb-t" id="mod-onboarding">
      <div className="card__head">
        <h2 className="card__title" id="onb-t">Getting started</h2>
        {/*  A count, not a percentage and not a word. "2 of 4" is a fact;
             "50% there" is a claim about how much is left, and the four are
             not the same size. */}
        <p className="card__note tnum">{o.done} of {o.total}</p>
      </div>

      <div className="meter" aria-hidden="true">
        <span className="meter__fill" style={{ width: `${(o.done / o.total) * 100}%` }} />
      </div>

      <ul className="onb__list">
        {o.steps.map((step) => (
          <li key={step.id} className={`brow onb__step${step.done ? ' onb__step--done' : ''}`}>
            <span className="onb__mark" aria-hidden="true">
              <Icon name={step.done ? 'check' : 'chevronRight'} size={15} />
            </span>
            {/*  THE WHOLE STEP IS THE TARGET, not the title inside it. A
                 link with the class brow__title picks up a 44px tap floor on
                 a coarse pointer, which is right and which, on a title with a
                 line of explanation under it, opened a 44px hole between the
                 two. Two lines of text clear 44px on their own. */}
            {step.done ? (
              <span className="onb__body">
                <span className="brow__title">{step.title}</span>
                <span className="brow__sub">{step.blurb}</span>
              </span>
            ) : (
              <Link href={step.href} className="onb__body onb__link">
                <span className="brow__title">{step.title}</span>
                <span className="brow__sub">{step.blurb}</span>
              </Link>
            )}
            <span className="small dim onb__state">{step.done ? 'Done' : 'To do'}</span>
          </li>
        ))}
      </ul>

      <p className="small dim card__foot">
        {/*  The trial's own sentence, from the one function that owns both
             halves of it. Nothing here counts slips or days itself. */}
        {trial.active ? `Trial: ${trial.message}` : trial.message}{' '}
        This list disappears when the four are done, and nothing here will ever be sent to you.
      </p>
    </section>
  );
}
