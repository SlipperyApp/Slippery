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
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

export function isRemote(base) {
  return /^https?:\/\/(?!localhost|127\.0\.0\.1)/.test(base);
}

async function fetchWithType(url) {
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
    return { body: raw.subarray(0, i), type: (type || '').split(';')[0], status: Number(code) || 200 };
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
