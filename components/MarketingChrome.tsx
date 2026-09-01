import Link from 'next/link';
import { Brand } from '@/components/Brand';
import { Icon } from '@/components/Icon';
import { MARKETING_NAV } from '@/lib/nav';

/** Anything that navigates is an anchor with an href, never a button. */
/*  No id prop any more. It existed only to give each wordmark's clipPath a
    unique name, and the cut is a CSS clip-path: path() now, which has no
    name to collide. */
export function MarketingHeader() {
  return (
    <header className="mhead">
      <div className="wrap mhead__in">
        <Brand size={36} />
        <nav className="mhead__nav" aria-label="Main">
          {MARKETING_NAV.map((n) => (
            <Link key={n.href} href={n.href} className="btn btn--quiet btn--sm">{n.label}</Link>
          ))}
        </nav>
        <div className="mhead__cta">
          <Link href="/login" className="btn btn--quiet btn--sm">Sign in</Link>
          <Link href="/signup" className="btn btn--primary btn--sm">Start free</Link>
        </div>
      </div>
    </header>
  );
}

const FOOT: { title: string; links: { href: string; label: string }[] }[] = [
  {
    title: 'Product',
    links: [
      { href: '/how', label: 'How it works' },
      { href: '/demo', label: 'Live demo' },
      { href: '/import', label: 'Import a history' },
      { href: '/themes', label: 'Themes' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/pricing', label: 'Pricing' },
      { href: '/faq', label: 'Questions' },
      { href: '/social', label: 'Groups and leagues' },
      { href: '/changelog', label: 'What changed' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { href: '/terms', label: 'Terms' },
      { href: '/privacy', label: 'Privacy' },
      { href: '/safer-gambling', label: 'Safer gambling' },
    ],
  },
];

/** The compliance footer. Every public page carries 18+, BeGambleAware and
 *  the helpline number. This is a requirement, not decoration. */
export function MarketingFooter() {
  return (
    <footer className="mfoot">
      <div className="wrap">
        <div className="mfoot__cols">
          <div>
            <Brand size={36} className="brand brand--foot" />
            <p className="small muted" >
              A bet tracker for UK and Irish bettors. Slippery never accepts bets, holds
              money, pays winnings or gives tips.
            </p>
          </div>
          {FOOT.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="label" style={{ marginBottom: 'var(--s3)' }}>{col.title}</p>
              <ul className="stack" style={{ ['--gap' as string]: '2px' }}>
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="small muted" style={{ textDecoration: 'none', display: 'inline-flex', minHeight: '44px', alignItems: 'center' }}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mfoot__legal">
          <span className="pill" aria-label="Eighteen plus only">18+</span>
          <a className="small" href="https://www.begambleaware.org" rel="noopener noreferrer" target="_blank">
            BeGambleAware.org
          </a>
          <span className="small muted">
            National Gambling Helpline 0808 8020 133, free and confidential, 24 hours a day
          </span>
          <span className="small dim" style={{ marginLeft: 'auto' }}>
            &copy; {new Date().getUTCFullYear()} Slippery
          </span>
        </div>
      </div>
    </footer>
  );
}

/** Used at the top of every marketing section. */
/** A section head is a heading and a paragraph.
 *
 *  It used to carry a small capitalised pill above the heading, on every
 *  section of every page. One of those is a label; nine of them in a column
 *  is a template, and it is the single most recognisable tell of a page that
 *  was generated rather than written. The `badge` prop is kept and ignored so
 *  the call sites do not all have to change at once, and so the word is still
 *  in the source for whoever wants it back as something else. */
export function SectionHead({
  setup, claim, children, centred = false,
}: { badge?: string; setup: string; claim: string; children?: React.ReactNode; centred?: boolean }) {
  return (
    <div className={centred ? 'sect__head sect__head--mid' : 'sect__head'}>
      <h2 className="sect__h">
        <span className="setup">{setup}</span>
        <span>{claim}</span>
      </h2>
      {children ? <p className="sect__p">{children}</p> : null}
    </div>
  );
}

/** The card at the end of a marketing page.
 *
 *  Five pages each hand-rolled this: a full width card with a title, a line
 *  and a button, all stacked hard against the left edge. At 1440 that is a
 *  1200px card with 500px of content in one corner and nothing in the other
 *  two thirds, which reads as a layout that ran out rather than one that
 *  ended. The words go left, the actions go right, and they meet in the
 *  middle of the same card. Below 760 it stacks, because two columns of one
 *  thing each is not a row.
 *
 *  It is one component so the five pages cannot drift apart again. */
export function EndCard({
  title, children, actions,
}: { title: string; children?: React.ReactNode; actions: React.ReactNode }) {
  return (
    <div className="card endcard">
      <div>
        <p className="card__title">{title}</p>
        {children ? <p className="small muted endcard__p">{children}</p> : null}
      </div>
      <div className="endcard__do">{actions}</div>
    </div>
  );
}

export function Checks({ items }: { items: string[] }) {
  return (
    <ul className="checks">
      {items.map((t) => (
        <li key={t} className="checkitem">
          <Icon name="check" size={16} />
          <span>{t}</span>
        </li>
      ))}
    </ul>
  );
}

export function RowList({ rows }: { rows: { title: string; sub: string; on?: boolean; icon?: React.ComponentProps<typeof Icon>['name'] }[] }) {
  return (
    <ul className="rows">
      {rows.map((r) => (
        <li key={r.title} className={`rowcard${r.on ? ' rowcard--on' : ''}`}>
          <Icon name={r.icon ?? 'check'} size={20} className="rowcard__i" />
          <div>
            <p className="rowcard__t">{r.title}</p>
            <p className="rowcard__s">{r.sub}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
