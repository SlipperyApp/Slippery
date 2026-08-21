import { cookies, headers } from 'next/headers';
import { and, eq, ne, desc } from 'drizzle-orm';
import { getDb, schema, dbReady } from '@/lib/db';
import { viewer } from '@/lib/server/session';
import { ok, unauthorised, noDatabase } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COOKIE = 'slippery_session';

/* The signed-in device list, and signing them out.
 *
 * The current session is marked rather than hidden, so "sign out everywhere
 * else" can say what it will leave alone. The IP was already truncated to
 * the network when the session was created: this list is for recognising a
 * device, not for building a location history out of one. */
export async function GET() {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();

  const jar = await cookies();
  const current = jar.get(COOKIE)?.value;

  const rows = await getDb().select().from(schema.sessions)
    .where(eq(schema.sessions.accountId, account.id))
    .orderBy(desc(schema.sessions.lastSeenAt));

  return ok({
    devices: rows.map((r) => ({
      id: r.id === current ? 'current' : r.id,
      thisDevice: r.id === current,
      userAgent: r.userAgent,
      network: r.ip,
      lastSeenAt: r.lastSeenAt,
      createdAt: r.createdAt,
    })),
  });
}

/** Every other device. The one asking stays signed in, or the person who
 *  clicked it is the first casualty of their own security action. */
export async function DELETE() {
  if (!dbReady()) return noDatabase();
  const account = await viewer();
  if (!account) return unauthorised();

  const jar = await cookies();
  const current = jar.get(COOKIE)?.value ?? '';

  const gone = await getDb().delete(schema.sessions)
    .where(and(eq(schema.sessions.accountId, account.id), ne(schema.sessions.id, current)))
    .returning({ id: schema.sessions.id });

  return ok({ signedOut: gone.length });
}
