import type { Metadata } from 'next';
import { Faq } from '@/components/marketing/Faq';
import { QUESTIONS } from '@/lib/content/faq';
import { spell } from '@/lib/format';
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Questions',
  description:
    'What Slippery does with a slip, how settlement decides, what happens to your data, and what it does not do.',
  alternates: { canonical: '/faq' },
  openGraph: {
    title: 'Questions about Slippery',
    description: 'What it does with a slip, how settlement decides, and what it does not do.',
    url: '/faq',
    images: [{ url: '/og?title=Questions&sub=What+it+does%2C+and+what+it+does+not', width: 1200, height: 630, alt: 'Questions about Slippery' }],
  },
};

export default function FaqPage() {
  return (
    <section className="sect">
      <div className="wrap">
        <Breadcrumbs trail={[{ href: '/', label: 'Slippery' }]} page="Questions" />
        <h1 className="sect__h" style={{ fontSize: 'clamp(30px, 6vw, 48px)' }}>
          <span className="setup">{spell(QUESTIONS.length)} questions.</span>
          <span>Answered without the marketing.</span>
        </h1>
        <div className="column column--wide" style={{ marginTop: 'var(--s7)', marginInline: 0 }}>
          <Faq items={QUESTIONS} />
        </div>
      </div>
    </section>
  );
}
