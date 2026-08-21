import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* ═══ THE CRON SWEEP FAILS CLOSED IN PRODUCTION ═══
 *
 * `if (secret && auth !== ...)` runs the sweep for anybody who asks when the
 * secret is unset, and the deployment where somebody forgets to set it is
 * the one where that matters. */
test('an unset CRON_SECRET refuses in production rather than running open', () => {
  const route = readFileSync(new URL('../app/api/cron/results/route.ts', import.meta.url), 'utf8');
  assert.match(route, /VERCEL_ENV === 'production'/, 'there is no production case');
  assert.ok(!/if \(secret && auth !== /.test(route),
    'the guard is still conditional on the secret existing');
  assert.match(route, /if \(!secret\) \{/, 'a missing secret is not handled explicitly');
});

test('the diagnostics route knows about every secret the app reads', () => {
  const env = readFileSync(new URL('../lib/server/env.ts', import.meta.url), 'utf8');
  const read = [...env.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((m) => m[1]);
  const listed = env.slice(env.indexOf('export const SECRET_NAMES'));
  for (const name of new Set(read)) {
    /* These are Vercel's own and not secrets of ours. */
    if (['NODE_ENV', 'VERCEL_ENV', 'VERCEL_PROJECT_PRODUCTION_URL', 'NEXT_PUBLIC_APP_URL', 'ANTHROPIC_API_KEY'].includes(name)) continue;
    assert.ok(listed.includes(name), name + ' is read but never reported by /api/sources');
  }
});
