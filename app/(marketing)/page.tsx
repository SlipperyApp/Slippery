import Link from 'next/link';
import type { Metadata } from 'next';
import { Icon } from '@/components/Icon';
import { SettleDemo } from '@/components/SettleDemo';
import { SectionHead, RowList } from '@/components/MarketingChrome';
import { BetTypeWall } from '@/components/marketing/BetTypeWall';
import { SplitHeadline } from '@/components/marketing/SplitHeadline';
import { ThemeStrip } from '@/components/marketing/ThemeStrip';
import { Sequence } from '@/components/marketing/Sequence';
import { WaveField } from '@/components/marketing/WaveField';
import { Makers, MadeBy } from '@/components/marketing/Makers';
import { StickyCta } from '@/components/marketing/StickyCta';
import { Faq } from '@/components/marketing/Faq';
import { TOP_QUESTIONS } from '@/lib/content/faq';
import { money } from '@/lib/format';

export const metadata: Metadata = {
  title: { absolute: 'Slippery, a bet tracker that captures at placement' },
  description:
    'Forward a bookmaker slip the moment you place it. Slippery reads it, settles it and reports what your record actually says. Built for UK and Irish bet types, from a single to a Lucky 63.',
  alternates: { canonical: '/' },
  openGraph: {
    title: 'Slippery, a bet tracker that captures at placement',
    description: 'Forward a slip the moment you place it. Slippery reads it, settles it and reports what your record actually says.',
    url: '/',
    images: [{ url: '/og?title=It+all+starts+with+a+slip.&sub=A+bet+tracker+that+captures+at+placement', width: 1200, height: 630, alt: 'Slippery' }],
  },
};

export default function Landing() {
  return (
    <>
      {/* ------------------------------------------------------------ hero */}
      <section className="hero hero--mid">
        <WaveField />
        <div className="wrap">
          <h1 className="hero__h rise">
            It all starts with a{' '}
            <span className="slipword">
              <span className="slipword__glow" aria-hidden="true">slip.</span>
              <span className="slipword__text">slip.</span>
              <span className="slipword__sheen" aria-hidden="true" />
            </span>
          </h1>

          <p className="hero__sub rise rise-1">
            Forward the slip when you place it. Slippery reads it, settles it, and keeps the
            record you would not have kept.
          </p>

          <div className="hero__cta rise rise-2">
            <Link href="/signup" className="btn btn--primary btn--lg">Start free for 14 days</Link>
            <Link href="/demo" className="btn btn--link">or see a real account</Link>
          </div>

          <p className="small dim rise rise-3 hero__fine">
            14 days or 35 slips. Card required, cancel in one tap.
          </p>

          {/*  The product, in a window.
               A screenshot floating on a page reads as a picture of software;
               the same thing in a frame reads as the software. It is chrome,
               so it is aria-hidden, and the demo inside it is the real
               component rather than an image of one. */}
          <div className="frame rise rise-3">
            <div className="frame__bar" aria-hidden="true">
              <span className="frame__dot" /><span className="frame__dot" /><span className="frame__dot" />
              <span className="frame__url">slippery.app</span>
            </div>
            <div className="frame__body">
              <SettleDemo />
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- the sequence */}
      <Sequence />

      {/* --------------------------------------------------------- capture */}
      <section className="sect" id="capture">
        <div className="wrap">
          <div className="two">
            <SectionHead
              badge="The whole idea"
              setup="A record you make afterwards"
              claim="is a record of your best days."
            >
              Capture happens at placement. A ledger written before you know how it went cannot
              become only the bets you wanted to remember.
            </SectionHead>
            <RowList
              rows={[
                { title: 'Forward the slip', sub: 'Telegram, straight from the bookmaker app. No typing.', icon: 'telegram', on: true },
                { title: 'Upload the screenshot', sub: 'Drag it in, or point a camera at a shop slip.', icon: 'camera' },
                { title: 'Type it in', sub: 'Singles through to a Lucky 63, legs and all.', icon: 'edit' },
                { title: 'Import the history', sub: 'A CSV from wherever you kept it, dry run first.', icon: 'upload' },
              ]}
            />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ the bet zoo */}
      <section className="sect" id="reader">
        <div className="wrap">
          <SectionHead
            badge="The reader"
            setup="Most trackers read a single."
            claim="This one reads a Lucky 15."
          >
            The bookmaker template is detected first, then the slip is parsed. Confidence is
            scored per field, not per slip.
          </SectionHead>
          <BetTypeWall />
          <div className="two" style={{ marginTop: 'var(--s7)' }}>
            <RowList
              rows={[
                { title: 'High confidence', sub: 'Saves silently. Nothing to confirm.', icon: 'check', on: true },
                { title: 'Medium confidence', sub: 'One targeted question. Never a whole form again.', icon: 'help' },
                { title: 'Low confidence', sub: 'Held out of the aggregates until you settle it.', icon: 'alert' },
              ]}
            />
            <div className="card">
              <p className="label">Flag a misread</p>
              <p style={{ marginTop: 'var(--s3)' }}>
                Every read carries a flag. Press it and the slip goes back for a human look, and
                the credit returns to your allowance.
              </p>
              <div className="card__foot">
                <Link href="/how" className="btn btn--ghost btn--sm">
                  How the reader works <Icon name="arrowRight" size={16} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------- bonus vs real */}
      <section className="sect" id="offers">
        <div className="wrap">
          <div className="two">
            <SectionHead
              badge="Money you won, money they gave you"
              setup="Nobody separates the two."
              claim="Your headline is two numbers."
            >
              Free bets, bonus funds and boosts are flagged as the slip is read. Up {money(118400)}
              means something different when {money(89000)} of it came from sign-up offers.
            </SectionHead>
            <SplitHeadline />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ settlement */}
      <section className="sect" id="settlement">
        <div className="wrap">
          <div className="two">
            <SectionHead
              setup="Six outcomes, and a slider."
              claim="Cash out included, twice if you like."
            >
              A bet is a container with a settlement ledger, not a row with a result. Anything
              uncertain asks rather than guesses.
            </SectionHead>
            <RowList
              rows={[
                { title: 'Won and lost', sub: '90 minutes only. Extra time and penalties never count.', icon: 'check', on: true },
                { title: 'Void', sub: 'Stake back, out of turnover and out of return.', icon: 'minus' },
                { title: 'Push and split', sub: 'Whole lines push. Quarter lines split the stake.', icon: 'split' },
                { title: 'Cash out, in eighths', sub: 'Of the stake still standing, repeatable.', icon: 'cash' },
              ]}
            />
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- social */}
      <section className="sect" id="groups">
        <div className="wrap">
          <div className="two">
            <div>
              <SectionHead
                badge="Slippers"
                setup="Ranked in units."
                claim="Never in pounds."
              >
                Units, so a bigger bankroll is not a bigger score. Stakes are never visible
                outside a group.
              </SectionHead>
              <Link href="/social" className="btn btn--ghost" style={{ marginTop: 'var(--s5)' }}>
                Groups and monthly leagues <Icon name="arrowRight" size={16} />
              </Link>
            </div>
            <div className="card">
              <div className="card__head">
                <p className="card__title">Thursday Coupon</p>
                <span className="pill">12 Slippers</span>
              </div>
              <ul>
                {[
                  { n: 'Rowan', u: '+18.4', s: '94%', p: 1 },
                  { n: 'Priya', u: '+11.2', s: '100%', p: 2 },
                  { n: 'You', u: '+6.9', s: '88%', p: 3 },
                  { n: 'Dev', u: '-2.1', s: '71%', p: 4 },
                ].map((r) => (
                  <li key={r.n} className="brow" style={{ gridTemplateColumns: '26px minmax(0,1fr) auto auto', gap: 'var(--s3)' }}>
                    <span className="small dim tnum">{r.p}</span>
                    <span className="brow__title">{r.n}</span>
                    <span className="small dim hide-xs">{r.s} slip backed</span>
                    <span className={`fig fig--s tnum ${r.u.startsWith('-') ? 'neg' : 'pos'}`}>{r.u}u</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- themes */}
      <section className="sect" id="themes">
        <div className="wrap">
          <SectionHead
            centred
            badge="Eight themes"
            setup="All of them dark."
            claim="Pick a theme."
          >
            Profit green measures 1.07 to 1 on beige, so there is no light mode. The two result
            colours are fixed, so none of the eight is green or red.
          </SectionHead>
          <ThemeStrip />
        </div>
      </section>

      {/* --------------------------------------------------------- pricing */}
      <section className="sect" id="price">
        <div className="wrap">
          <div className="two">
            <SectionHead
              badge="Pricing"
              setup="One price, both platforms."
              claim="£3.49 a month, £29.99 a year."
            >
              Free for 14 days or 35 slips. The yearly plan starts when the trial ends, and your
              ledger and export stay live even if the card does not.
            </SectionHead>
            <div className="rows">
              <div className="rowcard rowcard--on">
                <Icon name="check" size={20} className="rowcard__i" />
                <div className="grow">
                  <p className="rowcard__t">Yearly, £29.99</p>
                  <p className="rowcard__s">Struck through £34.99. Save £11.89 a year.</p>
                </div>
                <span className="pill pill--accent">Recommended</span>
              </div>
              <div className="rowcard">
                <Icon name="check" size={20} className="rowcard__i" />
                <div className="grow">
                  <p className="rowcard__t">Monthly, £3.49</p>
                  <p className="rowcard__s">Same product. Cancel any month.</p>
                </div>
              </div>
              <Link href="/pricing" className="btn btn--ghost btn--wide" style={{ marginTop: 'var(--s2)' }}>
                What is in it <Icon name="arrowRight" size={16} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- questions */}
      <section className="sect" id="questions">
        <div className="wrap">
          <SectionHead
            centred
            badge="Questions"
            setup="Six of them."
            claim="Answered without the marketing."
          />
          <div className="column column--wide" style={{ marginTop: 'var(--s6)' }}>
            <Faq items={TOP_QUESTIONS} />
            <p style={{ marginTop: 'var(--s5)', textAlign: 'center' }}>
              <Link href="/faq" className="btn btn--ghost btn--sm">
                The other ten <Icon name="arrowRight" size={16} />
              </Link>
            </p>
          </div>
        </div>
      </section>

      <Makers tipUrl={process.env.NEXT_PUBLIC_TIP_URL} />

      {/* --------------------------------------------------------- the end */}
      <section className="sect" style={{ paddingTop: 0 }}>
        <div className="wrap column" style={{ textAlign: 'center' }}>
          <p className="card__title">iOS and Android coming soon. The web app works today.</p>
          <p className="small muted" style={{ marginTop: 'var(--s2)' }}>
            Add it to your home screen and it behaves like one.
          </p>
          <p style={{ marginTop: 'var(--s5)' }}>
            <Link href="/waiting-list" className="btn btn--ghost btn--sm">Join the waiting list</Link>
          </p>
          <MadeBy />
        </div>
      </section>

      <StickyCta />
    </>
  );
}
