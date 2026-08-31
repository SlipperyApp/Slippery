import { NextResponse } from 'next/server';
import { ENV_NAMES, has, capabilities } from '@/lib/server/env';
import { pingDatabase } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** What this running deployment actually has, by NAME and BOOLEAN only.
 *
 *  No value is ever returned, logged or echoed. This exists so that "why is
 *  slip reading down on production" is one request rather than an hour of
 *  guessing at a local probe. */
export async function GET() {
  const env: Record<string, boolean> = {};
  for (const name of ENV_NAMES) env[name] = has(name);

  const caps = capabilities();
  const databaseReachable = await pingDatabase();

  return NextResponse.json(
    {
      ok: true,
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
      region: process.env.VERCEL_REGION ?? null,
      checkedAt: new Date().toISOString(),
      // Names and booleans. Never a value.
      variables: env,
      capabilities: caps.map((c) => ({
        id: c.id, label: c.label, ready: c.ready, needs: c.needs, without: c.without,
      })),
      // Configured is not the same as reachable, so both are reported.
      databaseReachable,
      note: 'Names and booleans only. No value from process.env is ever returned by this route.',
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
