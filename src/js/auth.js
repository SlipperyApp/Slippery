/* Client side of real auth.
 *
 * Validation here is for the user's benefit only. Every rule is enforced
 * again on the server, and uniqueness of email and display name is a
 * database constraint, not a check — see api/_lib/db.js. A client-side
 * "is this taken?" is a race by definition.
 */
import { $, $$, toast, paintSeg } from './dom.js';
import { S } from './state.js';
import { post } from './api.js';

let mode = 'up';
let pendingEmail = '';
let resetSent = false;
/* There is no demo mode any more.
   Signup used to fake an account when the API reported no database — it
   accepted 000000 as a verification code and opened a dashboard. That is
   the one thing this product cannot do: an account that does not exist,
   holding bets that are not saved, is worse than an honest refusal. When
   the backend is not connected the flow stops and says which variable is
   missing. */

/* What to run once a session cookie actually exists.
 *
 * Signing in used to end with a click on the dashboard tab, which went
 * through go() — and go() refuses the app views when it has no user, because
 * it was still holding the signed-out session it read at boot. So a correct
 * password bounced straight back to the signup screen saying "create an
 * account, or log in". Nothing was wrong with the login; the client simply
 * never asked again who it was. main.js installs the re-read here. */
let onSignedIn = async () => {};
export function whenSignedIn(fn) { onSignedIn = fn; }

const ERR_FIELD = {
  suEmail: 'suEmail', suPw: 'suPw', suPw2: 'suPw2', suName: 'suName',
  suPromo: 'suPromo', ageOk: 'ageOk', liUser: 'liUser', liPw: 'liPw',
  verify: 'verifyCode', fgUser: 'fgUser', fgCode: 'fgCode', fgPw: 'fgPw'
};

function showError(key, msg) {
  const err = $(key + 'Err');
  const field = $(ERR_FIELD[key] || key);
  if (!err || !field) return !msg;
  if (msg) {
    err.textContent = msg;
    err.hidden = false;
    field.setAttribute('aria-invalid', 'true');
  } else {
    err.hidden = true;
    err.textContent = '';
    field.removeAttribute('aria-invalid');
  }
  return !msg;
}

/* Long, specific messages beat one generic "invalid email". Each of these
   came from watching someone get stuck on the real thing. */
export function emailProblem(v) {
  v = (v || '').trim();
  if (!v) return 'Enter your email address.';
  if (/\s/.test(v)) return 'An email address cannot contain spaces.';
  if (!v.includes('@')) return 'That is missing an @ sign. An email looks like you@example.com.';
  if (v.split('@').length > 2) return 'That has more than one @ sign.';
  const [local, domain] = v.split('@');
  if (!local) return 'Add the part before the @ sign.';
  if (!domain) return 'Add the part after the @ sign, for example gmail.com.';
  if (!domain.includes('.')) return 'The part after the @ needs a dot, for example gmail.com.';
  if (domain.endsWith('.')) return 'That ends with a dot. Try removing it.';
  if (v.includes('..')) return 'That has two dots in a row.';
  if (domain.split('.').pop().length < 2) return 'The ending looks too short, for example .com or .co.uk.';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) return 'That does not look like a valid email address.';
  if (v.length > 254) return 'That address is too long.';
  return '';
}

/* Either will do to log in with. An @ decides which one it is: display names
   cannot contain one, so the test is exact rather than a guess. */
export function identifierProblem(v) {
  v = (v || '').trim();
  if (!v) return 'Enter your username or email.';
  if (v.includes('@')) return emailProblem(v);
  if (v.length > 254) return 'That is too long to be either.';
  return '';
}

/* Eight characters with a capital and a symbol. Length still does most of
   the work, so the meter keeps saying so — but 12 was turning people away at
   the door for a tracker, not a bank. */
export const PW_RULES = {
  len: v => v.length >= 8,
  cap: v => /[A-Z]/.test(v),
  sym: v => /[^A-Za-z0-9]/.test(v)
};
export function passwordProblem(v) {
  v = v || '';
  if (!v) return 'Create a password.';
  const missing = [];
  if (!PW_RULES.len(v)) missing.push('8 characters');
  if (!PW_RULES.cap(v)) missing.push('a capital letter');
  if (!PW_RULES.sym(v)) missing.push('a special character such as ! or #');
  if (!missing.length) return '';
  return 'Your password still needs ' +
    (missing.length === 1 ? missing[0] : missing.slice(0, -1).join(', ') + ' and ' + missing[missing.length - 1]) + '.';
}
function paintPwRules(listId, value) {
  let all = true;
  $$('#' + listId + ' li').forEach(li => {
    const ok = PW_RULES[li.getAttribute('data-rule')](value);
    li.classList.toggle('met', ok);
    if (!ok) all = false;
  });
  return all && value.length > 0;
}

export function nameProblem(v) {
  v = (v || '').trim();
  if (!v) return 'Choose a display name.';
  if (v.length < 3) return 'That is a bit short. Use three characters or more.';
  if (v.length > 20) return 'That is over 20 characters. Shorten it a little.';
  if (!/^[A-Za-z0-9_]+$/.test(v)) return 'Use letters, numbers and underscores only.';
  return '';
}

const PANELS = { up: 'authSignup', in: 'authLogin', forgot: 'authForgot' };

export function setMode(m) {
  mode = m;
  $$('#authSeg button').forEach(b => {
    /* The segmented control only knows about the two real modes. Reset is
       reached from inside login, so neither button is pressed while it is
       open rather than one of them lying. */
    const on = b.getAttribute('data-auth') === m;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  paintSeg($('authSeg'));
  Object.entries(PANELS).forEach(([k, id]) => { const el = $(id); if (el) el.hidden = k !== m; });
  $('authGo').textContent = m === 'up' ? 'Continue'
    : m === 'in' ? 'Log in'
    : resetSent ? 'Set new password' : 'Send me a code';
}

/* Shown when the API answers 503: the deployment has no database behind it
   yet. Naming the variable turns a dead end into something the owner can
   act on. */
function showNotConnected(target, body) {
  const needs = (body && body.needs || []).join(', ') || 'DATABASE_URL';
  showError(target, 'Accounts are not switched on for this deployment yet (' + needs + ' is not set).');
}

export async function submitStep0(next) {
  if (mode === 'in') return login(next);
  if (mode === 'forgot') return resetFlow(next);
  return signup(next);
}

async function signup(next) {
  const email = $('suEmail').value.trim();
  if (!showError('suEmail', emailProblem(email))) { $('suEmail').focus(); return; }
  if (!showError('suPw', passwordProblem($('suPw').value))) { $('suPw').focus(); return; }
  const pw2 = $('suPw2').value;
  if (!showError('suPw2', !pw2 ? 'Type your password again.'
      : pw2 !== $('suPw').value ? 'The two passwords do not match.' : '')) { $('suPw2').focus(); return; }
  const name = $('suName').value.trim();
  if (!showError('suName', nameProblem(name))) { $('suName').focus(); return; }
  if (!showError('ageOk', $('ageOk').checked ? '' : 'You must confirm you are 18 or over.')) {
    $('ageOk').focus(); return;
  }

  const btn = $('authGo');
  btn.disabled = true;
  btn.textContent = 'Creating…';
  const { ok, status, body } = await post('/api/auth/signup', {
    email, password: $('suPw').value, name, ageConfirmed: true,
    promo: $('suPromo') ? $('suPromo').value.trim() : ''
  });
  btn.disabled = false;
  btn.textContent = 'Continue';

  if (status === 503) { showNotConnected('suEmail', body); $('suEmail').focus(); return; }
  if (!ok) {
    /* Uniqueness comes back from the database constraint, so the message
       is authoritative rather than a guess made a moment earlier. */
    if (body.field === 'email') { showError('suEmail', body.error); $('suEmail').focus(); return; }
    if (body.field === 'name') { showError('suName', body.error); $('suName').focus(); return; }
    if (body.field === 'promo') { showError('suPromo', body.error); $('suPromo').focus(); return; }
    toast(body.error || 'Could not create that account.');
    return;
  }
  pendingEmail = email;
  S.name = name;
  if (body.plan) S.plan = body.plan;
  $('verifyMail').textContent = email;
  if (body.grant) toast(body.grant.label + ' applied');

  /* No mail provider on this deployment, or the send failed: the server
     signed the account in rather than issuing a code nobody could receive.
     Skipping the verify step is the honest move — asking for a code that was
     never sent is the kind of dead end that makes people think the product
     is broken. */
  if (body.verified) {
    toast(body.notice || 'Signed in.');
    await onSignedIn();
    next(); next();
    return;
  }

  const hint = $('verifyHint');
  hint.hidden = false;
  hint.textContent = 'Check your inbox, and your spam folder if it is not there in a minute.';
  next();
}

async function login() {
  const identifier = $('liUser').value.trim();
  if (!showError('liUser', identifierProblem(identifier))) { $('liUser').focus(); return; }
  if (!showError('liPw', $('liPw').value ? '' : 'Enter your password.')) { $('liPw').focus(); return; }

  const btn = $('authGo');
  btn.disabled = true;
  btn.textContent = 'Logging in…';
  const { ok, status, body } = await post('/api/auth/login', { identifier, password: $('liPw').value });
  btn.disabled = false;
  btn.textContent = 'Log in';

  if (status === 503) { showNotConnected('liUser', body); $('liUser').focus(); return; }
  if (status === 403 && body.needsVerification) {
    /* The account is real and the password was right; only the address is
       unproven. Send them to the code screen with the email already in hand
       rather than to a generic failure. */
    pendingEmail = body.email || '';
    $('verifyMail').textContent = pendingEmail || 'your inbox';
    toast('Verify your email to finish signing in');
    await resend();
    return;
  }
  if (!ok) {
    /* One message for both wrong-name and wrong-password: telling them
       apart tells an attacker which accounts exist. */
    showError('liPw', body.error || 'That username and password do not match.');
    $('liPw').focus();
    return;
  }
  S.name = body.name || S.name;
  toast('Welcome back, ' + S.name);
  /* Re-read the session before navigating, or the dashboard bounces us
     straight back here. */
  await onSignedIn();
}

export async function submitVerify(next) {
  const code = $('verifyCode').value.trim();
  const problem = !code ? 'Enter the six digit code.'
    : !/^\d{6}$/.test(code) ? 'The code is six digits.' : '';
  if (!showError('verify', problem)) { $('verifyCode').focus(); return; }

  const { ok, body } = await post('/api/auth/verify', { email: pendingEmail, code });
  if (!ok) {
    showError('verify', body.error || 'That code is not right. Check the email or resend it.');
    $('verifyCode').focus();
    return;
  }
  toast('Email verified');
  /* Verifying signs you in, so the client has to notice that it now has a
     session before anything tries to open the app. */
  await onSignedIn(true);
  next();
}

export async function resend() {
  const { ok, body } = await post('/api/auth/resend', { email: pendingEmail });
  toast(ok ? 'New code sent' : (body.error || 'Could not resend just now'));
}

/* ---- password reset ----
   Two submits through the same button: ask for a code, then set the new
   password with it. Kept on one panel because the account being reset is
   the context, and moving to another screen is where people lose it. */
export function forgot() {
  resetSent = false;
  $('forgotSecond').hidden = true;
  $('forgotNotice').hidden = true;
  const from = $('liUser').value.trim();
  if (from) $('fgUser').value = from;
  setMode('forgot');
  $('fgUser').focus();
}

export function backToLogin() {
  resetSent = false;
  setMode('in');
}

async function resetFlow() {
  const btn = $('authGo');
  const identifier = $('fgUser').value.trim();
  if (!showError('fgUser', identifierProblem(identifier))) { $('fgUser').focus(); return; }

  if (!resetSent) {
    btn.disabled = true;
    btn.textContent = 'Sending…';
    const { ok, status, body } = await post('/api/auth/forgot', { identifier });
    btn.disabled = false;

    if (status === 503) {
      setMode('forgot');
      showError('fgUser', body.error || 'Password reset is not switched on for this deployment yet.');
      return;
    }
    if (!ok) { setMode('forgot'); showError('fgUser', body.error || 'Could not start a reset.'); return; }

    resetSent = true;
    $('forgotSecond').hidden = false;
    const notice = $('forgotNotice');
    notice.hidden = false;
    /* The same wording whether or not the account exists — the server
       answers identically on purpose, and a client that said "sent!" only
       for real accounts would give the whole thing away. */
    notice.textContent = body.message || 'If that account exists, a code is on its way.';
    setMode('forgot');
    $('fgCode').focus();
    return;
  }

  const code = $('fgCode').value.trim();
  if (!showError('fgCode', /^\d{6}$/.test(code) ? '' : 'The code is six digits.')) { $('fgCode').focus(); return; }
  const password = $('fgPw').value;
  if (!showError('fgPw', passwordProblem(password))) { $('fgPw').focus(); return; }

  btn.disabled = true;
  btn.textContent = 'Saving…';
  const { ok, body } = await post('/api/auth/reset', { identifier, code, password });
  btn.disabled = false;
  setMode('forgot');

  if (!ok) {
    showError(body.field === 'password' ? 'fgPw' : 'fgCode',
      body.error || 'That code is not right.');
    return;
  }
  S.name = body.name || S.name;
  resetSent = false;
  toast('Password changed. You are signed in.');
  await onSignedIn();
}

export function handleInput(t) {
  if (t.id === 'suPw') {
    paintPwRules('pwRules', t.value);
    if (!$('suPwErr').hidden && !passwordProblem(t.value)) showError('suPw', '');
    return true;
  }
  if (t.id === 'fgPw') {
    paintPwRules('fgPwRules', t.value);
    if (!$('fgPwErr').hidden && !passwordProblem(t.value)) showError('fgPw', '');
    return true;
  }
  if (t.id === 'suEmail') {
    if (!$('suEmailErr').hidden && !emailProblem(t.value)) showError('suEmail', '');
    return true;
  }
  if (t.id === 'suPw2') {
    if (!$('suPw2Err').hidden && t.value === $('suPw').value) showError('suPw2', '');
    return true;
  }
  if (t.id === 'liUser' || t.id === 'fgUser') {
    const key = t.id;
    if (!$(key + 'Err').hidden && !identifierProblem(t.value)) showError(key, '');
    return true;
  }
  if (t.id === 'liPw') {
    if (!$('liPwErr').hidden && t.value) showError('liPw', '');
    return true;
  }
  if (t.id === 'ageOk') { if (t.checked) showError('ageOk', ''); return true; }
  if (t.id === 'verifyCode' || t.id === 'fgCode') {
    t.value = t.value.replace(/\D/g, '').slice(0, 6);
    const key = t.id === 'fgCode' ? 'fgCode' : 'verify';
    if (!$(key + 'Err').hidden && t.value.length === 6) showError(key, '');
    return true;
  }
  if (t.id === 'suPromo') {
    /* Codes are handed out on screenshots and typed back with whatever
       spacing and case people feel like. Fold it as they type so the field
       shows exactly what will be sent. */
    t.value = t.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!$('suPromoErr').hidden) showError('suPromo', '');
    const status = $('promoStatus');
    if (status) {
      status.textContent = t.value
        ? 'Checked when you continue.'
        : 'Leave it blank if you do not have one.';
      status.className = 'stepnote';
    }
    return true;
  }
  if (t.id === 'planPromo' || t.id === 'payPromo') {
    t.value = t.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return true;
  }
  if (t.id === 'suName') {
    const v = t.value.trim();
    const status = $('nameStatus');
    if (!$('suNameErr').hidden) showError('suName', '');
    const problem = nameProblem(v);
    if (!v) { status.textContent = 'Three characters or more, letters and numbers.'; status.className = 'stepnote'; }
    else if (problem) { status.textContent = problem; status.className = 'stepnote neg'; }
    else { status.textContent = v + ' looks good, and is permanent once you finish.'; status.className = 'stepnote pos'; }
    return true;
  }
  return false;
}

export function init() { setMode('up'); }
