/* Static content: FAQs, plans, the bot preview, the legal pages, and the
   walkthrough player.
 *
 * These are the marketing surfaces, and they are seen by people with no
 * account and therefore no data. They used to read the signed-in ledger,
 * which meant a visitor saw an empty sparkline and a crash where a sample
 * slip should be. They now run on SAMPLE below, a fixed, self-contained
 * example, labelled as one on screen.
 *
 * The rule that matters: SAMPLE never reaches the app. The dashboard, the
 * ledger, the calendar and the stats read the real store and nothing else,
 * so no figure a user is shown about their own betting can come from here.
 */
import { $, $$, esc, setHTML, setText, RM } from './dom.js';
import { S } from './state.js';
import * as M from './money.js';
import { TODAY } from './data.js';

import { dowLabels, dowOffset } from './stats.js';
import { OUTCOME_ICON, outcomeGroup, ico, ALL_BOOKS } from './data.js';
import { BOOKPAGES } from './pages.js';
import { DEMO, DEMO_DAYS } from './sample.js';

/* ---------- the worked example ----------
   One slip followed end to end, plus the day it settled into. Internally
   consistent to the penny: stake x (odds - 1) is exactly the profit, so
   anyone checking the arithmetic in the walkthrough finds it correct. */
const SAMPLE = {
  slip: {
    event: 'Oskarshamns AIK v IFK Karlshamn',
    selection: 'Under 5.5 Goals',
    market: 'Over/Under',
    book: 'Paddy Power',
    odds: 1.25,
    stake: 30618,
    profit: 7655,
    outcome: 'won'
  },
  /* The day that slip landed in, as it would appear in a ledger. */
  day: [
    { event: 'Köln and Augsburg double', selection: 'Under 3.5 and Under 5.5',
      book: 'Paddy Power', odds: 1.40, stake: 6630, profit: 2652, outcome: 'won' },
    { event: 'SK Brann (W) v PAOK (W)', selection: 'Under 4.5 Goals',
      book: 'Paddy Power', odds: 1.17, stake: 22500, profit: -22500, outcome: 'lost' },
    { event: 'Treble, cashed out', selection: '3 legs',
      book: 'bet365', odds: 4.10, stake: 12000, profit: 4820, outcome: 'cash-profit' },
    { event: 'Slavia Prague v Sparta Prague', selection: 'Match result',
      book: 'Betfair', odds: 1.30, stake: 20000, profit: -20000, outcome: 'lost' }
  ],
  /* A month of running profit for the landing sparkline, in pence per day. */
  month: { 1: 21_400, 3: -8_600, 4: 17_900, 6: 49_100, 8: 16_800, 9: -10_600,
           11: 34_200, 12: 7_400, 14: -12_300, 15: 41_500, 17: 19_600, 19: 28_800,
           21: -6_900, 22: 33_100, 24: 12_700, 26: 26_500, 27: -9_100, 29: 38_300 }
};
SAMPLE.dayNet = SAMPLE.day.reduce((a, b) => a + b.profit, 0) + SAMPLE.slip.profit;
SAMPLE.monthNet = Object.values(SAMPLE.month).reduce((a, b) => a + b, 0);

/* Derived, not typed in a second time: the bookmaker split and the KPIs in
   the walkthrough are computed from SAMPLE.day + SAMPLE.slip, so they can
   never disagree with the rows shown two scenes earlier. */
SAMPLE.analysis = (() => {
  const all = SAMPLE.day.concat([SAMPLE.slip]);
  const byBook = new Map();
  let turnover = 0, profit = 0, oddsSum = 0, won = 0, graded = 0;
  for (const b of all) {
    byBook.set(b.book, (byBook.get(b.book) || 0) + b.profit);
    turnover += b.stake;
    profit += b.profit;
    oddsSum += b.odds;
    if (b.outcome === 'won' || b.outcome === 'lost') { graded++; if (b.outcome === 'won') won++; }
  }
  return {
    byBook: [...byBook.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4),
    winRate: graded ? Math.round(won / graded * 100) : 0,
    avgOdds: oddsSum / all.length,
    turnover,
    roi: turnover ? profit / turnover * 100 : 0
  };
})();

/* An example group standing. Units, never pounds. */
SAMPLE.group = [
  { n: 'You',     a: 'YO', un: 10000, v: SAMPLE.dayNet, me: true },
  { n: 'HB',      a: 'HB', un: 20000, v: 41_200 },
  { n: 'James',   a: 'JA', un: 5000,  v: 8_400 },
  { n: 'AuntJem', a: 'AJ', un: 2500,  v: 2_100 },
  { n: 'Priya',   a: 'PR', un: 1000,  v: -1_900 }
].sort((a, b) => b.v / b.un - a.v / a.un);

const HOME_FAQ = [
  ['Does it actually read my slip?', 'Forward a screenshot and the stake, odds, selection, bookmaker and result come off the image for you to confirm. If a number is not legible it is left blank rather than guessed.'],
  ['Can it settle bets on its own?', 'Standard markets settle themselves once the result is in. Anything it cannot grade with certainty comes to you instead, because a wrong grade is worse than no grade.'],
  ['What happens if a game is postponed or abandoned?', 'Postponed and cancelled games are voided and your stake comes back. Abandoned games come to you, because bookmakers settle those differently from each other.'],
  ['Does extra time count?', 'No. Everything settles on ninety minutes. If the ninety minute score is not in the feed, the bet is handed to you rather than settled on a score that includes extra time.'],
  ['Who can see my numbers?', 'Whoever you choose: every Slipper, only those you follow back, or none. Group members always see the units of everyone in that group.'],
  ['What is a unit?', 'Your standard stake. Units let groups rank people without anyone seeing how much money is involved.'],
  ['What does it cost?', 'Two weeks free with up to 35 slips in that window, then £3.49 a month or £29.99 a year.'],
  ['When is it on the App Store?', 'Not yet. It runs in your browser today and installs to your home screen from the share sheet, so it behaves like an app already, and the Telegram bot works now.'],
  ['What happens when the free trial ends?', 'Logging stops and everything you have already logged stays exactly where it is. Nothing is deleted and nothing is held hostage. Subscribe whenever you want it back.'],
  ['Can I bring history over from a spreadsheet?', 'Yes. Drop a CSV, an Excel export, a PDF statement or a screenshot of a profit screen into the import zone and it works out which it is. Dated rows land on their dates.'],
  ['Does imported history count as my bets?', 'Separately, and you choose. Settings has a toggle between the tracker count, which is only what Slippery has seen, and the lifetime count, which adds what you brought across. Imported figures are excluded from the pre-match split, because they have no slips behind them.'],
  ['What sports does it settle?', 'Football and tennis settle themselves. Racing does not: no feed we trust publishes finishing positions we can prove, so racing bets are handed back for you to settle rather than guessed at.'],
  ['Can I take a break?', 'Yes, and it is enforced on the server. Pick a length in Settings and logging stops until it is over. It can be extended but never shortened, because the point is that the decision is made by the version of you that is calm.'],
  ['What if the reader gets a slip wrong?', 'Every field is editable before you confirm, and nothing saves until you do. Selections can be added or removed. If a leg is missing because the screenshot cropped it, add it by hand.'],
  ['Can I get my data out?', 'CSV or JSON, from Settings, whenever you like. Deleting the account removes the bets, the stored slip images, your groups and the account itself.'],
  ['Is my betting record private?', 'By default only people you follow back can see your figures, and you can set it to public or to nobody. Group members always see units rather than stakes, so nobody learns what you bet.']
];

const HELP_FAQ = [
  ['Why could a slip not be read?', 'Slippery never guesses at numbers it cannot see, so it asks for a clearer photo. Crop to the slip, avoid glare, and keep the stake, odds and result in frame.'],
  ['What does the pace marker mean?', 'The pale line on the target bar shows how far through the period you are. If the green bar is past it, you are ahead of pace.'],
  ['What is a unit?', 'A unit is your standard stake, set in Settings. Units let you compare with other people without anyone seeing the money.'],
  ['Who can see my numbers?', 'Public means any Slipper who finds you. Friends only means Slippers you follow back. Private means none. Group members always see units of everyone in that group.'],
  ['Why can I not change my display name?', 'Names are permanent so a record always belongs to the same person, and nobody can take a name someone else built a history under.'],
  ['Why has the same bet appeared twice?', 'Slippery flags slips that settle identically, such as away goals under 0.5 and BTTS No, and offers to consolidate them so your numbers are not counted twice.'],
  ['How do I correct a slip Slippery misread?', 'Every field on an uploaded slip is editable before you confirm it, and nothing is saved until you do. A bet already in your ledger can be settled by hand from the running list.']
];

/* The three plans, defined once.
 *
 * The pricing page, the signup chooser and the Settings plan row all read
 * this array, so there is no second list to drift out of step.
 *
 * Monthly and yearly used to carry the same feature list with a different
 * number on top, which makes the yearly price look like a worse deal than it
 * is. Each tier now adds something the one below does not have, and the
 * additions are things the product actually does.
 */
export const PLANS = [
  {
    id: 'free', name: 'Free trial', blurb: 'Two weeks, on us.',
    price: '£0', per: '', note: '14 days or 35 slips, whichever runs out first',
    adds: 'The whole product, nothing held back.',
    features: [
      '35 slips',
      'Calendar, ledger and analytics',
      'Telegram bot and slip reading',
      'Cancel before it ends and pay nothing'
    ]
  },
  {
    id: 'monthly', name: 'Monthly', blurb: 'Pay as you go.',
    price: '£3.49', per: ' a month', note: 'Cancel any time',
    adds: 'Everything in the trial, plus:',
    features: [
      'Unlimited slips',
      'Groups and followers',
      'CSV import and export'
    ]
  },
  {
    id: 'yearly', name: 'Yearly', blurb: 'The same thing, cheaper.',
    price: '£29.99', per: ' a year', note: 'Works out at £2.50 a month',
    adds: 'Everything in monthly, plus:',
    flag: 'Save £11.89',
    featured: true,
    features: [
      'Two and a half months free',
      'Unlimited history import',
      'Verification review',
      'Priority slip reading'
    ]
  }
];

export const planById = id => PLANS.find(p => p.id === id) || PLANS[0];

/* ============================================================
   THE LEGAL PAGES
   ============================================================
   Seventeen numbered sections each, matching the structure of a policy
   written for a product at this stage. The structure is the point: a
   two-paragraph privacy policy for a product that stores photographs of
   people's betting accounts is not a policy, it is a gesture.

   Every processor named here is one this deployment actually uses. The
   temptation with a template is to inherit its processor list, which
   would have us naming Supabase, Resend and OpenRouter, none of which we
   run. Naming a processor you do not use is a false statement about where
   somebody's data goes.

   The wording still needs a solicitor. What it should not need is a
   second pass to find out what the system does, which is why retention
   periods and lawful bases are written against the code rather than left
   as blanks.
   ============================================================ */
const TERMS = [
  ['h2', '1. Who we are and what this covers'],
  ['p', 'Slippery is a bet recording and analytics tool operated from the United Kingdom. These terms cover the website, the installable web app and the Telegram bot @SlipperyAppBot. By creating an account you agree to them.'],

  ['h2', '2. What Slippery is not'],
  ['p', 'Slippery is not a bookmaker, a betting exchange, a broker or a tipping service. It does not accept bets, hold funds, pay winnings, take a share of a stake or offer advice on what to bet. It holds no Gambling Commission licence because it carries out no licensable activity. Nothing shown in the product is a recommendation to place a bet.'],

  ['h2', '3. Age, and what this is for'],
  ['p', 'Strictly for adults. Slippery is a tracker for people who already bet. It does not take bets and never handles money. If betting has stopped being fun, free and confidential help is at BeGambleAware.org.'],
  ['p', 'You must be 18 or over. You confirm this when you create an account. Where we have reason to believe an account holder is under 18 we will suspend the account and delete the data on it.'],

  ['h2', '4. Your account'],
  ['ul', [
    'You are responsible for your password and for the link code that connects the Telegram bot to your account.',
    'Display names are permanent, so that a betting record always belongs to the same person and nobody can take a name someone else built a history under.',
    'One account per person. Accounts may not be shared or transferred.'
  ]],

  ['h2', '5. The free trial'],
  ['p', 'The trial runs for 14 days or 35 slips, whichever runs out first. When it ends, logging new bets stops and everything already logged stays exactly where it is. Nothing is deleted and nothing is held back from export.'],

  ['h2', '6. Paid plans, renewal and cancellation'],
  ['ul', [
    'Paid plans renew automatically until cancelled.',
    'Cancelling stops the next renewal and keeps access until the end of the period already paid for.',
    'UK and EU consumers keep their statutory 14 day cancellation right. Starting to use a paid plan within that period does not remove it, but we may charge for what has been used.',
    'Prices may change with at least 30 days notice by email, and a change never applies to a period already paid for.'
  ]],
  ['p', 'Card payments are not yet switched on. The payment screen in the product is a placeholder and takes no card details.'],

  ['h2', '7. Automatic reading of slips'],
  ['p', 'Slippery reads images of bet slips automatically. It is built to leave a field blank rather than guess at it, and every field is editable before you confirm. A reading may still be wrong. Checking a bet against the slip it came from remains yours to do.'],

  ['h2', '8. Automatic settlement'],
  ['p', 'Standard football and tennis markets settle themselves against public results sources. The rule the engine follows is that a wrong grade is worse than no grade, so anything it cannot prove is handed back to you rather than settled. Settlement is on the 90 minute score; extra time and penalties never count. Horse racing is never settled automatically.'],
  ['p', 'Results sources are third parties we do not control and do not pay. They can be wrong, late or unreachable. A figure Slippery displays is a record of what you told it plus what a public source reported, and it is not a statement of what your bookmaker owes you.'],

  ['h2', '9. Your content'],
  ['p', 'You keep ownership of the slips you upload and the records you create. You give us permission to store and process them only so far as is needed to run the service for you. We do not use your slips or your betting records to train any model.'],

  ['h2', '10. Acceptable use'],
  ['ul', [
    'Do not upload slips that are not yours.',
    'Do not attempt to read another user\'s figures, or to work around a privacy setting or a group\'s unit display.',
    'Do not present Slippery output as a verified or audited record when it is not.',
    'Do not use automated tools to scrape the service or to place load on it beyond ordinary use.',
    'Do not use Slippery to run a paid tipping service without saying plainly that the figures are self reported.'
  ]],

  ['h2', '11. Groups and rankings'],
  ['p', 'Groups rank members in units rather than in money, so nobody learns anyone else\'s stake size. Joining a group means the other members can see your unit figures for that group. Leaving a group stops that immediately. A group is not a competition with a prize and there is nothing to win in it.'],

  ['h2', '12. Taking a break'],
  ['p', 'You can stop your own account logging bets for a fixed period. A break is enforced on the server, and it can be extended but never shortened, including by us. That is deliberate: the decision belongs to the version of you that made it.'],

  ['h2', '13. Availability'],
  ['p', 'We aim to keep the service running and give no uptime guarantee. Maintenance, a failure at a hosting provider or a results source going dark can all interrupt it. Nothing here obliges us to keep any particular feature, results source or integration running.'],

  ['h2', '14. Suspension and ending your account'],
  ['p', 'You can delete your account at any time from Settings. Deletion removes your bets, your stored slip images, your group memberships and the account itself. We may suspend or close an account that breaks these terms, and where we do we will say why unless the law prevents it.'],

  ['h2', '15. Liability'],
  ['p', 'Nothing here limits liability for death or personal injury caused by negligence, for fraud, or for anything else that cannot lawfully be limited. Subject to that, and to the extent the law allows, the service is provided as it is, and we are not liable for gambling losses, for bets placed or not placed, for a bookmaker settling differently from Slippery, or for indirect or consequential loss. Where liability cannot be excluded it is limited to the amount you have paid us in the previous 12 months.'],

  ['h2', '16. Changes to these terms'],
  ['p', 'We will give at least 30 days notice by email of a change that materially affects you. Continuing to use the service after a change takes effect means you accept it. If you do not, you can cancel and export everything first.'],

  ['h2', '17. Law and getting in touch'],
  ['p', 'These terms are governed by the law of England and Wales, and the courts of England and Wales have exclusive jurisdiction. Consumers keep the protection of the mandatory law where they live. Questions go to the support address on the help page.']
];

const PRIVACY = [
  ['h2', '1. Who is responsible for your data'],
  ['p', 'Slippery is the data controller for the personal data described here, under the UK GDPR and the Data Protection Act 2018. Registration with the Information Commissioner\'s Office is required before public launch and is outstanding.'],

  ['h2', '2. What we collect'],
  ['ul', [
    'Account: email address, a hashed password, display name, the date you signed up and whether the email is verified.',
    'Betting records: stake, odds, selection, market, bookmaker, competition, result, profit or loss, the date placed and the capture stage.',
    'Slip images: photographs, screenshots and PDFs of bet slips and profit screens that you upload or forward.',
    'Telegram: your Telegram user id and chat id, only if you link the bot.',
    'Preferences: theme, unit size, currency, privacy setting, counting mode and any break you have set.',
    'Social: the groups you belong to, the Slippers you follow, and who follows you.',
    'Technical: IP address and user agent, held transiently for rate limiting and for keeping the service secure.'
  ]],
  ['p', 'We do not collect your bookmaker login details, your card details, your date of birth, your location or a device identifier.'],

  ['h2', '3. Slip images, specifically'],
  ['p', 'A slip image is the most sensitive thing we hold. It can show your bookmaker account, your stake, a reference number and sometimes your name. It is sent to an automated reading service to extract the fields, then stored so a bet can be checked against the image it came from. It is never shown to another user and never used to train anything. Settings has a one tap purge that deletes every stored image and keeps the bets.'],

  ['h2', '4. Why we process it, and our lawful basis'],
  ['ul', [
    'Running your account and showing you your records: performance of our contract with you.',
    'Reading slips and settling bets: performance of our contract with you.',
    'Sending a verification code, a password reset and service notices: performance of our contract with you.',
    'Keeping the service secure, rate limiting and preventing abuse: our legitimate interests in a working, unabused service.',
    'Groups, following and rankings: performance of our contract, and only for the groups you join.',
    'Keeping records of payments and cancellations, once payments are live: our legal obligation.'
  ]],
  ['p', 'We do not process your data for advertising and we do not profile you.'],

  ['h2', '5. Is a betting record special category data'],
  ['p', 'We treat it as sensitive whether or not the law classes it so. It reveals financial behaviour and it can reveal a gambling problem. That is why nothing is public by default, why groups show units rather than money, and why the images have their own purge control.'],

  ['h2', '6. Who processes it for us'],
  ['ul', [
    'Neon, Inc. (US and EU) hosts the Postgres database. It holds everything in section 2 except the images sent for reading. neon.tech/privacy-policy',
    'Vercel Inc. (US) hosts the site and the serverless functions. It sees requests in transit, including IP addresses, and holds no betting data at rest. vercel.com/legal/privacy-policy',
    'Anthropic PBC (US) reads slip images and returns the extracted fields. It receives the image and nothing else, no account identifier and no email address. Data sent through the API is not used to train models. anthropic.com/legal/privacy',
    'Google LLC (US) delivers outbound email over Gmail SMTP. It sees the recipient address and the message, which contains a verification or reset code and nothing about your bets. policies.google.com/privacy',
    'Telegram FZ-LLC (UAE) delivers bot messages, only if you link the bot. It sees the messages you send the bot, including any slip image you forward to it. telegram.org/privacy'
  ]],
  ['p', 'Results sources are read, not sent to. FlashScore, football-data.co.uk, ESPN, SofaScore and football-data.org receive a request for a fixture list and receive nothing about you.'],

  ['h2', '7. International transfers'],
  ['p', 'Neon, Vercel, Anthropic and Google are United States companies and Telegram is registered in the United Arab Emirates. Transfers rely on the UK International Data Transfer Addendum to the EU Standard Contractual Clauses, or on a UK adequacy decision where one applies. The database region is chosen in the EEA.'],

  ['h2', '8. How long we keep it'],
  ['ul', [
    'Slip images: 90 days from upload, then deleted automatically. Sooner if you delete the bet, purge the images or close the account.',
    'Betting records: until you delete the bet or close the account.',
    'Account details: until you close the account.',
    'Verification and reset codes: 10 minutes, then they stop working and are removed.',
    'Sessions: 30 days, or until you log out.',
    'Rate limiting records: 24 hours.',
    'Payment and cancellation records, once payments are live: 6 years, because tax law requires it.',
    'Backups: overwritten within 30 days of a deletion.'
  ]],

  ['h2', '9. What we never do'],
  ['p', 'We do not sell your data. We do not share your betting figures with bookmakers, advertisers, credit reference agencies, insurers or employers. We run no advertising network, no analytics product and no third party script on the page.'],

  ['h2', '10. What other users can see'],
  ['ul', [
    'Private, the default: nobody sees your figures.',
    'Followers: only Slippers you follow back.',
    'Public: any signed in Slipper who finds you.',
    'Group members always see your unit figures for that group, whatever your setting. They never see your stake size.'
  ]],

  ['h2', '11. Security'],
  ['ul', [
    'Passwords are hashed with scrypt and are never stored or logged in a readable form.',
    'The session cookie is httpOnly, Secure and SameSite, so no script on the page can read it.',
    'Every query is scoped to your account by the database rather than by the browser.',
    'Slip images sit in the database beside the bet, not in a public bucket with a guessable URL.',
    'Secrets are held as environment variables and are never written to a file, a log or a message.'
  ]],

  ['h2', '12. Cookies and similar technologies'],
  ['table', [
    ['Technology', 'Purpose', 'Type'],
    ['Session cookie', 'Keeps you signed in between visits', 'Strictly necessary'],
    ['Theme preference', 'Remembers the colour scheme you chose', 'Strictly necessary'],
    ['Service worker cache', 'Serves the app offline and on a slow connection', 'Strictly necessary']
  ]],
  ['p', 'All three are strictly necessary, so no consent banner is required. There is no advertising, analytics or tracking cookie of any kind. Fonts are served from our own domain rather than a font network, so no third party sees your visit.'],

  ['h2', '13. Automated decision making'],
  ['p', 'Reading a slip and grading a bet are automated. Neither produces a legal or similarly significant effect: a grade changes a number on your own dashboard and can be corrected by you at any time. Nothing about your account, your access or your price is decided automatically.'],

  ['h2', '14. Your rights'],
  ['ul', [
    'Access a copy of your data. Export to CSV or JSON is self service in Settings.',
    'Correct anything wrong. Every field on a bet is editable.',
    'Delete your data. Account deletion is self service and removes bets, images, groups and the account.',
    'Restrict or object to processing based on legitimate interests.',
    'Portability, in a machine readable format, which the JSON export is.',
    'Withdraw consent where processing relies on it, which today is only the Telegram link.'
  ]],
  ['p', 'We answer within one month. There is no charge unless a request is manifestly unfounded or excessive.'],

  ['h2', '15. Complaints'],
  ['p', 'If we have not got something right, tell us first. You can also complain to the Information Commissioner\'s Office at ico.org.uk, or to the supervisory authority where you live.'],

  ['h2', '16. Children'],
  ['p', 'The service is not for anyone under 18. We do not knowingly collect data from under 18s, and where we learn that we have, we delete it.'],

  ['h2', '17. Changes to this policy'],
  ['p', 'Material changes are notified by email at least 30 days before they take effect. The date at the top of this page is when it last changed.']
];

export function renderStatic() {
  renderSections();
  renderTail();
  setHTML('homeFaq', HOME_FAQ.map(f =>
    '<details class="card faq"><summary>' + esc(f[0]) + '</summary><p>' + esc(f[1]) + '</p></details>').join(''));
  setHTML('helpFaq', HELP_FAQ.map(f =>
    '<details class="card faq"><summary>' + esc(f[0]) + '</summary><p>' + esc(f[1]) + '</p></details>').join(''));

  setHTML('planList', PLANS.map(p =>
    '<div class="card plan reveal' + (p.featured ? ' featured' : '') + '">' +
    (p.flag ? '<div class="flag">' + esc(p.flag) + '</div>' : '') +
    '<div class="nm">' + esc(p.name) + '</div><div class="desc">' + esc(p.blurb) + '</div>' +
    '<div class="price">' + esc(p.price) + '<small>' + esc(p.per) + '</small></div>' +
    '<div class="note">' + esc(p.note) + '</div>' +
    '<p class="planadds">' + esc(p.adds) + '</p><ul>' +
    p.features.map(f => '<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>' + esc(f) + '</li>').join('') +
    /* Monthly and yearly carry the same button treatment. A ghost button
       next to a solid one reads as "this one is the wrong choice", and
       neither of them is: the yearly card is already marked out by its
       flag and its border, which is enough. */
    '</ul><button class="btn ' + (p.id === 'free' ? 'ghost' : 'primary') + ' full" ' +
    (p.id === 'free' ? 'data-nav="setup"' : 'data-pay="' + p.id + '"') + '>' +
    (p.id === 'free' ? 'Start free' : 'Choose ' + esc(p.name.toLowerCase())) + '</button></div>').join(''));

  /* Three row shapes, because a policy needs three. A cookies table
     written as a paragraph is a cookies table nobody can check, and the
     reference pack is right that it should be a table with Technology,
     Purpose and Type as columns. It scrolls inside its own container: a
     three column table at 320px would otherwise push the page sideways,
     which is the overflow bug this codebase already learned once. */
  const legal = rows => rows.map(([tag, body]) => {
    /* A processor's privacy policy has to be reachable, not just named:
       "every third-party processor named with its purpose, the data
       shared, and a link to its privacy policy". A bare domain printed as
       text is a citation, not a link. Anything that looks like a bare
       host and path at the end of a bullet becomes one, after escaping. */
    const link = s => esc(s).replace(
      /\b((?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[\w./-]*)?)$/,
      '<a href="https://$1" target="_blank" rel="noopener">$1</a>');
    if (tag === 'ul') return '<ul>' + body.map(li => '<li>' + link(li) + '</li>').join('') + '</ul>';
    if (tag === 'table') {
      const [head, ...rest] = body;
      /* tabindex="0" on the scroll container, or a keyboard user cannot
         reach the columns that are off screen at 320px. axe calls this
         scrollable-region-focusable and it is right to. */
      return '<div class="legaltable" tabindex="0" role="group" aria-label="Cookies and similar technologies"><table><thead><tr>' +
        head.map(h => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' +
        rest.map(r => '<tr>' + r.map(c => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('') +
        '</tbody></table></div>';
    }
    return '<' + tag + '>' + esc(body) + '</' + tag + '>';
  }).join('');
  setHTML('termsBody', legal(TERMS));
  setHTML('privacyBody', legal(PRIVACY));

  renderHeroHeading();
  renderPreview();
  renderBotChat();
  renderGuide();
}

function renderHeroHeading() {
  const words = ['Don\'t', 'let', 'your', 'profit'];
  setHTML('heroHeading',
    words.map(w => '<span class="hero-word">' + w + '</span>').join(' ') +
    ' <span class="hero-word"><span class="slipword" id="slipWord">slip.</span></span>');
}

function renderPreview() {
  /* The hero window runs on the same fabricated sample as the demo page,
     not on the visitor's numbers, because they have none yet and inventing
     some would be the exact dishonesty this product exists to stop. The
     caption under the window says whose numbers these are and links to
     where they are explained. */
  const stat = (k, v, tone) =>
    '<div class="ch-stat"><span class="k">' + esc(k) + '</span>' +
    '<span class="v ' + (tone || '') + '">' + v + '</span></div>';
  setHTML('chromeStats',
    stat('This month', M.signed(DEMO.month.profit), M.tone(DEMO.month.profit)) +
    stat('Return', (DEMO.total.roi >= 0 ? '+' : '\u2212') +
      Math.abs(DEMO.total.roi).toFixed(1) + '%', M.tone(DEMO.total.profit)) +
    stat('Running', M.money0(DEMO.pendingStake)));
  setText('chromeRange', 'Last ' + DEMO_DAYS + ' days');

  /* One point per settled bet is 480 segments in a 300 unit wide box, so
     it is sampled down to something a 66px tall sparkline can actually
     resolve. Sampling rather than smoothing: the shape stays true. */
  const pts = DEMO.curve.filter((_, i) => i % 8 === 0).concat(DEMO.curve.slice(-1));
  const max = Math.max(...pts, 1), min = Math.min(...pts, 0);
  const span = (max - min) || 1;
  const coords = pts.map((v, i) => {
    const x = 4 + (i / Math.max(pts.length - 1, 1)) * 292;
    const y = 60 - ((v - min) / span) * 52;
    return x.toFixed(0) + ',' + y.toFixed(0);
  });
  /* Two points minimum, or the path is "M12,30" and the browser logs an
     invalid-d error for a line that cannot be drawn. */
  const line = coords.length > 1 ? 'M' + coords.join(' L') : '';
  $('previewLine').setAttribute('d', line);
  $('previewArea').setAttribute('d', line ? line + ' L296,66 L4,66 Z' : '');

  const bands = DEMO.byBand.slice().sort((a, b) => b.roi - a.roi);
  setHTML('chromeTop', bands.slice(0, 3).map(b =>
    '<div class="ch-row"><span>' + esc(b.label) + '</span>' +
    '<b class="' + M.tone(b.profit) + '">' +
    (b.roi >= 0 ? '+' : '\u2212') + Math.abs(b.roi).toFixed(1) + '%</b></div>').join(''));

  setHTML('previewRows', DEMO.recent.slice(0, 4).map(b =>
    '<div class="ch-row"><span>' + esc(b.event) + '</span>' +
    '<b class="' + M.tone(b.profit) + '">' + M.signed(b.profit) + '</b></div>').join(''));
}

function renderBotChat() {
  const slip = SAMPLE.slip;
  const day8 = SAMPLE.day;
  const net = SAMPLE.dayNet;
  const staked = day8.reduce((a, b) => a + b.stake, 0) + slip.stake;
  const pad = (s, n) => (s + '                    ').slice(0, n);
  setHTML('botChat',
    /* What you forward is the bookmaker's PLACED receipt. Capture happens
       before the result exists, that is the locked core idea, and a
       preview showing a forwarded winner teaches the opposite habit. */
    '<div class="bubble outgoing" style="padding:0;overflow:hidden;width:66%"><div style="background:#fff;color:#0b1220;padding:12px">' +
    '<div style="color:#1e293b;font-weight:700;font-size:11px;letter-spacing:.08em">BET PLACED</div>' +
    '<div style="font-weight:700;font-size:12px;margin-top:6px">' + esc(slip.selection) + '</div>' +
    '<div style="font-size:10.5px;color:#475569;margin-top:3px">' + esc(slip.event) + '</div>' +
    '<div style="font-size:10.5px;color:#475569">Stake £' + (slip.stake / 100).toFixed(2) +
      ' at ' + slip.odds.toFixed(2) + '</div>' +
    '<div style="font-size:10.5px;color:#475569">To return £' +
      ((slip.stake + slip.profit) / 100).toFixed(2) + '</div></div></div>' +

    '<div class="bubble incoming slim">Reading your slip…</div>' +

    '<div class="bubble incoming">' +
    '<div class="m" style="font-size:10.5px;color:var(--s);letter-spacing:.07em;text-transform:uppercase;margin-bottom:9px">Slip read, single</div>' +
    kv('Selection', esc(slip.selection)) + kv('Odds', slip.odds.toFixed(2)) +
    kv('Stake', M.money(slip.stake)) + kv('Returns', M.money(slip.stake + slip.profit)) +
    kv('Bookmaker', esc(slip.book)) +
    kv('Status', '<span style="color:var(--a)">Tracking</span>') +
    '<div style="display:flex;gap:8px;margin-top:11px">' +
    '<span style="flex:1;text-align:center;font-size:12.5px;padding:9px 0;border-radius:9px;background:linear-gradient(135deg,var(--p),var(--s));color:#08111f">Confirm</span>' +
    '<span style="flex:1;text-align:center;font-size:12.5px;padding:9px 0;border-radius:9px;background:var(--c1);border:1px solid var(--e1)">Edit</span></div></div>' +

    /* Settlement arrives later, from the results feed. Showing it as a
       separate, later message is the honest shape of the product. */
    '<div class="bubble incoming slim">Full time. ' + esc(slip.selection) + ' <b class="pos">won</b>, ' +
      M.signed(slip.profit) + '.</div>' +

    '<div class="bubble incoming slim">Logged. Today: <b class="' + M.tone(net) + '">' +
      M.signed(net) + '</b> across ' + day8.length + ' bets.</div>' +

    '<div class="bubble incoming"><div class="monoblock">8 Aug 2026\n\n' +
    day8.map(b => pad(({ 'won': 'WON', 'lost': 'LOST', 'void': 'VOID' })[b.outcome] || 'CASH', 6) +
      pad(b.event.slice(0, 18), 20) + M.signed(b.profit)).join('\n') +
    '\n\nNet ' + M.signed(net) + ', staked ' + M.money(staked) + '</div></div>');
}
const kv = (k, v) => '<div class="kvline"><span>' + k + '</span><b>' + v + '</b></div>';

/* ---------------- the how-it-works guide ----------------
   Five steps, each with the panel it describes, all on screen at once.
   This replaces a fake video player with a scrubber, a clock and six
   chapters: there was nothing to play, so the controls were decoration
   that made the reader wait for information a screenshot gives instantly.
   It is also one page instead of three, the Telegram preview and the
   landing section told the same story. */
const STEPS = [
  ['Place the bet, then forward the slip',
   'Screenshot your bookmaker\'s confirmation and send it to the bot. Pre-match, in-play or already settled, all three work, and capturing at placement is what stops a tracker quietly becoming a highlight reel.'],
  ['Slippery reads it',
   'Stake, odds, selection, bookmaker and every leg come off the image. Anything it cannot read is left blank for you to type rather than guessed at.'],
  ['It tracks and settles itself',
   'Standard markets grade on the 90-minute score as soon as the result is in. Anything ambiguous, a bet builder, an abandoned game, a quarter-line inside an acca, comes back to you instead of being guessed.'],
  ['Your calendar fills in',
   'Every settled day turns green or red, scaled by how big the day was. Tap a day to see the slips behind the number, or switch to the whole year.'],
  ['See what actually pays',
   'Profit split by bookmaker, market and tipster for whichever period you are on. Start a group and everyone is ranked in units, so nobody sees anyone\'s stake sizes.']
];

function panel(i) {
  const days = SAMPLE.month;
  const slip = SAMPLE.slip;

  /* Scene 0 is a chat, so it anchors to the bottom the way a real one
     does. The rest are cards and sit centred. */
  if (i === 0) return { top: ['Telegram', ''], cls: 'chat', html:
    /* The forwarded image is a BET PLACED receipt, not a winning one.
       Capture-at-placement is the locked core idea, and a walkthrough that
       shows someone forwarding a settled winner demonstrates precisely the
       habit the product exists to break. */
    '<div style="background:#fff;color:#0b1220;border-radius:9px;padding:9px;align-self:flex-end;max-width:80%;display:flex;flex-direction:column;gap:2px">' +
    '<b style="font-size:9.5px;color:#1e293b;letter-spacing:.08em">BET PLACED</b>' +
    '<span style="font-size:8.5px;color:#334155">' + esc(slip.selection) + '</span>' +
    '<span style="font-size:8.5px;color:#334155">' + esc(slip.event) + '</span>' +
    '<span style="font-size:8.5px;color:#334155">Stake ' + M.money(slip.stake) +
      ' at ' + slip.odds.toFixed(2) + '</span>' +
    '<span style="font-size:8.5px;color:#334155">To return ' + M.money(slip.stake + slip.profit) + '</span></div>' +
    '<div style="font-size:9.5px;background:var(--c2);border-radius:8px;padding:7px 10px;align-self:flex-start;max-width:88%;color:var(--t1)">Reading your slip…</div>' +
    '<p style="font-size:9px;color:var(--t2);text-align:center;padding-top:4px">One slip, no typing</p>' };

  if (i === 1) return { top: ['Slip read, single', ''], html:
    '<div style="background:var(--c2);border:1px solid var(--e1);border-radius:9px;padding:9px">' +
    srow('Selection', esc(slip.selection)) + srow('Odds', slip.odds.toFixed(2)) +
    srow('Stake', M.money(slip.stake)) + srow('Returns', M.money(slip.stake + slip.profit)) +
    srow('Bookmaker', esc(slip.book)) +
    /* No result here. The bet has only just been placed; the grade arrives
       at full time, from the results feed, not from the image. */
    srow('Status', '<span style="color:var(--a)">Tracking, kicks off 16:00</span>') +
    '<div style="display:flex;gap:5px;margin-top:7px">' +
    '<span style="flex:1;text-align:center;font-size:9px;padding:5px 0;border-radius:6px;background:linear-gradient(135deg,var(--p),var(--s));color:#08111f">Confirm</span>' +
    '<span style="flex:1;text-align:center;font-size:9px;padding:5px 0;border-radius:6px;background:var(--c1);border:1px solid var(--e1)">Edit</span></div></div>' +
    '<p style="font-size:9px;color:var(--t2);text-align:center;padding-top:4px">You confirm before anything saves</p>' };

  if (i === 2) {
    const dim = new Date(TODAY.year, TODAY.month + 1, 0).getDate();
    const first = dowOffset(new Date(TODAY.year, TODAY.month, 1), S.weekStart);
    const max = Object.keys(days).reduce((a, k) => Math.max(a, Math.abs(days[k])), 0) || 1;
    let cells = '';
    for (let q = 0; q < first; q++) cells += '<i style="visibility:hidden"></i>';
    for (let q = 1; q <= dim; q++) {
      const v = days[q];
      let st = '';
      if (v !== undefined) {
        const r = Math.min(1, Math.abs(v) / max);
        const rgb = v > 0 ? '134,239,172' : '252,165,165';
        st = 'background:rgba(' + rgb + ',' + (0.12 + r * 0.26).toFixed(2) +
             ');border-color:rgba(' + rgb + ',' + (0.28 + r * 0.3).toFixed(2) + ')';
      } else if (q < TODAY.day) st = 'background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.08)';
      else st = 'border:1px dashed rgba(255,255,255,.1)';
      cells += '<i style="' + st + '">' + (v !== undefined ? M.compact(v).replace(/,/g, '') : '') + '</i>';
    }
    /* The example's own total and a round example target, so the bar,
       the percentage and the 'ahead of pace' line all agree with the
       cells above them. */
    const total = SAMPLE.monthNet, target = 250_000;
    return { top: ['Net this month', M.signed(total)], html:
      '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">' +
        dowLabels(S.weekStart).map(x => '<span style="text-align:center;font-family:var(--fm);font-size:6.5px;color:var(--t3)">' + x.charAt(0) + '</span>').join('') +
      '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px" class="scenegrid">' + cells + '</div>' +
      '<div style="margin-top:3px"><div style="position:relative;height:5px;border-radius:3px;background:rgba(255,255,255,.07);overflow:hidden">' +
      '<span style="display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,var(--p),var(--pos));width:' +
      (Math.max(0, Math.min(1, total / target)) * 100).toFixed(0) + '%"></span></div>' +
      '<div style="display:flex;justify-content:space-between;font-family:var(--fm);font-size:7.5px;color:var(--t2);margin-top:5px">' +
      '<span>' + M.money0s(total) + ' earned</span><span class="pos">Ahead of pace</span></div></div>' +
      '<p style="font-size:9px;color:var(--t2);text-align:center;padding-top:3px">Target ' + M.money0(target) +
      ' · ' + Math.round(total / target * 100) + '% banked</p>' };
  }

  if (i === 3) {
    const list = SAMPLE.day;
    /* The day the example slip settled into, and the week around it. Both
       come from the example rather than the calendar, so the figure at the
       top is the sum of the rows underneath it. */
    const wt = SAMPLE.dayNet + 41_500 - 12_300;
    return { top: ['A settled day', M.signed(SAMPLE.dayNet)], html:
      '<div>' + list.map(x =>
        '<div style="display:flex;align-items:center;gap:6px;font-size:9px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05)">' +
        '<span class="prevrow-i tiny" data-outcome="' + outcomeGroup(x.outcome) + '">' + ico(OUTCOME_ICON[x.outcome]) + '</span>' +
        '<span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
        esc(x.selection) + ' · ' + esc(x.book) + '</span>' +
        '<b class="m ' + M.tone(x.profit) + '" style="font-size:9px">' + M.signed(x.profit) + '</b></div>').join('') + '</div>' +
      '<p style="font-size:9px;color:var(--t2);text-align:center;padding-top:4px">That week ' +
      '<b class="' + M.tone(wt) + '">' + M.money0s(wt) + '</b></p>' };
  }

  if (i === 4) {
    /* Split of the example month, computed from the example's own rows so
       the bars sum to the figure the previous scene showed. */
    const p = SAMPLE.analysis;
    const books = p.byBook;
    const max = books.reduce((a, x) => Math.max(a, Math.abs(x[1])), 0) || 1;
    return { top: ['What paid', ''], html:
      '<div style="display:flex;flex-direction:column;gap:6px">' + books.map((x, n) =>
        '<div style="display:grid;grid-template-columns:46px 1fr auto;align-items:center;gap:5px;font-size:8.5px;color:var(--t2)">' +
        '<span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(x[0]) + '</span>' +
        '<i style="height:5px;border-radius:3px;display:block;width:' + (Math.abs(x[1]) / max * 100).toFixed(0) +
        '%;background:' + (x[1] >= 0 ? '#86EFAC' : '#FCA5A5') + '"></i>' +
        '<b class="m ' + M.tone(x[1]) + '" style="font-size:8.5px">' + M.money0s(x[1]) + '</b></div>').join('') + '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:4px;margin-top:6px">' +
      skpi('Win rate', p.winRate + '%') + skpi('Avg odds', p.avgOdds.toFixed(2)) +
      skpi('Turnover', M.money0(p.turnover)) + skpi('ROI', M.pct(p.roi)) + '</div>' +
      '<p style="font-size:9px;color:var(--t2);text-align:center;padding-top:3px">Also splits by market and tipster</p>' };
  }

  /* An example group. Ranked in units, which is the whole point: the
     numbers compare without anyone's stake sizes being visible. */
  const rows = SAMPLE.group;
  const gt = rows.reduce((a, x) => a + x.v / x.un, 0);
  return { top: ['Sunday League', (gt >= 0 ? '+' : '−') + Math.abs(gt).toFixed(2) + 'u'], html:
    '<div>' + rows.slice(0, 5).map((x, n) =>
      '<div style="display:flex;align-items:center;gap:6px;font-size:9px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05)' +
      (x.me ? ';background:rgba(var(--orb1),.16);border-radius:5px;padding-left:5px;padding-right:5px' : '') + '">' +
      '<span style="width:9px;font-family:var(--fm);color:var(--t3)">' + (n + 1) + '</span>' +
      '<span style="width:16px;height:16px;border-radius:50%;display:grid;place-items:center;font-size:6.5px;font-weight:600;color:#08111f;background:linear-gradient(140deg,#8FC7C0,#8B9DE0)">' + esc(x.a) + '</span>' +
      '<span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(x.n) + '</span>' +
      '<b class="m ' + M.tone(x.v) + '" style="font-size:9px">' + M.units(x.v, x.un) + '</b></div>').join('') + '</div>' +
    '<p style="font-size:9px;color:var(--t2);text-align:center;padding-top:4px">' +
    'Ranked in units, never in pounds</p>' };
}
const srow = (k, v) => '<div style="display:flex;justify-content:space-between;gap:8px;font-size:9.5px;padding:2px 0"><span style="color:var(--t2)">' + k + '</span><b class="m">' + v + '</b></div>';
const skpi = (k, v) => '<div style="background:var(--c1);border:1px solid var(--e2);border-radius:6px;padding:6px"><div style="font-size:7px;color:var(--t2)">' + k + '</div><div class="m" style="font-weight:600;font-size:10px;margin-top:2px">' + v + '</div></div>';

/** Render the whole guide: five steps, each with its panel. */
export function renderGuide() {
  /* Two chapters, not one list of five.
     The split is not cosmetic: steps one to three are things the bot does
     to a slip and steps four and five are things the dashboard does with
     the result, so they answer two different questions and somebody who
     only has one of them can read only that half. The numbering restarts
     per chapter for the same reason. */
  const render = (id, steps, offset) => {
    const el = $(id);
    if (!el) return;
    el.innerHTML = steps.map((step, i) => {
      const p = panel(i + offset);
      return '<li class="guidestep">' +
        '<div class="guidehead">' +
          '<span class="guiden" aria-hidden="true">' + (i + 1) + '</span>' +
          '<div><h3>' + esc(step[0]) + '</h3><p>' + esc(step[1]) + '</p></div>' +
        '</div>' +
        '<div class="guideshot">' +
          '<div class="phone-top"><span class="l">' + esc(p.top[0]) + '</span>' +
            '<span class="r ' + (p.top[1] && p.top[1].charAt(0) === '\u2212' ? 'neg'
              : p.top[1] && p.top[1].charAt(0) === '+' ? 'pos' : '') + '">' +
            esc(p.top[1] || '') + '</span></div>' +
          '<div class="guidebody' + (p.cls ? ' ' + p.cls : '') + '">' + p.html + '</div>' +
        '</div></li>';
    }).join('');
  };
  render('guideBot', STEPS.slice(0, 3), 0);
  render('guideDash', STEPS.slice(3), 3);
}

function paintScene() {
  let idx = 0;
  CHAPTERS.forEach((c, i) => { if (playTime >= c[0]) idx = i; });
  const body = $('sceneBody');
  if (body.getAttribute('data-scene') !== String(idx)) {
    const sc = scene(idx);
    setText('sceneTitle', sc.top[0]);
    const val = $('sceneValue');
    val.textContent = sc.top[1];
    val.className = 'r ' + (sc.top[1].charAt(0) === '−' ? 'neg' : sc.top[1].charAt(0) === '+' ? 'pos' : '');
    body.innerHTML = '<div class="scene ' + (sc.cls || '') + '"></div>';
    const el = body.firstChild;
    el.innerHTML = sc.html;
    requestAnimationFrame(() => el.classList.add('on'));
    body.setAttribute('data-scene', String(idx));
    setText('playerCaption', CHAPTERS[idx][2]);
  }
  $$('#chapters button').forEach((b, i) => b.setAttribute('aria-current', String(i === idx)));
}

export function isPlaying() { return playing; }

/* ---------- the landing sections ----------
 *
 * One component, six parts, repeated with the accent varied. The order is
 * deliberate and it is not the benchmark's order: theirs opens with AI
 * extraction because extraction is their product. Ours opens with capture
 * at placement because that is the only thing here nobody else can copy,
 * and burying it behind a feature tour would be arguing on their ground.
 *
 * Every section ends with `said`, one line stating what the demo means. A
 * chart without a conclusion is decoration.
 */
export const SECTIONS = [
  {
    accent: 'a2',
    badge: ['i-won', 'The bit that makes it true'],
    h: ['Logged before kick-off,', 'not after the result.'],
    lede: 'Every other tracker asks you to enter a bet once it has finished, which quietly collects the ones you wanted to remember. Slippery captures the slip when you place it.',
    rows: [
      ['i-telegram', 'Forward the slip as you place it', 'Screenshot, share, done. Two seconds.', true],
      ['i-bolt', 'Read before anything is known', 'Stake, odds, selection and every leg.'],
      ['i-shield', 'Locked to the moment it was sent', 'The capture time is recorded and cannot be edited.']
    ],
    ticks: ['Pre-match, in-play and settled are told apart',
            'The split is on your dashboard',
            'Imported history is excluded, not guessed',
            'One number nobody can game'],
    demo: 'capture',
    said: 'Same bettor. Same eight bets. <b class="down">\u2212\u00a394.25</b> is the true record, <b class="up">+\u00a3412.60</b> is what memory keeps.'
  },
  {
    accent: 'a1',
    badge: ['i-shield', 'Settlement'],
    h: ['It refuses', 'rather than guesses.'],
    lede: 'Extra time never counts. A whole line on the exact score is a push, not a loss. Handicaps grade differently at bet365 than everywhere else.',
    rows: [
      ['i-won', 'Standard markets settle themselves', 'On the 90 minute score, as soon as it is in.'],
      ['i-void', 'Anything uncertain comes back to you', 'A wrong grade is worse than no grade.', true],
      ['i-refresh', 'Five results sources, tried in order', 'If one blocks us, the next one answers.']
    ],
    ticks: ['90 minutes only, never extra time',
            'Whole lines push, quarter lines split',
            'Per-bookmaker handicap rules',
            'Postponed voids, abandoned asks'],
    demo: 'settle',
    said: 'Measured on a live feed: <b class="up">299 of 300</b> handicaps graded, <b>274 cup ties refused</b> because the 90 minute score could not be proved.'
  },
  {
    accent: 'a3',
    badge: ['i-camera', 'Slip reading'],
    h: ['Screenshot to ledger,', 'without the typing.'],
    lede: 'Send the slip and the stake, odds, selection, bookmaker and every leg come off the image. Anything it cannot read is left blank rather than guessed.',
    rows: [
      ['i-camera', 'Send anything legible', 'Screenshot, photo, PDF statement or a pasted list.', true],
      ['i-bolt', 'Every leg, with its own price', 'A fourfold arrives as four selections, not one line.'],
      ['i-void', 'Blanks, never guesses', 'An unreadable figure comes back empty and says which.']
    ],
    ticks: ['Any bookmaker', 'Multiple slips at once',
            'Every field editable', 'Nothing saved until you confirm'],
    demo: 'read',
    said: 'Read live from a bet365 treble: combined price <b>5.86</b>, three legs each with its own odds, and the result left blank because the slip had not settled.'
  },
  {
    accent: 'a4',
    badge: ['i-bolt', 'Import'],
    h: ['Bring the history', 'you already have.'],
    lede: 'Screenshots, PDFs, a CSV export, or a profit screen from another tracker. Slippery works out which it is and files the dated rows on the right days.',
    rows: [
      ['i-arrow-down', 'Drop anything in', 'One zone. No choosing a format first.', true],
      ['i-bolt', 'Dated rows land on their dates', 'A P/L screen becomes a month of the calendar, not one number.'],
      ['i-void', 'Re-running it corrects, never doubles', 'Keyed on the day, so a retry is safe.']
    ],
    ticks: ['Images, PDF, CSV and paste', 'Every field editable before saving',
            'Nothing saved until you confirm', 'Imported bets excluded from the capture rate'],
    demo: 'import',
    said: 'Imported history is counted separately, because it has no slips behind it and pretending otherwise would break the one number that matters.'
  },
  {
    accent: 'a1',
    badge: ['i-chart', 'Football'],
    h: ['Every league.', 'Matched automatically.'],
    lede: 'Bets are linked to fixtures across the leagues our sources publish, so the competition and team splits build themselves. No tagging.',
    rows: [
      ['i-chart', 'Matched on the name you typed', 'Fuzzy matching handles Wolves and Wolverhampton.', true],
      ['i-scales', 'Split by competition and market', 'Which leagues pay, and which ones you should leave alone.'],
      ['i-void', 'One candidate, or it refuses', 'An ambiguous name settles nothing rather than the wrong thing.']
    ],
    ticks: ['Five sources, tried in order', 'Fuzzy fixture matching',
            'Competition and team splits', 'No manual tagging'],
    demo: 'football',
    said: 'From one live pull: <b>1,291 fixtures</b> across three days, <b class="up">977</b> with a provable 90 minute score.'
  },
  {
    accent: 'a4',
    badge: ['i-trophy', 'Racing and tennis'],
    h: ['Tennis grades.', 'Racing asks you.'],
    lede: 'Tennis settles from set scores the same way football settles from goals. Racing does not, and we say so rather than guessing at a result we cannot prove.',
    rows: [
      ['i-trophy', 'Tennis settles on sets', 'Match winner, set betting and total games.'],
      ['i-ask', 'Racing comes back to you', 'No feed we trust publishes finishing positions we can prove.', true],
      ['i-shield', 'Named, not left pending', 'A racing bet says it needs you, so it stops looking unfinished.']
    ],
    ticks: ['Tennis fully automatic', 'Racing flagged, never guessed',
            'Dead heats and retirements ask', 'One tap to settle by hand'],
    demo: 'racing',
    said: 'We would rather ship a gap you can see than a number you cannot check. Racing is the gap.'
  },
  {
    accent: 'a3',
    badge: ['i-telegram', 'Telegram'],
    h: ['Send it on Telegram.', 'It is tracked.'],
    lede: 'The bot is the front door, not an add-on. Forward the slip as you place it and it is read, confirmed and logged without opening anything.',
    rows: [
      ['i-telegram', 'Forward, do not switch apps', 'The slip is already in Telegram. Share it.', true],
      ['i-bolt', 'It replies with what it read', 'Check it in the chat and confirm with one tap.'],
      ['i-refresh', 'The dashboard already has it', 'By the time you open the app the bet is there.']
    ],
    ticks: ['Screenshots and text', 'Confirm before anything saves',
            'Works from the group chat', 'Capture time recorded'],
    demo: 'telegram',
    said: 'Placing and logging become the same action. That is the only reason capture at placement survives contact with a Saturday.'
  },
  {
    accent: 'a2',
    badge: ['i-users', 'Groups'],
    h: ['Compare with friends.', 'Show nobody your stakes.'],
    lede: 'Groups rank in units, not pounds. A £10 bettor and a £500 bettor sit in the same table honestly, and neither learns what the other stakes.',
    rows: [
      ['i-users', 'Start a group, share the code', 'Private by default, or listed for anyone to find.'],
      ['i-chart', 'Ranked in units', 'Your unit is your standard stake. Only the ratio leaves the server.', true],
      ['i-shield', 'Turnover never leaves', 'The board divides on the server so it cannot be reversed.']
    ],
    ticks: ['Units, never pounds', 'Public or invite-only groups',
            'Follow individual Slippers', 'You choose who sees your figures'],
    demo: 'group',
    said: 'Same table, <b>50x</b> difference in stake size, and no way to tell which is which.'
  }
];


/* ---------- the divergence ----------
 *
 * Eight real-shaped bets, four winners and four losers, netting a loss.
 * The numbers are chosen so the honest total is NEGATIVE and the selective
 * one is strongly positive: that gap is the entire point, and a worked
 * example where both come out positive would prove nothing.
 *
 * Arithmetic checked against the running animation, not by eye: the winners
 * sum to +412.60 and the losers to -506.85, so the honest total is -94.25,
 * the same figure the dashboard uses. One number, one story, everywhere.
 * The first three are all winners on purpose, so the two columns start
 * identical and visibly come apart rather than being different from the
 * first frame. */
const DIVERGE = [
  ['Arsenal, 1.80', 11600, true],
  ['Over 2.5, 2.10', 9200, true],
  ['Bayern -1, 1.55', 7860, true],
  ['Spurs draw, 3.40', -12000, false],
  ['BTTS, 1.90', 12600, true],
  ['Under 3.5, 1.70', -14500, false],
  ['Liverpool, 1.45', -9185, false],
  ['Acca, 6.20', -15000, false]
];

const money = p => (p < 0 ? '\u2212' : '+') + '\u00a3' +
  (Math.abs(p) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

function divergeMarkup() {
  const row = (b, ghost) =>
    '<div class="drow ' + (b[2] ? 'w' : 'l') + (ghost ? ' dhide' : '') + '">' +
    '<i aria-hidden="true"></i><span>' + esc(b[0]) + '</span></div>';
  return '<div class="demohead">' + ico('i-scales') + 'Same eight bets, two records</div>' +
    '<div class="diverge">' +
      '<div class="dcol honest"><span class="dhead">Captured at placement</span>' +
        '<span class="dtot neg" id="divA">\u00a30.00</span>' +
        '<div class="drows">' + DIVERGE.map(b => row(b, false)).join('') + '</div>' +
        '<span class="dsub">All eight. It could not know which would land.</span></div>' +
      '<div class="dcol reel"><span class="dhead">Filled in afterwards</span>' +
        '<span class="dtot pos" id="divB">\u00a30.00</span>' +
        '<div class="drows">' + DIVERGE.map(b => row(b, !b[2])).join('') + '</div>' +
        '<span class="dsub">Only the ones worth remembering.</span></div>' +
    '</div>';
}

/* Run it. One timeline drives both columns, so the rows land in step and
   the gap opens on screen rather than being there when you arrive.
 *
 * Observed rather than started on load: a page nobody has scrolled to
 * should not be spending frames, and restarting on re-entry is what makes
 * it worth watching twice. */
function playDiverge() {
  const stage = $('divergeDemo');
  if (!stage) return;
  const rowsA = [...stage.querySelectorAll('.dcol.honest .drow')];
  const rowsB = [...stage.querySelectorAll('.dcol.reel .drow')];
  const a = $('divA'), b = $('divB');
  let timers = [];

  const paint = (el, pence) => {
    el.textContent = money(pence);
    el.className = 'dtot ' + (pence < 0 ? 'neg' : 'pos');
  };

  const settle = () => {
    /* The end state, with no motion. Reduced motion gets this immediately
       and so does anything that scrolls past mid-run: an animation frozen
       half way through would misstate both totals. */
    rowsA.forEach(r => r.classList.add('in'));
    rowsB.forEach(r => r.classList.add('in'));
    paint(a, DIVERGE.reduce((t, x) => t + x[1], 0));
    paint(b, DIVERGE.filter(x => x[2]).reduce((t, x) => t + x[1], 0));
  };

  const stop = () => { timers.forEach(clearTimeout); timers = []; };

  const run = () => {
    stop();
    rowsA.forEach(r => r.classList.remove('in'));
    rowsB.forEach(r => r.classList.remove('in'));
    paint(a, 0); paint(b, 0);
    let ta = 0, tb = 0;
    DIVERGE.forEach((bet, i) => {
      timers.push(setTimeout(() => {
        rowsA[i].classList.add('in');
        ta += bet[1];
        paint(a, ta);
        /* The flattering column only ever receives a winner, which is the
           whole mechanism: it is not lying about any single bet, it is
           just never told about the others. */
        if (bet[2]) { rowsB[i].classList.add('in'); tb += bet[1]; paint(b, tb); }
      }, 340 + i * 260));
    });
    /* Hold on the finished state, then go again, so somebody who arrives
       part way through still sees it from the start. */
    timers.push(setTimeout(run, 340 + DIVERGE.length * 260 + 4200));
  };

  if (RM) { settle(); return; }
  if (typeof IntersectionObserver !== 'function') { settle(); return; }
  new IntersectionObserver(entries => {
    for (const e of entries) {
      if (e.isIntersecting) run();
      else { stop(); settle(); }
    }
  }, { threshold: 0.35 }).observe(stage);
}

/* Build every section from SECTIONS. One function, so a new section is a
   data entry rather than a block of markup, and so the six parts cannot
   drift apart between sections. */
const tick = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';

function sectionRow(r) {
  return '<div class="sect-row' + (r[3] ? ' on' : '') + '">' +
    '<span class="rowtile" aria-hidden="true">' + ico(r[0]) + '</span>' +
    '<span><span class="rowt">' + esc(r[1]) + '</span>' +
    '<span class="rows">' + esc(r[2]) + '</span></span></div>';
}

/* The demos. Real markup, never a screenshot: a screenshot ages the day
   the product changes and a screen reader cannot read one. */
function sectionDemo(kind) {
  if (kind === 'capture') return divergeMarkup();
  if (kind === 'settle') {
    const rows = [['Arsenal v Spurs', 'Over 2.5, 3-1', 'Settled', 'up'],
                  ['Bayern v Mainz', 'Bayern -1, 2-1 at bet365', 'Void, whole line', ''],
                  ['Morocco W v South Africa W', 'Cup tie, went to extra time', 'Asks you', 'down']];
    return '<div class="demohead">' + ico('i-shield') + 'Three results, three answers</div>' +
      rows.map(r => '<div class="demobar"><span class="bl"><b style="color:var(--t1)">' +
        esc(r[0]) + '</b><br>' + esc(r[1]) + '</span><span class="bv ' + r[3] + '">' +
        esc(r[2]) + '</span></div>').join('');
  }
  if (kind === 'group') {
    const rows = [['DariusOdds', '1u = £10', '+4.20u', 'up'], ['HalfEdge', '1u = £500', '+2.05u', 'up'],
                  ['QuietStake', '1u = £25', '-0.90u', 'down']];
    return '<div class="demohead">' + ico('i-users') + 'Sunday League, this month</div>' +
      rows.map((r, i) => '<div class="demobar"><span class="bl">' + (i + 1) + '. <b style="color:var(--t1)">' +
        esc(r[0]) + '</b> · ' + esc(r[1]) + '</span><span class="bv ' + r[3] + '">' +
        esc(r[2]) + '</span></div>').join('');
  }
  if (kind === 'read') {
    /* The reading the production reader actually returned for a bet365
       treble, not an invented one. The result is blank because the slip
       had not settled, which is the behaviour worth showing. */
    const legs = [['Arsenal', 'Full Time Result', '1.80'],
                  ['Over 2.5 Goals', 'Total Goals', '2.10'],
                  ['Bayern Munich -1', 'Asian Handicap', '1.55']];
    return '<div class="demohead">' + ico('i-camera') + 'bet365 treble, as read</div>' +
      legs.map(l => '<div class="demobar"><span class="bl"><b style="color:var(--t1)">' +
        esc(l[0]) + '</b><br>' + esc(l[1]) + '</span><span class="bv">' + l[2] + '</span></div>').join('') +
      '<div class="demobar"><span class="bl">Combined price</span><span class="bv">5.86</span></div>' +
      '<div class="demobar"><span class="bl">Result on the slip</span>' +
        '<span class="bv" style="color:var(--t3)">Left blank</span></div>';
  }
  if (kind === 'football') {
    const rows = [['Premier League', 78, '+£412', 'up'], ['La Liga', 44, '+£186', 'up'],
                  ['Serie A', 30, '-£94', 'down'], ['Ligue 1', 18, '-£210', 'down']];
    const max = 78;
    return '<div class="demohead">' + ico('i-chart') + 'Profit by competition</div>' +
      rows.map(r => '<div class="demobar ' + r[3] + '"><span class="bl">' + esc(r[0]) +
        ' · ' + r[1] + ' bets</span><span class="bv ' + r[3] + '">' + esc(r[2]) + '</span>' +
        '<span class="bt"><i style="--f:' + (r[1] / max).toFixed(2) + '"></i></span></div>').join('');
  }
  if (kind === 'racing') {
    const rows = [['Tennis, match winner', 'Settled', 'up'],
                  ['Tennis, over 22.5 games', 'Settled', 'up'],
                  ['14:30 Ascot, each way', 'Needs you', 'down'],
                  ['15:05 York, win only', 'Needs you', 'down']];
    return '<div class="demohead">' + ico('i-trophy') + 'What happens to each</div>' +
      rows.map(r => '<div class="demobar"><span class="bl">' + esc(r[0]) +
        '</span><span class="bv ' + r[2] + '">' + esc(r[1]) + '</span></div>').join('');
  }
  if (kind === 'telegram') {
    return '<div class="demohead">' + ico('i-telegram') + 'In the chat, 14:32</div>' +
      '<div class="tgline you">Slip forwarded</div>' +
      '<div class="tgline bot"><b>Arsenal v Chelsea</b><br>BTTS Yes · 1.90 · £20<br>' +
        '<span class="tgmeta">Pre-match. Confirm and it is logged.</span></div>' +
      '<div class="tgline you ok">Confirmed</div>';
  }
  const rows = [['12 Aug', '-40.50', 'down'], ['11 Aug', '+118.00', 'up'], ['10 Aug', '+26.40', 'up']];
  return '<div class="demohead">' + ico('i-calendar') + 'Read off a profit screen</div>' +
    rows.map(r => '<div class="demobar"><span class="bl">' + esc(r[0]) +
      '</span><span class="bv ' + r[2] + '">' + esc(r[1]) + '</span></div>').join('');
}

/* ---------- the tail ----------
 *
 * The blocks after the sections. Same discipline: nothing here states a
 * number we have not measured, and the testimonial slot renders nothing
 * until there are real quotes to put in it.
 */
const FEATURES = [
  ['i-chart', 'Calendar and analytics',
   'Green days, red days, and profit split by bookmaker, market and tipster.'],
  ['i-camera', 'Slip reading',
   'Screenshots, photos, PDFs and pasted lists. Every field editable before it saves.'],
  ['i-shield', 'Settlement that refuses',
   'Ninety minutes only. Anything it cannot prove comes back to you.'],
  ['i-users', 'Groups in units',
   'Compare with friends without anyone seeing a stake size.'],
  ['i-telegram', 'Telegram first',
   'Forward a slip as you place it. The bot is the front door, not an add-on.'],
  ['i-lock', 'Yours, and deletable',
   'Export everything as CSV or JSON. Delete the account and it is gone.']
];

/* Aggregates, not a user count. A user count on a young product either
   overstates or embarrasses; these are facts about what the thing does. */
const PROOF = [
  ['5', 'Results sources', 'tried in order until one answers'],
  ['299/300', 'Handicaps graded', 'measured against a live feed'],
  ['274', 'Cup ties refused', 'because 90 minutes could not be proved']
];

/* EMPTY ON PURPOSE. The benchmark's testimonials work because the quotes
   are unpolished and unattributed. Inventing three would be the single
   most obvious lie on the page, and the first thing a reader who has seen
   a hundred landing pages checks. Put real ones in and the section
   appears; leave it and nothing renders. */
const QUOTES = [];

/* The demo. Read only, and built from SAMPLE so every figure reconciles
   against the rows above it. Deliberately not the dashboard with fake
   data poured into it: nothing here can be edited and no control claims
   to save, because a stranger clicking Confirm on a bet that goes nowhere
   is worse than not showing them anything. */
/* renderDemo lived here. The demo is now its own module: it runs on 486
   generated bets rather than the six in SAMPLE, and a page with its own
   period state and a tappable day strip is behaviour, not content. */

export function renderTail() {
  /* The bookmakers the reader has actually been run against, from the one
     list of them, so adding a book in Settings shows up here too. */
  /* Five names, and each is a route rather than a label. The strip used to
     print nine as plain text; the pages exist now, so a name that cannot
     be tapped is a link the reader looks for and does not find. */
  setHTML('bookStrip', BOOKPAGES.slice(0, 5).map(b =>
    '<button data-bookpage="' + esc(b.id) + '">' + esc(b.name) + '</button>').join(''));

  setHTML('featureGrid', FEATURES.map(f =>
    '<div class="fcard reveal"><span class="ftile" aria-hidden="true">' + ico(f[0]) + '</span>' +
    '<h3>' + esc(f[1]) + '</h3><p>' + esc(f[2]) + '</p></div>').join(''));

  setHTML('proofStats', PROOF.map(p =>
    '<div class="pstat"><span class="pv">' + esc(p[0]) + '</span>' +
    '<span class="pk">' + esc(p[1]) + '</span>' +
    '<span class="pw">' + esc(p[2]) + '</span></div>').join(''));

  const q = $('quoteWrap');
  if (q) {
    q.hidden = !QUOTES.length;
    if (QUOTES.length) {
      setHTML('quoteList', QUOTES.map(t =>
        '<blockquote class="qcard"><span class="qmark" aria-hidden="true">&ldquo;</span>' +
        esc(t) + '</blockquote>').join(''));
    }
  }
}

export function renderSections() {
  const el = $('landingSections');
  if (!el) return;
  el.innerHTML = SECTIONS.map(s =>
    '<section class="sect ' + s.accent + ' reveal">' +
      '<span class="sect-badge">' + ico(s.badge[0]) + esc(s.badge[1]) + '</span>' +
      '<h2 class="sect-h">' + esc(s.h[0]) + '<em>' + esc(s.h[1]) + '</em></h2>' +
      '<p class="sect-lede">' + esc(s.lede) + '</p>' +
      '<div class="sect-rows">' + s.rows.map(sectionRow).join('') + '</div>' +
      '<div class="sect-ticks">' + s.ticks.map(t =>
        '<span>' + tick + esc(t) + '</span>').join('') + '</div>' +
      '<div class="sect-demo"' + (s.demo === 'capture' ? ' id="divergeDemo"' : '') + '>' +
        sectionDemo(s.demo) +
        '<p class="sect-said">' + s.said + '</p></div>' +
    '</section>').join('');
  playDiverge();
}
