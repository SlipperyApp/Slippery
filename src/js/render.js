/* Renderers. Every one reads from data.js / stats.js and writes DOM.
   None of them invent a figure. */
import { $, $$, esc, setText, setHTML, paintSeg } from './dom.js';
import { S } from './state.js';
import * as M from './money.js';
import {
  LEDGER, PENDING, PEOPLE, GROUPS, TODAY, THEMES, THEME_BG, BOOKS, TIPSTERS,
  OUTCOME_ICON, OUTCOME_LABEL, outcomeGroup, personMonths, personDays, IMPORTED, ico, TRIAL, FOUND, PL, CAPTURE
} from './data.js';
import {
  stats, lifetime, dayMap, monthTotal, dowLabels, dowOffset, weekRange, targetFor
} from './stats.js';

export const MS = new Intl.DateTimeFormat('en-GB', { month: 'short' });
export const ML = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });
export const DF = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
export const DS = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

const VERIFIED = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" role="img" aria-label="Verified"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>';
const TELEGRAM = '<svg viewBox="0 0 24 24" role="img" aria-label="Logged via Telegram"><use href="#i-telegram"/></svg>';
const LOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';

const odds = d => M.odds(d, S.oddsFormat);
export const periodWord = () =>
  S.period === 'a' ? 'all time'
  : S.period === 'm' ? (S.month === TODAY.month ? 'this month' : MS.format(new Date(TODAY.year, S.month, 1)))
  : S.period === 'w' ? 'this week' : 'this day';

/* ---------------- bets ---------------- */
export function betRow(b, delay) {
  const grp = outcomeGroup(b.outcome);
  const bits = [b.selection, odds(b.odds), M.money(b.stake), b.book];
  if (S.showTipster && b.tipster) bits.push(b.tipster);
  const main = S.profitFormat === 'Units' ? M.units(b.profit, S.unit)
    : S.profitFormat === 'Both'
      ? M.signed(b.profit) + ' <span class="mut">' + M.units(b.profit, S.unit) + '</span>'
      : M.signed(b.profit);
  const alt = S.profitFormat === 'Units' ? M.signed(b.profit) : M.units(b.profit, S.unit);
  const stamp = (b.month === TODAY.month && b.day === TODAY.day)
    ? b.time : b.day + ' ' + MS.format(new Date(TODAY.year, b.month, 1)) + ' ' + b.time;
  const hay = (b.event + ' ' + bits.join(' ')).toLowerCase();
  return '<div class="betrow" data-outcome="' + grp + '" data-haystack="' + esc(hay) + '"' +
    (delay ? ' style="animation-delay:' + delay + 'ms"' : '') + '>' +
    '<span class="icon" aria-hidden="true">' + ico(OUTCOME_ICON[b.outcome]) + '</span>' +
    '<span class="sr">' + OUTCOME_LABEL[b.outcome] + '.</span>' +
    '<div class="mid"><div class="ev"><span>' + esc(b.event) + '</span>' +
      (b.viaTelegram ? TELEGRAM : '') + '</div>' +
    '<div class="sub">' + esc(bits.join(' · ')) + '</div></div>' +
    '<div class="right"><div class="stamp">' + esc(stamp) + '</div>' +
    '<div class="amt ' + M.tone(b.profit) + '">' + main + '</div>' +
    '<div class="alt">' + alt + '</div></div></div>';
}

function scopedBets() {
  if (S.period === 'a') return LEDGER;
  if (S.period === 'd' && S.focus != null)
    return LEDGER.filter(b => b.month === S.month && b.day === S.focus);
  if (S.period === 'w' && S.focus != null) {
    const r = weekRange(S.month, S.focus, S.weekStart);
    return LEDGER.filter(b => b.month === S.month && b.day >= r.a && b.day <= r.b);
  }
  return LEDGER.filter(b => b.month === S.month);
}

export function renderRecentBets() {
  const list = LEDGER.slice(0, S.showAllBets ? 25 : S.showMore ? 7 : 4);
  const el = $('recentBets');
  el.innerHTML = list.length ? list.map(b => betRow(b)).join('')
    : '<div class="emptystate"><div class="t">No bets yet</div><p>Send a slip to the bot, or add one from Import.</p></div>';
  el.className = 'betlist ' + (S.showAllBets ? 'tall' : 'short');
}

export function renderLedger() {
  const pool = scopedBets();
  const rows = pool.filter(b => {
    const okFilter = S.filter === 'all' || outcomeGroup(b.outcome) === S.filter;
    const okSearch = !S.query ||
      (b.event + ' ' + b.selection + ' ' + b.book + ' ' + b.market).toLowerCase().includes(S.query);
    return okFilter && okSearch;
  });
  $('ledgerList').innerHTML = rows.length ? rows.slice(0, 300).map(b => betRow(b)).join('')
    : '<div class="emptystate"><div class="t">Nothing here</div><p>No bets match this filter.</p></div>';

  const count = r => pool.filter(b => outcomeGroup(b.outcome) === r).length;
  $('betFilters').innerHTML = [
    ['all', 'All ' + pool.length],
    ['won', ico('i-won', 'pos') + 'Won ' + count('won')],
    ['lost', ico('i-lost', 'neg') + 'Lost ' + count('lost')],
    ['cash', ico('i-cash') + 'Cashed ' + count('cash')],
    ['void', ico('i-void') + 'Void ' + count('void')]
  ].map(x => '<button class="chip" data-filter="' + x[0] + '" aria-pressed="' +
    (S.filter === x[0]) + '">' + x[1] + '</button>').join('');
}

/* ---------------- calendar ---------------- */
export function renderCalendar() {
  const grid = $('calGrid');
  grid.className = 'calgrid' + (S.calMode === 'y' ? ' year' : '');
  $('dowRow').style.display = S.calMode === 'm' ? 'grid' : 'none';
  $('dowRow').innerHTML = dowLabels(S.weekStart).map(d => '<span>' + d + '</span>').join('');

  let html = '';
  if (S.calMode === 'm') {
    const days = dayMap(S.month);
    const dim = new Date(TODAY.year, S.month + 1, 0).getDate();
    const first = dowOffset(new Date(TODAY.year, S.month, 1), S.weekStart);
    const max = Object.keys(days).reduce((a, k) => Math.max(a, Math.abs(days[k])), 0) || 1;
    setText('calTitle', ML.format(new Date(TODAY.year, S.month, 1)));

    for (let i = 0; i < first; i++) html += '<div class="cell blank"></div>';
    for (let d = 1; d <= dim; d++) {
      const v = days[d];
      const has = v !== undefined;
      const isToday = S.month === TODAY.month && d === TODAY.day;
      const past = S.month < TODAY.month || (S.month === TODAY.month && d < TODAY.day);
      const cls = has ? 'hasbets' : isToday ? '' : past ? 'nobets' : 'future';
      let style = 'animation-delay:' + Math.min(d * 9, 300) + 'ms';
      if (has && v !== 0) {
        const r = Math.min(1, Math.abs(v) / max);
        const rgb = v > 0 ? '134,239,172' : '252,165,165';
        style += ';background:rgba(' + rgb + ',' + (0.1 + r * 0.24).toFixed(3) +
                 ');border-color:rgba(' + rgb + ',' + (0.26 + r * 0.3).toFixed(3) + ')';
      } else if (has) {
        /* A day whose bets all voided: bets were placed, no money moved.
           Neither green nor red, both would be a lie about the day. */
        style += ';background:rgba(255,255,255,.06);border-color:rgba(255,255,255,.14)';
      }
      /* EVERY DAY IS TAPPABLE, past and future.
         Days with no bets used to be `disabled`, which made the calendar
         a readout rather than a control: there was no way to say "put this
         figure on the 3rd" because the 3rd could not be tapped. A day with
         nothing in it opens the same sheet, showing an empty day and the
         way to add a figure to it. Future days too, on purpose, because a
         bet placed today on a game next week has a date in the future. */
      const label = has
        ? DS.format(new Date(TODAY.year, S.month, d)) + ', ' + M.signed(v)
        : DS.format(new Date(TODAY.year, S.month, d)) + ', no bets, tap to add a figure';
      html += '<button class="cell ' + cls + (isToday ? ' today' : '') +
        (S.focus === d ? ' picked' : '') + '" style="' + style + '"' +
        ' data-day="' + d + '"' +
        ' aria-label="' + esc(label) + '">' +
        (has ? '<span class="amt ' + M.tone(v) + '" aria-hidden="true">' +
          M.compact(v) + '</span>' : '') +
        '<span class="dnum" aria-hidden="true">' + d + '</span></button>';
    }
  } else {
    setText('calTitle', String(TODAY.year));
    const totals = [];
    for (let m = 0; m < 12; m++) totals.push(monthTotal(m));
    const max = totals.reduce((a, v) => Math.max(a, Math.abs(v)), 0) || 1;
    totals.forEach((v, m) => {
      let style = 'animation-delay:' + m * 28 + 'ms';
      if (v) {
        const r = Math.min(1, Math.abs(v) / max);
        const rgb = v > 0 ? '134,239,172' : '252,165,165';
        style += ';background:rgba(' + rgb + ',' + (0.1 + r * 0.24).toFixed(3) +
                 ');border-color:rgba(' + rgb + ',' + (0.26 + r * 0.3).toFixed(3) + ')';
      }
      const name = MS.format(new Date(TODAY.year, m, 1));
      html += '<button class="cell ' + (v ? 'hasbets' : m > TODAY.month ? 'future' : 'nobets') +
        (m === TODAY.month ? ' today' : '') + '" style="' + style + '"' +
        (v ? ' data-month="' + m + '"' : ' disabled') +
        ' aria-label="' + name + ', ' + (v ? M.signed(v) : 'no bets') + '">' +
        (v ? '<span class="amt ' + M.tone(v) + '" aria-hidden="true">' +
          M.compact(v) + '</span>' : '') +
        '<span class="dnum" aria-hidden="true">' + name + '</span></button>';
    });
  }
  grid.innerHTML = html;
}

/* ---------------- headline + goal ---------------- */
export function renderHeadline() {
  const p = stats(S, MS);
  const life = lifetime();

  /* The reference row along the top of the slip.
     A real slip prints a reference and a date up there. This prints the
     span of dates in view and how many of them have anything on them,
     which is the pair of facts the big number does not tell you.

     Deliberately NOT the period name: the label directly under it already
     says "Net this month", and printing "THIS MONTH" nine pixels above
     that is one element doing another's job. Dates are what the label
     cannot say. */
  const pad = n => String(n).padStart(2, '0');
  const range = (() => {
    const y = TODAY.year;
    if (S.period === 'a') return LEDGER.length ? 'ALL TIME' : 'NOTHING LOGGED YET';
    if (S.period === 'd' && S.focus != null) {
      return DS.format(new Date(y, S.month, S.focus)).toUpperCase() + ' ' + y;
    }
    if (S.period === 'w' && S.focus != null) {
      const r = weekRange(S.month, S.focus, S.weekStart);
      return pad(r.a) + ' TO ' + pad(r.b) + ' ' + MS.format(new Date(y, S.month, 1)).toUpperCase() + ' ' + y;
    }
    const dim = new Date(y, S.month + 1, 0).getDate();
    return '01 TO ' + dim + ' ' + MS.format(new Date(y, S.month, 1)).toUpperCase() + ' ' + y;
  })();
  setText('headlineRef',
    range + '  ·  ' + (p.activeDays === 1 ? '1 ACTIVE DAY' : p.activeDays + ' ACTIVE DAYS'));

  const label = S.period === 'a' ? 'Net all time'
    : S.period === 'm' ? (S.month === TODAY.month ? 'Net this month'
        : 'Net in ' + MS.format(new Date(TODAY.year, S.month, 1)))
    : S.period === 'w' ? 'Net this week'
    : 'Net on ' + (S.focus != null
        ? DS.format(new Date(TODAY.year, S.month, S.focus))
        : 'the selected day');
  setText('headlineLabel', label);

  /* The currency mark is wrapped so it can be optically reduced. Set
     through innerHTML with the figure escaped rather than by concatenating
     a formatted string, because the only variable part is money() output
     and it must never be able to carry markup. */
  const v = $('headlineValue');
  const money = M.signed(p.profit);
  const cur = money.match(/^([^\d]*?)([\d].*)$/);
  v.innerHTML = cur
    ? '<span class="cur">' + esc(cur[1]) + '</span>' + esc(cur[2])
    : esc(money);
  v.className = 'value m ' + M.tone(p.profit);

  /* The bet count honours the Settings toggle. `p.bets` for a scoped
     period is what was logged here; the all-time scope adds the imported
     history, and the toggle decides whether that history counts. */
  setText('statBets', M.plain(S.countMode === 'lifetime' ? p.bets : p.ledgerBets));
  setText('statUnits', M.units(p.profit, S.unit));
  setText('statTurnover', M.money0(p.turnover));
  setText('statWinRate', p.winRate + '%');
  setText('statAvgOdds', p.avgOdds ? p.avgOdds.toFixed(2) : 'None');
  const roi = $('statRoi');
  roi.textContent = M.pct(p.roi);
  roi.className = M.tone(p.roi);

  /* The trust line. Hidden until there is something to be honest about:
     an account with no bets carrying a "0% logged before kick-off" badge
     would be accusing somebody of nothing. */
  const capEl = $('captureLine');
  if (capEl) {
    if (!CAPTURE || !CAPTURE.known) {
      capEl.hidden = true;
    } else {
      capEl.hidden = false;
      $('captureFill').style.setProperty('--f', (CAPTURE.rate / 100).toFixed(3));
      capEl.classList.toggle('strong', CAPTURE.rate >= 80);
      setHTML('captureText',
        '<b>' + CAPTURE.rate + '%</b> logged before kick-off' +
        (CAPTURE.known < 5 ? ' <span class="capfew">(' + CAPTURE.known + ' so far)</span>' : ''));
      capEl.setAttribute('aria-label',
        CAPTURE.prematch + ' of ' + CAPTURE.known +
        ' bets were logged before the game started. What this means.');
    }
  }

  /* All time reaches past the ledger into imported history. Saying so is
     the difference between a number that reconciles and one that lies. */
  const note = $('importedNote');
  if (p.includesImported) {
    note.hidden = false;
    note.textContent = M.plain(p.ledgerBets) + ' slips in the ledger, plus ' +
      M.plain(IMPORTED.bets) + ' bets imported from 2023–2025 as totals.';
  } else note.hidden = true;

  $('kpiRow').innerHTML = [
    ['All time', M.money0s(life.profit), M.tone(life.profit)],
    ['Units', M.units(life.profit, S.unit), M.tone(life.profit)],
    ['Avg odds', life.avgOdds.toFixed(2), ''],
    ['ROI, life', M.pct(life.roi), M.tone(life.roi)]
  ].map(k => '<div class="kpi"><div class="n">' + k[0] + '</div><div class="v ' + k[2] + '">' +
    k[1] + '</div></div>').join('');

  $('kpiPair').innerHTML = [
    ['Win rate', p.winRate + '%', ''],
    ['Best run', p.streak + (p.streak === 1 ? ' day' : ' days'), ''],
    ['Best day', M.money0s(p.best), M.tone(p.best)],
    ['Worst day', M.money0s(p.worst), M.tone(p.worst)]
  ].map(k => '<div class="kpi"><div class="n">' + k[0] + '</div><div class="v ' + k[2] + '">' +
    k[1] + '</div></div>').join('');

  const settled = p.settled || 1;
  const wp = p.won / settled * 100, lp = p.lost / settled * 100, cp = p.cash / settled * 100;
  $('resultsBar').innerHTML =
    '<i style="width:' + wp + '%;background:#86EFAC"></i>' +
    '<i style="width:' + lp + '%;background:#FCA5A5"></i>' +
    '<i style="width:' + cp + '%;background:#F59E0B"></i>';
  $('resultsKey').innerHTML =
    '<span><i style="background:#86EFAC"></i>Won ' + M.plain(p.won) + '</span>' +
    '<span><i style="background:#FCA5A5"></i>Lost ' + M.plain(p.lost) + '</span>' +
    '<span><i style="background:#F59E0B"></i>Cashed ' + M.plain(p.cash) + '</span>';

  $('paidBars').innerHTML = barList(p.byBook);
  $('bookBars').innerHTML = barList(p.byBook);
  $('marketBars').innerHTML = barList(p.byMarket);
  $('tipsterBars').innerHTML = p.byTipster.length
    ? barList(p.byTipster, true)
    : '<p class="mut" style="font-size:12.5px">No tipster tagged in this period.</p>';

  $$('.scoped').forEach(e => { e.textContent = p.label; });

  $('ledgerKpis').innerHTML = [
    ['Net', M.money0s(p.profit), M.tone(p.profit)],
    ['Units', M.units(p.profit, S.unit), M.tone(p.profit)],
    ['Turnover', M.money0(p.turnover), ''],
    ['ROI', M.pct(p.roi), M.tone(p.roi)]
  ].map(k => '<div class="kpi"><div class="n">' + k[0] + '</div><div class="v ' + k[2] + '">' +
    k[1] + '</div></div>').join('');

  setText('settledCount', M.plain(p.settled) + ' settled');
  setText('winRateBig', p.settled ? p.winRate + '%' : '–');
  ring('ringWon', wp, 0);
  ring('ringLost', lp, -wp);
  ring('ringCash', cp, -(wp + lp));
  $('resultLegend').innerHTML = [
    ['#86EFAC', 'Won', p.won], ['#FCA5A5', 'Lost', p.lost], ['#F59E0B', 'Cashed out', p.cash]
  ].map(x => '<span style="display:flex;align-items:center;gap:8px">' +
    '<i style="width:8px;height:8px;border-radius:2px;background:' + x[0] + '"></i>' +
    x[1] + ', ' + M.plain(x[2]) + '</span>').join('');

}

function ring(id, pct, offset) {
  const el = $(id);
  if (!el) return;
  el.setAttribute('stroke-dasharray', pct.toFixed(1) + ' ' + (100 - pct).toFixed(1));
  el.setAttribute('stroke-dashoffset', offset.toFixed(1));
}

function barList(list, inUnits) {
  if (!list.length) return '<p class="mut" style="font-size:12.5px">Nothing in this period.</p>';
  const max = list.reduce((a, b) => Math.max(a, Math.abs(b[1])), 0) || 1;
  return list.slice(0, 8).map(([name, v]) => {
    const good = v >= 0;
    return '<div class="barline"><span class="lab">' + esc(name) + '</span>' +
      '<div class="track"><i style="width:' + (Math.abs(v) / max * 100).toFixed(0) +
      '%;background:' + (good ? 'linear-gradient(90deg,#8FC7C0,#86EFAC)' : '#FCA5A5') + '"></i></div>' +
      '<span class="val ' + (good ? 'pos' : 'neg') + '">' +
      (inUnits ? M.units(v, S.unit) : M.money0s(v)) + '</span></div>';
  }).join('');
}

export function renderGoal() {
  let total, target, name, elapsed, state;
  if (S.calMode === 'y') {
    total = 0; target = 0;
    for (let m = 0; m < 12; m++) { total += monthTotal(m); target += targetFor(m); }
    name = 'Year target'; elapsed = TODAY.doy / 365; state = 'current';
  } else {
    total = monthTotal(S.month);
    target = targetFor(S.month);
    name = (S.month === TODAY.month ? 'This month' : MS.format(new Date(TODAY.year, S.month, 1))) + ' target';
    state = S.month < TODAY.month ? 'past' : S.month > TODAY.month ? 'future' : 'current';
    elapsed = state === 'past' ? 1 : state === 'future' ? 0 : TODAY.day / TODAY.dim;
  }
  const ratio = Math.max(0, Math.min(1, total / target));
  setHTML('goalLabel', esc(name) +
    ' <button class="editable" id="editTarget" aria-label="Edit target">' + M.money0(target) + '</button>');
  setText('goalPct', Math.round(total / target * 100) + '%');
  $('goalFill').style.transform = 'scaleX(' + ratio + ')';

  const pace = $('goalPace');
  const track = pace.parentElement;
  pace.style.display = state === 'future' ? 'none' : '';
  pace.style.transform = 'translateX(' + (elapsed * track.clientWidth) + 'px)';
  setText('goalEarned', M.money0s(total) + ' earned');

  const n = $('goalPace2');
  let cls = 'mut';
  if (state === 'future') n.textContent = 'Not started';
  else if (state === 'past') {
    if (total >= target) { n.textContent = 'Beat target by ' + M.money0(total - target); cls = 'pos'; }
    else { n.textContent = 'Missed by ' + M.money0(target - total); cls = 'neg'; }
  } else if (ratio >= 1) { n.textContent = 'Target beaten'; cls = 'pos'; }
  else if (Math.abs(ratio - elapsed) < 0.04) n.textContent = 'On pace';
  else if (ratio > elapsed) { n.textContent = 'Ahead of pace'; cls = 'pos'; }
  else { n.textContent = 'Behind pace'; cls = 'neg'; }
  n.className = cls;
  $('goalPct').className = 'pctval ' + (state === 'future' ? 'mut' : cls);
}

/* ---------------- running bets ---------------- */
export function exposure() {
  let risk = 0, ret = 0;
  PENDING.forEach(b => { risk += b.stake; ret += Math.round(b.stake * b.odds); });
  return { n: PENDING.length, risk, ret, profit: ret - risk };
}

export function renderPending() {
  const card = $('runningCard');
  if (!card) return;
  const x = exposure();
  card.hidden = !x.n;
  if (!x.n) return;
  setText('runCount', x.n + (x.n === 1 ? ' bet running' : ' bets running'));
  setText('runRisk', M.money0(x.risk) + ' at risk');

  $('runList').innerHTML =
    '<div class="exposure">' +
      '<div><div class="k">At risk</div><div class="v">' + M.money0(x.risk) + '</div></div>' +
      '<div><div class="k">Returns if all land</div><div class="v pos">' + M.money0(x.ret) + '</div></div>' +
      '<div><div class="k">Potential profit</div><div class="v pos">+' + M.money0(x.profit) + '</div></div>' +
    '</div>' +
    PENDING.map(b =>
      '<div class="pendrow' + (b.ask ? ' needsyou' : '') + '" data-pending="' + b.id + '">' +
      '<div class="top"><span class="ev">' + esc(b.event) + '</span>' +
      '<span class="ret">' + M.money0(Math.round(b.stake * b.odds)) + '</span></div>' +
      '<div class="pick">' + esc(b.selection) + '</div>' +
      '<div class="meta"><span>' + odds(b.odds) + '</span><span>·</span>' +
      '<span>' + M.money(b.stake) + '</span><span>·</span><span>' + esc(b.book) + '</span>' +
      (S.showTipster && b.tipster ? '<span>·</span><span>' + esc(b.tipster) + '</span>' : '') +
      (b.live ? '<span class="badge live">in play ' + esc(b.at || '') + '</span>' : '') +
      '<span class="badge ' + (b.ask ? 'ask' : 'auto') + '">' + (b.ask ? 'over to you' : 'grading') + '</span>' +
      '<span style="margin-left:auto">placed ' + esc(b.placed) + '</span></div>' +
      (b.ask ? '<div class="why">' + esc(b.ask) + '</div>' : '') +
      '<div class="acts">' +
        '<button class="win" data-settle="' + b.id + '|won">Won</button>' +
        '<button class="lose" data-settle="' + b.id + '|lost">Lost</button>' +
        '<button class="cash" data-settle="' + b.id + '|cash">Cashed</button>' +
        '<button class="void" data-settle="' + b.id + '|void">Void</button>' +
      '</div>' +
      '<div class="cashform" hidden><label class="sr" for="cashIn-' + b.id + '">Amount returned</label>' +
      '<input class="field" id="cashIn-' + b.id + '" inputmode="decimal" placeholder="Amount returned…">' +
      '<button class="btn primary" data-cashout="' + b.id + '" style="padding:0 16px">Save</button></div>' +
      '</div>').join('') +
    '<div class="runfoot">' +
    'Standard markets settle themselves. Anything uncertain comes to you rather than being guessed.</div>';
}

/* ---------------- social ---------------- */
export function personValue(p) {
  const mo = personMonths(p);
  if (S.period === 'a') return p.all;
  const m = mo[S.month] || 0;
  if (S.period === 'm') return m;
  if (S.period === 'w') return Math.round(m * 7 / 30);
  return Math.round(m / 30);
}
const visible = p => p.pv === 'public' || (p.pv === 'friends' && p.mu);

/* No nested interactive elements: the row is a plain container, the name
   is one button and Follow is another. The old build put role="button"
   on the row and a real button inside it, which axe flags as
   nested-interactive and which breaks screen reader navigation. */
function personRow(p, mode) {
  const v = personValue(p);
  const ok = visible(p);
  const val = ok
    ? '<span class="n ' + M.tone(v) + '">' + M.units(v, p.un) + '</span>' +
      '<span class="s">' + M.money0s(v) + '</span>'
    : '<span class="hidden-note">' + LOCK + (p.pv === 'private' ? 'Private' : 'Friends only') + '</span>';
  /* No privacy tag on the row.
     A name, a tick, a tag, a figure and a Follow button do not fit across
     390px, and what gave way was the name: "ColdLine" rendered as "Co…".
     The tag was the least useful of the five, because the value column
     already says "Friends only" or "Private" when it applies, and for
     everybody else the tag was telling you about a setting of theirs that
     changes nothing you can see. It survives on the profile, where there
     is room for it. */
  return '<div class="person">' +
    '<button class="who" data-profile="' + esc(p.n) + '" style="display:flex;align-items:center;gap:11px;text-align:left;min-width:0;flex:1">' +
      '<span class="avatar" aria-hidden="true">' + esc(p.a) + '</span>' +
      '<span style="min-width:0">' +
        '<span class="nm"><span translate="no">' + esc(p.n) + '</span>' + (p.v ? VERIFIED : '') + '</span>' +
        '<span class="sub" style="display:block">1u = ' + M.money0(p.un) + (p.mu ? ' · mutual' : '') + '</span>' +
      '</span>' +
    '</button>' +
    '<span class="val">' + val + '</span>' +
    '<button class="followbtn" data-follow="' + esc(p.n) + '" aria-pressed="' + !!p.ing + '">' +
      (p.ing ? 'Following' : mode === 'followers' ? 'Follow back' : 'Follow') + '</button>' +
  '</div>';
}

/* A search result.
 *
 * Deliberately not a personRow: someone you have not followed has no
 * figures you are entitled to, no unit size worth showing, and rendering
 * them in the same shape as a real row would leave a line of zeros that
 * reads as somebody who has broken even. A name, a tick, and a way to
 * follow them is the whole of it. */
function foundRow(p) {
  return '<div class="person">' +
    '<span class="avatar" aria-hidden="true">' + esc(p.a) + '</span>' +
    '<span class="who"><span class="nm"><span translate="no">' + esc(p.n) + '</span>' +
    (p.v ? VERIFIED : '') + '</span></span>' +
    '<button class="followbtn" data-follow="' + esc(p.n) + '" aria-pressed="' + !!p.ing + '">' +
    (p.ing ? 'Following' : 'Follow') + '</button></div>';
}

export function renderPeople() {
  const q = S.peopleQuery.toLowerCase();
  /* Searching asks the server, because the point of a search is to find
     people you are not already connected to, and those are exactly the
     ones not in PEOPLE. Filtering the list you already have could only
     ever return people you already follow. */
  const found = $('peopleFound');
  if (found) {
    if (!q) {
      found.hidden = true;
      found.innerHTML = '';
    } else {
      found.hidden = false;
      found.innerHTML = FOUND == null
        ? '<div class="emptystate"><div class="t">Looking…</div></div>'
        : FOUND.length
          ? '<div class="cardhead"><span class="title">' + FOUND.length + ' Slipper' +
            (FOUND.length === 1 ? '' : 's') + '</span><span class="meta">tap to follow</span></div>' + FOUND.map(foundRow).join('')
          : '<div class="emptystate"><div class="t">No Slipper by that name</div>' +
            '<p>Display names are exact. Check the spelling with them.</p></div>';
    }
  }

  const following = PEOPLE.filter(p => p.ing);
  const followers = PEOPLE.filter(p => p.er);
  const totalUnits = list => list.filter(visible).reduce((a, p) => a + personValue(p) / p.un, 0);
  const head = (t, r) => '<div class="cardhead"><span class="title">' + t + '</span><span class="meta">' + r + '</span></div>';

  $('followingList').innerHTML = following.length
    ? head('Following ' + following.length, periodWord() + ' · in their units') +
      following.map(p => personRow(p, 'following')).join('')
    : '<div class="emptystate"><div class="t">Not following anyone yet</div>' +
      '<p>Search above by name. What you see of a Slipper is their choice: ' +
      'public shows, friends-only shows once they follow you back, private never does.</p></div>';

  $('followersList').innerHTML = followers.length
    ? head('Followers ' + followers.length, followers.filter(p => p.ing).length + ' mutual') +
      followers.map(p => personRow(p, 'followers')).join('')
    : '<div class="emptystate"><div class="t">No followers yet</div>' +
      '<p>Slippers who follow you appear here. Share your display name.</p></div>';

  $('followingSummary').innerHTML = duo('Following', following.length, totalUnits(following));
  $('followersSummary').innerHTML = duo('Followers', followers.length, totalUnits(followers));
}

function duo(title, n, units) {
  return '<div class="duo"><div><div class="k">' + title + '</div><div class="v">' + n + '</div></div>' +
    '<div><div class="k">Combined, ' + periodWord() + '</div><div class="v ' +
    M.tone(units) + '">' +
    ((units >= 0 ? '+' : '−') + Math.abs(units).toFixed(2) + 'u') + '</div></div></div>';
}

function groupRows(g) {
  const me = stats(S, MS);
  return g.mem.map(n => {
    /* Your own tick is whatever the session says it is. This was hardcoded
       true, which claimed a verification nobody had granted. */
    if (n === 'You') return { n: 'You', a: 'YO', un: S.unit, v: me.profit, verified: S.verified, me: true };
    const p = PEOPLE.find(x => x.n === n);
    return p ? { n: p.n, a: p.a, un: p.un, v: personValue(p), verified: p.v } : null;
  }).filter(Boolean).sort((a, b) => b.v / b.un - a.v / a.un);
}

export function renderGroups() {
  /* A new account is in no groups. Show the empty state and stop, rather
     than indexing GROUPS[S.group] into undefined. */
  if (!GROUPS.length) {
    $('groupList').innerHTML =
      '<div class="emptystate"><div class="t">No groups yet</div>' +
      '<p>Start one and share the code, or join with a friend\'s. Ranked in units, ' +
      'so no stake size is ever visible.</p></div>';
    /* Emptying a .card leaves its border and padding behind as a stray
       rounded box. Hide the element, not just its contents. */
    $('groupBoard').innerHTML = '';
    $('groupBoard').hidden = true;
    return;
  }
  $('groupList').innerHTML = GROUPS.map((g, i) => {
    const rows = groupRows(g);
    const place = rows.findIndex(r => r.me) + 1;
    const totalUnits = rows.reduce((a, r) => a + r.v / r.un, 0);
    const suffix = ['th', 'st', 'nd', 'rd'];
    const vv = place % 100;
    const ord = suffix[(vv - 20) % 10] || suffix[vv] || suffix[0];
    return '<button class="groupcard" data-group="' + i + '" aria-pressed="' + (S.group === i) + '">' +
      '<span class="glyph" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
      '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 21v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v1"/>' +
      '<path d="M16 3.6a3.2 3.2 0 0 1 0 6.4"/></svg></span>' +
      '<span class="body"><span class="r1"><span class="gname">' + esc(g.name) + '</span>' +
      '<span class="gval ' + M.tone(totalUnits) + '">' +
      ((totalUnits >= 0 ? '+' : '−') + Math.abs(totalUnits).toFixed(2) + 'u') + '</span></span>' +
      '<span class="r2"><span class="gsub">' + g.mem.length + ' members · you are ' + place + ord +
      '</span><span class="gper">' + periodWord() + '</span></span></span></button>';
  }).join('');

  const g = GROUPS[S.group] || GROUPS[0];
  $('groupBoard').hidden = false;
  const rows = groupRows(g);
  const totalUnits = rows.reduce((a, r) => a + r.v / r.un, 0);
  /* The group's own actions live behind the three dots beside its name.
     They used to sit open on the board: a join code the width of the card
     and a "Leave group" button next to it, both of which you do once, and
     neither of which is what you opened the board to look at. Worse,
     "Leave" sat a thumb-width from the leaderboard you were reading.
     Behind a menu they are still one tap away and out of the way.

     A <details> rather than a scripted popover: it opens and closes with
     no JavaScript, closes on Escape, and is keyboard operable without a
     focus trap to get wrong. */
  const menu = g.code
    ? '<details class="gmenu"><summary aria-label="Group options"><svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<circle cx="12" cy="5" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="19" r="1.7"/>' +
      '</svg></summary><div class="gmenu-body">' +
      '<div class="gmenu-row"><span class="k">Visibility</span>' +
      '<span class="privacytag ' + (g.visibility === 'public' ? 'public' : 'private') + '">' +
      esc(g.visibility || 'private') + '</span></div>' +
      '<div class="gmenu-row"><span class="k">Join code</span>' +
      '<button class="pillbtn" id="groupShare" data-code="' + esc(g.code) + '">' +
      esc(g.code) + '</button></div>' +
      '<button class="gmenu-leave" id="groupLeave" data-id="' + esc(g.id || '') + '" ' +
      'data-name="' + esc(g.name) + '">Leave group</button>' +
      '</div></details>'
    : '';

  $('groupBoard').innerHTML =
    '<div class="cardhead"><span class="title">' + esc(g.name) + '</span>' +
    '<span class="meta">' + periodWord() + ' · in units</span>' + menu + '</div>' +
    '<div class="duo"><div><div class="k">Group total</div><div class="v ' +
      M.tone(totalUnits) + '">' +
      ((totalUnits >= 0 ? '+' : '−') + Math.abs(totalUnits).toFixed(2) + 'u') + '</div></div>' +
    '<div><div class="k">Members</div><div class="v">' + g.mem.length + '</div></div></div>' +
    rows.map((p, i) =>
      '<div class="person' + (p.me ? ' you' : '') + '">' +
      '<span class="rank' + (i < 3 ? ' podium' : '') + '">' + (i + 1) + '</span>' +
      (p.me
        ? '<span class="avatar" aria-hidden="true">' + esc(p.a) + '</span><span class="who">' +
          '<span class="nm"><span translate="no">You</span></span>' +
          '<span class="sub" style="display:block">1u = ' + M.money0(p.un) + '</span></span>'
        : '<button class="who" data-profile="' + esc(p.n) + '" style="display:flex;align-items:center;gap:11px;text-align:left;min-width:0;flex:1">' +
          '<span class="avatar" aria-hidden="true">' + esc(p.a) + '</span>' +
          '<span style="min-width:0"><span class="nm"><span translate="no">' + esc(p.n) + '</span>' +
          (p.verified ? VERIFIED : '') + '</span>' +
          '<span class="sub" style="display:block">1u = ' + M.money0(p.un) + '</span></span></button>') +
      '<span class="val"><span class="n ' + M.tone(p.v) + '">' +
      M.units(p.v, p.un) + '</span><span class="s">' + M.money0s(p.v) + '</span></span></div>').join('');
}

/* ---------------- period profit and loss ----------------
 *
 * The compact dated list an import ends up as. One line per figure: the
 * date it belongs to, what it was, and a way to take it off again.
 *
 * Sorted newest first by the server, and not re-sorted here. Dates arrive
 * as plain ISO days with no timezone, and re-parsing them to sort would be
 * the one place a day could shift by one.
 */
const PL_TAG = { day: '', week: 'week', month: 'month', year: 'year' };

export function renderPl() {
  const card = $('plListCard');
  const list = $('plList');
  if (!list || !card) return;
  if (!PL.length) { card.hidden = true; list.innerHTML = ''; return; }
  card.hidden = false;

  const sum = PL.reduce((a, p) => a + p.profit, 0);
  setHTML('plTotal', PL.length + ' figure' + (PL.length === 1 ? '' : 's') +
    ' · <b class="' + M.tone(sum) + '">' + M.money0s(sum) + '</b>');

  list.innerHTML = PL.map(p => {
    const d = new Date(p.date + 'T12:00:00');
    const when = Number.isNaN(d.getTime()) ? p.date
      : p.period === 'month' ? ML.format(d)
      : p.period === 'week' ? 'Week of ' + DS.format(d)
      : DS.format(d) + ' ' + d.getFullYear();
    return '<div class="plrow">' +
      '<span class="pld">' + esc(when) +
        (PL_TAG[p.period] ? '<span class="plt">' + PL_TAG[p.period] + '</span>' : '') +
        (p.source === 'import' ? '<span class="plt">imported</span>' : '') + '</span>' +
      '<span class="plv ' + M.tone(p.profit) + '">' + M.signed(p.profit) + '</span>' +
      '<button class="plx" data-remove-pl="' + esc(p.id) + '" ' +
        'aria-label="Remove the figure for ' + esc(when) + '">' + ico('i-close') + '</button>' +
    '</div>';
  }).join('');
}

/* ---------------- the group directory ----------------
 *
 * Public groups, alphabetically, exactly as the server sorted them. It is
 * deliberately not re-sorted here: the server sorts on the same folded
 * name the uniqueness index uses, and a second sort in the browser would
 * put "the Ultras" and "The Ultras" in different places to the list they
 * came from.
 *
 * A row carries a name, a head count and a way in. No figures, no member
 * names: joining is how you see those, and a directory that previewed them
 * would make every public group a leaderboard anyone can read.
 */
export function renderBrowse(groups, query) {
  const el = $('browseList');
  if (!el) return;
  if (groups == null) {
    el.innerHTML = '<div class="emptystate"><div class="t">Looking…</div></div>';
    return;
  }
  if (!groups.length) {
    el.innerHTML = '<div class="emptystate"><div class="t">' +
      (query ? 'Nothing matching ' + esc(query) : 'No public groups yet') + '</div>' +
      '<p>' + (query
        ? 'Try a shorter search, or start a group with that name yourself.'
        : 'Public groups appear here as people create them. Start one and it will be the first.') +
      '</p></div>';
    return;
  }
  el.innerHTML = groups.map(g =>
    '<div class="browserow">' +
    '<span class="glyph" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
    '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 21v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v1"/>' +
    '<path d="M16 3.6a3.2 3.2 0 0 1 0 6.4"/></svg></span>' +
    '<span class="body"><span class="bname">' + esc(g.name) + '</span>' +
    '<span class="bsub">' + g.members + ' member' + (g.members === 1 ? '' : 's') + '</span></span>' +
    (g.joined
      ? '<span class="bin">Joined</span>'
      : g.full
        ? '<span class="bin">Full</span>'
        : '<button class="btn ghost small" data-browse-join="' + esc(g.id) + '" ' +
          'data-name="' + esc(g.name) + '">Join</button>') +
    '</div>').join('');
}

/* ---------------- profile ---------------- */
function sharesGroup(p) {
  return GROUPS.some((g, i) => p.gr.includes(i) && g.mem.includes('You'));
}
function miniCal(p, m) {
  const d = personDays(p, m);
  const dim = new Date(TODAY.year, m + 1, 0).getDate();
  const first = dowOffset(new Date(TODAY.year, m, 1), S.weekStart);
  const max = Object.keys(d).reduce((a, k) => Math.max(a, Math.abs(d[k])), 0) || 1;
  let h = '';
  for (let i = 0; i < first; i++) h += '<i class="blank"></i>';
  for (let i = 1; i <= dim; i++) {
    const v = d[i];
    let style = '';
    if (v !== undefined) {
      const r = Math.min(1, Math.abs(v) / max);
      style = 'background:rgba(' + (v >= 0 ? '134,239,172' : '252,165,165') + ',' +
        (0.14 + r * 0.3).toFixed(2) + ')';
    }
    h += '<i style="' + style + '"></i>';
  }
  return '<div class="minical" role="img" aria-label="Daily profit and loss for ' +
    esc(p.n) + ' in ' + ML.format(new Date(TODAY.year, m, 1)) + '">' +
    dowLabels(S.weekStart).map(x => '<span aria-hidden="true">' + x.charAt(0) + '</span>').join('') +
    h + '</div>';
}

export function renderProfile(name) {
  const p = PEOPLE.find(x => x.n === name);
  if (!p) return false;
  S.profile = name;
  const ok = visible(p);
  const mo = personMonths(p);
  const yearTotal = mo.reduce((a, b) => a + b, 0);

  setText('profileAvatar', p.a);
  setHTML('profileName', '<span translate="no">' + esc(p.n) + '</span>' + (p.v ? VERIFIED : ''));
  setHTML('profileSub',
    (p.pv === 'public' ? 'Public profile' : p.pv === 'friends' ? 'Friends only' : 'Private profile') +
    ' · 1u = ' + M.money0(p.un) + (p.mu ? '<br>Follows you back' : ''));

  const fb = $('profileFollow');
  fb.textContent = p.ing ? 'Following' : 'Follow';
  fb.className = 'btn small ' + (p.ing ? 'ghost' : 'primary');
  fb.setAttribute('data-follow', p.n);
  fb.setAttribute('aria-pressed', String(!!p.ing));

  if (!ok) {
    $('profileBody').innerHTML =
      '<div class="card pad"><div class="emptystate" style="padding:32px 10px">' +
      '<div style="width:44px;height:44px;margin:0 auto 11px;border-radius:13px;display:grid;place-items:center;' +
      'background:var(--c2);border:1px solid var(--e1);color:var(--t2)">' + LOCK + '</div>' +
      '<div class="t">' + (p.pv === 'private' ? 'This profile is private' : 'Friends only') + '</div>' +
      '<p>' + (p.pv === 'private'
        ? 'They have chosen not to share figures with anyone.'
        : 'Follow each other and their figures appear here.') + '</p></div></div>';
    return true;
  }

  const thisMonth = mo[TODAY.month] || 0;
  const maxMo = Math.max(...mo.map(Math.abs)) || 1;
  $('profileBody').innerHTML =
    '<div class="card pad" style="margin-bottom:10px"><p class="eyebrow" style="color:var(--t2)">All time</p>' +
    '<p class="bignum ' + M.tone(p.all) + '">' + M.units(p.all, p.un) + '</p>' +
    '<p class="mut m" style="font-size:12.5px;margin-top:3px">' + M.money0s(p.all) +
      ' at ' + M.money0(p.un) + ' a unit</p>' +
    '<div class="kpis pair" style="margin:12px 0 0">' +
      kpi('This month', M.units(thisMonth, p.un), M.tone(thisMonth)) +
      kpi('This year', M.units(yearTotal, p.un), M.tone(yearTotal)) +
      kpi('ROI', M.pct(p.roi || 0), M.tone(p.roi || 0)) +
      kpi('Bets', M.plain(p.b || 0), '') +
    '</div></div>' +

    '<div class="card pad" style="margin-bottom:10px">' +
    '<div class="cardhead"><span class="title">Month by month</span>' +
    '<span class="meta">' + TODAY.year + ', in units</span></div>' +
    '<div class="sparkline" role="img" aria-label="Monthly profit and loss for ' + esc(p.n) + '">' +
    mo.map((v, i) => {
      const h = Math.max(3, Math.abs(v) / maxMo * 46);
      return '<div class="col"><span class="bar ' + (v >= 0 ? 'up' : 'down') +
        '" style="height:' + h.toFixed(0) + 'px;animation-delay:' + (i * 40) + 'ms"></span>' +
        '<span class="ml">' + MS.format(new Date(TODAY.year, i, 1)).charAt(0) + '</span></div>';
    }).join('') + '</div></div>' +

    /* The mini calendar needs day-level figures, and the group response
       deliberately does not carry them: a board ranks over a period, and
       shipping every member's daily curve to every other member is more of
       their record than the ranking needs. Show it only when there is
       something in it, rather than an empty grid that looks broken. */
    (sharesGroup(p) && Object.keys(personDays(p, TODAY.month)).length
      ? '<div class="card pad" style="margin-bottom:10px">' +
        '<div class="cardhead"><span class="title">' + ML.format(new Date(TODAY.year, TODAY.month, 1)) +
        '</span><span class="meta">' + M.units(thisMonth, p.un) + '</span></div>' +
        miniCal(p, TODAY.month) +
        '<p class="fineprint" style="margin-top:11px">Visible because you are in a group together.</p></div>'
      : '') +

    '<div class="card pad"><div class="cardhead"><span class="title">Groups you share</span></div>' +
    (p.gr.length
      ? p.gr.map(gi => {
          const g = GROUPS[gi];
          const rows = groupRows(g);
          const place = rows.findIndex(x => x.n === p.n) + 1;
          return '<div class="fieldrow"><span class="lab">' + esc(g.name) +
            '<small>' + g.mem.length + ' members</small></span>' +
            '<span class="pillbtn locked m">' + place + ' of ' + rows.length + '</span></div>';
        }).join('')
      : '<div class="emptystate" style="padding:16px"><p>No groups in common.</p></div>') +
    '</div>';
  return true;
}
const kpi = (n, v, c) => '<div class="kpi"><div class="n">' + n + '</div><div class="v ' + c + '">' + v + '</div></div>';

/* ---------------- settings surfaces ---------------- */
export function renderPrivacy() {
  const opts = [
    ['public', 'Public', 'Anyone who finds you can see your units and ROI',
      '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18"/>'],
    ['friends', 'Friends only', 'Only people you follow back can see your figures',
      '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 21v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v1"/><path d="M16 3.6a3.2 3.2 0 0 1 0 6.4"/>'],
    ['private', 'Private', 'No Slipper sees your figures. Groups you join still do.',
      '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>']
  ];
  const html = opts.map(o =>
    '<button class="optioncard" data-privacy="' + o[0] + '" aria-pressed="' + (S.privacy === o[0]) + '">' +
    '<span class="glyph" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
    o[3] + '</svg></span><span><span class="t">' + o[1] + '</span><span class="s">' + o[2] + '</span></span></button>'
  ).join('');
  setHTML('privacySettings', html);
  setHTML('privacySetup', html);
}

export function renderTargets() {
  const monthly = S.targetPeriod === 'month' ? S.target
    : S.targetPeriod === 'year' ? S.target / 12
    : S.targetPeriod === 'week' ? S.target * 52 / 12 : S.target * 365 / 12;
  const yearly = monthly * 12;
  const byPeriod = { day: yearly / 365, week: yearly / 52, month: monthly, year: yearly };
  const html = [['day', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly'], ['year', 'Yearly']]
    .map(([k, lbl]) => '<button data-target-period="' + k + '" aria-pressed="' +
      (S.targetPeriod === k) + '"><span class="left"><i class="dot" aria-hidden="true"></i>' + lbl +
      '</span><span class="v">' + M.money0(byPeriod[k]) + '</span></button>').join('');
  setHTML('targetListSetup', html);
  setHTML('targetListSettings', html);
  setText('targetLabel', { day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Yearly' }[S.targetPeriod] + ' target');
}

/* The markets people actually bet, ordered by how often a slip prints
   them. Not a closed set: the field is a datalist, so anything can still
   be typed, and the settlement engine reads the selection text rather than
   this label. It is a shortcut for the two fields the reader most often
   gets nearly right. */
const MARKET_NAMES = [
  'Match result', 'Over/Under', 'Both teams to score', 'Asian Handicap',
  'Handicap', 'Draw no bet', 'Double chance', 'Correct score',
  'Half time/Full time', 'Team goals', 'Anytime scorer', 'First goalscorer',
  'Cards', 'Corners', 'Bet builder', 'Outright', 'Match winner', 'Total games',
  'Set betting', 'Win to nil', 'Clean sheet'
];

export function renderMisc() {
  /* Auto-complete for bookmaker and market. Rebuilt here rather than in the
     markup because the bookmaker list is editable in Settings, so a book
     somebody adds shows up in the importer without a reload. */
  const opts = list => list.map(v => '<option value="' + esc(v) + '"></option>').join('');
  setHTML('bookNames', opts(Object.values(BOOKS).flat()));
  setHTML('marketNames', opts(MARKET_NAMES));

  setText('tipsterCount', String(TIPSTERS.length));
  setText('bookCount', String(Object.values(BOOKS).reduce((a, v) => a + v.length, 0)));
  setHTML('tipsterChips', TIPSTERS.map(t =>
    '<span class="tagchip">' + esc(t) +
    '<button data-remove-tipster="' + esc(t) + '" aria-label="Remove ' + esc(t) + '">×</button></span>').join(''));
  setHTML('bookGroups', Object.keys(BOOKS).map(g =>
    '<div class="bookgroup"><div class="h">' + esc(g) + '<span>' + BOOKS[g].length + '</span></div>' +
    '<div class="items">' + BOOKS[g].map(b => '<span class="item">' + esc(b) + '</span>').join('') +
    '</div></div>').join(''));

  const swatches = THEMES.map(t =>
    '<button data-theme="' + t[0] + '" aria-pressed="' + (S.theme === t[0]) + '"' +
    /* background-image, not the background shorthand: the shorthand resets
       background-size, and the zoom that makes the cell read as one colour
       instead of a two-tone tile lives in background-size. */
    ' style="background-image:linear-gradient(140deg,' + t[2] + ',' + t[3] + ')" aria-label="' + t[1] + ' theme">' +
    '<span class="swname">' + t[1] + '</span></button>').join('');
  setHTML('swatchesSettings', swatches);
  setHTML('swatchesSetup', swatches);

  setText('accountName', S.name);
  setText('unitExample', '1u is ' + M.money0(S.unit) + ', so a ' + M.money0(S.unit * 2) + ' bet is 2u.');
  setText('slipCount', M.plain(LEDGER.length) + ' slips');
  $$('.unitrow').forEach(row => {
    $$('button', row).forEach(b => {
      const u = b.getAttribute('data-unit');
      b.setAttribute('aria-pressed', String(u !== 'custom' && +u === S.unit));
    });
  });
}

/** Paint the signed-in account onto Settings. Nothing here is invented:
    every field is what the server returned for this session. */
export function renderAccount(user) {
  if (!user) return;
  S.name = user.name || S.name;
  if (user.unitPence) S.unit = user.unitPence;
  setText('accountName', user.name || '');
  setText('accountEmail', user.email || '');
  S.plan = user.plan || 'free';
  S.planUntil = user.planUntil || null;
  /* The saved setting wins over whatever the form is showing. These two
     used to live only in the browser, so a reload silently reset them to
     the defaults in state.js while the account kept its real values. */
  if (user.privacy) S.privacy = user.privacy;
  if (user.countMode) S.countMode = user.countMode;
  paintSeg($('countSeg'));
  $$('#countSeg button').forEach(b => {
    const on = b.getAttribute('data-count') === S.countMode;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  renderPlan();
  renderPrivacy();
  /* Telegram: connected, or plainly not. */
  const dot = $('tgState');
  if (dot) {
    dot.textContent = user.telegramLinked
      ? 'Connected' + (user.since ? ' since ' + DF.format(new Date(user.since)) : '')
      : 'Not connected yet';
    dot.closest('.livedot').classList.toggle('off', !user.telegramLinked);
  }
  /* The same code appears during setup and in Settings; both come from the
     session, so they cannot show different codes. */
  for (const id of ['linkCode', 'linkCodeSettings']) {
    const code = $(id);
    if (!code) continue;
    code.textContent = user.linkCode || 'Not linked yet';
    if (id === 'linkCodeSettings') code.hidden = !user.linkCode;
  }

  /* On a break, the settings row says so and the button goes away: there
     is nothing to set, and offering the control again would imply it could
     be changed. */
  const brk = user.breakUntil ? new Date(user.breakUntil) : null;
  const onBreak = brk && brk > new Date();
  setText('breakNote', onBreak
    ? 'On a break until ' + DF.format(brk)
    : 'Turns off logging for as long as you choose');
  const breakBtn = $('breakOpen');
  if (breakBtn) breakBtn.hidden = Boolean(onBreak);
  document.body.classList.toggle('on-break', Boolean(onBreak));

  const v = $('verifyState');
  if (v) {
    v.textContent = user.emailVerified ? 'Verified' : 'Unverified';
    v.style.color = user.emailVerified ? 'var(--s)' : 'var(--a)';
  }

  /* The tick. Separate from the line above on purpose: proving an email
     address and having your figures vouched for are unrelated claims, and
     one row for both told everyone who clicked a link that they were
     verified. */
  S.verified = Boolean(user.verified);
  const tick = $('tickState');
  if (tick) {
    tick.textContent = S.verified ? 'Verified' : 'No';
    tick.style.color = S.verified ? 'var(--s)' : 'var(--t2)';
  }
  setText('tickNote', S.verified
    ? 'Your figures have been checked'
    : 'Granted after a review of your slips');
}

/* The plan rows in Settings, from state rather than from a passed user, so
   redeeming a code repaints them without another round trip.

   The plan ids are the server's: free, monthly, yearly, lifetime. This
   previously compared against 'month' and 'year', which nothing ever sends,
   so every account read as the free trial however it was paying. */
const PLAN_NAME = { free: 'Free trial', monthly: 'Monthly', yearly: 'Yearly', lifetime: 'Free for life' };

/* The trial counter on the dashboard.
 *
 * Says whichever half is closer to running out, never both: "5 days and 22
 * slips left" makes somebody do arithmetic to work out which one is going
 * to stop them. The bar is whichever of the two is further along, so it
 * always tracks the limit that will actually bite.
 *
 * On day one with nothing logged this is deliberately dull. It earns
 * attention as it runs down and not before.
 */
export function renderTrial() {
  const bar = $('trialBar');
  if (!bar) return;
  const t = TRIAL;
  /* No trial object means a paid account, and a paid account is told
     nothing at all. */
  if (!t) { bar.hidden = true; return; }
  bar.hidden = false;

  const slipPart = t.slipsUsed / (t.slipsUsed + t.slipsLeft || 1);
  /* daysLeft is null on accounts created before the trial existed; those
     have a slip limit and no clock, so the bar tracks slips alone. */
  const timePart = t.daysLeft == null ? 0 : 1 - Math.min(1, t.daysLeft / 14);
  const filled = Math.max(slipPart, timePart);

  bar.classList.toggle('done', !t.active);
  bar.classList.toggle('warn', t.active && filled >= 0.75);
  $('trialFill').style.setProperty('--f', filled.toFixed(3));

  const go = $('trialGo');
  if (go) go.textContent = t.active ? 'Subscribe' : 'Subscribe now';

  if (!t.active) {
    setHTML('trialText', t.over === 'time'
      ? 'Your free trial has <b>finished</b>. Subscribe to keep logging slips.'
      : 'You have used <b>all ' + (t.slipsUsed) + '</b> trial slips. Subscribe to keep going.');
    return;
  }
  /* Whichever limit is nearer, in its own words. */
  setHTML('trialText', slipPart >= timePart
    ? 'Free trial: <b>' + t.slipsLeft + '</b> slip' + (t.slipsLeft === 1 ? '' : 's') + ' left'
    : 'Free trial: <b>' + t.daysLeft + '</b> day' + (t.daysLeft === 1 ? '' : 's') + ' left');
}

export function renderPlan() {
  const plan = S.plan || 'free';
  const sel = $('planSelect');
  if (sel) {
    /* lifetime is not one of the buyable options, so it is added only when
       it applies rather than sitting in the list for everyone. */
    const lifetime = sel.querySelector('option[value="lifetime"]');
    if (plan === 'lifetime' && !lifetime) {
      const opt = document.createElement('option');
      opt.value = 'lifetime';
      opt.textContent = PLAN_NAME.lifetime;
      sel.appendChild(opt);
    } else if (plan !== 'lifetime' && lifetime) {
      lifetime.remove();
    }
    sel.value = plan;
  }
  const until = S.planUntil ? new Date(S.planUntil) : null;
  /* The trial's numbers come from the server, so this row and the counter
     on the dashboard cannot disagree with what actually blocks an upload.
     35 is the fallback for the moment before the first ledger load. */
  const cap = TRIAL ? TRIAL.slipsUsed + TRIAL.slipsLeft : 35;
  setText('planLimit', plan === 'free'
    ? (TRIAL && TRIAL.daysLeft != null && TRIAL.active
        ? cap + ' slips, ' + TRIAL.daysLeft + ' day' + (TRIAL.daysLeft === 1 ? '' : 's') + ' left'
        : cap + ' slips on the free trial')
    : plan === 'lifetime'
      ? 'Unlimited, permanently'
      : until ? 'Unlimited until ' + DS.format(until) : 'Unlimited');
  setText('planUsage', plan === 'free'
    ? (TRIAL ? TRIAL.slipsUsed : Math.min(LEDGER.length + PENDING.length, cap)) + ' of ' + cap
    : M.plain(LEDGER.length + PENDING.length));
}

export function renderAll() {
  renderCalendar();
  renderGoal();
  renderHeadline();
  renderRecentBets();
  renderLedger();
  renderGroups();
  renderPeople();
  renderPending();
  renderTrial();
  renderPlan();
  renderPl();
}
