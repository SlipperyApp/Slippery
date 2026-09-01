import { NextResponse } from 'next/server';
import { authoriseAdmin } from '@/lib/server/admin';
import { hasDatabase, query } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Wipe and reseed.
 *
 *  A DRY RUN IS THE DEFAULT. It reports the counts it would delete and writes
 *  nothing. Send {"confirm": true} to act, and {"keepEmails": [...]} to
 *  preserve named accounts, their bets and the groups they belong to. */
export async function POST(req: Request) {
  if (!authoriseAdmin(req)) {
    return NextResponse.json({ ok: false, error: 'refused' }, { status: 401 });
  }
  if (!hasDatabase()) {
    return NextResponse.json({ ok: false, error: 'no_store' }, { status: 503 });
  }

  let body: { confirm?: boolean; all?: boolean; keepEmails?: string[] } = {};
  try { body = await req.json(); } catch { /* the default is a dry run anyway */ }

  const keep = Array.isArray(body.keepEmails) ? body.keepEmails.map((e) => String(e).toLowerCase()) : [];
  const all = body.all === true;

  const where = all || keep.length === 0
    ? '1 = 1'
    : 'account_id not in (select id from accounts where lower(email::text) = any($1))';
  const args = all || keep.length === 0 ? [] : [keep];

  const counts = {
    bets: Number((await query<{ n: string }>(`select count(*) as n from bets where ${where}`, args))[0]?.n ?? 0),
    events: Number((await query<{ n: string }>(
      `select count(*) as n from settlement_events where bet_id in (select id from bets where ${where})`, args))[0]?.n ?? 0),
    plEntries: Number((await query<{ n: string }>(`select count(*) as n from pl_entries where ${where}`, args))[0]?.n ?? 0),
    slipImages: Number((await query<{ n: string }>(`select count(*) as n from slip_images where ${where}`, args))[0]?.n ?? 0),
  };

  if (body.confirm !== true) {
    return NextResponse.json({
      ok: true,
      dryRun: true,
      wouldDelete: counts,
      keptAccounts: keep,
      note: 'Nothing was written. Send {"confirm": true} to act.',
    });
  }

  // bets cascades to bet_legs, settlement_events and bet_state.
  await query(`delete from bets where ${where}`, args);
  await query(`delete from pl_entries where ${where}`, args);
  await query(`delete from slip_images where ${where}`, args);

  return NextResponse.json({ ok: true, dryRun: false, deleted: counts, keptAccounts: keep });
}
