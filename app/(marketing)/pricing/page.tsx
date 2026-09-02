import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { SectionHead, RowList } from '@/components/MarketingChrome';
import { TRIAL_DAYS, TRIAL_SLIPS } from '@/lib/domain/trial';
import { money } from '@/lib/format';
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs';
import { StickyCta } from '@/components/marketing/StickyCta';

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
          <Breadcrumbs trail={[{ href: '/', label: 'Slippery' }]} page="Pricing" />
          <h1 className="sect__h" style={{ fontSize: 'clamp(30px, 6vw, 52px)' }}>
            <span className="setup">One price. Every feature.</span>
            <span>No tier that hides the useful half.</span>
          </h1>
          <p className="sect__p">
            Free for {TRIAL_DAYS} days or {TRIAL_SLIPS} slips, whichever runs out first. A card is
            required to start, and the yearly plan begins automatically when the trial ends.
          </p>
        </div>
      </section>

      {/*  WHY THIS COSTS ANYTHING, AND WHAT HAPPENS IF YOU STOP PAYING, in
           one section.
           They were two, a screen apart, with the plans between them: one
           headed "A spreadsheet is what you typed" and one headed "A missed
           payment deletes nothing", six rowcards between them for what is a
           paragraph each. Both answer the same question, which is whether the
           record you are about to start is worth anything and whether it
           stays yours. It goes ABOVE the prices, because the page used to
           open by answering "why not the cheaper tier" to somebody who had
           not decided to pay for a tracker at all. */}
      <section className="sect" style={{ paddingTop: 0, paddingBottom: 'var(--s7)' }}>
        <div className="wrap">
          <div className="two">
            <SectionHead
              setup="A spreadsheet is what you typed."
              claim="This is what the slip said."
            >
              Every figure in a spreadsheet is one you entered about yourself, after the event, and
              the file has no way of knowing what is missing. Slippery reads the stake, the price,
              the selection and the bookmaker off the slip as you place it.
            </SectionHead>
            <div>
              <RowList
                rows={[
                  { title: 'The figures are read, not typed', sub: 'Off the slip, field by field. Anything it could not read is named rather than guessed.', icon: 'camera', on: true },
                  { title: 'One bet stays one bet', sub: 'Cash out twice and it is one bet still, in eighths of the stake left standing.', icon: 'cash' },
                  { title: 'A missed payment deletes nothing', sub: 'One retry after three days, then read only, reversible the moment a working card is added.', icon: 'card' },
                  { title: 'The export keeps working', sub: 'In read only, and after cancelling.', icon: 'download' },
                ]}
              />
              <p className="small dim" style={{ marginTop: 'var(--s5)' }}>
                Billed in pounds. Your ledger can be in pounds or euro, and the two are never added
                together.
              </p>
            </div>
          </div>
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
              {/*  The accent, not the profit colour. Profit green is what a
                   bettor's own net looks like everywhere else in this
                   product, and a discount on a subscription is our money,
                   not theirs. A price saving wearing the same green as a
                   winning month teaches the colour a second meaning on the
                   page where somebody decides to pay. */}
              <span className="pill pill--accent" style={{ marginTop: 'var(--s3)', alignSelf: 'flex-start' }}>
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

      <StickyCta />
    </>
  );
}
