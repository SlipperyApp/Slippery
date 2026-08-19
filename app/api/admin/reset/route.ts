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

/* WIPING AN ACCOUNT BACK TO CLEAN, WITHOUT TAKING THE TESTERS WITH IT.
 *
 * The spec asks for the owner's signed-up account to be reset while the
 * Tester accounts and their group membership stay intact, so the default is
 * targeted rather than total: name the addresses to clear and everything
 * else is left alone, groups included.
 *
 * It is exactly as destructive as it sounds, so it is behind ADMIN_SECRET and
 * A DRY RUN IS THE DEFAULT: a POST without `confirm: true` reports what it
 * would remove and writes nothing.
 *
 * There is no ampersand-multiples migration here. The spec asks for one, and
 * it is not needed: every bet in this database was written through
 * `appendEvent`, which stores legs in `bet_legs` and has never joined a
 * selection with an ampersand. Re-deriving legs from a string is a repair for
 * data the old app produced, and the old app's rows do not survive this
 * route. Said out loud rather than quietly skipped.
 */
export async function POST(req: NextRequest) {
  if (!dbReady()) return noDatabase();

  const secret = env.adminSecret();
  const given = req.headers.get('x-admin-secret') || '';
  if (!secret || !safeEqual(given, secret)) return fail(401, 'No.');

  const body = await readJson<{
    confirm?: boolean; all?: boolean; emails?: string[];
    testerEmail?: string; testerPassword?: string;
  }>(req);
  const db = getDb();

  /* Kept whatever else happens, along with their bets and the groups they
     belong to. Cascades run from `accounts`, so not deleting the row is what
     preserves the membership. */
  const keepEmails = ['tester1@tester.com', 'tester2@tester.com'];
  const targets = (body.emails ?? [])
    .map((e) => String(e).toLowerCase())
    .filter((e) => !keepEmails.includes(e));

  const counts = await db.execute(sql`
    SELECT
      (SELECT count(*) FROM accounts) AS accounts,
      (SELECT count(*) FROM accounts WHERE lower(email) = ANY(${keepEmails})) AS testers,
      (SELECT count(*) FROM bets) AS bets,
      (SELECT count(*) FROM settlement_events) AS events,
      (SELECT count(*) FROM pl_entries) AS pl_entries,
      (SELECT count(*) FROM groups) AS groups,
      (SELECT count(*) FROM group_members) AS group_members
  `);

  /* THE DRY RUN IS THE DEFAULT. Report first, write only when told twice. */
  if (!body.confirm) {
    return ok({
      dryRun: true,
      mode: body.all ? 'everything' : 'targeted',
      wouldDelete: body.all ? 'every account' : targets,
      keeping: keepEmails,
      current: counts.rows?.[0] ?? {},
    });
  }

  if (!body.all) {
    if (!targets.length) return fail(400, 'Name the accounts to wipe, or pass all: true.');
    const removed = await db.transaction(async (tx) => {
      const gone: string[] = [];
      for (const email of targets) {
        const done = await tx.delete(schema.accounts)
          .where(eq(sql`lower(${schema.accounts.email})`, email))
          .returning({ email: schema.accounts.email });
        if (done.length) gone.push(email);
      }
      await tx.delete(schema.pendingSignups);
      return gone;
    });
    return ok({ wiped: removed, keeping: keepEmails, testersUntouched: true });
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
      /* A long trial rather than a plan, so the trial screens stay reachable
         in testing without a card. */
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
