'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { DEFAULT_THEME, THEME_COOKIE, isTheme, type ThemeName } from '@/lib/themes';

type Ctx = { theme: ThemeName; setTheme: (t: ThemeName) => void };
const ThemeCtx = createContext<Ctx>({ theme: DEFAULT_THEME, setTheme: () => {} });

function readCookie(): ThemeName {
  if (typeof document === 'undefined') return DEFAULT_THEME;
  const m = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=([^;]*)`));
  const v = m ? decodeURIComponent(m[1]) : '';
  return isTheme(v) ? v : DEFAULT_THEME;
}

/** Switching fades out for 190ms, swaps, and fades back. Colour is never
 *  tweened: text goes unreadable through the middle of a colour transition. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(DEFAULT_THEME);

  useEffect(() => { setThemeState(readCookie()); }, []);

  const setTheme = useCallback((next: ThemeName) => {
    const root = document.documentElement;
    // One year, lax, no domain: it is a display preference and nothing else.
    document.cookie = `${THEME_COOKIE}=${encodeURIComponent(next)}; path=/; max-age=31536000; samesite=lax`;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      root.setAttribute('data-theme', next);
      setThemeState(next);
      return;
    }
    root.setAttribute('data-theme-swapping', '1');
    window.setTimeout(() => {
      root.setAttribute('data-theme', next);
      setThemeState(next);
      root.removeAttribute('data-theme-swapping');
    }, 190);
  }, []);

  return <ThemeCtx.Provider value={{ theme, setTheme }}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  return useContext(ThemeCtx);
}
