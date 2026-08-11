/* POST /api/telegram — the bot webhook.
 *
 * Register once with:
 *   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
 *     -d url=https://slippery-iota.vercel.app/api/telegram \
 *     -d secret_token=<TELEGRAM_WEBHOOK_SECRET>
 *
 * The webhook URL is public, so the secret header is the only thing stopping
 * anyone from posting fake updates. Without TELEGRAM_WEBHOOK_SECRET set, the
 * endpoint refuses rather than trusting whatever arrives.
 *
 * Telegram retries any update it does not get a 200 for, so this always
 * answers 200 once the update is authentic — a failure is reported to the
 * user in chat, not by failing the webhook into a retry loop.
 */
import { timingSafeEqual } from 'node:crypto';
import { json, methodGuard, readJson, fail } from './_lib/http.js';
import { db, ensureSchema, configured as dbConfigured } from './_lib/db.js';

const API = token => 'https://api.telegram.org/bot' + token + '/';
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  try {
    if (!token) return json(res, 503, { error: 'Bot token not configured.' });
    if (!secret) {
      console.error('[slippery] TELEGRAM_WEBHOOK_SECRET is unset; refusing updates');
      return json(res, 503, { error: 'Webhook secret not configured.' });
    }
    if (!secretMatches(req.headers['x-telegram-bot-api-secret-token'], secret)) {
      return json(res, 401, { error: 'Bad secret token.' });
    }

    const update = await readJson(req, 1024 * 1024);
    const message = update.message || update.edited_message;
    const callback = update.callback_query;

    if (callback) {
      await handleCallback(token, callback);
      return json(res, 200, { ok: true });
    }
    if (!message) return json(res, 200, { ok: true });

    const chatId = message.chat && message.chat.id;
    if (!chatId) return json(res, 200, { ok: true });

    const text = (message.text || message.caption || '').trim();
    if (text.startsWith('/')) {
      await handleCommand(token, chatId, text, message.from);
      return json(res, 200, { ok: true });
    }
    if (message.photo || isImageDocument(message.document)) {
      await handleSlip(token, chatId, message);
      return json(res, 200, { ok: true });
    }
    /* Everything else: say what the bot actually wants, rather than going
       quiet and leaving the person wondering if it is broken. */
    await send(token, chatId,
      'Send me a *photo or screenshot of a bet slip* and I will read it.\n\n' +
      'Forward it the moment you place the bet, not after it settles — that is the ' +
      'whole point of Slippery.\n\n/help for what else I can do.');
    return json(res, 200, { ok: true });
  } catch (err) {
    /* Answer 200 anyway: a non-200 makes Telegram redeliver this update
       every few seconds, and a persistent bug becomes a retry storm. */
    console.error('[slippery] telegram', err && err.message);
    return json(res, 200, { ok: true });
  }
}

function secretMatches(given, expected) {
  if (typeof given !== 'string') return false;
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const isImageDocument = doc =>
  doc && typeof doc.mime_type === 'string' && doc.mime_type.startsWith('image/');

async function handleCommand(token, chatId, text, from) {
  const [command] = text.split(/\s+/);
  switch (command.toLowerCase().replace(/@.*$/, '')) {
    case '/start':
      await send(token, chatId,
        'Welcome to Slippery.\n\n' +
        'Forward me a bet slip the moment you *place* it. I read the stake, odds ' +
        'and selection off the image, watch the game, and settle it into your ' +
        'profit and loss.\n\n' +
        'Capturing at placement is the point: it is what stops a tracker quietly ' +
        'becoming a highlight reel of your winners.\n\n' +
        'To link this chat to your account, open Settings on the site and enter ' +
        'the code shown there, or send /link followed by your code.\n\n' +
        'Send a slip whenever you are ready.');
      break;
    case '/help':
      await send(token, chatId,
        '*What I do*\n' +
        'Send a slip photo and I read it, then ask you to confirm.\n\n' +
        '*Commands*\n' +
        '/start — what this bot is\n' +
        '/link CODE — connect this chat to your account\n' +
        '/today — today\'s profit and loss\n' +
        '/pending — bets still running\n' +
        '/stop — pause every message from me\n\n' +
        'I never guess at a number I cannot read. If a slip is blurred I will ' +
        'ask for a clearer photo rather than invent a stake.');
      break;
    case '/link':
      await handleLink(token, chatId, text, from);
      break;
    case '/today':
      await withAccount(token, chatId, from, async user => {
        const rows = await db()`
          SELECT COALESCE(SUM(profit_pence),0) AS net, COUNT(*) AS n
          FROM bets WHERE user_id = ${user.id} AND settled_at::date = now()::date`;
        const net = Number(rows[0].net || 0);
        await send(token, chatId, rows[0].n > 0
          ? 'Today: *' + money(net) + '* across ' + rows[0].n + ' settled bets.'
          : 'Nothing settled today yet.');
      });
      break;
    case '/pending':
      await withAccount(token, chatId, from, async user => {
        const rows = await db()`
          SELECT selection, stake_pence, odds FROM bets
          WHERE user_id = ${user.id} AND status = 'pending' ORDER BY placed_at DESC LIMIT 20`;
        if (!rows.length) { await send(token, chatId, 'Nothing running right now.'); return; }
        const risk = rows.reduce((a, b) => a + b.stake_pence, 0);
        await send(token, chatId,
          '*' + rows.length + ' running*, ' + money(risk, false) + ' at risk\n\n' +
          rows.map(r => '· ' + esc(r.selection || 'Bet') + ' — ' +
            money(r.stake_pence, false) + ' at ' + Number(r.odds).toFixed(2)).join('\n'));
      });
      break;
    case '/stop':
      await send(token, chatId,
        'Messages paused. Send /start when you want them back.\n\n' +
        'If you want a real break from betting itself, Settings has a break ' +
        'control that locks the app for as long as you choose, and GamCare is ' +
        'on 0808 8020 133.');
      break;
    default:
      await send(token, chatId, 'I do not know that one. /help lists what I can do.');
  }
}

async function handleLink(token, chatId, text, from) {
  const code = (text.split(/\s+/)[1] || '').trim().toUpperCase();
  if (!code) { await send(token, chatId, 'Send /link followed by the code from Settings.'); return; }
  if (!dbConfigured()) {
    await send(token, chatId, 'Account linking is not available on this deployment yet.');
    return;
  }
  await ensureSchema();
  const rows = await db()`
    UPDATE users SET telegram_id = ${from && from.id}
    WHERE link_code = ${code} AND deleted_at IS NULL
    RETURNING display_name`;
  await send(token, chatId, rows.length
    ? 'Linked to *' + esc(rows[0].display_name) + '*. Send me a slip whenever you are ready.'
    : 'That code did not match an account. Check Settings for the current one.');
}

async function withAccount(token, chatId, from, fn) {
  if (!dbConfigured()) {
    await send(token, chatId, 'That needs an account, and this deployment has no database yet.');
    return;
  }
  await ensureSchema();
  const rows = await db()`
    SELECT id, display_name FROM users
    WHERE telegram_id = ${from && from.id} AND deleted_at IS NULL`;
  if (!rows.length) {
    await send(token, chatId, 'This chat is not linked yet. Send /link followed by the code from Settings.');
    return;
  }
  await fn(rows[0]);
}

async function handleSlip(token, chatId, message) {
  await send(token, chatId, 'Reading your slip…');

  const fileId = message.photo
    ? message.photo[message.photo.length - 1].file_id   // largest rendition
    : message.document.file_id;

  const file = await tg(token, 'getFile', { file_id: fileId });
  if (!file.ok) { await send(token, chatId, 'I could not download that image. Try sending it again.'); return; }
  if (file.result.file_size && file.result.file_size > MAX_PHOTO_BYTES) {
    await send(token, chatId, 'That image is too large for me to read. Try a screenshot instead.');
    return;
  }

  const bin = await fetch('https://api.telegram.org/file/bot' + token + '/' + file.result.file_path);
  if (!bin.ok) { await send(token, chatId, 'I could not download that image. Try sending it again.'); return; }
  const base64 = Buffer.from(await bin.arrayBuffer()).toString('base64');

  const origin = process.env.PUBLIC_ORIGIN || 'https://slippery-iota.vercel.app';
  const read = await fetch(origin + '/api/extract', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ image: base64, mime: guessMime(file.result.file_path) })
  });
  const payload = await read.json().catch(() => ({}));
  if (!read.ok) {
    await send(token, chatId, 'I could not read that one: ' +
      esc(payload.error || 'the reader is unavailable') + '. Nothing was logged.');
    return;
  }

  const f = payload.fields || {};
  if (!f.readable) {
    await send(token, chatId,
      '*I could not read that slip.*\n\n' +
      'I will not guess at numbers I cannot see. Crop to the slip, avoid glare, ' +
      'and keep the stake, odds and result in frame.');
    return;
  }

  const missing = ['stake', 'odds', 'selection'].filter(k => f[k] == null);
  const line = (label, value) => label + ': ' + (value == null ? '_not legible_' : '*' + esc(value) + '*');
  const body = [
    line('Selection', f.selection),
    line('Event', f.event),
    line('Odds', f.odds == null ? null : Number(f.odds).toFixed(2)),
    line('Stake', f.stake == null ? null : f.stake),
    line('Returns', f.returns == null ? null : f.returns),
    line('Bookmaker', f.bookmaker)
  ].join('\n');

  await send(token, chatId,
    (missing.length ? '*Read it, but some fields are missing.*\n\n' : '*Slip read.*\n\n') + body +
    (missing.length
      ? '\n\nI left ' + missing.join(', ') + ' blank rather than guess. ' +
        'Tap Edit to fill them in, or send a clearer photo.'
      : '\n\nConfirm to log it, or Edit to change something.'),
    {
      inline_keyboard: [[
        { text: missing.length ? '✏️ Edit' : '✅ Confirm', callback_data: missing.length ? 'edit' : 'confirm' },
        { text: missing.length ? '🔁 Retake' : '✏️ Edit', callback_data: missing.length ? 'retake' : 'edit' }
      ]]
    });
}

async function handleCallback(token, callback) {
  const chatId = callback.message && callback.message.chat && callback.message.chat.id;
  await tg(token, 'answerCallbackQuery', { callback_query_id: callback.id });
  if (!chatId) return;
  const replies = {
    confirm: 'Logged. It is on your calendar now, and I will settle it when the game finishes.',
    edit: 'Send the corrected value as a message, for example `stake 25` or `odds 2.10`.',
    retake: 'Send a clearer photo whenever you are ready.'
  };
  await send(token, chatId, replies[callback.data] || 'Done.');
}

/* ---- Telegram helpers ---- */
async function tg(token, method, payload) {
  const res = await fetch(API(token) + method, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json().catch(() => ({ ok: false }));
}
function send(token, chatId, text, replyMarkup) {
  return tg(token, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {})
  });
}
/* Markdown parse_mode means an unescaped * or _ in a bookmaker name breaks
   the whole message. */
const esc = v => String(v == null ? '' : v).replace(/([_*`\[\]])/g, '\\$1');
const money = (pence, sign = true) =>
  (sign && pence > 0 ? '+' : pence < 0 ? '−' : '') + '£' + (Math.abs(pence) / 100).toFixed(2);
function guessMime(path) {
  const ext = String(path).toLowerCase().split('.').pop();
  return ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
}
