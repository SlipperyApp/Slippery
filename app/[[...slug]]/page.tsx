import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { AppShell } from '@/components/AppShell';
import { ALL_PATHS, PATH_TO_VIEW, SECTIONS, metaForPath } from '@/lib/proto/routes';

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

/* 02/04 · Every route now carries its own title, description and canonical.
 *
 * All 173 captures previously shared one `<title>Slippery</title>`, and seven
 * marketing paths returned byte-identical content with no canonical between
 * them — which is a duplicate-content signal aimed at yourself. The canonical
 * is emitted per path so each one declares which URL it is, whether or not
 * the sections later become anchors on a single page. */
export async function generateMetadata(
  { params }: { params: Promise<{ slug?: string[] }> },
): Promise<Metadata> {
  const { slug } = await params;
  const path = '/' + (slug ?? []).join('/');
  const { title, description } = metaForPath(path);
  return {
    /* Specific part first: a tab strip truncates from the right, and the
       shared half is the half you can afford to lose. */
    title: `${title} · Slippery`,
    description,
    alternates: { canonical: path === '/' ? '/' : path },
    openGraph: { title: `${title} · Slippery`, description, url: path },
  };
}

export default async function Page({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug } = await params;
  const path = '/' + (slug ?? []).join('/');
  /* A section path renders the landing page and scrolls to an anchor, so it
     is a real address even though it is not its own view. */
  if (!PATH_TO_VIEW[path] && !SECTIONS[path]) notFound();
  return <AppShell />;
}
