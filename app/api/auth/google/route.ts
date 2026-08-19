import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { env } from '@/lib/server/env';
import { fail } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* Google, below the OR divider, as the screen draws it.
 *
 * The state parameter is not decoration: without it, a link a third party
 * crafts can complete this flow in somebody's browser and attach their
 * Google identity to an account they do not own. It is generated here,
 * stored in a short-lived httpOnly cookie, and compared on the way back. */
export async function GET(_req: NextRequest) {
  const clientId = env.googleClientId();
  if (!clientId) return fail(503, 'Google sign in is not set up on this deployment yet.');

  const state = randomBytes(24).toString('base64url');
  const jar = await cookies();
  jar.set('g_state', state, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', path: '/', maxAge: 600,
  });

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', env.appUrl() + '/api/auth/google/callback');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('state', state);
  url.searchParams.set('prompt', 'select_account');

  return NextResponse.redirect(url.toString());
}
