/* Small HTTP helpers shared by every route. */

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

export function methodGuard(req, res, allowed) {
  if (allowed.includes(req.method)) return true;
  res.setHeader('allow', allowed.join(', '));
  json(res, 405, { error: 'Method not allowed' });
  return false;
}

/** Read and parse a JSON body with a hard size cap. */
export async function readJson(req, maxBytes = 12 * 1024 * 1024) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) {
      const err = new Error('Body too large');
      err.statusCode = 413;
      throw err;
    }
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    const err = new Error('Body was not valid JSON');
    err.statusCode = 400;
    throw err;
  }
}

/** The caller's IP, for rate limiting. Trusts Vercel's proxy header. */
export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  return req.socket && req.socket.remoteAddress || 'unknown';
}

/* Errors are logged with their message only. Never log a request body: on
   these routes it holds passwords and slip images.
 *
 * `.status` as well as `.statusCode`. The Anthropic SDK puts the HTTP status
 * on `.status`, so a 400 from the model API arrived here looking like an
 * unknown error, was reported as a 500, and its message, the one thing that
 * says WHAT was wrong, was replaced by the generic fallback. The slip reader
 * failed for days that way: a specific, fixable complaint from the API,
 * rendered as "the slip reader is unavailable right now". */
export function fail(res, err, fallbackMessage) {
  const status = (err && (err.statusCode || err.status)) || 500;
  const detail = err && err.message ? err.message : 'unknown error';
  console.error('[slippery]', status, detail);
  json(res, status, { error: status === 500 ? fallbackMessage : (detail || fallbackMessage) });
}
