import { NextRequest } from 'next/server';
import { eq, desc } from 'drizzle-orm';
import { getDb, schema, dbReady } from '@/lib/db';
import { viewer } from '@/lib/server/session';
import { fail, unauthorised, noDatabase } from '@/lib/server/http';
import { formatOdds, type OddsFormat } from '@/lib/server/odds';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/* EXPORT ALWAYS WORKS.
 *
 * In read only, after cancelling, and after a failed payment. A betting
 * record belongs to the person who kept it, and holding it hostage to a
 * subscription is the one thing this product must never do. There is
 * therefore no plan check anywhere in this file, deliberately. */
export async function GET(req: NextRequest) {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();

  const format = new URL(req.url).searchParams.get('format') || 'csv';
  const db = getDb();

  const rows = await db
    .select({ bet: schema.bets, state: schema.betState, bookmaker: schema.bookmakers.name })
    .from(schema.bets)
    .leftJoin(schema.betState, eq(schema.betState.betId, schema.bets.id))
    .leftJoin(schema.bookmakers, eq(schema.bookmakers.id, schema.bets.bookmakerId))
    .where(eq(schema.bets.accountId, account.id))
    .orderBy(desc(schema.bets.eventAt));

  const pl = await db.select().from(schema.plEntries)
    .where(eq(schema.plEntries.accountId, account.id));

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === 'json') {
    return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), bets: rows, plEntries: pl }, null, 2), {
      headers: {
        'content-type': 'application/json',
        'content-disposition': `attachment; filename="slippery-${stamp}.json"`,
      },
    });
  }

  if (format === 'csv') {
    const head = [
      'event_at', 'placed_at', 'bookmaker', 'event', 'selection', 'market', 'shape', 'side',
      'stake', 'liability', 'odds', 'currency', 'status', 'returned', 'profit', 'units',
      'voided_stake', 'source', 'slip_backed', 'counts_in_stats', 'note',
    ];
    const money = (p: number | null | undefined) => (p == null ? '' : (p / 100).toFixed(2));
    const body = rows.map((r) => [
      r.bet.eventAt.toISOString(),
      r.bet.placedAt.toISOString(),
      r.bookmaker ?? '',
      r.bet.eventName ?? '',
      r.bet.selection ?? '',
      r.bet.marketRaw ?? '',
      r.bet.shape,
      r.bet.side,
      money(r.bet.stakePence),
      money(r.bet.liabilityPence),
      r.bet.odds != null ? formatOdds(Number(r.bet.odds), account.oddsFormat as OddsFormat) : '',
      r.bet.currency,
      r.state?.status ?? 'open',
      money(r.state?.returnedPence),
      money(r.state?.realisedPlPence),
      r.state?.units ?? '',
      money(r.state?.voidedStakePence),
      r.bet.source ?? '',
      String(r.bet.slipBacked),
      String(r.state?.countsInStats ?? true),
      r.bet.note ?? '',
    ]);

    /* A cell beginning with =, +, - or @ is executed by a spreadsheet on
       open. Prefixed so an exported note cannot become a formula in
       somebody's Excel. */
    const cell = (v: unknown) => {
      const s = String(v ?? '');
      const safe = /^[=+\-@\t\r]/.test(s) ? "'" + s : s;
      return /[",\n]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
    };

    const csv = [head, ...body].map((r) => r.map(cell).join(',')).join('\r\n');
    return new Response('﻿' + csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="slippery-${stamp}.csv"`,
      },
    });
  }

  return fail(400, 'CSV or JSON.');
}
