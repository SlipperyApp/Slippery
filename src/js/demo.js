/* The public demo. No account, nothing editable, someone else's numbers.
 *
 * The point of it is that a stranger can see what the analysis looks like
 * before handing over an email. That only works if it is explorable rather
 * than a picture of a dashboard: the periods switch, the days open, the
 * ledger sorts. Anything that would need an account says so and offers the
 * signup rather than failing.
 *
 * Every figure comes from sample.js, which is fabricated and labelled as
 * fabricated twice on the page. It never reaches the app.
 */
import { $, esc, setHTML, on } from './dom.js';
import * as M from './money.js';
import { DEMO, DEMO_BETS, DEMO_DAYS, DEMO_DRAWDOWN } from './sample.js';

const pct = n => (n >= 0 ? '+' : '−') + Math.abs(n).toFixed(1) + '%';

/* Which period the KPI block is showing. Local to the demo, deliberately:
   the app's own period state belongs to a signed-in ledger and the two
   must not share a variable. */
let period = 'all';
let openDay = null;

const PERIODS = [
  ['d', 'Today'],
  ['w', 'This week'],
  ['m', 'This month'],
  ['all', 'All ' + DEMO_DAYS + ' days']
];

const bucketFor = p =>
  p === 'd' ? DEMO.today : p === 'w' ? DEMO.week : p === 'm' ? DEMO.month : DEMO.total;

function kpis() {
  const b = bucketFor(period);
  const label = (PERIODS.find(p => p[0] === period) || PERIODS[3])[1];
  const tile = (k, v, tone, sub) =>
    '<div class="dtile"><span class="dk">' + esc(k) + '</span>' +
    '<span class="dv ' + (tone || '') + '">' + v + '</span>' +
    (sub ? '<span class="ds">' + esc(sub) + '</span>' : '') + '</div>';

  return '<div class="dtiles">' +
    tile('Profit and loss', M.signed(b.profit), M.tone(b.profit), label) +
    tile('Staked', M.money(b.staked), '', b.bets + (b.bets === 1 ? ' bet' : ' bets')) +
    tile('Return on turnover', b.staked ? pct(b.roi) : '—', M.tone(b.profit), 'profit over staked') +
    tile('Win rate', (b.wins + b.losses) ? b.winRate.toFixed(1) + '%' : '—', '',
      b.wins + 'W – ' + b.losses + 'L') +
    tile('Pending stake', M.money(DEMO.pendingStake), '',
      DEMO.pendingCount + ' still running') +
    tile('Average odds', DEMO.avgOdds.toFixed(2), '', 'settled bets') +
    '</div>';
}

/* ---------- the cumulative curve ----------
   One point per settled bet, oldest first. A cumulative curve is the only
   chart worth putting on this page: a single profit figure cannot show a
   losing run, and the losing run is the part everyone underestimates. */
function curve() {
  const pts = DEMO.curve;
  if (pts.length < 2) return '';
  const W = 300, H = 90;
  const lo = Math.min(0, ...pts), hi = Math.max(0, ...pts);
  const span = hi - lo || 1;
  const x = i => (i / (pts.length - 1)) * W;
  const y = v => H - ((v - lo) / span) * H;
  const line = pts.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
  const area = line + ' L' + W + ' ' + y(lo).toFixed(1) + ' L0 ' + y(lo).toFixed(1) + ' Z';
  const zero = y(0).toFixed(1);
  const end = pts[pts.length - 1];
  const colour = end >= 0 ? '#86EFAC' : '#FCA5A5';

  return '<div class="card pad">' +
    '<div class="cardhead"><span class="title">Where the money actually went</span>' +
    '<span class="meta">Last ' + DEMO_DAYS + ' days</span></div>' +
    '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" class="dcurve" ' +
    'role="img" aria-label="Cumulative profit and loss across ' + pts.length + ' settled bets, ' +
    'ending at ' + M.signed(end) + '">' +
    '<defs><linearGradient id="demoFill" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0" stop-color="' + colour + '" stop-opacity=".34"/>' +
    '<stop offset="1" stop-color="' + colour + '" stop-opacity=".02"/></linearGradient></defs>' +
    '<line x1="0" y1="' + zero + '" x2="' + W + '" y2="' + zero + '" class="dzero"/>' +
    '<path d="' + area + '" fill="url(#demoFill)"/>' +
    '<path d="' + line + '" fill="none" stroke="' + colour + '" stroke-width="2" ' +
    'stroke-linejoin="round" stroke-linecap="round"/></svg>' +
    '<p class="sect-said">A cumulative curve makes a losing run obvious in a way a single ' +
    'profit figure never does. The worst stretch in this record is ' +
    '<b class="neg">' + M.money(DEMO_DRAWDOWN.depth) + '</b> from its own high point, around bet ' +
    DEMO_DRAWDOWN.at + ' of ' + DEMO_DRAWDOWN.of + '. That is the part most people quit during.</p>' +
    '</div>';
}

/* ---------- a breakdown table ---------- */
function table(title, meta, firstCol, rows, said) {
  return '<div class="card pad">' +
    '<div class="cardhead"><span class="title">' + esc(title) + '</span>' +
    '<span class="meta">' + esc(meta) + '</span></div>' +
    /* tabindex, or a keyboard user cannot reach the columns that sit off
       screen at 320px. Same reason as the cookies table. */
    '<div class="dtable" tabindex="0" role="group" aria-label="' + esc(title) + '"><table><thead><tr>' +
    '<th>' + esc(firstCol) + '</th><th>Bets</th><th>Staked</th><th>P/L</th><th>ROI</th>' +
    '</tr></thead><tbody>' +
    rows.map(r =>
      '<tr><td>' + esc(r.label) + '</td>' +
      '<td class="m">' + r.bets + '</td>' +
      '<td class="m">' + M.money0(r.staked) + '</td>' +
      '<td class="m ' + M.tone(r.profit) + '">' + M.signed(r.profit) + '</td>' +
      '<td class="m ' + M.tone(r.profit) + '">' + (r.staked ? pct(r.roi) : '—') + '</td></tr>').join('') +
    '</tbody></table></div>' +
    '<p class="sect-said">' + said + '</p></div>';
}

const best = rows => rows.slice().sort((a, b) => b.roi - a.roi)[0];
const worst = rows => rows.slice().sort((a, b) => a.roi - b.roi)[0];
const verdict = rows => {
  const b = best(rows), w = worst(rows);
  return 'Best: <b class="pos">' + esc(b.label) + ' (' + pct(b.roi) + ')</b> · ' +
    'Avoid: <b class="neg">' + esc(w.label) + ' (' + pct(w.roi) + ')</b>';
};

/* ---------- the day strip ----------
   Tappable, because the brief asks for explorable rather than a video, and
   because a day is the unit people actually think in. */
function dayStrip() {
  const days = DEMO.days.slice(0, 21);
  return '<div class="card pad">' +
    '<div class="cardhead"><span class="title">Any day, opened</span>' +
    '<span class="meta">tap one</span></div>' +
    '<div class="dstrip">' + days.map(d => {
      const label = new Date(d.date + 'T12:00:00')
        .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' });
      return '<button class="dchip' + (openDay === d.date ? ' on' : '') +
        '" data-demoday="' + esc(d.date) + '">' +
        '<span class="dcd">' + esc(label) + '</span>' +
        '<span class="dcn ' + M.tone(d.net) + '">' + M.signed(d.net) + '</span></button>';
    }).join('') + '</div>' +
    '<div id="demoDay"></div></div>';
}

function dayBody() {
  if (!openDay) return '<p class="hinttext" style="margin-top:11px">Nothing selected. Tapping a day opens the bets behind its figure.</p>';
  const d = DEMO.days.find(x => x.date === openDay);
  if (!d) return '';
  const full = new Date(d.date + 'T12:00:00')
    .toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  return '<div class="dday"><p class="ddayh">' + esc(full) + '<b class="' + M.tone(d.net) + '">' +
    M.signed(d.net) + '</b></p>' +
    d.bets.map(b =>
      '<div class="drow2"><span class="dl"><b>' + esc(b.event) + '</b>' +
      '<i>' + esc(b.selection) + ' · ' + b.odds.toFixed(2) + ' · ' + M.money(b.stake) + '</i></span>' +
      '<span class="dr ' + (b.result === 'pending' ? 'mut' : M.tone(b.profit)) + '">' +
      (b.result === 'pending' ? 'Running' : M.signed(b.profit)) + '</span></div>').join('') +
    '</div>';
}

/* ---------- the ledger ---------- */
function recent() {
  return '<div class="card pad">' +
    '<div class="cardhead"><span class="title">Recent bets</span>' +
    '<span class="meta">the most recent in the sample</span></div>' +
    '<div class="dtable" tabindex="0" role="group" aria-label="Recent bets"><table><thead><tr>' +
    '<th>Date</th><th>Event</th><th>Selection</th><th>Odds</th><th>Stake</th><th>Result</th><th>P/L</th>' +
    '</tr></thead><tbody>' +
    DEMO.recent.map(b =>
      '<tr><td class="m">' + esc(b.date.slice(8) + '/' + b.date.slice(5, 7)) + '</td>' +
      '<td>' + esc(b.event) + '</td><td>' + esc(b.selection) + '</td>' +
      '<td class="m">' + b.odds.toFixed(2) + '</td>' +
      '<td class="m">' + M.money0(b.stake) + '</td>' +
      '<td><span class="dres ' + esc(b.result) + '">' + esc(resultLabel(b.result)) + '</span></td>' +
      '<td class="m ' + M.tone(b.profit) + '">' + M.signed(b.profit) + '</td></tr>').join('') +
    '</tbody></table></div>' +
    '<p class="sect-said">Every row here is stake times odds minus one on a win, minus the ' +
    'stake on a loss, and zero on a void or a push. Add the column up and it reconciles with ' +
    'the headline, which is the least a record should do.</p></div>';
}

const LABELS = {
  won: 'Won', lost: 'Lost', void: 'Void', push: 'Push',
  'cash-profit': 'Cashed out', 'cash-loss': 'Cashed out', 'cash-flat': 'Cashed out',
  pending: 'Running'
};
const resultLabel = r => LABELS[r] || r;

export function renderDemoPage() {
  const el = $('demoBody');
  if (!el) return;

  el.innerHTML =
    '<div class="dperiods" id="demoPeriods" role="group" aria-label="Period">' +
    PERIODS.map(([k, label]) =>
      '<button class="dperiod' + (period === k ? ' on' : '') + '" data-demoperiod="' + k + '"' +
      (period === k ? ' aria-pressed="true"' : ' aria-pressed="false"') + '>' +
      esc(label) + '</button>').join('') + '</div>' +

    '<h2 class="dsecth">The headline numbers</h2>' +
    kpis() +

    '<h2 class="dsecth">The shape of it</h2>' +
    curve() +

    '<h2 class="dsecth">Where it came from</h2>' +
    '<div class="dgrid">' +
    table('By odds range', 'performance grouped by the odds taken', 'Odds', DEMO.byBand,
      verdict(DEMO.byBand) + '. The middle of the book is doing the work and the long shots ' +
      'are paying for it, which is the finding people are most often wrong about before they measure it.') +
    table('By sport', 'performance grouped by sport', 'Sport', DEMO.bySport,
      verdict(DEMO.bySport) + '. Racing is the sport Slippery will not settle for you, and in ' +
      'this record it is also the one losing money. Those two facts are unrelated, and both are worth knowing.') +
    table('By competition', 'football only, matched to fixtures automatically', 'Competition', DEMO.byComp,
      verdict(DEMO.byComp) + '. No tagging was done to produce this. The competition comes off ' +
      'the fixture the bet was matched to.') +
    '</div>' +

    '<h2 class="dsecth">Day by day</h2>' +
    dayStrip() +

    '<h2 class="dsecth">The ledger</h2>' +
    recent();

  setHTML('demoDay', dayBody());
}

/* Called by the one delegated click handler in main.js. */
export function demoPeriod(p) { period = p; renderDemoPage(); }
export function demoDay(d) { openDay = openDay === d ? null : d; renderDemoPage(); }
export { DEMO, DEMO_DAYS };
