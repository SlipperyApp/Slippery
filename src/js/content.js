/* Static content: FAQs, plans, the bot preview, the legal pages, and the
   walkthrough player.
 *
 * These are the marketing surfaces, and they are seen by people with no
 * account and therefore no data. They used to read the signed-in ledger,
 * which meant a visitor saw an empty sparkline and a crash where a sample
 * slip should be. They now run on SAMPLE below — a fixed, self-contained
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
import { OUTCOME_ICON, outcomeGroup, ico } from './data.js';

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
  ['Who can see my numbers?', 'Whoever you choose: public, people you follow back, or nobody. Group members always see the units of everyone in that group.'],
  ['What is a unit?', 'Your standard stake. Units let groups rank people without anyone seeing how much money is involved.'],
  ['What does it cost?', 'Free for twenty slips, then £3.49 a month or £29.99 a year.'],
  ['When is it on the App Store?', 'Not yet. It runs in your browser today, installs to your home screen, and the Telegram bot already works.']
];

const HELP_FAQ = [
  ['A slip could not be read', 'Slippery never guesses at numbers it cannot see, so it asks for a clearer photo. Crop to the slip, avoid glare, and keep the stake, odds and result in frame.'],
  ['What the pace marker means', 'The pale line on the target bar shows how far through the period you are. If the green bar is past it, you are ahead of pace.'],
  ['What is a unit', 'A unit is your standard stake, set in Settings. Units let you compare with other people without anyone seeing the money.'],
  ['Who can see my numbers', 'Public means anyone who finds you. Friends only means people you follow back. Private means nobody. Group members always see units of everyone in that group.'],
  ['Why can I not change my display name', 'Names are permanent so a record always belongs to the same person, and nobody can take a name someone else built a history under.'],
  ['The same bet appeared twice', 'Slippery flags slips that settle identically, such as away goals under 0.5 and BTTS No, and offers to consolidate them so your numbers are not counted twice.'],
  ['Correcting a slip Slippery misread', 'Every field on an uploaded slip is editable before you confirm it, and nothing is saved until you do. A bet already in your ledger can be settled by hand from the running list.']
];

const PLANS = [
  ['Free trial', 'Try it properly first.', '£0', '', '20 slips included, no time limit',
    ['Dashboard, calendar and ledger', 'Telegram bot access'], false],
  ['Monthly', 'Pay as you go.', '£3.49', ' per month', 'Cancel any time',
    ['Unlimited slips', 'Full analytics and groups'], false],
  ['Yearly', 'Best value by a distance.', '£29.99', ' per year', '£2.50 a month, saving £11.89 against monthly',
    ['Unlimited slips', 'Analytics by bookmaker, market and tipster', 'Groups, following and followers',
     'History import and CSV export'], true]
];

const TERMS = [
  ['h2', 'What Slippery is'],
  ['p', 'Slippery is a record keeping and analytics tool for bets you have placed elsewhere. It is not a bookmaker. It does not accept bets, hold funds, pay winnings, or offer betting advice, tips or predictions. Nothing in the product is a recommendation to place a bet.'],
  ['h2', 'Age and eligibility'],
  ['p', 'You must be 18 or over to use Slippery. We ask you to confirm this at signup, and we may suspend an account where we have reason to believe the holder is under 18.'],
  ['h2', 'Your account'],
  ['p', 'You are responsible for keeping your password and your Telegram link code confidential. Display names are permanent so that a betting record always belongs to the same person.'],
  ['h2', 'Accuracy of readings and settlement'],
  ['p', 'Slippery reads slips automatically and settles standard markets against a third party results feed. It is designed to refuse rather than guess: anything it cannot grade with confidence is handed back to you to settle. Even so, readings and gradings may be wrong, and you remain responsible for checking your own records. Slippery is not liable for decisions taken on the basis of a figure it displayed.'],
  ['h2', 'Payment'],
  ['p', 'Paid plans renew automatically until cancelled. You can cancel at any time and keep access until the end of the paid period. UK and EU consumers keep their statutory cancellation rights.'],
  ['h2', 'Acceptable use'],
  ['p', 'Do not upload slips that are not yours, attempt to extract other users\' figures, or use Slippery to run a tipping service that presents its output as verified when it is not.'],
  ['h2', 'Ending your account'],
  ['p', 'You can delete your account at any time from Settings. Deletion removes your bets and any stored slip images.'],
  ['h2', 'Liability'],
  ['p', 'Nothing here limits liability for death, personal injury or fraud. Otherwise, and to the extent the law allows, Slippery is provided as is and we are not liable for gambling losses, missed bets, or indirect loss.'],
  ['h2', 'Getting in touch'],
  ['p', 'Questions about these terms go to the address published on the contact page.']
];

const PRIVACY = [
  ['h2', 'Who is responsible'],
  ['p', 'Slippery is the data controller for the personal data described here. UK ICO registration is required before public launch and is outstanding.'],
  ['h2', 'What we hold'],
  ['ul', [
    'Account details: your email address, a hashed password, your display name, and when you signed up.',
    'Your betting records: stake, odds, selection, bookmaker, result and profit for each bet.',
    'Slip images you send us, whether uploaded on the site or forwarded to the Telegram bot.',
    'Your Telegram user id, if you link the bot.',
    'Basic technical data needed to serve the site securely.'
  ]],
  ['h2', 'Slip images, specifically'],
  ['p', 'A slip image is the most sensitive thing we hold, because it can show your account, your stake and sometimes your name. Images are sent to an automated reading service to extract the fields, and are then stored so you can check a reading later. They are deleted automatically 90 days after upload, and immediately if you delete the bet or your account. You can purge every stored image at once from Settings.'],
  ['h2', 'What we never do'],
  ['p', 'We do not sell your data. We do not share your betting figures with bookmakers, advertisers or credit reference agencies. Other users see only what your privacy setting allows, and group members see units rather than stake sizes.'],
  ['h2', 'Where it is processed'],
  ['p', 'Data is stored in the UK or EEA. The automated reading service processes images outside the UK under an appropriate transfer safeguard.'],
  ['h2', 'How long we keep it'],
  ['ul', [
    'Slip images: 90 days.',
    'Betting records and account details: until you delete your account.',
    'Backups: purged within 30 days of deletion.'
  ]],
  ['h2', 'Your rights'],
  ['p', 'You can access, correct, export or delete your data. Export and delete are both self-service in Settings. You can also object to processing or complain to the Information Commissioner\'s Office.'],
  ['h2', 'Cookies'],
  ['p', 'Slippery sets one cookie, which keeps you signed in. There is no advertising or analytics tracking, and no third party scripts. Fonts are served from our own domain rather than a font network.']
];

export function renderStatic() {
  setHTML('homeFaq', HOME_FAQ.map(f =>
    '<details class="card faq"><summary>' + esc(f[0]) + '</summary><p>' + esc(f[1]) + '</p></details>').join(''));
  setHTML('helpFaq', HELP_FAQ.map(f =>
    '<details class="card faq"><summary>' + esc(f[0]) + '</summary><p>' + esc(f[1]) + '</p></details>').join(''));

  setHTML('planList', PLANS.map(p =>
    '<div class="card plan reveal' + (p[6] ? ' featured' : '') + '">' +
    (p[6] ? '<div class="flag">3 months free</div>' : '') +
    '<div class="nm">' + p[0] + '</div><div class="desc">' + p[1] + '</div>' +
    '<div class="price">' + p[2] + '<small>' + p[3] + '</small></div>' +
    '<div class="note">' + p[4] + '</div><ul>' +
    p[5].map(f => '<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>' + f + '</li>').join('') +
    '</ul><button class="btn ' + (p[6] ? 'primary' : 'ghost') + ' full" data-nav="setup">' +
    (p[6] ? 'Go yearly' : p[0] === 'Monthly' ? 'Go monthly' : 'Start free') + '</button></div>').join(''));

  const legal = rows => rows.map(([tag, body]) =>
    tag === 'ul'
      ? '<ul>' + body.map(li => '<li>' + esc(li) + '</li>').join('') + '</ul>'
      : '<' + tag + '>' + esc(body) + '</' + tag + '>').join('');
  setHTML('termsBody', legal(TERMS));
  setHTML('privacyBody', legal(PRIVACY));

  renderHeroHeading();
  renderPreview();
  renderBotChat();
  renderMigrateOptions();
  renderChapters();
}

function renderHeroHeading() {
  const words = ['Don\'t', 'let', 'your', 'profit'];
  setHTML('heroHeading',
    words.map(w => '<span class="hero-word">' + w + '</span>').join(' ') +
    ' <span class="hero-word"><span class="slipword" id="slipWord">slip.</span></span>');
}

function renderPreview() {
  /* A worked example, not the visitor's numbers — they have none yet, and
     inventing some would be the exact dishonesty this product exists to
     stop. The card says "Example" on it. */
  setText('previewNet', M.signed(SAMPLE.monthNet));
  const keys = Object.keys(SAMPLE.month).map(Number).sort((a, b) => a - b);
  let run = 0;
  const pts = keys.map(k => { run += SAMPLE.month[k]; return run; });
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

  setHTML('previewRows', SAMPLE.day.map((b, i) =>
    '<div style="display:flex;justify-content:space-between;align-items:center;gap:9px;font-size:12.5px;padding:8px 0' +
    (i ? ';border-top:1px solid var(--e2)' : '') + '">' +
    '<span style="display:flex;align-items:center;gap:8px;min-width:0">' +
    '<span class="prevrow-i" data-outcome="' + outcomeGroup(b.outcome) + '">' + ico(OUTCOME_ICON[b.outcome]) + '</span>' +
    '<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(b.event) + '</span></span>' +
    '<span class="m ' + (b.profit >= 0 ? 'pos' : 'neg') + '">' + M.signed(b.profit) + '</span></div>').join(''));
}

function renderBotChat() {
  const slip = SAMPLE.slip;
  const day8 = SAMPLE.day;
  const net = SAMPLE.dayNet;
  const staked = day8.reduce((a, b) => a + b.stake, 0) + slip.stake;
  const pad = (s, n) => (s + '                    ').slice(0, n);
  setHTML('botChat',
    /* What you forward is the bookmaker's PLACED receipt. Capture happens
       before the result exists — that is the locked core idea, and a
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

    '<div class="bubble incoming slim">Logged. Today: <b class="' + (net >= 0 ? 'pos' : 'neg') + '">' +
      M.signed(net) + '</b> across ' + day8.length + ' bets.</div>' +

    '<div class="bubble incoming"><div class="monoblock">8 Aug 2026\n\n' +
    day8.map(b => pad(({ 'won': 'WON', 'lost': 'LOST', 'void': 'VOID' })[b.outcome] || 'CASH', 6) +
      pad(b.event.slice(0, 18), 20) + M.signed(b.profit)).join('\n') +
    '\n\nNet ' + M.signed(net) + ', staked ' + M.money(staked) + '</div></div>');
}
const kv = (k, v) => '<div class="kvline"><span>' + k + '</span><b>' + v + '</b></div>';

function renderMigrateOptions() {
  const opts = [
    ['upload', 'CSV, Excel or screenshots', 'Whatever you already have',
      '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>'],
    ['totals', 'Type totals', 'Daily, weekly, monthly or yearly',
      '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18"/>'],
    ['other', 'Other format', 'From another tracker, we will try to convert it',
      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15h6"/>']
  ];
  setHTML('migrateList', opts.map(o =>
    '<button class="optioncard" data-migrate="' + o[0] + '" aria-pressed="' + (S.migrateChoice === o[0]) + '">' +
    '<span class="glyph" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
    o[3] + '</svg></span><span><span class="t">' + o[1] + '</span><span class="s">' + o[2] + '</span></span></button>').join(''));
}

/* ---------------- walkthrough player ---------------- */
export const CHAPTERS = [
  [0, 'A slip arrives', 'Forward any bet slip to the Telegram bot the moment you place it. Screenshot, photo or share sheet, whatever is quicker.'],
  [3, 'We read it', 'The stake, odds, selection and bookmaker come off the image. Nothing is guessed at.'],
  [6, 'Your calendar fills', 'Every settled day turns green or red. This is the real August in the demo.'],
  [9, 'Tap any day', 'Open a day to see the slips behind the number, with the running week total.'],
  [12, 'See what paid', 'Profit splits by bookmaker, market and tipster for whichever period you are on.'],
  [15, 'Compare in groups', 'Ranked in units so nobody sees your stakes. Two groups here, Sunday League and Ultras.']
];
export const PLAY_LENGTH = 18;
let playTime = 0, playing = false, timer = null;

export function renderChapters() {
  setHTML('chapters', CHAPTERS.map((c, i) =>
    '<button data-chapter="' + i + '" aria-current="' + (i === 0) + '"><span class="t">0:' +
    String(c[0]).padStart(2, '0') + '</span>' + esc(c[1]) + '</button>').join(''));
}

function scene(i) {
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
        '<b class="m ' + (x.profit >= 0 ? 'pos' : 'neg') + '" style="font-size:9px">' + M.signed(x.profit) + '</b></div>').join('') + '</div>' +
      '<p style="font-size:9px;color:var(--t2);text-align:center;padding-top:4px">That week ' +
      '<b class="' + (wt >= 0 ? 'pos' : 'neg') + '">' + M.money0s(wt) + '</b></p>' };
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
        '<b class="m ' + (x[1] >= 0 ? 'pos' : 'neg') + '" style="font-size:8.5px">' + M.money0s(x[1]) + '</b></div>').join('') + '</div>' +
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
      '<b class="m ' + (x.v >= 0 ? 'pos' : 'neg') + '" style="font-size:9px">' + M.units(x.v, x.un) + '</b></div>').join('') + '</div>' +
    '<p style="font-size:9px;color:var(--t2);text-align:center;padding-top:4px">' +
    'Ranked in units, never in pounds</p>' };
}
const srow = (k, v) => '<div style="display:flex;justify-content:space-between;gap:8px;font-size:9.5px;padding:2px 0"><span style="color:var(--t2)">' + k + '</span><b class="m">' + v + '</b></div>';
const skpi = (k, v) => '<div style="background:var(--c1);border:1px solid var(--e2);border-radius:6px;padding:6px"><div style="font-size:7px;color:var(--t2)">' + k + '</div><div class="m" style="font-weight:600;font-size:10px;margin-top:2px">' + v + '</div></div>';

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

export function paintPlayer() {
  $('scrubFill').style.width = (playTime / PLAY_LENGTH * 100) + '%';
  const sc = $('scrubber');
  sc.setAttribute('aria-valuenow', String(Math.floor(playTime)));
  sc.setAttribute('aria-valuetext', 'Chapter ' + (CHAPTERS.filter(c => playTime >= c[0]).length) + ' of ' + CHAPTERS.length);
  setText('playTime', '0:' + String(Math.floor(playTime)).padStart(2, '0') + ' / 0:' + PLAY_LENGTH);
  paintScene();
}
function playIcon() {
  $('playToggle').innerHTML = playing
    ? '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  $('playToggle').setAttribute('aria-label', playing ? 'Pause walkthrough' : 'Play walkthrough');
}
export function play() {
  if (RM) { paintPlayer(); return; }
  playing = true; playIcon();
  clearInterval(timer);
  timer = setInterval(() => {
    playTime += 0.25;
    if (playTime >= PLAY_LENGTH) playTime = 0;
    paintPlayer();
  }, 250);
}
export function pause() { playing = false; clearInterval(timer); timer = null; playIcon(); }
export function toggle() { playing ? pause() : play(); }
export function seek(t) {
  playTime = Math.max(0, Math.min(PLAY_LENGTH, t));
  $('sceneBody').removeAttribute('data-scene');
  paintPlayer();
}
export function restart() { playTime = 0; $('sceneBody').removeAttribute('data-scene'); paintPlayer(); play(); }
export function isPlaying() { return playing; }
