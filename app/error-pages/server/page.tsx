import type { Metadata } from 'next';
import { ServerErrorPane } from '@/components/marketing/ErrorPane';
import { MarketingHeader, MarketingFooter } from '@/components/MarketingChrome';

export const metadata: Metadata = {
  title: 'Something failed on our side',
  description: 'That failed on our side, and nothing was saved. Every write goes inside one transaction with the recompute that follows it.',
  robots: { index: false, follow: true },
};

export default function FiveHundred() {
  return (
    <div className="page">
      <MarketingHeader />
      <main id="main"><div className="wrap"><ServerErrorPane /></div></main>
      <MarketingFooter />
    </div>
  );
}
