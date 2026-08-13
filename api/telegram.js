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
import { unlimited, trialState, TRIAL_SLIPS } from './_lib/promo.js';
import { limit } from './_lib/rate.js';

/* The free tier used to be counted here against a hardcoded 20 while the
   app counted against 35, so the bot cut somebody off fifteen slips early
   and neither number was the one the dashboard displayed. Both doors read
   trialState from promo.js now, which is the only place the figures live. */

const API = token => 'https://api.telegram.org/bot' + token + '/';
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['POST'])) return;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  try {
    if (!token) return json(res, 503, { error: 'Bot token not configured.' });

    /* THE SECRET IS NOT OPTIONAL ANY MORE.
       This used to run without one and log a warning, on the reasoning
       that a bot which refuses every message is not a bot. That is true
       and it is the wrong trade: the webhook URL is public, so without the
       header anybody who guesses it can post updates that look like they
       came from Telegram, and the only thing between a forged update and
       somebody's ledger is a chat id an attacker chooses. It refuses. */
    if (!secret) {
      console.error('[slippery] TELEGRAM_WEBHOOK_SECRET is unset; refusing every update');
      return json(res, 503, { error: 'Webhook secret not configured.' });
    }
    if (!secretMatches(req.headers['x-telegram-bot-api-secret-token'], secret)) {
      return json(res, 401, { error: 'Bad secret token.' });
    }

    const update = await readJson(req, 1024 * 1024);

    /* ONE UPDATE, ONCE.
       Telegram redelivers anything it does not get a 200 for, every few
       seconds, and a function that times out halfway through a write has
       already done half the work. Without this, one forwarded slip becomes
       three bets. The primary key is the check: the second insert of the
       same id is refused by the database rather than by a SELECT two
       concurrent deliveries can both pass.

       If the database is unreachable the update is processed anyway. A
       duplicate bet is bad; silently dropping every slip somebody sends
       during an outage is worse, and the confirm step is still a human
       tapping a button. */
    if (update.update_id != null && dbConfigured()) {
      try {
        await ensureSchema();
        await db()`INSERT INTO telegram_updates (update_id) VALUES (${update.update_id})`;
        /* Pruned here rather than by a cron: this table is only ever read
           by the insert that fails, so it can be trimmed on the way past. */
        if (Math.random() < 0.02) {
          await db()`DELETE FROM telegram_updates WHERE seen_at < now() - interval '2 days'`;
        }
      } catch (err) {
        if (uniqueViolation(err)) {
          console.log('[slippery] telegram update already handled');
          return json(res, 200, { ok: true, duplicate: true });
        }
        console.error('[slippery] telegram dedupe unavailable:', err && err.message);
      }
    }

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
    if (message.photo || isReadableDocument(message.document)) {
      await handleSlip(token, chatId, message, message.from);
      return json(res, 200, { ok: true });
    }

    /* EVERYTHING ELSE SOMEBODY CAN SEND, ANSWERED BY NAME.
       Replying "send me a bet slip" to a voice note reads as a bot that
       did not notice what arrived. */
    if (message.voice || message.audio || message.video_note) {
      await send(token, chatId, BOT.gotVoice);
      return json(res, 200, { ok: true });
    }
    if (message.sticker) { await send(token, chatId, BOT.gotSticker); return json(res, 200, { ok: true }); }
    if (message.location || message.venue) {
      await send(token, chatId, BOT.gotLocation);
      return json(res, 200, { ok: true });
    }
    if (message.document) {
      const kind = (message.document.file_name || '').split('.').pop().toLowerCase();
      await send(token, chatId, BOT.gotFile(kind && kind.length <= 5 ? kind.toUpperCase() + ' file' : 'file'));
      return json(res, 200, { ok: true });
    }
    if (message.video) { await send(token, chatId, BOT.gotFile('video')); return json(res, 200, { ok: true }); }

    /* Text that reads like somebody typing a bet out. They get a useful
       answer rather than the generic nudge, because they are trying to do
       the right thing in the wrong format. */
    if (text && LOOKS_LIKE_BET.test(text)) {
      await send(token, chatId, BOT.gotTextBet);
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

/* Images and PDFs both go to the reader. A PDF is how bookmakers send a
   statement, and the extractor already handles one. */
const isReadableDocument = doc =>
  doc && typeof doc.mime_type === 'string' &&
  (doc.mime_type.startsWith('image/') || doc.mime_type === 'application/pdf');

/* Somebody typing a bet out rather than sending the slip: a price, a stake
   or a market in a sentence. Deliberately loose, because the reply is a
   nudge rather than an action. */
const LOOKS_LIKE_BET =
  /\b(\d+\.\d{1,2}|\d+\/\d+)\b|\b(?:£|GBP)\s?\d|\bover\b|\bunder\b|\bacca\b|\bbtts\b|\bhandicap\b|\bwin\b/i;

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
      /* A deep link is exactly /link with the code. t.me/Bot?start=ABC123
         arrives here as "/start ABC123", so it goes through the same
         handler and gets the same answers, rather than a second
         implementation that can drift from the first. */
      if (payload) { await handleLink(token, chatId, '/link ' + payload, from); return; }
      /* Somebody who is already linked has done the setup. Repeating the
         how-to at them is noise. */
      const who = await linkedAccount(from);
      await send(token, chatId, who ? BOT.welcomeBack(esc(who.display_name)) : BOT.welcome);
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

  /* Every account holding this code, whatever state it is in, so the four
     ways a code can fail are told apart instead of collapsing into one
     unhelpful "that did not match". */
  const holders = await sql`
    SELECT id, display_name, telegram_id, link_code_expires_at, link_code_used_at
    FROM users WHERE link_code = ${code} AND deleted_at IS NULL`;

  if (!holders.length) { await send(token, chatId, BOT.linkNoMatch); return; }
  const target = holders[0];

  if (target.link_code_used_at) { await send(token, chatId, BOT.linkUsed); return; }
  if (target.link_code_expires_at && new Date(target.link_code_expires_at) <= new Date()) {
    await send(token, chatId, BOT.linkExpired);
    return;
  }

  if (existing.length) {
    /* Already this account: a no-op that says so, not an error. */
    if (existing[0].id === target.id) {
      await send(token, chatId, BOT.linkAlready(esc(existing[0].display_name)));
      return;
    }
    /* Already a DIFFERENT account: refuse. Moving it silently would send
       somebody's slips to another ledger with nothing saying so. */
    await send(token, chatId, BOT.linkTakenByOther(esc(existing[0].display_name)));
    return;
  }

  /* The ACCOUNT is already on another chat. Refused rather than replaced,
     and this is the deliberate choice of the two: replacing means anybody
     who gets hold of a code can quietly take over where an account's slips
     arrive, and the real owner sees nothing at all. */
  if (target.telegram_id && String(target.telegram_id) !== String(telegramId)) {
    await send(token, chatId, BOT.linkAccountElsewhere);
    return;
  }

  /* Stamped used rather than blanked. A code that still works after being
     used is one somebody can screenshot; a code that vanishes cannot be
     told apart from one that never existed. */
  await sql`
    UPDATE users
    SET telegram_id = ${telegramId}, telegram_linked_at = now(),
        telegram_username = ${(from && from.username) || null},
        link_code_used_at = now(), link_code_expires_at = NULL
    WHERE id = ${target.id}`;
  await send(token, chatId, BOT.linked(esc(target.display_name)));
}

/* Which account, if any, this Telegram user is linked to. */
async function linkedAccount(from) {
  if (!dbConfigured() || !(from && from.id)) return null;
  await ensureSchema();
  const rows = await db()`
    SELECT id, display_name FROM users
    WHERE telegram_id = ${from.id} AND deleted_at IS NULL`;
  return rows[0] || null;
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

/* EVERY REASON NOT TO READ, CHECKED BEFORE READING.
 *
 * This used to download the image, send it to Anthropic, print every field
 * back with a Confirm button and then quietly log nothing, because the
 * chat was not linked. It looked exactly like success, and it spent a paid
 * call doing it. Each gate below is a database read or a config check that
 * costs nothing, and each one names the actual reason.
 *
 * @returns {Promise<{user?:object}|null>} null when the slip must not be read.
 */
async function slipGate(token, chatId, from) {
  if (!dbConfigured()) { await send(token, chatId, BOT.noDatabase); return null; }
  if (!process.env.ANTHROPIC_API_KEY) { await send(token, chatId, BOT.noReader); return null; }

  await ensureSchema();
  const rows = await db()`
    SELECT id, display_name, plan, plan_until, trial_ends_at, break_until
    FROM users WHERE telegram_id = ${from && from.id} AND deleted_at IS NULL`;
  if (!rows.length) { await refuseUnlinked(token, chatId); return null; }
  const user = rows[0];

  /* A break is enforced on the server and cannot be shortened, including
     from here. The bot is a second door into the same ledger, and a limit
     enforced at one door is not a limit. */
  if (user.break_until && new Date(user.break_until) > new Date()) {
    await send(token, chatId, BOT.onBreak(dayLabel(user.break_until)));
    return null;
  }

  /* One chat, a slip a few seconds. Somebody holding the shutter down on a
     photo album would otherwise drain the reader's budget. */
  if (!(await limit('tg-slip:' + chatId, 12, 300)).allowed) {
    await send(token, chatId, BOT.tooFast);
    return null;
  }

  /* The trial's two halves fail differently and deserve different
     sentences: 35 slips in four days is somebody being asked early, which
     is a compliment, and a fortnight running out is the ordinary time. */
  if (!unlimited(user.plan, user.plan_until)) {
    const used = await db()`SELECT count(*)::int AS n FROM bets WHERE user_id = ${user.id}`;
    const trial = trialState({ slipsUsed: used[0].n, trialEndsAt: user.trial_ends_at });
    if (!trial.active) {
      await send(token, chatId,
        trial.over === 'slips' ? BOT.trialOverSlips(TRIAL_SLIPS) : BOT.trialOverDays);
      return null;
    }
  }
  return { user };
}

const dayLabel = d => new Date(d).toLocaleDateString('en-GB',
  { day: 'numeric', month: 'long', timeZone: 'Europe/London' });

async function handleSlip(token, chatId, message, from) {
  const gate = await slipGate(token, chatId, from);
  if (!gate) return;

  /* Sent once and then edited in place, so the chat does not fill with a
     "Reading…" line above every card. */
  const statusId = await send(token, chatId, BOT.reading);

  const fileId = message.photo
    ? message.photo[message.photo.length - 1].file_id   // largest rendition
    : message.document.file_id;

  const file = await tg(token, 'getFile', { file_id: fileId });
  if (!file.ok) { await replace(token, chatId, statusId, BOT.downloadFailed); return; }
  if (file.result.file_size && file.result.file_size > MAX_PHOTO_BYTES) {
    await replace(token, chatId, statusId, BOT.tooLarge);
    return;
  }

  const bin = await fetch('https://api.telegram.org/file/bot' + token + '/' + file.result.file_path);
  if (!bin.ok) { await replace(token, chatId, statusId, BOT.downloadFailed); return; }
  const base64 = Buffer.from(await bin.arrayBuffer()).toString('base64');

  const origin = process.env.PUBLIC_ORIGIN || 'https://slippery-iota.vercel.app';
  const read = await fetch(origin + '/api/extract', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ image: base64, mime: guessMime(file.result.file_path) })
  });
  const payload = await read.json().catch(() => ({}));
  if (!read.ok) {
    await replace(token, chatId, statusId,
      BOT.readerFailed(esc(payload.error || 'the reader is unavailable')));
    return;
  }

  const f = payload.fields || {};
  if (!f.readable) {
    await replace(token, chatId, statusId, BOT.unreadable);
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

  /* The "Reading…" line becomes the card. */
  await replace(token, chatId, statusId,
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
    /* CLAIM IT WITH THE DELETE, NOT WITH A SELECT.
       Tapping Confirm twice, or Telegram redelivering the callback, used
       to run two SELECTs that both found the draft and both inserted a
       bet. Deleting first means exactly one caller gets the row back and
       every other one gets nothing, decided by the database rather than by
       timing. */
    const rows = await sql`
      DELETE FROM slip_drafts d
      USING users u
      WHERE d.id = ${draftId} AND u.id = d.user_id AND u.deleted_at IS NULL
      RETURNING d.id, d.fields, d.user_id, d.created_at, u.plan, u.plan_until, u.trial_ends_at`;
    if (!rows.length) { await send(token, chatId, BOT.alreadyLogged); return; }

    /* A day old is stale. The odds on the slip may have been a price that
       no longer exists, and somebody scrolling back through a chat and
       tapping an old Confirm should get a fresh read rather than a bet
       logged from a reading they have forgotten making. */
    if (rows[0].created_at && Date.now() - new Date(rows[0].created_at) > 24 * 3600 * 1000) {
      await send(token, chatId, BOT.draftExpired);
      return;
    }

    const { fields: f, user_id: userId, plan, plan_until: planUntil,
            trial_ends_at: trialEndsAt } = rows[0];
    /* The same rules /api/bets applies, from the same module. The bot is a
       second door into one ledger, and a limit enforced at one door is not
       a limit. This used to count against a hardcoded 20 while the app
       counted against 35. */
    if (!unlimited(plan, planUntil)) {
      const used = await sql`SELECT count(*)::int AS n FROM bets WHERE user_id = ${userId}`;
      const trial = trialState({ slipsUsed: used[0].n, trialEndsAt });
      if (!trial.active) {
        await send(token, chatId,
          trial.over === 'slips' ? BOT.trialOverSlips(TRIAL_SLIPS) : BOT.trialOverDays);
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
/* Sent messages come back with an id, so the "Reading your slip…" line can
   become the card rather than sitting above it forever. */
async function send(token, chatId, text, replyMarkup) {
  const r = await tg(token, 'sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    ...(replyMarkup ? { reply_markup: replyMarkup } : {})
  });
  return r && r.ok && r.result ? r.result.message_id : null;
}

/* Edit in place, falling back to a new message. Telegram refuses an edit
   whose text is identical to what is there, and refuses one on a message
   older than 48 hours; neither is worth losing the reply over. */
async function replace(token, chatId, messageId, text, replyMarkup) {
  if (!messageId) return send(token, chatId, text, replyMarkup);
  const r = await tg(token, 'editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'Markdown',
    ...(replyMarkup ? { reply_markup: replyMarkup } : {})
  });
  if (r && r.ok) return messageId;
  return send(token, chatId, text, replyMarkup);
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
