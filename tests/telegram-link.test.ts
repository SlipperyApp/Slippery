import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { isLinkCode } from '@/lib/server/codes';
import {
  WRONG_CODE_LIMIT, WRONG_CODE_BLOCK_MINUTES, LINK_CODE_TTL_MINUTES,
  accountForChat, confirmLinkMove, issueLinkCode, linkStatus,
  redeemLinkCode, revokeLinkCodes, unlinkChat,
  type Db,
} from '@/lib/server/telegram-link';

/** The boundaries of account linking, against a fake pg client.
 *
 *  Every one of these is a bet written into the wrong person's ledger if it
 *  goes the other way, so they are tested at the edges rather than down the
 *  middle: a code past its expiry, a code sent twice, a code that was never
 *  issued, a chat that already belongs to somebody else, and a chat guessing.
 *
 *  A FAKE CANNOT PROVE THE SQL IS RIGHT. It proves the logic around it, and
 *  it believes whatever the where clauses say. So the guards that actually
 *  hold the line, the ones in the consume statement, are ALSO asserted as
 *  text at the bottom of this file: a fake that stopped honouring
 *  `consumed_at is null` would still pass every test above it. */

type CodeRow = {
  id: string; account_id: string; code_hash: string;
  expires_at: Date; consumed_at: Date | null; consumed_by_chat_id: number | null;
  revoked_at: Date | null; created_at: Date;
};
type LinkRow = {
  telegram_user_id: number; chat_id: number; account_id: string;
  telegram_username: string | null; dormant: boolean; linked_at: Date;
};
type AttemptRow = { chat_id: number; wrong_count: number; window_start: Date; blocked_until: Date | null };

const MINUTE = 60_000;

/** Postgres, in as much detail as these functions can tell. now() is a field,
 *  so expiry is tested by moving the clock rather than by sleeping. */
class FakeDb implements Db {
  now = new Date('2026-09-01T12:00:00.000Z');
  codes: CodeRow[] = [];
  links: LinkRow[] = [];
  attempts: AttemptRow[] = [];
  statements: string[] = [];
  private seq = 0;

  advance(minutes: number) { this.now = new Date(this.now.getTime() + minutes * MINUTE); }

  private live(c: CodeRow) {
    return !c.consumed_at && !c.revoked_at && c.expires_at.getTime() > this.now.getTime();
  }

  private minutesFrom(v: unknown) { return new Date(this.now.getTime() + Number(v) * MINUTE); }

  async query<R = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<{ rows: R[] }> {
    this.statements.push(text);
    const q = text.replace(/\s+/g, ' ').trim().toLowerCase();
    const rows = this.run(q, params) as R[];
    return { rows };
  }

  private run(q: string, p: unknown[]): Record<string, unknown>[] {
    // ------------------------------------------------------------- codes
    if (q.startsWith('delete from telegram_link_codes where expires_at')) {
      this.codes = this.codes.filter((c) => c.expires_at.getTime() >= this.now.getTime() - 24 * 60 * MINUTE);
      return [];
    }
    if (q.startsWith('update telegram_link_codes set revoked_at')) {
      const hit = this.codes.filter((c) => c.account_id === p[0] && this.live(c));
      hit.forEach((c) => { c.revoked_at = this.now; });
      return hit.map((c) => ({ id: c.id }));
    }
    if (q.startsWith('select 1 from telegram_link_codes')) {
      return this.codes.filter((c) => c.code_hash === p[0] && this.live(c)).map(() => ({ '?column?': 1 }));
    }
    if (q.startsWith('insert into telegram_link_codes')) {
      this.seq += 1;
      const row: CodeRow = {
        // gen_random_uuid(), in shape as well as in spirit: the move key is
        // checked against that shape before it reaches the database.
        id: randomUUID(), account_id: String(p[0]), code_hash: String(p[1]),
        expires_at: this.minutesFrom(p[2]), consumed_at: null, consumed_by_chat_id: null,
        revoked_at: null, created_at: this.now,
      };
      this.codes.push(row);
      return [{ expires_at: row.expires_at }];
    }
    if (q.startsWith('select id, account_id, code_hash')) {
      const all = this.codes.filter((c) => c.code_hash === p[0]);
      const sorted = [...all].sort((a, b) => {
        const byLive = Number(this.live(b)) - Number(this.live(a));
        return byLive !== 0 ? byLive : b.created_at.getTime() - a.created_at.getTime();
      });
      return sorted.slice(0, 1).map((c) => ({ ...c, db_now: this.now }));
    }
    if (q.startsWith('update telegram_link_codes set consumed_at')) {
      const c = this.codes.find((x) => x.id === p[0] && this.live(x));
      if (!c) return [];
      c.consumed_at = this.now;
      c.consumed_by_chat_id = Number(p[1]);
      return [{ account_id: c.account_id }];
    }
    if (q.startsWith('select expires_at from telegram_link_codes')) {
      return this.codes.filter((c) => c.account_id === p[0] && this.live(c)).slice(-1)
        .map((c) => ({ expires_at: c.expires_at }));
    }

    // ------------------------------------------------------------- links
    if (q.startsWith('select account_id, dormant, linked_at from telegram_links')) {
      return this.links.filter((l) => l.chat_id === Number(p[0])).slice(0, 1)
        .map((l) => ({ account_id: l.account_id, dormant: l.dormant, linked_at: l.linked_at }));
    }
    if (q.startsWith('update telegram_links set dormant = false')) {
      this.links.filter((l) => l.chat_id === Number(p[0])).forEach((l) => { l.dormant = false; });
      return [];
    }
    if (q.startsWith('delete from telegram_links where chat_id = $1 and telegram_user_id')) {
      this.links = this.links.filter((l) => !(l.chat_id === Number(p[0]) && l.telegram_user_id !== Number(p[1])));
      return [];
    }
    if (q.startsWith('insert into telegram_links')) {
      const existing = this.links.find((l) => l.telegram_user_id === Number(p[0]));
      if (existing) {
        existing.chat_id = Number(p[1]);
        existing.account_id = String(p[2]);
        existing.telegram_username = (p[3] as string | null) ?? null;
        existing.dormant = false;
        existing.linked_at = this.now;
      } else {
        this.links.push({
          telegram_user_id: Number(p[0]), chat_id: Number(p[1]), account_id: String(p[2]),
          telegram_username: (p[3] as string | null) ?? null, dormant: false, linked_at: this.now,
        });
      }
      /*  The unique index on chat_id, which is the whole point of it. A fake
          that let two rows share a chat_id would pass a test the database
          would refuse. */
      const chats = this.links.map((l) => l.chat_id);
      assert.equal(new Set(chats).size, chats.length, 'two links share one chat_id');
      return [];
    }
    if (q.startsWith('select telegram_username')) {
      return this.links.filter((l) => l.account_id === p[0])
        .map((l) => ({ telegram_username: l.telegram_username, dormant: l.dormant, linked_at: l.linked_at }));
    }
    if (q.startsWith('delete from telegram_links where')) {
      const byAccount = q.includes('account_id = $1');
      const chatArg = byAccount ? p[1] : p[0];
      const gone = this.links.filter((l) => (!byAccount || l.account_id === p[0])
        && (chatArg === undefined || l.chat_id === Number(chatArg)));
      this.links = this.links.filter((l) => !gone.includes(l));
      return gone.map((l) => ({ chat_id: l.chat_id }));
    }

    // ---------------------------------------------------------- attempts
    if (q.includes('from telegram_link_attempts where chat_id = $1 and blocked_until')) {
      const a = this.attempts.find((x) => x.chat_id === Number(p[0]));
      if (!a?.blocked_until || a.blocked_until.getTime() <= this.now.getTime()) return [];
      return [{ seconds: Math.ceil((a.blocked_until.getTime() - this.now.getTime()) / 1000) }];
    }
    if (q.startsWith('insert into telegram_link_attempts')) {
      const windowMs = Number(p[1]) * MINUTE;
      let a = this.attempts.find((x) => x.chat_id === Number(p[0]));
      if (!a) {
        a = { chat_id: Number(p[0]), wrong_count: 1, window_start: this.now, blocked_until: null };
        this.attempts.push(a);
      } else if (a.window_start.getTime() < this.now.getTime() - windowMs) {
        a.wrong_count = 1;
        a.window_start = this.now;
      } else {
        a.wrong_count += 1;
      }
      return [{ wrong_count: a.wrong_count }];
    }
    if (q.startsWith('update telegram_link_attempts')) {
      const a = this.attempts.find((x) => x.chat_id === Number(p[0]));
      if (a) { a.blocked_until = this.minutesFrom(p[1]); a.wrong_count = 0; a.window_start = this.now; }
      return [];
    }
    if (q.startsWith('delete from telegram_link_attempts')) {
      this.attempts = this.attempts.filter((x) => x.chat_id !== Number(p[0]));
      return [];
    }

    throw new Error(`the fake has no answer for: ${q.slice(0, 80)}`);
  }
}

const ROWAN = '11111111-1111-1111-1111-111111111111';
const MAYA = '22222222-2222-2222-2222-222222222222';

const chat = (id: number) => ({ chatId: id, telegramUserId: id, telegramUsername: 'rowan' });

// ------------------------------------------------------------------ issue

test('an issued code is in the one format the bot validates, and the code itself is never stored', async () => {
  const db = new FakeDb();
  const issued = await issueLinkCode(db, ROWAN);

  assert.ok(isLinkCode(issued.code), `${issued.code} would be rejected by the bot`);
  assert.equal(issued.sendText, `/start ${issued.code}`);
  assert.equal(issued.ttlSeconds, LINK_CODE_TTL_MINUTES * 60);

  // The row holds an HMAC. A dump of this table hands nobody a working code.
  assert.equal(db.codes.length, 1);
  assert.notEqual(db.codes[0].code_hash, issued.code);
  assert.ok(!db.codes[0].code_hash.includes(issued.code.replace('SLIP-', '')));
  assert.match(db.codes[0].code_hash, /^[0-9a-f]{64}$/);
});

test('the status a page can read carries the code nowhere', async () => {
  const db = new FakeDb();
  const issued = await issueLinkCode(db, ROWAN);
  const status = await linkStatus(db, ROWAN);
  // Only the HMAC was kept, so this is a property of the storage rather than
  // of the serialiser: there is nothing to leak.
  assert.ok(!JSON.stringify(status).includes(issued.code));
  assert.equal(status.linked, false);
  assert.ok(status.pendingExpiresAt);
});

// ----------------------------------------------------------------- redeem

test('a fresh code links the chat that sends it to the account that issued it', async () => {
  const db = new FakeDb();
  const issued = await issueLinkCode(db, ROWAN);

  const result = await redeemLinkCode(db, { code: issued.code, ...chat(500) });
  assert.deepEqual(result, { status: 'linked', accountId: ROWAN });
  assert.deepEqual(await accountForChat(db, 500), {
    accountId: ROWAN, dormant: false, linkedAt: db.now.toISOString(),
  });
  assert.equal(db.codes[0].consumed_by_chat_id, 500);
});

test('a code typed without its prefix, and in lower case, still redeems', async () => {
  const db = new FakeDb();
  const issued = await issueLinkCode(db, ROWAN);
  const bare = issued.code.replace('SLIP-', '').toLowerCase();

  assert.deepEqual(await redeemLinkCode(db, { code: bare, ...chat(501) }), { status: 'linked', accountId: ROWAN });
});

test('replaying a consumed code writes nothing the second time', async () => {
  const db = new FakeDb();
  const issued = await issueLinkCode(db, ROWAN);
  await redeemLinkCode(db, { code: issued.code, ...chat(500) });

  const again = await redeemLinkCode(db, { code: issued.code, chatId: 900, telegramUserId: 900 });
  assert.deepEqual(again, { status: 'used' });
  assert.equal(await accountForChat(db, 900), null, 'a replayed code must not bind a second chat');
  assert.equal(db.links.length, 1);
});

test('a code past its expiry links nothing', async () => {
  const db = new FakeDb();
  const issued = await issueLinkCode(db, ROWAN);

  db.advance(LINK_CODE_TTL_MINUTES + 1);
  assert.deepEqual(await redeemLinkCode(db, { code: issued.code, ...chat(500) }), { status: 'expired' });
  assert.equal(await accountForChat(db, 500), null);

  // And one second inside the window still works, which is the other half of
  // the boundary: an off by one here locks people out of their own accounts.
  const db2 = new FakeDb();
  const fresh = await issueLinkCode(db2, ROWAN);
  db2.advance(LINK_CODE_TTL_MINUTES - 1);
  assert.equal((await redeemLinkCode(db2, { code: fresh.code, ...chat(501) })).status, 'linked');
});

test('a code that was never issued links nothing and is not confused for a real one', async () => {
  const db = new FakeDb();
  await issueLinkCode(db, ROWAN);

  assert.deepEqual(await redeemLinkCode(db, { code: 'SLIP-2222', ...chat(500) }), { status: 'unknown' });
  assert.deepEqual(await redeemLinkCode(db, { code: 'not a code at all', ...chat(500) }), { status: 'unknown' });
  assert.equal(db.links.length, 0);
});

test('issuing a second code kills the first, and says so rather than saying it was used', async () => {
  const db = new FakeDb();
  const first = await issueLinkCode(db, ROWAN);
  const second = await issueLinkCode(db, ROWAN);

  assert.deepEqual(await redeemLinkCode(db, { code: first.code, ...chat(500) }), { status: 'revoked' });
  assert.equal((await redeemLinkCode(db, { code: second.code, ...chat(500) })).status, 'linked');
});

test('a revoked code is dead even though nobody ever used it', async () => {
  const db = new FakeDb();
  const issued = await issueLinkCode(db, ROWAN);
  assert.equal(await revokeLinkCodes(db, ROWAN), 1);

  assert.deepEqual(await redeemLinkCode(db, { code: issued.code, ...chat(500) }), { status: 'revoked' });
  assert.equal(db.links.length, 0);
});

// ------------------------------------------------------- the moving chat

test('a chat already linked to another account is never re-bound by a message', async () => {
  const db = new FakeDb();
  const mine = await issueLinkCode(db, ROWAN);
  await redeemLinkCode(db, { code: mine.code, ...chat(500) });

  const hers = await issueLinkCode(db, MAYA);
  const result = await redeemLinkCode(db, { code: hers.code, ...chat(500) });

  assert.equal(result.status, 'needs_confirmation');
  // The chat has not moved AND the code has not been spent: a person who
  // sends a code to the wrong chat has not lost the code.
  assert.equal((await accountForChat(db, 500))?.accountId, ROWAN);
  assert.equal(db.codes.find((c) => c.account_id === MAYA)?.consumed_at, null);
});

test('confirming the move binds the chat once, and the code is spent by the confirmation', async () => {
  const db = new FakeDb();
  const mine = await issueLinkCode(db, ROWAN);
  await redeemLinkCode(db, { code: mine.code, ...chat(500) });
  const hers = await issueLinkCode(db, MAYA);
  const asked = await redeemLinkCode(db, { code: hers.code, ...chat(500) });
  assert.equal(asked.status, 'needs_confirmation');
  const moveKey = asked.status === 'needs_confirmation' ? asked.moveKey : '';

  assert.deepEqual(await confirmLinkMove(db, { moveKey, ...chat(500) }), { status: 'linked', accountId: MAYA });
  assert.equal((await accountForChat(db, 500))?.accountId, MAYA);
  assert.equal(db.links.length, 1, 'one chat, one row');

  // Pressing the button twice does not move it back and forth.
  assert.deepEqual(await confirmLinkMove(db, { moveKey, ...chat(500) }), { status: 'used' });
});

test('a confirmation pressed after the code expired moves nothing', async () => {
  const db = new FakeDb();
  const mine = await issueLinkCode(db, ROWAN);
  await redeemLinkCode(db, { code: mine.code, ...chat(500) });
  const hers = await issueLinkCode(db, MAYA);
  const asked = await redeemLinkCode(db, { code: hers.code, ...chat(500) });
  const moveKey = asked.status === 'needs_confirmation' ? asked.moveKey : '';

  db.advance(LINK_CODE_TTL_MINUTES + 1);
  assert.deepEqual(await confirmLinkMove(db, { moveKey, ...chat(500) }), { status: 'used' });
  assert.equal((await accountForChat(db, 500))?.accountId, ROWAN);
});

test('a chat sending its own account a second code keeps the code it has', async () => {
  const db = new FakeDb();
  const first = await issueLinkCode(db, ROWAN);
  await redeemLinkCode(db, { code: first.code, ...chat(500) });
  const second = await issueLinkCode(db, ROWAN);

  const again = await redeemLinkCode(db, { code: second.code, ...chat(500) });
  assert.deepEqual(again, { status: 'already_linked', accountId: ROWAN });
  assert.equal(db.codes[1].consumed_at, null, 'nothing changed, so nothing is spent');
});

test('a button carrying something that is not a code id moves nothing', async () => {
  const db = new FakeDb();
  const issued = await issueLinkCode(db, ROWAN);
  await redeemLinkCode(db, { code: issued.code, ...chat(500) });

  // A stale or mangled callback must not reach Postgres as a uuid cast, which
  // aborts the transaction the caller is holding open.
  assert.deepEqual(await confirmLinkMove(db, { moveKey: 'tglink', ...chat(500) }), { status: 'unknown' });
  assert.equal((await accountForChat(db, 500))?.accountId, ROWAN);
});

// ------------------------------------------------------- unlink, relink

test('unlink then relink is the whole loop, and unlinking touches nothing else', async () => {
  const db = new FakeDb();
  const first = await issueLinkCode(db, ROWAN);
  await redeemLinkCode(db, { code: first.code, ...chat(500) });

  assert.equal(await unlinkChat(db, { accountId: ROWAN }), 1);
  assert.equal(await accountForChat(db, 500), null);
  assert.equal((await linkStatus(db, ROWAN)).linked, false);

  const second = await issueLinkCode(db, ROWAN);
  assert.equal((await redeemLinkCode(db, { code: second.code, ...chat(500) })).status, 'linked');
  assert.equal((await linkStatus(db, ROWAN)).linked, true);
  assert.equal(db.links.length, 1);
});

test('the bot unlinks the chat it was sent from, and only that chat', async () => {
  const db = new FakeDb();
  const a = await issueLinkCode(db, ROWAN);
  await redeemLinkCode(db, { code: a.code, ...chat(500) });
  const b = await issueLinkCode(db, ROWAN);
  await redeemLinkCode(db, { code: b.code, chatId: 600, telegramUserId: 600 });

  assert.equal(await unlinkChat(db, { chatId: 500 }), 1);
  assert.equal(await accountForChat(db, 500), null);
  assert.equal((await accountForChat(db, 600))?.accountId, ROWAN);
});

test('an unlink with no key deletes nothing at all', async () => {
  const db = new FakeDb();
  const issued = await issueLinkCode(db, ROWAN);
  await redeemLinkCode(db, { code: issued.code, ...chat(500) });

  assert.equal(await unlinkChat(db, {}), 0);
  assert.equal(db.links.length, 1, 'a delete with no key would take every link in the product');
  assert.ok(!db.statements.some((s) => /delete from telegram_links where\s+returning/.test(s)));
});

// ------------------------------------------------------- guessing guard

test('a chat working through the code space is stopped, and a right code cannot walk past the block', async () => {
  const db = new FakeDb();
  const issued = await issueLinkCode(db, ROWAN);

  for (let i = 0; i < WRONG_CODE_LIMIT; i += 1) {
    assert.deepEqual(await redeemLinkCode(db, { code: 'SLIP-3333', ...chat(500) }), { status: 'unknown' });
  }

  const blocked = await redeemLinkCode(db, { code: issued.code, ...chat(500) });
  assert.equal(blocked.status, 'too_many');
  assert.ok(blocked.status === 'too_many' && blocked.retryAfterSeconds > 0);
  assert.equal(db.links.length, 0, 'a blocked chat links nothing, correct code or not');

  /*  The block lifts. The code it was blocked from has expired by then, which
      is what a block as long as a code's life means: the person issues
      another one, which is one press, and the guesser has bought nothing. */
  db.advance(WRONG_CODE_BLOCK_MINUTES + 1);
  const fresh = await issueLinkCode(db, ROWAN);
  assert.equal((await redeemLinkCode(db, { code: fresh.code, ...chat(500) })).status, 'linked');
});

test('the count is per chat, so one guesser cannot lock out anybody else', async () => {
  const db = new FakeDb();
  const issued = await issueLinkCode(db, ROWAN);
  for (let i = 0; i < WRONG_CODE_LIMIT; i += 1) {
    await redeemLinkCode(db, { code: 'SLIP-3333', chatId: 700, telegramUserId: 700 });
  }

  assert.equal((await redeemLinkCode(db, { code: 'SLIP-3333', chatId: 700, telegramUserId: 700 })).status, 'too_many');
  assert.equal((await redeemLinkCode(db, { code: issued.code, ...chat(500) })).status, 'linked');
});

test('a wrong code by a linked chat does not cost that chat its link', async () => {
  const db = new FakeDb();
  const issued = await issueLinkCode(db, ROWAN);
  await redeemLinkCode(db, { code: issued.code, ...chat(500) });

  for (let i = 0; i < WRONG_CODE_LIMIT + 1; i += 1) {
    await redeemLinkCode(db, { code: 'SLIP-3333', ...chat(500) });
  }
  assert.equal((await accountForChat(db, 500))?.accountId, ROWAN);
});

// ------------------------------------------- what the fake cannot prove

test('the statement that spends a code carries every guard in its where clause', async () => {
  const db = new FakeDb();
  const issued = await issueLinkCode(db, ROWAN);
  await redeemLinkCode(db, { code: issued.code, ...chat(500) });

  const consume = db.statements.find((s) => /update telegram_link_codes\s+set consumed_at/.test(s));
  assert.ok(consume, 'no statement consumed the code');
  /*  One statement, and the guards are IN it. Reading the row, deciding in
      JavaScript and then writing is the same code redeemed twice by two
      requests that both read before either wrote. */
  for (const guard of ['consumed_at is null', 'revoked_at is null', 'expires_at > now()', 'where id = $1']) {
    assert.ok(consume.includes(guard), `the consume statement lost its guard: ${guard}`);
  }

  const select = db.statements.find((s) => /select id, account_id, code_hash/.test(s));
  assert.ok(select?.includes('for update'), 'the row is read without locking it');

  // now() is the database clock everywhere. A serverless instance with a
  // skewed clock must not be able to decide what is expired.
  for (const s of db.statements) assert.ok(!/expires_at\s*[<>]\s*\$/.test(s), `expiry compared to a parameter: ${s}`);
});
