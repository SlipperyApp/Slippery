import type { Metadata } from 'next';
import { Faq } from '@/components/marketing/Faq';

export const metadata: Metadata = {
  title: 'Questions',
  description:
    'What Slippery does with a slip, how settlement decides, what happens to your data, and what it does not do.',
  alternates: { canonical: '/faq' },
  openGraph: {
    title: 'Questions about Slippery',
    description: 'What it does with a slip, how settlement decides, and what it does not do.',
    url: '/faq',
    images: [{ url: '/og?title=Questions&sub=What+it+does%2C+and+what+it+does+not', width: 1200, height: 630, alt: 'Questions about Slippery' }],
  },
};

const QA: { q: string; a: string }[] = [
  { q: 'Does Slippery place bets for me?', a: 'No, and it never will. Slippery does not accept bets, hold money, pay winnings or give tips. It is a record of bets you placed somewhere else. That is legally load bearing, not a disclaimer, and no feature will cross it.' },
  { q: 'Why capture at placement rather than at settlement?', a: 'Because a record you write afterwards is a record of the bets you felt like writing down. Nobody logs the £40 they lost on a Tuesday with the same enthusiasm as the Saturday accumulator that landed. Capturing at placement is the only version of this that tells you the truth.' },
  { q: 'Which bet types can it read?', a: 'Singles, doubles, trebles, accumulators, each way, Trixie, Patent, Yankee, Lucky 15, Canadian, Lucky 31, Heinz, Lucky 63, Goliath, bet builders, Asian quarter lines, cash outs, partial cash outs, free bets and boosts. The bookmaker template is detected before the slip is parsed, because generic text recognition falls over on a permed bet.' },
  { q: 'What happens when it cannot read a field?', a: 'It says which field, and asks. It never guesses a price. A missing price is visible to you and a wrong one is not, which is the whole reason for the rule.' },
  { q: 'What if it reads something wrong anyway?', a: 'Every read carries a flag button. Press it, the slip goes back for a human look, and the credit returns to your allowance.' },
  { q: 'How does it settle a bet?', a: 'Ninety minute scores only: extra time and penalties never count. Whole lines push, quarter lines split the stake, and handicaps follow the convention your bookmaker actually settles under rather than a single hardcoded rule. Anything uncertain asks you, because a wrong grade is worse than no grade.' },
  { q: 'Can it settle a cash out?', a: 'It cannot detect one, because a cash out is invisible from a results feed. So it is always your action. Full cash out, or partial in eighths of the stake still standing, repeatable as many times as you pulled.' },
  { q: 'Why are groups ranked in units and not pounds?', a: 'Because a bigger bankroll would otherwise be a bigger score, which measures nothing about betting. Units make a £5 stake and a £500 stake comparable. Outside a group only units are visible, never stakes.' },
  { q: 'I bet in euro. Does that work?', a: 'Yes. Pounds and euro are both first class: you pick one when you sign up and every figure in your account is in it, from a €25.00 stake to a €1,184.00 year. What Slippery will never do is add the two together into one net figure, because £1 and €1 are not the same amount and a total that pretends otherwise is worse than no total. One currency per account, and you can change it in Settings.' },
  { q: 'Is there a light theme?', a: 'No. It was built and rejected: profit green measures 1.07 to 1 against a beige page, which means the single most important colour in the product disappears. All eight themes are dark.' },
  { q: 'What does the free trial include?', a: 'Everything. Fourteen days or thirty five slips, whichever runs out first, and the app tells you which one is about to run out rather than making you count. A card is required, and the yearly plan starts automatically when the trial ends.' },
  { q: 'What happens if my payment fails?', a: 'One retry after three days. Two failures and the account goes read only: new slips, imports and the bot pause. Your ledger and your export stay fully live, and nothing is ever deleted for non payment.' },
  { q: 'Can I get my data out?', a: 'Always. CSV, JSON and PDF, in read only, and after cancelling. A betting record belongs to the person who kept it.' },
  { q: 'What happens to my slip images?', a: 'They are deleted after 90 days, or immediately if you ask. The bet stays; the image goes, and the gallery says so rather than showing you a broken thumbnail.' },
  { q: 'Does the bot read anything I have not sent it?', a: 'No. It reads photos and documents you send it, and only after your account is linked. An unlinked chat is asked for a code and the image is not read at all.' },
  { q: 'Is there an app?', a: 'iOS and Android are coming. The web app works today and adds to your home screen. There is no store badge on this site until there is a live listing, because both stores forbid drawing their artwork by hand.' },
  { q: 'I want to stop for a while.', a: 'Settings has a take a break control. It pauses notifications and the leagues without touching your ledger, and it does not ask you to confirm twice or try to talk you out of it.' },
];

export default function FaqPage() {
  return (
    <section className="sect">
      <div className="wrap">
        <span className="pill">Questions</span>
        <h1 className="sect__h" style={{ marginTop: 'var(--s4)', fontSize: 'clamp(30px, 6vw, 48px)' }}>
          <span className="setup">Sixteen questions.</span>
          <span>Answered without the marketing.</span>
        </h1>
        <div className="column column--wide" style={{ marginTop: 'var(--s7)', marginInline: 0 }}>
          <Faq items={QA} />
        </div>
      </div>
    </section>
  );
}
