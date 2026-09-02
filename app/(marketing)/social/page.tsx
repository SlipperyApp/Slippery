import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { SectionHead, Checks, RowList, EndCard } from '@/components/MarketingChrome';
import { units as fmtUnits } from '@/lib/format';
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs';
import { StickyCta } from '@/components/marketing/StickyCta';

export const metadata: Metadata = {
  title: 'Groups and monthly leagues',
  description:
    'Ranked in units, never in pounds, so a bigger balance is not a bigger score.',
  alternates: { canonical: '/social' },
  openGraph: {
    title: 'Groups and monthly leagues',
    description: 'Ranked in units, never in pounds.',
    url: '/social',
    images: [{ url: '/og?title=Ranked+in+units&sub=Never+in+pounds', width: 1200, height: 630, alt: 'Slippery groups' }],
  },
};

const BOARD = [
  { n: 'Rowan', u: 18.4, s: 94, p: 1 },
  { n: 'Priya', u: 11.2, s: 100, p: 2 },
  { n: 'You', u: 6.9, s: 88, p: 3 },
  { n: 'Dev', u: -2.1, s: 71, p: 4 },
  { n: 'Marcus', u: -5.6, s: 96, p: 5 },
];

export default function Social() {
  return (
    <>
      <section className="sect" style={{ paddingBottom: 'var(--s7)' }}>
        <div className="wrap">
          <Breadcrumbs trail={[{ href: '/', label: 'Slippery' }]} page="Groups and leagues" />
          <h1 className="sect__h" style={{ fontSize: 'clamp(30px, 6vw, 52px)' }}>
            <span className="setup">A bigger balance</span>
            <span>should not be a bigger score.</span>
          </h1>
          <p className="sect__p">
            Groups rank in units, so a £5 stake and a £500 stake are directly comparable.
            Outside a group, only units are visible, never stakes.
          </p>
        </div>
      </section>

      <section className="sect" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="two">
            <div className="card">
              <div className="card__head">
                <p className="card__title">Thursday Coupon</p>
                <span className="pill">12 Slippers</span>
              </div>
              <ul>
                {BOARD.map((r) => (
                  <li key={r.n} className="brow" style={{ gridTemplateColumns: '28px minmax(0,1fr) auto auto', gap: 'var(--s3)' }}>
                    <span className={`small tnum ${r.p <= 3 ? '' : 'dim'}`} style={{ fontWeight: 600 }}>{r.p}</span>
                    <span className="brow__title">{r.n}</span>
                    <span className="small dim nowrap hide-xs">{r.s}% slip backed</span>
                    <span className={`fig fig--s tnum ${r.u >= 0 ? 'pos' : 'neg'}`}>{fmtUnits(r.u, { league: true, sign: true })}</span>
                  </li>
                ))}
              </ul>
              <p className="small dim card__foot">
                Units to 1dp here, 2dp everywhere else.
              </p>
            </div>

            <div>
              <SectionHead
                badge="Slip backed"
                setup="Anyone can type in a winner."
                claim="A percentage says who does."
              >
                A bet captured from a slip at placement is slip backed. One typed in afterwards
                is not, and a group can require slip backed only.
              </SectionHead>
              <Checks
                items={[
                  'Members see each other’s unit size',
                  'Late edits are visible where a group asks for it',
                ]}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="sect">
        <div className="wrap">
          <div className="two">
            <SectionHead
              badge="Responsible by design"
              setup="A leaderboard is an engagement mechanic."
              claim="This one refuses to behave like one."
            >
              Nothing here nudges you toward more volume.
            </SectionHead>
            <RowList
              rows={[
                { title: 'No notification about not betting', sub: 'Never "you have not logged a slip this week". Never framed as losing your place.', icon: 'bell', on: true },
                { title: 'Nothing late at night', sub: 'No push after the last fixture of the evening, for any reason.', icon: 'clock' },
                { title: '"Moving to League One next month"', sub: 'Never "RELEGATED". State the number and stop.', icon: 'trophy' },
                { title: 'Celebrate app actions, never outcomes', sub: 'Importing a history is worth marking. A winning bet is not, and neither is a run of days with a bet on them.', icon: 'check' },
                { title: 'No tips, and nothing to tail', sub: 'What other Slippers are tracking shows only bets captured before kick off, never a result, and no button turns one of theirs into one of yours.', icon: 'shield' },
                { title: 'Take a break, one control', sub: 'Pauses notifications and leagues. Touches nothing in your ledger.', icon: 'pause' },
              ]}
            />
          </div>
          <p className="small dim" style={{ marginTop: 'var(--s6)' }}>
            If any of this stops being true, it is a bug. Report it and it will be treated as one.
          </p>
        </div>
      </section>

      <section className="sect" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <EndCard
            title="Groups take about a minute to start"
            actions={
              <Link href="/app/social" className="btn btn--primary">
                Look at a group <Icon name="arrowRight" size={16} />
              </Link>
            }
          >
            Name it, choose open or by code, and share the code. It cannot be renamed afterwards.
          </EndCard>
        </div>
      </section>
      <StickyCta />
    </>
  );
}
