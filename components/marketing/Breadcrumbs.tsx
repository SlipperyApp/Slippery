import Link from 'next/link';
import { Icon } from '@/components/Icon';

export type Crumb = { href: string; label: string };

/** Where you are, and one tap back.
 *
 *  It carries a real ordered list and a real nav landmark, and it emits the
 *  BreadcrumbList JSON-LD alongside, because the thing a breadcrumb is
 *  actually for is telling a search result what this page sits under. Drawing
 *  the arrows without the structured data is decoration.
 *
 *  The current page is the last item and is NOT a link: a link to the page
 *  you are on is a control that does nothing. */
export function Breadcrumbs({ trail, page }: { trail: Crumb[]; page: string }) {
  const base = 'https://slippery-iota.vercel.app';
  const items = [...trail, { href: '', label: page }].map((c, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: c.label,
    ...(c.href ? { item: base + c.href } : {}),
  }));

  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      <ol>
        {trail.map((c) => (
          <li key={c.href}>
            <Link href={c.href}>{c.label}</Link>
            <Icon name="chevronRight" size={13} aria-hidden />
          </li>
        ))}
        <li aria-current="page">{page}</li>
      </ol>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: items,
          }),
        }}
      />
    </nav>
  );
}
