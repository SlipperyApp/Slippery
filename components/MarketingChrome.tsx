import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { Wordmark } from '@/components/Wordmark';
import { MARKETING_NAV } from '@/lib/nav';

/** Anything that navigates is an anchor with an href, never a button. */
export function MarketingHeader({ id = 'wm-head' }: { id?: string }) {
  return (
    <header className="mhead">
      <div className="wrap mhead__in">
        <Link href="/" className="brand" aria-label="Slippery, home">
          <img src="/icon.svg" alt="" className="brand__mark" width={26} height={26} />
          <Wordmark id={id} height={17} className="hide-sm" />
          <span className="brand__word sr-only">Slippery</span>
        </Link>
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
            <div className="brand" style={{ marginBottom: 'var(--s3)' }}>
              <img src="/icon.svg" alt="" className="brand__mark" width={26} height={26} />
              <span className="brand__word">Slippery</span>
            </div>
            <p className="small muted" style={{ maxWidth: '34ch' }}>
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
                    <Link href={l.href} className="small muted" style={{ textDecoration: 'none', display: 'inline-flex', minHeight: '32px', alignItems: 'center' }}>
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
export function SectionHead({
  badge, setup, claim, children,
}: { badge: string; setup: string; claim: string; children?: React.ReactNode }) {
  return (
    <div className="sect__head">
      <span className="pill sect__badge">{badge}</span>
      <h2 className="sect__h">
        <span className="setup">{setup}</span>
        <span>{claim}</span>
      </h2>
      {children ? <p className="sect__p">{children}</p> : null}
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
