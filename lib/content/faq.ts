/** The questions, in one place.
 *
 *  The landing page shows the first six and links on; /faq shows all seventeen.
 *  Two copies of an answer drift, and the drifted one is always the copy
 *  somebody actually reads. */

export type QA = { q: string; a: string };

export const QUESTIONS: QA[] = [
  { q: 'Does Slippery place bets for me?', a: 'No, and it never will. Slippery does not accept bets, hold money, pay winnings or give tips. It is a record of bets you placed somewhere else. That is legally load bearing, not a disclaimer, and no feature will cross it.' },
  { q: 'Why capture at placement rather than at settlement?', a: 'Because a record you write afterwards is a record of the bets you felt like writing down. Nobody logs the £40 they lost on a Tuesday with the same enthusiasm as the Saturday accumulator that landed. Capturing at placement is the only version of this that tells you the truth.' },
  { q: 'Does it connect to my bookmaker account?', a: 'No. UK and Irish bookmakers do not offer an account a third party can read, which is why the trackers that sync are American ones reading American sportsbooks. A slip is not the compromise it would be over there. A sync holds the accounts somebody chose to connect, so the record is still curated by the person it is about, one bookmaker at a time; a slip forwarded when you place it is the bet you placed, at the price you took, before either of us knew how it went.' },
  { q: 'Which bet types can it read?', a: 'Singles, doubles, trebles, accumulators, each way, Trixie, Patent, Yankee, Lucky 15, Canadian, Lucky 31, Heinz, Lucky 63, Goliath, bet builders, Asian quarter lines, cash outs, partial cash outs, free bets and boosts. The bookmaker template is detected before the slip is parsed, because generic text recognition falls over on a permed bet.' },
  { q: 'What happens when it cannot read a field?', a: 'It says which field, and asks. It never guesses a price. A missing price is visible to you and a wrong one is not, which is the whole reason for the rule.' },
  { q: 'What if it reads something wrong anyway?', a: 'Every read carries a flag button. Press it, the slip goes back for a human look, and the credit returns to your allowance.' },
  { q: 'How does it settle a bet?', a: 'Ninety minute scores only: extra time and penalties never count. Whole lines push, quarter lines split the stake, and handicaps follow the convention your bookmaker actually settles under rather than a single hardcoded rule. Anything uncertain asks you, because a wrong grade is worse than no grade.' },
  { q: 'What happens when a bookmaker changes its slip layout?', a: 'Which bookmaker a slip came from is decided before any field is read, from a table of the words each book prints on its own slips, matched against the text on the image rather than against what the reader thinks the book is. A redesign takes some of those words away, and the table then either scores too low to name anybody or leaves two books too close to separate. Both answers are the same answer: Unknown, listed with what it did see. Unknown costs you one question on the review screen, nothing reaches your ledger until you confirm it, and if a read is wrong anyway the flag button sends it for a human look and puts the credit back in your allowance.' },
  { q: 'Can I add a bet after it has settled?', a: 'Yes, and it is marked. Type it in or import a history and it counts toward your net, your turnover and your calendar, but it is recorded as typed rather than slip backed. Your profile shows what share of your record came off a slip, and a group can require slip backed bets only. An imported history is also left out of best day, worst day and the longest winning run, because a good day you had before using Slippery is not a fact about using Slippery. Nothing added after the off appears in what other Slippers are tracking.' },
  { q: 'Can it settle a cash out?', a: 'It cannot detect one, because a cash out is invisible from a results feed. So it is always your action. Full cash out, or partial in eighths of the stake still standing, repeatable as many times as you pulled.' },
  { q: 'Why are groups ranked in units and not pounds?', a: 'Because a bigger balance would otherwise be a bigger score, which measures nothing about betting. Units make a £5 stake and a £500 stake comparable. Outside a group only units are visible, never stakes.' },
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

/** The seven that decide whether somebody signs up: what it is, why it works
 *  that way, why it does not sync from a bookmaker account, what it can read,
 *  what it does when it cannot, and how it settles.
 *
 *  Seven rather than six since the bookmaker account question was written.
 *  It is the first thing anybody who has seen an American tracker asks, and
 *  answering it below the fold would have cost the landing page the
 *  settlement answer, which is the second. */
export const TOP_QUESTIONS: QA[] = QUESTIONS.slice(0, 7);
