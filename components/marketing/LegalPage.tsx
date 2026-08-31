import { Icon } from '@/components/Icon';

export function LegalPage({
  title, updated, sections,
}: {
  title: string;
  updated: string;
  sections: { h: string; p: string[] }[];
}) {
  return (
    <section className="sect">
      <div className="wrap">
        <div className="column column--wide" style={{ marginInline: 0 }}>
          <span className="pill">Legal</span>
          <h1 style={{ marginTop: 'var(--s4)', fontSize: 'clamp(28px, 5vw, 40px)' }}>{title}</h1>
          <p className="small dim" style={{ marginTop: 'var(--s2)' }}>Last updated {updated}</p>

          <div className="banner" style={{ marginTop: 'var(--s5)' }}>
            <Icon name="info" size={18} className="banner__icon" />
            <span>
              This is the working text. The final wording is a decision for the owner and their
              adviser, not for the build, and it is marked here rather than presented as settled.
            </span>
          </div>

          <nav aria-label="On this page" style={{ marginTop: 'var(--s6)' }}>
            <p className="label" style={{ marginBottom: 'var(--s2)' }}>On this page</p>
            <ol className="logstrip">
              {sections.map((s, i) => (
                <li key={s.h}>
                  <a href={`#s${i}`} className="pill pill--lg" style={{ textDecoration: 'none' }}>{s.h}</a>
                </li>
              ))}
            </ol>
          </nav>

          <ol style={{ marginTop: 'var(--s7)' }}>
            {sections.map((s, i) => (
              <li key={s.h} id={`s${i}`} style={{ marginBottom: 'var(--s7)', scrollMarginTop: '80px' }}>
                <h2 style={{ fontSize: 'var(--t-h3)' }}>
                  <span className="mono dim" style={{ marginRight: 10, fontSize: 'var(--t-small)' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {s.h}
                </h2>
                {s.p.map((para) => (
                  <p key={para} className="muted" style={{ marginTop: 'var(--s3)', maxWidth: '68ch' }}>{para}</p>
                ))}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
