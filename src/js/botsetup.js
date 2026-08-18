/* CONNECTING THE BOT, AS A FLOW RATHER THAN A CODE.
 *
 * Everything this needs already existed: the server issues a code, the bot
 * accepts one, the client can poll for the result. What did not exist was a
 * path through it. There was a Settings card with a code on it and a button,
 * and a setup step with the same code and the same button, and neither said
 * what was about to happen, what to do in the other app, or what had gone
 * wrong when nothing did.
 *
 * Four states, one sheet, mounted from three places: the setup wizard, the
 * Settings card, and the last step of the tutorial.
 *
 *   explain    what the bot is for, and a way out. Nobody is made to do
 *              this: forwarding slips is the fast path, not the only one.
 *   code       SLIP-XXXX, large, with a copy button, a live countdown and
 *              the deep link that carries the code so nothing is typed.
 *   waiting    the poll, shown as a real state rather than as silence.
 *              Linking happens in another app; there is no event to listen
 *              for, so this is honest about waiting and offers a re-check.
 *   done       who it linked to, and the way on.
 *
 * Errors render in place, in the server's own words. The bot already
 * distinguishes five failure modes — code used, expired, this chat is on
 * another account, this account is on another chat, no match — and losing
 * that detail to a generic toast was throwing away the only thing that
 * tells somebody what to do next.
 */
import { $, $$, esc, toast, trapFocus, setText, setHTML, RM } from './dom.js';
import { post, get } from './api.js';

const BOT = 'SlipperyAppBot';
/* Ten checks, six seconds apart. Long enough to switch app, press start and
   come back; short enough that a forgotten tab is not polling for an hour. */
const POLL_EVERY = 6000;
const POLL_TRIES = 10;

let poll = null;
let tick = null;
let release = null;
let expiresAt = 0;
let onDone = null;

/**
 * Open the flow.
 * @param {{onDone?:function, skippable?:boolean}} [opts]
 */
export function openBotSetup(opts) {
  const el = $('botSheet');
  if (!el) return;
  onDone = (opts && opts.onDone) || null;
  el.dataset.skippable = opts && opts.skippable === false ? '' : '1';
  show('explain');
  el.classList.add('on');
  $('scrim').classList.add('on');
  release = trapFocus(el);
  const first = el.querySelector('button');
  if (first) first.focus();
}

export function closeBotSetup(finished) {
  const el = $('botSheet');
  if (!el) return;
  stop();
  el.classList.remove('on');
  $('scrim').classList.remove('on');
  if (release) { release(); release = null; }
  const done = onDone;
  onDone = null;
  if (finished && done) done();
}

/** True while the sheet is up, so the scrim knows whose it is. */
export const botSetupOpen = () => {
  const el = $('botSheet');
  return Boolean(el && el.classList.contains('on'));
};

/* ---------------- states ---------------- */

function show(state) {
  const el = $('botSheet');
  if (!el) return;
  el.dataset.state = state;
  $$('[data-botstate]', el).forEach(p => {
    p.hidden = p.getAttribute('data-botstate') !== state;
  });
  const skip = $('botSkip');
  if (skip) skip.hidden = state === 'done' || !el.dataset.skippable;
  /* Announced rather than only shown: the sheet does not move focus
     between states, because the buttons are in the same place and moving
     it would interrupt a screen reader mid-sentence. */
  const live = $('botLive');
  if (live) live.textContent = ANNOUNCE[state] || '';
}

const ANNOUNCE = {
  explain: 'Connect Telegram. Step one of three.',
  code: 'Your code is ready. Open Telegram to send it.',
  waiting: 'Waiting for Telegram to confirm.',
  done: 'Telegram connected.'
};

function fail(msg) {
  const el = $('botErr');
  if (!el) return;
  el.hidden = !msg;
  el.textContent = msg || '';
}

/* ---------------- the code ---------------- */

/** Ask the server for a code. The browser never picks one: a code the
    browser chooses is a code the browser can choose to be somebody else's. */
export async function issueCode(btn) {
  fail('');
  if (btn) { btn.disabled = true; btn.textContent = 'Getting a code…'; }
  const r = await post('/api/auth/link', { action: 'new' });
  if (btn) { btn.disabled = false; btn.textContent = 'Get a code'; }

  if (r.status === 401) { closeBotSetup(false); toast('Log in first.'); return null; }
  if (!r.ok) { fail(r.body.error || 'Could not get a code just now. Try again.'); return null; }

  paintCode(r.body.linkCode, r.body.linkCodeExpiresAt, r.body.ttlMs);
  show('code');
  return r.body.linkCode;
}

function paintCode(code, iso, ttlMs) {
  setText('botCode', code || '');
  expiresAt = iso ? Date.parse(iso) : Date.now() + (ttlMs || 600000);
  paintCountdown();
  if (tick) clearInterval(tick);
  tick = setInterval(paintCountdown, 1000);
  const open = $('botOpen');
  if (open) open.dataset.href = 'https://t.me/' + BOT + '?start=' + encodeURIComponent(code || '');
}

/* A code with ten minutes on it and no visible clock is a code somebody
   types out at minute eleven and is told did not match, with nothing on
   screen having changed. */
function paintCountdown() {
  const el = $('botCountdown');
  if (!el) return;
  const left = Math.max(0, expiresAt - Date.now());
  if (!left) {
    clearInterval(tick); tick = null;
    el.textContent = 'That code has expired.';
    el.classList.add('gone');
    setText('botCode', '••••');
    return;
  }
  el.classList.remove('gone');
  const s = Math.ceil(left / 1000);
  el.textContent = 'Expires in ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

/** Copy, with the confirmation on the button rather than in a toast. */
export async function copyCode(btn) {
  const code = ($('botCode').textContent || '').trim();
  if (!code || /^[•-]+$/.test(code)) return;
  let ok = false;
  try {
    await navigator.clipboard.writeText(code);
    ok = true;
  } catch {
    /* Clipboard access is refused in plenty of ordinary situations, and
       failing silently would leave somebody tapping a button that appears
       to do nothing. Select it instead so a long press can copy. */
    const el = $('botCode');
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  const was = btn.textContent;
  btn.textContent = ok ? 'Copied' : 'Select and copy';
  setTimeout(() => { btn.textContent = was; }, 1600);
}

/** Open Telegram with the code already in the message. */
export function openTelegram(btn) {
  const href = btn && btn.dataset.href;
  if (!href) return;
  /* noopener: without it the opened tab gets a handle on this window. */
  window.open(href, '_blank', 'noopener');
  startWaiting();
}

/* ---------------- waiting ---------------- */

export function startWaiting() {
  show('waiting');
  fail('');
  let tries = 0;
  stopPoll();
  poll = setInterval(async () => {
    tries++;
    const linked = await checkOnce();
    if (linked) return;
    if (tries >= POLL_TRIES) {
      stopPoll();
      /* Giving up is a state, not a silence. The code is still good for as
         long as the clock says, and the message says what to do with it. */
      fail('Nothing has come through yet. The code is still good: send it to the bot, ' +
           'or press Check again.');
    }
  }, POLL_EVERY);
}

/** One look at the server. The bot is the only thing that actually knows. */
export async function checkOnce(btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Checking…'; }
  const r = await get('/api/auth/me');
  if (btn) { btn.disabled = false; btn.textContent = 'Check again'; }
  const user = r.ok && r.body.user;
  if (user && user.telegramLinked) {
    stopPoll();
    setText('botWho', user.telegramUsername ? '@' + user.telegramUsername : 'your Telegram');
    show('done');
    return true;
  }
  if (btn) fail('Not yet. Make sure you pressed Start in Telegram.');
  return false;
}

function stopPoll() { if (poll) { clearInterval(poll); poll = null; } }
function stop() {
  stopPoll();
  if (tick) { clearInterval(tick); tick = null; }
}

/** Back to the code from the waiting screen, without issuing a new one. */
export function showCode() {
  stopPoll();
  fail('');
  show('code');
}

/* The whole flow, from the top, for anywhere that just wants it to happen:
   issue a code and show it, rather than making somebody press twice. */
export async function beginBotSetup(btn) {
  const code = await issueCode(btn);
  if (!code) return;
  /* Reduced motion or not, the code screen is where the useful thing is. */
  if (!RM) requestAnimationFrame(() => { const b = $('botOpen'); if (b) b.focus(); });
}
