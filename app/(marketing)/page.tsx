import Link from 'next/link';
import type { Metadata } from 'next';
import { Icon } from '@/components/Icon';
import { SettleDemo } from '@/components/SettleDemo';
import { SectionHead, RowList } from '@/components/MarketingChrome';
import { SplitHeadline } from '@/components/marketing/SplitHeadline';
import { WaveField } from '@/components/marketing/WaveField';
import { Makers, MadeBy } from '@/components/marketing/Makers';
import { StickyCta } from '@/components/marketing/StickyCta';
import { Reveal } from '@/components/marketing/Reveal';
import { QUESTIONS } from '@/lib/content/faq';
import { TRIAL_DAYS, TRIAL_SLIPS } from '@/lib/domain/trial';
import { spell } from '@/lib/format';

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
          {/*  The eyebrow says who this is for before the headline says what
               it does. A visitor who bets in Ireland and lands on a page that
               opens with a pun has to read three more lines to find out
               whether the product handles their bookmaker. */}
          <p className="eyebrow rise">Bet tracking for UK and Irish bettors</p>

          <h1 className="hero__h rise rise-1">
            Don&rsquo;t let your profit{' '}
            <span className="slipword">
              <span className="slipword__glow" aria-hidden="true">slip.</span>
              <span className="slipword__text">slip.</span>
              <span className="slipword__sheen" aria-hidden="true" />
            </span>
          </h1>

          {/*  AT PLACEMENT, WHICH IS NOT THE SAME AS BEFORE THE OFF.
               A version of this said the slip had to be in before the first
               whistle, and that is a rule the product does not have: an in
               play bet is placed in play and its slip is as good as any
               other. The line the product actually draws is whether a bet
               reached the record before its event started, and it draws it as
               a fact about that bet, on the Slips page and in the tracking
               feed, never as a limit on what you may send. */}
          <p className="hero__sub rise rise-2">
            Forward a slip to the bot when you place it, before you know how it went.
            Slippery reads it, settles it, keeps the record.
          </p>

          <div className="hero__cta rise rise-3">
            <Link href="/signup" className="btn btn--primary btn--lg">Start free for {TRIAL_DAYS} days</Link>
            {/*  The example account, and it says so. It called itself "a real
                 account", and the bets in it are generated: the Slips page
                 says as much on every tile, so the landing page was the one
                 surface claiming otherwise. */}
            <Link href="/demo" className="btn btn--link">or see the example account</Link>
          </div>

          <p className="small dim rise rise-4 hero__fine">
            {TRIAL_DAYS} days or {TRIAL_SLIPS} slips. Card required, cancel in one tap.
          </p>

          {/*  The product, on the page. It used to be in a browser window:
               a bar with three grey dots and slippery.app in mono, over a
               padded box holding the demo. Both halves of that were wrong on
               the page a stranger sees first. Three dots and an address bar
               are the most recognisable template element on the web, and
               they claimed something untrue about what is under them, which
               is an interactive settlement widget rather than a page at that
               address. It also drew a box around a box: the demo is a card
               already. What is left is the lift. See .herolift. */}
          <div className="herolift rise rise-4">
            <SettleDemo />
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- capture */}
      <section className="sect" id="capture">
        <div className="wrap">
          <div className="two">
            <SectionHead
              badge="The whole idea"
              setup="A record you make afterwards"
              claim="is a record of your best days."
            >
              Capture happens at placement, before the off or in play. A ledger written before you
              know how it went cannot become only the bets you wanted to remember.
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

      {/* ------------------------------------------------- bonus vs real */}
      <section className="sect" id="offers">
        <div className="wrap">
          <div className="two">
            <SectionHead
              badge="Money you won, money they gave you"
              setup="Nobody separates the two."
              claim="Your headline is two numbers."
            >
              {/*  The second sentence here read "Up £1,184.00 means something
                   different when £890.00 of it came from sign-up offers",
                   which is both figures on the card beside it, in prose, one
                   line above the card that prints them. */}
              Free bets, bonus funds and boosts are flagged as the slip is read.
            </SectionHead>
            <SplitHeadline />
          </div>
        </div>
      </section>

      {/*  WHAT LEFT THIS PAGE, and why it is not a loss.
           Groups and a league table, a live theme picker, and the top seven
           questions with their answers open. Each was a screen, each has a
           page of its own that says the same thing at length, and none of the
           three is what somebody deciding whether to try a profit and loss
           tracker is looking for. The header links two of them and the footer
           links all three. What is left is what it is, how a bet gets in,
           what the record then says, what it costs, and who made it. */}

      {/* ------------------------------------------- pricing and questions */}
      {/*  ONE SECTION, TWO COLUMNS. These were two centred sections stacked,
           each a heading, a line and a small ghost button, and with the block
           after them that made three centred stacks each ending in the same
           control: 643 pixels of a 1440 page to say two things and offer two
           links. Side by side they are what somebody still deciding asks
           next, which is what it costs and what it does not do. */}
      <section className="sect" id="price">
        <div className="wrap two">
          <div>
            <SectionHead
              setup="One price, both platforms."
              claim="£3.49 a month, £29.99 a year."
            >
              Free for {TRIAL_DAYS} days or {TRIAL_SLIPS} slips. Your ledger and export stay live
              even if the card does not.
            </SectionHead>
            <p style={{ marginTop: 'var(--s5)' }}>
              <Link href="/pricing" className="btn btn--ghost btn--sm">
                What is in it <Icon name="arrowRight" size={16} />
              </Link>
            </p>
          </div>
          <div id="questions">
            <SectionHead
              setup={`${spell(QUESTIONS.length)} questions.`}
              claim="Answered without the marketing."
            >
              The ones a spreadsheet cannot answer, and the ones this cannot either.
            </SectionHead>
            <p style={{ marginTop: 'var(--s5)' }}>
              <Link href="/faq" className="btn btn--ghost btn--sm">
                Read them <Icon name="arrowRight" size={16} />
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
          <p style={{ marginTop: 'var(--s5)' }}>
            <Link href="/waiting-list" className="btn btn--ghost btn--sm">Join the waiting list</Link>
          </p>
          <MadeBy />
        </div>
      </section>

      <StickyCta />
      <Reveal />
    </>
  );
}
