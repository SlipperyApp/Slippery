/* Keeping the bot's webhook registered, without anybody handling the token.
 *
 * WHY THIS EXISTS. Registering a Telegram webhook is one call to
 * setWebhook with the bot token in the URL. The token lives in Vercel's
 * environment and must never be read, logged, pasted or committed, which
 * means the one person who can run that curl is the owner, from a machine
 * with the token in front of them. That is a manual step at the end of
 * every deploy that changes the domain, and a manual step nobody
 * remembers is a bot that silently stops answering.
 *
 * So the deployment registers itself. It reads the token from
 * process.env, asks Telegram what the webhook currently is, and only
 * writes when the answer is wrong. Nothing here returns, logs or echoes
 * the token.
 *
 * IDEMPOTENT BY DESIGN. getWebhookInfo first, compare, and write only on a
 * mismatch. A setWebhook on every cron tick would work and would also
 * reset the pending update queue every twenty minutes, which loses
 * messages sent during a redeploy.
 */

const API = token => 'https://api.telegram.org/bot' + token + '/';
const TIMEOUT_MS = 6000;

async function call(token, method, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(API(token) + method, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body || {}),
      signal: ctrl.signal
    });
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The URL Telegram should be posting to.
 *
 * VERCEL_URL is the deployment's own hostname, which is different for
 * every preview build. Pointing the bot at a preview would move it off the
 * stable domain the moment anybody pushed a branch, so the stable host is
 * preferred and VERCEL_URL is only a fallback for a deployment that has no
 * configured one.
 */
export function webhookUrl() {
  const base = process.env.PUBLIC_URL
    || (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL
      : '')
    || (process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : '');
  return base ? base.replace(/\/+$/, '') + '/api/telegram' : '';
}

/**
 * Make sure Telegram is pointed here. Safe to call as often as you like.
 *
 * @returns {Promise<{state:string, url?:string, pending?:number, why?:string}>}
 *   Never includes the token, and never includes the secret.
 */
export async function ensureWebhook() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!token) return { state: 'no-token' };

  const want = webhookUrl();
  if (!want) return { state: 'no-url', why: 'no stable hostname to register' };

  let info;
  try {
    info = await call(token, 'getWebhookInfo');
  } catch (err) {
    return { state: 'unreachable', why: String(err && err.message || err).slice(0, 120) };
  }
  if (!info || !info.ok) {
    /* A bad token answers here with ok:false. Reported as a state rather
       than thrown, because the cron sweep that calls this has real work to
       do and a broken bot must not stop results being settled. */
    return { state: 'rejected', why: (info && info.description || 'unknown').slice(0, 120) };
  }

  const have = info.result || {};
  if (have.url === want) {
    return { state: 'ok', url: want, pending: have.pending_update_count || 0 };
  }

  try {
    const set = await call(token, 'setWebhook', {
      url: want,
      /* Without a secret the webhook URL is guessable and anyone could
         post a forged update, so it is sent when we have one and the
         handler refuses updates that arrive without it. */
      secret_token: secret || undefined,
      allowed_updates: ['message', 'edited_message', 'callback_query'],
      /* False, deliberately. A redeploy would otherwise throw away every
         slip somebody forwarded while it was going out. */
      drop_pending_updates: false
    });
    if (!set || !set.ok) {
      return { state: 'refused', why: (set && set.description || 'unknown').slice(0, 120) };
    }
    return { state: 'registered', url: want, was: have.url || null };
  } catch (err) {
    return { state: 'unreachable', why: String(err && err.message || err).slice(0, 120) };
  }
}

/**
 * What to show on the diagnostics page.
 *
 * Read only: it never registers anything, so loading a status page cannot
 * change where the bot points. It reports the bot's username, which is
 * public and is the one fact somebody needs to test the thing.
 */
export async function webhookStatus() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { configured: false, state: 'no-token' };
  try {
    const [me, info] = await Promise.all([call(token, 'getMe'), call(token, 'getWebhookInfo')]);
    const r = (info && info.result) || {};
    return {
      configured: true,
      bot: me && me.ok && me.result ? '@' + me.result.username : null,
      state: r.url === webhookUrl() ? 'ok' : r.url ? 'elsewhere' : 'unset',
      expected: webhookUrl(),
      /* The registered URL is our own public address, so echoing it leaks
         nothing. The secret and the token are never in this object. */
      registered: r.url || null,
      pending: r.pending_update_count || 0,
      lastError: r.last_error_message ? String(r.last_error_message).slice(0, 160) : null,
      secretSet: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET)
    };
  } catch (err) {
    return { configured: true, state: 'unreachable', why: String(err && err.message || err).slice(0, 120) };
  }
}
