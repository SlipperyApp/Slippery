/* One fetch for every scraper.
 *
 * WHY THIS EXISTS. None of the five scrapers had a timeout. On a Vercel
 * Hobby function the whole invocation is capped at ten seconds, so one host
 * that accepts a connection and then sits there does not degrade
 * settlement, it stops it: the chain never reaches the source that would
 * have answered, the function is killed, and every bet stays pending. A
 * blocked source is a 403 in 200ms and is fine. A hung source is the
 * dangerous one, and it is the one nothing guarded against.
 *
 * Budgets are per request and deliberately tight. Five sources inside a ten
 * second ceiling means no single one may own more than a couple of seconds,
 * or the chain cannot finish. Better to give up on a slow host and try the
 * next than to spend the whole budget being patient with it.
 *
 * `blocked` on the thrown error is what the chain reads to tell "this host
 * refuses datacenter IPs" from "this host is broken", because the first is
 * expected and permanent and the second is worth reporting.
 */

export const DEFAULT_TIMEOUT_MS = 4500;
/* The reachability probe is only ever called by /api/sources, by hand, and
   answering "slow" honestly beats answering "blocked" wrongly. */
export const PROBE_TIMEOUT_MS = 6000;

/**
 * fetch with a hard deadline and a uniform error shape.
 *
 * @param {string} url
 * @param {object} [opts] passed through to fetch; `timeout` is ours
 * @returns {Promise<Response>}
 */
export async function get(url, opts = {}) {
  const { timeout = DEFAULT_TIMEOUT_MS, ...rest } = opts;
  /* AbortSignal.timeout rather than a manual setTimeout plus controller:
     it cannot leak a timer when the fetch settles first, which the manual
     version does unless every path clears it. */
  let res;
  try {
    res = await fetch(url, { ...rest, signal: AbortSignal.timeout(timeout) });
  } catch (err) {
    const timedOut = err && (err.name === 'TimeoutError' || err.name === 'AbortError');
    const wrapped = new Error(timedOut
      ? 'timed out after ' + timeout + 'ms'
      : (err && err.message) || 'network error');
    /* A timeout is not "blocked". Calling it blocked would tell the chain
       this host permanently refuses us, and the circuit breaker would then
       stop trying a source that was merely slow once. */
    wrapped.timedOut = timedOut;
    wrapped.cause = err;
    throw wrapped;
  }

  if (!res.ok) {
    const err = new Error('responded ' + res.status);
    err.status = res.status;
    /* 403 and 429 are what a bot filter says to a datacenter IP. 451 and
       401 mean the same thing for our purposes: this host will not serve
       us from here, however many times we ask. */
    err.blocked = res.status === 403 || res.status === 429 ||
                  res.status === 401 || res.status === 451;
    throw err;
  }
  return res;
}

/* ---- the circuit breaker ----
 *
 * A warm lambda handles many requests. Without this, every settlement run
 * re-asks the two hosts that have refused this IP since the day it was
 * allocated, spending two round trips of a ten second budget to be told
 * 403 twice. Recording it for a few minutes turns that into nothing.
 *
 * Deliberately in memory and deliberately short. In memory because the
 * answer is per IP and a lambda's IP is per instance, so a shared cache
 * would teach one instance a fact about another. Short because IP
 * reputation genuinely changes, and a source that starts working again
 * should be picked up in minutes rather than needing a deploy.
 *
 * Only `blocked` failures open the breaker. A timeout or a parse error is
 * not evidence the host refuses us.
 */
const OPEN_FOR_MS = 5 * 60 * 1000;
const breaker = new Map();

export function markBlocked(name) {
  breaker.set(name, Date.now() + OPEN_FOR_MS);
}

export function isBlocked(name) {
  const until = breaker.get(name);
  if (!until) return false;
  if (until > Date.now()) return true;
  breaker.delete(name);
  return false;
}

/** Diagnostics only: what the breaker currently believes. */
export function breakerState() {
  const now = Date.now();
  const out = {};
  for (const [name, until] of breaker) {
    if (until > now) out[name] = Math.round((until - now) / 1000);
  }
  return out;
}

/** Testing seam. Nothing in production calls this. */
export function resetBreaker() { breaker.clear(); }
