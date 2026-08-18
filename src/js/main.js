/* Wiring and init. One delegated listener per event type. */
import { $, $$, esc, RM, toast, announce, collapse, paintSeg, paintSegs, selectSeg, reveal, trapFocus, setText, setHTML } from './dom.js';
import { S, canUsePeriod, periodNeedsFocus } from './state.js';
import * as M from './money.js';
import {
  LEDGER, PENDING, PEOPLE, GROUPS, TODAY, THEMES, THEME_BG, BOOKS, TIPSTERS,
  TARGETS, FOUND, PL, hydrate, hydrateSocial, hydratePeople, setFound, addBet, settleLocal, setMe, ME, ico
} from './data.js';
import { settle, settleCashOut, ledgerOutcome } from './settlement.js';
import { inferBetType, betProblem } from './betshape.js';
import { stats, dayMap, monthTotal, targetFor, weekRange, invalidateDays, importedTotals } from './stats.js';
import * as R from './render.js';
import * as C from './content.js';
import * as P from './pages.js';
import { sportOf } from './sports.js';
import { demoPayload } from './sample.js';
import * as Bot from './botsetup.js';
import * as Tour from './tour.js';
import { initMotion, syncThemeColor } from './motion.js';
import { extractSlip, readText, get, post, patch, del } from './api.js';
import { parseBetsCsv } from './csv.js';
import * as Auth from './auth.js';

const MS = R.MS;
const APP_VIEWS = ['dash', 'imp', 'settings', 'prof', 'util'];


/* ---------------- the live ledger ----------------
   Everything the app shows comes from here. There is no seeded dataset any
   more, so an empty response renders the empty states rather than somebody
   else's numbers. */
let sessionChecked = false;
/* Where the user was trying to go before we knew who they were. Replayed
   once the session lands, so a deep link into the app survives the round
   trip instead of silently dropping them on the landing page. */
let pendingView = null;

/** Ask who we are. Returns the user, or null when signed out. */
async function loadSession() {
  const r = await get('/api/auth/me');
  sessionChecked = true;
  setMe(r.ok ? r.body.user : null);
  document.body.classList.toggle('signed-in', Boolean(r.ok && r.body.user));
  /* Replayed AFTER setMe, or the replay re-runs the guard against a ME that
     is still null and bounces the very navigation it exists to rescue. */
  if (pendingView) { const v = pendingView; pendingView = null; go(v); }
  if (r.ok && r.body.configured === false) document.body.classList.add('no-backend');
  if (r.ok) renderFederated(r.body.providers);
  /* Shown once the account is known and only when the server says it has
     not been finished. Waiting for the server answer is the point: guessing
     from the client is what would make it replay. */
  if (r.ok && r.body.user && r.body.user.onboarded === false) {
    /* Not while the setup wizard is still running. Verifying signs you in,
       which re-read the session, which popped the tour on top of step 2 of
       a wizard the person was halfway through — and finishing the tour
       navigated to Import, abandoning the rest of setup. The two are one
       sequence: verify, finish setup, then the tour. */
    if (S.view === 'setup') tourPending = true;
    else openTour();
  }
  return r.ok ? r.body.user : null;
}

/* ---------------- the first run tutorial ----------------
 *
 * The walkthrough itself lives in src/js/tour.js: six stops that navigate,
 * open what has to be open, scroll the target into view and cut a hole in
 * the scrim around it. What stays here is when it runs and what it means
 * to have finished.
 *
 * The state is a column on the users row, never a browser flag. iOS Safari
 * gives this app no localStorage at all, so a client-side "seen it" would
 * replay the tutorial on every visit on the owner's primary platform, and
 * would not survive a second device either.
 *
 * Skip and finish are the same write. Somebody who skipped has made a
 * decision, and asking again on the next visit would ignore it. Settings
 * offers it again for anybody who wants it back.
 */
let tourPending = false;

function openTour() { Tour.startTour(0); }

async function closeTour(finished) {
  Tour.endTour(finished);
}

/* Called by the tour when it ends, either way. */
async function tourFinished(finished) {
  if (ME) ME.onboarded = true;
  post('/api/auth/profile', { onboarded: true }).catch(() => {});
  /* Finishing lands on the thing the last step was about. Skipping leaves
     somebody where they were, because they asked to be left alone. */
  if (finished) go('dash');
}

/* Google and Apple buttons, drawn only for providers this deployment holds
   credentials for. The server decides, not the client: a button that starts
   a redirect nobody can finish is exactly the kind of control this rebuild
   exists to remove. Neither configured means the block stays hidden rather
   than showing something greyed out and unexplained.

   These are plain links, not fetch calls. OAuth is a full page redirect and
   the callback sets an HttpOnly cookie, so there is nothing for script to
   carry. */
const FED = {
  google: 'Continue with Google',
  apple: 'Continue with Apple'
};
function renderFederated(providers) {
  const box = document.getElementById('fedButtons');
  if (!box) return;
  const list = Array.isArray(providers) ? providers.filter(p => FED[p]) : [];
  box.hidden = list.length === 0;
  if (!list.length) { box.innerHTML = ''; return; }
  box.innerHTML = list.map(p =>
    '<a class="fedbtn" href="/api/auth/oauth-start?provider=' + p + '">' +
    '<svg class="ico" aria-hidden="true"><use href="#i-' + p + '"/></svg>' +
    esc(FED[p]) + '</a>').join('') +
    '<p class="fedor"><span>or</span></p>';
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
  /* Their own requests, and not worth blocking the ledger on. Groups and
     follows are separate questions and a failure in one must not empty the
     other. */
  loadGroups();
  loadPeople();
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
    '<p class="fineprint" style="margin-top:-4px">Group names are one per platform, first come first served.</p>' +
    '<p class="label">Who can join</p>' +
    '<div class="optionlist" id="groupVis">' +
      visRow('private', 'Private', 'Invite only. The code is the only way in, and the group never appears in Browse.') +
      visRow('public', 'Public', 'Listed in Browse for anyone to find and join. The code still works too.') +
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
  if (!r.ok) {
    groupError('groupName', r.body.error || 'That group could not be created.');
    /* A taken name is the one failure where the fix is in the field they
       are already looking at, so put the cursor back in it with the text
       selected rather than making them clear it themselves. */
    if (r.body.taken) { $('groupName').focus(); $('groupName').select(); }
    return;
  }
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
  /* NO SESSION, NO APP SCREEN. The `sessionChecked` clause used to sit in
     this condition, which meant the gate was open for the few hundred
     milliseconds before /api/auth/me answered: a deep link or a fast tap
     rendered the dashboard, and only the reply closed it again. The check
     is now unconditional, and a navigation that arrives early is parked
     and replayed once the session is known rather than allowed through. */
  if (APP_VIEWS.includes(id) && !ME && !S.demo) {
    if (!sessionChecked) { pendingView = id; return; }
    if (id !== 'setup') { go('setup'); toast('Create an account, or log in, to start tracking.'); }
    return;
  }
  const prev = S.view;
  $$('.view').forEach(v => v.classList.toggle('on', v === view));
  S.view = id;
  document.body.classList.toggle('in-app', APP_VIEWS.includes(id));
  document.documentElement.classList.toggle('snap', id === 'landing' && !RM);
  /* The tab bar's indicator is one element that travels, so the only thing
     the view switch has to say is which column it belongs over. Everything
     else, the distance, the spring and the stretch, is in 04-shell.css.
     .slide is held for the length of the journey: it adds the scaleX that
     makes the pill elongate as it sets off and relax as it lands. */
  const bar = document.querySelector('.tabbar');
  const tabs = $$('.tabbar button');
  tabs.forEach((b, i) => {
    const t = b.getAttribute('data-nav');
    if (t === id) {
      b.setAttribute('aria-current', 'page');
      if (bar) {
        const from = bar.style.getPropertyValue('--i');
        bar.style.setProperty('--i', String(i));
        /* Only stretch when it actually moves. Re-selecting the tab you
           are already on should not wobble. */
        if (from !== String(i) && !RM) {
          bar.classList.add('slide');
          clearTimeout(bar._slide);
          bar._slide = setTimeout(() => bar.classList.remove('slide'), 190);
        }
      }
    } else b.removeAttribute('aria-current');
  });
  if (bar) bar.style.setProperty('--n', String(tabs.length || 3));
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
  /* The import view opens on the chooser, so the two jobs are a decision
     rather than whichever one was left open last time. */
  if (id === 'imp' && prev !== 'imp') showImportJob('');
  announce(view.getAttribute('aria-label') || id);
}

/* ---------------- the public demo ----------------
 *
 * Enter it and the real dashboard fills with a fabricated ledger. Leave it
 * and the store is emptied again. There is no second implementation of any
 * screen, which is the point: what a stranger looks at before signing up
 * is the thing they get.
 *
 * TWO RULES, AND THEY ARE THE ONES THAT MATTER.
 * The demo is only ever offered to somebody with no session, so it can
 * never paint over a real ledger. And while it is on, api.js refuses every
 * request, so no sample bet can reach an account even if a button is found
 * that tries.
 */
function enterDemo() {
  if (ME) {
    /* Somebody signed in asking for the demo wants their own dashboard;
       showing them fabricated figures in the same interface is how a
       person ends up reading someone else's record as theirs. */
    go('dash');
    toast('You have your own dashboard. This is it.');
    return;
  }
  S.demo = true;
  document.body.classList.add('demo');
  $('demoBar').hidden = false;
  hydrate(demoPayload());
  invalidateDays();
  /* All time, because the first thing to say about a 486 bet sample is
     what the whole of it did. */
  S.period = 'a';
  syncPeriodButtons();
  go('dash');
  R.renderAll();
}

function leaveDemo() {
  if (!S.demo) return;
  S.demo = false;
  document.body.classList.remove('demo');
  $('demoBar').hidden = true;
  /* Emptied rather than left in place. A sample bet sitting in the store
     while somebody signs up is the one way this could ever contaminate a
     real account. */
  hydrate({ bets: [], pl: [] });
  invalidateDays();
  S.period = 'm';
  S.year = TODAY.year;
  S.month = TODAY.month;
  /* Repainted before leaving, not after arriving. Emptying the store
     without redrawing left 486 fabricated bets on screen behind a landing
     page, ready to be seen again the moment anybody navigated back. */
  R.renderAll();
  go('landing');
}

/* TWO JOBS, NOT TWO TABS.
 *
 * "Add bets" and "Type totals" described the mechanism rather than the
 * intent, so the difference between the thing you do every week and the
 * thing you do once was left for people to infer. Adding a bet is a slip
 * you just placed; importing history is a record you are bringing across.
 * They want different words around the same drop zone, and history wants
 * the typed-figures section that adding a bet has no use for.
 *
 * An empty job is the chooser itself, which is where this view now opens.
 */
const IMPORT_COPY = {
  importUpload: ['Drop a slip here, or tap to choose',
    'A screenshot, a photo of a printed slip, or a PDF. Slippery reads the stake, the price and every leg, and you check it before it is saved.'],
  importHistory: ['Drop your history here, or tap to choose',
    'A CSV or Excel export, a statement, or a screenshot of another tracker\'s profit screen. You see every row, and you choose which of them come across.']
};

function showImportJob(job) {
  S.importJob = job || '';
  const choosing = !S.importJob;
  const el = id => $(id);
  if (el('importChoose')) el('importChoose').hidden = !choosing;
  if (el('importBack')) el('importBack').hidden = choosing;
  if (el('importUpload')) el('importUpload').hidden = choosing;
  /* Typed figures belong to bringing a record across, not to logging the
     bet you placed five minutes ago. */
  if (el('importTotals')) el('importTotals').hidden = S.importJob !== 'importHistory';

  const copy = IMPORT_COPY[S.importJob];
  if (copy) { setText('dropTitle', copy[0]); setText('dropSub', copy[1]); }
  scrollTo(0, 0);
  if (!choosing) R.renderPl();
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
function firstActiveDay(year, month) {
  const days = Object.keys(dayMap(year, month)).map(Number).sort((a, b) => a - b);
  if (!days.length) return null;
  if (year === TODAY.year && month === TODAY.month) {
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
    const d = firstActiveDay(S.year, S.month);
    if (d == null) { toast('No bets in this month to break down'); return; }
    S.focus = d;
  }
  S.period = p;
  syncPeriodButtons();
  if (p === 'm') { S.year = TODAY.year; S.month = TODAY.month; S.calMode = 'm'; syncCalModeButtons(); }
  /* Yearly shows the year it means, so the calendar switches to the twelve
     month grid with it. Picking the period and then having to find the
     calendar's own toggle to see the year was two controls for one idea. */
  if (p === 'y') { S.calMode = 'y'; syncCalModeButtons(); }
  drawAll();
}

function syncPeriodButtons() {
  const usable = { d: true, w: true, m: true, y: true, a: true };
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
      const blocked = periodNeedsFocus(p) && S.focus == null && !firstActiveDay(S.year, S.month);
      b.disabled = !!blocked;
      b.setAttribute('aria-disabled', String(!!blocked));
    });
    paintSeg(seg);
  });
  return usable;
}
function syncCalModeButtons() {
  selectSeg($('calMode'), $$('#calMode button').find(b => b.getAttribute('data-cal') === S.calMode));
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
  const days = dayMap(S.year, S.month);
  /* An empty day is a real day. This used to `return` when there was no
     figure, so tapping the 3rd did nothing and there was no way to say
     "the profit for the 3rd was this". The sheet opens either way; what
     changes is whether it lists bets or offers to add a figure. */
  const has = days[day] !== undefined;
  const v = has ? days[day] : 0;
  S.focus = day;
  const list = LEDGER.filter(b => b.year === S.year && b.month === S.month && b.day === day);
  const w = weekRange(S.year, S.month, day, S.weekStart);
  /* Summed over the real seven days, so a week that starts in the previous
     month is not quietly reported as the three days of it that happen to
     fall inside the grid. */
  let weekTotal = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(w.from.getFullYear(), w.from.getMonth(), w.from.getDate() + i);
    const map = dayMap(d.getFullYear(), d.getMonth());
    if (map[d.getDate()] !== undefined) weekTotal += map[d.getDate()];
  }

  setText('dayTitle', R.DF.format(new Date(S.year, S.month, day)));
  const net = $('dayNet');
  net.textContent = M.signed(v);
  net.className = 'n ' + M.tone(v);
  setHTML('daySub', (list.length ? list.length + (list.length === 1 ? ' bet' : ' bets')
      : has ? 'Daily total' : 'Nothing logged') +
    ' · week to ' + R.DS.format(w.to) +
    ' <b class="' + M.tone(weekTotal) + '">' + M.money0s(weekTotal) + '</b>');

  /* Three states, and they are genuinely different: bets to show, a figure
     with no bets behind it, or an empty day waiting for one. */
  const stamp = S.year + '-' + String(S.month + 1).padStart(2, '0') + '-' +
    String(day).padStart(2, '0');
  const entered = PL.find(x => x.date === stamp && x.period === 'day');
  setHTML('dayList', list.length
    ? list.map((b, i) => R.betRow(b, i * 40)).join('')
    : entered
      ? '<div class="emptystate"><div class="t">Entered as a figure</div>' +
        '<p>' + esc(M.signed(entered.profit)) + ' for this day, with no slips behind it. ' +
        'Remove it from the Import screen if it is wrong.</p></div>'
      : '<div class="emptystate"><div class="t">Nothing on this day yet</div>' +
        '<p>Send a slip to the bot, or put the day\'s profit in directly if you already know it.</p>' +
        '<button class="btn ghost small" data-add-figure="' + stamp + '" style="margin-top:11px">' +
        'Add a figure for this day</button></div>');

  lastFocused = document.activeElement;
  $('scrim').classList.add('on');
  $('daySheet').classList.add('on');
  lockScroll();
  releaseTrap = trapFocus($('daySheet'));
  const first = $('daySheet').querySelector('button');
  if (first) first.focus();
  syncPeriodButtons();
  R.renderCalendar();
  announce(R.DF.format(new Date(S.year, S.month, day)) + ', ' + M.signed(v));
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
    ['History', (LEDGER.length + PENDING.length) ? M.plain(LEDGER.length + PENDING.length) + ' brought across' : 'Nothing yet']
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
  /* A code can carry the tick, and once granted it is never taken back by
     redeeming another one, so this only ever goes on. */
  if (r.body.verified) S.verified = true;
  say(r.body.label + ', ' + r.body.note, 'pos');
  toast(r.body.label + ' applied');
  R.renderPlan();
  R.renderGroups();
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

async function handleFiles(files, into) {
  const list = Array.prototype.slice.call(files || []).slice(0, 8);
  if (!list.length) return;
  /* The signup wizard has its own containers, because two elements cannot
     share an id and the wizard is on screen while the Import view is not.
     Everything else about the flow is identical. */
  const wrap = $(into && into.results || 'uploadResults');
  const reportId = into && into.report || 'csvReport';
  /* What could not be read at all, so the summary can say so by name. A
     file that fails is otherwise indistinguishable from one nobody picked. */
  const failed = [];

  for (const file of list) {
    /* A spreadsheet is parsed in the browser: the file never leaves the
       device unless the user goes ahead, and a bad file gets an answer
       instantly rather than after an upload. */
    /* Inside its own try. This await used to sit outside the one below, so
       a single unparseable spreadsheet threw straight out of the loop:
       every remaining file in the batch was never read, no card appeared
       for any of them, and updateImportTotals() at the end never ran. One
       bad file took the other seven with it, silently. */
    if (isSpreadsheet(file)) {
      try { await handleCsv(file, reportId); }
      catch (err) { failed.push({ name: file.name, why: err && err.message || 'could not be read' }); }
      continue;
    }

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
      failed.push({ name: file.name, why: err && err.message || 'could not be read' });
    }
  }
  updateImportTotals();
  if (failed.length) {
    announce(failed.length + (failed.length === 1 ? ' file could not be read' : ' files could not be read'));
  }
  return failed;
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
/* One page can hold several bets, so this decides how many cards there are
   before anything is drawn.
 *
 * It used to draw exactly one, always. A photo of three printed slips fell
 * through to the single-bet renderer, the three selections were joined with
 * " & ", and the result was one bet called "Arsenal & Spurs & Chelsea" at
 * one arbitrary stake, with a badge beside it reading "3".
 *
 * Each bet gets its own card, its own editable fields and its own Confirm,
 * because they are separate bets and one of them being wrong should not
 * hold up the other two. */
function renderExtraction(card, label, res) {
  const f = res.fields || {};
  const bets = Array.isArray(f.bets) ? f.bets : [];

  if (f.doc_type === 'pnl_summary' || bets.length <= 1) {
    renderOneBet(card, label, res);
    return;
  }

  /* Document-level facts every bet on the page shares. The bet's own values
     win where it has them. */
  const shared = {
    readable: f.readable, doc_type: 'bet_slip', platform: f.platform,
    bet_type: f.bet_type, free_bet: f.free_bet, each_way: f.each_way,
    price_source: f.price_source, kickoff: f.kickoff,
    unreadable_fields: f.unreadable_fields, notes: f.notes,
    totals: null, pl_rows: []
  };

  const parent = card.parentNode;
  const first = card;
  /* Track the last card placed, or every insertBefore(first.nextSibling)
     would put the newest card immediately after the first and the page
     would read 1, 4, 3, 2. */
  let after = first;
  bets.forEach((b, i) => {
    const one = Object.assign({}, shared, {
      selection: b.selection, event: b.event, market: b.market,
      bookmaker: b.bookmaker, odds: b.odds, stake: b.stake,
      returns: b.returns, result: b.result, stage: b.stage,
      placed_at: b.placed_at, selections: b.selections || [],
      legs: b.legs || (b.selections || []).length || 1,
      bet_count: 1
    });
    let target = first;
    if (i > 0) {
      target = document.createElement('div');
      target.className = first.className;
      target.style.marginTop = '12px';
      target.id = 'up' + (++uploadSeq);
      if (parent) parent.insertBefore(target, after.nextSibling);
      after = target;
    }
    /* Numbered against the page they came from, so a review list of nine
       cards from three photos can still be matched back to the photos. */
    renderOneBet(target, label + '  ' + (i + 1) + ' of ' + bets.length, { fields: one });
  });
  updateImportTotals();
}

function renderOneBet(card, label, res) {
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

  /* The date the bet was placed.
     The reader has always extracted placed_at and kickoff and the card
     threw both away, so every imported slip landed with today's date on it
     and a month of history imported as one afternoon. Prefer the placed
     date; fall back to kickoff, because a slip that prints only a kick-off
     is still closer to the truth than "now". */
  const dateOf = v => {
    if (!v) return '';
    const d = new Date(String(v).length <= 10 ? v + 'T12:00:00' : v);
    return Number.isNaN(d.getTime()) ? '' : d.getFullYear() + '-' +
      String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  const placed = dateOf(f.placed_at) || dateOf(f.kickoff) ||
    (new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0') +
     '-' + String(new Date().getDate()).padStart(2, '0'));

  card.innerHTML =
    '<div class="sliphead">' +
      '<span class="slipbook">' + esc(f.platform || f.bookmaker || label) + '</span>' +
      /* The number in the corner of a real slip: how many bets were placed. */
      '<span class="slipcount" title="Bets on this slip">' + count + '</span>' +
    '</div>' +
    '<div class="sliplegs">' + legs.map((leg, i) => slipLeg(card.id, i, leg, price)).join('') + '</div>' +
    /* Always offered, not only on a multiple. A single that the reader read
       as one leg is often a double with the second leg cropped off, and
       there was no way to add it back. */
    '<button class="pillbtn link slipaddleg" data-add-leg="1">' + ico('i-plus') + 'Add a selection</button>' +
    '<div class="slipgrid">' +
      '<label class="slipcell"><span>Stake £</span>' +
        '<input class="field slipin m" data-slip="stake" inputmode="decimal" value="' + esc(money(f.stake)) + '"></label>' +
      /* The combined price, next to the leg prices rather than instead of
         them. A slip prints both and correcting one leg should not force
         anyone to work the accumulator out in their head. */
      '<label class="slipcell"><span>Total odds</span>' +
        '<input class="field slipin m" data-slip="odds" inputmode="decimal" value="' + esc(price(f.odds)) + '"></label>' +
      '<label class="slipcell"><span>Placed</span>' +
        '<input class="field slipin m" type="date" data-slip="placed" value="' + esc(placed) + '"></label>' +
      '<label class="slipcell"><span>Bookmaker</span>' +
        '<input class="field slipin" data-slip="book" list="bookNames" value="' +
        esc(f.bookmaker || f.platform || '') + '"></label>' +
      '<label class="slipcell wide"><span>Market</span>' +
        '<input class="field slipin" data-slip="market" list="marketNames" value="' + esc(f.market || '') + '"></label>' +
    '</div>' +
    '<p class="sliphint" id="' + card.id + '-oddshint" hidden></p>' +
    /* WHAT KIND OF MULTIPLE. Hidden on a single, and on a multiple the
       reader could classify; shown, and required, when it could not. The
       two settle differently, so this is a settlement input rather than a
       label. */
    '<div class="sliptype" id="' + card.id + '-type" hidden>' +
      '<div class="chiprow wrap" role="group" aria-label="What kind of bet">' +
        '<button class="chip" data-bettype="multiple" aria-pressed="false">Accumulator</button>' +
        '<button class="chip" data-bettype="bet_builder" aria-pressed="false">Bet builder</button>' +
      '</div><p class="typenote"></p></div>' +
    '<p class="sliptotal" id="' + card.id + '-returns"></p>' +
    '<p class="slipstage ' + stageNote[0] + '">' + esc(stageNote[1]) + '</p>' +
    '<p class="hinttext" id="' + card.id + '-hint">Check it, then confirm. Nothing is saved until you do.</p>' +
    '<div class="btnrow" style="margin-top:11px">' +
    '<button class="btn primary small" data-confirm-slip="1">Confirm</button>' +
    '<button class="btn ghost small" data-dismiss-card="1">Discard</button></div>';

  card.dataset.stage = stage || '';
  card.dataset.result = result || '';
  /* What the reader concluded, if it concluded anything. Null means it
     could not tell the two apart and the person is asked. */
  card.dataset.betType = f.bet_type || '';
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
  const rows = Array.isArray(f.pl_rows) ? f.pl_rows : [];
  const row = (k, v) => v == null ? ''
    : '<div class="reviewline"><span class="k">' + k + '</span><span class="v m">' + esc(String(v)) + '</span></div>';

  /* The dated rows are the point of a P/L screenshot, so they come first
     and the grand total is the footnote. The old version showed only the
     grand total and threw every date on the screen away, which meant a
     year of history arrived as a single number with nowhere to sit. */
  if (rows.length) {
    const sum = rows.reduce((a, r) => a + r.profit, 0);
    card.innerHTML =
      '<div class="cardhead"><span class="title">' + esc(f.platform || label) + '</span>' +
      '<span class="tagbit">' + rows.length + ' dated figure' + (rows.length === 1 ? '' : 's') + '</span></div>' +
      '<p class="hinttext">Read off the screen with a date on each one. They count in your ' +
      'profit and loss and sit on the calendar on their own dates, as figures rather than as ' +
      'bets: there are no slips behind them, and inventing some would make your bet count ' +
      'wrong forever.</p>' +
      '<div class="plpreview">' + rows.map((r, i) =>
        '<div class="plrow"><span class="pld">' + esc(r.label || r.date) +
        (r.label ? '<span class="plt">' + esc(r.date) + '</span>' : '') + '</span>' +
        '<span class="plv ' + M.tone(Math.round(r.profit * 100)) + '">' +
        M.signed(Math.round(r.profit * 100)) + '</span>' +
        '<button class="plx" data-drop-plrow="' + i + '" aria-label="Leave out ' +
        esc(r.label || r.date) + '">' + ico('i-close') + '</button></div>').join('') +
      '</div>' +
      '<div class="reviewbar" style="margin-top:11px">' +
        '<div class="reviewline"><span class="k">Adds up to</span><span class="v m ' +
        M.tone(Math.round(sum * 100)) + '">' + M.signed(Math.round(sum * 100)) + '</span></div>' +
        (t.profit != null
          ? '<div class="reviewline"><span class="k">Screen says</span><span class="v m">' +
            M.signed(Math.round(t.profit * 100)) + '</span></div>'
          : '') +
      '</div>' +
      /* When the rows do not add up to the total the screen printed, say
         so rather than picking one. Usually it means a row scrolled off
         the top, which is the user's to resolve, not ours. */
      (t.profit != null && Math.abs(sum - t.profit) > 0.02
        ? '<p class="sliphint">These add up to ' + esc(M.signed(Math.round(sum * 100))) +
          ' but the screen totals ' + esc(M.signed(Math.round(t.profit * 100))) +
          '. Some rows are probably off the top of the screenshot.</p>'
        : '') +
      '<div class="btnrow" style="margin-top:11px">' +
      '<button class="btn primary small" data-import-plrows="1">Add ' + rows.length + ' figures</button>' +
      '<button class="btn ghost small" data-dismiss-card="1">Discard</button></div>';
    card.dataset.plrows = JSON.stringify(rows);
    return;
  }

  /* A totals screen with a grand total and no dated rows on it. */
  card.innerHTML =
    '<div class="cardhead"><span class="title">' + esc(f.platform || label) + '</span>' +
    '<span class="tagbit">Summary, not slips</span></div>' +
    '<p class="hinttext">That is a totals screen rather than a bet slip, and it has no dates ' +
    'broken out on it, so there is nothing to put on a particular day. Add it as one figure ' +
    'for the period it covers.</p>' +
    '<div class="reviewbar" style="margin-top:11px">' +
      row('Period', t.period) + row('Profit', t.profit) + row('Turnover', t.turnover) +
      row('Bets', t.bets) + row('Won', t.won) + row('Lost', t.lost) +
    '</div>' +
    '<div class="btnrow" style="margin-top:11px">' +
    '<button class="btn primary small" data-goto-totals="1">Add it as a figure</button>' +
    '<button class="btn ghost small" data-dismiss-card="1">Discard</button></div>';
}

/* Save the dated rows a P/L screenshot gave us.
   Sent in one request so the whole import either lands or does not, and
   the upsert on the server means running the same screenshot twice
   corrects the figures rather than doubling them. */
async function importPlRows(btn) {
  const card = btn.closest('.card');
  let rows = [];
  try { rows = JSON.parse(card.dataset.plrows || '[]'); } catch { rows = []; }
  if (!rows.length) { toast('Nothing left to add'); return; }

  btn.disabled = true;
  btn.textContent = 'Adding…';
  const r = await post('/api/bets', {
    pl: rows.map(x => ({
      date: x.date,
      period: 'day',
      profitPence: Math.round(x.profit * 100),
      note: x.label || '',
      source: 'import'
    }))
  });
  btn.disabled = false;

  if (r.status === 401) { go('setup'); toast('Log in to import.'); return; }
  if (!r.ok) { btn.textContent = 'Add figures'; toast(r.body.error || 'That import did not go through.'); return; }

  collapse(card);
  await loadLedger();
  toast(r.body.saved + ' figure' + (r.body.saved === 1 ? '' : 's') + ' added to your profit and loss');
  updateImportTotals();
}

/* Drop one row before importing. A screenshot often catches a header or a
   running-balance line that is not a day's profit, and the fix should be
   one tap rather than abandoning the whole import. */
function dropPlRow(btn) {
  const card = btn.closest('.card');
  let rows = [];
  try { rows = JSON.parse(card.dataset.plrows || '[]'); } catch { rows = []; }
  const i = +btn.getAttribute('data-drop-plrow');
  if (!(i >= 0) || i >= rows.length) return;
  rows.splice(i, 1);
  if (!rows.length) { collapse(card); updateImportTotals(); return; }
  renderSummaryRead(card, card.querySelector('.title').textContent, { pl_rows: rows });
}

/* One leg of a slip, built in one place.
 *
 * Two rows instead of three: the selection and its price share a line, and
 * the event sits under them in a lighter field. A fourfold used to be twelve
 * stacked full-width inputs and about 600px of scrolling before you reached
 * the stake; it is now roughly half that, and the shape reads like the slip
 * it came from.
 *
 * Every leg carries a remove button. There was only ever "Add another
 * selection", so a reader that split one selection into two, which happens
 * on a slip with a line break in the wrong place, could not be corrected
 * without discarding the whole card and starting again. */
export function slipLeg(cardId, i, leg, price) {
  leg = leg || {};
  const fmt = price || (v => v == null ? '' : Number(v).toFixed(2));
  return '<div class="slipleg" data-leg="' + i + '">' +
    '<div class="slipleg-top">' +
      '<label class="sr" for="' + cardId + '-sel' + i + '">Selection ' + (i + 1) + '</label>' +
      '<input class="field slipin slipleg-sel" id="' + cardId + '-sel' + i + '" ' +
        'data-leg-field="selection" placeholder="Selection" value="' + esc(leg.selection || '') + '">' +
      '<label class="sr" for="' + cardId + '-odds' + i + '">Odds for selection ' + (i + 1) + '</label>' +
      '<input class="field slipin slipleg-odds m" id="' + cardId + '-odds' + i + '" ' +
        'data-leg-field="odds" inputmode="decimal" placeholder="Odds" value="' + esc(fmt(leg.odds)) + '">' +
      '<button class="slipleg-x" data-drop-leg="' + i + '" ' +
        'aria-label="Remove selection ' + (i + 1) + '">' + ico('i-close') + '</button>' +
    '</div>' +
    '<label class="sr" for="' + cardId + '-ev' + i + '">Event for selection ' + (i + 1) + '</label>' +
    '<input class="field slipin slipleg-ev" id="' + cardId + '-ev' + i + '" ' +
      'data-leg-field="event" placeholder="Event, for example Arsenal v Spurs" ' +
      'value="' + esc(leg.event || '') + '">' +
  '</div>';
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
  /* Built by slipLeg, the same function the initial render uses. This used
     to be a second copy of the markup, which is how the two drifted: the
     remove button existed in neither and the placeholders differed. */
  row.innerHTML = slipLeg(card.id, i, {});
  legs.appendChild(row.firstChild);
  const added = legs.lastElementChild;
  added.querySelector('input').focus();
  syncSlipCard(card);
}

/* Take a selection off a slip.
 *
 * Renumbering matters and is easy to get wrong: leg ids are positional, so
 * removing the middle of three and leaving the last one called leg 2 gives
 * two inputs the same id, which is one of the two classes of bug this
 * codebase has actually shipped. Every remaining leg is rebuilt from its
 * current values at its new index. */
function dropLeg(btn) {
  const card = btn.closest('.card');
  const legs = card && card.querySelector('.sliplegs');
  if (!legs || legs.children.length <= 1) {
    toast('A bet needs at least one selection');
    return;
  }
  const kept = [...legs.children]
    .filter((row, i) => i !== +btn.getAttribute('data-drop-leg'))
    .map(row => ({
      selection: (row.querySelector('[data-leg-field="selection"]') || {}).value || '',
      odds: (row.querySelector('[data-leg-field="odds"]') || {}).value || '',
      event: (row.querySelector('[data-leg-field="event"]') || {}).value || ''
    }));
  /* The odds come back out of the DOM as typed strings, so they are passed
     straight through rather than run through the number formatter, which
     would turn a half-typed "1." into "NaN". */
  legs.innerHTML = kept.map((leg, i) => slipLeg(card.id, i, leg, v => v == null ? '' : String(v))).join('');
  syncSlipCard(card);
  updateImportTotals();
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

  /* WHICH KIND OF MULTIPLE THIS IS, KEPT RATHER THAN FLATTENED.
     The legs used to be joined into one selection string here and then
     thrown away, so a treble was saved as a row nothing could grade. They
     now travel to the server, and the type travels with them, because a
     bet builder and an accumulator settle differently. The reader supplies
     the type when it can read one; the person picks when it cannot. */
  const picked = card.dataset.betType || '';
  const betType = legs.length > 1
    ? (picked || inferBetType(legs) || '')
    : 'single';
  card.dataset.betType = betType;
  card.dataset.legList = legs.length > 1 ? JSON.stringify(legs) : '';

  const stake = M.parseMoney(read('stake'));
  const odds = parseFloat(read('odds'));

  /* A multiple is described by its legs joined, so the ledger row reads the
     way the slip does rather than as one of the legs standing in for all of
     them. */
  const selection = legs.map(l => l.selection).filter(Boolean).join(' & ');
  const event = legs.map(l => l.event).filter(Boolean).join(' & ');

  /* The placed date, carried through so an imported slip lands on the day
     it was placed. Without it every import stamped today, and a month of
     history arrived as one afternoon. */
  card.dataset.placed = read('placed');
  card.dataset.selection = selection;
  card.dataset.event = event;
  card.dataset.book = read('book');
  card.dataset.market = read('market');
  card.dataset.stake = stake != null && stake > 0 ? String(stake) : '';
  card.dataset.odds = Number.isFinite(odds) && odds > 1 ? String(odds) : '';
  card.dataset.legs = String(legs.length);
  /* A multiple whose kind nobody has established is not ready to save:
     saving it would either grade a same-game multi on the 90 minute score
     or refuse to grade an accumulator that should have graded itself. */
  card.dataset.needsType = legs.length > 1 && !betType ? '1' : '';

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

  const ready = Boolean(card.dataset.stake && card.dataset.odds && selection)
    && !card.dataset.needsType;
  card.dataset.ready = ready ? '1' : '0';

  /* The choice, shown only when it is genuinely open. Two legs in one
     fixture is a bet builder and two legs in two fixtures is an
     accumulator; this appears when the reader could not tell which, and it
     blocks Confirm until it is answered. */
  const typeRow = $(card.id + '-type');
  if (typeRow) {
    typeRow.hidden = legs.length < 2;
    if (legs.length > 1) {
      $$('[data-bettype]', typeRow).forEach(b => {
        const on = b.getAttribute('data-bettype') === betType;
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', String(on));
      });
      const note = typeRow.querySelector('.typenote');
      if (note) {
        note.textContent = !betType
          ? 'Which is it? A bet builder is several picks in one game and is settled by hand.'
          : betType === 'bet_builder'
            ? 'Several picks in one game. Slippery will not grade this one for you.'
            : 'Legs in different games. Slippery grades it when every leg is in.';
      }
    }
  }
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
    /* Midday rather than midnight. A bet stamped 00:00 in one timezone is
       the previous day in another, and the whole product is a calendar. */
    placedAt: card.dataset.placed ? card.dataset.placed + 'T12:00:00' : undefined,
    /* Where the bet was in its life when the slip was read. This is what
       the capture rate is built from, and it is the reader's observation
       rather than an inference: it comes off the slip, or it is absent. */
    stage: card.dataset.stage || undefined,
    /* The legs, and which kind of multiple they make. Without these a
       treble was saved as one row whose selection was its legs joined by
       an ampersand, which nothing could ever grade. */
    betType: card.dataset.betType || undefined,
    legs: card.dataset.legList ? JSON.parse(card.dataset.legList) : undefined,
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
async function handleCsv(file, reportId) {
  if (!file) return;
  const report = $(reportId || 'csvReport');
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
  showCsvReport(parseBetsCsv(text), file.name, reportId);
}

/* THE IMPORT YOU CAN LOOK AT BEFORE YOU AGREE TO IT.
 *
 * This used to print four counts and one button. "Import 200 bets" was the
 * whole of the review: nobody could see the dates and amounts they were
 * committing, correct a row the parser read wrongly, or leave one out. The
 * only choices were all of it or none of it, and a spreadsheet exported
 * from a bookmaker is exactly the kind of file that has one bad row in it.
 *
 * Now every row is on screen with its date, selection, stake, price and
 * result, each one selectable and each one editable in place. Three things
 * make that trustworthy rather than decorative:
 *
 *   · Selection lives on the row object, never in the DOM, so a re-render
 *     cannot silently lose which rows somebody unticked.
 *   · Every edit re-runs betProblem() from src/js/betshape.js, which is
 *     the same function the server validates with, so a row that would be
 *     rejected says so beside the field that is wrong instead of coming
 *     back as a line number afterwards.
 *   · Duplicates are found against the ledger already loaded, on the four
 *     fields the server keys on, and pre-unticked with the reason shown.
 *     The server still checks; this stops the check being a surprise.
 */
function showCsvReport(parsed, label, reportId) {
  const { bets, errors, mapped } = parsed;
  const report = $(reportId || 'csvReport');
  /* Line numbers travel with the rows, so a server-side rejection can name
     the same line the file does. */
  bets.forEach((b, i) => { b.line = i + 2; });

  if (!bets.length) {
    report.innerHTML = csvError(errors.length ? errors[0].why : 'Nothing in there looked like a bet.');
    return;
  }

  /* Already in the ledger? Same four fields the server keys on. */
  const key = b => [dayOf(b.placedAt), String(b.selection || '').trim().toLowerCase(),
                    Math.round(Number(b.stakePence) || 0),
                    String(b.book || '').trim().toLowerCase()].join('|');
  const held = new Set(LEDGER.concat(PENDING).map(b => [
    [b.year, String(b.month + 1).padStart(2, '0'), String(b.day).padStart(2, '0')].join('-'),
    String(b.selection || '').trim().toLowerCase(),
    Math.round(Number(b.stake) || 0),
    String(b.book || '').trim().toLowerCase()
  ].join('|')));

  const seen = new Set();
  pendingCsv = bets.map(b => {
    const k = key(b);
    /* A file that lists the same bet twice is caught here as well, which is
       the case the server also catches and neither should be the first to
       mention it. */
    const dupe = held.has(k) || seen.has(k);
    seen.add(k);
    return Object.assign({}, b, {
      include: !dupe,
      duplicate: dupe,
      problem: betProblem(b)
    });
  });

  report.innerHTML =
    '<div class="card pad imported" style="margin-top:12px">' +
    '<div class="cardhead"><span class="title">' + esc(label) + '</span>' +
    '<span class="tagbit ok">' + bets.length + (bets.length === 1 ? ' row' : ' rows') + '</span></div>' +
    '<p class="hinttext" style="border:0;padding:0;margin:0 0 10px">Matched columns: ' +
      esc(mapped.join(', ') || 'none') + '. Untick anything you do not want, or tap a row to correct it. ' +
      'Nothing is saved until you press the button at the bottom.</p>' +
    '<div class="rowlist" id="csvRows"></div>' +
    (errors.length
      ? '<details class="disclose"><summary>' + errors.length + ' rows the parser could not read</summary>' +
        errors.slice(0, 40).map(e => '<p class="hinttext">Line ' + e.line + ': ' + esc(e.why) + '</p>').join('') +
        '</details>'
      : '') +
    '<div class="reviewbar" id="csvTotals"></div>' +
    '<div class="btnrow" style="margin-top:12px">' +
      '<button class="btn primary small" id="csvGo">Import</button>' +
      '<button class="btn ghost small" id="csvCancel">Cancel</button></div></div>';

  paintCsvRows();
}

/** One imported row: what it says, whether it is coming, and how to fix it. */
function csvRow(b, i) {
  const money = v => (v == null ? '' : (v / 100).toFixed(2));
  const on = b.include && !b.problem;
  return '<div class="irow' + (b.problem ? ' bad' : '') + '" data-irow="' + i + '">' +
    '<button class="ipick" data-ipick="' + i + '" aria-pressed="' + on + '" ' +
      'aria-label="' + (on ? 'Do not import' : 'Import') + ' ' + esc(b.selection || 'this row') + '">' +
      ico('i-won') + '</button>' +
    '<button class="imid" data-iopen="' + i + '" aria-expanded="false">' +
      '<span class="isel">' + esc(b.selection || 'No selection') + '</span>' +
      '<span class="imeta">' + esc(dayLabel(b.placedAt)) +
        (b.book ? ' · ' + esc(b.book) : '') +
        (b.odds ? ' · ' + Number(b.odds).toFixed(2) : '') + '</span>' +
      (b.duplicate ? '<span class="iflag">Already in your ledger</span>' : '') +
      (b.problem ? '<span class="iflag bad">' + esc(b.problem) + '</span>' : '') +
    '</button>' +
    '<span class="iamt m">' + esc(M.money(b.stakePence || 0)) + '</span>' +
    '<div class="iedit" hidden>' +
      ifield(i, 'placedAt', 'Date', 'date', dayOf(b.placedAt)) +
      ifield(i, 'selection', 'Selection', 'text', b.selection || '') +
      ifield(i, 'stakePence', 'Stake £', 'decimal', money(b.stakePence)) +
      ifield(i, 'odds', 'Odds', 'decimal', b.odds == null ? '' : String(b.odds)) +
      ifield(i, 'book', 'Bookmaker', 'text', b.book || '') +
      ifield(i, 'event', 'Event', 'text', b.event || '') +
    '</div></div>';
}

function ifield(i, key, label, kind, value) {
  const id = 'irow' + i + '-' + key;
  return '<label class="icell"><span>' + esc(label) + '</span>' +
    '<input class="field slipin' + (kind === 'decimal' ? ' m' : '') + '" id="' + id + '" ' +
    (kind === 'date' ? 'type="date"' : kind === 'decimal' ? 'inputmode="decimal"' : '') +
    ' data-iedit="' + i + '" data-ikey="' + key + '" value="' + esc(value) + '"></label>';
}

/* Rendered from the row objects every time, so the DOM is never the place
   the answer is kept. */
function paintCsvRows() {
  const list = $('csvRows');
  if (!list || !pendingCsv) return;
  setHTML('csvRows', pendingCsv.map(csvRow).join(''));
  paintCsvTotals();
}

function paintCsvTotals() {
  const el = $('csvTotals');
  if (!el || !pendingCsv) return;
  const going = pendingCsv.filter(b => b.include && !b.problem);
  const staked = going.reduce((a, b) => a + (b.stakePence || 0), 0);
  const settled = going.filter(b => b.outcome);
  const net = settled.reduce((a, b) => a + (b.profitPence || 0), 0);
  const dupes = pendingCsv.filter(b => b.duplicate).length;
  const broken = pendingCsv.filter(b => b.problem).length;

  el.innerHTML =
    '<div class="reviewline"><span class="k">Coming across</span>' +
      '<span class="v">' + going.length + ' of ' + pendingCsv.length + '</span></div>' +
    (dupes ? '<div class="reviewline"><span class="k">Already in your ledger</span>' +
      '<span class="v warn">' + dupes + '</span></div>' : '') +
    (broken ? '<div class="reviewline"><span class="k">Need fixing first</span>' +
      '<span class="v neg">' + broken + '</span></div>' : '') +
    '<div class="reviewline"><span class="k">Staked across them</span>' +
      '<span class="v m">' + M.money0(staked) + '</span></div>' +
    (settled.length
      ? '<div class="reviewline"><span class="k">Profit on the ' + settled.length + ' already settled</span>' +
        '<span class="v m ' + M.tone(net) + '">' + M.signed(net) + '</span></div>'
      : '');

  const go = $('csvGo');
  if (go) {
    go.disabled = going.length === 0;
    go.textContent = going.length
      ? 'Import ' + going.length + (going.length === 1 ? ' bet' : ' bets')
      : 'Nothing selected';
  }
}

/** Tick or untick one row. A row that cannot be saved cannot be ticked. */
function toggleCsvRow(i) {
  const b = pendingCsv && pendingCsv[i];
  if (!b) return;
  if (b.problem) { toast(b.problem); return; }
  b.include = !b.include;
  /* Ticking a duplicate back on is allowed and deliberate: two identical
     bets on one day is unusual, not impossible, and the person knows. */
  const el = document.querySelector('[data-ipick="' + i + '"]');
  if (el) el.setAttribute('aria-pressed', String(b.include));
  const row = document.querySelector('[data-irow="' + i + '"]');
  if (row) row.classList.toggle('off', !b.include);
  paintCsvTotals();
}

/** Edit one field of one row, and re-check it the way the server will. */
function editCsvRow(i, key, raw) {
  const b = pendingCsv && pendingCsv[i];
  if (!b) return;
  if (key === 'stakePence') {
    const pence = M.parseMoney(raw);
    b.stakePence = pence == null ? null : pence;
  } else if (key === 'odds') {
    const n = parseFloat(raw);
    b.odds = Number.isFinite(n) ? n : null;
  } else if (key === 'placedAt') {
    b.placedAt = raw ? raw + 'T12:00:00' : null;
  } else {
    b[key] = raw.trim();
  }
  b.problem = betProblem(b);
  /* A row that has just been fixed comes back into the import rather than
     staying excluded for a reason that no longer applies. */
  if (!b.problem && !b.duplicate) b.include = true;

  const row = document.querySelector('[data-irow="' + i + '"]');
  if (row) {
    row.classList.toggle('bad', Boolean(b.problem));
    const flags = row.querySelectorAll('.iflag');
    flags.forEach(f => f.remove());
    const mid = row.querySelector('.imid');
    if (b.duplicate && mid) mid.insertAdjacentHTML('beforeend',
      '<span class="iflag">Already in your ledger</span>');
    if (b.problem && mid) mid.insertAdjacentHTML('beforeend',
      '<span class="iflag bad">' + esc(b.problem) + '</span>');
    const amt = row.querySelector('.iamt');
    if (amt) amt.textContent = M.money(b.stakePence || 0);
    const sel = row.querySelector('.isel');
    if (sel) sel.textContent = b.selection || 'No selection';
    const pick = row.querySelector('[data-ipick]');
    if (pick) pick.setAttribute('aria-pressed', String(b.include && !b.problem));
    row.classList.toggle('off', !b.include);
  }
  paintCsvTotals();
}

/* An ISO day out of whatever the parser produced, and a readable one. */
function dayOf(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') +
    '-' + String(d.getDate()).padStart(2, '0');
}
function dayLabel(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return 'No date';
  return R.DS.format(d) + ' ' + d.getFullYear();
}

let pendingCsv = null;
const csvError = msg =>
  '<div class="card" style="padding:13px;margin-top:12px;border-color:rgba(252,165,165,.45);background:rgba(252,165,165,.08)">' +
  '<div class="alerthead" style="color:var(--neg)">Could not read that file</div>' +
  '<p class="hinttext" style="border-top-color:rgba(252,165,165,.22)">' + esc(msg) +
  ' Nothing was imported.</p></div>';

/* AN IMPORT IS A LEDGER OF ITS OWN, NOT A PILE OF DATED FIGURES.
 *
 * This file used to fold every parsed CSV row into a daily total and post
 * it as profit and loss. The reasoning was sound as far as it went: a
 * spreadsheet row has no slip behind it, cannot settle, and cannot be
 * checked, so calling it a bet overstates what is known.
 *
 * It was also, in practice, the second of the two things that made import
 * look broken. The button said "Import 200 bets" and produced 34 dated
 * figures; the ledger stayed empty and the bet count never moved.
 *
 * The owner's decision is that imported history is a SEPARATE LEDGER shown
 * alongside, and the database already draws that line: bets.source is
 * 'upload', 'telegram' or 'import'. So the rows become real bets marked as
 * imported, distinguishable everywhere, and already excluded from the
 * capture rate, which is the measure the old rationale was protecting.
 *
 * What the upsert used to give for free, it now has to earn: appending
 * bets is not idempotent, so re-importing the same file would double a
 * record. Duplicate detection in api/bets.js createMany is what replaces
 * it, and it is load-bearing rather than a nicety.
 *
 * pl_entries keeps its proper job: a profit-and-loss SUMMARY screenshot,
 * where there are no individual bets to create in the first place.
 */
async function runCsvImport(btn) {
  if (!pendingCsv) return;
  /* Only what is ticked, and only what would survive the server's own
     check. The review is not a preview of a decision already taken. */
  const rows = pendingCsv.filter(b => b.include && !b.problem);
  if (!rows.length) { toast('Nothing selected to import.'); return; }

  btn.disabled = true;
  btn.textContent = 'Importing…';
  /* {bets:[...]}, the server's real bulk path.
     This used to fold every row into dated figures and post {pl:[...]},
     so a spreadsheet of 200 bets produced about 34 daily totals: the
     ledger stayed empty, the bet count never moved, nothing could settle,
     and the button that said "Import 200 bets" was telling the truth about
     neither number. createMany, MAX_IMPORT and the per-line rejected array
     had been written and had no caller at all. */
  const r = await post('/api/bets', { bets: rows.map((b, i) => Object.assign({ line: i + 1 }, b)) });
  btn.disabled = false;

  if (r.status === 402) { showUpgrade(r.body); btn.textContent = 'Import'; return; }
  if (r.status === 401) { go('setup'); toast('Log in to import.'); return; }
  if (r.status === 503) { showBackendNotice(r.body); btn.textContent = 'Import'; return; }
  if (!r.ok) { toast(r.body.error || 'That import did not go through.'); btn.textContent = 'Import'; return; }

  pendingCsv = null;
  const report = btn.closest('#setupCsvReport') ? $('setupCsvReport') : $('csvReport');
  report.innerHTML = importSummary(r.body, rows);
  toast((r.body.imported || 0) + ' bets imported');
  await loadLedger();
}

/* WHAT ACTUALLY HAPPENED, RECONCILED.
 *
 * The server has always reported partial success honestly, per line, and
 * the client read none of it: nothing anywhere touched `rejected` or
 * `imported`, only `saved`. So rows a user could see in their own file
 * simply never appeared, with no explanation, which is indistinguishable
 * from the import being broken.
 *
 * Every number here comes from the response rather than being counted
 * again in the browser, so the summary cannot disagree with the ledger. */
function importSummary(body, rows) {
  const detected = body.detected != null ? body.detected : rows.length;
  const imported = body.imported || 0;
  const dupes = body.duplicates || 0;
  const rejected = Array.isArray(body.rejected) ? body.rejected : [];

  const staked = rows.reduce((a, b) => a + Math.round(b.stakePence || 0), 0);
  const settled = rows.filter(b => b.outcome && b.profitPence != null);
  const net = settled.reduce((a, b) => a + Math.round(b.profitPence || 0), 0);
  const pending = imported - settled.length;

  const line = (k, v, cls) =>
    '<div class="reviewline"><span class="k">' + esc(k) + '</span>' +
    '<span class="v m ' + (cls || '') + '">' + v + '</span></div>';

  return '<div class="card pad" style="margin-top:12px">' +
    '<div class="cardhead"><span class="title">Imported</span>' +
      '<span class="meta">' + imported + ' of ' + detected + '</span></div>' +
    line('Bets created', imported) +
    (dupes ? line('Already in your ledger', dupes, 'mut') : '') +
    (rejected.length ? line('Could not be read', rejected.length, 'neg') : '') +
    line('Total staked', M.money(staked)) +
    (settled.length ? line('Profit on the ' + settled.length + ' settled', M.signed(net), M.tone(net)) : '') +
    (pending > 0 ? line('Still to settle', pending, 'mut') : '') +
    (dupes
      ? '<p class="hinttext">Duplicates were skipped, not deleted. A bet counts as one ' +
        'when the day, the selection, the stake and the bookmaker all match one you ' +
        'already have.</p>'
      : '') +
    (rejected.length
      ? '<details class="disclose"><summary>' + rejected.length + ' rows skipped</summary>' +
        rejected.slice(0, 40).map(e =>
          '<p class="hinttext">Line ' + esc(String(e.line)) + ': ' + esc(e.why) + '</p>').join('') +
        '</details>'
      : '') +
    '</div>';
}

async function leaveGroup(id) {
  const r = await del('/api/groups', { id });
  if (!r.ok) { toast(r.body.error || 'Could not leave that group.'); return; }
  S.group = 0;
  await loadGroups();
  toast(r.body.dissolved ? 'You were the last one, so the group is gone' : 'Left the group');
}

/* ---------------- the group directory ----------------
 *
 * Fetched when the Browse tab is opened and on each search, never on a
 * dashboard load: it lists every public group on the platform and most
 * sessions never look at it.
 *
 * `browseSeq` is the reason typing quickly does not scramble the list. Two
 * searches in flight can land in either order, and without a sequence
 * number the slower one overwrites the faster, so the results shown are
 * for a query the box no longer contains. Only the newest response paints.
 */
let browseSeq = 0;
let browseTimer = null;

/* Popularity first. A directory sorted alphabetically puts whichever group
   somebody named "Aardvarks" at the top forever, and the useful question
   on a browse screen is which groups people are actually in. */
let browseSort = 'popular';

async function loadBrowse(query) {
  const seq = ++browseSeq;
  R.renderBrowse(null);
  const r = await get('/api/groups?browse=1&sort=' + browseSort +
    (query ? '&q=' + encodeURIComponent(query) : ''));
  if (seq !== browseSeq) return;          // a newer search has already answered
  if (r.status === 401) { R.renderBrowse([], query); return; }
  if (!r.ok) {
    R.renderBrowse([], query);
    toast(r.body.error || 'Could not reach the group directory.');
    return;
  }
  R.renderBrowse(r.body.groups || [], query);
}

/* Typing is not a search. Waiting a beat turns eight keystrokes into one
   request, and the sequence number above handles the ones that still
   overlap. */
function browseSearch(value) {
  clearTimeout(browseTimer);
  browseTimer = setTimeout(() => loadBrowse(value.trim()), 260);
}

/* ---------------- export ----------------
 *
 * Built in the browser from the ledger already loaded, so there is no
 * endpoint and no round trip: the data is on screen, exporting it is a
 * formatting job. Money comes out in pounds because a spreadsheet is
 * where this is going, and integer pence is an internal representation
 * that nobody wants to divide by 100 in a formula.
 */
const EXPORT_COLUMNS = [
  ['Placed', b => b.placedAt || ''],
  ['Event', b => b.event || ''],
  ['Selection', b => b.selection || ''],
  ['Market', b => b.market || ''],
  ['Bookmaker', b => b.book || ''],
  ['Odds', b => (b.odds || '')],
  ['Stake', b => (b.stake / 100).toFixed(2)],
  ['Profit', b => (b.status === 'settled' ? (b.profit / 100).toFixed(2) : '')],
  ['Outcome', b => b.outcome || ''],
  ['Status', b => b.status || ''],
  ['Tipster', b => b.tipster || ''],
  ['Via', b => (b.viaTelegram ? 'Telegram' : 'Upload')]
];

/* RFC 4180: double the quotes, wrap anything with a comma, quote, or
   newline in it. A selection like `Over 2.5, both teams to score` would
   otherwise silently become two columns. */
const csvCell = v => {
  const s = String(v == null ? '' : v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

function exportBets(format) {
  const rows = LEDGER.concat(PENDING)
    .slice()
    .sort((a, b) => String(b.placedAt || '').localeCompare(String(a.placedAt || '')));
  if (!rows.length) { toast('There is nothing to export yet'); return; }

  const stamp = new Date().toISOString().slice(0, 10);
  let body, type, name;
  if (format === 'JSON') {
    body = JSON.stringify({ exported: new Date().toISOString(), bets: rows }, null, 2);
    type = 'application/json';
    name = 'slippery-' + stamp + '.json';
  } else {
    body = [EXPORT_COLUMNS.map(c => csvCell(c[0])).join(',')]
      .concat(rows.map(b => EXPORT_COLUMNS.map(c => csvCell(c[1](b))).join(',')))
      .join('\r\n');
    /* A BOM, so Excel opens it as UTF-8 rather than mangling every name
       with an accent in it. */
    body = '﻿' + body;
    type = 'text/csv;charset=utf-8';
    name = 'slippery-' + stamp + '.csv';
  }

  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  /* Revoked on the next tick rather than immediately: Safari has been
     known to cancel the download if the object URL dies too soon. */
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  toast(rows.length + ' bets exported');
}

/* ---------------- take a break ----------------
 *
 * The brief lists this under "flag, don't decide" and it went unbuilt for
 * a long time. A product that turns a gambling record into a green and red
 * grid with a leaderboard on top and offers no way to stop is the version
 * of this that should not ship.
 *
 * The confirmation is deliberately blunt about the one property that
 * matters: it cannot be undone. Everything else about the flow is designed
 * to make it easy; that one line is designed to make it considered.
 */
const BREAK_LENGTHS = [
  ['24h', '24 hours', 'A cooling-off day.'],
  ['7d', 'A week', 'Long enough for a weekend of fixtures to pass.'],
  ['30d', '30 days', 'A month off.'],
  ['90d', '90 days', 'A quarter.'],
  ['1y', 'A year', 'If you want real distance from it.']
];
let breakChoice = '7d';

function openBreakBox() {
  const box = $('breakBox');
  if (!box) return;
  box.hidden = !box.hidden;
  if (box.hidden) return;
  setHTML('breakChoices', BREAK_LENGTHS.map(([id, name, why]) =>
    '<button class="optioncard" role="radio" aria-checked="' + (breakChoice === id) + '" ' +
    'aria-pressed="' + (breakChoice === id) + '" data-break="' + id + '">' +
    '<span><span class="t">' + esc(name) + '</span>' +
    '<span class="s">' + esc(why) + '</span></span></button>').join(''));
}

async function startBreak(btn) {
  btn.disabled = true;
  btn.textContent = 'Starting…';
  const r = await post('/api/auth/break', { length: breakChoice });
  btn.disabled = false;
  btn.textContent = 'Start the break';
  if (!r.ok) { toast(r.body.error || 'Could not start that break.'); return; }
  $('breakBox').hidden = true;
  await loadSession();
  R.renderAccount(ME);
  toast('Break started. ' + r.body.note);
}

/* ---------------- destructive actions ----------------
 *
 * All three of these were a toast. "Reset all bets completed", "Delete
 * account completed", "All stored slip images deleted", and in every case
 * nothing was removed and the session stayed valid. Somebody clearing
 * their record before handing over a phone was told it had worked.
 *
 * They talk to the server now, and the button reports what the server
 * actually did rather than what was asked for.
 */
async function resetBets(btn) {
  /* Two taps rather than a dialog. There is a way back from this one: the
     account survives and the slips can be re-imported, so the friction is
     proportionate. Deleting the account is a different matter and gets a
     typed confirmation. */
  if (btn.dataset.armed !== '1') {
    btn.dataset.armed = '1';
    btn.textContent = 'Tap again to wipe';
    setTimeout(() => {
      if (btn.dataset.armed === '1') { btn.dataset.armed = '0'; btn.textContent = 'Reset'; }
    }, 5000);
    return;
  }
  btn.dataset.armed = '0';
  btn.disabled = true;
  btn.textContent = 'Wiping…';
  const r = await del('/api/bets', { all: true });
  btn.disabled = false;
  btn.textContent = 'Reset';
  if (!r.ok) { toast(r.body.error || 'Nothing was deleted.'); return; }
  await loadLedger();
  toast(r.body.deleted ? r.body.deleted + ' bets deleted' : 'There was nothing to delete');
}

async function purgeImages(btn) {
  btn.disabled = true;
  const was = btn.textContent;
  btn.textContent = 'Deleting…';
  const r = await post('/api/auth/close', { images: true });
  btn.disabled = false;
  btn.textContent = was;
  if (!r.ok) { toast(r.body.error || 'Nothing was deleted.'); return; }
  toast(r.body.purged ? r.body.purged + ' slip images deleted' : 'No stored images to delete');
}

function openDeleteBox() {
  const box = $('deleteBox');
  if (!box) return;
  box.hidden = false;
  setText('deleteName', S.name || 'your display name');
  $('deleteConfirm').value = '';
  $('deleteErr').hidden = true;
  $('deleteConfirm').focus();
}
function closeDeleteBox() {
  const box = $('deleteBox');
  if (box) box.hidden = true;
}

async function deleteAccount(btn) {
  const typed = $('deleteConfirm').value.trim();
  const err = $('deleteErr');
  if (typed.toLowerCase() !== String(S.name || '').toLowerCase()) {
    err.hidden = false;
    err.textContent = 'That does not match your display name.';
    $('deleteConfirm').focus();
    return;
  }
  err.hidden = true;
  btn.disabled = true;
  btn.textContent = 'Deleting…';
  const r = await post('/api/auth/close', { confirm: typed });
  if (!r.ok) {
    btn.disabled = false;
    btn.textContent = 'Delete everything';
    err.hidden = false;
    err.textContent = r.body.error || 'That did not go through.';
    return;
  }
  /* The session is gone server-side, so the page has to stop pretending it
     has one. A reload is the honest reset: every store empties, and what
     comes back is the signed-out site. */
  toast('Account deleted');
  setTimeout(() => location.reload(), 900);
}

/* ---------------- following ----------------
 *
 * Following is a server fact now. It used to flip a boolean on an object in
 * memory, show a toast, and be gone on the next reload, and worse, the same
 * click recalculated `mu` locally, so tapping Follow on somebody with a
 * 'friends' setting revealed their figures in the browser without anybody
 * having agreed to it. What you may see is the server's decision.
 *
 * The button is updated optimistically because a follow that takes a moment
 * to appear feels broken, and put back if the request fails.
 */
async function toggleFollow(name) {
  /* The row can be in either list: somebody you already follow, or a
     search result you have not. Both need the button to move. */
  const rows = [PEOPLE.find(x => x.n === name), (FOUND || []).find(x => x.n === name)].filter(Boolean);
  const wasFollowing = rows.some(x => x.ing);
  for (const x of rows) x.ing = !wasFollowing;
  R.renderPeople();
  if (S.view === 'prof') R.renderProfile(name);

  const r = wasFollowing
    ? await del('/api/people', { follow: name })
    : await post('/api/people', { follow: name });

  if (!r.ok) {
    for (const x of rows) x.ing = wasFollowing;
    R.renderPeople();
    toast(r.body.error || 'That did not go through.');
    return;
  }
  toast(r.body.following ? 'Now following ' + r.body.name : 'Unfollowed ' + r.body.name);
  /* Re-read rather than patching in place: whether their figures are now
     visible depends on their privacy setting and on whether they follow
     back, and neither of those is knowable here. */
  await loadPeople();
}

/* Finding somebody to follow.
   Same shape as the group directory search, and for the same reason: two
   requests in flight can land in either order, and the slower one must not
   repaint results for a query the box no longer holds. */
let findSeq = 0;
let findTimer = null;

function findPeople(query) {
  clearTimeout(findTimer);
  if (!query) { setFound(null); R.renderPeople(); return; }
  setFound(null);
  R.renderPeople();                      // shows "Looking…"
  findTimer = setTimeout(async () => {
    const seq = ++findSeq;
    const r = await get('/api/people?q=' + encodeURIComponent(query));
    if (seq !== findSeq || S.peopleQuery !== query) return;
    setFound(r.ok ? (r.body.people || []) : []);
    R.renderPeople();
  }, 280);
}

/* The two lists, from the server. */
async function loadPeople() {
  const r = await get('/api/people');
  if (!r.ok) return;
  hydratePeople(r.body);
  R.renderPeople();
  R.renderGroups();
  if (S.view === 'prof' && S.profile) R.renderProfile(S.profile);
}

/* The unit size is saved, because the group boards divide by it.
 *
 * It never was. Setting £50 during setup left the database on its 10000
 * default, so every board ranked you against a unit you had not chosen, and
 * units are the entire basis of the ranking.
 *
 * Debounced: typing a custom unit fires on every keystroke, and £1, £15,
 * £150 are three saves for one decision. Failures are quiet on purpose,
 * this is a background write behind a value already on screen, and a toast
 * per keystroke would be worse than the problem. */
let unitTimer = null;
function saveUnit() {
  clearTimeout(unitTimer);
  unitTimer = setTimeout(async () => {
    const r = await post('/api/auth/profile', { unitPence: S.unit });
    if (!r.ok && r.status !== 401) console.warn('[slippery] unit not saved:', r.body.error);
  }, 700);
}

/* Privacy is an account setting, so it is saved. This used to change a
   label and nothing else: the app said "your figures are now private" and
   no server ever heard about it. */
async function setPrivacy(value) {
  const was = S.privacy;
  S.privacy = value;
  R.renderPrivacy();
  const r = await post('/api/auth/profile', { privacy: value });
  if (!r.ok) {
    S.privacy = was;
    R.renderPrivacy();
    toast(r.body.error || 'Could not save that setting.');
    return;
  }
  toast('Your figures are now ' + (value === 'private' ? 'private'
    : value === 'friends' ? 'visible to friends only' : 'public'));
}

/* ASKING, NOT JOINING. Every group needs the owner to say yes now, so the
   button reports that it has asked rather than claiming a membership the
   person does not have yet. */
async function joinPublicGroup(btn, id, name) {
  btn.disabled = true;
  const was = btn.textContent;
  btn.textContent = 'Asking…';
  const r = await post('/api/groups', { join: id });
  btn.disabled = false;
  btn.textContent = was;
  if (!r.ok) { toast(r.body.error || 'Could not ask to join that group.'); return; }
  toast('Asked to join ' + name + '. Whoever made it decides.');
  await loadGroups();
  /* Repaint the directory so the row says Asked rather than offering the
     button again. */
  await loadBrowse($('browseSearch').value.trim());
}

/* ---------------- requests the owner has to answer ---------------- */
async function loadRequests() {
  const r = await get('/api/groups?requests=1');
  if (!r.ok) { R.renderRequests([]); return; }
  R.renderRequests(r.body.requests || []);
}

async function decideRequest(btn, yes, groupId, personId) {
  btn.disabled = true;
  const r = await post('/api/groups', { decide: groupId, person: personId, accept: yes });
  btn.disabled = false;
  if (!r.ok) { toast(r.body.error || 'Could not answer that.'); return; }
  toast(yes ? 'Let them in' : 'Declined');
  await loadRequests();
  if (yes) await loadGroups();
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
/* Re-read the session and repaint whatever it drives. The bot links in
   another app, so the only thing that knows it worked is the server. */
async function refreshAccount() {
  const me = await get('/api/auth/me');
  if (me.ok && me.body.user) { setMe(me.body.user); R.renderAccount(me.body.user); }
}

/* The flow owns issuing codes, opening Telegram and waiting for the answer
   now; see src/js/botsetup.js. What is left here is unlinking, which
   belongs to the Settings card rather than to the flow.

   UNLINK, AND MEAN IT. The server answers with what it actually cleared,
   and this reads that answer rather than assuming. Four controls in this
   codebase once confirmed actions they never performed. */
async function unlinkTelegram(btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Unlinking…'; }
  const r = await post('/api/auth/link', { action: 'unlink' });
  if (btn) { btn.disabled = false; btn.textContent = 'Unlink'; }
  if (!r.ok) { toast(r.body.error || 'Could not unlink just now.'); return; }
  await refreshAccount();
  toast(r.body.unlinked
    ? 'Telegram unlinked. Nothing was deleted.'
    : 'That chat was not linked.');
}

/* The trial has stopped this upload. The server says which half ran out,
   and the two need different sentences: somebody who burned 35 slips in
   four days is being asked to subscribe early, which is a compliment, and
   somebody whose fortnight is up is being asked at the normal time. The
   old wording said "free slips used" either way, which is simply wrong
   half the time. */
function showUpgrade(body) {
  const over = body && body.over;
  const cap = (body && body.freeSlips) || 35;
  toast(over === 'time'
    ? 'Your two week trial has finished. Pick a plan to carry on.'
    : 'That is all ' + cap + ' trial slips. Pick a plan to carry on.');
  go('pricing');
}

/* The review summary.
   "Profit" used to add the potential return of an open bet to the settled
   profit of a graded one and print the total with no label, so the number
   was never true of anything. Open and settled are now counted separately
   and the line says which it is showing. The whole bar hides when there is
   nothing on screen to review, rather than sitting there reading zero. */
function updateImportTotals() {
  const cards = $$('.slipcard');
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

/* ---------------- period profit and loss ----------------
 *
 * Figures with no slips behind them: a day you already know the number
 * for, or a row lifted off another tracker's screenshot.
 *
 * The old version was a grid of boxes labelled Mon..Sun and Jan..Dec with
 * no year on any of them, and a save button that printed "Totals added"
 * and stored nothing. Two problems, and the smaller one was that it did
 * not save: you could not say WHICH Monday you meant, and which Monday is
 * the only thing that matters about a daily figure.
 */
const iso = d => d.getFullYear() + '-' +
  String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

const PL_WORD = { day: 'day', week: 'week starting', month: 'month of' };

/* The date in the words somebody would use. "Today" and "yesterday" earn
   their place because those are the two days people actually type figures
   for, and a bare date makes you do the arithmetic to check you picked the
   right one. */
function plDateWords(value, period) {
  if (!value) return 'a date you pick';
  const d = new Date(value + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return 'a date you pick';
  if (period === 'month') return R.ML.format(d);
  if (period === 'week') return 'the week of ' + R.DS.format(d);
  const today = new Date();
  const days = Math.round((new Date(iso(d) + 'T12:00:00') - new Date(iso(today) + 'T12:00:00')) / 86400000);
  if (days === 0) return 'today';
  if (days === -1) return 'yesterday';
  if (days === 1) return 'tomorrow';
  return R.DF.format(d);
}

function renderTotals(period) {
  S.totalsPeriod = period;
  syncPlLabel();
}

/* The one sentence that says what the figure will be attached to. It is
   the whole reason this screen was rebuilt, so it updates on every change
   to either control rather than only on submit. */
function syncPlLabel() {
  const date = $('plDate');
  if (!date) return;
  if (!date.value) date.value = iso(new Date());
  setHTML('plPeriodLabel',
    'Profit for <b>' + esc(plDateWords(date.value, S.totalsPeriod)) + '</b>');
}

async function addPlEntry(btn) {
  const date = $('plDate').value;
  const err = $('plErr');
  const say = msg => { err.hidden = false; err.textContent = msg; };
  err.hidden = true;

  if (!date) { say('Pick the date this figure is for.'); $('plDate').focus(); return; }
  /* parseMoney handles a leading minus and the various dashes a phone
     keyboard produces, which matters because a loss is the common case. */
  const amount = M.parseMoney($('plAmount').value);
  if (amount == null) { say('Type the profit or loss, for example −40.50'); $('plAmount').focus(); return; }

  btn.disabled = true;
  const was = btn.textContent;
  btn.textContent = 'Adding…';
  const r = await post('/api/bets', {
    pl: [{ date, period: S.totalsPeriod, profitPence: amount, source: 'typed' }]
  });
  btn.disabled = false;
  btn.textContent = was;

  if (r.status === 401) { go('setup'); toast('Log in to add figures.'); return; }
  if (!r.ok) { say(r.body.error || 'That did not save.'); return; }

  $('plAmount').value = '';
  toast(M.signed(amount) + ' added for ' + plDateWords(date, S.totalsPeriod));
  await loadLedger();
  $('plAmount').focus();
}

async function removePlEntry(id) {
  const r = await post('/api/bets', { removePl: id });
  if (!r.ok) { toast(r.body.error || 'Could not remove that.'); return; }
  await loadLedger();
  toast('Figure removed');
}

/* ---------------- data utilities ----------------
   Each one reports what it would change and changes nothing. A tool that
   rewrites a betting ledger without showing its working first is a tool
   that quietly loses somebody's record, and there is no undo for that.

   These run over LEDGER in the browser because they are read-only. The
   moment one of them applies a change it has to move to the server, where
   settlement already lives, or there would be two writers. */
function runUtility(id) {
  const out = $('util-' + id);
  if (!out) return;
  const all = LEDGER.concat(PENDING);
  if (!all.length) {
    out.innerHTML = '<p class="hinttext">Nothing to look at yet. Log a bet or import a history first.</p>';
    return;
  }
  let found = [];
  if (id === 'split') {
    /* One row holding several selections. A slash or a plus between two
       named selections is the shape a spreadsheet export uses for a
       multiple that was flattened into one cell. */
    found = all.filter(b => /\s(?:\/|\+|&)\s/.test(String(b.selection || '')) && !(b.legs && b.legs.length > 1))
      .map(b => b.selection + ' — ' + String(b.selection).split(/\s(?:\/|\+|&)\s/).length + ' selections in one row');
  } else if (id === 'sport') {
    found = all.filter(b => b.sport && sportOf({ event: b.event, selection: b.selection, market: b.market }) !== b.sport)
      .map(b => (b.event || b.selection) + ' — filed as ' + b.sport + ', reads as ' +
        sportOf({ event: b.event, selection: b.selection, market: b.market }));
  } else if (id === 'link') {
    found = all.filter(b => !b.competition && b.event).map(b => b.event + ' — no competition attached');
  }
  if (!found.length) {
    out.innerHTML = '<p class="hinttext">Nothing found. Every bet in your ledger already looks right for this one.</p>';
    return;
  }
  out.innerHTML = '<p class="utilfound"><b>' + found.length + '</b> ' +
    (found.length === 1 ? 'bet' : 'bets') + ' this would change</p><ul class="utilul">' +
    found.slice(0, 12).map(f => '<li>' + esc(f) + '</li>').join('') +
    (found.length > 12 ? '<li>and ' + (found.length - 12) + ' more</li>' : '') + '</ul>' +
    '<p class="hinttext">Applying these is not built yet. The list above is what it would touch, so you can fix them by hand in the ledger meanwhile.</p>';
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
  /* One bookmaker page at a time, inside the one view. Ten views for ten
     bookmakers would be ten more ids to keep unique and ten more entries
     in every check that walks the views; the content is a table, so the
     route is a parameter. */
  if ((el = c('[data-bookpage]'))) { P.showBook(el.getAttribute('data-bookpage')); return; }
  if ((el = c('[data-utilrun]'))) { runUtility(el.getAttribute('data-utilrun')); return; }

  /* The end of setup is the start of the tour, in that order. */
  if (c('.step[data-step="7"] [data-nav="dash"]') && tourPending) {
    tourPending = false;
    go('dash');
    openTour();
    return;
  }

  if (c('#demoExit')) { leaveDemo(); return; }
  /* Every route into the demo is this one attribute, so there is one place
     that decides whether somebody gets it. */
  if ((el = c('[data-nav="demo"]'))) { enterDemo(); return; }

  if ((el = c('[data-nav]'))) {
    /* "Sign In" and "Get Started" are the same view. The mode attribute
       says which half of it to open, so the header's two controls do not
       both land a returning user on the signup form. */
    const mode = el.getAttribute('data-mode');
    go(el.getAttribute('data-nav'));
    if (mode === 'in') Auth.setMode('in');
    return;
  }
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
  if ((el = c('[data-add-figure]'))) {
    /* From the day sheet into the figure form with the date already set,
       so the day you tapped is the day the figure lands on and nobody has
       to re-pick it. */
    const stamp = el.getAttribute('data-add-figure');
    closeDay();
    go('imp');
    /* A figure typed for a day is part of bringing a record across, so
       that is the job this opens. */
    showImportJob('importHistory');
    const dayBtn = document.querySelector('#totalsSeg [data-totals="day"]');
    if (dayBtn) dayBtn.click();
    $('plDate').value = stamp;
    syncPlLabel();
    $('plAmount').focus();
    return;
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
  if ((el = c('[data-source]'))) {
    S.source = el.getAttribute('data-source');
    R.renderLedger();
    return;
  }
  if ((el = c('[data-filter]'))) { S.filter = el.getAttribute('data-filter'); R.renderLedger(); return; }
  if ((el = c('#ledgerSeg button'))) {
    S.ledgerView = el.getAttribute('data-ledger');
    selectSeg($('ledgerSeg'), el);
    ['ledgerBets', 'ledgerHistory', 'ledgerAnalysis'].forEach(x => { $(x).hidden = x !== S.ledgerView; });
    if (S.ledgerView === 'ledgerHistory') R.renderHistory();
    return;
  }
  if ((el = c('#socialSeg button'))) {
    S.socialView = el.getAttribute('data-social');
    selectSeg($('socialSeg'), el);
    ['socialGroups', 'socialBrowse', 'socialFollowing', 'socialFollowers']
      .forEach(x => { $(x).hidden = x !== S.socialView; });
    /* The directory is fetched when it is opened, not on every dashboard
       load. It is a list of every public group on the platform and most
       sessions never look at it. */
    if (S.socialView === 'socialBrowse') {
      loadBrowse($('browseSearch').value.trim());
      loadRequests();
    }
    return;
  }
  if ((el = c('[data-follow]'))) { toggleFollow(el.getAttribute('data-follow')); return; }
  if ((el = c('[data-profile]'))) { if (R.renderProfile(el.getAttribute('data-profile'))) go('prof'); return; }
  if (c('#profileBack')) { go('dash'); showPane('social'); return; }
  if ((el = c('[data-group]'))) { S.group = +el.getAttribute('data-group'); R.renderGroups(); return; }

  if ((el = c('[data-privacy]'))) { setPrivacy(el.getAttribute('data-privacy')); return; }
  /* `button[data-theme]`, NOT `[data-theme]`.
     The theme lives on <html data-theme="...">, so a bare attribute
     selector matched every click in the document once closest() walked far
     enough up, and because this branch returns, it swallowed every branch
     declared after it. That killed the signup wizard's Continue button, the
     unit row, the import tabs, both dropzones, and Confirm on an imported
     slip. Any delegated selector here must be specific enough that it
     cannot match <html> or <body>. */
  /* The bot flow. One sheet, opened from three places, so its handlers
     live together rather than being spread across the screens that use it. */
  if ((el = c('#botStart'))) { Bot.beginBotSetup(el); return; }
  if ((el = c('#botCopy'))) { Bot.copyCode(el); return; }
  if ((el = c('#botOpen'))) { Bot.openTelegram(el); return; }
  if (c('#botWaiting')) { Bot.startWaiting(); return; }
  if ((el = c('#botCheck'))) { Bot.checkOnce(el); return; }
  if (c('#botBack')) { Bot.showCode(); return; }
  if (c('#botSkip')) {
    Bot.closeBotSetup(false);
    toast('You can connect the bot from Settings whenever you like.');
    return;
  }
  if (c('#botDone')) { Bot.closeBotSetup(true); refreshAccount(); return; }
  if (c('#botSetupOpen') || c('#telegramLink')) {
    Bot.openBotSetup({ onDone: refreshAccount });
    return;
  }

  if (c('#tourSkip')) { Tour.endTour(false); return; }
  if (c('#tourBack')) { Tour.prevStep(); return; }
  if (c('#tourNext')) { Tour.nextStep(); return; }
  if (c('#tourReplay')) { go('dash'); Tour.startTour(0); return; }

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
  if ((el = c('[data-unit]'))) {
    const raw = el.getAttribute('data-unit');
    const row = el.closest('.chiprow');
    const custom = row.id === 'unitRowSettings' ? $('unitCustomSettings') : $('unitCustomSetup');
    custom.hidden = raw !== 'custom';
    if (raw === 'custom') custom.focus(); else { S.unit = +raw; saveUnit(); }
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
  if ((el = c('#payPromoGo'))) { redeemPromo(el, 'payPromo', 'payPromoNote'); return; }
  if (c('#suggestName')) {
    const f = $('suName');
    f.value = suggestName();
    f.dispatchEvent(new Event('input', { bubbles: true }));
    f.focus();
    return;
  }

  if ((el = c('[data-importjob]'))) { showImportJob(el.getAttribute('data-importjob')); return; }
  if (c('#importBack')) { showImportJob(''); return; }

  if ((el = c('#totalsSeg button'))) {
    selectSeg($('totalsSeg'), el);
    renderTotals(el.getAttribute('data-totals'));
    return;
  }
  if (c('#dropzone')) { $('slipFile').click(); return; }
  if (c('#setupDrop')) { $('setupFile').click(); return; }
  if ((el = c('#pasteGo'))) { handlePaste(el); return; }
  /* An accumulator the reader only got half of. Adding the missing leg
     beats retaking the photograph, which is the same reason every field is
     editable in the first place. */
  if ((el = c('[data-add-leg]'))) { addLeg(el.closest('.card')); return; }
  if ((el = c('[data-drop-leg]'))) { dropLeg(el); return; }
  if ((el = c('[data-import-plrows]'))) { importPlRows(el); return; }
  if ((el = c('[data-drop-plrow]'))) { dropPlRow(el); return; }
  if (c('[data-goto-totals]')) { showImportJob('importHistory'); return; }
  if ((el = c('[data-bettype]'))) {
    const card = el.closest('.card');
    if (card) { card.dataset.betType = el.getAttribute('data-bettype'); syncSlipCard(card); }
    return;
  }
  if ((el = c('[data-dismiss-card]'))) { collapse(el.closest('.card'), 'Discarded'); setTimeout(updateImportTotals, 500); return; }
  if ((el = c('[data-confirm-slip]'))) { confirmSlip(el); return; }
  if ((el = c('[data-ipick]'))) { toggleCsvRow(+el.getAttribute('data-ipick')); return; }
  if ((el = c('[data-iopen]'))) {
    const row = el.closest('.irow');
    const edit = row && row.querySelector('.iedit');
    if (edit) {
      const open = edit.hidden;
      edit.hidden = !open;
      el.setAttribute('aria-expanded', String(open));
      row.classList.toggle('open', open);
      if (open) { const f = edit.querySelector('input'); if (f) f.focus(); }
    }
    return;
  }
  if ((el = c('#csvGo'))) { runCsvImport(el); return; }
  if ((el = c('#csvCancel'))) {
    pendingCsv = null;
    const box = el.closest('#setupCsvReport') || el.closest('#csvReport');
    if (box) box.innerHTML = '';
    return;
  }
  if ((el = c('#plAdd'))) { addPlEntry(el); return; }
  if ((el = c('[data-remove-pl]'))) { removePlEntry(el.getAttribute('data-remove-pl')); return; }

  if ((el = c('.switch')) && !c('#moreToggle')) {
    const on = el.getAttribute('aria-checked') !== 'true';
    el.setAttribute('aria-checked', String(on));
    if (el.id === 'showTipster') { S.showTipster = on; R.renderRecentBets(); R.renderLedger(); R.renderPending(); }
    return;
  }
  if ((el = c('[data-reveal]'))) {
    /* Show the password. Missing entirely before this, on a form that
       demands a capital and a symbol: a rule list you cannot check
       against what you typed is how somebody gets locked out of an
       account they made ninety seconds ago. */
    const field = $(el.getAttribute('data-reveal'));
    if (!field) return;
    const showing = field.type === 'text';
    field.type = showing ? 'password' : 'text';
    el.setAttribute('aria-pressed', String(!showing));
    el.setAttribute('aria-label', (showing ? 'Show ' : 'Hide ') +
      (el.getAttribute('aria-label') || '').replace(/^(Show|Hide) /, ''));
    /* Keep the caret where it was. Changing `type` moves it to the end in
       every engine, which is maddening mid-word. */
    const at = field.selectionStart;
    field.focus();
    try { field.setSelectionRange(at, at); } catch { /* not all types allow it */ }
    return;
  }
  if (c('#breakOpen')) { openBreakBox(); return; }
  if (c('#breakCancel')) { $('breakBox').hidden = true; return; }
  if ((el = c('[data-break]'))) {
    breakChoice = el.getAttribute('data-break');
    $$('[data-break]').forEach(b => {
      const on = b === el;
      b.setAttribute('aria-checked', String(on));
      b.setAttribute('aria-pressed', String(on));
    });
    return;
  }
  if ((el = c('#breakGo'))) { startBreak(el); return; }
  if (c('#exportGo')) { exportBets(($('exportFormat') || {}).value || 'CSV'); return; }
  if ((el = c('#resetBets'))) { resetBets(el); return; }
  if (c('#deleteAccount')) { openDeleteBox(); return; }
  if (c('#deleteCancel')) { closeDeleteBox(); return; }
  if ((el = c('#deleteGo'))) { deleteAccount(el); return; }
  if ((el = c('#purgeImages'))) { purgeImages(el); return; }
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
  if ((el = c('[data-browsesort]'))) {
    browseSort = el.getAttribute('data-browsesort');
    selectSeg($('browseSortSeg'), el);
    loadBrowse($('browseSearch').value.trim());
    return;
  }
  if (c('#tgUnlink')) { unlinkTelegram($('tgUnlink')); return; }
  if ((el = c('[data-decide]'))) {
    decideRequest(el, el.getAttribute('data-decide') === 'yes',
      el.getAttribute('data-group'), el.getAttribute('data-person'));
    return;
  }
  if ((el = c('[data-browse-join]'))) {
    joinPublicGroup(el, el.getAttribute('data-browse-join'), el.getAttribute('data-name') || 'the group');
    return;
  }
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
    /* This said "Slips sent for review" and sent nothing anywhere. There
       is no review queue yet and no channel to send to, so it now says
       what is actually true rather than confirming something that did not
       happen. Wire it to a real queue and this goes back to being a
       submit button. */
    toast('Verification reviews are not open yet. The tick is granted by hand for now.');
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
});

function handleWizard(dir) {
  if (dir === 1 && step === 0) { Auth.submitStep0(() => wizardStep(1)); return; }
  if (dir === 1 && step === 1) { Auth.submitVerify(() => wizardStep(2)); return; }
  wizardStep(step + dir);
}

document.addEventListener('input', e => {
  const t = e.target;
  if (t.hasAttribute && t.hasAttribute('data-iedit')) {
    editCsvRow(+t.getAttribute('data-iedit'), t.getAttribute('data-ikey'), t.value);
    return;
  }
  if (Auth.handleInput(t)) return;
  if (t.id === 'betSearch') { S.query = t.value.trim().toLowerCase(); R.renderLedger(); return; }
  if (t.id === 'peopleSearch') { S.peopleQuery = t.value.trim(); findPeople(S.peopleQuery); return; }
  /* The directory is on the server, so this search is a request, not a
     filter over something already loaded. Debounced in browseSearch. */
  if (t.id === 'browseSearch') { browseSearch(t.value); return; }
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
    if (v != null && v > 0) { S.unit = v; R.renderMisc(); drawAll(); saveUnit(); }
    return;
  }
  /* The sentence saying what the figure is for has to move with the date,
     or the whole point of showing it is lost. */
  if (t.id === 'plDate') { syncPlLabel(); return; }
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
  else if (t.id === 'setupFile') {
    handleFiles(t.files, { results: 'setupResults', report: 'setupCsvReport' });
    t.value = '';
  }
  /* exportFormat is not announced any more: choosing a format is not an
     act worth a toast, and the toast used to be the whole feature. */
  else if (t.id === 'timezone' || t.id === 'stakeAs') toast(t.value + ' selected');
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
  /* January's previous month is December of last year. Taking (month+11)%12
     without moving the year read December of THIS year, which is a month
     that has not happened. */
  const prev = (TODAY.month + 11) % 12;
  const prevYear = TODAY.month === 0 ? TODAY.year - 1 : TODAY.year;
  const prevActual = monthTotal(prevYear, prev);
  const prevTarget = targetFor(prev);
  /* Three real months back, crossing the year boundary the same way. */
  const at = k => {
    const t = TODAY.year * 12 + TODAY.month + k;
    return monthTotal(Math.floor(t / 12), ((t % 12) + 12) % 12);
  };
  let avg = 0, n = 0, history = 0;
  for (let k = -12; k < 0; k++) if (at(k) !== 0) history++;
  for (let k = -3; k < 0; k++) { avg += at(k); n++; }
  avg = n ? Math.round(avg / n) : 0;
  if (card) card.hidden = history === 0;
  if (!history) return;
  setText('newMonthTitle', 'Happy with your ' + MS.format(new Date(TODAY.year, TODAY.month, 1)) + ' target?');
  setHTML('newMonthBody',
    MS.format(new Date(prevYear, prev, 1)) + ' finished <b class="' + M.tone(prevActual) + '">' +
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
  P.renderPages();
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
  /* The tutorial navigates and switches panes, which main.js owns. Passed
     in rather than imported, so tour.js stays a walkthrough rather than
     becoming a second copy of the router. */
  Tour.wireTour({ go, showPane, onFinish: tourFinished });

  Auth.whenSignedIn(async (stayPut) => {
    const user = await loadSession();
    if (!user) return;
    R.renderAccount(user);
    await loadLedger();
    startLive();
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
    /* Watch for bets the bot writes while this tab is open. */
    startLive();
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

/* ---------------- the bot writes, the dashboard notices ----------------
 *
 * A bet confirmed in Telegram is written by the server, and the dashboard
 * has no idea. Before this you had to pull to refresh or log in again to
 * see a bet you had just logged from your phone, which makes the whole
 * "forward a slip and it appears" claim false in the one moment somebody
 * is watching for it.
 *
 * Polling, not a socket. A socket needs a long-lived connection and Vercel
 * functions do not have one; the honest version of live on this stack is
 * asking again. Twice a minute while the tab is in front of somebody, and
 * never while it is hidden, so a dashboard left open in a background tab
 * costs nothing.
 *
 * The immediate refetch on becoming visible is the one that matters. The
 * ordinary sequence is: open the dashboard, switch to Telegram, forward a
 * slip, tap Confirm, switch back. Coming back to the tab is exactly when
 * the new bet should already be there. */
const LIVE_MS = 30000;
let liveTimer = null;

async function refreshQuietly() {
  if (!ME || document.hidden) return;
  if (S.view !== 'dash') return;
  const before = LEDGER.length + PENDING.length;
  const r = await get('/api/bets');
  if (!r.ok) return;
  hydrate(r.body);
  R.renderAll();
  const after = LEDGER.length + PENDING.length;
  /* Only says something when something arrived. A toast every thirty
     seconds saying nothing changed is worse than no toast. */
  if (after > before) {
    toast((after - before) + (after - before === 1 ? ' bet' : ' bets') + ' arrived from Telegram');
  }
}

function startLive() {
  if (liveTimer) return;
  liveTimer = setInterval(refreshQuietly, LIVE_MS);
  /* Coming back to the tab beats waiting out the interval. */
  addEventListener('visibilitychange', () => { if (!document.hidden) refreshQuietly(); });
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
