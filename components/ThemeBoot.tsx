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
var name=ok.indexOf(t)>-1?t:'${DEFAULT_THEME}';
document.documentElement.setAttribute('data-theme',name);
/*  The browser chrome follows the theme too. Without this the status bar on
    a phone stays carbon while the page is bronze, which on an installed PWA
    is the first thing anybody sees. Read from the computed value rather than
    a table, so it cannot drift from the stylesheet. */
var m2=document.querySelector('meta[name="theme-color"]');
if(!m2){m2=document.createElement('meta');m2.setAttribute('name','theme-color');document.head.appendChild(m2);}
var bg=getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
if(bg)m2.setAttribute('content',bg);
}catch(e){}})();`;

export function ThemeBoot() {
  return <script dangerouslySetInnerHTML={{ __html: SRC }} />;
}
