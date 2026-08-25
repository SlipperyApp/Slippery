import 'server-only';
import { eq, and, desc, asc, gte, lte, sql } from 'drizzle-orm';
import { schema } from '@/lib/db';
import { recomputeState, turnoverPence } from '@/lib/db/recompute';
import { isTransitionToSettled } from '../settled-rule';
import type { EventInput } from '@/lib/db/recompute';

/* Writing an event and its derived state, together, always.
 *
 * This is the only path by which `settlement_events` gains a row, and the
 * only path by which `bet_state` is written. Both happen in one transaction,
 * so there is never a moment where the log and the view disagree. An audit
 * row goes in with them, carrying whether the change landed after the result
 * was already known, which is what the group leaderboard's late-edit flag
 * reads.
 */
export async function appendEvent(
  tx: any,
  betId: string,
  event: Omit<EventInput, 'seq'> & { occurredAt?: Date; enteredBy?: string; note?: string; afterResultKnown?: boolean },
) {
  const [bet] = await tx.select().from(schema.bets).where(eq(schema.bets.id, betId)).limit(1);
  if (!bet) throw new Error('no such bet');

  const existing = await tx.select().from(schema.settlementEvents)
    .where(eq(schema.settlementEvents.betId, betId))
    .orderBy(asc(schema.settlementEvents.seq));

  const seq = (existing.at(-1)?.seq ?? 0) + 1;

  await tx.insert(schema.settlementEvents).values({
    betId,
    seq,
    type: event.type,
    fractionEighths: event.fractionEighths ?? null,
    stakePortionPence: event.stakePortionPence ?? null,
    odds: event.odds != null ? String(event.odds) : null,
    returnedPence: event.returnedPence ?? null,
    occurredAt: event.occurredAt ?? new Date(),
    enteredBy: event.enteredBy ?? 'system',
    afterResultKnown: event.afterResultKnown ?? false,
    note: event.note ?? null,
  });

  const [account] = await tx.select({ unitPence: schema.accounts.unitPence })
    .from(schema.accounts).where(eq(schema.accounts.id, bet.accountId)).limit(1);

  /* 17 · Read before the fold overwrites it. A recompute over an already
     settled bet also returns 'settled', so without the previous value there is
     no way to tell a settlement from a re-fold — and the bot would announce
     the same bet every time anything touched it. */
  const [priorState] = await tx.select({ status: schema.betState.status })
    .from(schema.betState).where(eq(schema.betState.betId, betId)).limit(1);
  const previousStatus: string | null = priorState?.status ?? null;

  /* THE RATE THE BET WAS PLACED AT, not the bookmaker's rate today.
     `bets.commission_pct` is resolved once at placement precisely so that
     editing a bookmaker's rate later cannot walk back through settled P&L and
     change it. The bookmaker is a fallback only for bets written before that
     column existed. */
  let commissionPct: number | null =
    bet.commissionPct != null ? Number(bet.commissionPct) : null;
  if (commissionPct == null && bet.bookmakerId) {
    const [book] = await tx.select({ pct: schema.bookmakers.commissionPct })
      .from(schema.bookmakers).where(eq(schema.bookmakers.id, bet.bookmakerId)).limit(1);
    commissionPct = book?.pct != null ? Number(book.pct) : null;
  }

  const all: EventInput[] = [...existing, { ...event, seq }].map((e: any) => ({
    seq: e.seq,
    type: e.type,
    fractionEighths: e.fractionEighths ?? null,
    stakePortionPence: e.stakePortionPence ?? null,
    odds: e.odds != null ? Number(e.odds) : null,
    returnedPence: e.returnedPence ?? null,
  }));

  const state = recomputeState({
    stakePence: bet.stakePence,
    liabilityPence: bet.liabilityPence,
    side: bet.side,
    odds: bet.odds != null ? Number(bet.odds) : null,
    isFreeBet: bet.isFreeBet,
    /* THE UNIT FREEZE, HONOURED.
       `bets.unit_at_placement_pence` was added and backfilled so that raising
       your unit from £25 to £50 cannot halve every figure in your history —
       January's +10.0u silently becoming +5.0u. The column was being written
       and then ignored right here, so the bug it exists to prevent was still
       live: this fold ran on the account's CURRENT unit and rewrote the past
       on every recompute. The account value is a fallback only, for bets that
       predate the column. */
    unitPence: bet.unitAtPlacementPence ?? account?.unitPence ?? null,
    commissionPct,
    arbGroupId: bet.arbGroupId,
    source: bet.source,
  }, all);

  await tx.insert(schema.betState).values({
    betId,
    status: state.status,
    remainingStakePence: state.remainingStakePence,
    realisedPlPence: state.realisedPlPence,
    returnedPence: state.returnedPence,
    voidedStakePence: state.voidedStakePence,
    units: state.units != null ? String(state.units) : null,
    countsInStats: state.countsInStats,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: schema.betState.betId,
    set: {
      status: state.status,
      remainingStakePence: state.remainingStakePence,
      realisedPlPence: state.realisedPlPence,
      returnedPence: state.returnedPence,
      voidedStakePence: state.voidedStakePence,
      units: state.units != null ? String(state.units) : null,
      countsInStats: state.countsInStats,
      updatedAt: new Date(),
    },
  });

  await tx.insert(schema.auditLog).values({
    accountId: bet.accountId,
    entity: 'bet',
    entityId: betId,
    action: 'settlement_event:' + event.type,
    after: { type: event.type, seq, state },
    source: event.enteredBy ?? 'system',
    afterResultKnown: event.afterResultKnown ?? false,
  });

  /* 17 · Announce it, but never from inside the transaction. Telegram being
     slow or down must not be able to roll back a settlement, so the caller is
     handed the fact and the send happens after the commit. */
  return Object.assign(state, {
    justSettled: isTransitionToSettled(previousStatus, state.status),
    accountId: bet.accountId as string,
    betName: (bet.eventName ?? bet.selection ?? 'Your bet') as string,
  });
}

/* Cash out is a slider in eighths OF REMAINING STAKE, relabelled after each
   pull. This turns the pull into the event. */
export function cashOutPortion(remainingStakePence: number, eighths: number) {
  const e = Math.max(1, Math.min(8, Math.round(eighths)));
  return { eighths: e, portionPence: Math.round((remainingStakePence * e) / 8) };
}

export { turnoverPence };
