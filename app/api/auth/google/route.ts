import { NextResponse } from 'next/server';
import { has, read } from '@/lib/server/env';

export const runtime = 'nodejs';

/** Google sign in. Without the two variables this says so rather than
 *  failing on the redirect, which is what "degrade honestly" means here. */
export async function GET(req: Request) {
  if (!has('GOOGLE_CLIENT_ID') || !has('GOOGLE_CLIENT_SECRET')) {
    const url = new URL('/login', req.url);
    url.searchParams.set('provider', 'unavailable');
    return NextResponse.redirect(url, 303);
  }
  const base = read('NEXT_PUBLIC_APP_URL') ?? new URL(req.url).origin;
  const params = new URLSearchParams({
    client_id: read('GOOGLE_CLIENT_ID')!,
    redirect_uri: `${base}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'online',
    prompt: 'select_account',
  });
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 303);
}
