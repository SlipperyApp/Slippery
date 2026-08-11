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
/* There is no demo mode any more.
   Signup used to fake an account when the API reported no database — it
   accepted 000000 as a verification code and opened a dashboard. That is
   the one thing this product cannot do: an account that does not exist,
   holding bets that are not saved, is worse than an honest refusal. When
   the backend is not connected the flow stops and says which variable is
   missing. */

const ERR_FIELD = {
  suEmail: 'suEmail', suPw: 'suPw', suPw2: 'suPw2', suName: 'suName',
  ageOk: 'ageOk', liEmail: 'liEmail', liPw: 'liPw', verify: 'verifyCode'
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

/* 12 characters, not 8. NCSC guidance and every modern list put length
   ahead of composition, and 8 with a capital and a symbol is trivially
   crackable offline. */
export const PW_RULES = {
  len: v => v.length >= 12,
  cap: v => /[A-Z]/.test(v),
  sym: v => /[^A-Za-z0-9]/.test(v)
};
export function passwordProblem(v) {
  v = v || '';
  if (!v) return 'Create a password.';
  const missing = [];
  if (!PW_RULES.len(v)) missing.push('12 characters');
  if (!PW_RULES.cap(v)) missing.push('a capital letter');
  if (!PW_RULES.sym(v)) missing.push('a special character such as ! or #');
  if (!missing.length) return '';
  return 'Your password still needs ' +
    (missing.length === 1 ? missing[0] : missing.slice(0, -1).join(', ') + ' and ' + missing[missing.length - 1]) + '.';
}
function paintPwRules() {
  const v = $('suPw').value;
  let all = true;
  $$('#pwRules li').forEach(li => {
    const ok = PW_RULES[li.getAttribute('data-rule')](v);
    li.classList.toggle('met', ok);
    if (!ok) all = false;
  });
  return all && v.length > 0;
}

export function nameProblem(v) {
  v = (v || '').trim();
  if (!v) return 'Choose a display name.';
  if (v.length < 3) return 'That is a bit short. Use three characters or more.';
  if (v.length > 20) return 'That is over 20 characters. Shorten it a little.';
  if (!/^[A-Za-z0-9_]+$/.test(v)) return 'Use letters, numbers and underscores only.';
  return '';
}

export function setMode(m) {
  mode = m;
  $$('#authSeg button').forEach(b => {
    const on = b.getAttribute('data-auth') === m;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
  });
  paintSeg($('authSeg'));
  $('authSignup').hidden = m !== 'up';
  $('authLogin').hidden = m !== 'in';
  $('authGo').textContent = m === 'up' ? 'Continue' : 'Log in';
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
    email, password: $('suPw').value, name, ageConfirmed: true
  });
  btn.disabled = false;
  btn.textContent = 'Continue';

  if (status === 503) { showNotConnected('suEmail', body); $('suEmail').focus(); return; }
  if (!ok) {
    /* Uniqueness comes back from the database constraint, so the message
       is authoritative rather than a guess made a moment earlier. */
    if (body.field === 'email') { showError('suEmail', body.error); $('suEmail').focus(); return; }
    if (body.field === 'name') { showError('suName', body.error); $('suName').focus(); return; }
    toast(body.error || 'Could not create that account.');
    return;
  }
  pendingEmail = email;
  S.name = name;
  $('verifyMail').textContent = email;

  /* No mail provider on this deployment: the server signed the account in
     rather than issuing a code nobody could receive. Skipping the verify
     step is the honest move — asking for a code that was never sent is the
     kind of dead end that makes people think the product is broken. */
  if (body.verified) {
    toast(body.notice || 'Signed in.');
    next(); next();
    return;
  }

  const hint = $('verifyHint');
  hint.hidden = false;
  hint.textContent = 'Check your inbox, and your spam folder if it is not there in a minute.';
  next();
}

async function login(next) {
  const email = $('liEmail').value.trim();
  if (!showError('liEmail', emailProblem(email))) { $('liEmail').focus(); return; }
  if (!showError('liPw', $('liPw').value ? '' : 'Enter your password.')) { $('liPw').focus(); return; }

  const btn = $('authGo');
  btn.disabled = true;
  btn.textContent = 'Logging in…';
  const { ok, status, body } = await post('/api/auth/login', { email, password: $('liPw').value });
  btn.disabled = false;
  btn.textContent = 'Log in';

  if (status === 503) { showNotConnected('liEmail', body); $('liEmail').focus(); return; }
  if (!ok) {
    /* One message for both wrong-email and wrong-password: telling them
       apart tells an attacker which addresses have accounts. */
    showError('liPw', body.error || 'That email and password do not match.');
    $('liPw').focus();
    return;
  }
  S.name = body.name || S.name;
  toast('Welcome back, ' + S.name);
  document.querySelector('[data-nav="dash"]').click();
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
  next();
}

export async function resend() {
  const { ok, body } = await post('/api/auth/resend', { email: pendingEmail });
  toast(ok ? 'New code sent' : (body.error || 'Could not resend just now'));
}

export function forgot() {
  toast('Password reset is not wired up yet');
}

export function handleInput(t) {
  if (t.id === 'suPw') {
    paintPwRules();
    if (!$('suPwErr').hidden && !passwordProblem(t.value)) showError('suPw', '');
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
  if (t.id === 'liEmail') {
    if (!$('liEmailErr').hidden && !emailProblem(t.value)) showError('liEmail', '');
    return true;
  }
  if (t.id === 'liPw') {
    if (!$('liPwErr').hidden && t.value) showError('liPw', '');
    return true;
  }
  if (t.id === 'ageOk') { if (t.checked) showError('ageOk', ''); return true; }
  if (t.id === 'verifyCode') {
    t.value = t.value.replace(/\D/g, '').slice(0, 6);
    if (!$('verifyErr').hidden && t.value.length === 6) showError('verify', '');
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
