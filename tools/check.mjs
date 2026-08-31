/** Fetch every route and report the status. Works against localhost or the
 *  live origin: E2E_BASE=https://slippery-iota.vercel.app node tools/check.mjs */
import { ALL, API } from './routes.mjs';

const BASE = (process.env.E2E_BASE || 'http://127.0.0.1:3100').replace(/\/$/, '');
const paths = [...ALL, ...API];
let bad = 0;

for (const p of paths) {
  let status = 0;
  let bytes = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(BASE + p, { redirect: 'follow', signal: AbortSignal.timeout(30000) });
      status = res.status;
      bytes = (await res.text()).length;
      if (status < 500) break;
    } catch (err) {
      status = 0;
      if (attempt === 2) bytes = 0;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  // /404 is the one path Next answers with a 404 whatever is served there.
  const ok = status === 200 || (p === '/404' && status === 404 && bytes > 4000);
  if (!ok) bad += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${String(status).padEnd(4)} ${String(bytes).padStart(7)}  ${p}`);
}

console.log(`\n${paths.length - bad} of ${paths.length} routes answered.`);
process.exit(bad ? 1 : 0);
