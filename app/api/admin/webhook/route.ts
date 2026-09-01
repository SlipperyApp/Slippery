import { NextResponse } from 'next/server';
import { authoriseAdmin } from '@/lib/server/admin';
import { has, read } from '@/lib/server/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Repoint the Telegram webhook, BY HAND.
 *
 *  The old deployment called setWebhook from inside its results cron, so the
 *  first deployment whose cron fired took the bot over. That is a coin toss,
 *  not a cutover, which is why this is a deliberate call with a secret in a
 *  header and nothing schedules it. */
export async function POST(req: Request) {
  if (!authoriseAdmin(req)) {
    return NextResponse.json({ ok: false, error: 'refused' }, { status: 401 });
  }
  if (!has('TELEGRAM_BOT_TOKEN') || !has('TELEGRAM_WEBHOOK_SECRET')) {
    return NextResponse.json(
      { ok: false, error: 'not_configured', message: 'The bot token or the webhook secret is missing, so nothing was pointed anywhere.' },
      { status: 503 },
    );
  }

  const base = read('NEXT_PUBLIC_APP_URL') ?? new URL(req.url).origin;
  const url = `${base}/api/telegram`;

  try {
    const res = await fetch(`https://api.telegram.org/bot${read('TELEGRAM_BOT_TOKEN')}/setWebhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        url,
        secret_token: read('TELEGRAM_WEBHOOK_SECRET'),
        allowed_updates: ['message', 'callback_query', 'my_chat_member'],
        drop_pending_updates: false,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json()) as { ok?: boolean; description?: string };
    // The token is never echoed, only the URL it was pointed at.
    return NextResponse.json({ ok: Boolean(body.ok), pointedAt: url, description: body.description ?? null });
  } catch {
    return NextResponse.json({ ok: false, error: 'unreachable', pointedAt: url }, { status: 502 });
  }
}
