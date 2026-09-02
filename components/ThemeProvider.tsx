'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { DEFAULT_THEME, THEME_COOKIE, readTheme, type ThemeName } from '@/lib/themes';

type Ctx = { theme: ThemeName; setTheme: (t: ThemeName) => void };
const ThemeCtx = createContext<Ctx>({ theme: DEFAULT_THEME, setTheme: () => {} });

function readCookie(): ThemeName {
  if (typeof document === 'undefined') return DEFAULT_THEME;
  const m = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`));
  /*  readTheme rather than isTheme, so a cookie naming a theme that has since
      been renamed lands on the theme it became instead of silently on the
      default. See the RENAMED table in lib/themes.ts. */
  return readTheme(m ? decodeURIComponent(m[1]) : '');
}

/** Switching swaps the attribute and lets the COLOURS move.
 *
 *  It used to blank the page to opacity 0 for 190ms and fade back, which is a
 *  flash rather than a transition: for a fifth of a second there is nothing on
 *  screen at all. The grounds, lines and inks now interpolate over 140ms with
 *  the words still in place (see base.css), which is both faster and smoother.
 *
 *  The old comment said colour must never be tweened because text goes
 *  unreadable through the middle. That is true when a transition crosses the
 *  background, and none of these do: every theme's ink is light and every
 *  theme's ground is dark, so the path between any two never passes through
 *  the other. The two result colours are identical in all eight themes and do
 *  not move at all. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(DEFAULT_THEME);

  useEffect(() => { setThemeState(readCookie()); }, []);

  const setTheme = useCallback((next: ThemeName) => {
    const root = document.documentElement;
    // One year, lax, no domain: it is a display preference and nothing else.
    document.cookie = `${THEME_COOKIE}=${encodeURIComponent(next)}; path=/; max-age=31536000; samesite=lax`;

    root.setAttribute('data-theme', next);

    /*  And the browser chrome. Read from the computed value after the
     *  attribute is set, so the meta can never disagree with the stylesheet. */
    const meta = document.querySelector('meta[name="theme-color"]');
    const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
    if (meta && bg) meta.setAttribute('content', bg);

    setThemeState(next);
  }, []);

  return <ThemeCtx.Provider value={{ theme, setTheme }}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return useContext(ThemeCtx);
}
