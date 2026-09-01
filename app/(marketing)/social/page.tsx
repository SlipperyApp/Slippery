import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { SectionHead, Checks, RowList } from '@/components/MarketingChrome';
import { units as fmtUnits } from '@/lib/format';
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs';
import { StickyCta } from '@/components/marketing/StickyCta';

export const metadata: Metadata = {
  title: 'Groups and monthly leagues',
  description:
    'Slippers rank in units, never in pounds, so a bigger bankroll is not a bigger score. Slip backed percentages, honest divisions, and nothing that nudges you to bet more.',
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
            <span className="setup">A bigger bankroll</span>
            <span>should not be a bigger score.</span>
          </h1>
          <p className="sect__p">
            Groups rank in units. A Slipper staking £5 and a Slipper staking £500 are directly
            comparable, and outside a group only units are ever visible, never stakes.
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
                    <span className="small dim nowrap">{r.s}% slip backed</span>
                    <span className={`fig fig--s tnum ${r.u >= 0 ? 'pos' : 'neg'}`}>{fmtUnits(r.u, { league: true, sign: true })}</span>
                  </li>
                ))}
              </ul>
              <p className="small dim card__foot">
                Units to 1dp here, 2dp everywhere else: a league is a comparison rather than a
                record, and a column of 2dp units is unreadable.
              </p>
            </div>

            <div>
              <SectionHead
                badge="Slip backed"
                setup="Anyone can type in a winner."
                claim="A percentage says who does."
              >
                A bet captured from a slip at placement is slip backed. One typed in afterwards is
                not, and it says so. A group can require slip backed bets only.
              </SectionHead>
              <Checks
                items={[
                  'Members see each other’s unit size',
                  'Outside a group, units only, never stakes',
                  'Late edits are visible where a group asks for it',
                  'Positions read as a place out of a field',
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
              Nothing in Slippery nudges toward more volume. The rules below are constraints on the
              product, not features of it.
            </SectionHead>
            <RowList
              rows={[
                { title: 'No notification about not betting', sub: 'Never "you have not logged a slip this week". Never framed as losing your place.', icon: 'bell', on: true },
                { title: 'Nothing late at night', sub: 'No push after the last fixture of the evening, for any reason.', icon: 'clock' },
                { title: '"Moving to League One next month"', sub: 'Never "RELEGATED". State the number and stop.', icon: 'trophy' },
                { title: 'Celebrate app actions, never outcomes', sub: 'A capture streak is worth marking. A winning bet is not.', icon: 'check' },
                { title: 'Take a break, one control', sub: 'Pauses notifications and leagues, touches nothing in your ledger, and does not argue.', icon: 'pause' },
              ]}
            />
          </div>
          <p className="small dim" style={{ marginTop: 'var(--s6)', maxWidth: '68ch' }}>
            If any of this stops being true, it is a bug. Report it and it will be treated as one.
            Free and confidential help is at BeGambleAware.org and on 0808 8020 133, 24 hours a day.
          </p>
        </div>
      </section>

      <section className="sect" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="card" style={{ alignItems: 'flex-start' }}>
            <p className="card__title">Groups take about a minute to start</p>
            <p className="small muted" style={{ marginTop: 'var(--s2)', maxWidth: '56ch' }}>
              Name it, pick whether it is open or by code, and share the code. Groups cannot be
              renamed afterwards, so that a league nobody joined cannot become a league everybody
              did.
            </p>
            <Link href="/app/social" className="btn btn--primary" style={{ marginTop: 'var(--s5)' }}>
              Look at a group <Icon name="arrowRight" size={16} />
            </Link>
          </div>
        </div>
      </section>
      <StickyCta />
    </>
  );
}
