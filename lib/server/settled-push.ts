import 'server-only';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { sendMessage } from './telegram';
import { settledLine } from './bot-voice';
import { londonDayStart, londonDayEnd } from './periods';
import { isTransitionToSettled, BATCH_MS } from '../settled-rule';

/* 17 · THE MESSAGE THAT WAS NEVER SENT.
 *
 * `settledLine()` has existed in bot-voice.ts since the bot was written and
 * nothing has ever called it. A bet finishing is the highest-attention moment
 * this product has and it happened in silence.
 *
 * WHY THIS HANGS OFF `appendEvent` AND NOT THE CRON. Nothing grades
 * automatically: `api/cron/results` deliberately only counts what is awaiting
 * a result, on the rule that a wrong grade is worse than no grade. The single
 * place a bet actually becomes settled is the settlement fold, which already
 * knows the transition — so that is where this belongs.
 *
 * THREE THINGS IT MUST NOT DO.
 *   · It must not run inside the settlement transaction. Telegram being slow
 *     or down cannot be allowed to roll back a settlement, so this is called
 *     after the commit and every failure is swallowed.
 *   · It must not fire on a recompute. Only a transition INTO settled counts;
 *     re-folding a bet that was already settled must send nothing.
 *   · It must not fire five times for a five-fold. See the batch window.
 */

/* THE BATCH WINDOW. A multiple's legs settle within a second or two of each
   other, and one message per leg is how a bot gets muted. Held in memory
   rather than a table: the cost of losing the window on a cold start is one
   extra message, which is a far cheaper failure than a migration. */
const PENDING = new Map<string, { lines: string[]; timer: NodeJS.Timeout }>();

/* Re-exported so the fold and the route import one thing. The rule itself is
   pure and lives in lib/settled-rule.ts, where a test reaches it without
   dragging a database connection in behind it. */
export { isTransitionToSettled, BATCH_MS };

export type SettledPush = {
  accountId: string;
  betName: string;
  realisedPlPence: number;
  todayPlPence: number;
};


export async function queueSettledPush(push: SettledPush): Promise<void> {
  const line = settledLine(push.betName, push.realisedPlPence, push.todayPlPence);
  const held = PENDING.get(push.accountId);
  if (held) {
    held.lines.push(line);
    return;                       // the running timer will carry it
  }
  const entry = {
    lines: [line],
    timer: setTimeout(() => { void flush(push.accountId); }, BATCH_MS),
  };
  /* Never keep the process alive for a pending message. */
  entry.timer.unref?.();
  PENDING.set(push.accountId, entry);
}

async function flush(accountId: string): Promise<void> {
  const held = PENDING.get(accountId);
  PENDING.delete(accountId);
  if (!held?.lines.length) return;
  try {
    const db = getDb();
    const [link] = await db.select({ chatId: schema.telegramLinks.chatId })
      .from(schema.telegramLinks)
      .where(and(
        eq(schema.telegramLinks.accountId, accountId),
        eq(schema.telegramLinks.dormant, false),
      ))
      .limit(1);
    if (!link?.chatId) return;    // not linked, or they blocked the bot
    await sendMessage(link.chatId, held.lines.join('\n'));
  } catch {
    /* A settlement is already recorded. Failing to announce it is not worth
       an error anywhere a person will see. */
  }
}

/* Today's net, for the second half of the message — "FT Arsenal v Spurs
   +£9.00 · today +£34.00". Uses `event_at` and the London day, like every
   other period in the product: a 00:30 kick-off belongs to the day the
   fixture is listed under, and computing it in UTC is how a late Tuesday tie
   lands in Wednesday's column. */
export async function todayNetPence(accountId: string): Promise<number> {
  const db = getDb();
  const now = new Date();
  const [row] = await db
    .select({ net: sql<number>`coalesce(sum(${schema.betState.realisedPlPence}), 0)` })
    .from(schema.betState)
    .innerJoin(schema.bets, eq(schema.bets.id, schema.betState.betId))
    .where(and(
      eq(schema.bets.accountId, accountId),
      gte(schema.bets.eventAt, londonDayStart(now)),
      lte(schema.bets.eventAt, londonDayEnd(now)),
    ));
  return Number(row?.net ?? 0);
}

/* For tests, and for a graceful shutdown. */
export async function flushAllForTest(): Promise<void> {
  for (const [id, held] of [...PENDING]) {
    clearTimeout(held.timer);
    await flush(id);
  }
}
export function pendingCountForTest(): number { return PENDING.size; }
export function heldLinesForTest(accountId: string): string[] {
  return PENDING.get(accountId)?.lines ?? [];
}
