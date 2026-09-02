/** Binding a Telegram chat to an account.
 *
 *  A person signed in on the web asks for a code, sends it to the bot, and
 *  from then on the slips they forward land in THEIR ledger. Everything that
 *  can go wrong with that is a bet written into a stranger's record, so the
 *  four rules below are the whole module and none of them is optional.
 *
 *  1. A CODE IS SINGLE USE AND SHORT LIVED. The old flow redeemed
 *     accounts.link_code, which is permanent and never used up: a code in a
 *     screenshot worked forever. These expire in fifteen minutes and are
 *     consumed by one statement whose where clause carries the guards, so a
 *     second redeem of the same code writes nothing rather than racing.
 *
 *  2. ONE CHAT IS BOUND TO AT MOST ONE ACCOUNT, enforced by a unique index on
 *     chat_id rather than by whoever wrote the last upsert.
 *
 *  3. A CHAT IS NEVER MOVED SILENTLY. A code for a different account returns
 *     needs_confirmation and CONSUMES NOTHING. Moving takes a second,
 *     deliberate act. The previous upsert moved the binding on the spot and
 *     the person whose ledger it left was never told.
 *
 *  4. GUESSING IS BOUNDED. The code format is four characters over a 31
 *     character alphabet, which is 923,521 codes. That is small enough to
 *     guess at from a chat, so wrong codes are counted per chat and a chat
 *     that gets five wrong is blocked for fifteen minutes.
 *
 *  The plaintext code exists in exactly one place: the response that issued
 *  it. It is stored as an HMAC, it is never logged, and linkStatus cannot
 *  return it to the page that asked, which is the property that makes it
 *  worth storing this way. */

import { createHmac, timingSafeEqual } from 'node:crypto';
import { generateLinkCode, isLinkCode, normaliseLinkCode } from './codes';
import { read } from './env';

/** Long enough to switch apps and paste it, short enough that a code left on
 *  a screen behind somebody is worthless by the time they read it. */
export const LINK_CODE_TTL_MINUTES = 15;

/** Wrong codes allowed from one chat before it is blocked, and for how long.
 *  Five is generous for somebody typing a code off another screen and useless
 *  to anybody working through 923,521 of them. */
export const WRONG_CODE_LIMIT = 5;
export const WRONG_CODE_WINDOW_MINUTES = 15;
export const WRONG_CODE_BLOCK_MINUTES = 15;

/** Public, not a secret: it is printed on /app/import/linked and in the
 *  marketing copy. It lives here so the page, the API and the bot instructions
 *  cannot drift apart. */
export const BOT_HANDLE = '@SlipperyAppBot';

/** The exact text to send. One source, because "send /start then the code"
 *  and "send the code" were two different instructions on two screens. */
export function sendTextFor(code: string): string {
  return `/start ${code}`;
}

/** Only the part of a pg client this module uses. A PoolClient satisfies it,
 *  and so does the fake in tests/telegram-link.test.ts, which is how expiry,
 *  replay and the already-linked chat are tested without a live database. */
export type Db = {
  query<R = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: R[] }>;
};

/*  The HMAC key is AUTH_SECRET, the same one session tokens are hashed under,
    namespaced so a value lifted from one table can never be replayed as the
    other. It is read here rather than through lib/server/auth because that
    module imports next/headers, which cannot be loaded by the test runner,
    and an untested redeem path is the one thing this module cannot have. */
function hmacKey(): string {
  return read('AUTH_SECRET') ?? 'development-only-not-a-secret';
}

function codeHash(code: string): string {
  return createHmac('sha256', hmacKey()).update(`telegram-link:${code}`).digest('hex');
}

/*  Constant time, and it runs on the miss path too.
 *
 *  A `===` on two hex strings returns at the first differing character, and
 *  this comparison is reachable from any Telegram chat at whatever rate the
 *  bot answers. The filler compare on a miss keeps a wrong code and a live
 *  code on the same path length, so the time to answer says nothing about
 *  whether a guess was close. */
const FILLER = 'f'.repeat(64);

function sameHash(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) {
    timingSafeEqual(Buffer.from(FILLER, 'utf8'), Buffer.from(FILLER, 'utf8'));
    return false;
  }
  return timingSafeEqual(left, right);
}

// ------------------------------------------------------------------ issue

export type IssuedCode = { code: string; expiresAt: string; ttlSeconds: number; sendText: string };

/** Issue a code for an account.
 *
 *  Issuing revokes the account's previous live code. One live code per account
 *  is what keeps the live set small, and the live set is the population a
 *  guesser is drawing from: ten thousand live codes over 923,521 makes a blind
 *  guess a one in ninety two shot. */
export async function issueLinkCode(client: Db, accountId: string): Promise<IssuedCode> {
  // Dead codes are evidence of nothing after a day, and an unbounded table of
  // them is a slower lookup on every redeem.
  await client.query(
    `delete from telegram_link_codes
      where expires_at < now() - interval '1 day'`,
  );

  await revokeLinkCodes(client, accountId);

  /*  Uniqueness among LIVE codes, checked here because it cannot be an index
      predicate. Eight attempts, and then it gives up rather than looping: with
      923,521 codes and a live set in the hundreds, eight consecutive
      collisions means something is wrong that a ninth draw will not fix. */
  let code = '';
  let hash = '';
  for (let i = 0; i < 8; i += 1) {
    code = generateLinkCode();
    hash = codeHash(code);
    const clash = await client.query(
      `select 1 from telegram_link_codes
        where code_hash = $1 and consumed_at is null and revoked_at is null and expires_at > now()`,
      [hash],
    );
    if (!clash.rows.length) break;
    code = '';
  }
  if (!code) throw new Error('could not draw an unused link code');

  const rows = await client.query<{ expires_at: string }>(
    `insert into telegram_link_codes (account_id, code_hash, expires_at)
     values ($1, $2, now() + ($3 || ' minutes')::interval)
     returning expires_at`,
    [accountId, hash, String(LINK_CODE_TTL_MINUTES)],
  );

  return {
    code,
    expiresAt: new Date(rows.rows[0].expires_at).toISOString(),
    ttlSeconds: LINK_CODE_TTL_MINUTES * 60,
    sendText: sendTextFor(code),
  };
}

/** Revoke every live code for an account. Returns how many, so the page can
 *  say what happened rather than saying "done". */
export async function revokeLinkCodes(client: Db, accountId: string): Promise<number> {
  const rows = await client.query<{ id: string }>(
    `update telegram_link_codes set revoked_at = now()
      where account_id = $1 and consumed_at is null and revoked_at is null and expires_at > now()
      returning id`,
    [accountId],
  );
  return rows.rows.length;
}

// ----------------------------------------------------------------- redeem

export type RedeemInput = {
  code: string;
  chatId: number;
  telegramUserId: number;
  telegramUsername?: string | null;
};

export type RedeemResult =
  /** Bound now. */
  | { status: 'linked'; accountId: string }
  /** This chat is already on that account. Nothing was consumed and nothing
   *  changed, because re-sending a code should not cost a person their code. */
  | { status: 'already_linked'; accountId: string }
  /** The code is good and this chat belongs to somebody else's account. The
   *  code is UNTOUCHED and moveKey confirms the move. */
  | { status: 'needs_confirmation'; moveKey: string }
  | { status: 'unknown' }
  | { status: 'expired' }
  | { status: 'used' }
  /** Superseded by a newer code, or dropped when the account unlinked. Told
   *  apart from used because the answer is different: the newest code works,
   *  and a person sent back to issue another one they already have will send
   *  the same dead code again. */
  | { status: 'revoked' }
  | { status: 'too_many'; retryAfterSeconds: number };

/** Redeem a code from a chat.
 *
 *  CALL THIS INSIDE A TRANSACTION. The consume and the binding are two
 *  statements and a failure between them would burn a code without linking
 *  anything. The consume is atomic on its own, so the transaction is about the
 *  pair being all or nothing rather than about the race. */
export async function redeemLinkCode(client: Db, input: RedeemInput): Promise<RedeemResult> {
  const blockedFor = await blockedSeconds(client, input.chatId);
  if (blockedFor > 0) return { status: 'too_many', retryAfterSeconds: blockedFor };

  const typed = normaliseLinkCode(input.code);
  if (!isLinkCode(typed)) {
    await countWrongCode(client, input.chatId);
    return { status: 'unknown' };
  }
  const hash = codeHash(typed);

  /*  `for update` locks the row for the caller's transaction, so a second
      redeem of the same code waits here and then finds it consumed. The
      guarantee does not depend on it: the update below carries the same
      guards in its where clause and only one caller can match them. */
  const found = await client.query<{
    id: string; account_id: string; code_hash: string; db_now: string;
    expires_at: string; consumed_at: string | null; revoked_at: string | null;
  }>(
    /*  A live row wins the tie. code_hash is not unique over all history, on
        purpose, and reporting a spent collision as "that code is used" would
        refuse a code that is perfectly good. */
    `select id, account_id, code_hash, expires_at, consumed_at, revoked_at, now() as db_now
       from telegram_link_codes
      where code_hash = $1
      order by (consumed_at is null and revoked_at is null and expires_at > now()) desc, created_at desc
      limit 1
      for update`,
    [hash],
  );

  const row = found.rows[0];
  if (!row || !sameHash(row.code_hash, hash)) {
    await countWrongCode(client, input.chatId);
    return { status: 'unknown' };
  }
  /*  Used, revoked and expired are three different sentences, because they
      have three different answers: send the newest code, issue a code, and
      issue a code faster. None of them names the account it belonged to. */
  if (row.consumed_at) return { status: 'used' };
  if (row.revoked_at) return { status: 'revoked' };
  /*  Against the DATABASE clock, which came back with the row. A serverless
      instance with a skewed clock would otherwise call a live code expired,
      or worse, an expired one live. */
  if (new Date(row.expires_at).getTime() <= new Date(row.db_now).getTime()) return { status: 'expired' };

  const existing = await accountForChat(client, input.chatId);
  if (existing && existing.accountId === row.account_id) {
    await clearWrongCodes(client, input.chatId);
    if (existing.dormant) await wakeChat(client, input.chatId);
    return { status: 'already_linked', accountId: row.account_id };
  }
  if (existing) {
    /*  Rule three. The code is NOT consumed and nothing is written: the chat
        stays on the account it is on until somebody says otherwise. */
    await clearWrongCodes(client, input.chatId);
    return { status: 'needs_confirmation', moveKey: row.id };
  }

  const consumed = await consume(client, row.id, input.chatId);
  if (!consumed) return { status: 'used' };

  await bindChat(client, consumed, input);
  await clearWrongCodes(client, input.chatId);
  return { status: 'linked', accountId: consumed };
}

export type ConfirmInput = Omit<RedeemInput, 'code'> & { moveKey: string };

/** The second, deliberate act that moves a chat from one account to another.
 *  Same guards as a first redeem: the code can still have expired, been
 *  revoked or been used while the button sat in the chat unpressed. */
export async function confirmLinkMove(client: Db, input: ConfirmInput): Promise<RedeemResult> {
  const blockedFor = await blockedSeconds(client, input.chatId);
  if (blockedFor > 0) return { status: 'too_many', retryAfterSeconds: blockedFor };

  /*  The key comes back off a button, so it is shaped before it is used:
      anything else reaches Postgres as `invalid input syntax for type uuid`,
      which aborts the caller's transaction over a stale button. */
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.moveKey)) {
    return { status: 'unknown' };
  }

  const accountId = await consume(client, input.moveKey, input.chatId);
  if (!accountId) return { status: 'used' };

  await bindChat(client, accountId, input);
  await clearWrongCodes(client, input.chatId);
  return { status: 'linked', accountId };
}

/** The one statement that spends a code. Every guard is in the where clause,
 *  so two callers racing on the same code produce one row and one no-op. */
async function consume(client: Db, id: string, chatId: number): Promise<string | null> {
  const rows = await client.query<{ account_id: string }>(
    `update telegram_link_codes
        set consumed_at = now(), consumed_by_chat_id = $2
      where id = $1
        and consumed_at is null
        and revoked_at is null
        and expires_at > now()
      returning account_id`,
    [id, chatId],
  );
  return rows.rows[0]?.account_id ?? null;
}

async function bindChat(client: Db, accountId: string, who: Omit<RedeemInput, 'code'>): Promise<void> {
  /*  A group chat can hold two Telegram users, and the unique index on chat_id
      means the second binding is a rejection rather than a second row. The old
      row goes first, and only after the move has been confirmed above.

      telegram_links is keyed by telegram_user_id, so one person forwards from
      one chat: binding a new chat replaces the chat that person had. That is
      their own act, with a code they asked for and sent, which is why it does
      not need the confirmation a move between ACCOUNTS needs. */
  await client.query(
    'delete from telegram_links where chat_id = $1 and telegram_user_id <> $2',
    [who.chatId, who.telegramUserId],
  );
  await client.query(
    `insert into telegram_links (telegram_user_id, chat_id, account_id, telegram_username)
     values ($1, $2, $3, $4)
     on conflict (telegram_user_id) do update
       set chat_id = excluded.chat_id,
           account_id = excluded.account_id,
           telegram_username = excluded.telegram_username,
           dormant = false,
           linked_at = now()`,
    [who.telegramUserId, who.chatId, accountId, who.telegramUsername ?? null],
  );
}

// ----------------------------------------------------------------- lookup

export type ChatLink = { accountId: string; dormant: boolean; linkedAt: string };

/** Which account owns what this chat sends. The dormant flag is returned
 *  rather than filtered out: blocking the bot marks a link dormant and deletes
 *  nothing, so a person who blocks and unblocks should not have to link again. */
export async function accountForChat(client: Db, chatId: number): Promise<ChatLink | null> {
  const rows = await client.query<{ account_id: string; dormant: boolean; linked_at: string }>(
    'select account_id, dormant, linked_at from telegram_links where chat_id = $1 limit 1',
    [chatId],
  );
  const r = rows.rows[0];
  return r ? { accountId: r.account_id, dormant: r.dormant, linkedAt: new Date(r.linked_at).toISOString() } : null;
}

/** A chat that is talking to the bot is not dormant. */
export async function wakeChat(client: Db, chatId: number): Promise<void> {
  await client.query('update telegram_links set dormant = false where chat_id = $1 and dormant', [chatId]);
}

export type LinkStatus = {
  linked: boolean;
  chats: { username: string | null; dormant: boolean; linkedAt: string }[];
  /** When the account's live code expires, or null. The code itself cannot be
   *  returned: only its HMAC was kept, which is the point. */
  pendingExpiresAt: string | null;
};

export async function linkStatus(client: Db, accountId: string): Promise<LinkStatus> {
  const links = await client.query<{ telegram_username: string | null; dormant: boolean; linked_at: string }>(
    `select telegram_username, dormant, linked_at
       from telegram_links where account_id = $1 order by linked_at desc`,
    [accountId],
  );
  const pending = await client.query<{ expires_at: string }>(
    `select expires_at from telegram_link_codes
      where account_id = $1 and consumed_at is null and revoked_at is null and expires_at > now()
      order by created_at desc limit 1`,
    [accountId],
  );
  return {
    linked: links.rows.length > 0,
    chats: links.rows.map((r) => ({
      username: r.telegram_username,
      dormant: r.dormant,
      linkedAt: new Date(r.linked_at).toISOString(),
    })),
    pendingExpiresAt: pending.rows[0] ? new Date(pending.rows[0].expires_at).toISOString() : null,
  };
}

// ----------------------------------------------------------------- unlink

/** Unlink, from either side: the account unlinks its chats, the bot unlinks
 *  the chat it was sent from.
 *
 *  A delete with neither key is a delete of every link in the product, so it
 *  refuses instead. Bets are never touched, which is what the bot's reply
 *  promises. */
export async function unlinkChat(
  client: Db,
  target: { accountId?: string; chatId?: number },
): Promise<number> {
  const { accountId, chatId } = target;
  if (!accountId && typeof chatId !== 'number') return 0;

  const where: string[] = [];
  const args: unknown[] = [];
  if (accountId) { args.push(accountId); where.push(`account_id = $${args.length}`); }
  if (typeof chatId === 'number') { args.push(chatId); where.push(`chat_id = $${args.length}`); }

  const rows = await client.query<{ chat_id: string }>(
    `delete from telegram_links where ${where.join(' and ')} returning chat_id`,
    args,
  );
  return rows.rows.length;
}

// --------------------------------------------------------- guessing guard

async function blockedSeconds(client: Db, chatId: number): Promise<number> {
  const rows = await client.query<{ seconds: string | number | null }>(
    `select greatest(0, ceil(extract(epoch from (blocked_until - now())))) as seconds
       from telegram_link_attempts where chat_id = $1 and blocked_until > now()`,
    [chatId],
  );
  const s = Number(rows.rows[0]?.seconds ?? 0);
  return Number.isFinite(s) && s > 0 ? Math.ceil(s) : 0;
}

async function countWrongCode(client: Db, chatId: number): Promise<void> {
  const rows = await client.query<{ wrong_count: number }>(
    `insert into telegram_link_attempts (chat_id, wrong_count, window_start)
     values ($1, 1, now())
     on conflict (chat_id) do update
       set wrong_count = case
             when telegram_link_attempts.window_start < now() - ($2 || ' minutes')::interval then 1
             else telegram_link_attempts.wrong_count + 1 end,
           window_start = case
             when telegram_link_attempts.window_start < now() - ($2 || ' minutes')::interval then now()
             else telegram_link_attempts.window_start end
     returning wrong_count`,
    [chatId, String(WRONG_CODE_WINDOW_MINUTES)],
  );
  if (Number(rows.rows[0]?.wrong_count ?? 0) < WRONG_CODE_LIMIT) return;

  // The counter resets with the block, so serving the block does not
  // immediately re-block on the next wrong code.
  await client.query(
    `update telegram_link_attempts
        set blocked_until = now() + ($2 || ' minutes')::interval, wrong_count = 0, window_start = now()
      where chat_id = $1`,
    [chatId, String(WRONG_CODE_BLOCK_MINUTES)],
  );
}

async function clearWrongCodes(client: Db, chatId: number): Promise<void> {
  await client.query('delete from telegram_link_attempts where chat_id = $1', [chatId]);
}
