import type { Metadata } from 'next';
import { Brand } from '@/components/Brand';

export const metadata: Metadata = {
  title: { default: 'Sign in', template: '%s · Slippery' },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page" style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: 'var(--s5) var(--s4)' }}>
        <div className="wrap" style={{ padding: 0 }}>
          <Brand size={40} />
        </div>
      </header>
      <main id="main" style={{ flex: 1, display: 'flex', alignItems: 'center', padding: 'var(--s4) var(--s4) var(--s9)' }}>
        <div className="column column--narrow">{children}</div>
      </main>
      <footer style={{ padding: 'var(--s5) var(--s4)', borderTop: '1px solid var(--line)' }}>
        <div className="wrap row row--wrap" style={{ padding: 0, gap: 'var(--s3) var(--s5)' }}>
          <span className="pill" aria-label="Eighteen plus only">18+</span>
          <a className="small" href="https://www.begambleaware.org" rel="noopener noreferrer" target="_blank">BeGambleAware.org</a>
          <span className="small muted">National Gambling Helpline 0808 8020 133, free and confidential, 24 hours a day</span>
        </div>
      </footer>
    </div>
  );
}
