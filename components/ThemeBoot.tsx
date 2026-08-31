/** Applies the saved theme before first paint.
 *
 *  The store is a cookie, never localStorage or sessionStorage: iOS Safari is
 *  the primary target and both are unavailable to us there by policy. The
 *  cookie is read here rather than server side so that marketing pages stay
 *  static. */

import { DEFAULT_THEME, THEME_COOKIE, THEME_NAMES } from '@/lib/themes';

const SRC = `(function(){try{
var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=([^;]*)/);
var t=m?decodeURIComponent(m[1]):'${DEFAULT_THEME}';
var ok=${JSON.stringify(THEME_NAMES)};
document.documentElement.setAttribute('data-theme',ok.indexOf(t)>-1?t:'${DEFAULT_THEME}');
}catch(e){}})();`;

export function ThemeBoot() {
  return <script dangerouslySetInnerHTML={{ __html: SRC }} />;
}
