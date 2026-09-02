/** Where a slip image lives, and the only module that knows.
 *
 *  THE IMAGE IS THE PROOF BEHIND EVERY FIGURE IN THIS PRODUCT and it was
 *  never stored. "Slips", "IMAGE HELD 90D", "The image is deleted after 90
 *  days, or now if you ask" and a privacy policy repeating that promise all
 *  described a file that did not exist; the delete control set a React state
 *  variable and sent nothing anywhere. Either every claim goes or the image
 *  gets stored, and the image is worth storing: it is what makes a review
 *  screen showing the crop beside the field read off it possible at all.
 *
 *  RETENTION HAD TO BE RIGHT BEFORE THE FIRST IMAGE WAS WRITTEN, not after.
 *  Ninety days from upload, or immediately on request, and an image nobody
 *  turned into a bet goes sooner than that. IMAGE_RETENTION_DAYS in
 *  lib/domain/slip.ts is the one place the window lives and the sweep reads
 *  the delete_after column the insert sets from it.
 *
 *  One module, so the day this moves to an object store there is one file to
 *  change and no screen that has to know it happened. */

import type { PoolClient } from 'pg';
import { hasDatabase, query } from './db';
import { IMAGE_RETENTION_DAYS } from '@/lib/domain/slip';

export type StoredSlip = {
  id: string;
  /** Null while the image is still held. Set on deletion, by the sweep or on
   *  request, and the row stays so the gallery can say what happened. */
  deletedAt: string | null;
};

/** True when this deployment can actually keep an image. Nothing may claim a
 *  ninety day retention on a deployment that cannot store the file. */
export function slipStoreReady(): boolean {
  return hasDatabase();
}

/** Keep the image. Returns the row's id, or null when there is nowhere to put
 *  it.
 *
 *  The unique index makes a second upload of the same file the same image
 *  rather than a second row: two rows would mean the sweep had to delete two
 *  things to keep one promise, and the image hash fast path would have two
 *  answers to which bet a screenshot belongs to. */
export async function storeSlipImage(
  accountId: string,
  file: { sha256: string; mediaType: string; bytes: Buffer },
): Promise<string | null> {
  if (!slipStoreReady()) return null;
  const rows = await query<{ id: string }>(
    `insert into slip_images
       (account_id, storage_key, sha256, media_type, bytes, data, delete_after)
     values ($1, $2, $3, $4, $5, $6, now() + ($7 || ' days')::interval)
     on conflict (account_id, sha256) where deleted_at is null
       do update set uploaded_at = slip_images.uploaded_at
     returning id`,
    [
      accountId,
      /*  The key is the storage path this row would have in an object store.
          It is kept, and kept meaningful, because it is what the sweep clears
          and what a move to blob storage would fill in. */
      `slips/${accountId}/${file.sha256}`,
      file.sha256, file.mediaType, file.bytes.byteLength, file.bytes,
      String(IMAGE_RETENTION_DAYS),
    ],
  ).catch(() => [] as { id: string }[]);
  return rows[0]?.id ?? null;
}

/** Bind a stored image to the bet it produced, inside the bet's own
 *  transaction. An image with no bet is deleted by the sweep within days; an
 *  image with a bet is kept for the retention window. */
export async function linkSlipToBet(
  client: PoolClient, accountId: string, sha256: string, betId: string,
): Promise<void> {
  await client.query(
    `update slip_images set bet_id = $3
      where account_id = $1 and sha256 = $2 and deleted_at is null and bet_id is null`,
    [accountId, sha256, betId],
  );
}

/** The image behind one bet, if it is still held. */
export async function slipForBet(accountId: string, betId: string): Promise<StoredSlip | null> {
  if (!slipStoreReady()) return null;
  const rows = await query<{ id: string; deleted_at: string | null }>(
    'select id, deleted_at from slip_images where account_id = $1 and bet_id = $2 order by uploaded_at desc limit 1',
    [accountId, betId],
  ).catch(() => []);
  return rows.length ? { id: rows[0].id, deletedAt: rows[0].deleted_at } : null;
}

/** The bytes, for serving. Ownership is part of the query rather than a check
 *  around it, so there is no path that reads a row and then decides. */
export async function readSlipImage(
  accountId: string, imageId: string,
): Promise<{ data: Buffer; mediaType: string } | null> {
  if (!slipStoreReady()) return null;
  const rows = await query<{ data: Buffer | null; media_type: string | null }>(
    `select data, media_type from slip_images
      where id = $1 and account_id = $2 and deleted_at is null limit 1`,
    [imageId, accountId],
  ).catch(() => []);
  const row = rows[0];
  if (!row?.data) return null;
  return { data: row.data, mediaType: row.media_type || 'image/jpeg' };
}

/** Delete on request, now.
 *
 *  The bytes go and the row stays with deleted_at set, so the gallery can say
 *  the image was removed rather than showing a broken thumbnail, and so the
 *  record of the deletion survives the thing it deleted. That is the same
 *  shape the sweep uses, because a person exercising a data right and a
 *  ninety day clock running out have to leave the account in one state. */
export async function deleteSlipImage(accountId: string, imageId: string): Promise<boolean> {
  if (!slipStoreReady()) return false;
  const rows = await query<{ id: string }>(
    `update slip_images set deleted_at = now(), storage_key = '', data = null
      where id = $1 and account_id = $2 and deleted_at is null
      returning id`,
    [imageId, accountId],
  ).catch(() => []);
  return rows.length > 0;
}
