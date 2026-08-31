import { NextResponse, type NextRequest } from 'next/server';

/** /404 and /500 are in the route map and must load with real content.
 *
 *  Next answers a bare /404 with its own 404 status whatever a rewrite
 *  serves, at both the config and the middleware layer, so these are
 *  redirects to the canonical location rather than rewrites. The page that
 *  arrives is the real one, at 200.
 *
 *  A genuinely missing route still gets a real 404 from app/not-found.tsx,
 *  which renders the same pane. That is the difference between looking at
 *  the 404 page and hitting one. */
const ALIASES: Record<string, string> = {
  '/404': '/error-pages/not-found',
  '/500': '/error-pages/server',
};

export function middleware(req: NextRequest) {
  const target = ALIASES[req.nextUrl.pathname];
  if (target) {
    const url = req.nextUrl.clone();
    url.pathname = target;
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/404', '/500'],
};
