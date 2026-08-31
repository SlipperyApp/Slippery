import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { SectionHead } from '@/components/MarketingChrome';
import { TRIAL_DAYS, TRIAL_SLIPS } from '@/lib/domain/trial';
import { money } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Free for 14 days or 35 slips, then £3.49 a month or £29.99 a year. Your ledger and export stay live even if the card does not.',
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'Slippery pricing',
    description: 'Free for 14 days or 35 slips, then £3.49 a month or £29.99 a year.',
    url: '/pricing',
    images: [{ url: '/og?title=%C2%A33.49+a+month&sub=or+%C2%A329.99+a+year', width: 1200, height: 630, alt: 'Slippery pricing' }],
  },
};

const INCLUDED = [
  'Unlimited slips, every bet type',
  'The Telegram bot',
  'Automatic settlement',
  'The full ledger and every breakdown',
  'Groups and monthly leagues',
  'Import a history from anywhere',
  'CSV, JSON and PDF export, always',
  'All eight themes',
];

export default function Pricing() {
  return (
    <>
      <section className="sect" style={{ paddingBottom: 'var(--s7)' }}>
        <div className="wrap">
          <span className="pill">Pricing</span>
          <h1 className="sect__h" style={{ marginTop: 'var(--s4)', fontSize: 'clamp(30px, 6vw, 52px)' }}>
            <span className="setup">One price. Every feature.</span>
            <span>No tier that hides the useful half.</span>
          </h1>
          <p className="sect__p">
            Free for {TRIAL_DAYS} days or {TRIAL_SLIPS} slips, whichever runs out first. A card is
            required to start, and the yearly plan begins automatically when the trial ends.
          </p>
        </div>
      </section>

      <section className="sect" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="pricegrid">
            <div className="card plan plan--rec">
              <div className="spread">
                <p className="card__title">Yearly</p>
                <span className="pill pill--accent">Recommended</span>
              </div>
              <div className="plan__price">
                <span className="fig">{money(2999)}</span>
                <span className="plan__was tnum">{money(3499)}</span>
              </div>
              <p className="small muted">a year, {money(250)} a month in effect</p>
              <span className="pill pill--pos" style={{ marginTop: 'var(--s3)', alignSelf: 'flex-start' }}>
                Save {money(1189)} a year
              </span>
              <div className="card__foot">
                <Link href="/signup/plan" className="btn btn--primary btn--wide">Start the free trial</Link>
              </div>
            </div>

            <div className="card plan">
              <p className="card__title">Monthly</p>
              <div className="plan__price">
                <span className="fig">{money(349)}</span>
              </div>
              <p className="small muted">a month, cancel any month</p>
              <p className="small dim" style={{ marginTop: 'var(--s3)' }}>
                Exactly the same product. There is no feature behind the yearly plan.
              </p>
              <div className="card__foot">
                <Link href="/signup/plan" className="btn btn--ghost btn--wide">Start the free trial</Link>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: 'var(--s5)' }}>
            <p className="card__title">What is in it</p>
            <ul className="checks" style={{ marginTop: 'var(--s4)' }}>
              {INCLUDED.map((i) => (
                <li key={i} className="checkitem"><Icon name="check" size={16} /><span>{i}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="sect" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="two">
            <SectionHead
              badge="If the card fails"
              setup="Nothing is deleted."
              claim="Ever, for any reason."
            >
              One retry after three days. Two failures and the account goes read only: new slips,
              imports and the bot pause. The ledger and the export stay fully live.
            </SectionHead>
            <div className="rows">
              <div className="rowcard">
                <Icon name="card" size={20} className="rowcard__i" />
                <div><p className="rowcard__t">Attempt one fails</p><p className="rowcard__s">Retried in three days. Nothing changes in the meantime.</p></div>
              </div>
              <div className="rowcard">
                <Icon name="lock" size={20} className="rowcard__i" />
                <div><p className="rowcard__t">Attempt two fails</p><p className="rowcard__s">Read only. Reversible the moment a working card is added.</p></div>
              </div>
              <div className="rowcard rowcard--on">
                <Icon name="download" size={20} className="rowcard__i" />
                <div><p className="rowcard__t">Export keeps working</p><p className="rowcard__s">In read only, and after cancelling. A betting record belongs to the person who kept it.</p></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="sect" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <p className="small dim" style={{ maxWidth: '70ch' }}>
            Prices include VAT where it applies. Slippery never accepts bets, holds money, pays
            winnings or gives tips, so nothing here is a wager and none of it can win or lose.
          </p>
        </div>
      </section>
    </>
  );
}
