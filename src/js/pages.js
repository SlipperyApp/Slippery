/* The reference pages: bookmakers, the long FAQ, the changelog and the
 * data utilities.
 *
 * These are all static content plus small pure functions, so they live
 * apart from content.js, which is already the marketing surface, and apart
 * from render.js, which reads the signed-in ledger. Nothing here touches a
 * user's data except the utilities panel, which asks the server.
 */
import { BOOKMAKERS } from './books.js';
import { $, $$, esc, setHTML, on, toast } from './dom.js';
import { ico } from './data.js';

/* ============================================================
   BOOKMAKERS
   ============================================================
   One page per bookmaker, generated from this table. A page per name is
   only worth having if each one says something the others do not, so the
   field that matters is `edge`: the thing that is genuinely different
   about grading that bookmaker's slips. bet365 settling Asian handicaps
   where everyone else settles European is the clearest case, and it is a
   real difference in the settlement engine, not a marketing line.

   `reads` is what the extractor has actually been given from that
   bookmaker's app. Where we have not tested a slip format we say so
   rather than implying full coverage.
   ============================================================ */
/* The prose, keyed by registry id. The NAME and the HANDICAP STYLE are not
   here: they live in books.js, which is also what the settlement engine
   reads, so a page cannot claim European handicaps while the grader uses
   the Asian table. This table is only the part a person had to write.

   A brand with no entry still gets a page, generated from its registry row
   below. That is the point of the registry: adding a Kambi brand is one
   row, and the reference screen picks it up without anybody remembering to
   come here. */
const BOOK_COPY = [
  {
    id: 'bet365',
    edge: 'Asian handicaps. A −1 on a 2−1 win is a push and your stake comes back. Everywhere else that same bet loses, because the handicap draw is its own outcome. Slippery grades bet365 slips on the Asian table and the rest on the European one.',
    reads: ['Single and multiple slips from the app', 'Bet builder slips with each leg priced', 'The combined price on a treble', 'Cash out shown on the slip'],
    caution: 'Bet builder legs are read but never auto-graded. Player and card markets always come back to you.'
  },
  {
    id: 'paddy-power',
    edge: 'European handicaps, so a −1 on a 2−1 win loses rather than pushes. Each way slips carry the place terms on the slip itself, which is where they are read from rather than assumed.',
    reads: ['Single, multiple and each way slips', 'Place terms as printed', 'Settled history screens with dated rows'],
    caution: 'Racing is never settled automatically here or anywhere. No feed we trust publishes finishing positions we can prove.'
  },
  {
    id: 'sky-bet',
    edge: 'Doubles where one stake covers several selections are read as one bet with legs, not split into separate bets. That was a real extraction bug on this format and it is the thing to check first if a Sky Bet slip looks wrong.',
    reads: ['Request a bet slips', 'Doubles and trebles with a combined price', 'Build a bet with per-leg prices'],
    caution: 'Build a bet legs come back to you. A same-game multi is never graded automatically.'
  },
  {
    id: 'william-hill',
    edge: 'A just-placed slip and a won slip look similar on this app, so the capture stage is taken from the slip state rather than inferred from whether a result is printed.',
    reads: ['Single and multiple slips', 'Bet history screens', 'Cash out values'],
    caution: 'Where the slip does not print a result, the bet is logged as running rather than guessed at.'
  },
  {
    id: 'ladbrokes',
    edge: 'Handicap draws are their own outcome, so a −1 acts like a −1.5. Whole lines on totals still push: over 2.0 on a 1−1 is void, not a loss.',
    reads: ['Single and multiple slips', 'Settled bet history'],
    caution: 'Bet builders and player props always come back to you.'
  },
  {
    id: 'coral',
    edge: 'Same grading table as Ladbrokes, and the slip format is close enough that both are read by the same path. Where the two differ is the reference format, which is what the extractor keys on.',
    reads: ['Single and multiple slips', 'Settled bet history'],
    caution: 'Bet builders and player props always come back to you.'
  },
  {
    id: 'betfred',
    edge: 'Bonus and boost lines appear on the slip and are not stake. They are read as what they are, so a boosted return does not become a stake you never placed.',
    reads: ['Single and multiple slips', 'Boosted odds slips'],
    caution: 'A free bet stake is logged at the stake shown. Whether a free bet stake counts in your P/L is your call, not ours.'
  },
  {
    id: 'betfair',
    edge: 'Exchange bets carry commission, which the sportsbook slips do not. A lay is not a back with the sign flipped and is never graded as one.',
    reads: ['Sportsbook single and multiple slips'],
    caution: 'Exchange lays are read but always come back to you to settle. Commission is not modelled.'
  },
  {
    id: 'unibet',
    edge: 'Kambi platform, so the slip layout is shared with LeoVegas and 32Red and all three are read by the same path.',
    reads: ['Single and multiple slips', 'Combi slips with a combined price'],
    caution: 'Player and card markets always come back to you.'
  },
  {
    id: 'smarkets',
    edge: 'An exchange, so the price on the slip is the price you got rather than a sportsbook price. Commission is not modelled and settlement is by hand.',
    reads: ['Order and position screens'],
    caution: 'Never settled automatically. Exchange positions are handed back to you.'
  }
];


/* Registry row plus prose, which is what the pages render from. Anything
   the copy table does not cover is stated from the facts we hold rather
   than left out, because a bookmaker with no page at all reads as one
   Slippery cannot handle. */
export const BOOKPAGES = BOOKMAKERS.map(b => {
  const copy = BOOK_COPY.find(c => c.id === b.id);
  const shared = BOOKMAKERS.filter(x => x.provider === b.provider && x.id !== b.id);
  return {
    id: b.id,
    name: b.name,
    provider: b.provider,
    handicap: b.handicap === 'asian' ? 'Asian' : 'European',
    edge: copy ? copy.edge
      : b.handicap === 'asian'
        ? 'Asian handicaps, so a whole line can push and the stake comes back.'
        : 'European handicaps, so the handicap draw is its own outcome and a −1 behaves like a −1.5.' +
          (shared.length
            ? ' On the ' + b.provider + ' platform, so the slip layout is shared with ' +
              shared.map(x => x.name).join(' and ') + ' and all of them are read by the same path.'
            : ''),
    reads: copy ? copy.reads : ['Single and multiple slips'],
    caution: copy ? copy.caution
      : 'No slip from this bookmaker has been tested here yet, so read what comes back before you confirm it. Player and card markets always come back to you.'
  };
});

const bookCard = b =>
  '<button class="bkcard" data-bookpage="' + esc(b.id) + '">' +
  '<span class="bkname">' + esc(b.name) + '</span>' +
  '<span class="bkhand ' + (b.handicap === 'Asian' ? 'asian' : '') + '">' + esc(b.handicap) + ' handicaps</span>' +
  '<span class="bkgo" aria-hidden="true">→</span></button>';

function bookPage(b) {
  return '<button class="pillbtn" data-bookpage="">All bookmakers</button>' +
    '<h2 class="bkh">Tracking ' + esc(b.name) + ' bets</h2>' +
    '<p class="bklede">Forward a ' + esc(b.name) + ' slip to the bot, before kick off or after. The stake, odds, selection and every leg come off the image, and the bet settles on the 90 minute score once it is in.</p>' +
    '<div class="card pad bkedge"><p class="bkedgeh">What is different about ' + esc(b.name) + '</p><p>' + esc(b.edge) + '</p></div>' +
    '<div class="bkcols">' +
    '<div class="card pad"><p class="bkcolh">Slip formats read</p><ul class="bklist">' +
    b.reads.map(r => '<li>' + esc(r) + '</li>').join('') + '</ul></div>' +
    '<div class="card pad"><p class="bkcolh">What comes back to you</p><p class="bkcaution">' + esc(b.caution) + '</p></div>' +
    '</div>' +
    '<div class="lastcta" style="margin-top:20px"><h2>Track your ' + esc(b.name) + ' bets</h2>' +
    '<p>Two weeks free, 35 slips, no card.</p>' +
    '<button class="btn primary" data-nav="setup">Start free</button></div>';
}

export function showBook(id) {
  const grid = $('bookGrid'), page = $('bookPage');
  if (!grid || !page) return;
  const b = BOOKPAGES.find(x => x.id === id);
  if (!b) { grid.hidden = false; page.hidden = true; page.innerHTML = ''; return; }
  grid.hidden = true;
  page.hidden = false;
  setHTML('bookPage', bookPage(b));
  scrollTo(0, 0);
}

/* ============================================================
   THE LONG FAQ
   ============================================================
   Answered with lists where a list is the honest answer. Prose reads
   better and hides the cases it does not cover, which is the opposite of
   what a reference page is for.
   ============================================================ */
const FAQS = [
  ['Which bookmakers can it read?',
    ['bet365', 'Paddy Power', 'Sky Bet', 'William Hill', 'Ladbrokes', 'Coral', 'Betfred', 'Betfair sportsbook', 'Unibet, LeoVegas and 32Red (one shared format)', 'Smarkets'],
    'Anything legible is worth sending. These are the ones real slips have been tested against.'],
  ['What can I import?',
    ['A screenshot of a slip', 'A photo of a printed slip', 'A PDF statement', 'A CSV export', 'An Excel export', 'A screenshot of a profit and loss screen, which lands as dated rows', 'Pasted text'],
    'Whatever you drop in, the type is worked out for you. There is no format to pick.'],
  ['What columns does a CSV need?',
    ['Required: a date, a selection, a stake, and either odds or a return', 'Optional: bookmaker, market, result, competition, notes, tipster', 'Money may carry a currency symbol or not', 'Dates may be day-first or ISO; both are read'],
    'A row missing a required column is shown to you rather than dropped silently.'],
  ['How does duplicate detection work?',
    ['A bet is a duplicate when the date, the selection, the stake and the bookmaker all match one you already have', 'Duplicates are skipped rather than imported, and the import summary says how many and which', 'The same bet twice inside one file is caught as well as the same file imported twice', 'If it really was two identical bets, add the second by hand'],
    'Four fields, all four have to match. Three matching fields is a coincidence, not a duplicate.'],
  ['What results can a bet have?',
    ['Won', 'Lost', 'Void, and the stake comes back with zero profit', 'Push, where the line landed exactly on the score and the stake comes back', 'Placed, where the place half of an each way bet landed and the win half did not', 'Cashed out at a profit', 'Cashed out at a loss', 'Cashed out flat', 'Pending'],
    'Void and push both return the stake and are tracked separately, because they mean different things about the bet.'],
  ['How is profit and loss worked out for each result?',
    ['Won: stake × (odds − 1)', 'Lost: minus the stake', 'Void or push: zero', 'Placed: the place half returns at the place price, the win half is lost', 'Cashed out: the cash out value minus the stake, whatever the game did afterwards', 'Pending: excluded from profit and loss, counted in pending stake'],
    'Pending bets never touch your P/L or your ROI. A running bet is not a result.'],
  ['How does each way work?',
    ['An each way bet is two bets, so a £10 each way is £20 staked', 'The place half pays at the win price reduced by the place fraction', 'Place terms are read off the slip, not assumed', 'Winning gives you both halves; placing gives you the place half only'],
    'Place terms are read off the slip rather than assumed, because they differ by race and by bookmaker.'],
  ['How many slips can I read?',
    ['Free trial: two weeks or 35 slips, whichever runs out first', 'After that: unlimited on either paid plan', 'A slip the reader gets wrong can be flagged, and the flag refunds the slip'],
    'Both halves of the trial matter and they run out differently. The dashboard tells you which one is closer.'],
  ['What happens to my slip images?',
    ['Stored so a bet can be checked against the image it came from', 'Never shown to anyone else', 'Deleted when you delete the image, the bet, or the account', 'Never used to train anything'],
    'Settings has a one-tap purge for the images alone, which keeps the bets.'],
  ['How is my data kept?',
    ['Passwords are hashed with scrypt and never stored in a readable form', 'The session cookie is httpOnly, so no script on the page can read it', 'Every query is scoped to your account by the database, not by the browser', 'Slip images sit in the database alongside the bet, not in a public bucket'],
    'The full processor list, with what each one sees, is on the privacy page.'],
  ['Can I get my data out?',
    ['CSV, from Settings', 'JSON, from Settings, with everything including the settlement reasons', 'Both are the whole ledger, not the current filter'],
    'Export needs no request and no waiting. It is a button.'],
  ['Can I share my record?',
    ['A group ranks its members in units, so nobody sees anyone\'s stakes', 'Your profile can be public, visible to Slippers you follow back, or private', 'Nothing is public by default'],
    'Public tipster pages and password-shared bankrolls are not built. A public leaderboard of gambling returns has a regulatory position that needs answering before it is built, not after.'],
  ['What about racing?',
    ['Racing bets are logged, tracked and counted', 'They are never settled automatically', 'Rule 4, each way terms and starting prices are yours to enter, not ours to guess'],
    'No results feed we trust publishes finishing positions we can prove, so racing is handed back to you rather than guessed at. That is the same rule the football engine follows.']
];

/* ============================================================
   CHANGELOG
   ============================================================
   The current release only. Three versions of history was a page nobody
   read to the end of, and most of it described fixing things that were
   never public. What a changelog is for is telling somebody who used the
   product last week what is different this week.

   The roadmap page went with it. "Planned" and "Research" lists are a
   promise made on a marketing page, and the two items people actually ask
   about, closing line value and automatic racing settlement, are answered
   in the FAQ where the question gets asked.
   ============================================================ */
const LOG = [
  ['0.9.0', '18 Aug 2026', [
    ['New', 'A demo you can look around without an account, running on a labelled sample rather than anyone\'s real record'],
    ['New', 'Bookmaker pages saying what is different about grading each one'],
    ['New', 'All time, yearly, monthly and weekly periods, each one changing what is counted rather than relabelling the same figure'],
    ['New', 'Imported history is its own ledger, shown beside the bets logged here with the addition in the open'],
    ['Improved', 'A slip photographed on an iPhone imports. HEIC was advertised and then rejected, and the error blamed the server'],
    ['Improved', 'A CSV of bets creates bets. It used to fold them into daily totals and report that as success'],
    ['Fixed', 'An abandoned signup no longer holds the email address, the display name, the trial or the promo code']
  ]]
];

/* ============================================================
   UTILITIES
   ============================================================
   Three, and each one shows what it would change before changing it.
   A tool that rewrites a betting ledger without a preview is a tool that
   loses somebody's record.
   ============================================================ */
const UTILS = [
  ['split', 'Split combined selections',
    ['Finds bets where one row holds several selections', 'Splits them into legs with their own prices', 'Handles doubles, trebles and accumulators'],
    'Imported spreadsheets often carry a whole treble in one cell. Split it and each leg gets its own profit and loss.'],
  ['sport', 'Reclassify sports',
    ['Finds bets filed under the wrong sport', 'Scores its confidence before proposing a change', 'Covers football, tennis, racing and the rest'],
    'A football fixture filed as tennis breaks the competition breakdown quietly. This finds them.'],
  ['link', 'Link bets to fixtures',
    ['Matches a bet to a real fixture by name and date', 'Fills in the competition and the kick-off time', 'Makes the competition and team splits possible'],
    'Bets logged from a slip usually match already. Bets brought in from a spreadsheet usually do not.']
];

/* ============================================================
   RENDER
   ============================================================ */
export function renderPages() {
  setHTML('bookGrid', BOOKPAGES.map(bookCard).join(''));

  setHTML('faqsBody', FAQS.map(([q, items, said]) =>
    '<details class="card faq"><summary>' + esc(q) + '</summary>' +
    '<ul class="faqul">' + items.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>' +
    '<p class="faqsaid">' + esc(said) + '</p></details>').join(''));

  setHTML('logList', LOG.map(([ver, date, items]) =>
    '<div class="logentry reveal"><div class="loghead">' +
    '<span class="logver m">v' + esc(ver) + '</span><span class="logdate">' + esc(date) + '</span></div>' +
    items.map(([tag, body]) =>
      '<div class="logrow"><span class="logtag ' + tag.toLowerCase() + '">' + esc(tag) + '</span>' +
      '<span>' + esc(body) + '</span></div>').join('') + '</div>').join(''));

  setHTML('utilList', UTILS.map(([id, name, bullets, why]) =>
    '<div class="utilcard card pad reveal" data-util="' + esc(id) + '">' +
    '<h2>' + esc(name) + '</h2>' +
    '<ul class="utilul">' + bullets.map(b => '<li>' + esc(b) + '</li>').join('') + '</ul>' +
    '<p class="utilwhy">' + esc(why) + '</p>' +
    '<button class="btn ghost full" data-utilrun="' + esc(id) + '">Show me what it would change</button>' +
    '<div class="utilout" id="util-' + esc(id) + '"></div></div>').join(''));

  const y = $('footYear');
  if (y) y.textContent = String(new Date().getFullYear());
}

export { FAQS, UTILS };
