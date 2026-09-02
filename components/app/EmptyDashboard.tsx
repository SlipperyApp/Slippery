import { EmptyState } from '@/components/app/BetRow';
import { Onboarding } from '@/components/app/Onboarding';
import type { OnboardingSignals } from '@/lib/domain/onboarding';
import type { TrialState } from '@/lib/domain/trial';

/** The dashboard before there is anything in it.
 *
 *  ONE COMPONENT, TWO CALLERS. This was a page under /app/states that
 *  described the empty dashboard, and the real dashboard could never reach
 *  it, because getViewer() handed every signed-in account the example
 *  account's 259 bets. Now the real dashboard renders this the moment the
 *  account has no rows, and the state page renders the same thing with a new
 *  account's own answers, so the screen somebody is shown and the screen we
 *  designed cannot drift apart.
 *
 *  Every figure behind the glass is a GHOST, marked aria-hidden and never
 *  presented as a number. `reason` is the sentence that says why this is
 *  empty, and it is the difference between an empty state and a product that
 *  looks broken. */
export function EmptyDashboard({
  signals, trial, reason,
}: {
  signals: OnboardingSignals;
  trial: TrialState;
  reason: string;
}) {
  return (
    <>
      <h1>Dashboard</h1>
      <p className="muted" style={{ marginTop: 'var(--s2)', maxWidth: '62ch' }}>
        {reason} Every module is here. They fill in as bets do.
      </p>

      <div className="grid" style={{ marginTop: 'var(--s5)' }}>
        <Onboarding signals={signals} trial={trial} />
      </div>

      <div className="grid" style={{ marginTop: 'var(--s4)' }}>
        <section className="card col-4 h-m">
          <p className="card__title">Net</p>
          <EmptyState
            title="Your first figure lands here"
            action="Add a bet"
            href="/app/import"
            ghost={<><p className="label">This month</p><p className="fig pos">+£1,240.00</p><p className="small dim">+49.60u on a £25.00 unit</p></>}
          />
        </section>

        <section className="card col-4 h-m">
          <p className="card__title">Running now</p>
          <EmptyState
            title="Nothing running yet"
            action="Forward a slip"
            href="/app/import/linked"
            ghost={
              <ul>
                {['Arsenal to win', 'Over 2.5 goals', 'State Man'].map((s) => (
                  <li key={s} className="brow"><span className="brow__title">{s}</span><span className="fig fig--s">£38.25</span></li>
                ))}
              </ul>
            }
          />
        </section>

        <section className="card col-4 h-m">
          <p className="card__title">This month</p>
          <EmptyState
            title="Days fill in as bets settle"
            action="Add a bet"
            href="/app/import"
            ghost={
              <div className="cal" aria-hidden="true">
                {Array.from({ length: 35 }).map((_, i) => (
                  <span key={i} className="cal__cell">
                    {i % 5 === 0 ? <span className="cal__fill" style={{ background: 'var(--pos)', opacity: 0.4 }} /> : null}
                  </span>
                ))}
              </div>
            }
          />
        </section>
      </div>
    </>
  );
}
