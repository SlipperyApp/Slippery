import type { Metadata } from 'next';
import { PRIVACY, PRIVACY_UPDATED } from '@/lib/legal';
import { LegalPage } from '@/components/marketing/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What Slippery holds, why, for how long, and who it goes to. Slip images are deleted after 90 days or immediately on request.',
  alternates: { canonical: '/privacy' },
  openGraph: {
    title: 'Slippery privacy',
    description: 'What is held, why, for how long, and who it goes to.',
    url: '/privacy',
    images: [{ url: '/og?title=Privacy&sub=What+is+held%2C+and+for+how+long', width: 1200, height: 630, alt: 'Slippery privacy' }],
  },
};

export default function Privacy() {
  return <LegalPage title="Privacy" updated={PRIVACY_UPDATED} sections={PRIVACY} />;
}
