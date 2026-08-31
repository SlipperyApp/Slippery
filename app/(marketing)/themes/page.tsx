import type { Metadata } from 'next';
import { ThemeStrip } from '@/components/marketing/ThemeStrip';
import { SectionHead } from '@/components/MarketingChrome';

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
        <span className="pill">Themes</span>
        <h1 className="sect__h" style={{ marginTop: 'var(--s4)', fontSize: 'clamp(30px, 6vw, 48px)' }}>
          <span className="setup">Eight, all of them dark.</span>
          <span>Pick one and this page changes.</span>
        </h1>
        <p className="sect__p">
          Not a gallery of screenshots. Every card below applies its theme to the page you are
          reading, including this sentence, the header and the footer.
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
            <p className="small muted" style={{ marginTop: 'var(--s4)' }}>
              These two are declared once, outside every theme block, and no theme may redefine
              them. No theme accent is allowed near either, which is why there is no green theme
              and no red theme in the eight.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
