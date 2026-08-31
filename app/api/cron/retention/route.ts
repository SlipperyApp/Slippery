import { NextResponse } from 'next/server';
import { authoriseCron } from '@/lib/server/cron';
import { hasDatabase, query } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Slip images are deleted 90 days after upload. The bet stays, and the
 *  gallery shows an honest "image removed after 90 days, bet kept" state
 *  rather than a broken thumbnail. */
export async function GET(req: Request) {
  const auth = authoriseCron(req);
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.reason }, { status: 401 });
  if (!hasDatabase()) return NextResponse.json({ ok: true, deleted: 0, note: 'No database on this deployment.' });

  const rows = await query<{ id: string }>(
    `update slip_images
        set deleted_at = now(), storage_key = ''
      where deleted_at is null and delete_after <= now()
      returning id`,
  ).catch(() => []);

  // Verification codes and expired pending reads go the same way.
  await query(`delete from verification_codes where expires_at < now() - interval '7 days'`).catch(() => null);
  await query(`delete from pending_reads where expires_at < now() - interval '2 days'`).catch(() => null);
  await query(`delete from telegram_updates where seen_at < now() - interval '7 days'`).catch(() => null);

  return NextResponse.json({
    ok: true,
    imagesDeleted: rows.length,
    note: 'Images only. The bets they came from are untouched.',
  });
}
