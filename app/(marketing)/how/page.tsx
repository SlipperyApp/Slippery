import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { SectionHead, Checks, RowList, EndCard } from '@/components/MarketingChrome';
import { SettleDemo } from '@/components/SettleDemo';
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs';
import { StickyCta } from '@/components/marketing/StickyCta';
import { TRIAL_DAYS, TRIAL_SLIPS } from '@/lib/domain/trial';

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
  { n: '02', t: 'You send the slip', s: 'Forward the screenshot, upload it, photograph a shop slip, or type it in. Whenever you placed it, before the off or in play.' },
  { n: '03', t: 'The reader reads it', s: 'It detects the bookmaker template, then scores every field for confidence on its own.' },
  { n: '04', t: 'You confirm', s: 'You see what was read before anything is written. Low confidence fields are named, not guessed.' },
  { n: '05', t: 'It settles itself', s: 'Nothing to press. The score arrives and the bet grades itself.' },
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
                One bad field cannot poison nineteen good ones.
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

      {/*  ONE SENTENCE, AND THE RULES ARE IN THE QUESTIONS.
           Eight cards stood here: ninety minutes, whole lines, quarter lines,
           handicaps by bookmaker, postponed, the markets that always ask,
           accumulators and cash out. Every one of them is a rule somebody
           looks up once and nobody reads on the way to deciding whether to
           try this, and all eight are now in the settlement answer on /faq,
           which is where a rule gets looked up. Nothing was dropped. */}
      {/*  THE FOUR RULES ARE A LIST, in the column the section left empty.
           A head, one sentence and a link filled the left 620 pixels of a
           1200 pixel wrap and nothing stood in the other 580, on a page where
           every section above it has something beside the words. The facts
           are the ones the sentence already carried, in the shape this page
           uses two sections up: nothing has been added back. */}
      <section className="sect" style={{ paddingTop: 0 }}>
        <div className="wrap two">
          <div>
            <SectionHead
              setup="A wrong grade is worse"
              claim="than no grade at all."
            >
              Anything uncertain asks you rather than guessing.
            </SectionHead>
            <p style={{ marginTop: 'var(--s5)' }}>
              <Link href="/faq" className="btn btn--ghost btn--sm">
                Every settlement rule <Icon name="arrowRight" size={16} />
              </Link>
            </p>
          </div>
          <Checks
            items={[
              'Ninety minute scores only, never extra time',
              'A whole line pushes and the stake comes back',
              'A quarter line splits the stake in half',
              'Handicaps follow the bookmaker, from a table',
            ]}
          />
        </div>
      </section>

      <section className="sect" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <EndCard
            title="Start with one slip and see"
            actions={
              <>
                <Link href="/signup" className="btn btn--primary">Start free</Link>
                <Link href="/demo" className="btn btn--link">Look at the example account <Icon name="arrowRight" size={15} /></Link>
              </>
            }
          >
            {TRIAL_DAYS} days or {TRIAL_SLIPS} slips, whichever runs out first.
          </EndCard>
        </div>
      </section>
      <StickyCta />
    </>
  );
}
