import { NotFoundPane } from '@/components/marketing/ErrorPane';
import { MarketingHeader, MarketingFooter } from '@/components/MarketingChrome';

/** The real 404, which returns a 404 status. /404 renders the same pane with
 *  a 200 so the route map can point at it. */
export default function NotFound() {
  return (
    <div className="page">
      <MarketingHeader id="wm-nf" />
      <main id="main"><div className="wrap"><NotFoundPane /></div></main>
      <MarketingFooter />
    </div>
  );
}
