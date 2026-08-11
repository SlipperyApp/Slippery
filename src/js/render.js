/* Renderers. Every one reads from data.js / stats.js and writes DOM.
   None of them invent a figure. */
import { $, $$, esc, setText, setHTML, paintSeg } from './dom.js';
import { S } from './state.js';
import * as M from './money.js';
import {
  LEDGER, PENDING, PEOPLE, GROUPS, TODAY, THEMES, THEME_BG, BOOKS, TIPSTERS,
  OUTCOME_ICON, OUTCOME_LABEL, outcomeGroup, personMonths, personDays, IMPORTED, ico
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
    '<div class="amt ' + (b.profit >= 0 ? 'pos' : 'neg') + '">' + main + '</div>' +
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
      if (has) {
        const r = Math.min(1, Math.abs(v) / max);
        const rgb = v > 0 ? '134,239,172' : '252,165,165';
        style += ';background:rgba(' + rgb + ',' + (0.1 + r * 0.24).toFixed(3) +
                 ');border-color:rgba(' + rgb + ',' + (0.26 + r * 0.3).toFixed(3) + ')';
      }
      const label = has
        ? DS.format(new Date(TODAY.year, S.month, d)) + ', ' + M.signed(v)
        : DS.format(new Date(TODAY.year, S.month, d)) + ', no bets';
      html += '<button class="cell ' + cls + (isToday ? ' today' : '') +
        (S.focus === d && has ? ' picked' : '') + '" style="' + style + '"' +
        (has ? ' data-day="' + d + '"' : ' disabled') +
        ' aria-label="' + esc(label) + '">' +
        (has ? '<span class="amt ' + (v > 0 ? 'pos' : 'neg') + '" aria-hidden="true">' +
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
        (v ? '<span class="amt ' + (v > 0 ? 'pos' : 'neg') + '" aria-hidden="true">' +
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

  const label = S.period === 'a' ? 'Net all time'
    : S.period === 'm' ? (S.month === TODAY.month ? 'Net this month'
        : 'Net in ' + MS.format(new Date(TODAY.year, S.month, 1)))
    : S.period === 'd' ? 'Net on ' + DS.format(new Date(TODAY.year, S.month, S.focus))
    : 'Net, ' + p.label;
  setText('headlineLabel', label);

  const v = $('headlineValue');
  v.textContent = M.signed(p.profit);
  v.className = 'value m ' + (p.profit >= 0 ? 'pos' : 'neg');

  setText('statBets', M.plain(p.bets));
  setText('statUnits', M.units(p.profit, S.unit));
  setText('statTurnover', M.money0(p.turnover));
  setText('statWinRate', p.winRate + '%');
  setText('statAvgOdds', p.avgOdds ? p.avgOdds.toFixed(2) : '—');
  const roi = $('statRoi');
  roi.textContent = M.pct(p.roi);
  roi.className = p.roi >= 0 ? 'pos' : 'neg';

  /* All time reaches past the ledger into imported history. Saying so is
     the difference between a number that reconciles and one that lies. */
  const note = $('importedNote');
  if (p.includesImported) {
    note.hidden = false;
    note.textContent = M.plain(p.ledgerBets) + ' slips in the ledger, plus ' +
      M.plain(IMPORTED.bets) + ' bets imported from 2023–2025 as totals.';
  } else note.hidden = true;

  $('kpiRow').innerHTML = [
    ['All time', M.money0s(life.profit), life.profit >= 0 ? 'pos' : 'neg'],
    ['Units', M.units(life.profit, S.unit), life.profit >= 0 ? 'pos' : 'neg'],
    ['Avg odds', life.avgOdds.toFixed(2), ''],
    ['ROI, life', M.pct(life.roi), life.roi >= 0 ? 'pos' : 'neg']
  ].map(k => '<div class="kpi"><div class="n">' + k[0] + '</div><div class="v ' + k[2] + '">' +
    k[1] + '</div></div>').join('');

  $('kpiPair').innerHTML = [
    ['Win rate', p.winRate + '%', ''],
    ['Best run', p.streak + (p.streak === 1 ? ' day' : ' days'), ''],
    ['Best day', M.money0s(p.best), p.best >= 0 ? 'pos' : 'neg'],
    ['Worst day', M.money0s(p.worst), p.worst >= 0 ? 'pos' : 'neg']
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
    ['Net', M.money0s(p.profit), p.profit >= 0 ? 'pos' : 'neg'],
    ['Units', M.units(p.profit, S.unit), p.profit >= 0 ? 'pos' : 'neg'],
    ['Turnover', M.money0(p.turnover), ''],
    ['ROI', M.pct(p.roi), p.roi >= 0 ? 'pos' : 'neg']
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
    '<div class="runfoot"><button class="btn primary full" id="checkResults" style="margin-bottom:12px">Check results now</button>' +
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
    ? '<span class="n ' + (v >= 0 ? 'pos' : 'neg') + '">' + M.units(v, p.un) + '</span>' +
      '<span class="s">' + M.money0s(v) + '</span>'
    : '<span class="hidden-note">' + LOCK + (p.pv === 'private' ? 'Private' : 'Friends only') + '</span>';
  const tag = '<span class="privacytag ' + p.pv + '">' + p.pv + '</span>';
  return '<div class="person">' +
    '<button class="who" data-profile="' + esc(p.n) + '" style="display:flex;align-items:center;gap:11px;text-align:left;min-width:0;flex:1">' +
      '<span class="avatar" aria-hidden="true">' + esc(p.a) + '</span>' +
      '<span style="min-width:0">' +
        '<span class="nm"><span translate="no">' + esc(p.n) + '</span>' + (p.v ? VERIFIED : '') + tag + '</span>' +
        '<span class="sub" style="display:block">1u = ' + M.money0(p.un) + (p.mu ? ' · follows you back' : '') + '</span>' +
      '</span>' +
    '</button>' +
    '<span class="val">' + val + '</span>' +
    '<button class="followbtn" data-follow="' + esc(p.n) + '" aria-pressed="' + !!p.ing + '">' +
      (p.ing ? 'Following' : mode === 'followers' ? 'Follow back' : 'Follow') + '</button>' +
  '</div>';
}

export function renderPeople() {
  const q = S.peopleQuery.toLowerCase();
  const following = q ? PEOPLE.filter(p => p.n.toLowerCase().includes(q)) : PEOPLE.filter(p => p.ing);
  const followers = PEOPLE.filter(p => p.er);
  const totalUnits = list => list.filter(visible).reduce((a, p) => a + personValue(p) / p.un, 0);
  const head = (t, r) => '<div class="cardhead"><span class="title">' + t + '</span><span class="meta">' + r + '</span></div>';

  $('followingList').innerHTML = following.length
    ? head(q ? 'Results ' + following.length : 'Following ' + following.length,
           periodWord() + ' · in their units') + following.map(p => personRow(p, 'following')).join('')
    : '<div class="emptystate"><div class="t">Nobody here</div><p>' +
      (q ? 'Nobody matches that name.' : 'Search above to find people.') + '</p></div>';

  $('followersList').innerHTML = followers.length
    ? head('Followers ' + followers.length, followers.filter(p => p.ing).length + ' mutual') +
      followers.map(p => personRow(p, 'followers')).join('')
    : '<div class="emptystate"><div class="t">No followers yet</div><p>Share your name to get started.</p></div>';

  $('followingSummary').innerHTML = duo('Following', following.length, totalUnits(following));
  $('followersSummary').innerHTML = duo('Followers', followers.length, totalUnits(followers));
}

function duo(title, n, units) {
  return '<div class="duo"><div><div class="k">' + title + '</div><div class="v">' + n + '</div></div>' +
    '<div><div class="k">Combined, ' + periodWord() + '</div><div class="v ' +
    (units >= 0 ? 'pos' : 'neg') + '">' +
    ((units >= 0 ? '+' : '−') + Math.abs(units).toFixed(2) + 'u') + '</div></div></div>';
}

function groupRows(g) {
  const me = stats(S, MS);
  return g.mem.map(n => {
    if (n === 'You') return { n: 'You', a: 'YO', un: S.unit, v: me.profit, verified: true, me: true };
    const p = PEOPLE.find(x => x.n === n);
    return p ? { n: p.n, a: p.a, un: p.un, v: personValue(p), verified: p.v } : null;
  }).filter(Boolean).sort((a, b) => b.v / b.un - a.v / a.un);
}

export function renderGroups() {
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
      '<span class="gval ' + (totalUnits >= 0 ? 'pos' : 'neg') + '">' +
      ((totalUnits >= 0 ? '+' : '−') + Math.abs(totalUnits).toFixed(2) + 'u') + '</span></span>' +
      '<span class="r2"><span class="gsub">' + g.mem.length + ' members · you are ' + place + ord +
      '</span><span class="gper">' + periodWord() + '</span></span></span></button>';
  }).join('');

  const g = GROUPS[S.group];
  const rows = groupRows(g);
  const totalUnits = rows.reduce((a, r) => a + r.v / r.un, 0);
  $('groupBoard').innerHTML =
    '<div class="cardhead"><span class="title">' + esc(g.name) + '</span>' +
    '<span class="meta">' + periodWord() + ' · in units</span></div>' +
    '<div class="duo"><div><div class="k">Group total</div><div class="v ' +
      (totalUnits >= 0 ? 'pos' : 'neg') + '">' +
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
      '<span class="val"><span class="n ' + (p.v >= 0 ? 'pos' : 'neg') + '">' +
      M.units(p.v, p.un) + '</span><span class="s">' + M.money0s(p.v) + '</span></span></div>').join('');
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
      style = 'background:rgba(' + (v > 0 ? '134,239,172' : '252,165,165') + ',' +
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
    '<p class="bignum ' + (p.all >= 0 ? 'pos' : 'neg') + '">' + M.units(p.all, p.un) + '</p>' +
    '<p class="mut m" style="font-size:12.5px;margin-top:3px">' + M.money0s(p.all) +
      ' at ' + M.money0(p.un) + ' a unit</p>' +
    '<div class="kpis pair" style="margin:12px 0 0">' +
      kpi('This month', M.units(thisMonth, p.un), thisMonth >= 0 ? 'pos' : 'neg') +
      kpi('This year', M.units(yearTotal, p.un), yearTotal >= 0 ? 'pos' : 'neg') +
      kpi('ROI', M.pct(p.roi), p.roi >= 0 ? 'pos' : 'neg') +
      kpi('Bets', M.plain(p.b), '') +
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

    (sharesGroup(p)
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
    ['private', 'Private', 'Nobody sees your figures. Groups you join still do.',
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

export function renderMisc() {
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
    ' style="background:linear-gradient(140deg,' + t[2] + ',' + t[3] + ')" aria-label="' + t[1] + ' theme">' +
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

export function renderAll() {
  renderCalendar();
  renderGoal();
  renderHeadline();
  renderRecentBets();
  renderLedger();
  renderGroups();
  renderPeople();
  renderPending();
}
