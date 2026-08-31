import { NextResponse } from 'next/server';
import { isEmail } from '@/lib/server/codes';
import { rateLimit } from '@/lib/server/ratelimit';
import { query, hasDatabase } from '@/lib/server/db';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const limited = rateLimit(req, 'waiting-list', 5, 3600);
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, error: 'rate_limited', retryAfterSeconds: limited.retryAfter },
      { status: 429, headers: { 'retry-after': String(limited.retryAfter) } },
    );
  }

  let body: unknown;
  try { body = await req.json(); } catch { body = null; }
  const email = typeof (body as { email?: unknown })?.email === 'string' ? (body as { email: string }).email.trim() : '';
  const platform = (body as { platform?: unknown })?.platform;
  const plat = platform === 'ios' || platform === 'android' ? platform : 'both';

  if (!isEmail(email)) {
    return NextResponse.json({ ok: false, error: 'bad_email' }, { status: 400 });
  }

  if (!hasDatabase()) {
    // Degrade honestly: say what happened rather than pretending it saved.
    return NextResponse.json({ ok: false, error: 'no_store' }, { status: 503 });
  }

  await query(
    `insert into waiting_list (email, platform) values ($1, $2)
     on conflict (email) do update set platform = excluded.platform`,
    [email.toLowerCase(), plat],
  );

  return NextResponse.json({ ok: true });
}
