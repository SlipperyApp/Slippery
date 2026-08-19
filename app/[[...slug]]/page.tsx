import { notFound } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { ALL_PATHS, PATH_TO_VIEW } from '@/lib/proto/routes';

/* Every view is prerendered as its own path, so each screen is a real URL
   that reloads, links and shares. The paint itself is client side, because
   the view layer is one function of one state object, which is how the
   prototype was specified and reviewed. */
export function generateStaticParams() {
  return ALL_PATHS.map((p) => ({
    slug: p === '/' ? [] : p.replace(/^\//, '').split('/'),
  }));
}

/* A path that is not a view is a 404, not the landing page wearing somebody
   else's URL. A soft 404 is worse than a hard one: it tells a search engine
   the page exists and tells a person they typed it right. */
export const dynamicParams = false;

export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const path = '/' + (slug ?? []).join('/');
  if (!PATH_TO_VIEW[path === '/' ? '/' : path]) notFound();
  return <AppShell />;
}
