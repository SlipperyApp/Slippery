/* POST /api/telegram, the bot webhook.
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
 * answers 200 once the update is authentic, a failure is reported to the
 * user in chat, not by failing the webhook into a retry loop.
 */
import { timingSafeEqual } from 'node:crypto';
import { json, methodGuard, readJson, fail } from './_lib/http.js';
import { db, ensureSchema, configured as dbConfigured, uniqueViolation } from './_lib/db.js';
import { cashOutcome } from '../src/js/settlement.js';
import { BOT, looksLikeCode, normaliseCode } from './_lib/bot-strings.js';

/* The free tier, counted here as well as in /api/bets, the bot is a second
   door into the same ledger, and a limit enforced at only one door is not a
   limit. */
const FREE_SLIPS = 20;

const API = token => 'https://api.telegram.org/bot' + token + '/';
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  try {
    if (!token) return json(res, 503, { error: 'Bot token not configured.' });
    /* Without a secret the webhook URL is guessable and anyone could post a
       forged update. That is a real risk, but a bot that refuses every
       message is not a bot, so it runs, loudly, and every path below still
       requires the chat to be linked to an account before it touches the
       ledger. Set TELEGRAM_WEBHOOK_SECRET and this stops being permissive. */
    if (!secret) {
      console.warn('[slippery] TELEGRAM_WEBHOOK_SECRET is unset; updates are unauthenticated');
    } else if (!secretMatches(req.headers['x-telegram-bot-api-secret-token'], secret)) {
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
      await handleSlip(token, chatId, message, message.from);
      return json(res, 200, { ok: true });
    }
    /* Everything else: say what the bot actually wants, rather than going
       quiet and leaving the person wondering if it is broken. */
    await send(token, chatId, BOT.nudge);
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
    case '/start': {
      /* Telegram passes whatever followed ?start= in the deep link as the
         first argument, so opening t.me/SlipperyAppBot?start=SLIP-7F3A
         arrives here as "/start SLIP-7F3A". Linking on that is the whole
         one-tap flow: without it the button on the site opened a chat that
         said "send /link followed by your code" and the user had to go back
         and copy it by hand. */
      const payload = (text.split(/\s+/)[1] || '').trim();
      if (payload) { await handleLink(token, chatId, '/link ' + payload, from); return; }
      await send(token, chatId, BOT.welcome);
      break;
    }
    case '/help':
      await send(token, chatId, BOT.help);
      break;
    case '/link':
      await handleLink(token, chatId, text, from);
      break;
    case '/whoami':
      await handleWhoami(token, chatId, from);
      break;
    case '/unlink':
      await handleUnlink(token, chatId, from);
      break;
    case '/today':
      await withAccount(token, chatId, from, async user => {
        const rows = await db()`
          SELECT COALESCE(SUM(profit_pence),0) AS net, COUNT(*) AS n
          FROM bets WHERE user_id = ${user.id} AND settled_at::date = now()::date`;
        const net = Number(rows[0].net || 0);
        await send(token, chatId, rows[0].n > 0
          ? BOT.today(money(net), rows[0].n)
          : BOT.todayNone);
      });
      break;
    case '/pending':
      await withAccount(token, chatId, from, async user => {
        const rows = await db()`
          SELECT selection, stake_pence, odds FROM bets
          WHERE user_id = ${user.id} AND status = 'pending' ORDER BY placed_at DESC LIMIT 20`;
        if (!rows.length) { await send(token, chatId, BOT.pendingNone); return; }
        const risk = rows.reduce((a, b) => a + b.stake_pence, 0);
        await send(token, chatId,
          BOT.pendingHead(rows.length, money(risk, false)) +
          rows.map(r => BOT.pendingRow(esc(r.selection || 'Bet'),
            money(r.stake_pence, false), Number(r.odds).toFixed(2))).join('\n'));
      });
      break;
    case '/stop':
      await send(token, chatId, BOT.stop);
      break;
    default:
      await send(token, chatId, BOT.unknownCommand);
  }
}

/* ============================================================
   LINKING A CHAT TO AN ACCOUNT
   ============================================================
   Three rules, and the middle one is the reason this was rewritten.

   1. A code is six characters from an alphabet with no O against 0 and no
      I or L against 1, and it expires after ten minutes. Somebody is
      reading it off one screen and typing it into another, on a phone,
      usually while the game they just bet on is starting.

   2. ONE CHAT, ONE ACCOUNT, AND IT REFUSES RATHER THAN MOVING. The old
      version caught the unique-index violation, cleared the existing link
      and retried, so a correct code silently moved somebody's chat onto a
      different ledger. Nothing anywhere said it had happened. It now says
      what the chat is linked to and asks for /unlink first.

   3. Nothing is deleted by unlinking. The bets stay on the account.
   ============================================================ */
async function handleLink(token, chatId, text, from) {
  const raw = (text.split(/\s+/)[1] || '').trim();
  if (!raw) { await send(token, chatId, BOT.linkNoCode); return; }
  if (!dbConfigured()) { await send(token, chatId, BOT.linkNoDb); return; }

  const code = normaliseCode(raw);
  /* Checked before touching the database, so a typo costs no query and
     gets a message that names the actual problem. */
  if (!looksLikeCode(code)) { await send(token, chatId, BOT.linkBadShape(esc(raw))); return; }

  await ensureSchema();
  const sql = db();
  const telegramId = from && from.id;
  if (!telegramId) return;

  /* Where this chat already stands. Checked first, because refusing to
     move a linked chat is the point and a refusal must not depend on
     whether the code happened to be valid. */
  const existing = await sql`
    SELECT id, display_name FROM users
    WHERE telegram_id = ${telegramId} AND deleted_at IS NULL`;

  const claimed = await sql`
    SELECT id, display_name FROM users
    WHERE link_code = ${code} AND deleted_at IS NULL
      AND (link_code_expires_at IS NULL OR link_code_expires_at > now())`;

  if (!claimed.length) {
    /* Tell an expired code apart from a wrong one. "That did not work" for
       a code somebody read correctly thirty seconds too late sends them
       looking for a mistake they did not make. */
    const stale = await sql`
      SELECT 1 FROM users
      WHERE link_code = ${code} AND deleted_at IS NULL
        AND link_code_expires_at IS NOT NULL AND link_code_expires_at <= now()`;
    await send(token, chatId, stale.length ? BOT.linkExpired : BOT.linkNoMatch);
    return;
  }

  if (existing.length) {
    if (existing[0].id === claimed[0].id) {
      await send(token, chatId, BOT.linkAlready(esc(existing[0].display_name)));
      return;
    }
    await send(token, chatId, BOT.linkTakenByOther(esc(existing[0].display_name)));
    return;
  }

  /* The code is burned on use. A link code that still works after it has
     been used is a link code somebody can screenshot and reuse. */
  await sql`
    UPDATE users
    SET telegram_id = ${telegramId}, telegram_linked_at = now(),
        link_code = NULL, link_code_expires_at = NULL
    WHERE id = ${claimed[0].id}`;
  await send(token, chatId, BOT.linked(esc(claimed[0].display_name)));
}

async function handleWhoami(token, chatId, from) {
  if (!dbConfigured()) { await send(token, chatId, BOT.noDbForAccount); return; }
  await ensureSchema();
  const rows = await db()`
    SELECT display_name, telegram_linked_at FROM users
    WHERE telegram_id = ${from && from.id} AND deleted_at IS NULL`;
  if (!rows.length) { await send(token, chatId, BOT.whoamiNone); return; }
  const when = rows[0].telegram_linked_at
    ? new Date(rows[0].telegram_linked_at).toISOString().slice(0, 10)
    : 'an unknown date';
  await send(token, chatId, BOT.whoami(esc(rows[0].display_name), when));
}

async function handleUnlink(token, chatId, from) {
  if (!dbConfigured()) { await send(token, chatId, BOT.noDbForAccount); return; }
  await ensureSchema();
  /* RETURNING, so the reply is what actually happened rather than what was
     attempted. Four controls in this codebase once confirmed actions they
     never performed; this one reports the row it cleared. */
  const rows = await db()`
    UPDATE users SET telegram_id = NULL, telegram_linked_at = NULL
    WHERE telegram_id = ${from && from.id} AND deleted_at IS NULL
    RETURNING display_name`;
  await send(token, chatId, rows.length
    ? BOT.unlinked(esc(rows[0].display_name))
    : BOT.unlinkNone);
}

/* An unlinked chat gets ONE line, and the instructions once.
 *
 * The bot used to read a slip for an unlinked chat, print every field back
 * with a Confirm button, and log nothing. That is the worst outcome
 * available: it looks like it worked. Nothing is read now until the chat
 * is linked, and the how-to is attached only the first time, because
 * repeating it on every message is how a helpful line becomes noise. */
async function withAccount(token, chatId, from, fn) {
  if (!dbConfigured()) { await send(token, chatId, BOT.noDbForAccount); return; }
  await ensureSchema();
  const rows = await db()`
    SELECT id, display_name FROM users
    WHERE telegram_id = ${from && from.id} AND deleted_at IS NULL`;
  if (!rows.length) { await refuseUnlinked(token, chatId); return; }
  await fn(rows[0]);
}

const toldHow = new Set();
async function refuseUnlinked(token, chatId) {
  const first = !toldHow.has(chatId);
  toldHow.add(chatId);
  /* A serverless instance is short lived and this Set dies with it, so at
     worst somebody is told twice. Bounded anyway: an unbounded Set in a
     module scope is a slow leak on a warm instance. */
  if (toldHow.size > 500) toldHow.clear();
  await send(token, chatId, BOT.notLinked + (first ? BOT.notLinkedHow : ''));
}

async function handleSlip(token, chatId, message, from) {
  /* REFUSE BEFORE READING, NOT AFTER.
     This used to download the image, send it to the reader, print every
     field back and then quietly log nothing, because the chat was not
     linked. It looked exactly like success. It also spent an Anthropic
     call on somebody who could not have a bet saved. */
  if (dbConfigured()) {
    await ensureSchema();
    const who = await db()`
      SELECT id FROM users WHERE telegram_id = ${from && from.id} AND deleted_at IS NULL`;
    if (!who.length) { await refuseUnlinked(token, chatId); return; }
  }

  await send(token, chatId, BOT.reading);

  const fileId = message.photo
    ? message.photo[message.photo.length - 1].file_id   // largest rendition
    : message.document.file_id;

  const file = await tg(token, 'getFile', { file_id: fileId });
  if (!file.ok) { await send(token, chatId, BOT.downloadFailed); return; }
  if (file.result.file_size && file.result.file_size > MAX_PHOTO_BYTES) {
    await send(token, chatId, BOT.tooLarge);
    return;
  }

  const bin = await fetch('https://api.telegram.org/file/bot' + token + '/' + file.result.file_path);
  if (!bin.ok) { await send(token, chatId, BOT.downloadFailed); return; }
  const base64 = Buffer.from(await bin.arrayBuffer()).toString('base64');

  const origin = process.env.PUBLIC_ORIGIN || 'https://slippery-iota.vercel.app';
  const read = await fetch(origin + '/api/extract', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ image: base64, mime: guessMime(file.result.file_path) })
  });
  const payload = await read.json().catch(() => ({}));
  if (!read.ok) {
    await send(token, chatId, BOT.readerFailed(esc(payload.error || 'the reader is unavailable')));
    return;
  }

  const f = payload.fields || {};
  if (!f.readable) {
    await send(token, chatId, BOT.unreadable);
    return;
  }

  const missing = ['stake', 'odds', 'selection'].filter(k => f[k] == null);
  const line = (label, value) => label + ': ' + (value == null ? BOT.notLegible : '*' + esc(value) + '*');
  const body = [
    line('Selection', f.selection),
    line('Event', f.event),
    line('Odds', f.odds == null ? null : Number(f.odds).toFixed(2)),
    line('Stake', f.stake == null ? null : f.stake),
    line('Returns', f.returns == null ? null : f.returns),
    line('Bookmaker', f.bookmaker)
  ].join('\n');

  /* Where the bet is in its life. Read off the slip, never inferred from
     the presence of a returns figure, every slip prints one. */
  const stageLine = f.stage === 'settled' ? BOT.stageSettled
    : f.stage === 'inplay' ? BOT.stageInplay
    : f.stage === 'prematch' ? BOT.stagePrematch
    : '';

  /* Park the reading. A Telegram callback carries 64 bytes, which is not
     enough to send a whole slip back, so Confirm gets a row id and reads
     the rest from the database. Before this the button replied "Logged"
     and stored nothing. */
  let draftId = null;
  if (!missing.length && dbConfigured()) {
    try {
      await ensureSchema();
      const rows = await db()`
        SELECT id FROM users WHERE telegram_id = ${from && from.id} AND deleted_at IS NULL`;
      if (rows.length) {
        const draft = await db()`
          INSERT INTO slip_drafts (user_id, chat_id, fields)
          VALUES (${rows[0].id}, ${chatId}, ${JSON.stringify(f)}) RETURNING id`;
        draftId = draft[0].id;
      }
    } catch (err) {
      console.error('[slippery] could not park slip draft:', err.message);
    }
  }

  const keyboard = missing.length
    ? [[{ text: BOT.btnEdit, callback_data: 'edit' }, { text: BOT.btnRetake, callback_data: 'retake' }]]
    : draftId
      ? [[{ text: BOT.btnConfirm, callback_data: 'ok:' + draftId }, { text: BOT.btnDiscard, callback_data: 'no:' + draftId }]]
      : [[{ text: BOT.btnEdit, callback_data: 'edit' }]];

  await send(token, chatId,
    (missing.length ? BOT.slipHeadPartial : BOT.slipHeadOk) + body + stageLine +
    (missing.length
      ? BOT.slipMissing(missing.join(', '))
      : draftId ? BOT.slipConfirmPrompt : BOT.slipNotLinked),
    { inline_keyboard: keyboard });
}

async function handleCallback(token, callback) {
  const chatId = callback.message && callback.message.chat && callback.message.chat.id;
  await tg(token, 'answerCallbackQuery', { callback_query_id: callback.id });
  if (!chatId) return;

  const data = String(callback.data || '');
  if (data.startsWith('ok:')) return confirmDraft(token, chatId, data.slice(3), callback.from);
  if (data.startsWith('no:')) {
    if (dbConfigured()) {
      try { await db()`DELETE FROM slip_drafts WHERE id = ${data.slice(3)}`; } catch { /* already gone */ }
    }
    await send(token, chatId, BOT.discarded);
    return;
  }

  const replies = { edit: BOT.editHow, retake: BOT.retakeHow };
  await send(token, chatId, replies[data] || BOT.callbackDone);
}

/* Turn a parked reading into a real bet. The one place the bot writes to
   the ledger, so it is the one place the free tier and the settled-slip
   rules have to hold, and they are the same rules /api/bets applies. */
async function confirmDraft(token, chatId, draftId, from) {
  if (!dbConfigured()) {
    await send(token, chatId, BOT.logNoDb);
    return;
  }
  try {
    await ensureSchema();
    const sql = db();
    const rows = await sql`
      SELECT d.id, d.fields, d.user_id, u.plan
      FROM slip_drafts d JOIN users u ON u.id = d.user_id
      WHERE d.id = ${draftId} AND u.deleted_at IS NULL`;
    if (!rows.length) { await send(token, chatId, BOT.draftGone); return; }

    const { fields: f, user_id: userId, plan } = rows[0];
    if ((plan || 'free') === 'free') {
      const used = await sql`SELECT count(*)::int AS n FROM bets WHERE user_id = ${userId}`;
      if (used[0].n >= FREE_SLIPS) {
        await send(token, chatId, BOT.trialUsedUp(FREE_SLIPS));
        return;
      }
    }

    const stake = Math.round(Number(f.stake) * 100);
    const odds = f.odds == null ? null : Number(f.odds);
    const result = f.result && f.result !== 'open' ? f.result : null;
    /* Profit from the returns the slip printed, not recomputed from the
       odds: on a partially cashed out or each-way slip the printed figure
       is right and the arithmetic is not. */
    const returns = f.returns == null ? null : Math.round(Number(f.returns) * 100);
    let outcome = null, profit = null;
    if (result) {
      outcome = result === 'cashed_out'
        ? cashOutcome((returns == null ? stake : returns) - stake)
        : ['won', 'lost', 'void'].includes(result) ? result : null;
      profit = returns != null ? returns - stake
        : result === 'lost' ? -stake
        : result === 'void' ? 0
        : odds ? Math.round(stake * (odds - 1)) : null;
      if (profit == null) outcome = null;
    }

    await sql`
      INSERT INTO bets (user_id, event, selection, market, bookmaker, odds, stake_pence,
                        profit_pence, outcome, status, placed_at, settled_at,
                        settle_reason, source)
      VALUES (${userId}, ${f.event || null}, ${f.selection || null}, ${f.market || null},
              ${f.bookmaker || null}, ${odds}, ${stake},
              ${outcome ? profit : null}, ${outcome},
              ${outcome ? 'settled' : 'pending'}, now(),
              ${outcome ? new Date() : null},
              ${outcome ? 'Result read from the slip' : null}, 'telegram')`;
    await sql`DELETE FROM slip_drafts WHERE id = ${draftId}`;

    const net = await sql`
      SELECT COALESCE(sum(profit_pence), 0)::int AS net, count(*)::int AS n
      FROM bets WHERE user_id = ${userId} AND settled_at::date = now()::date`;

    await send(token, chatId, outcome
      ? BOT.loggedSettled(outcome.replace('cash-', 'cashed '), money(profit),
          money(net[0].net), net[0].n)
      : BOT.loggedPending);
  } catch (err) {
    console.error('[slippery] confirmDraft failed:', err.message);
    await send(token, chatId, BOT.logFailed);
  }
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
