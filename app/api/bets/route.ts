import { NextRequest } from 'next/server';
import { eq, and, desc, gte, lte, sql, inArray } from 'drizzle-orm';
import { getDb, schema, dbReady } from '@/lib/db';
import { viewer } from '@/lib/server/session';
import { ok, fail, unauthorised, noDatabase, readJson } from '@/lib/server/http';
import { appendEvent } from '@/lib/server/bets';
import { canonicalMarket } from '@/lib/server/markets';
import { periodRange, type PeriodKey } from '@/lib/server/periods';
import { betProblems } from '@/lib/server/betshape';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/* THE LEDGER, FROM ONE QUERY.
 *
 * The old app's counts disagreed with each other: the banner said 486 bets,
 * the ledger listed 482 and the facets summed to 474, because each was its
 * own query with its own filter. Here the filtered set is built once and the
 * rows, the summary and the facets are all derived from it, so the facet
 * total equals the row total by construction rather than by luck. */
export async function GET(req: NextRequest) {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();

  const url = new URL(req.url);
  const period = (url.searchParams.get('period') || 'M') as PeriodKey;
  const { from, to } = periodRange(period, account.weekStart, url.searchParams.get('from'), url.searchParams.get('to'));

  const db = getDb();
  const rows = await db
    .select({ bet: schema.bets, state: schema.betState, bookmaker: schema.bookmakers.name })
    .from(schema.bets)
    .leftJoin(schema.betState, eq(schema.betState.betId, schema.bets.id))
    .leftJoin(schema.bookmakers, eq(schema.bookmakers.id, schema.bets.bookmakerId))
    /* event_at, never placed_at. A Friday-night bet on a Saturday fixture
       belongs to Saturday, or the weekly total is wrong for everyone who
       bets ahead. */
    .where(and(eq(schema.bets.accountId, account.id), gte(schema.bets.eventAt, from), lte(schema.bets.eventAt, to)))
    .orderBy(desc(schema.bets.eventAt))
    .limit(2000);

  const legs = rows.length
    ? await db.select().from(schema.betLegs).where(
        sql`${schema.betLegs.betId} IN ${rows.map((r) => r.bet.id)}`)
    : [];
  const legsByBet = new Map<string, typeof legs>();
  for (const l of legs) {
    const list = legsByBet.get(l.betId) ?? [];
    list.push(l);
    legsByBet.set(l.betId, list);
  }

  const plRows = await db.select().from(schema.plEntries)
    .where(and(
      eq(schema.plEntries.accountId, account.id),
      gte(schema.plEntries.entryDate, from.toISOString().slice(0, 10)),
      lte(schema.plEntries.entryDate, to.toISOString().slice(0, 10)),
    ));

  return ok({
    period,
    from: from.toISOString(),
    to: to.toISOString(),
    bets: rows.map((r) => shape(r, legsByBet.get(r.bet.id) ?? [])),
    /* Figures with no slip behind them, alongside rather than folded in, so
       the win rate and the streaks can honestly exclude them. */
    plEntries: plRows.map((p) => ({
      id: p.id, date: p.entryDate, amountPence: p.amountPence,
      stakePence: p.stakePence, note: p.note, source: p.source,
    })),
  });
}

function shape(r: { bet: typeof schema.bets.$inferSelect; state: typeof schema.betState.$inferSelect | null; bookmaker: string | null }, legs: (typeof schema.betLegs.$inferSelect)[]) {
  const { bet, state } = r;
  return {
    id: bet.id,
    shape: bet.shape,
    side: bet.side,
    stakePence: bet.stakePence,
    liabilityPence: bet.liabilityPence,
    odds: bet.odds != null ? Number(bet.odds) : null,
    currency: bet.currency,
    bookmaker: r.bookmaker,
    eventName: bet.eventName,
    selection: bet.selection,
    market: bet.marketRaw,
    marketGroup: bet.marketRaw ? canonicalMarket(bet.marketRaw) : null,
    eventAt: bet.eventAt,
    placedAt: bet.placedAt,
    isFreeBet: bet.isFreeBet,
    isEachWay: bet.isEachWay,
    isAntepost: bet.isAntepost,
    /* Where it came from, kept rather than collapsed. A row imported from a
       spreadsheet and a row lifted off a forwarded slip mean different
       things and must not look identical in the ledger. */
    source: bet.source,
    slipBacked: bet.slipBacked,
    arbGroupId: bet.arbGroupId,
    note: bet.note,
    legs: legs.sort((a, b) => a.seq - b.seq).map((l) => ({
      seq: l.seq, selection: l.selection, market: l.marketRaw,
      eventName: l.eventName, odds: l.legOdds != null ? Number(l.legOdds) : null,
      result: l.legResult,
    })),
    /* Every figure reads bet_state. Nothing here reads settlement_events. */
    status: state?.status ?? 'open',
    remainingStakePence: state?.remainingStakePence ?? bet.stakePence,
    realisedPlPence: state?.realisedPlPence ?? 0,
    returnedPence: state?.returnedPence ?? 0,
    voidedStakePence: state?.voidedStakePence ?? 0,
    units: state?.units != null ? Number(state.units) : null,
    countsInStats: state?.countsInStats ?? true,
  };
}

/* Logging a bet. Manual and shop bets are first class: they set
   `slip_backed = false`, which is what group verification filters on, and
   they are otherwise identical to one read off a slip. */
export async function POST(req: NextRequest) {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();

  const body = await readJson<any>(req);
  const problems = betProblems(body);
  if (problems.length) return fail(400, problems[0]);

  const db = getDb();
  const created = await db.transaction(async (tx) => {
    const [bet] = await tx.insert(schema.bets).values({
      accountId: account.id,
      shape: body.shape || (Array.isArray(body.legs) && body.legs.length > 1 ? 'multi_cross_fixture' : 'single'),
      side: body.side === 'lay' ? 'lay' : 'back',
      stakePence: Math.round(Number(body.stakePence)),
      liabilityPence: body.side === 'lay' ? Math.round(Number(body.liabilityPence)) : null,
      odds: body.odds != null ? String(body.odds) : null,
      currency: body.currency === 'EUR' ? 'EUR' : 'GBP',
      bookmakerId: body.bookmakerId ?? null,
      tipsterId: body.tipsterId ?? null,
      sportId: body.sportId ?? null,
      competition: body.competition ?? null,
      course: body.course ?? null,
      eventName: body.eventName ?? null,
      selection: body.selection ?? null,
      marketRaw: body.market ?? null,
      eventAt: new Date(body.eventAt),
      placedAt: new Date(body.placedAt || body.eventAt),
      expectedSettleAt: body.expectedSettleAt ? new Date(body.expectedSettleAt) : null,
      isFreeBet: Boolean(body.isFreeBet),
      isEachWay: Boolean(body.isEachWay),
      ewPlaceFraction: body.ewPlaceFraction ?? null,
      isAntepost: Boolean(body.isAntepost),
      slipBacked: Boolean(body.slipBacked),
      source: body.source || 'manual',
      note: body.note ?? null,
    }).returning();

    if (Array.isArray(body.legs) && body.legs.length) {
      await tx.insert(schema.betLegs).values(
        body.legs.map((l: any, i: number) => ({
          betId: bet.id,
          seq: i + 1,
          selection: l.selection ?? null,
          marketRaw: l.market ?? null,
          eventName: l.eventName ?? null,
          legOdds: l.odds != null ? String(l.odds) : null,
        })),
      );
    }

    /* Every bet opens with a `placed` event, so `bet_state` exists from the
       first moment and no figure has to special-case its absence. */
    await appendEvent(tx, bet.id, { type: 'placed', enteredBy: body.source || 'manual' });
    return bet;
  });

  return ok({ id: created.id });
}

/* Deleting a selection from the ledger. One statement rather than a loop, and
   scoped to the account in the same WHERE, so a crafted list of ids cannot
   reach anybody else's bets. */
export async function DELETE(req: NextRequest) {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();

  const body = await readJson<{ ids?: string[] }>(req);
  const ids = Array.isArray(body.ids) ? body.ids.filter((i) => typeof i === 'string').slice(0, 500) : [];
  if (!ids.length) return fail(400, 'Nothing selected.');

  const db = getDb();
  const gone = await db.delete(schema.bets)
    .where(and(eq(schema.bets.accountId, account.id), inArray(schema.bets.id, ids)))
    .returning({ id: schema.bets.id });

  await db.insert(schema.auditLog).values({
    accountId: account.id, entity: 'bet', entityId: null,
    action: 'delete_many', source: 'user', after: { deleted: gone.length, asked: ids.length },
  });

  /* Both numbers. "3 deleted" when four were selected is how somebody
     discovers a leftover row a week later. */
  return ok({ deleted: gone.length, asked: ids.length });
}
