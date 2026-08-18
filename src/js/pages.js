/* The reference pages: bookmakers, calculators, the long FAQ, the roadmap,
 * the changelog, the data utilities.
 *
 * These are all static content plus small pure functions, so they live
 * apart from content.js, which is already the marketing surface, and apart
 * from render.js, which reads the signed-in ledger. Nothing here touches a
 * user's data except the utilities panel, which asks the server.
 */
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
export const BOOKPAGES = [
  {
    id: 'bet365', name: 'bet365', handicap: 'Asian',
    edge: 'Asian handicaps. A −1 on a 2−1 win is a push and your stake comes back. Everywhere else that same bet loses, because the handicap draw is its own outcome. Slippery grades bet365 slips on the Asian table and the rest on the European one.',
    reads: ['Single and multiple slips from the app', 'Bet builder slips with each leg priced', 'The combined price on a treble', 'Cash out shown on the slip'],
    caution: 'Bet builder legs are read but never auto-graded. Player and card markets always come back to you.'
  },
  {
    id: 'paddy-power', name: 'Paddy Power', handicap: 'European',
    edge: 'European handicaps, so a −1 on a 2−1 win loses rather than pushes. Each way slips carry the place terms on the slip itself, which is where they are read from rather than assumed.',
    reads: ['Single, multiple and each way slips', 'Place terms as printed', 'Settled history screens with dated rows'],
    caution: 'Racing is never settled automatically here or anywhere. No feed we trust publishes finishing positions we can prove.'
  },
  {
    id: 'sky-bet', name: 'Sky Bet', handicap: 'European',
    edge: 'Doubles where one stake covers several selections are read as one bet with legs, not split into separate bets. That was a real extraction bug on this format and it is the thing to check first if a Sky Bet slip looks wrong.',
    reads: ['Request a bet slips', 'Doubles and trebles with a combined price', 'Build a bet with per-leg prices'],
    caution: 'Build a bet legs come back to you. A same-game multi is never graded automatically.'
  },
  {
    id: 'william-hill', name: 'William Hill', handicap: 'European',
    edge: 'A just-placed slip and a won slip look similar on this app, so the capture stage is taken from the slip state rather than inferred from whether a result is printed.',
    reads: ['Single and multiple slips', 'Bet history screens', 'Cash out values'],
    caution: 'Where the slip does not print a result, the bet is logged as running rather than guessed at.'
  },
  {
    id: 'ladbrokes', name: 'Ladbrokes', handicap: 'European',
    edge: 'Handicap draws are their own outcome, so a −1 acts like a −1.5. Whole lines on totals still push: over 2.0 on a 1−1 is void, not a loss.',
    reads: ['Single and multiple slips', 'Settled bet history'],
    caution: 'Bet builders and player props always come back to you.'
  },
  {
    id: 'coral', name: 'Coral', handicap: 'European',
    edge: 'Same grading table as Ladbrokes, and the slip format is close enough that both are read by the same path. Where the two differ is the reference format, which is what the extractor keys on.',
    reads: ['Single and multiple slips', 'Settled bet history'],
    caution: 'Bet builders and player props always come back to you.'
  },
  {
    id: 'betfred', name: 'Betfred', handicap: 'European',
    edge: 'Bonus and boost lines appear on the slip and are not stake. They are read as what they are, so a boosted return does not become a stake you never placed.',
    reads: ['Single and multiple slips', 'Boosted odds slips'],
    caution: 'A free bet stake is logged at the stake shown. Whether a free bet stake counts in your P/L is your call, not ours.'
  },
  {
    id: 'betfair', name: 'Betfair', handicap: 'European',
    edge: 'Exchange bets carry commission, which the sportsbook slips do not. A lay is not a back with the sign flipped and is never graded as one.',
    reads: ['Sportsbook single and multiple slips'],
    caution: 'Exchange lays are read but always come back to you to settle. Commission is not modelled.'
  },
  {
    id: 'unibet', name: 'Unibet', handicap: 'European',
    edge: 'Kambi platform, so the slip layout is shared with LeoVegas and 32Red and all three are read by the same path.',
    reads: ['Single and multiple slips', 'Combi slips with a combined price'],
    caution: 'Player and card markets always come back to you.'
  },
  {
    id: 'smarkets', name: 'Smarkets', handicap: 'European',
    edge: 'An exchange, so the price on the slip is the price you got rather than a sportsbook price. Commission is not modelled and settlement is by hand.',
    reads: ['Order and position screens'],
    caution: 'Never settled automatically. Exchange positions are handed back to you.'
  }
];

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
   CALCULATORS
   ============================================================
   Four, and only four, because these are the ones that are pure
   arithmetic. A closing line value calculator needs a closing price,
   which we do not have a feed for, so the one here asks you to type the
   price you are comparing against rather than pretending to know it.
   ============================================================ */
const num = v => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return isFinite(n) ? n : 0; };
const gbp = n => (n < 0 ? '−£' : '£') + Math.abs(n).toFixed(2);

export const CALCS = [
  {
    id: 'ew', name: 'Each way return',
    lede: 'A £10 each way bet is two £10 bets. This is what comes back when the win half lands, when only the place half lands, and when neither does.',
    fields: [
      ['ewStake', 'Stake each way', '10', '£'],
      ['ewOdds', 'Win odds', '8.00', ''],
      ['ewFrac', 'Place fraction (1/N)', '5', '1/'],
      ['ewPlaces', 'Places paid', '3', '']
    ],
    run(v) {
      const s = num(v.ewStake), o = num(v.ewOdds), f = num(v.ewFrac) || 1;
      const placeOdds = 1 + (o - 1) / f;
      const win = s * o + s * placeOdds;
      const place = s * placeOdds;
      return [
        ['Total staked', gbp(s * 2)],
        ['Place price', (placeOdds).toFixed(2)],
        ['Wins the race', gbp(win) + ' back, ' + gbp(win - s * 2) + ' profit'],
        ['Places only', gbp(place) + ' back, ' + gbp(place - s * 2) + ' profit'],
        ['Unplaced', gbp(0) + ' back, ' + gbp(-s * 2) + ' profit']
      ];
    },
    said: v => {
      const s = num(v.ewStake), o = num(v.ewOdds), f = num(v.ewFrac) || 1;
      const place = s * (1 + (o - 1) / f);
      return place > s * 2
        ? 'Placing alone is profitable at this price. The place half is doing real work.'
        : 'Placing alone still loses ' + gbp(s * 2 - place) + '. The win half is the whole bet.';
    }
  },
  {
    id: 'acca', name: 'Accumulator odds',
    lede: 'Multiply the legs. Type one price per line and it works out the combined price and the return, including what happens when a leg is voided and drops out.',
    fields: [
      ['acStake', 'Stake', '10', '£'],
      ['acLegs', 'One price per line', '1.80\n2.10\n1.55', 'ta']
    ],
    run(v) {
      const s = num(v.acStake);
      const legs = String(v.acLegs || '').split(/[\n,]/).map(num).filter(n => n > 1);
      const comb = legs.reduce((a, b) => a * b, 1);
      const dropped = legs.length > 1 ? legs.slice(0, -1).reduce((a, b) => a * b, 1) : 1;
      return [
        ['Legs', String(legs.length)],
        ['Combined price', legs.length ? comb.toFixed(2) : '—'],
        ['Returns', gbp(s * comb)],
        ['Profit', gbp(s * comb - s)],
        ['If the last leg voids', legs.length > 1 ? dropped.toFixed(2) + ' for ' + gbp(s * dropped) : 'stake back']
      ];
    },
    said: v => {
      const legs = String(v.acLegs || '').split(/[\n,]/).map(num).filter(n => n > 1);
      if (legs.length < 2) return 'Add a second price and this becomes an accumulator.';
      const imp = legs.reduce((a, b) => a * (1 / b), 1);
      return 'Every leg has to land. Priced as fair, that is a ' + (imp * 100).toFixed(1) + '% chance.';
    }
  },
  {
    id: 'r4', name: 'Rule 4 deduction',
    lede: 'When a horse is withdrawn after the market forms, winnings are cut by a deduction based on the withdrawn horse\'s price. This applies to the profit, never to the stake.',
    fields: [
      ['r4Stake', 'Stake', '20', '£'],
      ['r4Odds', 'Your odds', '6.00', ''],
      ['r4With', 'Withdrawn horse\'s odds', '3.00', '']
    ],
    run(v) {
      const s = num(v.r4Stake), o = num(v.r4Odds), w = num(v.r4With);
      /* The deduction is in pence per pound of winnings, banded off the
         withdrawn horse's price. This is the standard tattersalls table,
         written as bands rather than a formula because it is a table. */
      const p = w > 1 ? 1 / w : 0;
      const bands = [
        [0.9, 90], [0.8286, 85], [0.7692, 80], [0.6897, 75], [0.6154, 70],
        [0.5556, 65], [0.5, 60], [0.4444, 55], [0.4, 50], [0.3636, 45],
        [0.3333, 40], [0.3077, 35], [0.2857, 30], [0.25, 25], [0.2222, 20],
        [0.1818, 15], [0.1429, 10], [0.1, 5], [0.0667, 0]
      ];
      let ded = 0;
      for (const [thresh, pence] of bands) if (p >= thresh) { ded = pence; break; }
      const gross = s * (o - 1);
      const cut = gross * ded / 100;
      return [
        ['Deduction', ded + 'p in the pound'],
        ['Winnings before', gbp(gross)],
        ['Deducted', gbp(cut)],
        ['Winnings after', gbp(gross - cut)],
        ['Total back', gbp(s + gross - cut)]
      ];
    },
    said: v => {
      const w = num(v.r4With);
      return w >= 15
        ? 'At odds this long there is no deduction at all. Rule 4 starts below 14/1.'
        : 'The stake is never cut. Only the winnings are.';
    }
  },
  {
    id: 'clv', name: 'Closing line value',
    lede: 'Compare the price you took against the price at the off. Beating the closing line consistently is the only cheap evidence that you are picking well rather than running hot.',
    fields: [
      ['clYours', 'Your odds', '2.20', ''],
      ['clClose', 'Closing odds', '2.00', '']
    ],
    run(v) {
      const a = num(v.clYours), b = num(v.clClose);
      const edge = a > 0 && b > 0 ? (a / b - 1) * 100 : 0;
      return [
        ['Your implied chance', a > 1 ? (100 / a).toFixed(1) + '%' : '—'],
        ['Closing implied chance', b > 1 ? (100 / b).toFixed(1) + '%' : '—'],
        ['Value against the close', (edge >= 0 ? '+' : '−') + Math.abs(edge).toFixed(1) + '%']
      ];
    },
    said: v => {
      const a = num(v.clYours), b = num(v.clClose);
      if (!(a > 1 && b > 1)) return 'Type both prices.';
      return a > b
        ? 'You beat the close. One bet proves nothing; a hundred of these is evidence.'
        : a < b
          ? 'The market moved against you. Repeated, that is the expensive kind of pattern.'
          : 'You matched the close exactly.';
    }
  }
];

function calcMarkup(c) {
  return '<div class="calc card pad" data-calc="' + esc(c.id) + '">' +
    '<h2 class="calch">' + esc(c.name) + '</h2>' +
    '<p class="calclede">' + esc(c.lede) + '</p>' +
    '<div class="calcfields">' + c.fields.map(([id, label, def, pre]) =>
      pre === 'ta'
        ? '<label class="fld"><span>' + esc(label) + '</span>' +
          '<textarea id="' + id + '" rows="3" data-cf>' + esc(def) + '</textarea></label>'
        : '<label class="fld"><span>' + esc(label) + '</span>' +
          '<input id="' + id + '" type="text" inputmode="decimal" value="' + esc(def) + '" data-cf>' +
          '</label>').join('') + '</div>' +
    '<dl class="calcout" id="out-' + esc(c.id) + '"></dl>' +
    '<p class="sect-said" id="said-' + esc(c.id) + '"></p></div>';
}

function runCalc(c) {
  const v = {};
  for (const [id] of c.fields) { const el = $(id); v[id] = el ? el.value : ''; }
  setHTML('out-' + c.id, c.run(v).map(([k, val]) =>
    '<div><dt>' + esc(k) + '</dt><dd class="m">' + esc(val) + '</dd></div>').join(''));
  setHTML('said-' + c.id, esc(c.said(v)));
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
    'The calculators page has this as a live sum if you want to check a specific price.'],
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
    'Public tipster pages and password-shared bankrolls are not built. See the roadmap for why.'],
  ['What about racing?',
    ['Racing bets are logged, tracked and counted', 'They are never settled automatically', 'Rule 4, each way terms and starting prices are calculators, not feeds'],
    'No results feed we trust publishes finishing positions we can prove, so racing is handed back to you rather than guessed at. That is the same rule the football engine follows.']
];

/* ============================================================
   ROADMAP AND CHANGELOG
   ============================================================ */
const SOON = [
  ['Planned', 'Export to Excel as well as CSV', 'CSV covers a spreadsheet already; a real .xlsx keeps the number formatting and the tab names.'],
  ['Planned', 'Fixture autocomplete when you type', 'The fixture list is already pulled for settlement. Offering it as you type is the same data, earlier.'],
  ['Planned', 'Per-competition and per-team breakdowns on your own ledger', 'The landing page shows this on the sample. It needs enough of your own bets matched to fixtures to be worth showing.'],
  ['Planned', 'Sample size significance', 'A win rate over eleven bets means nothing and the interface should say so rather than print it in green.'],
  ['Research', 'Closing line value', 'Needs a closing price for every market, which no free source publishes. It is a paid feed or it is a guess, and a guessed CLV is worse than none.'],
  ['Research', 'Automatic racing settlement', 'Needs finishing positions we can prove, including non-runners and Rule 4. Every free source we have tested disagrees with the others often enough to be dangerous.'],
  ['Research', 'Discord as well as Telegram', 'A second bot is a second credential and a second webhook to keep alive. Worth doing when more than a couple of people ask.'],
  ['Research', 'Public tipster pages', 'A public leaderboard of gambling returns has a regulatory position that needs answering before it is built, not after.']
];

const LOG = [
  ['0.9.0', '13 Aug 2026', [
    ['New', 'A demo you can look around without an account, running on a labelled sample rather than anyone\'s real record'],
    ['New', 'Bookmaker pages saying what is different about grading each one, rather than the same page with a name swapped in'],
    ['New', 'Four calculators: each way returns, accumulator odds, Rule 4 deductions and closing line value'],
    ['New', 'A reference FAQ answered with lists, including the exact profit and loss formula for every result type'],
    ['New', 'This changelog, and a roadmap that says which items are blocked and why'],
    ['Improved', 'One footer on every page, including inside the app, so signing in no longer removes every route out except the tab bar'],
    ['Fixed', 'Four screens of dead scroll on the landing page, most of it a pinned sequence reserving height it never filled']
  ]],
  ['0.8.0', '12 Aug 2026', [
    ['New', 'The capture line reports the real three-way split: logged at placement, in play, or after settling'],
    ['New', 'Take a break, enforced on the server, extendable but never shortenable'],
    ['Improved', 'Settlement narrows its fixture window to the age of the oldest pending bet, which took a live settle from timing out to 7.8 seconds'],
    ['Fixed', 'The slip reader had never worked in production. The schema passed 29 union-typed fields against a limit of 16 and the error was being swallowed'],
    ['Fixed', 'Reset all bets, delete account, delete images and add totals all confirmed actions they never performed']
  ]],
  ['0.7.0', '10 Aug 2026', [
    ['New', 'Profit and loss screenshots import as dated rows and land on the right days in the calendar'],
    ['New', 'Bet numbering starts at zero, with a Settings toggle between the tracker count and the lifetime count'],
    ['Improved', 'The import interface adds and removes selections without leaving the page'],
    ['Fixed', 'A delegated click handler matched the root element, which silently killed import, signup, the unit row and both dropzones']
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

  setHTML('calcList', CALCS.map(calcMarkup).join(''));
  for (const c of CALCS) {
    runCalc(c);
    for (const [id] of c.fields) on($(id), 'input', () => runCalc(c));
  }

  setHTML('faqsBody', FAQS.map(([q, items, said]) =>
    '<details class="card faq"><summary>' + esc(q) + '</summary>' +
    '<ul class="faqul">' + items.map(i => '<li>' + esc(i) + '</li>').join('') + '</ul>' +
    '<p class="faqsaid">' + esc(said) + '</p></details>').join(''));

  setHTML('soonList', SOON.map(([status, title, why]) =>
    '<div class="sooncard reveal"><span class="soonbadge ' + status.toLowerCase() + '">' + esc(status) + '</span>' +
    '<h2>' + esc(title) + '</h2><p>' + esc(why) + '</p></div>').join(''));

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
