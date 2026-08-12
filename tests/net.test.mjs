/* The shared fetch and the circuit breaker.
 *
 * This file exists because of two measured problems, not two theories.
 *
 * ONE: none of the five scrapers had a timeout. A Vercel Hobby function is
 * capped at ten seconds. A host that accepts the connection and then hangs
 * does not degrade settlement, it stops it: the chain never reaches the
 * source that would have answered, the invocation is killed, and every bet
 * stays pending with nothing in the logs to say why.
 *
 * TWO: two of the five sources refuse a serverless IP with a 403, verified
 * live against the deployment. Without a breaker every settlement run
 * spends its first requests being told no.
 *
 * The distinction the tests below protect is between "blocked" and "slow".
 * Only a refusal opens the breaker. Treating one slow response as a refusal
 * would take a working source out of the chain for five minutes.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import * as net from '../api/_lib/net.js';

let server, base;

before(async () => {
  server = createServer((req, res) => {
    if (req.url === '/ok') { res.writeHead(200); res.end('fine'); return; }
    if (req.url === '/403') { res.writeHead(403); res.end('no'); return; }
    if (req.url === '/429') { res.writeHead(429); res.end('slow down'); return; }
    if (req.url === '/404') { res.writeHead(404); res.end('gone'); return; }
    if (req.url === '/500') { res.writeHead(500); res.end('oops'); return; }
    /* Accepts the connection and never answers. This is the shape that used
       to take settlement down. */
    if (req.url === '/hang') return;
    res.writeHead(404); res.end();
  });
  await new Promise(r => server.listen(0, r));
  base = 'http://127.0.0.1:' + server.address().port;
});

after(() => server.close());

test('a hung host gives up rather than owning the whole function budget', async () => {
  const started = Date.now();
  await assert.rejects(
    () => net.get(base + '/hang', { timeout: 250 }),
    err => {
      assert.equal(err.timedOut, true);
      assert.match(err.message, /timed out/);
      /* A timeout is NOT blocked. Calling it blocked would tell the chain
         this host refuses us permanently. */
      assert.notEqual(err.blocked, true);
      return true;
    });
  assert.ok(Date.now() - started < 2000, 'gave up promptly');
});

test('a refusal is flagged blocked, a server error is not', async () => {
  await assert.rejects(() => net.get(base + '/403'), err => {
    assert.equal(err.blocked, true);
    assert.equal(err.status, 403);
    return true;
  });
  await assert.rejects(() => net.get(base + '/429'), err => {
    assert.equal(err.blocked, true, 'rate limiting inside one sweep is a refusal');
    return true;
  });
  await assert.rejects(() => net.get(base + '/500'), err => {
    assert.notEqual(err.blocked, true, 'a broken host is worth reporting, not writing off');
    assert.equal(err.status, 500);
    return true;
  });
});

test('a 404 carries its status, so a missing season file can be told apart', async () => {
  /* football-data.co.uk publishes nothing for a season that has not started.
     The caller needs to know it was a 404 and not a refusal, so it can fall
     back to the previous season rather than giving up. */
  await assert.rejects(() => net.get(base + '/404'), err => {
    assert.equal(err.status, 404);
    assert.notEqual(err.blocked, true);
    return true;
  });
});

test('a good response comes back intact', async () => {
  const res = await net.get(base + '/ok');
  assert.equal(await res.text(), 'fine');
});

test('the breaker remembers a refusal and forgets an unknown source', () => {
  net.resetBreaker();
  assert.equal(net.isBlocked('espn'), false);
  net.markBlocked('espn');
  assert.equal(net.isBlocked('espn'), true);
  assert.equal(net.isBlocked('flashscore'), false, 'one source does not tar another');
  assert.ok(net.breakerState().espn > 0, 'and it reports how long it has left');
  net.resetBreaker();
  assert.equal(net.isBlocked('espn'), false);
});
