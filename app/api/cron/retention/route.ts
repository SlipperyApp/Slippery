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

  /*  THE BYTES GO AND THE ROW STAYS. `data = null` is the half that was
      missing while nothing was stored: the sweep cleared a storage_key
      pointing at a store that did not exist and there was no file to delete.
      The row survives so the gallery can say the image was removed rather
      than showing a broken thumbnail, and so the record of a deletion
      outlives the thing it deleted. */
  const rows = await query<{ id: string }>(
    `update slip_images
        set deleted_at = now(), storage_key = '', data = null
      where deleted_at is null and delete_after <= now()
      returning id`,
  ).catch(() => []);

  /*  AN IMAGE NOBODY TURNED INTO A BET GOES SOONER THAN NINETY DAYS.
      /api/extract stores the file before the review screen confirms, because
      that is where the bytes are, so an abandoned review would otherwise
      leave somebody's slip in the table for a quarter of a year for a bet
      that was never written. Two days is long enough for somebody to come
      back to a half finished review and short enough not to be a hoard. */
  const orphans = await query<{ id: string }>(
    `update slip_images
        set deleted_at = now(), storage_key = '', data = null
      where deleted_at is null and bet_id is null and uploaded_at < now() - interval '2 days'
      returning id`,
  ).catch(() => []);

  // Verification codes and expired pending reads go the same way.
  await query(`delete from verification_codes where expires_at < now() - interval '7 days'`).catch(() => null);
  await query(`delete from pending_reads where expires_at < now() - interval '2 days'`).catch(() => null);
  await query(`delete from telegram_updates where seen_at < now() - interval '7 days'`).catch(() => null);
  /*  An idempotency key is useful for the seconds a retry takes and for
      nothing afterwards. Left alone the table grows for ever, one row per
      settlement anybody has ever written. */
  await query(`delete from write_keys where created_at < now() - interval '2 days'`).catch(() => null);

  return NextResponse.json({
    ok: true,
    imagesDeleted: rows.length,
    orphansDeleted: orphans.length,
    note: 'Images only. The bets they came from are untouched.',
  });
}
