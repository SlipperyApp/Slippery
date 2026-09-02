import { MarketingHeader, MarketingFooter } from '@/components/MarketingChrome';

/** A shared balance is a public page, so it takes the public chrome: the same
 *  header, the same compliance footer with 18+, BeGambleAware and the
 *  helpline on it. A signed out stranger arriving from a link somebody sent
 *  them is exactly who that footer is for. */
export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page">
      <MarketingHeader />
      <main id="main">{children}</main>
      <MarketingFooter />
    </div>
  );
}
