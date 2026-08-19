import { AppShell } from '@/components/AppShell';
import { ALL_PATHS } from '@/lib/proto/routes';

/* Every view is prerendered as its own path, so each screen is a real URL that
   reloads, links and shares. The paint itself is client-side because the view
   layer is one function of one state object, which is how the prototype was
   specified and reviewed. */
export function generateStaticParams() {
  return ALL_PATHS.map((p) => ({
    slug: p === '/' ? [] : p.replace(/^\//, '').split('/'),
  }));
}

export const dynamicParams = true;

export default function Page() {
  return <AppShell />;
}
