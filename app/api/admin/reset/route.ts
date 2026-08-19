import { NextRequest } from 'next/server';
import { eq, ne, sql } from 'drizzle-orm';
import { getDb, schema, dbReady } from '@/lib/db';
import { env } from '@/lib/server/env';
import { safeEqual, hashPassword, makeLinkCode } from '@/lib/server/crypto';
import { ok, fail, noDatabase, readJson } from '@/lib/server/http';
import { seedReferenceData } from '@/lib/server/onboarding';
import { TRIAL_SLIPS } from '@/lib/server/promo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/* WIPE EVERY ACCOUNT, THEN RECREATE THE TESTER.
 *
 * As instructed, and it is exactly as destructive as it sounds, so it is
 * behind ADMIN_SECRET and a dry run is the default: a POST with no
 * `confirm: true` reports the counts it would delete and writes nothing.
 *
 * There is no migration of ampersand-joined multiples here on purpose. Every
 * account is being deleted, so there is no legacy data left to re-derive,
 * and code that runs over nothing is code nobody can test.
 */
export async function POST(req: NextRequest) {
  if (!dbReady()) return noDatabase();

  const secret = env.adminSecret();
  const given = req.headers.get('x-admin-secret') || '';
  if (!secret || !safeEqual(given, secret)) return fail(401, 'No.');

  const body = await readJson<{ confirm?: boolean; testerEmail?: string; testerPassword?: string }>(req);
  const db = getDb();

  const counts = await db.execute(sql`
    SELECT
      (SELECT count(*) FROM accounts) AS accounts,
      (SELECT count(*) FROM bets) AS bets,
      (SELECT count(*) FROM settlement_events) AS events,
      (SELECT count(*) FROM pl_entries) AS pl_entries,
      (SELECT count(*) FROM groups) AS groups
  `);

  /* THE DRY RUN IS THE DEFAULT. Report first, write only when told twice. */
  if (!body.confirm) {
    return ok({ dryRun: true, wouldDelete: counts.rows?.[0] ?? {} });
  }

  const email = String(body.testerEmail || 'Tester1@Tester.com').toLowerCase();
  const password = String(body.testerPassword || 'Tester1@Tester');

  await db.transaction(async (tx) => {
    /* Cascades take the bets, legs, events, state, tags, memberships,
       follows, slips and links with them. */
    await tx.delete(schema.accounts);
    await tx.delete(schema.pendingSignups);
    await tx.delete(schema.groups);
    await tx.delete(schema.telegramUpdates);
    await tx.delete(schema.rateLimits);

    const [tester] = await tx.insert(schema.accounts).values({
      email,
      passwordHash: await hashPassword(password),
      displayName: 'Tester1',
      handle: 'tester123',
      unitPence: 2500,
      linkCode: makeLinkCode(),
      ageConfirmedAt: new Date(),
      /* Given a long trial rather than a plan, so the trial screens are
         reachable in testing without a card. */
      trialEndsAt: new Date(Date.now() + 365 * 86400000),
      trialSlipsAllowed: 10000,
      planState: 'trialing',
      isTester: true,
    }).returning();

    await seedReferenceData(tx, tester.id);
  });

  return ok({
    wiped: counts.rows?.[0] ?? {},
    tester: { email, handle: '@tester123' },
    /* The password is the one that was sent in. It is never echoed. */
  });
}
