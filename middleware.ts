import { NextRequest, NextResponse } from 'next/server';

/* Content Security Policy, with a nonce.
 *
 * The old deployment shipped `script-src 'self' 'unsafe-inline'`, which is a
 * policy that permits exactly the injection a policy is for. Next.js emits
 * inline bootstrap scripts, so the answer is a per-request nonce rather than
 * a blanket allowance: a script the server did not put there has no nonce
 * and does not run.
 */
export function middleware(req: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    /* The view layer sets element styles directly, as the prototype does,
       so inline style attributes are permitted. No external host is. */
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
    'upgrade-insecure-requests',
  ].join('; ');

  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce);

  const res = NextResponse.next({ request: { headers } });
  res.headers.set('Content-Security-Policy', csp);
  return res;
}

export const config = {
  matcher: [
    /* Static assets and the image optimiser do not need a policy and would
       pay for one on every request. */
    { source: '/((?!_next/static|_next/image|favicon.ico|sw.js).*)' },
  ],
};
