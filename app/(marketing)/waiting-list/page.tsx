import type { Metadata } from 'next';
import { WaitingListForm } from '@/components/marketing/WaitingListForm';
import { Icon } from '@/components/Icon';
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs';

export const metadata: Metadata = {
  title: 'The app waiting list',
  description:
    'iOS and Android are coming. Leave an address and you will hear once, when the listing is live.',
  alternates: { canonical: '/waiting-list' },
  openGraph: {
    title: 'The Slippery app waiting list',
    description: 'One email, once, when the listing is live.',
    url: '/waiting-list',
    images: [{ url: '/og?title=iOS+and+Android&sub=The+web+app+works+today', width: 1200, height: 630, alt: 'The Slippery app waiting list' }],
  },
};

export default function WaitingList() {
  return (
    <section className="sect">
      <div className="wrap">
        <Breadcrumbs trail={[{ href: '/', label: 'Slippery' }]} page="Waiting list" />
        <div className="column">
          <h1 style={{ fontSize: 'clamp(28px, 6vw, 44px)' }}>
            iOS and Android coming soon. The web app works today.
          </h1>
          <p className="lead" style={{ marginTop: 'var(--s4)' }}>
            Add Slippery to your home screen and it behaves like an app: full screen, its own icon,
            and the bottom bar where your thumb already is.
          </p>

          <div className="card" style={{ marginTop: 'var(--s6)' }}>
            <WaitingListForm />
          </div>

          <div className="banner" style={{ marginTop: 'var(--s5)' }}>
            <Icon name="info" size={18} className="banner__icon" />
            <span>
              No App Store or Google Play badge until there is a live listing. Both forbid
              redrawing their artwork, and neither permits one modified to say "coming soon".
              So this is a line of text.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
