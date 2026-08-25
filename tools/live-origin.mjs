/* DRIVE A REMOTE ORIGIN FROM A BROWSER THAT CANNOT REACH THE NETWORK.
 *
 * Chromium cannot open a CONNECT tunnel through this container's agent proxy —
 * every navigation comes back ERR_CONNECTION_RESET — while curl goes through it
 * fine. So when the base URL is remote, every request the page makes is
 * intercepted and fulfilled from a curl fetch of the live origin. What renders
 * is the bytes production is actually serving.
 *
 * `scripts/check-live.mjs` discovered this and carries the original of the
 * fetch below; this is the same thing factored out so the control sweeps can
 * point at production too. The content type has to be carried across the
 * boundary by hand, and getting it wrong is silent: an empty contentType makes
 * the browser refuse the stylesheet and the page renders unstyled, which looks
 * exactly like a broken deployment.
 *
 * A localhost base needs none of this, so it is passed straight through.
 *
 * WHY IT CACHES. curl runs one request at a time and the render bundle is
 * 274KB, so a sweep that visits forty one routes re-fetches it forty one
 * times and pages start timing out before they mount. Everything except the
 * API is held in memory for the run: /_next/static is content-hashed and so
 * is immutable by construction, and a document fetched twice in one sweep is
 * the same deployment either way.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export function isRemote(base) {
  return /^https?:\/\/(?!localhost|127\.0\.0\.1)/.test(base);
}

const cache = new Map();

async function fetchWithType(url) {
  const cacheable = !url.includes('/api/');
  if (cacheable && cache.has(url)) return cache.get(url);
  try {
    const { stdout } = await run('bash', ['-c',
      `curl -sS --max-time 25 -w '\\n@@CT@@%{content_type}@@%{http_code}' ${JSON.stringify(url)} | base64 -w0`],
      { maxBuffer: 60e6 });
    const raw = Buffer.from(stdout.trim(), 'base64');
    const s = raw.toString('binary');
    const i = s.lastIndexOf('\n@@CT@@');
    if (i < 0) return { body: raw, type: 'application/octet-stream', status: 200 };
    /* not [, type, code]: the marker is already stripped */
    const [type, code] = s.slice(i + 7).split('@@');
    const got = { body: raw.subarray(0, i), type: (type || '').split(';')[0], status: Number(code) || 200 };
    if (cacheable) cache.set(url, got);
    return got;
  } catch {
    return null;
  }
}

/** A context whose requests are served from `base`, however far away it is. */
export async function contextFor(browser, base, options = {}) {
  const ctx = await browser.newContext(options);
  if (!isRemote(base)) return ctx;
  await ctx.route('**/*', async (route) => {
    const url = route.request().url();
    if (!url.startsWith(base)) return route.abort();
    const got = await fetchWithType(url);
    if (!got) return route.abort();
    return route.fulfill({ status: got.status, contentType: got.type, body: got.body });
  });
  return ctx;
}
