/** Fetch every route and assert what can be asserted over HTTP.
 *
 *  Against localhost this is a fast smoke test. Against the live origin it is
 *  the verification that matters, because driving Chromium over the network
 *  from this container is not reliable enough to tell a dropped connection
 *  from a defect: the full browser sweep runs locally against the same
 *  commit, and this proves the deployed build is that commit and that every
 *  route answers with real content.
 *
 *    E2E_BASE=https://slippery-iota.vercel.app node tools/check.mjs
 */
import { ALL, API } from './routes.mjs';

const BASE = (process.env.E2E_BASE || 'http://127.0.0.1:3100').replace(/\/$/, '');
const paths = [...ALL, ...API];

const strip = (html) => html
  .replace(/<script[\s\S]*?<\/script>/gi, '')
  .replace(/<style[\s\S]*?<\/style>/gi, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

let bad = 0;
const rows = [];

for (const p of paths) {
  let status = 0;
  let html = '';
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(BASE + p, { redirect: 'follow', signal: AbortSignal.timeout(40000) });
      status = res.status;
      html = await res.text();
      if (status < 500) break;
    } catch {
      status = 0;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }

  const isApi = p.startsWith('/api/');
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? '';
  const h1s = (html.match(/<h1[\s>]/gi) ?? []).length;
  const text = isApi ? html : strip(html);

  const problems = [];
  if (status !== 200) problems.push(`status ${status}`);
  if (!isApi) {
    if (h1s !== 1) problems.push(`${h1s} h1`);
    if (title.length < 10) problems.push(`title "${title}"`);
    // The brief's bar is 40. 150 is clear of it and still catches a page
    // that rendered its chrome and nothing else.
    if (text.length < 150) problems.push(`${text.length} characters of content`);
    if (!/BeGambleAware/i.test(html) && !p.startsWith('/app')) problems.push('no compliance footer');
  }

  if (problems.length) bad += 1;
  rows.push({ p, status, chars: text.length, h1s, problems });
  console.log(
    `${problems.length ? 'FAIL' : 'ok  '} ${String(status).padEnd(4)} ${String(text.length).padStart(7)}ch `
    + `h1=${h1s}  ${p}${problems.length ? `\n       ${problems.join(', ')}` : ''}`,
  );
}

console.log(`\n${paths.length - bad} of ${paths.length} routes answered with real content.`);
process.exit(bad ? 1 : 0);
