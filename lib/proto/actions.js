/* WHAT THE BUTTONS ACTUALLY DO.
 *
 * The render layer marks every action with `data-toast`, and the prototype's
 * handler showed that message and did nothing. Ninety one of them, including
 * "Delete everything", "Reset everything", "Cancel my plan" and "Card
 * updated".
 *
 * A control that looks like it deletes your account and silently does
 * nothing is worse than one that admits it is not ready. So the handler no
 * longer trusts `data-toast`. It looks the action up here first:
 *
 *   a function  ->  run it, and report what actually happened
 *   NOT_BUILT   ->  say so plainly, and never claim it worked
 *   absent      ->  treat as not built, because an action nobody has
 *                   classified is an action nobody has implemented
 *
 * Matching is on the toast string, which is the only stable identifier the
 * prototype gives each control, normalised so an interpolated one still
 * matches its family.
 */
import { save } from './store.js';

export const NOT_BUILT = Symbol('not built');

/** Collapse `${...}` interpolation and case so one entry covers a family. */
export const key = (toast) =>
  String(toast || '')
    .replace(/\$\{[^}]*\}/g, '*')
    .trim()
    .toLowerCase();

const deleteSelected = (ctx) =>
  api('/api/bets', { method: 'DELETE', body: JSON.stringify({ ids: ctx.read('selectedBets') || [] }) });

async function api(path, init) {
  try {
    const r = await fetch(path, {
      credentials: 'same-origin',
      headers: init && init.body ? { 'content-type': 'application/json' } : undefined,
      ...init,
    });
    const body = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, body };
  } catch {
    /* Offline is a state this product draws rather than an error to throw. */
    return { ok: false, status: 0, body: { error: 'You appear to be offline. Nothing was sent.' } };
  }
}

/* A preference: applied at once so the interface responds, written to the
   account if there is one, and kept locally either way. The local write is
   what makes it survive for somebody who has not signed up. */
function preference(patch, ctx) {
  Object.assign(ctx.cur, patch);
  save(ctx.cur);
  ctx.repaint();
  /* Fire and forget on purpose: a preference must not wait on a round trip
     to take effect, and a failure here costs nothing this session. */
  api('/api/settings', { method: 'PATCH', body: JSON.stringify(patch) });
  return null;   // the layer's own toast text is already right
}

/* Destructive actions confirm by being undoable for four seconds rather than
   by a dialogue, which is what the spec asks for everywhere except deleting
   an account. The undo is real: the request is held, not sent and reversed. */
function deferred(run, message) {
  return (ctx) => {
    ctx.holdUndo(run, message);
    return null;
  };
}

export const ACTIONS = {
  /* ---- preferences ---------------------------------------------------- */
  'custom range applied': (ctx) => preference({ per: 'custom' }, ctx),
  'sorted by *': (ctx) => { ctx.repaint(); return null; },
  'filters cleared': (ctx) => { ctx.cur.filters = {}; ctx.repaint(); return null; },
  'filters applied': (ctx) => { ctx.repaint(); return null; },
  'target saved': (ctx) => preference({ target: ctx.read('target') }, ctx),
  'bankroll saved': (ctx) => preference({ bankroll: ctx.read('bankroll') }, ctx),
  'unit set': (ctx) => preference({ unit: ctx.read('unit') }, ctx),

  /* ---- deployed routes ------------------------------------------------ */
  'logged out': async () => {
    await api('/api/auth/logout', { method: 'POST' });
    location.href = '/';
    return null;
  },
  'signed out': async () => {
    await api('/api/auth/logout', { method: 'POST' });
    location.href = '/';
    return null;
  },
  'signed out everywhere else': async () => {
    const r = await api('/api/auth/sessions', { method: 'DELETE' });
    return r.ok ? 'Signed out on every other device.' : r.body.error;
  },
  'code resent': async (ctx) => {
    const r = await api('/api/auth/resend', { method: 'POST', body: JSON.stringify({ email: ctx.cur.email || '' }) });
    return r.ok ? 'Code resent.' : r.body.error;
  },
  'code sent': async (ctx) => {
    const r = await api('/api/auth/resend', { method: 'POST', body: JSON.stringify({ email: ctx.read('email') }) });
    return r.ok ? 'If that address has an account, a code is on its way.' : r.body.error;
  },
  'password change email sent': async () => {
    const r = await api('/api/auth/password', { method: 'POST' });
    return r.ok ? 'Check your email for the link.' : r.body.error;
  },
  'downloading…': (ctx) => {
    /* A real file, from a route that works in read only and after
       cancelling, because a betting record belongs to whoever kept it. */
    location.href = '/api/export?format=' + (ctx.read('exportFormat') || 'csv');
    return 'Your export is downloading.';
  },
  'slip images deleted': deferred(
    () => api('/api/slips', { method: 'DELETE' }),
    'Slip images deleted.',
  ),
  'bet deleted': deferred(
    (ctx) => api('/api/bets/' + ctx.read('betId'), { method: 'DELETE' }),
    'Bet deleted.',
  ),
  /* The label is written by the prototype with a sample count in it, so both
     the literal and the interpolated form reach the same action. */
  '3 bets deleted': deferred(deleteSelected, 'Bets deleted.'),
  '* bets deleted': deferred(deleteSelected, 'Bets deleted.'),

  /* ---- the rest of the destructive set -------------------------------- */
  'pair removed': deferred(
    (ctx) => api('/api/bets/' + ctx.read('betId'), {
      method: 'PATCH', body: JSON.stringify({ arbGroupId: null }),
    }),
    'Pair removed. Both bets stay in the ledger.',
  ),
  'removed from *': deferred(
    (ctx) => api('/api/reference?kind=markets&id=' + ctx.read('rowId'), { method: 'DELETE' }),
    'Removed.',
  ),
  '* removed': deferred(
    (ctx) => api('/api/reference?kind=bookmakers&id=' + ctx.read('rowId'), { method: 'DELETE' }),
    'Removed.',
  ),
  'tipster deleted, 21 bets moved': deferred(
    (ctx) => api('/api/reference?kind=tipsters&id=' + ctx.read('rowId'), { method: 'DELETE' }),
    'Tipster deleted. Their bets stay in the ledger.',
  ),
  'group deleted': deferred(
    (ctx) => api('/api/groups?id=' + ctx.read('groupId'), { method: 'DELETE' }),
    'Group deleted. Nobody\'s bets are touched.',
  ),
  /* Billing. The portal is Stripe's own, so cancelling happens there rather
     than through a button here that claims it did. */
  cancelled: async () => {
    const r = await api('/api/stripe/portal', { method: 'POST' });
    if (r.ok && r.body.url) { location.href = r.body.url; return null; }
    return r.body.error || 'Could not open billing just now.';
  },
  'unlinked': deferred(
    () => api('/api/telegram/link', { method: 'DELETE' }),
    'Telegram unlinked. Your bets are untouched.',
  ),
  'new code slip-9m3x': async () => {
    const r = await api('/api/telegram/link', { method: 'POST' });
    return r.ok ? 'New code ' + r.body.linkCode : r.body.error;
  },
  'copied': () => 'Copied.',
  'copied to clipboard': () => 'Copied.',
  'account reset': deferred(
    () => api('/api/account', { method: 'POST', body: JSON.stringify({ action: 'reset' }) }),
    'Account reset. Your bets are gone, your account is not.',
  ),
  /* The one exception to undo-instead-of-confirm, as specified: deleting an
     account keeps its confirm sheet, so this runs immediately. */
  deleted: async () => {
    const r = await api('/api/account', { method: 'DELETE' });
    if (r.ok) { location.href = '/'; return null; }
    return r.body.error;
  },
};

/* THINGS THE BROWSER CAN ALREADY DO.
 *
 * Each of these was on the not-built list until it was looked at properly.
 * None of them needed a route: the platform provides the capability and the
 * only work was asking for it and being honest when it is refused. */

ACTIONS['google sign-up'] = () => {
  /* The OAuth route has existed since auth was built, state parameter and
     all. This control was never wired to it, which is the whole reason the
     table exists. If the deployment has no client id the route says so. */
  location.href = '/api/auth/google';
  return null;
};

ACTIONS['link copied'] = async (ctx) => {
  const url = location.origin + '/?r=' + encodeURIComponent(ctx.read('referralCode') || '');
  /* Share first on a phone, because the sheet is what somebody expects and
     it can reach WhatsApp, which a clipboard cannot. */
  if (navigator.share) {
    try { await navigator.share({ title: 'Slippery', text: 'Track your bets honestly.', url }); return null; }
    catch (e) { if (e && e.name === 'AbortError') return false; }
  }
  const copied = await copyText(url);
  return copied ? null : 'Could not reach the clipboard. The link is ' + url;
};

ACTIONS['opening your mail app'] = () => {
  /* A mailto is the honest version of a contact form: it hands the message
     to something the person already trusts, and it works with no server. */
  location.href = 'mailto:hello@slippery.app?subject=' + encodeURIComponent('Slippery support');
  return null;
};

ACTIONS['choose screenshots to import'] = (ctx) => {
  const input = ctx.root.querySelector('input[type=file][data-slipinput]');
  if (!input) return 'The picker is not on this screen.';
  input.click();
  return false;   /* nothing has happened yet; the picker reports its own result */
};

ACTIONS['downloaded'] = async (ctx) => {
  const blob = await shareCard(ctx);
  if (!blob) return 'Could not draw the card on this device.';
  return saveBlob(blob, 'slippery-' + new Date().toISOString().slice(0, 10) + '.png')
    ? null : 'Your browser would not accept the download.';
};

const emailExport = async (format) => {
  const r = await api('/api/export/email', { method: 'POST', body: JSON.stringify({ format }) });
  if (r.ok) return null;
  return r.body.error;
};
ACTIONS['copy sent to your email'] = () => emailExport('csv');
ACTIONS['sent with the figures attached'] = () => emailExport('csv');

/* Clipboard access is refused outright in more places than people expect:
   an insecure origin, a Safari gesture the browser did not believe, an
   embedded webview. The fallback is the oldest trick there is and it still
   works everywhere the modern API does not. */
async function copyText(text) {
  try {
    if (navigator.clipboard && isSecureContext) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* fall through */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    const done = document.execCommand('copy');
    ta.remove();
    return done;
  } catch { return false; }
}

/* THE SHARE CARD IS DRAWN, NOT SCREENSHOTTED.
 *
 * Rasterising the live DOM would need a library, would inherit whichever
 * theme happens to be on, and would carry the tab bar into the picture.
 * Drawing it means the card is the same 1200x630 everywhere, reads on a
 * white timeline as well as a dark one, and states the period so a figure
 * can never be quoted without the window it covers. */
async function shareCard(ctx) {
  const cur = ctx.cur;
  const c = document.createElement('canvas');
  c.width = 1200; c.height = 630;
  const g = c.getContext('2d');
  if (!g) return null;

  const css = getComputedStyle(document.documentElement);
  const tok = (n, fallback) => (css.getPropertyValue(n).trim() || fallback);

  g.fillStyle = tok('--bg', '#0B0B0C');
  g.fillRect(0, 0, 1200, 630);
  g.strokeStyle = tok('--line', '#2A2A2E');
  g.lineWidth = 2;
  g.strokeRect(24, 24, 1152, 582);

  const net = Number(ctx.read('netPence') || 0) / 100;
  const up = net >= 0;
  const ui = tok('--ui', 'system-ui');

  g.fillStyle = tok('--t3', '#8A8A92');
  g.font = '500 26px ' + ui;
  g.fillText(String(ctx.read('periodLabel') || 'All time').toUpperCase(), 80, 140);

  /* The two semantic colours, never the theme accent. */
  g.fillStyle = up ? '#86EFAC' : '#FCA5A5';
  g.font = '700 132px ' + tok('--mono', 'ui-monospace');
  g.fillText((up ? '+' : '−') + '£' + Math.abs(net).toFixed(2), 80, 290);

  g.fillStyle = tok('--t2', '#C9C9D1');
  g.font = '500 34px ' + ui;
  g.fillText(String(ctx.read('recordLine') || ''), 80, 366);

  g.fillStyle = tok('--t4', '#6A6A72');
  g.font = '500 24px ' + ui;
  g.fillText('Every bet logged at placement, not at settlement.', 80, 540);
  g.fillStyle = tok('--t2', '#C9C9D1');
  g.font = '700 30px ' + ui;
  g.fillText('Slippery', 80, 480);

  return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
}

function saveBlob(blob, name) {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    /* Revoked on the next turn: revoking synchronously cancels the download
       in Safari, which starts reading the blob after the click returns. */
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return true;
  } catch { return false; }
}

/* WHAT IS STILL GENUINELY ABSENT, and why each one is not a small job.
 *
 *   the two store badges  there is no app, so there is nothing to link to
 *   avatar upload         needs somewhere to put the file and a column to
 *                         remember it by; slip images have both, faces do not
 *   group challenges      needs a table, a settlement hook and a rule for
 *                         what happens when a member leaves mid-challenge
 *
 * Named rather than left to fall through, so the difference between "not
 * implemented yet" and "nobody has looked at this" stays visible here. */
for (const k of [
  'coming soon to the app store',
  'coming soon to google play',
  'choose a picture',
  'image saved',
  'challenge set',
]) ACTIONS[k] = NOT_BUILT;
