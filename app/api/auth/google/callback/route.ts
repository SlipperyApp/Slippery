import { NextResponse } from 'next/server';
import { has, read } from '@/lib/server/env';
import { hasDatabase, query } from '@/lib/server/db';
import { setSession } from '@/lib/server/auth';
import { generateLinkCode } from '@/lib/server/codes';
import { TRIAL_DAYS, TRIAL_SLIPS } from '@/lib/domain/trial';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const fail = (why: string) => {
    const back = new URL('/login', req.url);
    back.searchParams.set('provider', why);
    return NextResponse.redirect(back, 303);
  };

  if (!code) return fail('cancelled');
  if (!has('GOOGLE_CLIENT_ID') || !has('GOOGLE_CLIENT_SECRET')) return fail('unavailable');
  if (!hasDatabase()) return fail('no_store');

  const base = read('NEXT_PUBLIC_APP_URL') ?? url.origin;
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: read('GOOGLE_CLIENT_ID')!,
        client_secret: read('GOOGLE_CLIENT_SECRET')!,
        redirect_uri: `${base}/api/auth/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    if (!tokenRes.ok) return fail('rejected');
    const token = (await tokenRes.json()) as { access_token?: string };
    if (!token.access_token) return fail('rejected');

    const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { authorization: `Bearer ${token.access_token}` },
    });
    if (!infoRes.ok) return fail('rejected');
    const info = (await infoRes.json()) as { sub?: string; email?: string; name?: string; email_verified?: boolean };
    if (!info.sub || !info.email) return fail('rejected');

    const rows = await query<{ id: string }>(
      `insert into accounts (email, google_sub, display_name, link_code, trial_ends_at,
                             trial_slips_allowed, age_confirmed_at, terms_accepted_at)
       values ($1, $2, $3, $4, now() + ($5 || ' days')::interval, $6, now(), now())
       on conflict (email) do update set google_sub = excluded.google_sub
       returning id`,
      [info.email.toLowerCase(), info.sub, info.name ?? '', generateLinkCode(), String(TRIAL_DAYS), TRIAL_SLIPS],
    );
    await setSession(rows[0].id, req.headers.get('user-agent') ?? undefined);
    return NextResponse.redirect(new URL('/app', req.url), 303);
  } catch {
    return fail('rejected');
  }
}
