/** The eight themes. All dark: there is no light mode, because profit green
 *  measures 1.07:1 on beige and disappears. The names carry forward from the
 *  previous build; nothing about their appearance does.
 *
 *  ALL EIGHT ARE AVAILABLE TO EVERYBODY, AND THERE IS NO UNLOCK.
 *
 *  Each theme used to carry an `unlock` string, and three of them were "Log 10
 *  slips", "Settle 25 bets" and "A 30 day streak of capture". Nothing read the
 *  field, which is the only reason it never shipped as behaviour, but a
 *  colour scheme you earn by settling a twenty fifth bet is a reason to place
 *  a twenty fifth bet, and the field sat here asserting that policy for the
 *  next session to implement. A theme is a preference. */

export type ThemeName =
  | 'carbon' | 'periwinkle' | 'ink' | 'graphite'
  | 'slate' | 'bronze' | 'cinnabar' | 'liquid';

export type Theme = {
  name: ThemeName;
  label: string;
  /** One line on what it is for, shown on /themes and in Settings. */
  blurb: string;
  /** ground, surface, accent, line. The picker chip is built from these, so
   *  the row reads as eight palettes rather than eight labels. They mirror
   *  --bg/--card/--p/--line in tokens.css; tests/themes.test.ts
   *  fails if they drift. */
  swatch: [string, string, string, string];
};

export const THEMES: Theme[] = [
  { name: 'carbon', label: 'Carbon', blurb: 'Steel on near black. The default.', swatch: ['#0C0E13', '#14171F', '#6E86B8', '#181C26'] },
  { name: 'periwinkle', label: 'Periwinkle', blurb: 'Indigo on deep navy.', swatch: ['#0A0F1E', '#13182A', '#6D86DB', '#171E31'] },
  { name: 'ink', label: 'Ink', blurb: 'Near black, violet cast. The darkest.', swatch: ['#050508', '#0E0F15', '#8B84C4', '#12141C'] },
  { name: 'graphite', label: 'Graphite', blurb: 'Deep green grey. Almost black.', swatch: ['#0A0C0B', '#121517', '#7E9188', '#171B1E'] },
  { name: 'slate', label: 'Slate', blurb: 'Steel blue grey. The lightest dark.', swatch: ['#161A21', '#1E232C', '#7E93B5', '#222833'] },
  { name: 'bronze', label: 'Bronze', blurb: 'Warm paper on dark. The only warm one.', swatch: ['#12100C', '#1A1917', '#A8926A', '#1F1E1E'] },
  { name: 'cinnabar', label: 'Cinnabar', blurb: 'Burnt red on near black.', swatch: ['#130D0B', '#1B1617', '#C4643F', '#201B1D'] },
  { name: 'liquid', label: 'Liquid', blurb: 'Deep marine. The coldest.', swatch: ['#04171C', '#0C2028', '#54AEBE', '#11252F'] },
];

export const THEME_NAMES = THEMES.map((t) => t.name);
export const DEFAULT_THEME: ThemeName = 'carbon';

export function isTheme(v: unknown): v is ThemeName {
  return typeof v === 'string' && (THEME_NAMES as string[]).includes(v);
}

export const THEME_COOKIE = 'slip_theme';
