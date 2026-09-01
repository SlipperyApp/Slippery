import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://slippery-iota.vercel.app';

/** The public routes only. Everything under /app is a person's own ledger and
 *  is marked noindex on the page itself. */
export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    ['/', 1.0], ['/how', 0.9], ['/pricing', 0.9], ['/demo', 0.8], ['/faq', 0.7],
    ['/social', 0.7], ['/import', 0.7], ['/themes', 0.6], ['/changelog', 0.5],
    ['/safer-gambling', 0.6], ['/waiting-list', 0.4], ['/terms', 0.3], ['/privacy', 0.3],
  ] as const;
  const now = new Date();
  return routes.map(([path, priority]) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: 'weekly' as const,
    priority,
  }));
}
