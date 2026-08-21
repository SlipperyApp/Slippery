import { NextRequest } from 'next/server';
import { getDb, schema, dbReady } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import { viewer } from '@/lib/server/session';
import { sendMail } from '@/lib/server/email';
import { rateLimit, LIMITS } from '@/lib/server/ratelimit';
import { ok, fail, unauthorised, tooMany, noDatabase } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/* A COPY OF THE RECORD, SENT TO THE ADDRESS ON THE ACCOUNT.
 *
 * Only ever to the account's own verified address, never to one supplied in
 * the request: an export endpoint that mails wherever it is told is a way to
 * exfiltrate somebody's whole betting history with one forged form post.
 *
 * Like the download, this works in read only, after cancelling and after a
 * failed payment. The record belongs to whoever kept it. */
export async function POST(req: NextRequest) {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();

  /* Rate limited harder than a download: this one leaves the building and
     costs somebody else's inbox. */
  const limit = await rateLimit('export-email:' + account.id, LIMITS.exportEmail.max, LIMITS.exportEmail.window);
  if (!limit.ok) return tooMany(limit.retryAfterSeconds);

  const db = getDb();
  const rows = await db
    .select({ bet: schema.bets, state: schema.betState, bookmaker: schema.bookmakers.name })
    .from(schema.bets)
    .leftJoin(schema.betState, eq(schema.betState.betId, schema.bets.id))
    .leftJoin(schema.bookmakers, eq(schema.bookmakers.id, schema.bets.bookmakerId))
    .where(eq(schema.bets.accountId, account.id))
    .orderBy(desc(schema.bets.eventAt));

  const stamp = new Date().toISOString().slice(0, 10);
  const origin = new URL(req.url).origin;

  /* The rows are not attached. Resend's plain-text send takes no attachment
     here, and mailing somebody's full betting history as an unencrypted
     attachment is a worse default than a link they have to be signed in to
     follow. The link is to the same export the button downloads. */
  const sent = await sendMail({
    to: account.email,
    subject: `Your Slippery record — ${stamp}`,
    text: [
      `Your record covers ${rows.length} bet${rows.length === 1 ? '' : 's'}.`,
      '',
      `Download the full CSV here, while signed in on this device:`,
      `${origin}/api/export?format=csv`,
      '',
      `JSON, if you want every field including the settlement history:`,
      `${origin}/api/export?format=json`,
      '',
      'Export works whatever the state of your subscription. Your betting',
      'record is yours.',
    ].join('\n'),
  });

  if (!sent) {
    return fail(503, 'Email is not set up on this deployment yet. The download button works.');
  }
  return ok({ sent: true, to: account.email, bets: rows.length });
}
