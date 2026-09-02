import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs';
import { QUESTIONS } from '@/lib/content/faq';
import { spell } from '@/lib/format';

export const metadata: Metadata = {
  title: 'Thank you',
  description:
    'What happens next, and where to go from here. Nothing about your ledger changed.',
  alternates: { canonical: '/thank-you' },
  /*  A confirmation page has nothing a search result should ever land on, and
      indexing one is how "thank you" pages end up ranking for the product. */
  robots: { index: false, follow: true },
  openGraph: {
    title: 'Thank you',
    description: 'What happens next, and where to go from here.',
    url: '/thank-you',
    images: [{ url: '/og?title=Thank+you&sub=What+happens+next', width: 1200, height: 630, alt: 'Thank you' }],
  },
};

const NEXT = [
  { href: '/demo', t: 'The example account', s: 'The dashboard itself, on six months of bets' },
  { href: '/how', t: 'How it works', s: 'Slip in, ledger out, and what happens between' },
  { href: '/faq', t: 'Questions', s: `${spell(QUESTIONS.length)} of them, answered without the marketing` },
];

export default function ThankYou() {
  return (
    <section className="sect">
      <div className="wrap">
        <Breadcrumbs trail={[{ href: '/', label: 'Slippery' }]} page="Thank you" />

        <div className="column" style={{ marginInline: 0 }}>
          <h1 className="sect__h" style={{ fontSize: 'clamp(30px, 6vw, 48px)' }}>
            <span className="setup">That went through.</span>
            <span>Thank you.</span>
          </h1>

          <p className="lead" style={{ marginTop: 'var(--s4)' }}>
            Nothing about your ledger changed, and nothing needs doing. If you were paying for
            something, the receipt is already in your email.
          </p>

          <div className="card" style={{ marginTop: 'var(--s7)' }}>
            <p className="label">Where to go from here</p>
            <ul style={{ marginTop: 'var(--s3)' }}>
              {NEXT.map((l) => (
                <li key={l.href} className="brow">
                  <Link href={l.href} style={{ textDecoration: 'none', minWidth: 0 }}>
                    <span className="brow__title">{l.t}</span>
                    <span className="brow__sub">{l.s}</span>
                  </Link>
                  <Icon name="chevronRight" size={16} />
                </li>
              ))}
            </ul>
          </div>

          <div className="row row--wrap" style={{ marginTop: 'var(--s6)', gap: 'var(--s4)' }}>
            <Link href="/app" className="btn btn--primary">Open your dashboard</Link>
            <Link href="/" className="btn btn--link">Back to the start</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
