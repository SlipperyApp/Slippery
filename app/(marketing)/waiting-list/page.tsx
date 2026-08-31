import type { Metadata } from 'next';
import { WaitingListForm } from '@/components/marketing/WaitingListForm';
import { Icon } from '@/components/Icon';

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
        <div className="column">
          <span className="pill">Coming soon</span>
          <h1 style={{ marginTop: 'var(--s4)', fontSize: 'clamp(28px, 6vw, 44px)' }}>
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
              There is no App Store or Google Play badge on this site, and there will not be one
              until there is a live listing. Both companies forbid redrawing or recolouring their
              artwork, and neither permits a badge modified to say "coming soon", which is why this
              is a line of text.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
