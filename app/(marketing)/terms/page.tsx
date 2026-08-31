import type { Metadata } from 'next';
import { TERMS, TERMS_UPDATED } from '@/lib/legal';
import { LegalPage } from '@/components/marketing/LegalPage';

export const metadata: Metadata = {
  title: 'Terms',
  description: 'The terms you use Slippery under. It keeps a record of bets you placed elsewhere; it never accepts bets, holds money or pays winnings.',
  alternates: { canonical: '/terms' },
  openGraph: {
    title: 'Slippery terms',
    description: 'A record keeping tool, and the line it will not cross.',
    url: '/terms',
    images: [{ url: '/og?title=Terms&sub=What+Slippery+is%2C+and+is+not', width: 1200, height: 630, alt: 'Slippery terms' }],
  },
};

export default function Terms() {
  return <LegalPage title="Terms" updated={TERMS_UPDATED} sections={TERMS} />;
}
