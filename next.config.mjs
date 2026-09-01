/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    /*  Security headers, which the platform does not add for you beyond HSTS.
     *
     *  No Content-Security-Policy beyond frame-ancestors. A real script-src
     *  needs a nonce threaded through every inline script Next emits, and a
     *  CSP added blind is a CSP that either breaks the page or is written
     *  loose enough to be decorative. frame-ancestors is the half that can be
     *  set safely and it is the half that matters here: this product has
     *  account settings, a billing portal and a cancel button, and all three
     *  are worth stealing a click on.
     *
     *  camera=(self) rather than (): a shop slip is photographed. Everything
     *  else this product has no business asking for. */
    const SAFE = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      {
        key: 'Content-Security-Policy',
        /*  Four directives that need no nonce and cost no rendering.
         *
         *  base-uri stops an injected <base> quietly repointing every
         *  relative URL on the page. object-src closes plugins.
         *  frame-ancestors is the clickjacking half.
         *
         *  NO form-action. It was here for one build and the sweep caught it
         *  blocking the sign out form, whose action is same origin: Chromium
         *  still enforces form-action across the redirect that follows the
         *  post, so 'self' is not 'self' by the time it is checked. A
         *  directive that breaks signing out is not a directive worth having,
         *  and it took a browser to find that rather than a reading of the
         *  spec. */
        value: "base-uri 'self'; object-src 'none'; frame-ancestors 'self'",
      },
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      {
        key: 'Permissions-Policy',
        value: 'camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
      },
    ];
    return [
      { source: '/:path*', headers: SAFE },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      /*  The icons, the wordmark and the two portraits are bytes that do not
          change between deploys and were being revalidated on every page
          load. A day, then a week of serving the old one while the new one
          arrives, which is the right shape for a file that only changes when
          somebody redraws it. */
      {
        source: '/:file(icon.svg|wordmark.svg|favicon-16.png|favicon-32.png|apple-touch-icon.png|icon-192.png|icon-512.png|icon-maskable-512.png|manifest.webmanifest)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
      {
        source: '/team/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
    ];
  },
};
export default nextConfig;
