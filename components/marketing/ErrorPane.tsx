import Link from 'next/link';
import { Icon } from '@/components/Icon';

/** The 404 line is the best copy in the product and it stays. The 500 is
 *  written in the same voice and answers the only question that matters
 *  after a failure: was anything saved. */
export function NotFoundPane() {
  return (
    <div className="column" style={{ paddingBlock: 'var(--s10)' }}>
      <span className="pill">404</span>
      <h1 style={{ marginTop: 'var(--s4)', fontSize: 'clamp(28px, 6vw, 44px)' }}>
        Nothing in your ledger has changed.
      </h1>
      <p className="lead" style={{ marginTop: 'var(--s4)' }}>
        This page does not exist, which is a different thing from something going wrong. Every bet
        you have logged is exactly where you left it.
      </p>
      <div className="row row--wrap" style={{ marginTop: 'var(--s6)', gap: 'var(--s4)' }}>
        <Link href="/app" className="btn btn--primary">Back to your dashboard</Link>
        <Link href="/" className="btn btn--link">Slippery home</Link>
      </div>
      <div className="card" style={{ marginTop: 'var(--s8)' }}>
        <p className="label">Where you probably meant to go</p>
        <ul style={{ marginTop: 'var(--s3)' }}>
          {[
            { href: '/app/ledger', t: 'Your ledger', s: 'Every bet, with facets that agree with the row count' },
            { href: '/app/import', t: 'Add a bet', s: 'Forward, upload, photograph or type it in' },
            { href: '/app/social', t: 'Groups', s: 'Your leagues and the Slippers in them' },
            { href: '/faq', t: 'Questions', s: 'Seventeen of them, answered without the marketing' },
          ].map((l) => (
            <li key={l.href} className="brow">
              <Link href={l.href} style={{ textDecoration: 'none', minWidth: 0 }}>
                <span className="brow__title" style={{ display: 'block' }}>{l.t}</span>
                <span className="brow__sub">{l.s}</span>
              </Link>
              <Icon name="chevronRight" size={16} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function ServerErrorPane({ reset }: { reset?: () => void }) {
  return (
    <div className="column" style={{ paddingBlock: 'var(--s10)' }}>
      <span className="pill pill--neg">500</span>
      <h1 style={{ marginTop: 'var(--s4)', fontSize: 'clamp(28px, 6vw, 44px)' }}>
        That failed on our side, and nothing was saved.
      </h1>
      <p className="lead" style={{ marginTop: 'var(--s4)' }}>
        Every write goes inside one transaction with the recompute that follows it, so a request
        that fails writes nothing at all. Your ledger is exactly as it was a moment ago, and no
        half finished bet is sitting in it.
      </p>
      <p className="muted" style={{ marginTop: 'var(--s4)' }}>
        If you were sending a slip, send it again. It has not been counted against your allowance.
      </p>
      <div className="row row--wrap" style={{ marginTop: 'var(--s6)', gap: 'var(--s4)' }}>
        {reset ? (
          <button type="button" className="btn btn--primary" onClick={reset}>
            <Icon name="refresh" size={16} /> Try that again
          </button>
        ) : (
          <Link href="/app" className="btn btn--primary">Back to your dashboard</Link>
        )}
        <Link href="/api/sources" className="btn btn--link">What this deployment can reach</Link>
      </div>
    </div>
  );
}
