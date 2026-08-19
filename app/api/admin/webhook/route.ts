import { NextRequest } from 'next/server';
import { env } from '@/lib/server/env';
import { safeEqual } from '@/lib/server/crypto';
import { setWebhook, setMyCommands } from '@/lib/server/telegram';
import { ok, fail } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* Pointing Telegram at this deployment, DELIBERATELY.
 *
 * The old app called setWebhook from inside its results cron, so the first
 * deployment whose cron fired took the bot over with no coordination. That
 * is fine until two deployments exist, and then it is a race whose loser
 * silently stops receiving slips. This is a hand-pulled lever, which is what
 * makes a staged cutover possible. */
export async function POST(req: NextRequest) {
  const secret = env.adminSecret();
  const given = req.headers.get('x-admin-secret') || '';
  if (!secret || !safeEqual(given, secret)) return fail(401, 'No.');
  if (!env.telegramBotToken() || !env.telegramWebhookSecret()) {
    return fail(503, 'The bot token and webhook secret both have to be set first.');
  }

  const url = env.appUrl() + '/api/telegram';
  const set = await setWebhook(url);
  const commands = await setMyCommands();
  return ok({ url, set: Boolean(set), commands: Boolean(commands) });
}
