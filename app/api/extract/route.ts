import { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { getDb, schema, dbReady } from '@/lib/db';
import { viewer } from '@/lib/server/session';
import { readSlip, ReaderUnavailable } from '@/lib/server/vision';
import { rateLimit, LIMITS } from '@/lib/server/ratelimit';
import { ok, fail, unauthorised, tooMany, noDatabase } from '@/lib/server/http';
import { trialState } from '@/lib/server/promo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
/* Reading an image takes longer than a query and less than a minute. */
export const maxDuration = 45;

const MAX_BYTES = 12 * 1024 * 1024;
const TYPES: Record<string, string> = {
  'image/jpeg': 'image/jpeg', 'image/jpg': 'image/jpeg', 'image/png': 'image/png',
  'image/webp': 'image/webp', 'image/gif': 'image/gif',
  /* iPhones share HEIC by default and browsers send it with an empty type as
     often as not, so it is coerced rather than refused. */
  'image/heic': 'image/jpeg', 'image/heif': 'image/jpeg', 'application/pdf': 'application/pdf',
};

export async function POST(req: NextRequest) {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();

  const trial = trialState(account);
  if (trial.state === 'over') {
    /* Which half ran out, because the two need different next steps. */
    return fail(402, trial.ran === 'slips'
      ? 'You have used all your trial slips. Choose a plan to keep logging.'
      : 'Your trial has ended. Choose a plan to keep logging.');
  }
  if (account.planState === 'read_only') {
    return fail(402, 'This account is paused. Your ledger and export still work; new slips resume when a card goes through.');
  }

  const limit = await rateLimit('extract:' + account.id, LIMITS.extract.max, LIMITS.extract.window);
  if (!limit.ok) return tooMany(limit.retryAfterSeconds);

  const form = await req.formData();
  const file = form.get('image');
  if (!(file instanceof File)) return fail(400, 'Send an image or a PDF of the slip.');
  if (file.size > MAX_BYTES) return fail(413, 'That file is bigger than 12MB. A screenshot rather than a photo is usually plenty.');

  const declared = (file.type || '').toLowerCase();
  const byName = /\.(hei[cf])$/i.test(file.name) ? 'image/heic' : /\.pdf$/i.test(file.name) ? 'application/pdf' : 'image/jpeg';
  const mediaType = TYPES[declared] || TYPES[byName];
  if (!mediaType) return fail(415, 'Images and PDFs only.');

  const bytes = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash('sha256').update(bytes).digest('hex');

  const db = getDb();
  /* The image hash is a hint, not the duplicate rule: the same bet arrives
     as a placement screenshot and again as a settled one, and those are
     different images of one bet. The real match is on selection, stake,
     bookmaker and event_at, and it happens when the bet is saved. */
  const seen = await db.select({ betId: schema.slipImages.betId }).from(schema.slipImages)
    .where(and(eq(schema.slipImages.accountId, account.id), eq(schema.slipImages.sha256, sha256)))
    .limit(1);

  let result;
  try {
    result = await readSlip({ base64: bytes.toString('base64'), mediaType });
  } catch (err) {
    if (err instanceof ReaderUnavailable) {
      return fail(503, 'Cannot read slips right now. Nothing is lost, send it again shortly.');
    }
    return fail(500, 'Something went wrong reading that. Nothing was saved.');
  }

  if (result.not_a_slip) return ok({ notASlip: true, bets: [] });

  await db.insert(schema.slipImages).values({
    accountId: account.id,
    sha256,
    /* Ninety days, as the privacy policy commits to, or sooner on request. */
    deleteAfter: new Date(Date.now() + 90 * 86400000),
  });

  /* A slip counts against the trial when it is read, not when it is saved:
     reading is the expensive half and the count has to mean something. */
  await db.update(schema.accounts)
    .set({ trialSlipsUsed: account.trialSlipsUsed + 1 })
    .where(eq(schema.accounts.id, account.id));

  return ok({
    bets: result.bets,
    alreadySeen: seen.length > 0 ? seen[0].betId : null,
    sha256,
  });
}
