/** Shared by both scheduled routes.
 *
 *  A Hobby account is limited to one cron run per day per expression. A
 *  twenty minute schedule is rejected at deployment CREATION time, with no
 *  deployment and no build log at all, so the sweep is daily and anything
 *  needing settlement sooner goes through the on-demand refresh path. */

import { read, has } from './env';

/** Vercel signs its cron calls with CRON_SECRET as a bearer token. Anything
 *  else is refused, unless no secret is configured at all, which
 *  /api/sources reports as not ready. */
export function authoriseCron(req: Request): { ok: true } | { ok: false; reason: string } {
  const secret = read('CRON_SECRET');
  if (!secret) return { ok: false, reason: 'CRON_SECRET is not set, so the sweep refuses to run unsigned.' };

  const auth = req.headers.get('authorization') ?? '';
  if (auth === `Bearer ${secret}`) return { ok: true };

  // Vercel also sets this header on its own scheduled invocations.
  if (req.headers.get('x-vercel-cron')) return { ok: true };

  return { ok: false, reason: 'That call was not signed.' };
}

export const cronConfigured = () => has('CRON_SECRET');
