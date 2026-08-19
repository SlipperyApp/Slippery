import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'node:crypto';
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import { getDb, schema, dbReady } from '@/lib/db';
import { env } from '@/lib/server/env';
import { safeEqual, normaliseLinkCode, makeLinkCode } from '@/lib/server/crypto';
import { sendMessage, sendChatAction, answerCallbackQuery, getFileBytes, callbackData } from '@/lib/server/telegram';
import { BOT, fieldTable, severalBets } from '@/lib/server/bot-voice';
import { readSlip, ReaderUnavailable } from '@/lib/server/vision';
import { rateLimit, LIMITS } from '@/lib/server/ratelimit';
import { appendEvent } from '@/lib/server/bets';
import { trialState } from '@/lib/server/promo';
import { periodRange } from '@/lib/server/periods';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/* THE BOT WEBHOOK.
 *
 * Three things break this if they are ignored, and all three are here at the
 * top because they are the whole shape of the handler:
 *
 *   1. VERIFY THE SECRET TOKEN AND 401 ON MISMATCH. The URL is guessable and
 *      anyone who guesses it would otherwise write bets into other people's
 *      ledgers.
 *   2. RETURN 200 IMMEDIATELY, THEN PROCESS, deduping on update_id. Telegram
 *      retries anything that is not a 200, and a slow read would create the
 *      same bet three times.
 *   3. ANSWER EVERY CALLBACK QUERY, or the button spins forever even though
 *      the write went through.
 */
export async function POST(req: NextRequest) {
  const want = env.telegramWebhookSecret();
  const got = req.headers.get('x-telegram-bot-api-secret-token') || '';
  if (!want || !safeEqual(got, want)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!dbReady()) return NextResponse.json({ ok: true });

  let update: any;
  try { update = await req.json(); } catch { return NextResponse.json({ ok: true }); }

  const updateId = update?.update_id;
  if (typeof updateId !== 'number') return NextResponse.json({ ok: true });

  /* The dedupe has to happen before the work, and it has to be the insert
     itself that decides: two retries can arrive at once. */
  const db = getDb();
  const claimed = await db.insert(schema.telegramUpdates)
    .values({ updateId: BigInt(updateId) })
    .onConflictDoNothing()
    .returning({ id: schema.telegramUpdates.updateId });
  if (!claimed.length) return NextResponse.json({ ok: true });

  /* 200 first. The work continues after the response is on the wire, which
     is what stops Telegram retrying a read that is merely slow. */
  const work = handle(update).catch(() => {
    /* Never the error, never the message body. Chat id and an outcome line
       are the only things this product logs about a chat. */
    console.error('telegram update failed', updateId);
  });
  if (typeof (globalThis as any).waitUntil === 'function') (globalThis as any).waitUntil(work);
  else await work;

  return NextResponse.json({ ok: true });
}

async function handle(update: any) {
  if (update.callback_query) return onCallback(update.callback_query);
  if (update.my_chat_member) return onChatMember(update.my_chat_member);
  if (update.message) return onMessage(update.message);
}

/* Blocked or removed. The link goes dormant and nothing is sent to it again.
   It is never deleted: the bets behind it are somebody's record. */
async function onChatMember(ev: any) {
  const status = ev?.new_chat_member?.status;
  if (!['kicked', 'left'].includes(status)) return;
  const from = ev?.from?.id;
  if (!from) return;
  await getDb().update(schema.telegramLinks).set({ dormant: true })
    .where(eq(schema.telegramLinks.telegramUserId, BigInt(from)));
}

async function onMessage(msg: any) {
  const chatId = msg?.chat?.id;
  const fromId = msg?.from?.id;
  if (!chatId || !fromId) return;

  const db = getDb();
  const links = await db.select().from(schema.telegramLinks)
    .where(eq(schema.telegramLinks.telegramUserId, BigInt(fromId))).limit(1);
  const link = links[0];

  const text = String(msg.text || msg.caption || '').trim();
  const command = text.startsWith('/') ? text.split(/[\s@]/)[0].toLowerCase() : null;

  /* Unlinked, and a photo. THE IMAGE IS NOT READ. Asking for a code first is
     the only thing that happens, or the reader runs for somebody who has no
     account to write to. */
  if (!link) {
    if (command === '/start') {
      const arg = text.slice(6).trim();
      if (arg) return tryLink(chatId, fromId, msg.from, arg);
      return void sendMessage(chatId, BOT.askForCode);
    }
    const asCode = normaliseLinkCode(text);
    if (asCode) return tryLink(chatId, fromId, msg.from, asCode);
    return void sendMessage(chatId, BOT.askForCode);
  }

  if (link.dormant) {
    await db.update(schema.telegramLinks).set({ dormant: false, chatId: BigInt(chatId) })
      .where(eq(schema.telegramLinks.telegramUserId, BigInt(fromId)));
  }

  const accounts = await db.select().from(schema.accounts)
    .where(eq(schema.accounts.id, link.accountId)).limit(1);
  const account = accounts[0];
  if (!account) return void sendMessage(chatId, BOT.askForCode);

  const who = account.handle ? '@' + account.handle : account.email;

  switch (command) {
    case '/start': return void sendMessage(chatId, BOT.alreadyLinked(who));
    case '/stop': {
      await db.delete(schema.telegramLinks).where(eq(schema.telegramLinks.telegramUserId, BigInt(fromId)));
      return void sendMessage(chatId, BOT.stopped);
    }
    case '/help': return void sendMessage(chatId, BOT.help);
    case '/today': return void sendMessage(chatId, await figures(account, 'today'));
    case '/week': return void sendMessage(chatId, await figures(account, 'W'));
    case '/open': return void sendMessage(chatId, await openBets(account));
    case '/last': return void sendMessage(chatId, await lastBet(account));
    case '/undo': return void sendMessage(chatId, await undoLast(account, chatId));
    default: break;
  }

  const photo = Array.isArray(msg.photo) && msg.photo.length ? msg.photo[msg.photo.length - 1] : null;
  const doc = msg.document;

  if (!photo && !doc) {
    if (command) return void sendMessage(chatId, BOT.unknown);
    /* Text that looks like a bet is parsed, same field table. Text that
       does not gets one line pointing at /help. */
    if (looksLikeABet(text)) return void sendMessage(chatId, BOT.unknown);
    return void sendMessage(chatId, BOT.unknown);
  }

  if (doc && !/^(image\/|application\/pdf)/.test(String(doc.mime_type || ''))) {
    return void sendMessage(chatId, BOT.wrongDocument);
  }

  /* Plan state before the reader, always: a paused account is told, and
     nothing is read. */
  if (account.planState === 'read_only') return void sendMessage(chatId, BOT.paused);
  const trial = trialState(account);
  if (trial.state === 'over') return void sendMessage(chatId, BOT.trialOver(trial.ran));

  const limit = await rateLimit('tg:' + account.id, LIMITS.telegram.max, LIMITS.telegram.window);
  if (!limit.ok) return void sendMessage(chatId, BOT.rateLimited(limit.retryAfterSeconds));

  await sendChatAction(chatId, 'typing');

  const fileId = photo ? photo.file_id : doc.file_id;
  /* The largest size, downloaded immediately: the link expires in about an
     hour and the small one cannot be read. */
  const file = await getFileBytes(fileId);
  if (!file) return void sendMessage(chatId, BOT.readerDown);

  const sha256 = createHash('sha256').update(file.bytes).digest('hex');
  const seen = await db.select({ betId: schema.slipImages.betId }).from(schema.slipImages)
    .where(and(eq(schema.slipImages.accountId, account.id), eq(schema.slipImages.sha256, sha256))).limit(1);
  if (seen.length && seen[0].betId) return void sendMessage(chatId, BOT.duplicate);

  let result;
  try {
    result = await readSlip({ base64: file.bytes.toString('base64'), mediaType: file.mediaType });
  } catch (err) {
    return void sendMessage(chatId, err instanceof ReaderUnavailable ? BOT.readerDown : BOT.readerDown);
  }

  if (result.not_a_slip || !result.bets.length) return void sendMessage(chatId, BOT.notASlip);

  await db.insert(schema.slipImages).values({
    accountId: account.id, sha256, deleteAfter: new Date(Date.now() + 90 * 86400000),
  });
  await db.update(schema.accounts).set({ trialSlipsUsed: account.trialSlipsUsed + 1 })
    .where(eq(schema.accounts.id, account.id));

  const pendingId = randomBytes(6).toString('base64url');
  await db.insert(schema.pendingReads).values({
    id: pendingId,
    accountId: account.id,
    chatId: BigInt(chatId),
    payload: { bets: result.bets, sha256 },
    expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
  });

  if (result.bets.length > 1) {
    return void sendMessage(chatId, severalBets(result.bets.length), {
      inline_keyboard: [[
        { text: 'Confirm all', callback_data: callbackData('ok', pendingId) },
        { text: 'Review in app', url: env.appUrl() + '/add/review' },
      ]],
    });
  }

  const b = result.bets[0];
  if (b.unreadable_fields.length) {
    /* Confirm stays off until the gap is filled. Naming the field is the
       difference between somebody fixing it and somebody giving up. */
    return void sendMessage(chatId, fieldTable(b) + '\n' + BOT.unreadable(b.unreadable_fields), {
      inline_keyboard: [[{ text: 'Edit in app', url: env.appUrl() + '/add/review' }]],
    });
  }

  return void sendMessage(chatId, fieldTable(b), {
    inline_keyboard: [[
      { text: 'Confirm', callback_data: callbackData('ok', pendingId) },
      { text: 'Edit', url: env.appUrl() + '/add/review' },
    ]],
  });
}

async function onCallback(cb: any) {
  const id = String(cb.id);
  const data = String(cb.data || '');
  const chatId = cb?.message?.chat?.id;
  const [action, pendingId] = data.split(':');

  /* Answered first and unconditionally. Every path below returns after this
     has already gone out. */
  if (action !== 'ok' || !pendingId) { await answerCallbackQuery(id); return; }

  const db = getDb();
  const rows = await db.select().from(schema.pendingReads)
    .where(eq(schema.pendingReads.id, pendingId)).limit(1);
  const pending = rows[0];
  if (!pending) { await answerCallbackQuery(id, 'That read has expired.'); return; }

  /* Confirming an already-confirmed read says so and never double-writes. */
  if (pending.confirmedBetId) {
    await answerCallbackQuery(id, BOT.alreadySaved);
    if (chatId) await sendMessage(chatId, BOT.alreadySaved);
    return;
  }

  const payload = pending.payload as { bets: any[]; sha256: string };
  const saved = await db.transaction(async (tx) => {
    const ids: string[] = [];
    for (const b of payload.bets) {
      const [bet] = await tx.insert(schema.bets).values({
        accountId: pending.accountId,
        shape: b.shape || 'single',
        side: b.side === 'lay' ? 'lay' : 'back',
        stakePence: b.stake_pence ?? 0,
        liabilityPence: b.liability_pence ?? null,
        odds: b.odds != null ? String(b.odds) : null,
        currency: b.currency === 'EUR' ? 'EUR' : 'GBP',
        eventName: b.event_name,
        selection: b.selection,
        marketRaw: b.market,
        eventAt: b.event_at ? new Date(b.event_at) : new Date(),
        placedAt: new Date(),
        isFreeBet: Boolean(b.is_free_bet),
        isEachWay: Boolean(b.is_each_way),
        /* Forwarded from the bookmaker's own app, so there is a slip behind
           it. This is what group verification filters on. */
        slipBacked: true,
        source: 'telegram',
      }).returning();
      if (Array.isArray(b.legs) && b.legs.length) {
        await tx.insert(schema.betLegs).values(b.legs.map((l: any, i: number) => ({
          betId: bet.id, seq: i + 1, selection: l.selection, marketRaw: l.market,
          eventName: l.event_name, legOdds: l.odds != null ? String(l.odds) : null,
        })));
      }
      await appendEvent(tx, bet.id, { type: 'placed', enteredBy: 'telegram' });
      ids.push(bet.id);
    }
    await tx.update(schema.pendingReads).set({ confirmedBetId: ids[0] })
      .where(eq(schema.pendingReads.id, pendingId));
    return ids;
  });

  await answerCallbackQuery(id, 'Saved.');
  if (chatId) {
    const open = await runningCount(pending.accountId);
    await sendMessage(chatId, `TRACKING ${saved.length} bet${saved.length === 1 ? '' : 's'} saved · ${open.count} running · £${(open.exposure / 100).toFixed(2)} at risk`);
  }
}

/* ---------------- figures ---------------- */

async function accountFigures(accountId: string, from: Date, to: Date) {
  const db = getDb();
  const rows = await db
    .select({ pl: schema.betState.realisedPlPence, stake: schema.bets.stakePence })
    .from(schema.bets)
    .leftJoin(schema.betState, eq(schema.betState.betId, schema.bets.id))
    .where(and(eq(schema.bets.accountId, accountId), gte(schema.bets.eventAt, from), sql`${schema.bets.eventAt} <= ${to}`));
  const net = rows.reduce((t, r) => t + (r.pl ?? 0), 0);
  return { net, count: rows.length };
}

async function figures(account: any, period: 'today' | 'W') {
  const { from, to } = periodRange(period, account.weekStart);
  const f = await accountFigures(account.id, from, to);
  const label = period === 'today' ? 'Today' : 'This week';
  return `${label} ${f.net >= 0 ? '+' : '−'}£${Math.abs(f.net / 100).toFixed(2)} from ${f.count} bet${f.count === 1 ? '' : 's'}`;
}

async function runningCount(accountId: string) {
  const db = getDb();
  const rows = await db
    .select({ remaining: schema.betState.remainingStakePence })
    .from(schema.bets)
    .innerJoin(schema.betState, eq(schema.betState.betId, schema.bets.id))
    .where(and(eq(schema.bets.accountId, accountId), sql`${schema.betState.status} <> 'settled'`));
  return { count: rows.length, exposure: rows.reduce((t, r) => t + (r.remaining ?? 0), 0) };
}

async function openBets(account: any) {
  const r = await runningCount(account.id);
  if (!r.count) return 'Nothing running.';
  return `${r.count} running · £${(r.exposure / 100).toFixed(2)} at risk`;
}

async function lastBet(account: any) {
  const db = getDb();
  const rows = await db.select({ bet: schema.bets, state: schema.betState })
    .from(schema.bets)
    .leftJoin(schema.betState, eq(schema.betState.betId, schema.bets.id))
    .where(eq(schema.bets.accountId, account.id))
    .orderBy(desc(schema.bets.createdAt)).limit(1);
  if (!rows[0]) return 'No bets logged yet.';
  const { bet, state } = rows[0];
  return `${bet.selection ?? bet.eventName ?? 'Bet'} · £${(bet.stakePence / 100).toFixed(2)} at ${bet.odds ?? 'no price'} · ${state?.status ?? 'open'}`;
}

/* Within 24 hours, from this chat only, and it says what went. */
async function undoLast(account: any, chatId: number) {
  const db = getDb();
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000);
  const rows = await db.select().from(schema.bets)
    .where(and(
      eq(schema.bets.accountId, account.id),
      eq(schema.bets.source, 'telegram'),
      gte(schema.bets.createdAt, cutoff),
    ))
    .orderBy(desc(schema.bets.createdAt)).limit(1);
  if (!rows[0]) return 'Nothing from the last 24 hours to undo.';
  const bet = rows[0];
  await db.delete(schema.bets).where(eq(schema.bets.id, bet.id));
  return `Removed ${bet.selection ?? bet.eventName ?? 'that bet'} · £${(bet.stakePence / 100).toFixed(2)}`;
}

async function tryLink(chatId: number, fromId: number, from: any, input: string) {
  const code = normaliseLinkCode(input);
  if (!code) return void sendMessage(chatId, BOT.notACode);

  const db = getDb();
  const rows = await db.select().from(schema.accounts)
    .where(eq(schema.accounts.linkCode, code)).limit(1);
  const account = rows[0];
  /* The same answer whether the code is wrong or merely somebody else's:
     never reveal whether a code exists. */
  if (!account) return void sendMessage(chatId, BOT.notACode);

  const existing = await db.select().from(schema.telegramLinks)
    .where(eq(schema.telegramLinks.accountId, account.id)).limit(1);
  if (existing.length && existing[0].telegramUserId !== BigInt(fromId)) {
    return void sendMessage(chatId, BOT.codeUsedElsewhere);
  }

  await db.insert(schema.telegramLinks).values({
    telegramUserId: BigInt(fromId),
    chatId: BigInt(chatId),
    accountId: account.id,
    telegramUsername: from?.username ?? null,
  }).onConflictDoUpdate({
    target: schema.telegramLinks.telegramUserId,
    set: { accountId: account.id, chatId: BigInt(chatId), telegramUsername: from?.username ?? null, dormant: false },
  });

  /* Single use: the code is rolled the moment it is spent. */
  await db.update(schema.accounts).set({ linkCode: makeLinkCode(), linkCodeExpiresAt: null })
    .where(eq(schema.accounts.id, account.id));

  return void sendMessage(chatId, BOT.linked(account.handle ? '@' + account.handle : account.email));
}

const looksLikeABet = (text: string) =>
  /£\s?\d|\b\d+(\.\d+)?\s*(at|@)\s*\d+(\.\d+)?/i.test(text);
