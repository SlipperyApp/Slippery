import { MarketingHeader, MarketingFooter } from '@/components/MarketingChrome';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page">
      <MarketingHeader />
      <main id="main">{children}</main>
      <MarketingFooter />
    </div>
  );
}
