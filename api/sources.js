/* GET /api/sources, what this deployment can actually reach.
 *
 * Every results source here is a scraper, and scrapers are blocked by IP
 * reputation rather than by policy: ESPN and SofaScore both refuse the
 * machine this was written on, and whether they refuse a Vercel function is
 * not answerable from anywhere except a Vercel function. Rather than guess,
 * ask.
 *
 * Read-only, no secrets echoed, no database touched. It reports which
 * environment variables are present as booleans, never their values.
 */
import { json, methodGuard, fail } from './_lib/http.js';
import { configured as dbConfigured } from './_lib/db.js';
import { probeSources } from './_lib/fixtures.js';
import { breakerState } from './_lib/net.js';
import * as mail from './_lib/mail.js';

export default async function handler(req, res) {
  if (!methodGuard(req, res, ['GET'])) return;
  try {
    const has = name => Boolean(process.env[name]);
    return json(res, 200, {
      commit: process.env.VERCEL_GIT_COMMIT_SHA || null,
      branch: process.env.VERCEL_GIT_COMMIT_REF || null,
      region: process.env.VERCEL_REGION || null,
      /* Presence only. Never the value: this repo is public and the endpoint
         is unauthenticated. */
      env: {
        DATABASE_URL: dbConfigured(),
        ANTHROPIC_API_KEY: has('ANTHROPIC_API_KEY'),
        TELEGRAM_BOT_TOKEN: has('TELEGRAM_BOT_TOKEN'),
        TELEGRAM_WEBHOOK_SECRET: has('TELEGRAM_WEBHOOK_SECRET'),
        GMAIL_USER: has('GMAIL_USER'),
        GMAIL_APP_PASSWORD: has('GMAIL_APP_PASSWORD'),
        MAIL_FROM: has('MAIL_FROM'),
        RESEND_API_KEY: has('RESEND_API_KEY'),
        FOOTBALL_DATA_TOKEN: has('FOOTBALL_DATA_TOKEN'),
        CRON_SECRET: has('CRON_SECRET'),
        ADMIN_SECRET: has('ADMIN_SECRET')
      },
      mail: mail.provider(),
      sources: await probeSources(),
      /* What the circuit breaker currently believes, in seconds remaining.
         Empty is the healthy state. If a source you expect to work is in
         here, it refused this instance recently and the chain is skipping
         it on purpose rather than silently failing. */
      blocked: breakerState()
    });
  } catch (err) {
    return fail(res, err, 'Could not probe the results sources.');
  }
}
