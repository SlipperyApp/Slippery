import type { Metadata } from 'next';
import { ThemeStrip } from '@/components/marketing/ThemeStrip';
import { SectionHead } from '@/components/MarketingChrome';
import { Breadcrumbs } from '@/components/marketing/Breadcrumbs';

export const metadata: Metadata = {
  title: 'Themes',
  description:
    'Eight dark themes. There is no light mode, because profit green measures 1.07 to 1 on beige and disappears. Pick one and this page changes.',
  alternates: { canonical: '/themes' },
  openGraph: {
    title: 'Eight themes, all of them dark',
    description: 'Profit green has to survive the ground it sits on.',
    url: '/themes',
    images: [{ url: '/og?title=Eight+themes&sub=All+of+them+dark', width: 1200, height: 630, alt: 'Slippery themes' }],
  },
};

export default function Themes() {
  return (
    <section className="sect">
      <div className="wrap">
        <Breadcrumbs trail={[{ href: '/', label: 'Slippery' }]} page="Themes" />
        <h1 className="sect__h" style={{ fontSize: 'clamp(30px, 6vw, 48px)' }}>
          <span className="setup">Eight, all of them dark.</span>
          <span>Pick one and this page changes.</span>
        </h1>
        <p className="sect__p">
          Not a gallery of screenshots. Every chip below applies its theme to the page you are
          reading.
        </p>

        <ThemeStrip />

        <div className="two" style={{ marginTop: 'var(--s9)' }}>
          <SectionHead
            badge="Why no light mode"
            setup="It was built."
            claim="Then it was measured."
          >
            Profit green on a beige page measures 1.07 to 1. Text needs 4.5 to 1 to be readable and
            3 to 1 to be seen at all. The single most important colour in the product disappeared,
            so the light themes were removed rather than darkened into a compromise.
          </SectionHead>
          <div className="card">
            <p className="label">Locked and never theme dependent</p>
            <div className="row" style={{ marginTop: 'var(--s4)', gap: 'var(--s5)' }}>
              <div>
                <span className="themecard__sw" style={{ background: '#86EFAC', width: 44, height: 44 }} aria-hidden="true" />
                <p className="small mono pos" style={{ marginTop: 'var(--s2)' }}>#86EFAC</p>
                <p className="small dim">Profit</p>
              </div>
              <div>
                <span className="themecard__sw" style={{ background: '#FCA5A5', width: 44, height: 44 }} aria-hidden="true" />
                <p className="small mono neg" style={{ marginTop: 'var(--s2)' }}>#FCA5A5</p>
                <p className="small dim">Loss</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
