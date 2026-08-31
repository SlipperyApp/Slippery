'use client';

import { useTheme } from '@/components/ThemeProvider';
import { THEMES } from '@/lib/themes';

/** A live theme switcher, not a set of screenshots. Picking one applies it to
 *  the page you are reading. */
export function ThemeStrip() {
  const { theme, setTheme } = useTheme();
  return (
    <ul className="grid" style={{ marginTop: 'var(--s6)' }}>
      {THEMES.map((t) => (
        <li key={t.name} style={{ gridColumn: 'span 4' }}>
          <button
            type="button"
            className="card themecard"
            aria-pressed={theme === t.name}
            onClick={() => setTheme(t.name)}
            style={{
              borderColor: theme === t.name ? 'var(--accent)' : undefined,
              height: '100%',
            }}
          >
            <span className="spread">
              <span className="card__title">{t.label}</span>
              {theme === t.name ? <span className="pill pill--accent">On</span> : null}
            </span>
            <span className="small muted" style={{ display: 'block', marginTop: 'var(--s2)' }}>{t.blurb}</span>
            <span className="themecard__swatches" aria-hidden="true">
              {t.swatch.map((c) => (
                <span key={c} className="themecard__sw" style={{ background: c }} />
              ))}
              <span className="themecard__sw" style={{ background: '#86EFAC' }} />
              <span className="themecard__sw" style={{ background: '#FCA5A5' }} />
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
