'use client';

import { useTheme } from '@/components/ThemeProvider';
import { THEMES } from '@/lib/themes';

/** A live theme switcher, not a set of screenshots. Picking one applies it to
 *  the page you are reading, immediately.
 *
 *  Each chip is built from that theme's OWN ground, surface, accent and line,
 *  so the row is eight palettes rather than eight labels: you can see what
 *  Bronze is before you land on it. The colours are duplicated out of
 *  tokens.css into lib/themes.ts because a chip has to paint a theme that is
 *  not the one currently applied, so it cannot read var(--accent).
 *  tests/themes.test.ts fails if the two ever drift apart. */
export function ThemeStrip() {
  const { theme, setTheme } = useTheme();
  const current = THEMES.find((t) => t.name === theme) ?? THEMES[0];

  return (
    <div className="tpick">
      <ul className="tpick__row">
        {THEMES.map((t) => {
          const [ground, surface, accent, line] = t.swatch;
          return (
            <li key={t.name}>
              <button
                type="button"
                className="tpick__b"
                aria-pressed={theme === t.name}
                onClick={() => setTheme(t.name)}
                title={t.blurb}
              >
                <span
                  className="tpick__chip"
                  aria-hidden="true"
                  style={{ background: surface, borderColor: line, boxShadow: `inset 0 0 0 3px ${ground}` }}
                >
                  <span className="tpick__dot" style={{ background: accent }} />
                </span>
                <span className="tpick__l">{t.label}</span>
              </button>
            </li>
          );
        })}
      </ul>

      {/* One line, for the theme you are on. Eight blurbs stacked up said the
          same thing eight times and nobody read the seventh. */}
      <p className="tpick__blurb" aria-live="polite">{current.blurb}</p>
    </div>
  );
}
