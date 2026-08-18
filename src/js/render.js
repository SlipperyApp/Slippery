/* Renderers. Every one reads from data.js / stats.js and writes DOM.
   None of them invent a figure. */
import { $, $$, esc, setText, setHTML, paintSeg } from './dom.js';
import { S } from './state.js';
import * as M from './money.js';
import {
  LEDGER, PENDING, PEOPLE, GROUPS, TODAY, THEMES, THEME_BG, BOOKS, TIPSTERS,
  OUTCOME_ICON, OUTCOME_LABEL, outcomeGroup, personMonths, personDays, ico, TRIAL, FOUND, PL, CAPTURE
} from './data.js';
import {
  importedTotals,
  stats, lifetime, reconcile, dayMap, monthTotal, yearTotal, dowLabels, dowOffset, weekRange, targetFor
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
  : S.period === 'y' ? (S.year === TODAY.year ? 'this year' : String(S.year))
  : S.period === 'm' ? (S.year === TODAY.year && S.month === TODAY.month
      ? 'this month' : MS.format(new Date(S.year, S.month, 1)) + ' ' + S.year)
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
  const stamp = (b.year === TODAY.year && b.month === TODAY.month && b.day === TODAY.day)
    ? b.time
    : b.day + ' ' + MS.format(new Date(b.year, b.month, 1)) +
      (b.year === TODAY.year ? '' : ' ' + b.year) + ' ' + b.time;
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
  if (S.period === 'y') return LEDGER.filter(b => b.year === S.year);
  if (S.period === 'd' && S.focus != null)
    return LEDGER.filter(b => b.year === S.year && b.month === S.month && b.day === S.focus);
  if (S.period === 'w' && S.focus != null) {
    const r = weekRange(S.year, S.month, S.focus, S.weekStart);
    const n = d => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
    const a = n(r.from), z = n(r.to);
    return LEDGER.filter(b => {
      const k = Math.floor(Date.UTC(b.year, b.month, b.day) / 86400000);
      return k >= a && k <= z;
    });
  }
  return LEDGER.filter(b => b.year === S.year && b.month === S.month);
}

export function renderRecentBets() {
  /* The period picker governs this list too. It used to slice the top of
     the whole ledger whatever was selected, so picking a week showed bets
     from outside it directly beneath a figure that excluded them. */
  const scoped = scopedBets();
  const list = scoped.slice(0, S.showAllBets ? 25 : S.showMore ? 7 : 4);
  const el = $('recentBets');
  el.innerHTML = list.length ? list.map(b => betRow(b)).join('')
    : LEDGER.length
      /* Empty because of the period, not because there is nothing. Saying
         "no bets yet" to somebody with a full ledger sends them off to
         import history they already have. */
      ? '<div class="emptystate"><div class="t">Nothing in ' + esc(periodWord()) + '</div>' +
        '<p>Widen the period to see the rest of your record.</p></div>'
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
    const days = dayMap(S.year, S.month);
    const dim = new Date(S.year, S.month + 1, 0).getDate();
    const first = dowOffset(new Date(S.year, S.month, 1), S.weekStart);
    const max = Object.keys(days).reduce((a, k) => Math.max(a, Math.abs(days[k])), 0) || 1;
    /* The year is in the title whenever it is not this one, or a calendar
       of last March is indistinguishable from this March. */
    setText('calTitle', ML.format(new Date(S.year, S.month, 1)) +
      (S.year === TODAY.year ? '' : ' ' + S.year));

    for (let i = 0; i < first; i++) html += '<div class="cell blank"></div>';
    for (let d = 1; d <= dim; d++) {
      const v = days[d];
      const has = v !== undefined;
      const isToday = S.year === TODAY.year && S.month === TODAY.month && d === TODAY.day;
      const past = S.year < TODAY.year ||
        (S.year === TODAY.year && (S.month < TODAY.month || (S.month === TODAY.month && d < TODAY.day)));
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
        ? DS.format(new Date(S.year, S.month, d)) + ' ' + S.year + ', ' + M.signed(v)
        : DS.format(new Date(S.year, S.month, d)) + ' ' + S.year + ', no bets, tap to add a figure';
      html += '<button class="cell ' + cls + (isToday ? ' today' : '') +
        (S.focus === d ? ' picked' : '') + '" style="' + style + '"' +
        ' data-day="' + d + '"' +
        ' aria-label="' + esc(label) + '">' +
        (has ? '<span class="amt ' + M.tone(v) + '" aria-hidden="true">' +
          M.compact(v) + '</span>' : '') +
        '<span class="dnum" aria-hidden="true">' + d + '</span></button>';
    }
  } else {
    setText('calTitle', String(S.year));
    const totals = [];
    for (let m = 0; m < 12; m++) totals.push(monthTotal(S.year, m));
    const max = totals.reduce((a, v) => Math.max(a, Math.abs(v)), 0) || 1;
    totals.forEach((v, m) => {
      let style = 'animation-delay:' + m * 28 + 'ms';
      if (v) {
        const r = Math.min(1, Math.abs(v) / max);
        const rgb = v > 0 ? '134,239,172' : '252,165,165';
        style += ';background:rgba(' + rgb + ',' + (0.1 + r * 0.24).toFixed(3) +
                 ');border-color:rgba(' + rgb + ',' + (0.26 + r * 0.3).toFixed(3) + ')';
      }
      const name = MS.format(new Date(S.year, m, 1));
      /* Every month opens, empty or not, exactly as every day already
         does. A month with nothing in it was `disabled`, so the one thing
         you would go to an empty month to do, add a figure to it, was the
         one thing the calendar would not let you start. Past and future
         both: a figure can be entered for either. */
      const ahead = S.year > TODAY.year || (S.year === TODAY.year && m > TODAY.month);
      html += '<button class="cell ' + (v ? 'hasbets' : ahead ? 'future' : 'nobets') +
        (S.year === TODAY.year && m === TODAY.month ? ' today' : '') + '" style="' + style + '"' +
        ' data-month="' + m + '"' +
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
    const y = S.year;
    const mon = (d, m) => pad(d) + ' ' + MS.format(new Date(y, m, 1)).toUpperCase();
    if (S.period === 'a') return LEDGER.length ? 'ALL TIME' : 'NOTHING LOGGED YET';
    if (S.period === 'y') return '01 JAN TO 31 DEC ' + y;
    if (S.period === 'd' && S.focus != null) {
      return DS.format(new Date(y, S.month, S.focus)).toUpperCase() + ' ' + y;
    }
    if (S.period === 'w' && S.focus != null) {
      /* Printed from the real week, so one that crosses a month or a year
         boundary says so instead of being clipped to the grid on screen. */
      const r = weekRange(y, S.month, S.focus, S.weekStart);
      const a = mon(r.from.getDate(), r.from.getMonth());
      const b = pad(r.to.getDate()) + ' ' + MS.format(r.to).toUpperCase();
      return a + ' TO ' + b + ' ' + r.to.getFullYear();
    }
    const dim = new Date(y, S.month + 1, 0).getDate();
    return '01 TO ' + dim + ' ' + MS.format(new Date(y, S.month, 1)).toUpperCase() + ' ' + y;
  })();
  setText('headlineRef',
    range + '  ·  ' + (p.activeDays === 1 ? '1 ACTIVE DAY' : p.activeDays + ' ACTIVE DAYS'));

  const label = S.period === 'a' ? 'Net all time'
    : S.period === 'y' ? (S.year === TODAY.year ? 'Net this year' : 'Net in ' + S.year)
    : S.period === 'm' ? (S.year === TODAY.year && S.month === TODAY.month ? 'Net this month'
        : 'Net in ' + MS.format(new Date(S.year, S.month, 1)) +
          (S.year === TODAY.year ? '' : ' ' + S.year))
    : S.period === 'w' ? 'Net this week'
    : 'Net on ' + (S.focus != null
        ? DS.format(new Date(S.year, S.month, S.focus))
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
  setText('statBets', M.plain(p.bets));
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
      /* The whole split, not one number. "90% pre-match" alone invites the
         question the other two thirds answer, and the three together are
         the thing no other tracker can print. */
      const pc = n => Math.round(n / CAPTURE.known * 100);
      setHTML('captureText',
        'Logged <b>' + pc(CAPTURE.prematch) + '%</b> at placement, ' +
        '<b>' + pc(CAPTURE.inplay) + '%</b> in play, ' +
        '<b>' + pc(CAPTURE.settled) + '%</b> after settling' +
        (CAPTURE.known < 5 ? ' <span class="capfew">(' + CAPTURE.known + ' so far)</span>' : ''));
      capEl.setAttribute('aria-label',
        CAPTURE.prematch + ' of ' + CAPTURE.known +
        ' bets were logged before the game started. What this means.');
    }
  }

  /* The period figure reaches past the ledger into imported history. Saying
     so is the difference between a number that reconciles and one that
     lies, and it is now said in whatever period is on screen rather than
     only on all time: an imported March shows up when you look at March.

     The figures used to be written, drawn on the calendar and then left
     out of every total, so importing a year of history moved the profit
     and loss by exactly nothing. */
  const note = $('importedNote');
  const imp = importedTotals();
  if (p.includesImported) {
    note.hidden = false;
    note.textContent = M.plain(p.ledgerBets) + ' slips in the ledger, plus ' +
      (imp.bets ? M.plain(imp.bets) + ' imported bets' : 'imported figures') +
      ' with no slips behind them. Ledger, History shows the addition.';
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
    for (let m = 0; m < 12; m++) { total += monthTotal(S.year, m); target += targetFor(m); }
    name = (S.year === TODAY.year ? 'Year' : S.year) + ' target';
    elapsed = S.year < TODAY.year ? 1 : S.year > TODAY.year ? 0 : TODAY.doy / 365;
    state = S.year === TODAY.year ? 'current' : S.year < TODAY.year ? 'past' : 'future';
  } else {
    total = monthTotal(S.year, S.month);
    target = targetFor(S.month);
    name = (S.year === TODAY.year && S.month === TODAY.month
      ? 'This month'
      : MS.format(new Date(S.year, S.month, 1)) + (S.year === TODAY.year ? '' : ' ' + S.year)) + ' target';
    const ord = S.year * 12 + S.month, now = TODAY.year * 12 + TODAY.month;
    state = ord < now ? 'past' : ord > now ? 'future' : 'current';
    elapsed = state === 'past' ? 1 : state === 'future' ? 0 : TODAY.day / TODAY.dim;
  }
  const ratio = Math.max(0, Math.min(1, total / target));
  setHTML('goalLabel', esc(name) +
    ' <button class="editable" id="editTarget" aria-label="Edit target">' + M.money0(target) + '</button>');
  setText('goalPct', Math.round(total / target * 100) + '%');
  $('goalFill').style.transform = 'scaleX(' + ratio + ')';

  /* NO PACE, AND A SHORTFALL IS NEVER RED.
   *
   * This used to place a marker for where you "should" be by today and
   * label anything behind it "Behind pace" in loss red. On a gambling
   * tracker that is an instruction to bet more to catch up, which is the
   * one thing the brief says nothing here may do. The marker is gone and
   * the sentence states what happened rather than what it implies you owe.
   *
   * Beating a target is still green, because that is a fact about money
   * you made. Falling short is muted, not red: red is reserved for money
   * actually lost, and colouring an unmet goal the same as a loss tells
   * somebody they lost when they did not. */
  const pace = $('goalPace');
  if (pace) pace.style.display = 'none';
  setText('goalEarned', M.money0s(total) + ' earned');

  const n = $('goalPace2');
  let cls = 'mut';
  if (state === 'future') n.textContent = 'Not started';
  else if (total >= target) {
    n.textContent = 'Target beaten by ' + M.money0(total - target); cls = 'pos';
  } else if (state === 'past') {
    n.textContent = M.money0(target - total) + ' under';
  } else {
    n.textContent = M.money0(target - total) + ' to go';
  }
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
/* What a board can answer, which is not always what the picker asks.
 *
 * A group response carries one all-time figure and twelve monthly ones for
 * the current year, and nothing finer. A week used to be answered with
 * month × 7/30 and a day with month / 30: not that person's week or day,
 * but this month's figure divided by an average and then printed to the
 * penny beside real ones, and used to rank people against each other.
 *
 * So the board resolves to the finest period it genuinely holds and says
 * which one that is, rather than inventing the rest. */
export function boardPeriod() {
  if (S.period === 'a') return 'a';
  /* The twelve months are this year's. An earlier year is not held at all,
     so all time is the only honest answer for it. */
  if (S.year !== TODAY.year) return 'a';
  if (S.period === 'y') return 'y';
  return 'm';
}
export function boardWord() {
  const b = boardPeriod();
  return b === 'a' ? 'all time'
    : b === 'y' ? String(TODAY.year)
    : MS.format(new Date(TODAY.year, S.month, 1));
}
export function personValue(p) {
  const b = boardPeriod();
  if (b === 'a') return p.all;
  const mo = personMonths(p);
  return b === 'y' ? mo.reduce((a, x) => a + x, 0) : (mo[S.month] || 0);
}
/* Your own figure on the same board, over the same span. Reading it from
   stats(S) instead would rank you over a week while ranking everybody else
   over the month. */
function myBoardValue() {
  const b = boardPeriod();
  return b === 'a' ? lifetime().profit
    : b === 'y' ? yearTotal(TODAY.year)
    : monthTotal(TODAY.year, S.month);
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
    '<div><div class="k">Combined, ' + boardWord() + '</div><div class="v ' +
    M.tone(units) + '">' +
    ((units >= 0 ? '+' : '−') + Math.abs(units).toFixed(2) + 'u') + '</div></div></div>';
}

function groupRows(g) {
  return g.mem.map(n => {
    /* Your own tick is whatever the session says it is. This was hardcoded
       true, which claimed a verification nobody had granted. */
    if (n === 'You') return { n: 'You', a: 'YO', un: S.unit, v: myBoardValue(), verified: S.verified, me: true };
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

  list.innerHTML = PL.map(p => plRow(p, true)).join('');
}

/* ---------------- the two ledgers, side by side ----------------
 *
 * A bet logged here has a slip behind it. An imported figure is a date and
 * an amount and nothing else. Both belong in the period total and only one
 * of them can be checked, so the ledger shows them apart and adds them up
 * where you can see the addition, rather than folding history into the
 * headline and mentioning it in a note underneath.
 */
export function renderHistory() {
  const rows = $('reconRows');
  if (!rows) return;
  const r = reconcile(S);

  const line = (k, v, sub, tone) =>
    '<div class="reconrow"><span class="rk">' + esc(k) +
      (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' +
    '<span class="rv ' + (tone || M.tone(v)) + '">' + M.signed(v) + '</span></div>';

  rows.innerHTML =
    line('Logged here', r.logged,
      r.loggedBets + (r.loggedBets === 1 ? ' bet with a slip behind it' : ' bets, each with a slip behind it')) +
    line('Imported history', r.imported,
      r.importedRows.length
        ? r.importedRows.length + (r.importedRows.length === 1 ? ' figure' : ' figures') +
          (r.importedBets ? ', covering ' + M.plain(r.importedBets) + ' bets' : ', no bets behind them')
        : 'Nothing imported in this period') +
    '<div class="reconrow total"><span class="rk">Net ' + esc(periodWord()) + '</span>' +
    '<span class="rv ' + M.tone(r.total) + '">' + M.signed(r.total) + '</span></div>';

  setText('historyMeta', r.importedRows.length
    ? r.importedRows.length + (r.importedRows.length === 1 ? ' figure' : ' figures') + ', ' + periodWord()
    : '');
  $('historyList').innerHTML = r.importedRows.length
    ? r.importedRows.map(plRow).join('')
    : '<div class="emptystate"><div class="t">No imported history here</div>' +
      '<p>Figures brought across from another tracker appear in the period they are dated. ' +
      'Bring some across from Import.</p></div>';
}

/* One imported figure, the same row on the Import screen and here. The
   remove button only belongs where they are being added, so it is an
   argument rather than always drawn. */
function plRow(p, removable) {
  const d = new Date(p.date + 'T12:00:00');
  const when = Number.isNaN(d.getTime()) ? p.date
    : p.period === 'month' ? ML.format(d)
    : p.period === 'week' ? 'Week of ' + DS.format(d)
    : p.period === 'year' ? String(d.getFullYear())
    : DS.format(d) + ' ' + d.getFullYear();
  return '<div class="plrow">' +
    '<span class="pld">' + esc(when) +
      (PL_TAG[p.period] ? '<span class="plt">' + PL_TAG[p.period] + '</span>' : '') +
      (p.source === 'import' ? '<span class="plt">imported</span>' : '') + '</span>' +
    '<span class="plv ' + M.tone(p.profit) + '">' + M.signed(p.profit) + '</span>' +
    (removable
      ? '<button class="plx" data-remove-pl="' + esc(p.id) + '" ' +
        'aria-label="Remove the figure for ' + esc(when) + '">' + ico('i-close') + '</button>'
      : '') +
  '</div>';
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
      (query ? 'Nothing matching ' + esc(query) : 'No groups yet') + '</div>' +
      '<p>' + (query
        ? 'Try a shorter search, or start a group with that name yourself.'
        : 'Groups appear here as people create them. Start one and it will be the first.') +
      '</p></div>';
    return;
  }
  /* EVERY group is listed now, private ones included, and the row says
     which it is. The lock is not the listing, it is the door: nobody gets
     into any group without the person who made it saying yes, so showing
     a private group's name costs nothing and hiding it made the group
     undiscoverable. */
  el.innerHTML = groups.map(g =>
    '<div class="browserow">' +
    '<span class="glyph" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
    '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 21v-1a5 5 0 0 1 5-5h3a5 5 0 0 1 5 5v1"/>' +
    '<path d="M16 3.6a3.2 3.2 0 0 1 0 6.4"/></svg></span>' +
    /* The private marker goes on the second line, not beside the name.
       .bname truncates with an ellipsis, so a badge inside it is the first
       thing to disappear on a long group name, which is exactly the row
       where knowing it is private matters. */
    '<span class="body"><span class="bname">' + esc(g.name) + '</span>' +
    '<span class="bsub">' + g.members + ' member' + (g.members === 1 ? '' : 's') +
      (g.visibility === 'private' ? '<span class="bpriv">Private</span>' : '') + '</span></span>' +
    (g.joined
      ? '<span class="bin">Joined</span>'
      : g.asked
        ? '<span class="bin">Asked</span>'
        : g.full
          ? '<span class="bin">Full</span>'
          : '<button class="btn ghost small" data-browse-join="' + esc(g.id) + '" ' +
            'data-name="' + esc(g.name) + '">Ask to join</button>') +
    '</div>').join('');
}

/* The owner's inbox. Renders nothing at all when there is nothing waiting,
   rather than an empty panel that has to be scrolled past forever. */
export function renderRequests(list) {
  const el = $('reqList');
  const wrap = $('reqWrap');
  if (!el || !wrap) return;
  if (!list || !list.length) { wrap.hidden = true; el.innerHTML = ''; return; }
  wrap.hidden = false;
  setText('reqCount', String(list.length));
  el.innerHTML = list.map(r =>
    '<div class="reqrow">' +
    '<span class="body"><span class="bname">' + esc(r.person) + '</span>' +
    '<span class="bsub">wants into ' + esc(r.groupName) + '</span></span>' +
    '<span class="reqbtns">' +
    '<button class="btn ghost small" data-decide="no" data-group="' + esc(r.groupId) +
      '" data-person="' + esc(r.userId) + '">No</button>' +
    '<button class="btn primary small" data-decide="yes" data-group="' + esc(r.groupId) +
      '" data-person="' + esc(r.userId) + '">Let in</button>' +
    '</span></div>').join('');
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
  const yearSum = mo.reduce((a, b) => a + b, 0);

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
      kpi('This year', M.units(yearSum, p.un), M.tone(yearSum)) +
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

  /* Each option is a small live dashboard in its own theme rather than a
     coloured tile, because "what hue is it" was never the question. The
     card carries data-t, which is what makes every colour inside it that
     theme's real token instead of a hardcoded approximation.

     data-theme routes the click and data-t paints. They are deliberately
     two attributes: one of them is also on <html>, and an attribute that
     both dispatches and stores state is how Confirm once stopped saving
     bets. */
  const swatches = THEMES.map(t =>
    '<button class="thm' + (t[5] ? ' is-rec' : '') + '" data-theme="' + t[0] + '" data-t="' + t[0] + '"' +
    ' aria-pressed="' + (S.theme === t[0]) + '">' +
      '<span class="pv" aria-hidden="true">' +
        '<span class="pv-top"><i class="pv-cap"></i><span class="pv-fig">+' + M.money0(4820) + '</span></span>' +
        '<span class="pv-row"><i class="pv-bar"></i><span class="pv-loss">−' + M.money0(1240) + '</span></span>' +
        '<span class="pv-nav"><i></i><i></i><i></i></span>' +
      '</span>' +
      '<span class="thm-h">' + esc(t[1]) +
        (t[5] ? '<span class="rec">Recommended</span>' : '') + '</span>' +
      '<span class="thm-d">' + esc(t[4]) + '</span>' +
    '</button>').join('');
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
  renderPlan();
  renderPrivacy();
  /* TELEGRAM: ONE STATE AT A TIME.
     The card used to show a code and a "connected since" line whatever the
     truth was, so an account with no bot linked was told it had one. The
     two halves are now mutually exclusive and both are driven from the
     session rather than from the markup. */
  renderTelegram(user);

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
  renderHistory();
}


/* ---------------- the Telegram link ----------------
 *
 * The countdown is the point. A code with ten minutes on it and no visible
 * clock is a code somebody types out at minute eleven and is told did not
 * match, with nothing on screen having changed. One interval for the whole
 * app, cleared whenever the state is repainted, so switching views does
 * not leave timers running in the background.
 */
let linkTick = null;

export function renderTelegram(user) {
  const linked = Boolean(user && user.telegramLinked);
  const on = $('tgLinked'), off = $('tgUnlinked');
  if (on) on.hidden = !linked;
  if (off) off.hidden = linked;

  if (linkTick) { clearInterval(linkTick); linkTick = null; }

  if (linked) {
    setText('tgState', user.telegramUsername ? 'Connected as @' + user.telegramUsername : 'Connected');
    const at = user.telegramLinkedAt ? new Date(user.telegramLinkedAt) : null;
    setText('tgSince', at && !Number.isNaN(at.getTime())
      ? 'Linked on ' + DF.format(at) + '. Slips forwarded to the bot land on this account.'
      : 'Slips forwarded to the bot land on this account.');
    return;
  }

  const code = $('linkCodeSettings');
  if (code) code.textContent = user && user.linkCode ? user.linkCode : '------';
  paintCountdown(user && user.linkCodeExpiresAt);
  if (user && user.linkCodeExpiresAt) {
    linkTick = setInterval(() => paintCountdown(user.linkCodeExpiresAt), 1000);
  }
}

function paintCountdown(expiresAt) {
  const el = $('tgCountdown');
  if (!el) return;
  if (!expiresAt) {
    el.textContent = 'Tap New code to get one. It lasts ten minutes.';
    return;
  }
  const left = new Date(expiresAt) - Date.now();
  if (left <= 0) {
    if (linkTick) { clearInterval(linkTick); linkTick = null; }
    const code = $('linkCodeSettings');
    if (code) code.textContent = '------';
    el.textContent = 'That code has expired. Tap New code for another.';
    return;
  }
  const m = Math.floor(left / 60000);
  const sec = Math.floor((left % 60000) / 1000);
  el.textContent = 'Expires in ' + m + ':' + String(sec).padStart(2, '0');
}
