/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: true },
  /** /404 and /500 are in the route map and must return 200 with real
   *  content. They cannot live at app/404 and app/500: Next reserves those
   *  paths at export time and the build fails renaming 500.html. They live
   *  under /error-pages and these rewrites keep the public URLs. */
  async rewrites() {
    return [
      { source: '/404', destination: '/error-pages/not-found' },
      { source: '/500', destination: '/error-pages/server' },
    ];
  },
  async headers() {
    return [
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
    ];
  },
};
export default nextConfig;
