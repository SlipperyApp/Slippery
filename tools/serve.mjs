/** Restart the production server on a port, safely.
 *
 *  Kills only processes whose /proc cmdline BEGINS with the Next server or
 *  the npm exec that launched it. A `pkill -f` here takes the calling shell
 *  with it, because the shell's own command line quotes the pattern. And a
 *  server left behind by another launch keeps serving a stale build, so every
 *  JS chunk 400s and it looks exactly like a hydration bug when it is not.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { openSync } from 'node:fs';

const PORT = process.argv[2] || '3100';
const SELF = process.pid;

function cmdline(pid) {
  try { return readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').filter(Boolean); }
  catch { return null; }
}

let killed = 0;
for (const entry of readdirSync('/proc')) {
  if (!/^\d+$/.test(entry)) continue;
  const pid = Number(entry);
  if (pid === SELF || pid === process.ppid) continue;
  const args = cmdline(pid);
  if (!args || !args.length) continue;
  const first = args[0];
  const joined = args.join(' ');
  const isServer = first.startsWith('next-server')
    || (joined.startsWith('npm exec next start') && joined.includes(PORT))
    || (first === 'sh' && args[1] === '-c' && (args[2] ?? '').startsWith('next start'));
  if (isServer) { try { process.kill(pid); killed += 1; } catch { /* already gone */ } }
}

await new Promise((r) => setTimeout(r, killed ? 1500 : 200));

const out = openSync('/tmp/next.log', 'w');
const child = spawn('npx', ['next', 'start', '-p', PORT], {
  cwd: process.cwd(), detached: true, stdio: ['ignore', out, out],
});
child.unref();

const base = `http://127.0.0.1:${PORT}/`;
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 500));
  try {
    const res = await fetch(base, { signal: AbortSignal.timeout(2000) });
    if (res.ok) { console.log(`serving on ${PORT}, killed ${killed} stale`); process.exit(0); }
  } catch { /* not up yet */ }
}
console.error('the server did not come up; see /tmp/next.log');
process.exit(1);
