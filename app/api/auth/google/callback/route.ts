import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { getDb, schema, dbReady } from '@/lib/db';
import { env } from '@/lib/server/env';
import { safeEqual, makeLinkCode } from '@/lib/server/crypto';
import { validEmail } from '@/lib/server/email';
import { createSession } from '@/lib/server/session';
import { startTrial, seedReferenceData } from '@/lib/server/onboarding';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const back = (path: string, why?: string) => {
  const url = new URL(env.appUrl() + path);
  if (why) url.searchParams.set('error', why);
  return NextResponse.redirect(url.toString());
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') || '';

  const jar = await cookies();
  const expected = jar.get('g_state')?.value || '';
  jar.delete('g_state');

  /* Cross-site request forgery on a sign-in flow attaches somebody else's
     identity to your session. Compared in constant time and refused loudly. */
  if (!code || !expected || !safeEqual(state, expected)) return back('/sign-in', 'state');
  if (!dbReady()) return back('/sign-in', 'unavailable');

  const clientId = env.googleClientId();
  const clientSecret = env.googleClientSecret();
  if (!clientId || !clientSecret) return back('/sign-in', 'unavailable');

  let email: string | null = null;
  let name: string | null = null;
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: env.appUrl() + '/api/auth/google/callback',
        grant_type: 'authorization_code',
      }),
    });
    const token = (await tokenRes.json()) as { id_token?: string };
    if (!token.id_token) return back('/sign-in', 'google');

    /* The id_token is read for its claims and the address is only trusted
       when Google says it verified it, or anybody can register an unverified
       address and take over an account that already uses it. */
    const payload = JSON.parse(Buffer.from(token.id_token.split('.')[1], 'base64url').toString('utf8'));
    if (payload.aud !== clientId) return back('/sign-in', 'google');
    if (!payload.email_verified) return back('/sign-in', 'unverified');
    email = String(payload.email || '').toLowerCase();
    name = payload.name ? String(payload.name).slice(0, 60) : null;
  } catch {
    return back('/sign-in', 'google');
  }

  if (!email || !validEmail(email)) return back('/sign-in', 'google');

  const db = getDb();
  const existing = await db.select().from(schema.accounts)
    .where(eq(schema.accounts.email, email)).limit(1);

  if (existing[0]) {
    await createSession(existing[0].id);
    return back('/dashboard');
  }

  /* Google has already proved the address, so there is no code screen. The
     account exists from here, with the same trial as any other. */
  const account = await db.transaction(async (tx) => {
    const [created] = await tx.insert(schema.accounts).values({
      email,
      displayName: name,
      /* No password. Signing in is through Google until one is set from
         Settings, which is why passwordHash is nullable. */
      passwordHash: null,
      linkCode: makeLinkCode(),
      ageConfirmedAt: new Date(),
    }).returning();
    await startTrial(tx, created.id, null);
    await seedReferenceData(tx, created.id);
    return created;
  });

  await createSession(account.id);
  /* Straight into the six steps at the point Google could not answer: a
     display name, a unit, sports and bookmakers. */
  return back('/signup/name');
}
