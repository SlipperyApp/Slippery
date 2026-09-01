import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { SectionHead, Checks, RowList } from '@/components/MarketingChrome';
import { SettleDemo } from '@/components/SettleDemo';
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs';
import { StickyCta } from '@/components/marketing/StickyCta';

export const metadata: Metadata = {
  title: 'How Slippery works',
  description:
    'Forward a slip, confirm what was read, and it settles itself. The reader, the settlement rules and the ledger.',
  alternates: { canonical: '/how' },
  openGraph: {
    title: 'How Slippery works',
    description: 'Forward a slip, confirm what was read, and it settles itself.',
    url: '/how',
    images: [{ url: '/og?title=How+it+works&sub=Forward+a+slip.+Confirm+what+was+read.', width: 1200, height: 630, alt: 'How Slippery works' }],
  },
};

const STEPS = [
  { n: '01', t: 'You place the bet', s: 'On whatever app or shop you already use. Slippery is never between you and the bookmaker.' },
  { n: '02', t: 'You send the slip', s: 'Forward the screenshot to the bot, upload it, photograph a shop slip, or type it in.' },
  { n: '03', t: 'The reader reads it', s: 'It detects the bookmaker template, then scores every field for confidence on its own.' },
  { n: '04', t: 'You confirm', s: 'You see what was read before anything is written. Low confidence fields are named, not guessed.' },
  { n: '05', t: 'It settles itself', s: 'Ninety minute scores only. Anything uncertain asks you.' },
  { n: '06', t: 'It reports', s: 'Ledger, calendar, breakdowns, and the split between money you won and money they gave you.' },
];

export default function How() {
  return (
    <>
      <section className="sect" style={{ paddingBottom: 'var(--s7)' }}>
        <div className="wrap">
          <Breadcrumbs trail={[{ href: '/', label: 'Slippery' }]} page="How it works" />
          <h1 className="sect__h" style={{ fontSize: 'clamp(30px, 6vw, 52px)' }}>
            <span className="setup">Six steps, and you do two of them.</span>
            <span>The rest is the point of paying for it.</span>
          </h1>
          <p className="sect__p">
            Capture happens at placement, not settlement, so the record cannot quietly become
            only the bets you wanted to remember.
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
                Each field is scored on its own, so one bad field cannot poison nineteen good ones.
              </SectionHead>
              <RowList
                rows={[
                  { title: 'High confidence', sub: 'Saved without asking you.', icon: 'check', on: true },
                  { title: 'Medium confidence', sub: 'One question, naming the field.', icon: 'help' },
                  { title: 'Low confidence', sub: 'Held out of your totals until you settle it.', icon: 'alert' },
                ]}
              />
              <Checks
                items={[
                  'Flag a misread and the credit comes back',
                  'Duplicates caught on selection, stake, bookmaker and kick-off',
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
          />
          <div className="grid" style={{ marginTop: 'var(--s6)' }}>
            {[
              { t: '90 minutes only', s: 'Extra time and penalties never count. If the feed cannot prove the score, it asks.' },
              { t: 'Whole lines push', s: 'Over 2.0 on a 1-1 is a void. Your stake comes back and the bet leaves your return.' },
              { t: 'Quarter lines split', s: 'Over 2.25 on a 1-1 loses half the stake and returns the other half.' },
              { t: 'Handicaps by bookmaker', s: 'bet365 settles Asian, so a whole line pushes. Most others give the handicap draw its own outcome.' },
              { t: 'Postponed is void', s: 'Cancelled too. Abandoned asks, because bookmakers differ.' },
              { t: 'Some markets always ask', s: 'Player props, scorers, cards, corners, bet builders, same game multis, next goal.' },
              { t: 'Accumulators wait', s: 'Every leg must grade or the bet defers. Void legs drop out and the price recalculates.' },
              { t: 'Cash out is yours', s: 'Always your action. Full, or in eighths of what is left.' },
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
              export stay live afterwards either way.
            </p>
            <div className="row" style={{ marginTop: 'var(--s5)', gap: 'var(--s4)' }}>
              <Link href="/signup" className="btn btn--primary">Start free</Link>
              <Link href="/demo" className="btn btn--link">Look at the example account <Icon name="arrowRight" size={15} /></Link>
            </div>
          </div>
        </div>
      </section>
      <StickyCta />
    </>
  );
}
