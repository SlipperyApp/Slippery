import 'server-only';
import { cookies, headers } from 'next/headers';
import { eq, and, gt, lt } from 'drizzle-orm';
import { getDb, schema, dbReady } from '@/lib/db';
import { sessionId } from './crypto';

const COOKIE = 'slippery_session';
const MAX_AGE = 60 * 60 * 24 * 30;

export type Viewer = typeof schema.accounts.$inferSelect;

export async function createSession(accountId: string) {
  const db = getDb();
  const id = sessionId();
  const h = await headers();
  await db.insert(schema.sessions).values({
    id,
    accountId,
    userAgent: h.get('user-agent')?.slice(0, 300) ?? null,
    /* The proxy header, truncated to the network rather than the host: it is
       there to let somebody recognise a device in the security list, not to
       build a location history out of them. */
    ip: (h.get('x-forwarded-for') || '').split(',')[0].trim().replace(/\.\d+$/, '.0') || null,
    expiresAt: new Date(Date.now() + MAX_AGE * 1000),
  });
  const jar = await cookies();
  jar.set(COOKIE, id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE,
  });
  return id;
}

export async function destroySession() {
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (id && dbReady()) {
    await getDb().delete(schema.sessions).where(eq(schema.sessions.id, id));
  }
  jar.delete(COOKIE);
}

/* Who is asking. Returns null rather than throwing, because "nobody" is a
   normal answer on every public page. */
export async function viewer(): Promise<Viewer | null> {
  if (!dbReady()) return null;
  const jar = await cookies();
  const id = jar.get(COOKIE)?.value;
  if (!id) return null;
  const db = getDb();
  const rows = await db
    .select({ account: schema.accounts })
    .from(schema.sessions)
    .innerJoin(schema.accounts, eq(schema.accounts.id, schema.sessions.accountId))
    .where(and(eq(schema.sessions.id, id), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0]?.account ?? null;
}

export async function signOutEverywhere(accountId: string, keep?: string) {
  const db = getDb();
  await db.delete(schema.sessions).where(eq(schema.sessions.accountId, accountId));
  if (keep) { /* the caller re-creates its own */ }
}

export async function sweepExpiredSessions() {
  if (!dbReady()) return;
  await getDb().delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date()));
}
