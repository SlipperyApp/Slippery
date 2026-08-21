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

/* Everything the audit marks as genuinely absent. Named rather than left to
   fall through, so the difference between "not implemented yet" and "nobody
   has looked at this" stays visible in the source. */
for (const k of [
  'coming soon to the app store',
  'coming soon to google play',
  'choose a picture',
  'image saved',
  'downloaded',
  'choose screenshots to import',
  'challenge set',
  'google sign-up',
  'link copied',
  'sent with the figures attached',
  'copy sent to your email',
  'opening your mail app',
]) ACTIONS[k] = NOT_BUILT;
