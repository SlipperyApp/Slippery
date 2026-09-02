import { NextResponse } from 'next/server';
import { ENV_NAMES, has, capabilities } from '@/lib/server/env';
import { emailHealth, emailTransport, probeEmailHost } from '@/lib/server/mail';
import { limitOr429 } from '@/lib/server/respond';
import { pingDatabase, schemaReady } from '@/lib/server/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** What this running deployment actually has, by NAME and BOOLEAN only.
 *
 *  No value is ever returned, logged or echoed. This exists so that "why is
 *  slip reading down on production" is one request rather than an hour of
 *  guessing at a local probe.
 *
 *  GET /api/sources?probe=email adds one thing the table cannot answer:
 *  whether the SMTP host is actually reachable from this deployment. It is
 *  opt in because it costs a socket and a couple of seconds, and it is rate
 *  limited because it is the one branch of this route that does outbound
 *  work. It carries no credential and sends no message: it greets the host,
 *  reads back the extension list, and quits. */
export async function GET(req: Request) {
  const wantsProbe = new URL(req.url).searchParams.get('probe') === 'email';
  if (wantsProbe) {
    const limited = limitOr429(req, 'sources-probe', 6, 300);
    if (limited) return limited;
  }

  const env: Record<string, boolean> = {};
  for (const name of ENV_NAMES) env[name] = has(name);

  const caps = capabilities();
  const databaseReachable = await pingDatabase();
  const schema = await schemaReady();

  /*  Booleans about the email path, which is the integration whose failures
   *  are least visible: a signup that answers 200 with emailSent false looks
   *  identical from the outside whether the app password is wrong, the port
   *  is blocked, or nothing is configured at all. */
  const email = emailHealth();
  if (wantsProbe && email.transport === 'smtp') email.probe = await probeEmailHost();

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
        ...(c.note ? { note: c.note } : {}),
      })),
      /*  Which of the two transports the key in EMAIL_API_KEY selects. The
       *  shape of the key chooses, so this is the answer to "it is set and no
       *  code arrived" without anybody reading the key. */
      emailTransport: emailTransport(),
      email,
      // Configured is not the same as reachable, so both are reported.
      databaseReachable,
      schema,
      note: 'Names and booleans only. No value from process.env is ever returned by this route. Add ?probe=email to open a socket to the SMTP host, which sends nothing and carries no credential.',
    },
    { headers: { 'cache-control': 'no-store' } },
  );
}
