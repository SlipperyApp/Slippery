import { readSlip, readerReady } from '@/lib/server/vision';
import { currentAccount } from '@/lib/server/auth';
import { fail, limitOr429, ok } from '@/lib/server/respond';
import { sha256 } from '@/lib/server/auth';
import { hasDatabase, query } from '@/lib/server/db';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Slip image or PDF to structured fields. It refuses to guess. */
export async function POST(req: Request) {
  const limited = limitOr429(req, 'extract', 20, 900);
  if (limited) return limited;

  if (!readerReady()) {
    return fail(503, 'reader_down',
      'Slip reading is down on this deployment, so nothing was read and nothing was lost. Typing a bet in still works.');
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return fail(400, 'no_file', 'No file arrived, so nothing was read.');
  if (file.size > 12 * 1024 * 1024) return fail(413, 'too_large', 'That file is over 12MB.');

  const buf = Buffer.from(await file.arrayBuffer());
  const hash = sha256(buf);
  const account = await currentAccount();

  // A duplicate image is caught before the model is called at all.
  if (account && hasDatabase()) {
    const seen = await query<{ bet_id: string | null }>(
      'select bet_id from slip_images where account_id = $1 and sha256 = $2 and deleted_at is null limit 1',
      [account.id, hash],
    ).catch(() => []);
    if (seen.length) {
      return ok({ duplicate: true, betId: seen[0].bet_id, message: 'That exact image is already in your ledger.' });
    }
  }

  const mediaType = file.type || 'image/jpeg';
  const outcome = await readSlip(buf.toString('base64'), mediaType);

  if (!outcome.ok) {
    const messages: Record<string, string> = {
      not_configured: 'Slip reading is not set up on this deployment.',
      refused: 'The reader refused that image. Nothing was lost, send it again shortly.',
      unreachable: 'The reader could not be reached. Nothing was lost, send it again shortly.',
      unparsable: 'The reader answered with something unusable, so nothing was written.',
    };
    return fail(502, outcome.reason, messages[outcome.reason]);
  }

  if (!outcome.result.isSlip) {
    return ok({ isSlip: false, message: 'That does not look like a betting slip, so nothing was read from it.' });
  }

  return ok({ read: outcome.result, sha256: hash });
}
