/* Wiring and init. One delegated listener per event type. */
import { $, $$, esc, RM, toast, announce, collapse, paintSeg, paintSegs, reveal, trapFocus, setText, setHTML } from './dom.js';
import { S, canUsePeriod, periodNeedsFocus } from './state.js';
import * as M from './money.js';
import {
  LEDGER, PENDING, PEOPLE, GROUPS, TODAY, THEMES, THEME_BG, BOOKS, TIPSTERS,
  TARGETS, hydrate, hydrateSocial, addBet, settleLocal, setMe, ME, ico
} from './data.js';
import { settle, settleCashOut, ledgerOutcome } from './settlement.js';
import { stats, dayMap, monthTotal, targetFor, weekRange, invalidateDays } from './stats.js';
import * as R from './render.js';
import * as C from './content.js';
import { initMotion, syncThemeColor } from './motion.js';
import { extractSlip, readText, get, post, patch, del } from './api.js';
import { parseBetsCsv } from './csv.js';
import * as Auth from './auth.js';

const MS = R.MS;
const APP_VIEWS = ['dash', 'imp', 'settings', 'prof'];


/* ---------------- the live ledger ----------------
   Everything the app shows comes from here. There is no seeded dataset any
   more, so an empty response renders the empty states rather than somebody
   else's numbers. */
let sessionChecked = false;

/** Ask who we are. Returns the user, or null when signed out. */
async function loadSession() {
  const r = await get('/api/auth/me');
  sessionChecked = true;
  setMe(r.ok ? r.body.user : null);
  document.body.classList.toggle('signed-in', Boolean(r.ok && r.body.user));
  if (r.ok && r.body.configured === false) document.body.classList.add('no-backend');
  return r.ok ? r.body.user : null;
}

/** Pull the ledger. Returns false if it could not be loaded, having said so. */
async function loadLedger() {
  const r = await get('/api/bets');
  if (r.status === 401) { setMe(null); go('setup'); toast('Log in to see your bets.'); return false; }
  if (r.status === 503) { showBackendNotice(r.body); return false; }
  if (!r.ok) { toast(r.body.error || 'Your ledger could not be loaded.'); return false; }
  hydrate(r.body);
  invalidateDays();
  R.renderAll();
  renderNewMonth();          // depends on the ledger, so it re-runs with it
  loadGroups();              // its own request, and not worth blocking on
  return true;
}

/* Groups and the people in them. Separate from the ledger because a board
   is a different question from "what have I bet", and a failure to load one
   must not empty the other. */
async function loadGroups() {
  const r = await get('/api/groups');
  if (!r.ok) return false;
  hydrateSocial(r.body);
  R.renderGroups();
  R.renderPeople();
  return true;
}

/* Create a group: a name and who can see it.
   The button used to relabel itself "Group created" and disable, which
   created nothing. A group with no name and no visibility setting is not a
   group, so both are asked for before anything is sent. */
function openGroupForm() {
  const holder = $('groupForms');
  if (!holder || holder.dataset.mode === 'create') { closeGroupForm(); return; }
  holder.dataset.mode = 'create';
  holder.hidden = false;
  holder.innerHTML =
    '<div class="card pad">' +
    '<div class="cardhead"><span class="title">Start a group</span></div>' +
    '<label class="label" for="groupName">Group name</label>' +
    '<input class="field" id="groupName" maxlength="40" placeholder="Sunday league" autocomplete="off">' +
    '<p class="formerr" id="groupNameErr" hidden></p>' +
    '<p class="label">Who can join</p>' +
    '<div class="optionlist" id="groupVis">' +
      visRow('private', 'Private', 'Invite only. The code is the only way in, and the group is never listed.') +
      visRow('public', 'Public', 'Anyone with the code can join, and it can be listed for people to find.') +
    '</div>' +
    '<p class="fineprint" style="margin-top:11px">Everyone in a group sees everyone else in units. ' +
    'Your privacy setting applies to followers, not to a group you chose to join.</p>' +
    '<div class="btnrow" style="margin-top:12px">' +
    '<button class="btn primary small" id="groupSave">Create it</button>' +
    '<button class="btn ghost small" id="groupCancel">Cancel</button></div></div>';
  $('groupName').focus();
}

/* The same .optioncard the privacy chooser uses. It was a `.option` with a
   `.tick` span, neither of which exists in the stylesheet, so the two
   choices rendered as unstyled centred text with the name run into the
   description. Reuse the class that is already defined rather than adding a
   second one that looks almost the same. */
const VIS_GLYPH = {
  private: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  public: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18"/>'
};
const visRow = (id, name, desc) =>
  '<button class="optioncard" data-vis="' + id + '" aria-pressed="' + (S.groupVis === id) + '">' +
  '<span class="glyph" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="2">' + VIS_GLYPH[id] + '</svg></span>' +
  '<span><span class="t">' + name + '</span><span class="s">' + desc + '</span></span></button>';

function openJoinForm() {
  const holder = $('groupForms');
  if (!holder || holder.dataset.mode === 'join') { closeGroupForm(); return; }
  holder.dataset.mode = 'join';
  holder.hidden = false;
  holder.innerHTML =
    '<div class="card pad">' +
    '<div class="cardhead"><span class="title">Join with a code</span></div>' +
    '<p class="fineprint" style="margin:5px 0 9px">Six characters, from whoever set the group up.</p>' +
    '<label class="sr" for="groupCode">Join code</label>' +
    '<input class="field" id="groupCode" maxlength="7" placeholder="ABC234" autocomplete="off" ' +
      'spellcheck="false" autocapitalize="characters">' +
    '<p class="formerr" id="groupCodeErr" hidden></p>' +
    '<div class="btnrow" style="margin-top:12px">' +
    '<button class="btn primary small" id="groupJoinGo">Join</button>' +
    '<button class="btn ghost small" id="groupCancel">Cancel</button></div></div>';
  $('groupCode').focus();
}

function closeGroupForm() {
  const holder = $('groupForms');
  if (!holder) return;
  holder.hidden = true;
  holder.dataset.mode = '';
  holder.innerHTML = '';
}

function groupError(id, msg) {
  const err = $(id + 'Err');
  const field = $(id);
  if (!err) return;
  err.hidden = !msg;
  err.textContent = msg || '';
  if (msg && field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
  else if (field) field.removeAttribute('aria-invalid');
}

async function createGroup(btn) {
  const name = $('groupName').value.trim();
  if (name.length < 3) { groupError('groupName', 'Give it a name of three characters or more.'); return; }
  groupError('groupName', '');
  btn.disabled = true;
  btn.textContent = 'Creating…';
  const r = await post('/api/groups', { name, visibility: S.groupVis });
  btn.disabled = false;
  btn.textContent = 'Create it';
  if (r.status === 401) { go('setup'); toast('Log in to start a group.'); return; }
  if (!r.ok) { groupError('groupName', r.body.error || 'That group could not be created.'); return; }
  closeGroupForm();
  await loadGroups();
  /* The code is the only way anyone else gets in, so it is the first thing
     shown rather than something to go hunting for. */
  toast(r.body.group.name + ' created. Share the code ' + r.body.group.code);
}

async function joinGroup(btn) {
  const code = $('groupCode').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 6) { groupError('groupCode', 'A join code is six characters.'); return; }
  groupError('groupCode', '');
  btn.disabled = true;
  btn.textContent = 'Joining…';
  const r = await post('/api/groups', { code });
  btn.disabled = false;
  btn.textContent = 'Join';
  if (r.status === 401) { go('setup'); toast('Log in to join a group.'); return; }
  if (!r.ok) { groupError('groupCode', r.body.error || 'That code did not work.'); return; }
  closeGroupForm();
  await loadGroups();
  toast(r.body.joined ? 'Joined ' + r.body.group.name : (r.body.note || 'Already a member'));
}

/* When no database is connected the honest thing is to say so, once, rather
   than render an app that silently holds nothing. */
function showBackendNotice(body) {
  const el = $('backendNotice');
  if (!el) return;
  el.hidden = false;
  setText('backendNeeds', (body && body.needs || []).join(', ') || 'a database');
}

/* ---------------- navigation ----------------
   Views are addressable. Without this the back button did nothing at all:
   on an installed PWA that means Android's hardware back exits the app from
   the middle of signup, and no screen can be linked to or bookmarked.

   pushState rather than location.hash, deliberately, every view id is also
   an element id, so assigning the hash would make the browser scroll to it
   and fight the view transition. */
function go(id, fromHistory) {
  const view = $(id);
  if (!view) return;
  /* The app views hold a real person's money. Without a session there is
     nothing to show, so asking to see them is a request to sign in, not a
     reason to render an empty dashboard and let them wonder. */
  if (APP_VIEWS.includes(id) && sessionChecked && !ME) {
    if (id !== 'setup') { go('setup'); toast('Create an account, or log in, to start tracking.'); }
    return;
  }
  const prev = S.view;
  $$('.view').forEach(v => v.classList.toggle('on', v === view));
  S.view = id;
  document.body.classList.toggle('in-app', APP_VIEWS.includes(id));
  document.documentElement.classList.toggle('snap', id === 'landing' && !RM);
  $$('.tabbar button').forEach(b => {
    const t = b.getAttribute('data-nav');
    if (t === id) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  if (!fromHistory) {
    /* WebKit throws SecurityError from pushState whenever the page has an
       opaque origin, a file:// URL, a sandboxed iframe, and the
       capacitor:// scheme an App Store wrapper would use. It is a URL
       nicety, not a feature worth taking the whole app down for, so it
       fails quietly and navigation carries on without it. */
    try {
      const url = id === 'landing' ? location.pathname : location.pathname + '#' + id;
      /* Replace rather than push when re-entering the same view, so tapping
         a tab twice does not need two presses of back to undo. */
      if (prev === id) history.replaceState({ view: id }, '', url);
      else history.pushState({ view: id }, '', url);
    } catch { /* no addressable URL here; the view still changes */ }
  }
  scrollTo(0, 0);
  reveal(view);
  paintSegs(view);
  if (id === 'setup' && prev !== 'setup') wizardStep(0);
  if (id === 'dash') R.renderAll();
  announce(view.getAttribute('aria-label') || id);
}

function showPane(id) {
  S.pane = id;
  $$('#subnav button').forEach(b => b.setAttribute('aria-selected', String(b.getAttribute('data-pane') === id)));
  const map = { overview: 'paneOverview', ledger: 'paneLedger', social: 'paneSocial' };
  Object.entries(map).forEach(([k, el]) => $(el).classList.toggle('on', k === id));
  scrollTo(0, 0);
  paintSegs($(map[id]));
}

/* ---------------- period ---------------- */
function firstActiveDay(month) {
  const days = Object.keys(dayMap(month)).map(Number).sort((a, b) => a - b);
  if (!days.length) return null;
  if (month === TODAY.month) {
    const upto = days.filter(d => d <= TODAY.day);
    return upto.length ? upto[upto.length - 1] : days[0];
  }
  return days[days.length - 1];
}

/* Day and week need a focused day. The old build let you reach period "D"
   with no focus, fell through to whole-month figures, and then labelled
   them with new Date(2026, 7, null), which coerces to day 0 and renders
   as 31 Jul. So it showed the entire August total as "Net on 31 Jul".
   Now a focus is always established before the period is applied. */
function setPeriod(p) {
  if (periodNeedsFocus(p) && S.focus == null) {
    const d = firstActiveDay(S.month);
    if (d == null) { toast('No bets in this month to break down'); return; }
    S.focus = d;
  }
  S.period = p;
  syncPeriodButtons();
  if (p === 'm') { S.month = TODAY.month; S.calMode = 'm'; syncCalModeButtons(); }
  drawAll();
}

function syncPeriodButtons() {
  const usable = { d: true, w: true, m: true, a: true };
  ['periodSeg', 'ledgerPeriod', 'socialPeriod'].forEach(id => {
    const seg = $(id);
    if (!seg) return;
    $$('button', seg).forEach(b => {
      const p = b.getAttribute('data-period');
      const on = p === S.period;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
      /* A control the keyboard can reach but not use is worse than one it
         cannot reach. Use the real disabled attribute, not pointer-events. */
      const blocked = periodNeedsFocus(p) && S.focus == null && !firstActiveDay(S.month);
      b.disabled = !!blocked;
      b.setAttribute('aria-disabled', String(!!blocked));
    });
    paintSeg(seg);
  });
  return usable;
}
function syncCalModeButtons() {
  $$('#calMode button').forEach(b => {
    const on = b.getAttribute('data-cal') === S.calMode;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  paintSeg($('calMode'));
}

function drawAll() {
  invalidateDays();
  R.renderAll();
  syncPeriodButtons();
}

/* ---------------- day sheet ---------------- */
let lastFocused = null, releaseTrap = null, scrollLockY = 0;

/* iOS Safari ignores overflow:hidden on body for the purposes of the
   rubber-band scroll behind a fixed dialog. Pinning the body is the only
   thing that reliably holds. */
function lockScroll() {
  scrollLockY = window.scrollY || 0;
  document.body.style.position = 'fixed';
  document.body.style.top = -scrollLockY + 'px';
  document.body.style.left = '0';
  document.body.style.right = '0';
  document.body.style.width = '100%';
}
function unlockScroll() {
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.left = '';
  document.body.style.right = '';
  document.body.style.width = '';
  window.scrollTo(0, scrollLockY);
}

function openDay(day) {
  const days = dayMap(S.month);
  const v = days[day];
  if (v === undefined) return;
  S.focus = day;
  const list = LEDGER.filter(b => b.month === S.month && b.day === day);
  const w = weekRange(S.month, day, S.weekStart);
  let weekTotal = 0;
  for (let i = w.a; i <= w.b; i++) if (days[i] !== undefined) weekTotal += days[i];

  setText('dayTitle', R.DF.format(new Date(TODAY.year, S.month, day)));
  const net = $('dayNet');
  net.textContent = M.signed(v);
  net.className = 'n ' + M.tone(v);
  setHTML('daySub', (list.length ? list.length + (list.length === 1 ? ' bet' : ' bets') : 'Daily total') +
    ' · week to ' + R.DS.format(new Date(TODAY.year, S.month, w.b)) +
    ' <b class="' + M.tone(weekTotal) + '">' + M.money0s(weekTotal) + '</b>');
  setHTML('dayList', list.length
    ? list.map((b, i) => R.betRow(b, i * 40)).join('')
    : '<div class="emptystate"><div class="t">Total carried over</div><p>This day came from an imported total, so there are no slips behind it.</p></div>');

  lastFocused = document.activeElement;
  $('scrim').classList.add('on');
  $('daySheet').classList.add('on');
  lockScroll();
  releaseTrap = trapFocus($('daySheet'));
  const first = $('daySheet').querySelector('button');
  if (first) first.focus();
  syncPeriodButtons();
  R.renderCalendar();
  announce(R.DF.format(new Date(TODAY.year, S.month, day)) + ', ' + M.signed(v));
}
function closeDay() {
  if (!$('daySheet').classList.contains('on')) return;
  $('scrim').classList.remove('on');
  $('daySheet').classList.remove('on');
  unlockScroll();
  if (releaseTrap) { releaseTrap(); releaseTrap = null; }
  if (lastFocused && lastFocused.focus) lastFocused.focus();
  lastFocused = null;
}

/* ---------------- settlement ----------------
   ONE settle path. The old build declared settleBet twice in the same
   scope, a UI handler and the grading engine, so the later declaration
   silently won and every manual Won/Lost/Cashed/Void tap called the
   engine with the wrong arguments, dismissed the row, and did nothing. */
function commitSettlement(id, outcome, profitPence, stakePence, reason) {
  settleLocal(id, outcome, profitPence);
  invalidateDays();
  if (reason) announce(reason);
  return true;
}

async function manualSettle(id, kind, cashPence) {
  const b = PENDING.find(x => x.id === id);
  if (!b) return;
  /* The server settles it, using the same engine, and returns the pence it
     stored. Computing the profit here as well would give two answers that
     could disagree, so this asks rather than guesses. */
  const body = kind === 'cash'
    ? { id, kind: 'cash', returnedPence: cashPence != null ? cashPence : b.stake }
    : { id, kind };
  const r = await patch('/api/bets', body);
  if (!r.ok) { toast(r.body.error || 'That could not be saved.'); return; }
  commitSettlement(id, r.body.bet.outcome, r.body.bet.profit);
  R.renderAll();
  toast(b.selection + ' settled, ' + M.signed(r.body.bet.profit));
}

/* The refresh button.
   Asks the server to look up every running bet against the results provider
   and settle what it can. Settlement is never a client-side act: the same
   engine runs on the server against the same fixture data, so there is no
   second grader in the browser to disagree with the first. */
async function checkResults() {
  const btn = $('checkResults');
  const was = btn ? btn.textContent : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Checking…'; }

  const r = await post('/api/settle');

  if (btn) { btn.disabled = false; btn.textContent = was || 'Check results now'; }

  if (r.status === 401) { go('setup'); toast('Log in to check your bets.'); return; }
  if (r.status === 429) { toast(r.body.error || 'Just checked. Give it a minute.'); return; }
  if (r.status === 503) {
    /* Distinguish "no backend" from "the provider is blocking us", they
       need different things from the owner, and neither is the user's
       fault. */
    if (r.body.needs) showBackendNotice(r.body);
    toast(r.body.error || 'Results cannot be checked right now.');
    return;
  }
  if (!r.ok) { toast(r.body.error || 'That check did not go through.'); return; }

  /* Reload rather than patching the store from the response: the server has
     just become the authority on several bets at once, and re-reading is
     both simpler and impossible to get subtly wrong. */
  await loadLedger();

  const b = r.body;
  const bits = [];
  if (b.settled) bits.push(b.settled + (b.settled === 1 ? ' settled' : ' settled'));
  if (b.asked) bits.push(b.asked + ' need you');
  if (b.stillRunning) bits.push(b.stillRunning + ' still running');
  toast(bits.length ? bits.join(', ') : 'Nothing new yet');
}

/* ---------------- theme ---------------- */
function applyTheme(name) {
  S.theme = name;
  document.documentElement.setAttribute('data-theme', name);
  syncThemeColor();
  R.renderMisc();
  renderSetupSummary();
}

let introTimer = null, introDone = false;
function playThemeIntro() {
  if (RM || introDone || !$('themeIntro')) return;
  introDone = true;
  const back = S.theme, overlay = $('themeIntro');
  let i = 0;
  overlay.hidden = false;
  overlay.classList.remove('leaving');
  setHTML('themeIntroDots', THEMES.map(() => '<i></i>').join(''));
  (function step() {
    if (i >= THEMES.length) {
      applyTheme(back);
      overlay.classList.add('leaving');
      introTimer = setTimeout(() => { overlay.hidden = true; introTimer = null; }, 700);
      return;
    }
    const t = THEMES[i];
    document.documentElement.setAttribute('data-theme', t[0]);
    syncThemeColor();
    setText('themeIntroName', t[1]);
    $$('#themeIntroDots i').forEach((d, n) => d.classList.toggle('on', n === i));
    i++;
    introTimer = setTimeout(step, 760);
  })();
}
function stopThemeIntro() {
  if (introTimer) { clearTimeout(introTimer); introTimer = null; }
  const o = $('themeIntro');
  if (o && !o.hidden) { o.classList.add('leaving'); setTimeout(() => { o.hidden = true; }, 640); }
}

/* ---------------- setup wizard ---------------- */
let step = 0;
function wizardStep(n) {
  const steps = $$('.step');
  step = Math.max(0, Math.min(steps.length - 1, n));
  steps.forEach((s, i) => s.classList.toggle('on', i === step));
  $$('#wizbar i').forEach((b, i) => b.classList.toggle('done', i <= step));
  if (step === 2) renderPlanChoice();
  if (step === 3) { R.renderTargets(); paintSegs($('setup')); }
  if (step === 5) R.renderPrivacy();
  if (step === 7) { renderSetupSummary(); playThemeIntro(); }
  scrollTo(0, 0);
}
function renderSetupSummary() {
  const el = $('setupSummary');
  if (!el) return;
  const theme = THEMES.find(t => t[0] === S.theme) || THEMES[0];
  el.innerHTML = [
    ['Display name', S.name],
    ['Unit', M.money0(S.unit)],
    ['Target', { day: 'Daily', week: 'Weekly', month: 'Monthly', year: 'Yearly' }[S.targetPeriod] + ' ' + M.money0(S.target)],
    ['Visibility', { public: 'Public', friends: 'Friends only', private: 'Private' }[S.privacy]],
    ['Theme', theme[1]],
    ['History', S.migrateChoice ? { upload: 'Files uploaded', totals: 'Typed totals', other: 'Other format' }[S.migrateChoice] : 'Skipped']
  ].map(r => '<div class="summaryrow"><span>' + esc(r[0]) + '</span><span>' + esc(r[1]) + '</span></div>').join('');
}

/* ---------------- plans and promo codes ----------------
   The chooser at signup, the checkout page and the Settings plan row all
   read C.PLANS, so there is one description of what each tier includes. */
function renderPlanChoice() {
  const el = $('planChoice');
  if (!el) return;
  setHTML('planChoice', C.PLANS.map(p => {
    const on = S.planChoice === p.id;
    return '<button class="planopt' + (on ? ' on' : '') + '" role="radio" ' +
      'aria-checked="' + on + '" data-plan-pick="' + p.id + '">' +
      '<span class="planopt-top"><b>' + esc(p.name) + '</b>' +
      '<span class="m">' + esc(p.price) + '<small>' + esc(p.per) + '</small></span></span>' +
      '<span class="planopt-note">' + esc(p.note) + '</span>' +
      '<span class="planopt-add">' + esc(p.features[0]) + '</span></button>';
  }).join(''));
}

function renderPayPage() {
  const p = C.planById(S.payPlan);
  setText('payPlanName', p.name);
  setText('payPlanPrice', p.price + p.per);
  setText('payPlanNote', p.note);
  setHTML('payFeatures', p.features.map(f =>
    '<li>' + ico('i-won') + esc(f) + '</li>').join(''));
  setText('payPromoNote', S.plan === 'lifetime'
    ? 'This account is already free for life.'
    : 'Applies immediately, no card needed.');
}

/* Redemption is a server act. A code that unlocked the plan in the browser
   would unlock it for anyone who read the JavaScript. */
async function redeemPromo(btn, inputId, noteId) {
  const input = $(inputId);
  const note = $(noteId);
  const code = input ? input.value.trim() : '';
  const say = (msg, tone) => { if (note) { note.textContent = msg; note.className = 'stepnote ' + (tone || ''); } };
  if (!code) { say('Type the code first.', 'neg'); if (input) input.focus(); return; }

  btn.disabled = true;
  const was = btn.textContent;
  btn.textContent = 'Checking…';
  const r = await post('/api/promo', { code });
  btn.disabled = false;
  btn.textContent = was;

  if (r.status === 401) {
    /* Not signed in yet. At signup the code travels with the form instead,
       so say which box to put it in rather than bouncing them out. */
    say('Sign in first, or enter the code on the account step.', 'neg');
    return;
  }
  if (!r.ok) { say(r.body.error || 'That code could not be applied.', 'neg'); return; }

  S.plan = r.body.plan;
  S.planUntil = r.body.planUntil;
  S.planChoice = r.body.plan === 'lifetime' ? 'free' : r.body.plan;
  say(r.body.label + ', ' + r.body.note, 'pos');
  toast(r.body.label + ' applied');
  R.renderPlan();
  renderPlanChoice();
}

const NAME_A = ['Sharp', 'Value', 'Edge', 'Late', 'Cold', 'Quiet', 'Steady', 'Blue', 'North', 'Half'];
const NAME_B = ['Odds', 'Line', 'Ledger', 'Margin', 'Stake', 'Slip', 'Punt', 'Trader', 'Books', 'Edge'];
function suggestName() {
  for (let i = 0; i < 40; i++) {
    let n = NAME_A[Math.floor(Math.random() * NAME_A.length)] + NAME_B[Math.floor(Math.random() * NAME_B.length)];
    if (Math.random() < 0.4) n += Math.floor(Math.random() * 90 + 10);
    if (n.length <= 20) return n;
  }
  return 'Slip' + Math.floor(Math.random() * 9000 + 1000);
}

/* ---------------- import / upload ---------------- */
let uploadSeq = 0;

/* One drop zone for everything.
   A slip, a PDF statement, a spreadsheet, a profit screen from another
   tracker, a list someone typed. Sorting them was the user's job across two
   tabs; now the file decides, and the only thing that varies is which reader
   it goes to. */
const CSV_LIKE = /\.(csv|tsv|txt)$/i;
const isSpreadsheet = file =>
  CSV_LIKE.test(file.name || '') ||
  /^text\/(csv|tab-separated-values|plain)$/.test(file.type || '');

async function handleFiles(files) {
  const list = Array.prototype.slice.call(files || []).slice(0, 8);
  if (!list.length) return;
  const wrap = $('uploadResults');

  for (const file of list) {
    /* A spreadsheet is parsed in the browser: the file never leaves the
       device unless the user goes ahead, and a bad file gets an answer
       instantly rather than after an upload. */
    if (isSpreadsheet(file)) { await handleCsv(file); continue; }

    const id = 'up' + (++uploadSeq);
    const card = document.createElement('div');
    card.className = 'card pad slipcard';
    card.style.marginTop = '12px';
    card.id = id;
    card.innerHTML = '<div class="cardhead"><span class="title">' + esc(file.name) + '</span>' +
      '<span class="meta">Reading…</span></div>' +
      '<div class="stackbar"><i style="width:100%;background:linear-gradient(90deg,var(--p),var(--s))"></i></div>';
    wrap.appendChild(card);
    try {
      const res = await extractSlip(file);
      renderExtraction(card, file.name, res);
    } catch (err) {
      card.innerHTML = readerError(err.message);
    }
  }
  updateImportTotals();
}

/* Pasted text. Tried as a spreadsheet first, because rows copied out of one
   parse perfectly and cost nothing; prose falls through to the reader. */
async function handlePaste(btn) {
  const text = $('pasteBets').value.trim();
  if (!text) { toast('Paste something first'); return; }

  const rows = parseBetsCsv(text);
  if (rows.bets.length && rows.mapped.length >= 2) {
    showCsvReport(rows, 'what you pasted');
    return;
  }

  btn.disabled = true;
  const was = btn.textContent;
  btn.textContent = 'Reading…';
  const card = document.createElement('div');
  card.className = 'card pad slipcard';
  card.style.marginTop = '12px';
  card.id = 'up' + (++uploadSeq);
  card.innerHTML = '<div class="cardhead"><span class="title">Pasted bets</span>' +
    '<span class="meta">Reading…</span></div>' +
    '<div class="stackbar"><i style="width:100%;background:linear-gradient(90deg,var(--p),var(--s))"></i></div>';
  $('uploadResults').appendChild(card);
  try {
    const res = await readText(text);
    renderExtraction(card, 'Pasted bets', res);
  } catch (err) {
    card.innerHTML = readerError(err.message);
  }
  btn.disabled = false;
  btn.textContent = was;
  updateImportTotals();
}

const readerError = msg =>
  '<div class="alerthead" style="color:var(--neg)">' +
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>' +
  'Could not read that</div>' +
  '<p class="hinttext">' + esc(msg || 'The reader is not reachable right now.') +
  ' Nothing was imported.</p>';

const RESULT_WORD = { won: 'won', lost: 'lost', void: 'void', cashed_out: 'cashed out' };

/* The slip, redrawn as a slip.
   Six stacked labelled inputs did not look like the thing in the photograph,
   so checking the reading meant comparing two different layouts field by
   field. This one mirrors the screenshot: the bookmaker at the top, the
   number of bets in the corner, one row per leg with that leg's own price
   beside it, and the stake and combined price along the bottom, the way
   every bookmaker prints them. */
function renderExtraction(card, label, res) {
  const f = res.fields || {};

  /* A profit-and-loss screen from another tracker is not a bet, and logging
     it as one would put a single enormous fictional wager in the ledger. */
  if (f.doc_type === 'pnl_summary') { renderSummaryRead(card, label, f); return; }
  if (f.readable === false && !f.stake && !f.odds) {
    card.innerHTML = readerError('That does not look like a betting record.');
    return;
  }

  /* Where the bet is in its life. A slip forwarded at placement has no
     result and gets looked up later; one forwarded after settlement carries
     its own. The reader states which, it is never inferred here, because
     every slip prints a potential-returns figure and inferring "settled"
     from that would grade open bets. */
  const stage = f.stage || (f.result && f.result !== 'open' ? 'settled' : null);
  const result = f.result && f.result !== 'open' ? f.result : null;
  const stageNote = stage === 'settled' && result
      ? ['ok', 'Settled on the slip: ' + RESULT_WORD[result]]
    : stage === 'settled' ? ['ok', 'Settled, result unclear, we will look it up']
    : stage === 'inplay' ? ['warn', 'In play. We will settle it at full time']
    : stage === 'prematch' ? ['warn', 'Not started. We will settle it at full time']
    : ['warn', 'We will look the result up when the game finishes'];

  /* One leg minimum, so a single renders through the same code as a
     fourfold and there is no second layout to keep in step. */
  const legs = (Array.isArray(f.selections) && f.selections.length
    ? f.selections
    : [{ selection: f.selection, event: f.event, market: f.market, odds: f.odds, result: f.result }]
  ).slice(0, 20);

  const money = v => v == null ? '' : Number(v).toFixed(2);
  const price = v => v == null ? '' : Number(v).toFixed(2);
  const count = f.bet_count || 1;

  card.innerHTML =
    '<div class="sliphead">' +
      '<span class="slipbook">' + esc(f.platform || f.bookmaker || label) + '</span>' +
      /* The number in the corner of a real slip: how many bets were placed. */
      '<span class="slipcount" title="Bets on this slip">' + count + '</span>' +
    '</div>' +
    '<div class="sliplegs">' +
      legs.map((leg, i) =>
        '<div class="slipleg" data-leg="' + i + '">' +
          '<div class="slipleg-top">' +
            '<label class="sr" for="' + card.id + '-sel' + i + '">Selection ' + (i + 1) + '</label>' +
            '<input class="field slipin slipleg-sel" id="' + card.id + '-sel' + i + '" ' +
              'data-leg-field="selection" placeholder="Selection" value="' + esc(leg.selection || '') + '">' +
            '<label class="sr" for="' + card.id + '-odds' + i + '">Odds for selection ' + (i + 1) + '</label>' +
            '<input class="field slipin slipleg-odds m" id="' + card.id + '-odds' + i + '" ' +
              'data-leg-field="odds" inputmode="decimal" placeholder="Odds" value="' + esc(price(leg.odds)) + '">' +
          '</div>' +
          '<label class="sr" for="' + card.id + '-ev' + i + '">Event for selection ' + (i + 1) + '</label>' +
          '<input class="field slipin slipleg-ev" id="' + card.id + '-ev' + i + '" ' +
            'data-leg-field="event" placeholder="Event" value="' + esc(leg.event || '') + '">' +
        '</div>').join('') +
    '</div>' +
    (legs.length > 1
      ? '<button class="pillbtn link slipaddleg" data-add-leg="1">Add another selection</button>'
      : '') +
    '<div class="slipfoot">' +
      '<label class="slipfoot-cell"><span>Stake £</span>' +
        '<input class="field slipin m" data-slip="stake" inputmode="decimal" value="' + esc(money(f.stake)) + '"></label>' +
      /* The combined price, next to the leg prices rather than instead of
         them. A slip prints both and correcting one leg should not force
         anyone to work the accumulator out in their head. */
      '<label class="slipfoot-cell"><span>Total odds</span>' +
        '<input class="field slipin m" data-slip="odds" inputmode="decimal" value="' + esc(price(f.odds)) + '"></label>' +
    '</div>' +
    '<p class="sliphint" id="' + card.id + '-oddshint" hidden></p>' +
    '<div class="slipfoot">' +
      '<label class="slipfoot-cell"><span>Bookmaker</span>' +
        '<input class="field slipin" data-slip="book" value="' + esc(f.bookmaker || f.platform || '') + '"></label>' +
      '<label class="slipfoot-cell"><span>Market</span>' +
        '<input class="field slipin" data-slip="market" value="' + esc(f.market || '') + '"></label>' +
    '</div>' +
    '<p class="sliptotal" id="' + card.id + '-returns"></p>' +
    '<p class="slipstage ' + stageNote[0] + '">' + esc(stageNote[1]) + '</p>' +
    '<p class="hinttext" id="' + card.id + '-hint">Check it, then confirm. Nothing is saved until you do.</p>' +
    '<div class="btnrow" style="margin-top:11px">' +
    '<button class="btn primary small" data-confirm-slip="1">Confirm</button>' +
    '<button class="btn ghost small" data-dismiss-card="1">Discard</button></div>';

  card.dataset.stage = stage || '';
  card.dataset.result = result || '';
  /* Returns is what the slip paid out, so profit is returns minus stake,
     the same definition the engine uses, computed once. */
  card.dataset.returns = f.returns != null ? String(Math.round(f.returns * 100)) : '';
  syncSlipCard(card);
}

/* A totals screen from another tracker. It fills the Type totals tab rather
   than the ledger, because there are no individual bets behind it and
   inventing some would be exactly the dishonesty this product exists to
   stop. */
function renderSummaryRead(card, label, f) {
  const t = f.totals || {};
  const row = (k, v) => v == null ? ''
    : '<div class="reviewline"><span class="k">' + k + '</span><span class="v m">' + esc(String(v)) + '</span></div>';
  card.innerHTML =
    '<div class="cardhead"><span class="title">' + esc(f.platform || label) + '</span>' +
    '<span class="tagbit">Summary, not slips</span></div>' +
    '<p class="hinttext">That is a totals screen rather than a bet slip, so there are no ' +
    'individual bets behind it. The figures can go in as a period total instead, and your ' +
    'ledger will show them as carried over rather than as bets you can settle.</p>' +
    '<div class="reviewbar" style="margin-top:11px">' +
      row('Period', t.period) + row('Profit', t.profit) + row('Turnover', t.turnover) +
      row('Bets', t.bets) + row('Won', t.won) + row('Lost', t.lost) +
    '</div>' +
    '<div class="btnrow" style="margin-top:11px">' +
    '<button class="btn primary small" data-goto-totals="1">Open Type totals</button>' +
    '<button class="btn ghost small" data-dismiss-card="1">Discard</button></div>';
}

/* Append an empty leg to a slip card. Ids stay unique by counting what is
   already there, because two inputs sharing an id is one of the two class
   of bug this codebase has been bitten by. */
function addLeg(card) {
  if (!card) return;
  const legs = card.querySelector('.sliplegs');
  if (!legs) return;
  const i = legs.children.length;
  const row = document.createElement('div');
  row.className = 'slipleg';
  row.setAttribute('data-leg', String(i));
  row.innerHTML =
    '<div class="slipleg-top">' +
      '<label class="sr" for="' + card.id + '-sel' + i + '">Selection ' + (i + 1) + '</label>' +
      '<input class="field slipin slipleg-sel" id="' + card.id + '-sel' + i + '" ' +
        'data-leg-field="selection" placeholder="Selection">' +
      '<label class="sr" for="' + card.id + '-odds' + i + '">Odds for selection ' + (i + 1) + '</label>' +
      '<input class="field slipin slipleg-odds m" id="' + card.id + '-odds' + i + '" ' +
        'data-leg-field="odds" inputmode="decimal" placeholder="Odds">' +
    '</div>' +
    '<label class="sr" for="' + card.id + '-ev' + i + '">Event for selection ' + (i + 1) + '</label>' +
    '<input class="field slipin slipleg-ev" id="' + card.id + '-ev' + i + '" ' +
      'data-leg-field="event" placeholder="Event">';
  legs.appendChild(row);
  row.querySelector('input').focus();
  syncSlipCard(card);
}

/* Read the card's inputs into its dataset, and gate Confirm on the three
   fields a bet cannot exist without. Called on render and on every keystroke
   inside a slip card. */
function syncSlipCard(card) {
  const read = k => {
    const el = card.querySelector('[data-slip="' + k + '"]');
    return el ? el.value.trim() : '';
  };
  const legs = $$('.slipleg', card).map(el => ({
    selection: el.querySelector('[data-leg-field="selection"]').value.trim(),
    event: el.querySelector('[data-leg-field="event"]').value.trim(),
    odds: parseFloat(el.querySelector('[data-leg-field="odds"]').value)
  })).filter(l => l.selection || l.event || Number.isFinite(l.odds));

  const stake = M.parseMoney(read('stake'));
  const odds = parseFloat(read('odds'));

  /* A multiple is described by its legs joined, so the ledger row reads the
     way the slip does rather than as one of the legs standing in for all of
     them. */
  const selection = legs.map(l => l.selection).filter(Boolean).join(' & ');
  const event = legs.map(l => l.event).filter(Boolean).join(' & ');

  card.dataset.selection = selection;
  card.dataset.event = event;
  card.dataset.book = read('book');
  card.dataset.market = read('market');
  card.dataset.stake = stake != null && stake > 0 ? String(stake) : '';
  card.dataset.odds = Number.isFinite(odds) && odds > 1 ? String(odds) : '';
  card.dataset.legs = String(legs.length);

  /* The legs multiply out to the combined price. Saying so when they
     disagree catches a mistyped leg, which is the error that silently
     changes what the bet was worth. It is a note, not a block: a bookmaker
     rounds, and each-way and system bets do not multiply at all. */
  const hint = $(card.id + '-oddshint');
  const priced = legs.filter(l => Number.isFinite(l.odds) && l.odds > 1);
  if (hint) {
    if (priced.length > 1 && Number.isFinite(odds) && odds > 1) {
      const product = priced.reduce((a, l) => a * l.odds, 1);
      const drift = Math.abs(product - odds) / odds;
      hint.hidden = drift <= 0.02;
      hint.textContent = 'Those legs multiply to ' + product.toFixed(2) +
        ', not ' + odds.toFixed(2) + '. Check one of them.';
    } else if (priced.length > 1 && !card.querySelector('[data-slip="odds"]').value.trim()) {
      const product = priced.reduce((a, l) => a * l.odds, 1);
      hint.hidden = false;
      hint.textContent = 'Those legs multiply to ' + product.toFixed(2) + '.';
    } else {
      hint.hidden = true;
    }
  }

  const ready = Boolean(card.dataset.stake && card.dataset.odds && selection);
  card.dataset.ready = ready ? '1' : '0';
  /* Potential profit, so the Import totals mean something before settlement. */
  card.dataset.profit = ready
    ? String(Math.round(Number(card.dataset.stake) * (Number(card.dataset.odds) - 1)))
    : '';

  /* What it returns if it lands, spelled out, so nobody has to multiply a
     stake by a price to sanity check the reading. */
  const returns = $(card.id + '-returns');
  if (returns) {
    const has = card.dataset.stake && card.dataset.odds;
    returns.textContent = has
      ? 'Returns ' + M.money(Math.round(Number(card.dataset.stake) * Number(card.dataset.odds))) +
        ', profit ' + M.money(Number(card.dataset.profit))
      : '';
  }

  const missing = [];
  if (!selection) missing.push('a selection');
  if (!card.dataset.stake) missing.push('a stake');
  if (!card.dataset.odds) missing.push('the odds');

  const btn = card.querySelector('[data-confirm-slip]');
  if (btn) {
    btn.disabled = !ready;
    btn.title = ready ? '' : 'Selection, stake and odds are needed first';
  }
  const tag = card.querySelector('.slipcount');
  if (tag) tag.classList.toggle('warn', !ready);
  const note = $(card.id + '-hint');
  if (note) {
    note.textContent = ready
      ? 'Check it, then confirm. Nothing is saved until you do.'
      : 'Slippery will not guess at numbers it cannot read. Still needs ' +
        (missing.length === 1 ? missing[0]
          : missing.slice(0, -1).join(', ') + ' and ' + missing[missing.length - 1]) + '.';
  }
}

/* Confirm actually writes the bet. This is the step that used to be a
   toast and a fade: the card collapsed, the counters moved, and nothing was
   ever stored, which is why importing appeared to work and then left the
   ledger empty. */
async function confirmSlip(btn) {
  const card = btn.closest('.card');
  if (!card || card.dataset.saving === '1') return;
  card.dataset.saving = '1';
  btn.disabled = true;
  const was = btn.textContent;
  btn.textContent = 'Saving…';

  const stake = Number(card.dataset.stake || 0);
  const odds = card.dataset.odds ? Number(card.dataset.odds) : null;
  const result = card.dataset.result || '';

  /* Only send an outcome when the slip stated one. Prefer the returns the
     slip printed over recomputing from the odds: on a partially cashed out
     or each-way slip the printed figure is right and the arithmetic is not. */
  let outcome = null, profitPence = null;
  if (result) {
    outcome = result === 'cashed_out' ? 'cash' : result;
    const returns = card.dataset.returns ? Number(card.dataset.returns) : null;
    profitPence = returns != null ? returns - stake
      : result === 'lost' ? -stake
      : result === 'void' ? 0
      : odds ? Math.round(stake * (odds - 1)) : null;
    if (profitPence == null) { outcome = null; }      // no figure, no grade
  }

  const r = await post('/api/bets', {
    event: card.dataset.event || '',
    selection: card.dataset.selection || '',
    market: card.dataset.market || '',
    book: card.dataset.book || '',
    odds,
    stakePence: stake,
    outcome, profitPence,
    source: 'upload'
  });

  card.dataset.saving = '0';
  btn.disabled = false;
  btn.textContent = was;

  if (r.status === 402) { showUpgrade(r.body); return; }
  if (r.status === 401) { go('setup'); toast('Log in to save this slip.'); return; }
  if (r.status === 503) { showBackendNotice(r.body); return; }
  if (!r.ok) { toast(r.body.error || 'That slip could not be saved.'); return; }

  addBet(r.body.bet);
  invalidateDays();
  R.renderAll();
  collapse(card, 'Slip added to your ledger');
  setTimeout(updateImportTotals, 500);

  /* Look the result up as part of the same action.
     Confirming a slip for a game that finished this afternoon and then
     having to find a refresh button is two steps for one intention. Only
     for bets that landed unsettled and name a fixture, and debounced, so
     confirming eight slips in a row is one lookup rather than eight. */
  if (!outcome && card.dataset.event) settleSoon();
}

/* One lookup for a burst of confirms. The server rate limits this anyway;
   the delay is so a person adding a handful of slips does not spend their
   allowance before they have finished adding them. */
let settleTimer = null;
function settleSoon() {
  if (settleTimer) clearTimeout(settleTimer);
  settleTimer = setTimeout(async () => {
    settleTimer = null;
    const r = await post('/api/settle');
    if (!r.ok) return;                       // the button reports properly
    if (r.body.settled || r.body.asked) {
      await loadLedger();
      toast(r.body.settled
        ? r.body.settled + ' of those already had a result'
        : 'One of those needs you to settle it');
    }
  }, 2500);
}

/* ---------------- spreadsheets ----------------
   Parsed in the browser, so the file never leaves the device unless the
   user goes ahead, and so a bad file gets an answer instantly instead of
   after an upload. Reached from the one drop zone rather than its own tab:
   the file says what it is. */
async function handleCsv(file) {
  if (!file) return;
  const report = $('csvReport');
  report.innerHTML = '<p class="hinttext">Reading ' + esc(file.name) + '…</p>';

  let text;
  try {
    text = await file.text();
  } catch {
    report.innerHTML = csvError('That file could not be opened.');
    return;
  }
  if (text.length > 4_000_000) {
    report.innerHTML = csvError('That file is over 4MB. Split it, or export a shorter date range.');
    return;
  }
  showCsvReport(parseBetsCsv(text), file.name);
}

function showCsvReport(parsed, label) {
  const { bets, errors, mapped } = parsed;
  const report = $('csvReport');
  /* Line numbers travel with the rows, so a server-side rejection can name
     the same line the file does. */
  bets.forEach((b, i) => { b.line = i + 2; });

  if (!bets.length) {
    report.innerHTML = csvError(errors.length ? errors[0].why : 'Nothing in there looked like a bet.');
    return;
  }

  const settled = bets.filter(b => b.outcome).length;
  const net = bets.filter(b => b.outcome).reduce((a, b) => a + (b.profitPence || 0), 0);
  const staked = bets.reduce((a, b) => a + b.stakePence, 0);

  report.innerHTML =
    '<div class="card pad" style="margin-top:12px">' +
    '<div class="cardhead"><span class="title">' + esc(label) + '</span>' +
    '<span class="tagbit ok">' + bets.length + (bets.length === 1 ? ' bet' : ' bets') + '</span></div>' +
    '<div class="reviewbar">' +
      '<div class="reviewline"><span class="k">Ready to add</span><span class="v">' + bets.length + '</span></div>' +
      (errors.length
        ? '<div class="reviewline"><span class="k">Rows skipped</span><span class="v warn">' + errors.length + '</span></div>'
        : '') +
      '<div class="reviewline"><span class="k">Staked across them</span><span class="v m">' + M.money0(staked) + '</span></div>' +
      /* Only the settled rows have a profit. Adding an open bet in at zero
         and calling the result "profit" was the figure that could not be
         true of anything. */
      (settled
        ? '<div class="reviewline"><span class="k">Profit on the ' + settled + ' already settled</span>' +
          '<span class="v m ' + M.tone(net) + '">' + M.signed(net) + '</span></div>'
        : '') +
    '</div>' +
    '<p class="hinttext">Matched columns: ' + esc(mapped.join(', ') || 'none') + '. ' +
      (settled === bets.length ? 'All of them are already settled.'
        : settled ? settled + ' are already settled; the rest will be graded when they finish.'
        : 'None are settled yet, so they will be graded when the games finish.') + '</p>' +
    (errors.length
      ? '<details class="disclose"><summary>' + errors.length + ' rows skipped</summary>' +
        errors.slice(0, 40).map(e => '<p class="hinttext">Line ' + e.line + ': ' + esc(e.why) + '</p>').join('') +
        '</details>'
      : '') +
    '<div class="btnrow" style="margin-top:12px">' +
      '<button class="btn primary small" id="csvGo">Import ' + bets.length + ' bets</button>' +
      '<button class="btn ghost small" id="csvCancel">Cancel</button></div></div>';

  pendingCsv = bets;
}

let pendingCsv = null;
const csvError = msg =>
  '<div class="card" style="padding:13px;margin-top:12px;border-color:rgba(252,165,165,.45);background:rgba(252,165,165,.08)">' +
  '<div class="alerthead" style="color:var(--neg)">Could not read that file</div>' +
  '<p class="hinttext" style="border-top-color:rgba(252,165,165,.22)">' + esc(msg) +
  ' Nothing was imported.</p></div>';

async function runCsvImport(btn) {
  if (!pendingCsv) return;
  btn.disabled = true;
  btn.textContent = 'Importing…';
  const r = await post('/api/bets', { bets: pendingCsv });
  btn.disabled = false;

  if (r.status === 402) { showUpgrade(r.body); btn.textContent = 'Import'; return; }
  if (r.status === 401) { go('setup'); toast('Log in to import.'); return; }
  if (r.status === 503) { showBackendNotice(r.body); btn.textContent = 'Import'; return; }
  if (!r.ok) { toast(r.body.error || 'That import did not go through.'); btn.textContent = 'Import'; return; }

  const n = r.body.imported || 0;
  pendingCsv = null;
  $('csvReport').innerHTML = '<p class="hinttext">Imported ' + n + ' bets.' +
    (r.body.rejected && r.body.rejected.length ? ' ' + r.body.rejected.length + ' rows were rejected.' : '') + '</p>';
  toast(n + ' bets imported');
  await loadLedger();
}

async function leaveGroup(id) {
  const r = await del('/api/groups', { id });
  if (!r.ok) { toast(r.body.error || 'Could not leave that group.'); return; }
  S.group = 0;
  await loadGroups();
  toast(r.body.dissolved ? 'You were the last one, so the group is gone' : 'Left the group');
}

/* ---------------- Telegram ----------------
   The button used to relabel itself "Linked", disable, and show a green dot.
   Nothing was linked: the bot had never heard of the chat, and the first
   slip forwarded to it got "that code did not match an account".

   It opens the real deep link now. Telegram passes everything after
   ?start= to the bot as the first argument of /start, so the code travels
   with the tap and the bot links the chat without anyone typing anything.
   Then the page waits for the server to agree, because the bot is the only
   thing that actually knows. */
const BOT = 'SlipperyAppBot';
let linkPoll = null;

function openTelegram(btn) {
  const code = (($('linkCode') || {}).textContent || '').trim();
  if (!code || code === 'Not linked yet') {
    toast('Your link code loads with your account. Log in first.');
    return;
  }
  const url = 'https://t.me/' + BOT + '?start=' + encodeURIComponent(code);
  /* noopener: without it the opened tab gets a handle on this window. */
  window.open(url, '_blank', 'noopener');
  btn.textContent = 'Waiting for Telegram…';
  btn.disabled = true;
  pollForLink(btn);
}

/* Ten checks, six seconds apart. Linking happens in another app, so there
   is no event to listen for, and a minute is long enough for someone to
   switch across, press start and come back. It gives up quietly rather than
   polling forever in a background tab. */
function pollForLink(btn) {
  if (linkPoll) clearInterval(linkPoll);
  let tries = 0;
  linkPoll = setInterval(async () => {
    tries++;
    const r = await get('/api/auth/me');
    const linked = r.ok && r.body.user && r.body.user.telegramLinked;
    if (linked) {
      clearInterval(linkPoll); linkPoll = null;
      R.renderAccount(r.body.user);
      const dot = $('telegramLinked');
      if (dot) dot.hidden = false;
      if (btn) { btn.textContent = 'Linked'; btn.disabled = true; }
      toast('Telegram linked. Forward a slip whenever you like.');
      return;
    }
    if (tries >= 10) {
      clearInterval(linkPoll); linkPoll = null;
      if (btn) { btn.textContent = 'Open Telegram and link'; btn.disabled = false; }
      toast('Not linked yet. In the chat, send: /link ' +
        (($('linkCode') || {}).textContent || '').trim());
    }
  }, 6000);
}

function showUpgrade(body) {
  toast('That is all ' + (body && body.freeSlips || 20) + ' free slips used.');
  go('pricing');
}

/* The review summary.
   "Profit" used to add the potential return of an open bet to the settled
   profit of a graded one and print the total with no label, so the number
   was never true of anything. Open and settled are now counted separately
   and the line says which it is showing. The whole bar hides when there is
   nothing on screen to review, rather than sitting there reading zero. */
function updateImportTotals() {
  const cards = $$('#uploadResults .slipcard');
  const bar = $('reviewBar');
  if (bar) bar.hidden = cards.length === 0;
  if (!cards.length) return;

  const ready = cards.filter(c => c.dataset.ready === '1');
  const retake = cards.filter(c => c.dataset.ready === '0').length;
  const staked = cards.reduce((a, c) => a + (+c.dataset.stake || 0), 0);

  /* A slip that already carries its own result has a real profit. One that
     does not has a potential profit, and the two must not be added. */
  const settled = ready.filter(c => c.dataset.result);
  const open = ready.filter(c => !c.dataset.result);
  const settledProfit = settled.reduce((a, c) =>
    a + (c.dataset.returns ? Number(c.dataset.returns) - Number(c.dataset.stake || 0) : 0), 0);
  const potential = open.reduce((a, c) => a + (+c.dataset.profit || 0), 0);

  setText('readyCount', String(ready.length));
  setText('retakeCount', String(retake));
  setText('importStaked', staked ? M.money(staked) : 'None');

  const showSettled = settled.length > 0 && open.length === 0;
  setText('importProfitLabel', showSettled
    ? 'Profit on ' + (settled.length === 1 ? 'it' : 'those ' + settled.length)
    : settled.length
      ? 'If the ' + open.length + ' open ones win'
      : 'If they all win');
  const value = showSettled ? settledProfit : potential;
  const p = $('importProfit');
  p.textContent = value ? M.signed(value) : 'None';
  p.className = 'v m ' + M.tone(value);
}

/* ---------------- totals ---------------- */
const TOTALS_FIELDS = {
  day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  week: ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4', 'Wk 5', 'Wk 6'],
  month: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  year: ['2023', '2024', '2025', '2026']
};
function renderTotals(period) {
  S.totalsPeriod = period;
  setHTML('totalsGrid', TOTALS_FIELDS[period].map((l, i) =>
    '<div class="totalsrow"><label for="tot' + i + '">' + l + '</label>' +
    '<span class="cur" aria-hidden="true">£</span>' +
    '<input class="field" id="tot' + i + '" inputmode="decimal" placeholder="0.00"></div>').join(''));
  sumTotals();
}
function sumTotals() {
  let sum = 0, n = 0;
  $$('#totalsGrid input').forEach(i => {
    const v = M.parseMoney(i.value);
    if (v != null) { sum += v; n++; }
  });
  setHTML('totalsSummary', n
    ? n + ' filled · <b class="' + M.tone(sum) + '">' + M.money0s(sum) + '</b>'
    : 'None yet');
}

/* ---------------- events ---------------- */
document.addEventListener('click', e => {
  const t = e.target;
  const c = sel => t.closest && t.closest(sel);
  let el;

  if ((el = c('[data-anchor]'))) {
    const target = $(el.getAttribute('data-anchor'));
    if (S.view !== 'landing') go('landing');
    if (target) setTimeout(() => target.scrollIntoView({ behavior: RM ? 'auto' : 'smooth', block: 'start' }), S.view === 'landing' ? 0 : 60);
    return;
  }
  if ((el = c('[data-nav]'))) { go(el.getAttribute('data-nav')); return; }
  if ((el = c('#subnav button'))) { showPane(el.getAttribute('data-pane')); return; }

  if ((el = c('[data-period]'))) { setPeriod(el.getAttribute('data-period')); return; }
  if ((el = c('#calMode button'))) {
    S.calMode = el.getAttribute('data-cal');
    syncCalModeButtons();
    R.renderCalendar(); R.renderGoal();
    return;
  }
  if (c('#calPrev')) { if (S.calMode === 'm') { S.month = (S.month + 11) % 12; S.focus = null; } drawAll(); return; }
  if (c('#calNext')) { if (S.calMode === 'm') { S.month = (S.month + 1) % 12; S.focus = null; } drawAll(); return; }
  if ((el = c('.cell[data-month]'))) {
    S.month = +el.getAttribute('data-month'); S.calMode = 'm'; S.focus = null;
    syncCalModeButtons(); drawAll(); return;
  }
  if ((el = c('.cell[data-day]'))) { openDay(+el.getAttribute('data-day')); return; }
  if (c('#dayClose') || c('#scrim')) { closeDay(); return; }

  if ((el = c('#editTarget'))) {
    const holder = $('goalLabel').closest('.goal');
    if (holder.querySelector('.addrow')) return;
    const box = document.createElement('div');
    box.className = 'addrow';
    box.style.marginTop = '10px';
    box.innerHTML = '<label class="sr" for="targetEdit">Target</label>' +
      '<input class="field" id="targetEdit" inputmode="decimal" value="' + (targetFor(S.month) / 100) + '">' +
      '<button class="btn primary" id="targetSave">Save</button>' +
      '<button class="btn ghost" id="targetCancel">Cancel</button>';
    holder.appendChild(box);
    $('targetEdit').focus();
    return;
  }
  if (c('#targetCancel')) { const b = c('.addrow'); if (b) b.remove(); return; }
  if (c('#targetSave')) {
    const v = M.parseMoney($('targetEdit').value);
    if (v == null || v <= 0) { toast('Enter a number above zero'); return; }
    TARGETS[S.month] = v;
    const b = c('.addrow'); if (b) b.remove();
    R.renderGoal(); R.renderHeadline();
    toast(MS.format(new Date(TODAY.year, S.month, 1)) + ' target set to ' + M.money0(v));
    return;
  }

  if (c('#runToggle')) {
    const btn = c('#runToggle');
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    $('runList').hidden = open;
    return;
  }
  if (c('#checkResults')) { checkResults(); return; }
  if ((el = c('[data-settle]'))) {
    const [id, kind] = el.getAttribute('data-settle').split('|');
    const row = el.closest('.pendrow');
    if (kind === 'cash') {
      const form = row.querySelector('.cashform');
      form.hidden = false;
      form.querySelector('input').focus();
      return;
    }
    row.classList.add('flash', 'flash-' + kind);
    el.classList.add('chosen');
    setTimeout(() => {
      collapse(row);
      setTimeout(() => manualSettle(id, kind), RM ? 20 : 300);
    }, RM ? 20 : 420);
    return;
  }
  if ((el = c('[data-cashout]'))) {
    const id = el.getAttribute('data-cashout');
    const row = el.closest('.pendrow');
    const v = M.parseMoney($('cashIn-' + id).value);
    if (v == null || v < 0) { toast('Enter the amount the bookmaker returned'); return; }
    row.classList.add('flash', 'flash-cash');
    setTimeout(() => {
      collapse(row);
      setTimeout(() => manualSettle(id, 'cash', v), RM ? 20 : 300);
    }, RM ? 20 : 420);
    return;
  }

  if ((el = c('#moreToggle'))) {
    S.showMore = !S.showMore;
    el.setAttribute('aria-expanded', String(S.showMore));
    $('moreBlock').hidden = !S.showMore;
    $('statExtra').hidden = !S.showMore;
    setText('moreLabel', S.showMore ? 'Show less' : 'Show more');
    el.querySelector('.switch').setAttribute('aria-checked', String(S.showMore));
    R.renderRecentBets(); R.renderHeadline();
    return;
  }
  if ((el = c('#viewAllBets'))) {
    S.showAllBets = !S.showAllBets;
    el.setAttribute('aria-expanded', String(S.showAllBets));
    el.textContent = S.showAllBets ? 'Show fewer' : 'View all';
    R.renderRecentBets();
    return;
  }
  if ((el = c('[data-filter]'))) { S.filter = el.getAttribute('data-filter'); R.renderLedger(); return; }
  if ((el = c('#ledgerSeg button'))) {
    S.ledgerView = el.getAttribute('data-ledger');
    $$('#ledgerSeg button').forEach(b => {
      const on = b === el;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    paintSeg($('ledgerSeg'));
    ['ledgerBets', 'ledgerAnalysis'].forEach(x => { $(x).hidden = x !== S.ledgerView; });
    return;
  }
  if ((el = c('#socialSeg button'))) {
    S.socialView = el.getAttribute('data-social');
    $$('#socialSeg button').forEach(b => {
      const on = b === el;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    paintSeg($('socialSeg'));
    ['socialGroups', 'socialFollowing', 'socialFollowers'].forEach(x => { $(x).hidden = x !== S.socialView; });
    return;
  }
  if ((el = c('[data-follow]'))) {
    const name = el.getAttribute('data-follow');
    const p = PEOPLE.find(x => x.n === name);
    if (p) {
      p.ing = !p.ing;
      if (p.pv === 'friends') p.mu = p.ing && p.er;
      toast(p.ing ? 'Now following ' + p.n : 'Unfollowed ' + p.n);
    }
    R.renderPeople(); R.renderGroups();
    if (S.view === 'prof') R.renderProfile(name);
    return;
  }
  if ((el = c('[data-profile]'))) { if (R.renderProfile(el.getAttribute('data-profile'))) go('prof'); return; }
  if (c('#profileBack')) { go('dash'); showPane('social'); return; }
  if ((el = c('[data-group]'))) { S.group = +el.getAttribute('data-group'); R.renderGroups(); return; }

  if ((el = c('[data-privacy]'))) {
    S.privacy = el.getAttribute('data-privacy');
    R.renderPrivacy();
    toast('Your figures are now ' + (S.privacy === 'private' ? 'private'
      : S.privacy === 'friends' ? 'visible to friends only' : 'public'));
    return;
  }
  /* `button[data-theme]`, NOT `[data-theme]`.
     The theme lives on <html data-theme="...">, so a bare attribute
     selector matched every click in the document once closest() walked far
     enough up, and because this branch returns, it swallowed every branch
     declared after it. That killed the signup wizard's Continue button, the
     unit row, the import tabs, both dropzones, and Confirm on an imported
     slip. Any delegated selector here must be specific enough that it
     cannot match <html> or <body>. */
  if ((el = c('button[data-theme]'))) {
    stopThemeIntro();
    applyTheme(el.getAttribute('data-theme'));
    toast((THEMES.find(t => t[0] === S.theme) || [])[1] + ' applied');
    return;
  }
  if ((el = c('[data-target-period]'))) {
    const next = el.getAttribute('data-target-period');
    const monthly = S.targetPeriod === 'month' ? S.target
      : S.targetPeriod === 'year' ? S.target / 12
      : S.targetPeriod === 'week' ? S.target * 52 / 12 : S.target * 365 / 12;
    const yearly = monthly * 12;
    const by = { day: yearly / 365, week: yearly / 52, month: monthly, year: yearly };
    S.targetPeriod = next;
    S.target = Math.round(by[next]);
    $('targetSetup').value = (S.target / 100).toFixed(2);
    $('targetSettings').value = (S.target / 100).toFixed(2);
    R.renderTargets(); R.renderGoal();
    return;
  }
  if ((el = c('.unitrow button'))) {
    const raw = el.getAttribute('data-unit');
    const row = el.closest('.unitrow');
    const custom = row.id === 'unitRowSettings' ? $('unitCustomSettings') : $('unitCustomSetup');
    custom.hidden = raw !== 'custom';
    if (raw === 'custom') custom.focus(); else S.unit = +raw;
    R.renderMisc();
    drawAll();
    return;
  }

  if ((el = c('[data-wizard]'))) { handleWizard(+el.getAttribute('data-wizard')); return; }
  if ((el = c('#authSeg button'))) { Auth.setMode(el.getAttribute('data-auth')); return; }
  if (c('#verifyResend')) { Auth.resend(); return; }
  if (c('#verifyChange')) { wizardStep(0); setTimeout(() => $('suEmail').focus(), 260); return; }
  if (c('#forgotPw')) { Auth.forgot(); return; }
  if (c('#forgotBack')) { Auth.backToLogin(); return; }

  if ((el = c('[data-plan-pick]'))) {
    S.planChoice = el.getAttribute('data-plan-pick');
    renderPlanChoice();
    return;
  }
  /* Every route to a paid plan lands on the checkout page, so there is one
     place that explains how paying actually works. */
  if ((el = c('[data-pay]'))) {
    const want = el.getAttribute('data-pay');
    if (want !== 'promo') S.payPlan = want;
    renderPayPage();
    go('pay');
    if (want === 'promo') setTimeout(() => $('payPromo').focus(), 260);
    return;
  }
  if ((el = c('#planPromoGo'))) { redeemPromo(el, 'planPromo', 'planPromoNote'); return; }
  if ((el = c('#payPromoGo'))) { redeemPromo(el, 'payPromo', 'payPromoNote'); return; }
  if (c('#suggestName')) {
    const f = $('suName');
    f.value = suggestName();
    f.dispatchEvent(new Event('input', { bubbles: true }));
    f.focus();
    return;
  }
  if ((el = c('[data-migrate]'))) {
    S.migrateChoice = el.getAttribute('data-migrate');
    $$('[data-migrate]').forEach(b => b.setAttribute('aria-pressed', String(b === el)));
    return;
  }

  if ((el = c('#importSeg button'))) {
    S.importView = el.getAttribute('data-import');
    $$('#importSeg button').forEach(b => {
      const on = b === el;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    paintSeg($('importSeg'));
    ['importUpload', 'importTotals'].forEach(x => { $(x).hidden = x !== S.importView; });
    if (S.importView === 'importTotals') requestAnimationFrame(() => paintSeg($('totalsSeg')));
    return;
  }
  if ((el = c('#totalsSeg button'))) {
    $$('#totalsSeg button').forEach(b => {
      const on = b === el;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    paintSeg($('totalsSeg'));
    renderTotals(el.getAttribute('data-totals'));
    return;
  }
  if (c('#dropzone')) { $('slipFile').click(); return; }
  if ((el = c('#pasteGo'))) { handlePaste(el); return; }
  /* An accumulator the reader only got half of. Adding the missing leg
     beats retaking the photograph, which is the same reason every field is
     editable in the first place. */
  if ((el = c('[data-add-leg]'))) { addLeg(el.closest('.card')); return; }
  if (c('[data-goto-totals]')) {
    const tab = document.querySelector('#importSeg [data-import="importTotals"]');
    if (tab) tab.click();
    return;
  }
  if ((el = c('[data-dismiss-card]'))) { collapse(el.closest('.card'), 'Discarded'); setTimeout(updateImportTotals, 500); return; }
  if ((el = c('[data-confirm-slip]'))) { confirmSlip(el); return; }
  if ((el = c('#csvGo'))) { runCsvImport(el); return; }
  if (c('#csvCancel')) { pendingCsv = null; $('csvReport').innerHTML = ''; return; }
  if (c('#totalsSave')) {
    const btn = c('#totalsSave');
    btn.textContent = 'Totals added'; btn.disabled = true;
    toast('Totals added');
    return;
  }

  if ((el = c('.switch')) && !c('#moreToggle')) {
    const on = el.getAttribute('aria-checked') !== 'true';
    el.setAttribute('aria-checked', String(on));
    if (el.id === 'showTipster') { S.showTipster = on; R.renderRecentBets(); R.renderLedger(); R.renderPending(); }
    return;
  }
  if ((el = c('[data-confirm]'))) {
    if (el.dataset.armed === '1') {
      el.textContent = 'Done'; el.disabled = true;
      toast(el.getAttribute('data-confirm') + ' completed');
    } else {
      el.dataset.armed = '1';
      el.textContent = 'Tap again';
      toast('Tap again to confirm');
      setTimeout(() => {
        if (el.dataset.armed === '1') {
          el.dataset.armed = '0';
          el.textContent = el.getAttribute('data-confirm').split(' ')[0];
        }
      }, 4000);
    }
    return;
  }
  if (c('#purgeImages')) { toast('All stored slip images deleted'); return; }
  if ((el = c('[data-remove-tipster]'))) {
    const n = el.getAttribute('data-remove-tipster');
    const i = TIPSTERS.indexOf(n);
    if (i > -1) TIPSTERS.splice(i, 1);
    R.renderMisc();
    return;
  }
  if (c('#tipsterAdd')) {
    const v = $('tipsterInput').value.trim();
    if (v && !TIPSTERS.includes(v)) { TIPSTERS.push(v); R.renderMisc(); toast(v + ' added'); }
    $('tipsterInput').value = '';
    return;
  }
  if (c('#bookAdd')) {
    const v = $('bookInput').value.trim();
    const grp = $('bookParent').value;
    if (v) {
      if (!BOOKS[grp]) BOOKS[grp] = [];
      const exists = Object.keys(BOOKS).some(k => BOOKS[k].includes(v));
      if (!exists) { BOOKS[grp].push(v); R.renderMisc(); toast(v + ' added'); }
    }
    $('bookInput').value = '';
    return;
  }
  if (c('#groupCreate')) { openGroupForm(); return; }
  if (c('#groupJoin')) { openJoinForm(); return; }
  if (c('#groupCancel')) { closeGroupForm(); return; }
  if ((el = c('[data-vis]'))) {
    S.groupVis = el.getAttribute('data-vis');
    $$('[data-vis]').forEach(b => b.setAttribute('aria-pressed', String(b === el)));
    return;
  }
  if ((el = c('#groupSave'))) { createGroup(el); return; }
  if ((el = c('#groupJoinGo'))) { joinGroup(el); return; }
  if ((el = c('#groupShare'))) {
    const code = el.getAttribute('data-code') || '';
    /* Clipboard first, and the code stays on screen either way: a toast
       that has scrolled past is no use to someone reading it out. */
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(
        () => toast('Code ' + code + ' copied'),
        () => toast('Your code is ' + code));
    } else toast('Your code is ' + code);
    return;
  }
  if ((el = c('#groupLeave'))) {
    if (el.dataset.armed !== '1') {
      el.dataset.armed = '1';
      el.textContent = 'Tap again to leave';
      setTimeout(() => { if (el.dataset.armed === '1') { el.dataset.armed = '0'; el.textContent = 'Leave group'; } }, 4000);
      return;
    }
    leaveGroup(el.getAttribute('data-id'));
    return;
  }
  if ((el = c('#applyVerify'))) {
    el.textContent = 'Slips sent for review';
    el.disabled = true;
    toast(el.textContent);
    return;
  }


  if (c('#newMonthKeep')) { $('newMonthCard').hidden = true; toast('Target kept at ' + M.money0(targetFor(TODAY.month))); return; }
  if (c('#newMonthDismiss')) { $('newMonthCard').hidden = true; toast('We will ask again tomorrow'); return; }
  if (c('#newMonthAdjust')) { $('newMonthActions').hidden = true; $('newMonthEdit').hidden = false; $('newMonthInput').focus(); return; }
  if (c('#newMonthSave')) {
    const v = M.parseMoney($('newMonthInput').value);
    if (v == null || v <= 0) { toast('Enter a number above zero'); return; }
    TARGETS[TODAY.month] = v;
    $('newMonthCard').hidden = true;
    R.renderGoal(); R.renderHeadline();
    toast(MS.format(new Date(TODAY.year, TODAY.month, 1)) + ' target set to ' + M.money0(v));
    return;
  }
  if ((el = c('#telegramLink')) || (el = c('#telegramLinkSettings'))) { openTelegram(el); return; }
});

function handleWizard(dir) {
  if (dir === 1 && step === 0) { Auth.submitStep0(() => wizardStep(1)); return; }
  if (dir === 1 && step === 1) { Auth.submitVerify(() => wizardStep(2)); return; }
  wizardStep(step + dir);
}

document.addEventListener('input', e => {
  const t = e.target;
  if (Auth.handleInput(t)) return;
  if (t.id === 'betSearch') { S.query = t.value.trim().toLowerCase(); R.renderLedger(); return; }
  if (t.id === 'peopleSearch') { S.peopleQuery = t.value.trim(); R.renderPeople(); return; }
  if (t.id === 'targetSetup' || t.id === 'targetSettings') {
    const v = M.parseMoney(t.value);
    if (v != null) {
      S.target = v;
      $('targetSetup').value = t.value;
      $('targetSettings').value = t.value;
      R.renderTargets(); R.renderGoal();
    }
    return;
  }
  if (t.id === 'unitCustomSetup' || t.id === 'unitCustomSettings') {
    const v = M.parseMoney(t.value);
    if (v != null && v > 0) { S.unit = v; R.renderMisc(); drawAll(); }
    return;
  }
  if (t.closest && t.closest('#totalsGrid')) { sumTotals(); return; }
  if (t.matches && (t.matches('[data-slip]') || t.matches('[data-leg-field]'))) {
    const card = t.closest('.card');
    if (card) { syncSlipCard(card); updateImportTotals(); }
    return;
  }
});

document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'oddsFormat') { S.oddsFormat = t.value; R.renderRecentBets(); R.renderLedger(); R.renderPending(); toast('Odds shown as ' + t.value); }
  else if (t.id === 'currencySel') { S.currency = t.value; M.setCurrency(t.value); drawAll(); R.renderTargets(); R.renderMisc(); toast('Currency set to ' + t.value); }
  else if (t.id === 'profitFormat') { S.profitFormat = t.value; R.renderRecentBets(); R.renderLedger(); toast('Profit shown in ' + t.value.toLowerCase()); }
  else if (t.id === 'weekStart') { S.weekStart = t.value === 'Monday' ? 1 : 0; drawAll(); toast('Weeks now start on ' + t.value); }
  /* Changing your plan must not navigate you away mid-task. */
  /* Changing plan is a payment, so it goes to the checkout page rather than
     silently relabelling the row. The select is put back to the plan the
     account actually has, because nothing has changed until it is paid. */
  else if (t.id === 'planSelect') {
    const want = t.value;
    R.renderPlan();
    if (want === S.plan || want === 'free') return;
    S.payPlan = want;
    renderPayPage();
    go('pay');
  }
  else if (t.id === 'slipFile') { handleFiles(t.files); t.value = ''; }
  else if (t.id === 'timezone' || t.id === 'exportFormat' || t.id === 'stakeAs') toast(t.value + ' selected');
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeDay(); return; }
});

/* drag and drop onto the upload zone */
['dragenter', 'dragover'].forEach(ev => document.addEventListener(ev, e => {
  if (!e.target.closest || !e.target.closest('#dropzone')) return;
  e.preventDefault();
  $('dropzone').classList.add('dragging');
}));
['dragleave', 'drop'].forEach(ev => document.addEventListener(ev, e => {
  const dz = $('dropzone');
  if (!dz) return;
  if (ev === 'drop' && e.target.closest && e.target.closest('#dropzone')) {
    e.preventDefault();
    handleFiles(e.dataTransfer && e.dataTransfer.files);
  }
  dz.classList.remove('dragging');
}));

addEventListener('resize', () => { paintSegs(); R.renderGoal(); }, { passive: true });

/* swipe the calendar between months */
(function swipeCalendar() {
  const el = $('calGrid');
  if (!el) return;
  let x = null, y = null, t0 = 0;
  el.addEventListener('touchstart', e => {
    const t = e.changedTouches[0]; x = t.clientX; y = t.clientY; t0 = Date.now();
  }, { passive: true });
  el.addEventListener('touchend', e => {
    if (x === null) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - x, dy = t.clientY - y, dt = Date.now() - t0;
    x = null;
    if (dt > 700 || Math.abs(dx) < 44 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    S.month = (S.month + (dx < 0 ? 1 : 11)) % 12;
    S.focus = null;
    drawAll();
  }, { passive: true });
})();

/* ---------------- new month card ---------------- */
function renderNewMonth() {
  /* "July finished £0 against a £2,500 target, and the last three months
     averaged £0" is a prompt about a history that does not exist. A new
     account has nothing to review, so there is nothing to ask about. */
  const card = $('newMonthCard');
  const prev = (TODAY.month + 11) % 12;
  const prevActual = monthTotal(prev);
  const prevTarget = targetFor(prev);
  let avg = 0, n = 0, history = 0;
  for (let m = 0; m < TODAY.month; m++) if (monthTotal(m) !== 0) history++;
  for (let m = TODAY.month - 3; m < TODAY.month; m++) if (m >= 0) { avg += monthTotal(m); n++; }
  avg = n ? Math.round(avg / n) : 0;
  if (card) card.hidden = history === 0;
  if (!history) return;
  setText('newMonthTitle', 'Happy with your ' + MS.format(new Date(TODAY.year, TODAY.month, 1)) + ' target?');
  setHTML('newMonthBody',
    MS.format(new Date(TODAY.year, prev, 1)) + ' finished <b class="' + M.tone(prevActual) + '">' +
    M.money0s(prevActual) + '</b> against a <b>' + M.money0(prevTarget) +
    '</b> target. The last three months averaged <b>' + M.money0s(avg) + '</b>.');
  $('newMonthInput').value = (targetFor(TODAY.month) / 100).toFixed(0);
}

/* ---------------- init ---------------- */
async function init() {
  /* One tick per step, counted from the markup. It was a literal 7, so
     adding the plan step left the last step with no tick and every tick
     pointing at the wrong one. */
  setHTML('wizbar', new Array($$('.step').length).fill('<i></i>').join(''));
  C.renderStatic();
  R.renderMisc();
  R.renderPrivacy();
  R.renderTargets();
  renderTotals('month');
  $('targetSetup').value = (S.target / 100).toFixed(0);
  $('targetSettings').value = (S.target / 100).toFixed(0);
  drawAll();
  renderNewMonth();
  paintSegs();
  reveal();
  syncThemeColor();
  initMotion();
  Auth.init();
  /* Auth cannot navigate on its own: go() refuses the app views until the
     session has been re-read, which is why a correct password used to bounce
     back to the signup screen. This is that re-read. */
  Auth.whenSignedIn(async (stayPut) => {
    const user = await loadSession();
    if (!user) return;
    R.renderAccount(user);
    await loadLedger();
    if (!stayPut) go('dash');
  });

  /* Honour a deep link before anything else paints over it. */
  const deep = location.hash.slice(1);
  if (deep && $(deep) && deep !== 'landing') go(deep, true);

  /* Find out who we are before anything can navigate into the app. Until
     this resolves, sessionChecked is false and go() lets navigation
     through, so a deep link is never bounced by a race. */
  const user = await loadSession();
  if (user) {
    R.renderAccount(user);
    await loadLedger();
    /* Land a signed-in visitor on their dashboard rather than the pitch,
       unless they asked for a particular view. */
    if (S.view === 'landing' && !location.hash) go('dash');
  }

  if (!RM) document.documentElement.classList.add('snap');

  $$('.hero-word').forEach((w, i) => {
    if (!RM) w.style.animationDelay = (i * 70) + 'ms';
    w.classList.add('shown');
  });
  if (!RM) {
    setTimeout(() => { const w = $('slipWord'); if (w) w.classList.add('tumble'); }, 900);
    setInterval(() => {
      const w = $('slipWord');
      if (S.view !== 'landing' || !w) return;
      w.classList.remove('tumble');
      void w.offsetWidth;
      w.classList.add('tumble');
    }, 8000);
  }
}

/* Back and forward. `fromHistory` stops go() from pushing the entry it is
   in the middle of returning to. */
addEventListener('popstate', e => {
  const id = (e.state && e.state.view) || location.hash.slice(1) || 'landing';
  if ($(id)) go(id, true);
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

/* Expose the grader for console testing, including on a phone. */
window.slippery = {
  settle, stats: () => stats(S, MS), state: S,
  ledger: () => LEDGER, pending: () => PENDING, reload: loadLedger
};
