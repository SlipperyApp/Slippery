import type { Metadata } from 'next';
import { NotFoundPane } from '@/components/marketing/ErrorPane';
import { MarketingHeader, MarketingFooter } from '@/components/MarketingChrome';

export const metadata: Metadata = {
  title: 'Page not found',
  description: 'Nothing in your ledger has changed. This page does not exist, which is a different thing from something going wrong.',
  robots: { index: false, follow: true },
};

export default function FourOhFour() {
  return (
    <div className="page">
      <MarketingHeader id="wm-404" />
      <main id="main"><div className="wrap"><NotFoundPane /></div></main>
      <MarketingFooter />
    </div>
  );
}
