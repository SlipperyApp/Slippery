import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { SectionHead, Checks, RowList } from '@/components/MarketingChrome';
import { SettleDemo } from '@/components/SettleDemo';

export const metadata: Metadata = {
  title: 'How Slippery works',
  description:
    'Forward a slip, confirm what was read, and it settles itself. How capture at placement, the reader, and the settlement ledger actually work.',
  alternates: { canonical: '/how' },
  openGraph: {
    title: 'How Slippery works',
    description: 'Forward a slip, confirm what was read, and it settles itself.',
    url: '/how',
    images: [{ url: '/og?title=How+it+works&sub=Forward+a+slip.+Confirm+what+was+read.', width: 1200, height: 630, alt: 'How Slippery works' }],
  },
};

const STEPS = [
  { n: '01', t: 'You place the bet', s: 'On whatever app or in whatever shop you already use. Slippery is never between you and the bookmaker.' },
  { n: '02', t: 'You send the slip', s: 'Forward the screenshot to the bot, upload it, photograph a shop slip, or type it in. Under ten seconds either way.' },
  { n: '03', t: 'The reader reads it', s: 'The bookmaker template is detected first, then the fields are parsed and each one is scored for confidence on its own.' },
  { n: '04', t: 'You confirm', s: 'You see exactly what was read before anything is written. A low confidence field is named, not guessed at.' },
  { n: '05', t: 'It settles itself', s: 'Ninety minute scores only. Anything uncertain asks you rather than grading it wrong.' },
  { n: '06', t: 'It reports', s: 'Your ledger, your calendar, your breakdowns, and the split between money you won and money they gave you.' },
];

export default function How() {
  return (
    <>
      <section className="sect" style={{ paddingBottom: 'var(--s7)' }}>
        <div className="wrap">
          <span className="pill">How it works</span>
          <h1 className="sect__h" style={{ marginTop: 'var(--s4)', fontSize: 'clamp(30px, 6vw, 52px)' }}>
            <span className="setup">Six steps, and you do two of them.</span>
            <span>The rest is the point of paying for it.</span>
          </h1>
          <p className="sect__p">
            Capture happens at placement, not at settlement, because a record made before you know
            how it went cannot quietly become only the bets you wanted to remember.
          </p>
        </div>
      </section>

      <section className="sect" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <ol className="grid">
            {STEPS.map((s) => (
              <li key={s.n} className="card col-4">
                <p className="label mono">{s.n}</p>
                <p className="card__title" style={{ marginTop: 'var(--s2)' }}>{s.t}</p>
                <p className="small muted" style={{ marginTop: 'var(--s2)' }}>{s.s}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="sect">
        <div className="wrap">
          <div className="two">
            <div>
              <SectionHead
                badge="Confidence per field"
                setup="Not per slip."
                claim="A slip is right in parts."
              >
                Scoring a whole slip means one bad field poisons nineteen good ones, or nineteen good
                ones hide one bad one. Slippery scores each field on its own.
              </SectionHead>
              <RowList
                rows={[
                  { title: 'High confidence', sub: 'Saved silently. You are not asked to confirm what was never in doubt.', icon: 'check', on: true },
                  { title: 'Medium confidence', sub: 'One targeted question naming the field, not a whole form to fill in again.', icon: 'help' },
                  { title: 'Low confidence', sub: 'Held out of the aggregates until you settle it, so a guess cannot move your ROI.', icon: 'alert' },
                ]}
              />
              <Checks
                items={[
                  'A missing price is visible, a wrong one is not',
                  'Flag a misread and the credit comes back',
                  'Duplicate slips are caught on selection, stake, bookmaker and kick-off',
                  'Manual and shop bets are marked, never hidden',
                ]}
              />
            </div>
            <SettleDemo />
          </div>
        </div>
      </section>

      <section className="sect" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead
            badge="Settlement"
            setup="A wrong grade is worse"
            claim="than no grade at all."
          >
            Everything below is a rule, not a preference. Each one exists because getting it wrong
            corrupts a real profit and loss figure that somebody is making decisions from.
          </SectionHead>
          <div className="grid" style={{ marginTop: 'var(--s6)' }}>
            {[
              { t: '90 minutes only', s: 'Extra time and penalties never count. If the feed cannot prove the 90 minute score, Slippery asks.' },
              { t: 'Whole lines push', s: 'Over 2.0 on a 1-1 is a void, not a loss. Your stake comes back and the bet leaves the ROI denominator.' },
              { t: 'Quarter lines split', s: 'Over 2.25 on a 1-1 loses half the stake and returns the other half.' },
              { t: 'Handicaps by bookmaker', s: 'bet365 settles Asian, so a whole line pushes. Most others give the handicap draw its own outcome, so a -1 acts like a -1.5.' },
              { t: 'Postponed is void', s: 'Cancelled too. Abandoned asks, because bookmakers genuinely differ on it.' },
              { t: 'Some markets always ask', s: 'Player props, anytime scorer, cards, corners, bet builders, same game multis and next goal. Never graded from a feed.' },
              { t: 'Accumulators wait', s: 'Every leg must grade or the whole bet defers. Void legs drop out and the price recalculates.' },
              { t: 'Cash out is yours', s: 'It cannot be detected from a feed, so it is always your action. Full, or in eighths of what is left.' },
            ].map((r) => (
              <div key={r.t} className="card col-4">
                <p className="card__title">{r.t}</p>
                <p className="small muted" style={{ marginTop: 'var(--s2)' }}>{r.s}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sect" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="card" style={{ alignItems: 'flex-start' }}>
            <p className="card__title">Start with one slip and see</p>
            <p className="small muted" style={{ marginTop: 'var(--s2)', maxWidth: '58ch' }}>
              Fourteen days or thirty five slips, whichever runs out first. Your ledger and your
              export stay live afterwards either way, because a betting record belongs to the person
              who kept it.
            </p>
            <div className="row" style={{ marginTop: 'var(--s5)', gap: 'var(--s4)' }}>
              <Link href="/signup" className="btn btn--primary">Start free</Link>
              <Link href="/demo" className="btn btn--link">Look at the example account <Icon name="arrowRight" size={15} /></Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
