/* Build a single self-contained HTML file you can open anywhere.
 *
 *   node tools/preview.mjs   ->  slippery-preview.html
 *
 * public/index.html is already one file, but it is not portable: the fonts
 * live at /fonts/*.woff2 and the app fetches /api/* on load. Opened from a
 * file:// URL both fail, so you get system fonts and a permanently
 * signed-out shell — which is not what the app looks like.
 *
 * This inlines the fonts as data URIs and installs a fetch shim that
 * answers the API from the same fixtures tools/apistub.mjs uses for the
 * audit. Nothing about the app is changed: the real client code runs, the
 * real session check runs, the real hydrate and render run. Only the
 * network is faked, and only in this copy — it is a viewing artefact and
 * is never deployed.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { USER, BETS } from './apistub.mjs';

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));

const FONTS = ['fraunces.woff2', 'schibsted-grotesk.woff2', 'spline-sans-mono.woff2'];

/* The reader's answers, one per upload, cycling. Same three cases the
   audit uses: fully legible, missing the stake, and already settled. */
const EXTRACTIONS = [
  { selection: 'Over 2.5 Goals', event: 'Arsenal v Chelsea', stake: 25.00,
    odds: 1.85, bookmaker: 'bet365', market: 'Over/Under',
    stage: 'prematch', result: 'open', returns: null, readable: true, unreadable_fields: [] },
  { selection: 'Under 3.5 Goals', event: null, stake: null, odds: 1.44,
    bookmaker: 'Sky Bet', market: 'Over/Under',
    stage: 'inplay', result: 'open', returns: null, readable: true, unreadable_fields: ['stake'] },
  { selection: 'Under 5.5 Goals', event: 'Oskarshamns AIK v IFK Karlshamn',
    stake: 306.18, odds: 1.25, bookmaker: 'Paddy Power', market: 'Over/Under',
    stage: 'settled', result: 'won', returns: 382.73, readable: true, unreadable_fields: [] }
];

const shim = (user, bets, extractions) => `
<script>
/* ── PREVIEW ONLY ─────────────────────────────────────────────────────
   A fake backend, so this file can be opened from disk and still show the
   signed-in app. The application code below is byte-for-byte the deployed
   build; only window.fetch is replaced. Anything you log here lives in
   memory and disappears on reload.
   ──────────────────────────────────────────────────────────────────── */
(function () {
  var USER = ${JSON.stringify(user)};
  var BETS = ${JSON.stringify(bets)};
  var READS = ${JSON.stringify(extractions)};
  var reads = 0;

  /* Timestamps are baked at build time, so shift them to be relative to
     whenever the file is opened — otherwise the calendar fills a month
     that has since passed. */
  var built = ${Date.now()};
  var drift = Date.now() - built;
  BETS.forEach(function (b) {
    b.placedAt = new Date(new Date(b.placedAt).getTime() + drift).toISOString();
  });

  function reply(status, body) {
    return Promise.resolve(new Response(JSON.stringify(body), {
      status: status,
      headers: { 'content-type': 'application/json' }
    }));
  }

  var real = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    if (url.indexOf('/api/') === -1) return real(input, init);

    var body = {};
    try { body = JSON.parse((init && init.body) || '{}'); } catch (e) {}

    if (url.indexOf('/api/auth/me') > -1) return reply(200, { configured: true, user: USER });
    if (url.indexOf('/api/auth/signup') > -1) return reply(201, { ok: true, name: body.name || USER.name });
    if (url.indexOf('/api/auth/verify') > -1) return reply(200, { ok: true, user: USER });
    if (url.indexOf('/api/auth/resend') > -1) return reply(200, { ok: true });
    if (url.indexOf('/api/auth/login') > -1) return reply(200, { ok: true, name: USER.name });

    if (url.indexOf('/api/extract') > -1) {
      return new Promise(function (done) {
        /* A beat of latency, so the reading state is visible rather than
           flashing past. */
        setTimeout(function () {
          done(new Response(JSON.stringify({ fields: READS[reads++ % READS.length] }),
            { status: 200, headers: { 'content-type': 'application/json' } }));
        }, 550);
      });
    }

    if (url.indexOf('/api/settle') > -1) {
      /* Settle the two plain running bets, leave the one the grader asked
         about — the realistic shape of an answer. */
      var did = 0;
      BETS.forEach(function (b) {
        if (b.status === 'pending' && did < 2) {
          b.status = 'settled';
          b.outcome = did === 0 ? 'won' : 'lost';
          b.profit = did === 0 ? Math.round(b.stake * (b.odds - 1)) : -b.stake;
          b.settledAt = new Date().toISOString();
          did++;
        }
      });
      return reply(200, { provider: 'sofascore', checked: 3, fixtures: 412,
        settled: did, asked: 1, stillRunning: 0, bets: [] });
    }

    if (url.indexOf('/api/bets') > -1) {
      if (method === 'GET') {
        return reply(200, { bets: BETS, total: BETS.length, freeSlips: 20, plan: USER.plan });
      }
      if (method === 'POST') {
        if (Array.isArray(body.bets)) {
          body.bets.forEach(function (r, i) {
            BETS.unshift({
              id: 'imp' + Date.now() + i, event: r.event, selection: r.selection,
              market: r.market, book: r.book, odds: r.odds, stake: r.stakePence,
              profit: r.profitPence, outcome: r.outcome === 'cash' ? 'cash-profit' : r.outcome,
              status: r.outcome ? 'settled' : 'pending',
              placedAt: r.placedAt || new Date().toISOString(), source: 'import'
            });
          });
          return reply(201, { imported: body.bets.length, rejected: [] });
        }
        var made = {
          id: 'new' + Date.now(), event: body.event, selection: body.selection,
          market: body.market, book: body.book, odds: body.odds, stake: body.stakePence,
          profit: body.profitPence == null ? null : body.profitPence,
          outcome: body.outcome === 'cash' ? 'cash-profit' : (body.outcome || null),
          status: body.outcome ? 'settled' : 'pending',
          placedAt: new Date().toISOString(), source: 'upload'
        };
        BETS.unshift(made);
        return reply(201, { bet: made });
      }
      if (method === 'PATCH') {
        var hit = null;
        BETS.forEach(function (b) { if (b.id === body.id) hit = b; });
        if (!hit) return reply(404, { error: 'That bet is not in your ledger.' });
        hit.profit = body.kind === 'won' ? Math.round(hit.stake * (hit.odds - 1))
          : body.kind === 'lost' ? -hit.stake
          : body.kind === 'void' ? 0
          : (body.returnedPence || 0) - hit.stake;
        hit.outcome = body.kind === 'cash'
          ? (hit.profit > 0 ? 'cash-profit' : hit.profit < 0 ? 'cash-loss' : 'cash-flat')
          : body.kind;
        hit.status = 'settled';
        return reply(200, { bet: hit });
      }
      if (method === 'DELETE') {
        BETS = BETS.filter(function (b) { return b.id !== body.id; });
        return reply(200, { deleted: body.id });
      }
    }
    return reply(200, {});
  };

  /* The service worker would try to cache file:// URLs and throw. */
  if (navigator.serviceWorker && navigator.serviceWorker.register) {
    navigator.serviceWorker.register = function () { return Promise.reject(new Error('preview')); };
  }
})();
</script>
`;

async function main() {
  let html = await readFile(path.join(root, 'public', 'index.html'), 'utf8');

  /* Fonts as data URIs. Without this a file:// copy silently falls back to
     system fonts, and the whole point of looking at it is the type. */
  for (const file of FONTS) {
    const buf = await readFile(path.join(root, 'public', 'fonts', file));
    html = html.replace('url(/fonts/' + file + ')',
      'url(data:font/woff2;base64,' + buf.toString('base64') + ')');
  }

  /* The manifest and icons are network fetches that cannot resolve from
     disk. Dropping them is quieter than letting the console fill up. */
  html = html.replace(/<link rel="manifest"[^>]*>/g, '');
  html = html.replace(/<link rel="apple-touch-icon"[^>]*>/g, '');
  html = html.replace(/<link rel="preload"[^>]*as="font"[^>]*>/g, '');
  html = html.replace(/<meta property="og:image[^>]*>/g, '');
  /* The favicon becomes an inline data URI rather than a 404, so the tab
     still carries the mark. */
  const icon = await readFile(path.join(root, 'public', 'icon.svg'), 'utf8');
  html = html.replace('<link rel="icon" href="/icon.svg" type="image/svg+xml">',
    '<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,' +
    Buffer.from(icon).toString('base64') + '">');

  /* The shim has to be installed before the app's own script runs, since
     the app fetches the session during init. */
  const at = html.lastIndexOf('<script>');
  html = html.slice(0, at) + shim(USER, BETS, EXTRACTIONS) + html.slice(at);

  html = html.replace('<title>', '<title>Slippery preview — ');

  const out = path.join(root, 'slippery-preview.html');
  await writeFile(out, html);
  console.log('  wrote slippery-preview.html  ' + (html.length / 1024).toFixed(0) + 'kB, self-contained');
}

main().catch(err => { console.error(err); process.exit(1); });
