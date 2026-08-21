import { NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { getDb, schema, dbReady } from '@/lib/db';
import { viewer } from '@/lib/server/session';
import { ok, fail, unauthorised, noDatabase, readJson } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();
  const which = new URL(req.url).searchParams.get('which') || 'following';
  const db = getDb();

  const rows = which === 'followers'
    ? await db.select({ account: schema.accounts }).from(schema.follows)
        .innerJoin(schema.accounts, eq(schema.accounts.id, schema.follows.followerId))
        .where(eq(schema.follows.followeeId, account.id))
    : await db.select({ account: schema.accounts }).from(schema.follows)
        .innerJoin(schema.accounts, eq(schema.accounts.id, schema.follows.followeeId))
        .where(eq(schema.follows.followerId, account.id));

  /* Handle and display name only. Outside a group, stake amounts never
     leave: units are the whole comparison. */
  return ok({
    which,
    people: rows.map((r) => ({
      handle: r.account.handle,
      displayName: r.account.displayName,
      unitPence: undefined,
    })),
  });
}

export async function POST(req: NextRequest) {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();
  const body = await readJson<{ handle?: string }>(req);
  const handle = String(body.handle || '').replace(/^@/, '').toLowerCase();
  if (!handle) return fail(400, 'Who?');

  const db = getDb();
  const found = await db.select({ id: schema.accounts.id }).from(schema.accounts)
    .where(eq(schema.accounts.handle, handle)).limit(1);
  if (!found[0]) return fail(404, 'No such person.');
  if (found[0].id === account.id) return fail(400, 'You already see your own figures.');

  await db.insert(schema.follows)
    .values({ followerId: account.id, followeeId: found[0].id }).onConflictDoNothing();
  return ok({ following: handle });
}

export async function DELETE(req: NextRequest) {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();
  const handle = (new URL(req.url).searchParams.get('handle') || '').replace(/^@/, '').toLowerCase();
  if (!handle) return fail(400, 'Who?');

  const db = getDb();
  const found = await db.select({ id: schema.accounts.id }).from(schema.accounts)
    .where(eq(schema.accounts.handle, handle)).limit(1);
  if (!found[0]) return fail(404, 'No such person.');

  await db.delete(schema.follows).where(and(
    eq(schema.follows.followerId, account.id),
    eq(schema.follows.followeeId, found[0].id)));
  return ok({ unfollowed: handle });
}
