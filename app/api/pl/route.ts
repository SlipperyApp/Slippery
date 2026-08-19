import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { getDb, schema, dbReady } from '@/lib/db';
import { viewer } from '@/lib/server/session';
import { ok, fail, unauthorised, noDatabase, readJson } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* Figures with no slip behind them: a month's total typed in from another
   tracker, or a screenshot of somebody else's app.
 *
 * They move net, turnover and the calendar. They are excluded from win rate,
 * streaks, average odds and best or worst day, because there is no bet there
 * to have won or lost, and the interface says so wherever those figures
 * appear rather than leaving the two silently disagreeing. */
export async function POST(req: NextRequest) {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();

  const body = await readJson<{ rows?: { date?: string; amountPence?: number; stakePence?: number; note?: string }[] }>(req);
  const rows = Array.isArray(body.rows) ? body.rows : [];
  if (!rows.length) return fail(400, 'Nothing to import.');
  if (rows.length > 1000) return fail(413, 'A thousand rows at a time is the limit.');

  const clean = [];
  const rejected: { index: number; why: string }[] = [];
  for (const [i, r] of rows.entries()) {
    const date = String(r.date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { rejected.push({ index: i, why: 'no readable date' }); continue; }
    const amount = Math.round(Number(r.amountPence));
    if (!Number.isFinite(amount)) { rejected.push({ index: i, why: 'no readable amount' }); continue; }
    clean.push({
      accountId: account.id,
      entryDate: date,
      amountPence: amount,
      stakePence: Number.isFinite(Number(r.stakePence)) ? Math.round(Number(r.stakePence)) : null,
      note: r.note ? String(r.note).slice(0, 200) : null,
      source: 'csv_import',
    });
  }

  if (clean.length) await getDb().insert(schema.plEntries).values(clean);

  /* Both numbers, always. "Imported 40" with nothing about the 3 that were
     not is how somebody discovers a gap a month later. */
  return ok({ imported: clean.length, rejected });
}

export async function DELETE(req: NextRequest) {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return fail(400, 'Which row?');
  const gone = await getDb().delete(schema.plEntries)
    .where(and(eq(schema.plEntries.id, id), eq(schema.plEntries.accountId, account.id)))
    .returning({ id: schema.plEntries.id });
  if (!gone.length) return fail(404, 'No such row.');
  return ok({ deleted: id });
}
