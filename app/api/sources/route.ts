import { NextRequest } from 'next/server';
import { SECRET_NAMES } from '@/lib/server/env';
import { dbReady } from '@/lib/db';
import { ok } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* What this deployment can actually do.
 *
 * NAMES AND BOOLEANS ONLY, NEVER VALUES, and never a prefix or a length
 * either: a length narrows a key and a prefix identifies the provider. The
 * point is to answer "why is slip reading down on production" without a
 * shell, which otherwise costs an hour of guessing at a local probe that
 * behaves differently because it has a residential IP.
 */
export async function GET(_req: NextRequest) {
  return ok({
    deployment: {
      environment: process.env.VERCEL_ENV || 'local',
      region: process.env.VERCEL_REGION || null,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
    },
    configured: Object.fromEntries(SECRET_NAMES.map((n) => [n, Boolean(process.env[n])])),
    capabilities: {
      database: dbReady(),
      /* Either name satisfies the reader, so this is the honest answer
         rather than the presence of one variable. */
      slipReading: Boolean(process.env.VISION_API_KEY || process.env.ANTHROPIC_API_KEY),
      telegram: Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_WEBHOOK_SECRET),
      payments: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
      email: Boolean(process.env.EMAIL_API_KEY),
      googleSignIn: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    },
  });
}
